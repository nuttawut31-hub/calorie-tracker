// ============================================================================
// POST /api/analyze-image
// Step 1: Vision AI identifies food with cooking state + grams + searchTerms
// Step 2: USDA → Open Food Facts → category estimate (USDA is more accurate
//         for whole/fresh foods; OFF is crowd-sourced and less reliable)
//
// Vision provider priority:
//   1. Google Gemini 1.5 Flash (free, 1,500 req/day)
//      → Get key: https://aistudio.google.com/app/apikey
//   2. Groq Llama Vision (free fallback, 1,000 req/day)
//      → Get key: https://console.groq.com/keys
// ============================================================================

import { NextRequest } from "next/server";
import { generateId } from "@/lib/utils";
import type { Ingredient, NutritionInfo } from "@/lib/types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

// ─── Clinical Nutrition Prompt ────────────────────────────────────────────────
// Chain-of-thought: context → identify → estimate → format
// Returns searchTerms[] so we can retry DB lookups with fallback names.
const VISION_PROMPT = `You are a clinical dietitian with 20 years of experience in food portion analysis.

TASK: Analyze this food image step-by-step like a professional nutritionist.

STEP 1 — CONTEXT: Note the plate/bowl size, utensils, and any size references visible. Use a standard dinner plate (26 cm) as the default reference if unclear.

STEP 2 — IDENTIFY each food item:
  • State the exact food and its cooking method (never omit cooking state)
  • Cooking methods: raw, steamed, boiled, stir-fried, deep-fried, pan-fried, baked, roasted, grilled, braised, poached
  • Be specific: "steamed jasmine rice" not "rice" | "deep-fried chicken drumstick" not "chicken"

STEP 3 — ESTIMATE portion weight (cooked weight, not raw):
  • Use visual cues: bowl depth, density, stacking, comparison to plate size
  • Common references: 1 rice bowl ≈ 180g | 1 chicken breast ≈ 120-150g | 1 egg ≈ 50g | 1 tablespoon oil ≈ 14g

STEP 4 — Return ONLY a valid JSON array, no markdown, no extra text:
[
  {
    "name": "steamed jasmine rice",
    "estimatedGrams": 180,
    "searchTerms": ["steamed jasmine rice", "cooked white rice", "rice cooked"]
  }
]

RULES for searchTerms (3 terms, ordered specific → generic → English fallback):
• Term 1: Full descriptive name with cooking method
• Term 2: Simplified generic name (for DB matching)
• Term 3: Simple English ingredient name (e.g., "white rice", "chicken", "egg")

If no food is visible, return: []`;

interface AIItem {
  name: string;
  estimatedGrams: number;
  searchTerms?: string[];
}

// ─── Gemini vision ────────────────────────────────────────────────────────────

async function callGemini(
  base64Image: string,
  mimeType: string,
): Promise<string | null> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your-gemini-api-key-here")
    return null;

  const models = ["gemini-1.5-flash", "gemini-2.0-flash"];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: VISION_PROMPT },
                  { inline_data: { mime_type: mimeType, data: base64Image } },
                ],
              },
            ],
            generationConfig: { temperature: 0.05, maxOutputTokens: 800 },
          }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          console.log(`✅ Gemini success (${model})`);
          return text;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn(
          `⚠️ Gemini ${model} failed: ${res.status} — ${err?.error?.message ?? res.statusText}`,
        );
      }
    } catch (e) {
      console.warn(`⚠️ Gemini ${model} exception:`, e);
    }
  }
  return null;
}

// ─── Groq Llama Vision fallback ───────────────────────────────────────────────

async function callGroq(
  base64Image: string,
  mimeType: string,
): Promise<string | null> {
  if (!GROQ_API_KEY || GROQ_API_KEY === "your-groq-api-key-here") return null;

  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const models = [
    "llama-3.2-11b-vision-preview",
    "meta-llama/llama-4-scout-17b-16e-instruct",
  ];

  for (const model of models) {
    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: VISION_PROMPT },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            temperature: 0.05,
            max_tokens: 800,
          }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          console.log(`✅ Groq success (${model})`);
          return text;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn(
          `⚠️ Groq ${model} failed: ${res.status} — ${JSON.stringify(err?.error ?? err)}`,
        );
      }
    } catch (e) {
      console.warn(`⚠️ Groq ${model} exception:`, e);
    }
  }
  return null;
}

// ─── Nutrition: USDA (primary) → Open Food Facts (fallback) ──────────────────

interface OFFProduct {
  nutriments?: {
    "energy-kcal_100g"?: number;
    energy_100g?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    sodium_100g?: number;
    salt_100g?: number;
  };
}

async function fetchUSDA(name: string): Promise<NutritionInfo | null> {
  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(name)}` +
      `&pageSize=5&dataType=SR%20Legacy,Foundation&api_key=DEMO_KEY`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();

    // Try each result until we find one with plausible per-100g data
    for (const food of (data.foods ?? []).slice(0, 5)) {
      const N: Record<string, number> = {};
      for (const n of food.foodNutrients ?? []) N[n.nutrientName] = n.value;
      const kcal = N["Energy"] ?? N["Energy (Atwater General Factors)"] ?? 0;
      if (kcal === 0) continue;

      // USDA SR Legacy / Foundation always stores nutrients per 100g.
      // If kcal > 800 it means the entry is oil/butter or the data is corrupt
      // (possibly a processed product stored per-serving). Reject it so we
      // don't accidentally multiply an already-scaled serving size again.
      if (kcal > 800) {
        console.warn(
          `⚠️ USDA: rejecting "${food.description}" — kcal/100g=${kcal} is implausibly high`,
        );
        continue;
      }

      console.log(`✅ USDA hit: "${food.description}" — ${kcal} kcal/100g`);
      return {
        calories: Math.round(kcal),
        protein: Math.round((N["Protein"] ?? 0) * 10) / 10,
        fat: Math.round((N["Total lipid (fat)"] ?? 0) * 10) / 10,
        carbs: Math.round((N["Carbohydrate, by difference"] ?? 0) * 10) / 10,
        fiber: Math.round((N["Fiber, total dietary"] ?? 0) * 10) / 10,
        sugar: Math.round((N["Sugars, total"] ?? 0) * 10) / 10,
        sodium: Math.round(N["Sodium, Na"] ?? 0),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchOFF(name: string): Promise<NutritionInfo | null> {
  try {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}` +
      `&search_simple=1&action=process&json=1&page_size=5&fields=nutriments`;
    const res = await fetch(url, {
      headers: { "User-Agent": "NutriVision/1.0 (educational project)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p: OFFProduct | undefined = (data.products ?? []).find(
      (x: OFFProduct) =>
        x.nutriments &&
        ((x.nutriments["energy-kcal_100g"] ?? 0) > 0 ||
          (x.nutriments["energy_100g"] ?? 0) > 0),
    );
    if (!p?.nutriments) return null;
    const n = p.nutriments;
    return {
      calories:
        n["energy-kcal_100g"] ?? Math.round((n["energy_100g"] ?? 0) / 4.184),
      protein: n.proteins_100g ?? 0,
      fat: n.fat_100g ?? 0,
      carbs: n.carbohydrates_100g ?? 0,
      fiber: n.fiber_100g ?? 0,
      sugar: n.sugars_100g ?? 0,
      sodium:
        n.sodium_100g != null
          ? n.sodium_100g * 1000
          : ((n.salt_100g ?? 0) / 2.5) * 1000,
    };
  } catch {
    return null;
  }
}

// ─── Thai / Asian food category fallback ─────────────────────────────────────
// Precision estimates per 100g based on verified nutritional databases

function estimateByCategory(name: string): NutritionInfo {
  const l = name.toLowerCase();

  // Thai dishes
  if (/pad thai|ผัดไทย/.test(l))
    return {
      calories: 181,
      protein: 9,
      fat: 7,
      carbs: 24,
      fiber: 1,
      sugar: 3,
      sodium: 450,
    };
  if (/green curry|แกงเขียวหวาน/.test(l))
    return {
      calories: 95,
      protein: 7,
      fat: 6,
      carbs: 4,
      fiber: 1,
      sugar: 2,
      sodium: 380,
    };
  if (/red curry|แกงแดง/.test(l))
    return {
      calories: 100,
      protein: 7,
      fat: 7,
      carbs: 4,
      fiber: 1,
      sugar: 2,
      sodium: 400,
    };
  if (/tom yum|ต้มยำ/.test(l))
    return {
      calories: 35,
      protein: 4,
      fat: 1,
      carbs: 3,
      fiber: 0.5,
      sugar: 1,
      sodium: 600,
    };
  if (/som tam|ส้มตำ/.test(l))
    return {
      calories: 45,
      protein: 2,
      fat: 1,
      carbs: 8,
      fiber: 2,
      sugar: 4,
      sodium: 300,
    };
  if (/basil.*stir|กระเพรา/.test(l))
    return {
      calories: 140,
      protein: 12,
      fat: 8,
      carbs: 6,
      fiber: 1,
      sugar: 1,
      sodium: 500,
    };
  if (/mango.*sticky.*rice|ข้าวเหนียวมะม่วง/.test(l))
    return {
      calories: 180,
      protein: 3,
      fat: 5,
      carbs: 33,
      fiber: 1,
      sugar: 15,
      sodium: 30,
    };

  // Rice varieties
  if (/jasmine rice|cooked.*white.*rice|steamed.*rice/.test(l))
    return {
      calories: 130,
      protein: 2.7,
      fat: 0.3,
      carbs: 28,
      fiber: 0.4,
      sugar: 0,
      sodium: 1,
    };
  if (/brown rice|cooked.*brown rice/.test(l))
    return {
      calories: 123,
      protein: 2.7,
      fat: 0.9,
      carbs: 26,
      fiber: 1.8,
      sugar: 0,
      sodium: 1,
    };
  if (/sticky rice|glutinous rice|ข้าวเหนียว/.test(l))
    return {
      calories: 97,
      protein: 2,
      fat: 0.2,
      carbs: 21,
      fiber: 0.5,
      sugar: 0,
      sodium: 5,
    };
  if (/rice/.test(l))
    return {
      calories: 130,
      protein: 2.7,
      fat: 0.3,
      carbs: 28,
      fiber: 0.4,
      sugar: 0,
      sodium: 1,
    };

  // Noodles
  if (/ramen|udon|soba|rice noodle|glass noodle|วุ้นเส้น/.test(l))
    return {
      calories: 120,
      protein: 3,
      fat: 0.5,
      carbs: 25,
      fiber: 1,
      sugar: 0,
      sodium: 10,
    };
  if (/pasta|spaghetti|noodle/.test(l))
    return {
      calories: 158,
      protein: 6,
      fat: 1,
      carbs: 31,
      fiber: 2,
      sugar: 0.5,
      sodium: 1,
    };

  // Proteins — Fish & Seafood
  if (/salmon/.test(l))
    return {
      calories: 208,
      protein: 20,
      fat: 13,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 59,
    };
  if (/tuna/.test(l))
    return {
      calories: 144,
      protein: 30,
      fat: 2,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 47,
    };
  if (/mackerel|ปลาทู/.test(l))
    return {
      calories: 205,
      protein: 19,
      fat: 13,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 90,
    };
  if (/tilapia|ปลานิล/.test(l))
    return {
      calories: 128,
      protein: 26,
      fat: 2.7,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 52,
    };
  if (/sea bass|กะพง/.test(l))
    return {
      calories: 124,
      protein: 24,
      fat: 2.5,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 68,
    };
  if (/catfish|ปลาดุก/.test(l))
    return {
      calories: 119,
      protein: 18,
      fat: 4.5,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 50,
    };
  if (/cod|haddock|pollock/.test(l))
    return {
      calories: 82,
      protein: 18,
      fat: 0.7,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 54,
    };
  if (/squid|calamari|ปลาหมึก/.test(l))
    return {
      calories: 92,
      protein: 16,
      fat: 1.4,
      carbs: 3,
      fiber: 0,
      sugar: 0,
      sodium: 44,
    };
  if (/crab|ปู/.test(l))
    return {
      calories: 97,
      protein: 19,
      fat: 1.5,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 293,
    };
  if (/fish|ปลา/.test(l))
    return {
      calories: 120,
      protein: 22,
      fat: 3,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 60,
    };
  if (/shrimp|prawn|กุ้ง/.test(l))
    return {
      calories: 99,
      protein: 24,
      fat: 0.3,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 111,
    };

  // Proteins — Meat
  if (/pork belly|สามชั้น/.test(l))
    return {
      calories: 518,
      protein: 9,
      fat: 53,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 42,
    };
  if (/chicken breast/.test(l))
    return {
      calories: 165,
      protein: 31,
      fat: 3.6,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 74,
    };
  if (/chicken thigh|chicken leg/.test(l))
    return {
      calories: 209,
      protein: 26,
      fat: 11,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 84,
    };
  if (/chicken|ไก่/.test(l))
    return {
      calories: 180,
      protein: 27,
      fat: 8,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 77,
    };
  // Ground beef / burger patty: ~80/20 lean-to-fat, grilled ≈ 254 kcal/100g
  if (/ground beef|burger patty|beef patty|minced beef/.test(l))
    return {
      calories: 254,
      protein: 26,
      fat: 17,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 75,
    };
  if (/beef|steak|เนื้อวัว/.test(l))
    return {
      calories: 250,
      protein: 26,
      fat: 15,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 72,
    };
  if (/pork|หมู/.test(l))
    return {
      calories: 242,
      protein: 27,
      fat: 14,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 62,
    };
  if (/egg|ไข่/.test(l))
    return {
      calories: 155,
      protein: 13,
      fat: 11,
      carbs: 1.1,
      fiber: 0,
      sugar: 1.1,
      sodium: 124,
    };
  if (/tofu|เต้าหู้/.test(l))
    return {
      calories: 76,
      protein: 8,
      fat: 4.5,
      carbs: 2,
      fiber: 0.3,
      sugar: 0.5,
      sodium: 7,
    };

  // Vegetables
  if (/broccoli/.test(l))
    return {
      calories: 35,
      protein: 2.4,
      fat: 0.4,
      carbs: 7,
      fiber: 2.6,
      sugar: 1.7,
      sodium: 33,
    };
  if (/spinach|kale|ผักบุ้ง/.test(l))
    return {
      calories: 23,
      protein: 2.9,
      fat: 0.4,
      carbs: 3.6,
      fiber: 2.2,
      sugar: 0.4,
      sodium: 79,
    };
  if (/carrot/.test(l))
    return {
      calories: 41,
      protein: 0.9,
      fat: 0.2,
      carbs: 10,
      fiber: 2.8,
      sugar: 4.7,
      sodium: 69,
    };
  if (/tomato/.test(l))
    return {
      calories: 18,
      protein: 0.9,
      fat: 0.2,
      carbs: 3.9,
      fiber: 1.2,
      sugar: 2.6,
      sodium: 5,
    };
  if (/cucumber/.test(l))
    return {
      calories: 15,
      protein: 0.6,
      fat: 0.1,
      carbs: 3.6,
      fiber: 0.5,
      sugar: 1.7,
      sodium: 2,
    };
  if (/vegetable|veggie|ผัก/.test(l))
    return {
      calories: 30,
      protein: 2,
      fat: 0.3,
      carbs: 6,
      fiber: 2,
      sugar: 2,
      sodium: 20,
    };

  // Fruits
  if (/mango|มะม่วง/.test(l))
    return {
      calories: 60,
      protein: 0.8,
      fat: 0.4,
      carbs: 15,
      fiber: 1.6,
      sugar: 14,
      sodium: 1,
    };
  if (/banana|กล้วย/.test(l))
    return {
      calories: 89,
      protein: 1.1,
      fat: 0.3,
      carbs: 23,
      fiber: 2.6,
      sugar: 12,
      sodium: 1,
    };
  if (/fruit|ผลไม้/.test(l))
    return {
      calories: 60,
      protein: 0.5,
      fat: 0.2,
      carbs: 15,
      fiber: 2,
      sugar: 12,
      sodium: 1,
    };

  // Oils, sauces, condiments
  if (/oil|น้ำมัน/.test(l))
    return {
      calories: 884,
      protein: 0,
      fat: 100,
      carbs: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    };
  if (/butter/.test(l))
    return {
      calories: 717,
      protein: 0.9,
      fat: 81,
      carbs: 0.1,
      fiber: 0,
      sugar: 0.1,
      sodium: 11,
    };
  if (/sauce|dressing|น้ำจิ้ม/.test(l))
    return {
      calories: 80,
      protein: 1,
      fat: 4,
      carbs: 10,
      fiber: 0,
      sugar: 6,
      sodium: 500,
    };

  // Bread, pastry
  if (/bread|toast/.test(l))
    return {
      calories: 265,
      protein: 9,
      fat: 3.2,
      carbs: 49,
      fiber: 2.7,
      sugar: 5,
      sodium: 491,
    };

  // Default
  return {
    calories: 120,
    protein: 6,
    fat: 4,
    carbs: 16,
    fiber: 1,
    sugar: 2,
    sodium: 80,
  };
}

function scale(per100g: NutritionInfo, grams: number): NutritionInfo {
  const s = grams / 100;
  return {
    calories: Math.round(per100g.calories * s),
    protein: Math.round(per100g.protein * s * 10) / 10,
    fat: Math.round(per100g.fat * s * 10) / 10,
    carbs: Math.round(per100g.carbs * s * 10) / 10,
    fiber: Math.round(per100g.fiber * s * 10) / 10,
    sugar: Math.round(per100g.sugar * s * 10) / 10,
    sodium: Math.round(per100g.sodium * s),
  };
}

// ─── Sanity cap: max realistic kcal per single food item ─────────────────────
// A 500g steak (very large) with 250 kcal/100g = 1250 kcal.
// Anything above 1500 is almost certainly a data error.
const MAX_ITEM_KCAL = 1500;

// ─── Multi-term resolver: USDA (primary) → OFF → category estimate ────────────
// Tries each searchTerm against USDA first, then OFF, before giving up.

async function resolveNutrition(
  name: string,
  grams: number,
  searchTerms: string[] = [],
): Promise<NutritionInfo> {
  const terms = Array.from(new Set([name, ...searchTerms])).slice(0, 4);

  // USDA first — more accurate for whole/fresh foods
  for (const term of terms) {
    const result = await fetchUSDA(term);
    if (result) {
      const scaled = scale(result, grams);
      if (scaled.calories <= MAX_ITEM_KCAL) return scaled;
      console.warn(
        `⚠️ USDA result for "${term}" scaled to ${scaled.calories} kcal — skipping as implausible`,
      );
    }
  }

  // Open Food Facts fallback
  for (const term of terms) {
    const result = await fetchOFF(term);
    if (result) {
      const scaled = scale(result, grams);
      if (scaled.calories <= MAX_ITEM_KCAL) return scaled;
      console.warn(
        `⚠️ OFF result for "${term}" scaled to ${scaled.calories} kcal — skipping as implausible`,
      );
    }
  }

  console.warn(`⚠️ No DB match for "${name}", using category estimate`);
  const categoryResult = scale(estimateByCategory(name), grams);
  // Apply a hard cap as a last resort safety net
  if (categoryResult.calories > MAX_ITEM_KCAL) {
    console.warn(
      `⚠️ Category estimate for "${name}" also exceeds cap (${categoryResult.calories}), capping at ${MAX_ITEM_KCAL}`,
    );
    const ratio = MAX_ITEM_KCAL / categoryResult.calories;
    return {
      calories: MAX_ITEM_KCAL,
      protein: Math.round(categoryResult.protein * ratio * 10) / 10,
      fat: Math.round(categoryResult.fat * ratio * 10) / 10,
      carbs: Math.round(categoryResult.carbs * ratio * 10) / 10,
      fiber: Math.round(categoryResult.fiber * ratio * 10) / 10,
      sugar: Math.round(categoryResult.sugar * ratio * 10) / 10,
      sodium: Math.round(categoryResult.sodium * ratio),
    };
  }
  return categoryResult;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const hasGemini =
    !!GEMINI_API_KEY && GEMINI_API_KEY !== "your-gemini-api-key-here";
  const hasGroq = !!GROQ_API_KEY && GROQ_API_KEY !== "your-groq-api-key-here";

  if (!hasGemini && !hasGroq) {
    return Response.json(
      {
        error:
          "No vision API key configured. Set GEMINI_API_KEY or GROQ_API_KEY in .env.local",
      },
      { status: 500 },
    );
  }

  try {
    // ── Parse image ──────────────────────────────────────────────────────────
    let base64Image: string;
    let mimeType = "image/jpeg";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("image") as File | null;
      if (!file)
        return Response.json(
          { error: "No image file provided." },
          { status: 400 },
        );
      if (!file.type.startsWith("image/"))
        return Response.json(
          { error: "Invalid file type. Upload JPEG, PNG, or WebP." },
          { status: 400 },
        );
      if (file.size > MAX_FILE_SIZE)
        return Response.json(
          { error: "File too large. Max 4MB." },
          { status: 400 },
        );
      mimeType = file.type;
      base64Image = Buffer.from(await file.arrayBuffer()).toString("base64");
    } else {
      const body = await request.json();
      if (!body.image)
        return Response.json(
          { error: "No image data provided." },
          { status: 400 },
        );
      base64Image = body.image;
      mimeType = body.mimeType || "image/jpeg";
    }

    // ── Call vision AI: Gemini first, Groq as fallback ───────────────────────
    let rawText: string | null = null;

    if (hasGemini) rawText = await callGemini(base64Image, mimeType);
    if (!rawText && hasGroq) {
      console.log("Gemini unavailable → trying Groq...");
      rawText = await callGroq(base64Image, mimeType);
    }

    if (!rawText) {
      return Response.json(
        {
          error:
            "Vision API unavailable. Both Gemini and Groq failed. Check your API keys.",
        },
        { status: 502 },
      );
    }

    // ── Parse AI JSON response ───────────────────────────────────────────────
    let aiItems: AIItem[];
    try {
      const jsonStr = rawText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      aiItems = JSON.parse(jsonStr);
      if (!Array.isArray(aiItems)) throw new Error("Not an array");
      aiItems = aiItems.filter(
        (x) =>
          typeof x.name === "string" &&
          typeof x.estimatedGrams === "number" &&
          x.estimatedGrams > 0,
      );
    } catch {
      console.error("Parse error. Raw AI output:", rawText);
      return Response.json(
        { error: "Could not parse AI response. Try a clearer food image." },
        { status: 422 },
      );
    }

    if (aiItems.length === 0) return Response.json({ ingredients: [] });

    // ── Fetch nutrition with multi-term resolver ──────────────────────────────
    console.log(
      "Identified items:",
      aiItems.map((x) => `${x.name} (${x.estimatedGrams}g)`).join(", "),
    );

    const ingredients: Ingredient[] = await Promise.all(
      aiItems.map(async (item) => ({
        id: generateId(),
        name: item.name.trim(),
        grams: Math.round(item.estimatedGrams),
        nutrition: await resolveNutrition(
          item.name.trim(),
          Math.round(item.estimatedGrams),
          item.searchTerms ?? [],
        ),
      })),
    );

    return Response.json({ ingredients });
  } catch (error) {
    console.error("Analyze image error:", error);
    return Response.json(
      { error: "Internal server error while analyzing image." },
      { status: 500 },
    );
  }
}
