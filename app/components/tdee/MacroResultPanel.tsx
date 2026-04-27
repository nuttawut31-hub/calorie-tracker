'use client';

import { Flame, Target, Zap } from 'lucide-react';
import Card from '@/app/components/ui/Card';
import { useTDEEStore } from '@/lib/store';
import { useHydration } from '@/lib/useHydration';
import { GOAL_LABELS } from '@/lib/constants';

/**
 * Displays the TDEE calculation results — BMR, TDEE, Target Calories,
 * and macro breakdown with visual bars.
 */
export default function MacroResultPanel() {
  const { tdeeResult, userProfile } = useTDEEStore();
  const hydrated = useHydration();

  // Show placeholder until client is hydrated (prevents SSR mismatch)
  if (!hydrated || !tdeeResult || !userProfile) {
    return (
      <Card id="macro-result-panel" className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-white/40 text-sm font-medium">
            Fill in the TDEE Calculator to see your results
          </p>
        </div>
      </Card>
    );
  }

  const { bmr, tdee, targetCalories, macros } = tdeeResult;

  const macroData = [
    {
      label: 'Protein',
      grams: macros.protein.grams,
      percentage: macros.protein.percentage,
      color: '#06b6d4',
    },
    {
      label: 'Carbs',
      grams: macros.carbs.grams,
      percentage: macros.carbs.percentage,
      color: '#f59e0b',
    },
    {
      label: 'Fat',
      grams: macros.fat.grams,
      percentage: macros.fat.percentage,
      color: '#f43f5e',
    },
  ];

  return (
    <Card id="macro-result-panel" hover>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="section-title">Your Results</h2>
          <p className="section-subtitle">
            {GOAL_LABELS[userProfile.goal]} Plan
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-6 stagger-children">
        {/* BMR */}
        <div className="rounded-xl bg-white/[0.04] p-4 text-center border border-white/[0.06]">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
              BMR
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {bmr.toLocaleString()}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5">kcal/day</p>
        </div>

        {/* TDEE */}
        <div className="rounded-xl bg-white/[0.04] p-4 text-center border border-white/[0.06]">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
              TDEE
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {tdee.toLocaleString()}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5">kcal/day</p>
        </div>

        {/* Target */}
        <div className="rounded-xl p-4 text-center border border-brand-start/30 bg-brand-start/[0.08]">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
              Target
            </span>
          </div>
          <p className="text-2xl font-bold gradient-brand-text tabular-nums">
            {targetCalories.toLocaleString()}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5">kcal/day</p>
        </div>
      </div>

      {/* Macro Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
          Daily Macro Targets
        </h3>

        {macroData.map((macro) => (
          <div key={macro.label} className="animate-fade-in-up">
            {/* Macro Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: macro.color }}
                />
                <span className="text-sm font-semibold text-white/80">
                  {macro.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: macro.color }}
                >
                  {macro.grams}g
                </span>
                <span className="text-xs text-white/30 font-mono">
                  {macro.percentage}%
                </span>
              </div>
            </div>

            {/* Macro Bar */}
            <div className="relative h-3 rounded-full overflow-hidden bg-white/[0.04]">
              <div
                className="absolute inset-y-0 left-0 rounded-full animate-progress-fill"
                style={{
                  width: `${macro.percentage}%`,
                  backgroundColor: macro.color,
                  transition: 'width 0.8s ease-out',
                }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full blur-sm opacity-30"
                style={{
                  width: `${macro.percentage}%`,
                  backgroundColor: macro.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Calorie Breakdown Note */}
      <div className="mt-6 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span>🧪</span>
          <span>
            Protein: {macros.protein.grams * 4} kcal • Carbs:{' '}
            {macros.carbs.grams * 4} kcal • Fat: {macros.fat.grams * 9} kcal
          </span>
        </div>
      </div>
    </Card>
  );
}
