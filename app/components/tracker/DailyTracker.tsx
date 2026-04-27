'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import Card from '@/app/components/ui/Card';
import ProgressBar from '@/app/components/ui/ProgressBar';
import MealCard from '@/app/components/tracker/MealCard';
import { useDailyLogStore } from '@/lib/store';
import { useTDEEStore } from '@/lib/store';
import { useHydration } from '@/lib/useHydration';
import { formatDate, emptyNutrition } from '@/lib/utils';
import { TRACKED_NUTRIENTS } from '@/lib/constants';
import type { NutritionInfo } from '@/lib/types';

/**
 * Daily progress tracker — shows date navigation, macro progress bars vs TDEE targets,
 * and list of saved meals for the selected day.
 */
export default function DailyTracker() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateKey = formatDate(selectedDate);
  const hydrated = useHydration();

  const { dailyLogs } = useDailyLogStore();
  const { tdeeResult } = useTDEEStore();

  const log = hydrated ? dailyLogs[dateKey] : undefined;
  const totals = log?.totalNutrition ?? emptyNutrition();
  const meals = log?.meals ?? [];

  const isToday = dateKey === formatDate(new Date());

  function navigateDay(delta: number) {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  // Targets from TDEE result (use hydrated to avoid mismatch)
  const targets = hydrated
    ? {
        calories: tdeeResult?.targetCalories ?? 2000,
        protein: tdeeResult?.macros.protein.grams ?? 150,
        fat: tdeeResult?.macros.fat.grams ?? 65,
        carbs: tdeeResult?.macros.carbs.grams ?? 250,
      }
    : {
        calories: 2000,
        protein: 150,
        fat: 65,
        carbs: 250,
      };

  return (
    <Card id="daily-tracker" hover>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="section-title">Daily Progress</h2>
            <p className="section-subtitle">
              Track your intake vs targets
            </p>
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <button
          onClick={() => navigateDay(-1)}
          className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-4 h-4 text-white/50" />
        </button>

        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-white/40" />
          <span className="text-sm font-semibold text-white/80">
            {isToday
              ? 'Today'
              : selectedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
          </span>
          <span className="text-xs text-white/30 font-mono">{dateKey}</span>
        </div>

        <button
          onClick={() => navigateDay(1)}
          className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
          aria-label="Next day"
          disabled={isToday}
        >
          <ChevronRight
            className={`w-4 h-4 ${isToday ? 'text-white/15' : 'text-white/50'}`}
          />
        </button>
      </div>

      {/* Progress Bars */}
      <div className="space-y-4 mb-6">
        {/* Calories — Larger */}
        <ProgressBar
          value={totals.calories}
          target={targets.calories}
          label="Calories"
          unit="kcal"
          colorHex="#8b5cf6"
        />

        {/* Macros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ProgressBar
            value={totals.protein}
            target={targets.protein}
            label="Protein"
            unit="g"
            colorHex="#06b6d4"
          />
          <ProgressBar
            value={totals.carbs}
            target={targets.carbs}
            label="Carbs"
            unit="g"
            colorHex="#f59e0b"
          />
          <ProgressBar
            value={totals.fat}
            target={targets.fat}
            label="Fat"
            unit="g"
            colorHex="#f43f5e"
          />
        </div>
      </div>

      {/* Meals List */}
      <div>
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
          Meals ({meals.length})
        </h3>

        {meals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-white/30">
              {isToday
                ? "No meals logged today. Use the AI scanner above to add your first meal!"
                : 'No meals logged on this day.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 stagger-children">
            {meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} date={dateKey} />
            ))}
          </div>
        )}
      </div>

      {/* Daily Summary Footer */}
      {meals.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          <div className="grid grid-cols-7 gap-2">
            {TRACKED_NUTRIENTS.map((nutrient) => (
              <div key={nutrient.key} className="text-center">
                <p
                  className="text-xs font-bold tabular-nums"
                  style={{ color: nutrient.colorHex }}
                >
                  {Math.round(
                    totals[nutrient.key as keyof NutritionInfo] as number
                  )}
                </p>
                <p className="text-[8px] text-white/30 leading-tight mt-0.5">
                  {nutrient.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
