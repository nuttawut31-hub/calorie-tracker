// ============================================================================
// POST /api/analyze-image
// Step 1: Vision AI identifies food items with cooking state + grams (low tokens)
// Step 2: Open Food Facts / USDA fetches real nutrition data (free, no key)
//
// Vision provider priority:
//   1. Google Gemini 1.5 Flash (free, 1,500 req/day)
//      → Get key: https://aistudio.google.com/app/apikey
//   2. Groq Llama 3.2 Vision (free fallback, 1,000 req/day)
//      → Get key: https://console.groq.com/keys
// ============================================================================

import { NextRequest } from 'next/server';
import { generateId } from '@/lib/utils';
import type { Ingredient, NutritionInfo } from '@/lib/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY   = process.env.GROQ_API_KEY;
const MAX_FILE_SIZE  = 4 * 1024 * 1024; // 4 MB

// Prompt enforces cooking state so nutrition DB returns cooked values.
// "cooked white rice" (130 kcal/100g) vs raw "white rice" (360 kcal/100g)
const VISION_PROMPT = `You are a clinical nutrition expert specializing in food identification and portion estimation.

Analyze this food image and list every visible food item separately.

For EACH item return:
- "name": MUST include cooking method/state. Use the most specific searchable term possible.
  Rules:
  • Always prepend cooking method: "cooked", "steamed", "boiled", "grilled", "fried", "baked", "raw", "roasted"
  • Always specify preparation: "cooked white rice" NOT "rice" | "fried chicken breast" NOT "chicken"
  • Include cut/form: "sliced", "whole", "diced" where relevant
  • Good examples: "steamed jasmine rice", "pan-fried salmon fillet", "boiled broccoli", "scrambled egg", "raw cucumber"
- "estimatedGrams": weight in grams of the portion as served (cooked weight, not raw)

Return ONLY a valid JSON array. No markdown. No extra text.
Example: [{"name":"steamed jasmine rice","estimatedGrams":180},{"name":"grilled chicken breast","estimatedGrams":120}]
If no food is visible, return: []`;

interface AIItem {
  name: string;
  estimatedGrams: number;
}

// ─── Gemini vision ────────────────────────────────────────────────────────────

async function callGemini(base64Image: string, mimeType: string): Promise<string | null> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') return null;

  const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: VISION_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64Image } },
              ],
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
          }),
        }
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
        console.warn(`⚠️ Gemini ${model} failed: ${res.status} — ${err?.error?.message ?? res.statusText}`);
      }
    } catch (e) {
      console.warn(`⚠️ Gemini ${model} exception:`, e);
    }
  }
  return null;
}

// ─── Groq Llama Vision fallback ───────────────────────────────────────────────

async function callGroq(base64Image: string, mimeType: string): Promise<string | null> {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'your-groq-api-key-here') return null;

  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const models = [
    'llama-3.2-11b-vision-preview',
    'meta-llama/llama-4-scout-17b-16e-instruct',
  ];

  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text',      text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          }],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          console.log(`✅ Groq success (${model})`);
          return text;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.warn(`⚠️ Groq ${model} failed: ${res.status} — ${JSON.stringify(err?.error ?? err)}`);
      }
    } catch (e) {
      console.warn(`⚠️ Groq ${model} exception:`, e);
    }
  }
  return null;
}

// ─── Nutrition: Open Food Facts → USDA → category estimate ───────────────────

interface OFFProduct {
  nutriments?: {
    'energy-kcal_100g'?: number;
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

async function fetchOFF(name: string): Promise<NutritionInfo | null> {
  try {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}` +
      `&search_simple=1&action=process&json=1&page_size=5&fields=nutriments`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NutriVision/1.0 (educational project)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p: OFFProduct | undefined = (data.products ?? []).find(
      (x: OFFProduct) =>
        x.nutriments &&
        ((x.nutriments['energy-kcal_100g'] ?? 0) > 0 ||
          (x.nutriments['energy_100g'] ?? 0) > 0)
    );
    if (!p?.nutriments) return null;
    const n = p.nutriments;
    return {
      calories: n['energy-kcal_100g'] ?? Math.round((n['energy_100g'] ?? 0) / 4.184),
      protein:  n.proteins_100g      ?? 0,
      fat:      n.fat_100g           ?? 0,
      carbs:    n.carbohydrates_100g ?? 0,
      fiber:    n.fiber_100g         ?? 0,
      sugar:    n.sugars_100g        ?? 0,
      sodium:   n.sodium_100g != null
        ? n.sodium_100g * 1000
        : (n.salt_100g ?? 0) / 2.5 * 1000,
    };
  } catch { return null; }
}

async function fetchUSDA(name: string): Promise<NutritionInfo | null> {
  try {
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(name)}` +
      `&pageSize=5&dataType=SR%20Legacy,Foundation&api_key=DEMO_KEY`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const food = (data.foods ?? [])[0];
    if (!food) return null;
    const N: Record<string, number> = {};
    for (const n of food.foodNutrients ?? []) N[n.nutrientName] = n.value;
    const kcal = N['Energy'] ?? N['Energy (Atwater General Factors)'] ?? 0;
    if (kcal === 0) return null;
    return {
      calories: Math.round(kcal),
      protein:  Math.round((N['Protein']                     ?? 0) * 10) / 10,
      fat:      Math.round((N['Total lipid (fat)']           ?? 0) * 10) / 10,
      carbs:    Math.round((N['Carbohydrate, by difference']  ?? 0) * 10) / 10,
      fiber:    Math.round((N['Fiber, total dietary']         ?? 0) * 10) / 10,
      sugar:    Math.round((N['Sugars, total']               ?? 0) * 10) / 10,
      sodium:   Math.round(N['Sodium, Na']                   ?? 0),
    };
  } catch { return null; }
}

function estimateByCategory(name: string): NutritionInfo {
  const l = name.toLowerCase();
  if (/chicken|beef|pork|fish|salmon|tuna|shrimp|egg|meat/.test(l))
    return { calories: 165, protein: 25, fat: 7,   carbs: 0,  fiber: 0, sugar: 0,  sodium: 70  };
  if (/cooked.*rice|steamed.*rice|boiled.*rice|rice/.test(l))
    return { calories: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4, sugar: 0, sodium: 1 };
  if (/pasta|noodle|bread|potato|wheat/.test(l))
    return { calories: 130, protein: 3,  fat: 0.5,  carbs: 28, fiber: 1, sugar: 0,  sodium: 5   };
  if (/vegetable|carrot|broccoli|spinach|lettuce|tomato|cucumber/.test(l))
    return { calories: 25,  protein: 2,  fat: 0.3,  carbs: 5,  fiber: 2, sugar: 2,  sodium: 20  };
  if (/fruit|apple|banana|orange|mango|berry/.test(l))
    return { calories: 60,  protein: 0.5, fat: 0.2, carbs: 15, fiber: 2, sugar: 12, sodium: 1   };
  if (/oil|butter|sauce|dressing/.test(l))
    return { calories: 400, protein: 0,  fat: 45,   carbs: 0,  fiber: 0, sugar: 0,  sodium: 300 };
  return   { calories: 100, protein: 5,  fat: 3,    carbs: 15, fiber: 1, sugar: 2,  sodium: 50  };
}

function scale(per100g: NutritionInfo, grams: number): NutritionInfo {
  const s = grams / 100;
  return {
    calories: Math.round(per100g.calories * s),
    protein:  Math.round(per100g.protein  * s * 10) / 10,
    fat:      Math.round(per100g.fat      * s * 10) / 10,
    carbs:    Math.round(per100g.carbs    * s * 10) / 10,
    fiber:    Math.round(per100g.fiber    * s * 10) / 10,
    sugar:    Math.round(per100g.sugar    * s * 10) / 10,
    sodium:   Math.round(per100g.sodium   * s),
  };
}

async function resolveNutrition(name: string, grams: number): Promise<NutritionInfo> {
  const [off, usda] = await Promise.allSettled([fetchOFF(name), fetchUSDA(name)]);
  if (off.status === 'fulfilled' && off.value) return scale(off.value, grams);
  if (usda.status === 'fulfilled' && usda.value) return scale(usda.value, grams);
  console.warn(`⚠️ No DB match for "${name}", using category estimate`);
  return scale(estimateByCategory(name), grams);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const hasGemini = !!GEMINI_API_KEY && GEMINI_API_KEY !== 'your-gemini-api-key-here';
  const hasGroq   = !!GROQ_API_KEY   && GROQ_API_KEY   !== 'your-groq-api-key-here';

  if (!hasGemini && !hasGroq) {
    return Response.json(
      { error: 'No vision API key configured. Set GEMINI_API_KEY (https://aistudio.google.com/app/apikey) or GROQ_API_KEY (https://console.groq.com/keys) in .env.local' },
      { status: 500 }
    );
  }

  try {
    // ── Parse image ──────────────────────────────────────────────────────────
    let base64Image: string;
    let mimeType = 'image/jpeg';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('image') as File | null;
      if (!file) return Response.json({ error: 'No image file provided.' }, { status: 400 });
      if (!file.type.startsWith('image/')) return Response.json({ error: 'Invalid file type. Upload JPEG, PNG, or WebP.' }, { status: 400 });
      if (file.size > MAX_FILE_SIZE) return Response.json({ error: 'File too large. Max 4MB.' }, { status: 400 });
      mimeType = file.type;
      base64Image = Buffer.from(await file.arrayBuffer()).toString('base64');
    } else {
      const body = await request.json();
      if (!body.image) return Response.json({ error: 'No image data provided.' }, { status: 400 });
      base64Image = body.image;
      mimeType = body.mimeType || 'image/jpeg';
    }

    // ── Call vision AI: Gemini first, Groq as fallback ───────────────────────
    let rawText: string | null = null;

    if (hasGemini) rawText = await callGemini(base64Image, mimeType);
    if (!rawText && hasGroq) {
      console.log('Gemini unavailable → trying Groq...');
      rawText = await callGroq(base64Image, mimeType);
    }

    if (!rawText) {
      return Response.json(
        { error: 'Vision API unavailable. Both Gemini and Groq failed. Check your API keys or try again later.' },
        { status: 502 }
      );
    }

    // ── Parse AI JSON response ───────────────────────────────────────────────
    let aiItems: AIItem[];
    try {
      const jsonStr = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiItems = JSON.parse(jsonStr);
      if (!Array.isArray(aiItems)) throw new Error('Not an array');
      aiItems = aiItems.filter(
        (x) => typeof x.name === 'string' && typeof x.estimatedGrams === 'number' && x.estimatedGrams > 0
      );
    } catch {
      console.error('Parse error. Raw AI output:', rawText);
      return Response.json({ error: 'Could not parse AI response. Try a clearer food image.' }, { status: 422 });
    }

    if (aiItems.length === 0) return Response.json({ ingredients: [] });

    // ── Fetch nutrition from Open Food Facts / USDA in parallel ─────────────
    console.log('Identified items:', aiItems.map(x => `${x.name} (${x.estimatedGrams}g)`).join(', '));

    const ingredients: Ingredient[] = await Promise.all(
      aiItems.map(async (item) => ({
        id: generateId(),
        name: item.name.trim(),
        grams: Math.round(item.estimatedGrams),
        nutrition: await resolveNutrition(item.name.trim(), Math.round(item.estimatedGrams)),
      }))
    );

    return Response.json({ ingredients });
  } catch (error) {
    console.error('Analyze image error:', error);
    return Response.json({ error: 'Internal server error while analyzing image.' }, { status: 500 });
  }
}
