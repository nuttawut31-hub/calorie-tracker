// ============================================================================
// Clinical-Grade Calorie & Macro Tracker — Zustand Stores
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DailyLog,
  Ingredient,
  Meal,
  TDEEStoreState,
  TrackerStoreState,
  UserProfile,
} from './types';
import {
  computeFullTDEE,
  emptyNutrition,
  getTodayKey,
  sumNutrition,
} from './utils';

// ---------------------------------------------------------------------------
// TDEE Store
// ---------------------------------------------------------------------------
// Manages user profile and TDEE calculation results.
// Persisted to localStorage so the user doesn't re-enter body metrics.
// ---------------------------------------------------------------------------

export const useTDEEStore = create<TDEEStoreState>()(
  persist(
    (set) => ({
      userProfile: null,
      tdeeResult: null,

      setProfile: (profile: UserProfile) => {
        const tdeeResult = computeFullTDEE(profile);
        set({ userProfile: profile, tdeeResult });
      },

      clearProfile: () => {
        set({ userProfile: null, tdeeResult: null });
      },
    }),
    {
      name: 'calorie-tracker-tdee', // localStorage key
    }
  )
);

// ---------------------------------------------------------------------------
// Tracker Store (non-persisted for staging, persisted for logs)
// ---------------------------------------------------------------------------
// Split into two: a simple store for transient staging state
// and a persisted store for daily logs.
// ---------------------------------------------------------------------------

// ---- Persisted store: daily meal logs only ----
interface DailyLogStoreState {
  dailyLogs: Record<string, DailyLog>;
  addMeal: (meal: Meal) => void;
  removeMeal: (date: string, mealId: string) => void;
}

export const useDailyLogStore = create<DailyLogStoreState>()(
  persist(
    (set) => ({
      dailyLogs: {},

      addMeal: (meal: Meal) => {
        set((state) => {
          const dateKey = getTodayKey();
          const existingLog = state.dailyLogs[dateKey];

          const meals = existingLog
            ? [...existingLog.meals, meal]
            : [meal];

          const totalNutrition = meals.reduce(
            (acc, m) => ({
              calories: acc.calories + m.totalNutrition.calories,
              protein: acc.protein + m.totalNutrition.protein,
              fat: acc.fat + m.totalNutrition.fat,
              carbs: acc.carbs + m.totalNutrition.carbs,
              fiber: acc.fiber + m.totalNutrition.fiber,
              sugar: acc.sugar + m.totalNutrition.sugar,
              sodium: acc.sodium + m.totalNutrition.sodium,
            }),
            emptyNutrition()
          );

          return {
            dailyLogs: {
              ...state.dailyLogs,
              [dateKey]: { date: dateKey, meals, totalNutrition },
            },
          };
        });
      },

      removeMeal: (date: string, mealId: string) => {
        set((state) => {
          const log = state.dailyLogs[date];
          if (!log) return state;

          const meals = log.meals.filter((m) => m.id !== mealId);
          const totalNutrition = meals.reduce(
            (acc, m) => ({
              calories: acc.calories + m.totalNutrition.calories,
              protein: acc.protein + m.totalNutrition.protein,
              fat: acc.fat + m.totalNutrition.fat,
              carbs: acc.carbs + m.totalNutrition.carbs,
              fiber: acc.fiber + m.totalNutrition.fiber,
              sugar: acc.sugar + m.totalNutrition.sugar,
              sodium: acc.sodium + m.totalNutrition.sodium,
            }),
            emptyNutrition()
          );

          return {
            dailyLogs: {
              ...state.dailyLogs,
              [date]: { date, meals, totalNutrition },
            },
          };
        });
      },
    }),
    {
      name: 'calorie-tracker-data',
    }
  )
);

// ---- Non-persisted store: ingredient staging area ----
export const useTrackerStore = create<TrackerStoreState>()((set, get) => ({
  dailyLogs: {},
  currentIngredients: [],
  portionMultiplier: 1,

  setIngredients: (ingredients: Ingredient[]) => {
    set({ currentIngredients: ingredients });
  },

  addIngredient: (ingredient: Ingredient) => {
    set((state) => ({
      currentIngredients: [...state.currentIngredients, ingredient],
    }));
  },

  updateIngredient: (index: number, updates: Partial<Ingredient>) => {
    set((state) => {
      const updated = [...state.currentIngredients];
      if (index >= 0 && index < updated.length) {
        updated[index] = { ...updated[index], ...updates };
      }
      return { currentIngredients: updated };
    });
  },

  removeIngredient: (index: number) => {
    set((state) => ({
      currentIngredients: state.currentIngredients.filter(
        (_, i) => i !== index
      ),
    }));
  },

  setPortionMultiplier: (multiplier: number) => {
    set({ portionMultiplier: multiplier });
  },

  addMeal: (meal: Meal) => {
    // Delegate to persisted daily log store
    useDailyLogStore.getState().addMeal(meal);
    // Clear staging area
    set({ currentIngredients: [], portionMultiplier: 1 });
  },

  removeMeal: (date: string, mealId: string) => {
    useDailyLogStore.getState().removeMeal(date, mealId);
  },

  getTodayLog: () => {
    return useDailyLogStore.getState().dailyLogs[getTodayKey()];
  },

  getLogByDate: (date: string) => {
    return useDailyLogStore.getState().dailyLogs[date];
  },
}));

// ---------------------------------------------------------------------------
// Helper: Create a meal from current staged ingredients
// ---------------------------------------------------------------------------

export function createMealFromStaging(
  name: string,
  ingredients: Ingredient[],
  portionMultiplier: number
): Meal {
  const totalNutrition = sumNutrition(ingredients, portionMultiplier);

  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name,
    ingredients,
    totalNutrition,
    portionMultiplier,
    timestamp: Date.now(),
  };
}
