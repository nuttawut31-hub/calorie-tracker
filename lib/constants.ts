// ============================================================================
// Clinical-Grade Calorie & Macro Tracker — Constants
// ============================================================================

import type { ActivityLevel, Goal } from './types';

// ---------------------------------------------------------------------------
// Activity Level Multipliers (Harris-Benedict convention)
// Applied to BMR to calculate TDEE
// ---------------------------------------------------------------------------

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,     // Desk job, little or no exercise
  light: 1.375,       // Light exercise 1-3 days/week
  moderate: 1.55,     // Moderate exercise 3-5 days/week
  active: 1.725,      // Hard exercise 6-7 days/week
  veryActive: 1.9,    // Very hard exercise, physical job, 2x training
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Lightly Active (1-3 days/week)',
  moderate: 'Moderately Active (3-5 days/week)',
  active: 'Very Active (6-7 days/week)',
  veryActive: 'Extremely Active (physical job + training)',
};

// ---------------------------------------------------------------------------
// Macro Split Percentages by Goal
// Based on clinical nutrition guidelines
// ---------------------------------------------------------------------------

export interface MacroSplit {
  protein: number; // percentage
  carbs: number;
  fat: number;
}

export const MACRO_SPLITS: Record<Goal, MacroSplit> = {
  loss: {
    protein: 40,  // High protein to preserve muscle during deficit
    carbs: 35,
    fat: 25,
  },
  maintenance: {
    protein: 30,
    carbs: 50,   // Standard balanced diet
    fat: 20,
  },
  gain: {
    protein: 30,
    carbs: 50,   // Surplus calories primarily from carbs
    fat: 20,
  },
};

export const GOAL_LABELS: Record<Goal, string> = {
  loss: 'Weight Loss',
  maintenance: 'Maintenance',
  gain: 'Weight Gain',
};

// ---------------------------------------------------------------------------
// Caloric Adjustment by Goal (kcal from TDEE)
// ---------------------------------------------------------------------------

export const CALORIE_ADJUSTMENTS: Record<Goal, number> = {
  loss: -500,        // ~0.45 kg/week loss
  maintenance: 0,
  gain: 400,         // Lean bulk surplus
};

// ---------------------------------------------------------------------------
// Safety Thresholds (Clinical Standard)
// ---------------------------------------------------------------------------

/** Absolute minimum calorie intake — WHO & most clinical guidelines */
export const MIN_SAFE_CALORIES = 1200;

// ---------------------------------------------------------------------------
// Nutrient Metadata (for display in UI)
// ---------------------------------------------------------------------------

export interface NutrientMeta {
  key: string;
  label: string;
  unit: string;
  color: string;          // Tailwind-compatible color class stem
  colorHex: string;       // For charts/custom styling
}

export const TRACKED_NUTRIENTS: NutrientMeta[] = [
  { key: 'calories', label: 'Calories',  unit: 'kcal', color: 'violet',  colorHex: '#8b5cf6' },
  { key: 'protein',  label: 'Protein',   unit: 'g',    color: 'cyan',    colorHex: '#06b6d4' },
  { key: 'fat',      label: 'Fat',       unit: 'g',    color: 'rose',    colorHex: '#f43f5e' },
  { key: 'carbs',    label: 'Carbs',     unit: 'g',    color: 'amber',   colorHex: '#f59e0b' },
  { key: 'fiber',    label: 'Fiber',     unit: 'g',    color: 'emerald', colorHex: '#10b981' },
  { key: 'sugar',    label: 'Sugar',     unit: 'g',    color: 'pink',    colorHex: '#ec4899' },
  { key: 'sodium',   label: 'Sodium',    unit: 'mg',   color: 'slate',   colorHex: '#64748b' },
];

// ---------------------------------------------------------------------------
// Portion Multiplier Presets
// ---------------------------------------------------------------------------

export const PORTION_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;

// ---------------------------------------------------------------------------
// Calories per gram of macronutrient (Atwater system)
// ---------------------------------------------------------------------------

export const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;
