'use client';

import { useMemo, useState } from 'react';
import {
  Trash2,
  Plus,
  Save,
  UtensilsCrossed,
  SlidersHorizontal,
} from 'lucide-react';
import Card from '@/app/components/ui/Card';
import { useTrackerStore, createMealFromStaging } from '@/lib/store';
import { generateId, sumNutrition, emptyNutrition } from '@/lib/utils';
import { PORTION_PRESETS, TRACKED_NUTRIENTS } from '@/lib/constants';
import type { Ingredient, NutritionInfo } from '@/lib/types';

/**
 * Editable ingredient table with portion multiplier.
 * Shows nutrition per ingredient, total summary, and "Save as Meal" action.
 */
export default function IngredientList() {
  // Individual selectors — each causes a re-render only when its own value changes.
  // This is the correct Zustand pattern and fixes stale portionMultiplier bugs.
  const currentIngredients  = useTrackerStore((s) => s.currentIngredients);
  const portionMultiplier   = useTrackerStore((s) => s.portionMultiplier);
  const setIngredients      = useTrackerStore((s) => s.setIngredients);
  const addIngredient       = useTrackerStore((s) => s.addIngredient);
  const updateIngredient    = useTrackerStore((s) => s.updateIngredient);
  const removeIngredient    = useTrackerStore((s) => s.removeIngredient);
  const setPortionMultiplier = useTrackerStore((s) => s.setPortionMultiplier);
  const addMeal             = useTrackerStore((s) => s.addMeal);

  const [mealName, setMealName] = useState('');
  const [newIngName, setNewIngName] = useState('');
  const [newIngGrams, setNewIngGrams] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Explicit dependencies ensure this always recalculates when either
  // ingredients or portionMultiplier changes — never stale.
  const totalNutrition = useMemo(
    () => sumNutrition(currentIngredients, portionMultiplier),
    [currentIngredients, portionMultiplier]
  );

  if (currentIngredients.length === 0) {
    return (
      <Card
        id="ingredient-list"
        className="flex items-center justify-center min-h-[200px]"
      >
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/40 text-sm font-medium">
            No ingredients yet
          </p>
          <p className="text-white/25 text-xs mt-1">
            Upload a food image or add ingredients manually
          </p>
        </div>
      </Card>
    );
  }

  async function handleAddManual() {
    if (!newIngName.trim() || !newIngGrams) return;

    const grams = parseFloat(newIngGrams);
    if (isNaN(grams) || grams <= 0) return;

    setIsAdding(true);
    setAddError(null);

    try {
      // Fetch real nutrition data from /api/nutrition
      const response = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: [{ name: newIngName.trim(), grams }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'ไม่สามารถดึงข้อมูลโภชนาการได้');
      }

      const fetched: Ingredient | undefined = data.ingredients?.[0];
      const ingredient: Ingredient = {
        id: generateId(),
        name: newIngName.trim(),
        grams,
        nutrition: fetched?.nutrition ?? emptyNutrition(),
      };

      addIngredient(ingredient);
      setNewIngName('');
      setNewIngGrams('');
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลโภชนาการได้'
      );
    } finally {
      setIsAdding(false);
    }
  }

  function handleGramsChange(index: number, value: string) {
    const grams = parseFloat(value);
    if (isNaN(grams) || grams < 0) return;

    const original = currentIngredients[index];
    if (!original) return;

    // Scale nutrition proportionally to new grams
    const ratio = original.grams > 0 ? grams / original.grams : 0;
    const scaledNutrition: NutritionInfo = {
      calories: Math.round(
        (original.nutrition.calories / (original.grams || 1)) * grams
      ),
      protein:
        Math.round(
          ((original.nutrition.protein / (original.grams || 1)) * grams * 10)
        ) / 10,
      fat:
        Math.round(
          ((original.nutrition.fat / (original.grams || 1)) * grams * 10)
        ) / 10,
      carbs:
        Math.round(
          ((original.nutrition.carbs / (original.grams || 1)) * grams * 10)
        ) / 10,
      fiber:
        Math.round(
          ((original.nutrition.fiber / (original.grams || 1)) * grams * 10)
        ) / 10,
      sugar:
        Math.round(
          ((original.nutrition.sugar / (original.grams || 1)) * grams * 10)
        ) / 10,
      sodium: Math.round(
        (original.nutrition.sodium / (original.grams || 1)) * grams
      ),
    };

    updateIngredient(index, { grams, nutrition: scaledNutrition });
  }

  function handleSaveMeal() {
    const name = mealName.trim() || `Meal ${new Date().toLocaleTimeString()}`;
    const meal = createMealFromStaging(
      name,
      currentIngredients,
      portionMultiplier
    );
    addMeal(meal);
    setMealName('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  }

  return (
    <Card id="ingredient-list" hover>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="section-title">Ingredients</h2>
            <p className="section-subtitle">
              {currentIngredients.length} item
              {currentIngredients.length !== 1 ? 's' : ''} detected
            </p>
          </div>
        </div>
        <button
          onClick={() => setIngredients([])}
          className="btn-danger text-xs"
        >
          Clear All
        </button>
      </div>

      {/* Portion Multiplier */}
      <div className="mb-5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-4 h-4 text-white/50" />
          <span className="text-sm font-semibold text-white/70">
            Portion Size
          </span>
          <span className="text-sm font-bold gradient-brand-text ml-auto">
            {portionMultiplier}×
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PORTION_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setPortionMultiplier(preset)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                ${
                  portionMultiplier === preset
                    ? 'gradient-brand text-white shadow-lg'
                    : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] border border-white/[0.06]'
                }
              `}
            >
              {preset}×
            </button>
          ))}
        </div>
      </div>

      {/* Ingredient Items */}
      <div className="space-y-2 mb-5 stagger-children">
        {currentIngredients.map((ing, index) => (
          <div
            key={ing.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] 
                       border border-white/[0.05] hover:border-white/[0.1] 
                       transition-colors group"
          >
            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 truncate">
                {ing.name}
              </p>
              <p className="text-[11px] text-white/30 font-mono">
                {Math.round(ing.nutrition.calories * portionMultiplier)} kcal •{' '}
                P:{Math.round(ing.nutrition.protein * portionMultiplier * 10) / 10}g •{' '}
                C:{Math.round(ing.nutrition.carbs * portionMultiplier * 10) / 10}g •{' '}
                F:{Math.round(ing.nutrition.fat * portionMultiplier * 10) / 10}g
              </p>
            </div>

            {/* Grams Input */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="1"
                value={ing.grams}
                onChange={(e) => handleGramsChange(index, e.target.value)}
                className="w-16 input-dark text-center text-sm py-1.5 px-2"
                aria-label={`Grams for ${ing.name}`}
              />
              <span className="text-xs text-white/30">g</span>
            </div>

            {/* Delete */}
            <button
              onClick={() => removeIngredient(index)}
              className="opacity-0 group-hover:opacity-100 transition-opacity 
                         p-1.5 rounded-lg hover:bg-danger/10 text-white/30 hover:text-danger"
              aria-label={`Remove ${ing.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Manual Ingredient */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 px-1">
          Add ingredient manually
        </p>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.12]">
          <input
            type="text"
            value={newIngName}
            onChange={(e) => setNewIngName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddManual(); }}
            placeholder="e.g. grilled chicken breast"
            className="input-dark flex-1 text-sm"
            disabled={isAdding}
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min="1"
              value={newIngGrams}
              onChange={(e) => setNewIngGrams(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddManual(); }}
              placeholder="g"
              className="input-dark w-[72px] text-sm text-center"
              disabled={isAdding}
            />
            <span className="text-xs text-white/40 font-medium">g</span>
          </div>
          <button
            onClick={handleAddManual}
            className="btn-secondary shrink-0 px-3 py-2"
            disabled={!newIngName.trim() || !newIngGrams || isAdding}
          >
            {isAdding ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
        {addError && (
          <p className="mt-2 text-xs text-red-400 px-1">{addError}</p>
        )}
      </div>

      {/* Nutrition Summary */}
      <div className="p-3 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-5">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
          Total Nutrition ({portionMultiplier}× portion)
        </h3>
        {/* 2 cols on mobile, 4 on sm */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TRACKED_NUTRIENTS.slice(0, 4).map((nutrient) => (
            <div key={nutrient.key} className="text-center">
              <p
                className="text-lg font-bold tabular-nums"
                style={{ color: nutrient.colorHex }}
              >
                {Math.round(
                  (totalNutrition[nutrient.key as keyof NutritionInfo] as number)
                )}
              </p>
              <p className="text-[10px] text-white/40">
                {nutrient.label} ({nutrient.unit})
              </p>
            </div>
          ))}
        </div>

        {/* Secondary nutrients — 3 cols always */}
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/[0.05]">
          {TRACKED_NUTRIENTS.slice(4).map((nutrient) => (
            <div key={nutrient.key} className="text-center">
              <p className="text-sm font-semibold text-white/70 tabular-nums">
                {Math.round(
                  (totalNutrition[nutrient.key as keyof NutritionInfo] as number)
                )}
                <span className="text-[10px] text-white/30 ml-0.5">
                  {nutrient.unit}
                </span>
              </p>
              <p className="text-[10px] text-white/30">{nutrient.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Save Meal */}
      <div className="flex gap-2">
        <input
          type="text"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          placeholder="Meal name (optional)"
          className="input-dark flex-1 text-sm"
        />
        <button
          onClick={handleSaveMeal}
          id="save-meal-button"
          className={`btn-primary ${isSaved ? 'glow-success' : ''}`}
          disabled={isSaved}
        >
          <Save className="w-4 h-4" />
          {isSaved ? 'Saved!' : 'Save Meal'}
        </button>
      </div>
    </Card>
  );
}
