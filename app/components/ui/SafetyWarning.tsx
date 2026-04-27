'use client';

import { AlertTriangle } from 'lucide-react';

interface SafetyWarningProps {
  message: string;
  className?: string;
}

/**
 * Clinical safety warning banner.
 * Displays when calorie target drops below BMR or 1200 kcal.
 */
export default function SafetyWarning({
  message,
  className = '',
}: SafetyWarningProps) {
  return (
    <div
      id="safety-warning-banner"
      className={`
        flex items-start gap-3 p-4 rounded-xl
        bg-danger/10 border border-danger/20
        animate-slide-down
        ${className}
      `}
      role="alert"
    >
      <AlertTriangle
        className="w-5 h-5 text-danger shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-danger mb-1">
          Health Warning
        </p>
        <p className="text-sm text-danger/80 leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}
