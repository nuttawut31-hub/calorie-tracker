'use client';

interface ProgressBarProps {
  /** Current value */
  value: number;
  /** Target/max value */
  target: number;
  /** Label text (e.g., "Protein") */
  label: string;
  /** Unit string (e.g., "g", "kcal") */
  unit: string;
  /** Color hex for the fill bar */
  colorHex: string;
  /** Whether to show the numeric values */
  showValues?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Animated progress bar with overflow indication.
 * Shows current/target values and color-codes overflow in red.
 */
export default function ProgressBar({
  value,
  target,
  label,
  unit,
  colorHex,
  showValues = true,
  className = '',
}: ProgressBarProps) {
  const percentage = target > 0 ? (value / target) * 100 : 0;
  const isOverflow = percentage > 100;
  const clampedPercentage = Math.min(percentage, 100);

  return (
    <div className={`w-full ${className}`}>
      {/* Label Row */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-white/80">{label}</span>
        {showValues && (
          <span className="text-xs font-mono text-white/50">
            <span
              className="font-semibold"
              style={{ color: isOverflow ? '#ef4444' : colorHex }}
            >
              {Math.round(value)}
            </span>
            <span className="text-white/30"> / {Math.round(target)}</span>
            <span className="text-white/30"> {unit}</span>
          </span>
        )}
      </div>

      {/* Bar Track */}
      <div className="relative h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full animate-progress-fill"
          style={{
            width: `${clampedPercentage}%`,
            background: isOverflow
              ? `linear-gradient(90deg, ${colorHex}, #ef4444)`
              : colorHex,
            transition: 'width 0.6s ease-out',
          }}
        />

        {/* Glow effect on the fill end */}
        {percentage > 5 && (
          <div
            className="absolute inset-y-0 rounded-full blur-sm opacity-40"
            style={{
              width: `${clampedPercentage}%`,
              background: colorHex,
            }}
          />
        )}
      </div>

      {/* Percentage */}
      <div className="flex justify-end mt-1">
        <span
          className="text-[10px] font-mono"
          style={{ color: isOverflow ? '#ef4444' : 'rgba(255,255,255,0.3)' }}
        >
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}
