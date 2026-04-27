// ============================================================================
// Clinical-Grade Calorie & Macro Tracker — Type Definitions
// ============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** User's biological sex for BMR calculation (Mifflin-St Jeor) */
export type Gender = 'male' | 'female';

/** Physical activity level — multiplied against BMR to get TDEE */
export type ActivityLevel =
  | 'sedentary'     // Little or no exercise
  | 'light'         // Light exercise 1-3 days/week
  | 'moderate'      // Moderate exercise 3-5 days/week
  | 'active'        // Hard exercise 6-7 days/week
  | 'veryActive';   // Very hard exercise, physical job

/** Nutritional goal — determines macro split percentages */
export type Goal = 'loss' | 'maintenance' | 'gain';

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

/** Shared nutrition shape used across ingredients, meals, and daily totals */
export interface NutritionInfo {
  calories: number;   // kcal
  protein: number;    // grams
  fat: number;        // grams
  carbs: number;      // grams
  fiber: number;      // grams — crucial for gut health
  sugar: number;      // grams
  sodium: number;     // milligrams
}

/** A single food ingredient with its nutritional breakdown */
export interface Ingredient {
  id: string;
  name: string;
  grams: number;
  nutrition: NutritionInfo;
}

// ---------------------------------------------------------------------------
// Meals & Daily Log
// ---------------------------------------------------------------------------

/** A meal is a collection of ingredients with a portion multiplier */
export interface Meal {
  id: string;
  name: string;
  ingredients: Ingredient[];
  totalNutrition: NutritionInfo;
  portionMultiplier: number;
  timestamp: number; // Unix ms
}

/** All meals consumed on a single calendar day */
export interface DailyLog {
  date: string; // YYYY-MM-DD format
  meals: Meal[];
  totalNutrition: NutritionInfo;
}

// ---------------------------------------------------------------------------
// TDEE & User Profile
// ---------------------------------------------------------------------------

/** User body metrics and lifestyle inputs for TDEE calculation */
export interface UserProfile {
  gender: Gender;
  age: number;          // years
  weightKg: number;     // kilograms
  heightCm: number;     // centimeters
  activityLevel: ActivityLevel;
  goal: Goal;
}

/** Macro target in both grams and percentage */
export interface MacroTarget {
  grams: number;
  percentage: number;
}

/** Complete TDEE calculation result */
export interface TDEEResult {
  bmr: number;              // Basal Metabolic Rate (kcal/day)
  tdee: number;             // Total Daily Energy Expenditure (kcal/day)
  targetCalories: number;   // Adjusted for goal (kcal/day)
  macros: {
    protein: MacroTarget;
    carbs: MacroTarget;
    fat: MacroTarget;
  };
}

// ---------------------------------------------------------------------------
// API Payloads
// ---------------------------------------------------------------------------

/** Response from /api/analyze-image (OpenAI Vision) */
export interface AnalyzeImageResponse {
  ingredients: {
    name: string;
    estimatedGrams: number;
  }[];
}

/** Request body for /api/nutrition (Edamam) */
export interface NutritionRequest {
  ingredients: {
    name: string;
    grams: number;
  }[];
}

/** Response from /api/nutrition */
export interface NutritionResponse {
  ingredients: Ingredient[];
}

// ---------------------------------------------------------------------------
// Store State Types
// ---------------------------------------------------------------------------

export interface TDEEStoreState {
  userProfile: UserProfile | null;
  tdeeResult: TDEEResult | null;
  setProfile: (profile: UserProfile) => void;
  clearProfile: () => void;
}

export interface TrackerStoreState {
  dailyLogs: Record<string, DailyLog>;
  currentIngredients: Ingredient[];
  portionMultiplier: number;

  // Ingredient staging actions
  setIngredients: (ingredients: Ingredient[]) => void;
  addIngredient: (ingredient: Ingredient) => void;
  updateIngredient: (index: number, ingredient: Partial<Ingredient>) => void;
  removeIngredient: (index: number) => void;

  // Portion
  setPortionMultiplier: (multiplier: number) => void;

  // Meal actions
  addMeal: (meal: Meal) => void;
  removeMeal: (date: string, mealId: string) => void;

  // Selectors
  getTodayLog: () => DailyLog | undefined;
  getLogByDate: (date: string) => DailyLog | undefined;
}
