'use client';

import { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import Card from '@/app/components/ui/Card';
import SafetyWarning from '@/app/components/ui/SafetyWarning';
import CustomSelect from '@/app/components/ui/CustomSelect';
import { useTDEEStore } from '@/lib/store';
import { getSafetyWarning } from '@/lib/utils';
import { ACTIVITY_LABELS, GOAL_LABELS } from '@/lib/constants';
import type { ActivityLevel, Gender, Goal } from '@/lib/types';

const ACTIVITY_OPTIONS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'veryActive',
];

const GOAL_OPTIONS: Goal[] = ['loss', 'maintenance', 'gain'];

export default function TDEECalculator() {
  const { userProfile, tdeeResult, setProfile } = useTDEEStore();

  // Form state — defaults first, then sync from persisted store after mount
  const [gender, setGender] = useState<Gender>('male');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<Goal>('maintenance');

  // Sync form state from persisted store AFTER hydration (client-only)
  useEffect(() => {
    if (userProfile) {
      setGender(userProfile.gender);
      setAge(userProfile.age.toString());
      setWeight(userProfile.weightKg.toString());
      setHeight(userProfile.heightCm.toString());
      setActivity(userProfile.activityLevel);
      setGoal(userProfile.goal);
    }
  }, [userProfile]);

  const warningMessage =
    tdeeResult
      ? getSafetyWarning(tdeeResult.targetCalories, tdeeResult.bmr)
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const ageNum = parseInt(age, 10);
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);

    if (
      isNaN(ageNum) ||
      isNaN(weightNum) ||
      isNaN(heightNum) ||
      ageNum < 1 ||
      weightNum < 1 ||
      heightNum < 1
    ) {
      return;
    }

    setProfile({
      gender,
      age: ageNum,
      weightKg: weightNum,
      heightCm: heightNum,
      activityLevel: activity,
      goal,
    });
  }

  return (
    <Card id="tdee-calculator" hover>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="section-title">TDEE Calculator</h2>
          <p className="section-subtitle">Mifflin-St Jeor Equation</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Gender Toggle */}
        <div>
          <label className="block text-sm text-white/60 mb-2 font-medium">
            Biological Sex
          </label>
          <div className="flex gap-2">
            {(['male', 'female'] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`
                  flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                  ${
                    gender === g
                      ? 'gradient-brand text-white shadow-lg'
                      : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] border border-white/[0.08]'
                  }
                `}
              >
                {g === 'male' ? '♂ Male' : '♀ Female'}
              </button>
            ))}
          </div>
        </div>

        {/* Age, Weight, Height - Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="age-input"
              className="block text-sm text-white/60 mb-2 font-medium"
            >
              Age
            </label>
            <input
              id="age-input"
              type="number"
              min="1"
              max="120"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              className="input-dark"
              required
            />
          </div>
          <div>
            <label
              htmlFor="weight-input"
              className="block text-sm text-white/60 mb-2 font-medium"
            >
              Weight (kg)
            </label>
            <input
              id="weight-input"
              type="number"
              min="1"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="70"
              className="input-dark"
              required
            />
          </div>
          <div>
            <label
              htmlFor="height-input"
              className="block text-sm text-white/60 mb-2 font-medium"
            >
              Height (cm)
            </label>
            <input
              id="height-input"
              type="number"
              min="1"
              step="0.1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="175"
              className="input-dark"
              required
            />
          </div>
        </div>

        {/* Activity Level */}
        <div>
          <label
            htmlFor="activity-select"
            className="block text-sm text-white/60 mb-2 font-medium"
          >
            Activity Level
          </label>
          <CustomSelect<ActivityLevel>
            id="activity-select"
            value={activity}
            options={ACTIVITY_OPTIONS.map((level) => ({
              value: level,
              label: ACTIVITY_LABELS[level],
            }))}
            onChange={setActivity}
            label="Activity Level"
          />
        </div>

        {/* Goal */}
        <div>
          <label className="block text-sm text-white/60 mb-2 font-medium">
            Goal
          </label>
          <div className="flex gap-2">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className={`
                  flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                  ${
                    goal === g
                      ? 'gradient-brand text-white shadow-lg'
                      : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] border border-white/[0.08]'
                  }
                `}
              >
                {GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          id="calculate-tdee-button"
          className="btn-primary w-full py-3"
        >
          <Calculator className="w-4 h-4" />
          Calculate TDEE
        </button>
      </form>

      {/* Safety Warning */}
      {warningMessage && (
        <div className="mt-5">
          <SafetyWarning message={warningMessage} />
        </div>
      )}
    </Card>
  );
}
