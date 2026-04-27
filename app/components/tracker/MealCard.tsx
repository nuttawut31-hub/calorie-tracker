'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Trash2 } from 'lucide-react';
import { useDailyLogStore } from '@/lib/store';
import { formatTime } from '@/lib/utils';
import type { Meal } from '@/lib/types';

interface MealCardProps {
  meal: Meal;
  date: string;
}

/**
 * Collapsible meal card showing name, total calories, timestamp,
 * and expandable ingredient breakdown.
 */
export default function MealCard({ meal, date }: MealCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { removeMeal } = useDailyLogStore();

  return (
    <div
      className="rounded-xl bg-white/[0.03] border border-white/[0.06] 
                 hover:border-white/[0.1] transition-all overflow-hidden"
    >
      {/* Header — always visible */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Color dot */}
        <div className="w-2 h-2 rounded-full gradient-brand shrink-0" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90 truncate">
            {meal.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock className="w-3 h-3 text-white/30" />
            <span className="text-[11px] text-white/30">
              {formatTime(meal.timestamp)}
            </span>
            <span className="text-[11px] text-white/20">•</span>
            <span className="text-[11px] text-white/30">
              {meal.ingredients.length} items
            </span>
            {meal.portionMultiplier !== 1 && (
              <>
                <span className="text-[11px] text-white/20">•</span>
                <span className="text-[11px] text-indigo-400 font-mono">
                  {meal.portionMultiplier}×
                </span>
              </>
            )}
          </div>
        </div>

        {/* Calories */}
        <div className="text-right mr-2">
          <p className="text-sm font-bold gradient-brand-text tabular-nums">
            {Math.round(meal.totalNutrition.calories)}
          </p>
          <p className="text-[10px] text-white/30">kcal</p>
        </div>

        {/* Expand icon */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-white/30" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/30" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 animate-slide-down">
          {/* Macro Summary */}
          <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-white/[0.02] mb-3">
            <div className="text-center">
              <p className="text-xs font-bold text-[#06b6d4] tabular-nums">
                {Math.round(meal.totalNutrition.protein * 10) / 10}g
              </p>
              <p className="text-[9px] text-white/30">Protein</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-[#f59e0b] tabular-nums">
                {Math.round(meal.totalNutrition.carbs * 10) / 10}g
              </p>
              <p className="text-[9px] text-white/30">Carbs</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-[#f43f5e] tabular-nums">
                {Math.round(meal.totalNutrition.fat * 10) / 10}g
              </p>
              <p className="text-[9px] text-white/30">Fat</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-[#10b981] tabular-nums">
                {Math.round(meal.totalNutrition.fiber * 10) / 10}g
              </p>
              <p className="text-[9px] text-white/30">Fiber</p>
            </div>
          </div>

          {/* Ingredient List */}
          <div className="space-y-1.5 mb-3">
            {meal.ingredients.map((ing) => (
              <div
                key={ing.id}
                className="flex items-center justify-between py-1 text-xs"
              >
                <span className="text-white/60 truncate mr-2">{ing.name}</span>
                <span className="text-white/30 font-mono whitespace-nowrap">
                  {ing.grams}g •{' '}
                  {Math.round(ing.nutrition.calories * meal.portionMultiplier)}{' '}
                  kcal
                </span>
              </div>
            ))}
          </div>

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeMeal(date, meal.id);
            }}
            className="btn-danger text-xs w-full justify-center"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove Meal
          </button>
        </div>
      )}
    </div>
  );
}
