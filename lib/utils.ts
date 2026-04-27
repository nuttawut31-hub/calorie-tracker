// ============================================================================
// Clinical-Grade Calorie & Macro Tracker — Utility Functions
// ============================================================================

import type {
  ActivityLevel,
  Goal,
  Ingredient,
  NutritionInfo,
  TDEEResult,
  UserProfile,
} from './types';
import {
  ACTIVITY_MULTIPLIERS,
  CALORIE_ADJUSTMENTS,
  CALORIES_PER_GRAM,
  MACRO_SPLITS,
  MIN_SAFE_CALORIES,
} from './constants';

// ---------------------------------------------------------------------------
// TDEE Calculation — Mifflin-St Jeor Equation
// ---------------------------------------------------------------------------

/**
 * Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
 *
 * Male:   BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) + 5
 * Female: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) - 161
 *
 * Reference: Mifflin MD, St Jeor ST, et al. (1990)
 */
export function calculateBMR(profile: UserProfile): number {
  const { gender, weightKg, heightCm, age } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

/**
 * Calculate Total Daily Energy Expenditure by multiplying BMR
 * with the appropriate activity level factor.
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * Calculate target calories adjusted for user goal.
 * Applies a caloric surplus or deficit on top of TDEE.
 */
export function calculateTargetCalories(tdee: number, goal: Goal): number {
  return Math.round(tdee + CALORIE_ADJUSTMENTS[goal]);
}

/**
 * Calculate macro targets (grams + percentage) from target calories and goal.
 *
 * Uses the Atwater system:
 *   - Protein & Carbs: 4 kcal/g
 *   - Fat: 9 kcal/g
 */
export function calculateMacros(
  targetCalories: number,
  goal: Goal
): TDEEResult['macros'] {
  const split = MACRO_SPLITS[goal];

  const proteinCals = targetCalories * (split.protein / 100);
  const carbsCals = targetCalories * (split.carbs / 100);
  const fatCals = targetCalories * (split.fat / 100);

  return {
    protein: {
      grams: Math.round(proteinCals / CALORIES_PER_GRAM.protein),
      percentage: split.protein,
    },
    carbs: {
      grams: Math.round(carbsCals / CALORIES_PER_GRAM.carbs),
      percentage: split.carbs,
    },
    fat: {
      grams: Math.round(fatCals / CALORIES_PER_GRAM.fat),
      percentage: split.fat,
    },
  };
}

/**
 * Run the full TDEE pipeline from a user profile.
 * Returns BMR, TDEE, target calories, and macro targets.
 */
export function computeFullTDEE(profile: UserProfile): TDEEResult {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const targetCalories = calculateTargetCalories(tdee, profile.goal);
  const macros = calculateMacros(targetCalories, profile.goal);

  return {
    bmr: Math.round(bmr),
    tdee,
    targetCalories,
    macros,
  };
}

// ---------------------------------------------------------------------------
// Safety Checks
// ---------------------------------------------------------------------------

/**
 * Check whether target calories are below safe limits.
 * Returns a warning message if unsafe, or null if safe.
 */
export function getSafetyWarning(
  targetCalories: number,
  bmr: number
): string | null {
  if (targetCalories < MIN_SAFE_CALORIES) {
    return `⚠️ Your target of ${targetCalories} kcal is below the minimum safe intake of ${MIN_SAFE_CALORIES} kcal/day. This can lead to nutrient deficiencies, muscle loss, and metabolic slowdown. Please consult a healthcare professional.`;
  }
  if (targetCalories < bmr) {
    return `⚠️ Your target of ${targetCalories} kcal is below your BMR of ${Math.round(bmr)} kcal. Eating below your BMR for extended periods can impair organ function and metabolism. Consider a more moderate deficit.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Nutrition Aggregation
// ---------------------------------------------------------------------------

/** Create a zero-value NutritionInfo object */
export function emptyNutrition(): NutritionInfo {
  return {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };
}

/**
 * Sum nutrition values across multiple ingredients.
 * Applies portion multiplier to each ingredient.
 */
export function sumNutrition(
  ingredients: Ingredient[],
  portionMultiplier: number = 1
): NutritionInfo {
  const total = emptyNutrition();

  for (const ing of ingredients) {
    total.calories += ing.nutrition.calories * portionMultiplier;
    total.protein += ing.nutrition.protein * portionMultiplier;
    total.fat += ing.nutrition.fat * portionMultiplier;
    total.carbs += ing.nutrition.carbs * portionMultiplier;
    total.fiber += ing.nutrition.fiber * portionMultiplier;
    total.sugar += ing.nutrition.sugar * portionMultiplier;
    total.sodium += ing.nutrition.sodium * portionMultiplier;
  }

  // Round all values for display
  total.calories = Math.round(total.calories);
  total.protein = Math.round(total.protein * 10) / 10;
  total.fat = Math.round(total.fat * 10) / 10;
  total.carbs = Math.round(total.carbs * 10) / 10;
  total.fiber = Math.round(total.fiber * 10) / 10;
  total.sugar = Math.round(total.sugar * 10) / 10;
  total.sodium = Math.round(total.sodium);

  return total;
}

/**
 * Scale a single ingredient's nutrition by a given multiplier.
 */
export function scaleNutrition(
  nutrition: NutritionInfo,
  multiplier: number
): NutritionInfo {
  return {
    calories: Math.round(nutrition.calories * multiplier),
    protein: Math.round(nutrition.protein * multiplier * 10) / 10,
    fat: Math.round(nutrition.fat * multiplier * 10) / 10,
    carbs: Math.round(nutrition.carbs * multiplier * 10) / 10,
    fiber: Math.round(nutrition.fiber * multiplier * 10) / 10,
    sugar: Math.round(nutrition.sugar * multiplier * 10) / 10,
    sodium: Math.round(nutrition.sodium * multiplier),
  };
}

// ---------------------------------------------------------------------------
// Date Helpers
// ---------------------------------------------------------------------------

/** Get today's date in YYYY-MM-DD format (local timezone) */
export function getTodayKey(): string {
  return formatDate(new Date());
}

/** Format a Date object to YYYY-MM-DD string (local timezone) */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Format a Unix timestamp to a human-readable time string */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// ID Generation
// ---------------------------------------------------------------------------

/** Generate a simple unique ID (good enough for local state) */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
