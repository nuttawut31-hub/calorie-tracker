// ============================================================================
// POST /api/nutrition
// Fetches nutrition data using FREE APIs — no API key required!
//
// Strategy:
//   1. Open Food Facts (completely free, no key needed — openfoodfacts.org)
//   2. USDA FoodData Central (free, no key needed — api.nal.usda.gov)
//   3. Category-based estimate (last resort)
// ============================================================================

import { NextRequest } from 'next/server';
import type { Ingredient, NutritionInfo } from '@/lib/types';
import { generateId } from '@/lib/utils';

interface IncomingIngredient {
  name: string;
  grams: number;
}

interface OpenFoodFactsProduct {
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

// ─── Open Food Facts ──────────────────────────────────────────────────────────

/**
 * Fetch nutrition per 100 g from Open Food Facts (completely free, no key).
 * Returns null if no match found.
 */
async function fetchFromOpenFoodFacts(name: string): Promise<NutritionInfo | null> {
  try {
    const encoded = encodeURIComponent(name);
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}` +
      `&search_simple=1&action=process&json=1&page_size=5&fields=nutriments,product_name`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'NutriVision/1.0 (educational project)' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const products: OpenFoodFactsProduct[] = data.products ?? [];

    // Find first product with meaningful calorie data
    const product = products.find(
      (p) =>
        p.nutriments &&
        ((p.nutriments['energy-kcal_100g'] ?? 0) > 0 ||
          (p.nutriments['energy_100g'] ?? 0) > 0)
    );

    if (!product?.nutriments) return null;

    const n = product.nutriments;
    const kcalPer100g =
      n['energy-kcal_100g'] ??
      Math.round((n['energy_100g'] ?? 0) / 4.184); // kJ → kcal

    return {
      calories: kcalPer100g,
      protein:  n.proteins_100g       ?? 0,
      fat:      n.fat_100g            ?? 0,
      carbs:    n.carbohydrates_100g  ?? 0,
      fiber:    n.fiber_100g          ?? 0,
      sugar:    n.sugars_100g         ?? 0,
      // Open Food Facts stores sodium as salt (g/100g) → sodium = salt / 2.5 * 1000 (mg)
      sodium:
        n.sodium_100g != null
          ? n.sodium_100g * 1000
          : (n.salt_100g ?? 0) / 2.5 * 1000,
    };
  } catch {
    return null;
  }
}

// ─── USDA FoodData Central ────────────────────────────────────────────────────

/**
 * Fetch nutrition per 100 g from USDA FoodData Central (free, no key needed).
 * Returns null if no match found.
 */
async function fetchFromUSDA(name: string): Promise<NutritionInfo | null> {
  try {
    const encoded = encodeURIComponent(name);
    const url =
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encoded}` +
      `&pageSize=5&dataType=SR%20Legacy,Foundation&api_key=DEMO_KEY`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const foods = data.foods ?? [];
    if (foods.length === 0) return null;

    const food = foods[0];
    const nutrients: Record<string, number> = {};

    for (const n of food.foodNutrients ?? []) {
      nutrients[n.nutrientName] = n.value;
    }

    const kcal =
      nutrients['Energy'] ??
      nutrients['Energy (Atwater General Factors)'] ??
      0;

    if (kcal === 0) return null;

    return {
      calories: Math.round(kcal),
      protein:  Math.round((nutrients['Protein']                    ?? 0) * 10) / 10,
      fat:      Math.round((nutrients['Total lipid (fat)']          ?? 0) * 10) / 10,
      carbs:    Math.round((nutrients['Carbohydrate, by difference'] ?? 0) * 10) / 10,
      fiber:    Math.round((nutrients['Fiber, total dietary']        ?? 0) * 10) / 10,
      sugar:    Math.round((nutrients['Sugars, total']              ?? 0) * 10) / 10,
      sodium:   Math.round(nutrients['Sodium, Na']                  ?? 0),
    };
  } catch {
    return null;
  }
}

// ─── Category estimate (last resort) ─────────────────────────────────────────

function estimateByCategory(name: string): NutritionInfo {
  const lower = name.toLowerCase();
  if (/chicken|beef|pork|fish|salmon|tuna|shrimp|egg|meat/.test(lower))
    return { calories: 165, protein: 25, fat: 7,   carbs: 0,  fiber: 0, sugar: 0,  sodium: 70  };
  if (/rice|pasta|noodle|bread|potato|wheat/.test(lower))
    return { calories: 130, protein: 3,  fat: 0.5,  carbs: 28, fiber: 1, sugar: 0,  sodium: 5   };
  if (/vegetable|carrot|broccoli|spinach|lettuce|tomato|cucumber/.test(lower))
    return { calories: 25,  protein: 2,  fat: 0.3,  carbs: 5,  fiber: 2, sugar: 2,  sodium: 20  };
  if (/fruit|apple|banana|orange|mango|berry/.test(lower))
    return { calories: 60,  protein: 0.5, fat: 0.2, carbs: 15, fiber: 2, sugar: 12, sodium: 1   };
  if (/oil|butter|sauce|dressing/.test(lower))
    return { calories: 400, protein: 0,  fat: 45,   carbs: 0,  fiber: 0, sugar: 0,  sodium: 300 };
  return   { calories: 100, protein: 5,  fat: 3,    carbs: 15, fiber: 1, sugar: 2,  sodium: 50  };
}

// ─── Scale helper ─────────────────────────────────────────────────────────────

function scaleNutrition(per100g: NutritionInfo, grams: number): NutritionInfo {
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

// ─── Resolver: Open Food Facts → USDA → estimate ─────────────────────────────

async function fetchNutritionForIngredient(
  name: string,
  grams: number
): Promise<NutritionInfo> {
  const offResult = await fetchFromOpenFoodFacts(name);
  if (offResult) return scaleNutrition(offResult, grams);

  const usdaResult = await fetchFromUSDA(name);
  if (usdaResult) return scaleNutrition(usdaResult, grams);

  return scaleNutrition(estimateByCategory(name), grams);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ingredients } = body as { ingredients?: IncomingIngredient[] };

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return Response.json(
        { error: 'Please provide a non-empty ingredients array.' },
        { status: 400 }
      );
    }

    for (const ing of ingredients) {
      if (!ing.name || typeof ing.name !== 'string') {
        return Response.json(
          { error: `Invalid ingredient name: ${JSON.stringify(ing.name)}` },
          { status: 400 }
        );
      }
      if (!ing.grams || typeof ing.grams !== 'number' || ing.grams <= 0) {
        return Response.json(
          { error: `Invalid grams for "${ing.name}": must be a positive number.` },
          { status: 400 }
        );
      }
    }

    const results: Ingredient[] = await Promise.all(
      ingredients.map(async (ing) => {
        const nutrition = await fetchNutritionForIngredient(ing.name, ing.grams);
        return {
          id: generateId(),
          name: ing.name,
          grams: ing.grams,
          nutrition,
        } satisfies Ingredient;
      })
    );

    return Response.json({ ingredients: results });
  } catch (error) {
    console.error('Nutrition API error:', error);
    return Response.json(
      { error: 'Internal server error while fetching nutrition data.' },
      { status: 500 }
    );
  }
}
