'use client';

import { useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface CalendarPickerProps {
  /** Currently selected date */
  selectedDate: Date;
  /** Called when user clicks a date cell */
  onSelect: (date: Date) => void;
  /** Set of YYYY-MM-DD strings that have logged data */
  loggedDates: Set<string>;
  /** Called when the picker should close (click-outside, Escape) */
  onClose: () => void;
  /** Month offset for navigation — managed by parent */
  monthOffset: number;
  onMonthOffsetChange: (offset: number) => void;
}

/** Format a Date to YYYY-MM-DD in local time (no UTC shift). */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export default function CalendarPicker({
  selectedDate,
  onSelect,
  loggedDates,
  onClose,
  monthOffset,
  onMonthOffsetChange,
}: CalendarPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const today = new Date();
  const todayKey = toDateKey(today);

  // Compute the month to display based on offset from today's month
  const displayMonth = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset, today.getFullYear(), today.getMonth()]);

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  // Build grid: 6 rows × 7 cols, starting from the Sunday of the first week
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    const grid: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Previous month tail
    for (let i = firstDay - 1; i >= 0; i--) {
      grid.push({
        date: new Date(year, month - 1, daysInPrev - i),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    // Next month head (fill to complete rows)
    let next = 1;
    while (grid.length % 7 !== 0) {
      grid.push({ date: new Date(year, month + 1, next++), isCurrentMonth: false });
    }

    return grid;
  }, [year, month]);

  const selectedKey = toDateKey(selectedDate);

  // Can we go forward? Stop at current month.
  const canGoNext = monthOffset < 0 || (year < today.getFullYear() || month < today.getMonth());

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Date picker calendar"
      className="calendar-picker"
    >
      {/* Month navigation */}
      <div className="calendar-header">
        <button
          onClick={() => onMonthOffsetChange(monthOffset - 1)}
          className="calendar-nav-btn"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="calendar-month-label">
          {MONTHS[month]} {year}
        </span>

        <button
          onClick={() => onMonthOffsetChange(monthOffset + 1)}
          className="calendar-nav-btn"
          aria-label="Next month"
          disabled={!canGoNext}
        >
          <ChevronRight className={`w-4 h-4 ${!canGoNext ? 'opacity-20' : ''}`} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="calendar-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d} className="calendar-weekday">{d}</span>
        ))}
      </div>

      {/* Day cells */}
      <div className="calendar-grid">
        {cells.map(({ date, isCurrentMonth }, idx) => {
          const key = toDateKey(date);
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const hasLog = loggedDates.has(key);
          const isFuture = key > todayKey;
          const isDisabled = isFuture;

          return (
            <button
              key={idx}
              disabled={isDisabled}
              onClick={() => {
                onSelect(date);
                onClose();
              }}
              aria-label={`${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}${hasLog ? ', has logged data' : ''}`}
              aria-pressed={isSelected}
              className={[
                'calendar-day',
                !isCurrentMonth && 'calendar-day--other-month',
                isToday && 'calendar-day--today',
                isSelected && 'calendar-day--selected',
                isDisabled && 'calendar-day--disabled',
                hasLog && !isSelected && 'calendar-day--has-log',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="calendar-day-num">{date.getDate()}</span>
              {hasLog && (
                <span className="calendar-day-check" aria-hidden="true">
                  <Check className="w-2 h-2" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--logged" />
          Has data
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--today" />
          Today
        </span>
      </div>
    </div>
  );
}
