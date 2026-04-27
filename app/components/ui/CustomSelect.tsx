'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface CustomSelectProps<T extends string = string> {
  id?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label?: string;
}

/**
 * Fully-themed dark dropdown — replaces native <select> whose dropdown
 * list cannot be styled with CSS across browsers.
 *
 * Features:
 * - Keyboard navigation (↑ ↓ Enter Escape)
 * - Click-outside to close
 * - Active item highlighted with brand gradient
 * - Smooth open/close animation
 * - ARIA-accessible
 */
export default function CustomSelect<T extends string = string>({
  id,
  value,
  options,
  onChange,
  label,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';
  const selectedIndex = options.findIndex((o) => o.value === value);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (open && focused >= 0) {
      const li = listRef.current?.children[focused] as HTMLElement | undefined;
      li?.scrollIntoView({ block: 'nearest' });
    }
  }, [focused, open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
          setFocused(selectedIndex >= 0 ? selectedIndex : 0);
        }
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocused((f) => Math.min(f + 1, options.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocused((f) => Math.max(f - 1, 0));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focused >= 0) {
            onChange(options[focused].value);
            setOpen(false);
            setFocused(-1);
          }
          break;
        case 'Escape':
          setOpen(false);
          setFocused(-1);
          break;
        case 'Tab':
          setOpen(false);
          setFocused(-1);
          break;
      }
    },
    [open, focused, options, onChange, selectedIndex]
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        onClick={() => {
          setOpen((o) => !o);
          setFocused(selectedIndex >= 0 ? selectedIndex : 0);
        }}
        onKeyDown={handleKeyDown}
        className={`
          w-full flex items-center justify-between gap-2
          px-3.5 py-2.5 rounded-xl text-sm font-medium text-left
          transition-all duration-200 outline-none
          border
          ${open
            ? 'bg-white/[0.1] border-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.2)]'
            : 'bg-white/[0.08] border-white/[0.2] hover:border-white/[0.3] hover:bg-white/[0.1]'
          }
        `}
      >
        <span className="text-white/90 truncate">{selectedLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="
            absolute z-50 top-full left-0 right-0 mt-1.5
            max-h-60 overflow-y-auto
            rounded-xl border border-white/[0.12]
            bg-[#1a1d2b]/95 backdrop-blur-xl
            shadow-[0_8px_32px_rgba(0,0,0,0.5)]
            animate-slide-down
            py-1
          "
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isFocused = i === focused;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setFocused(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // Don't trigger blur
                  onChange(opt.value);
                  setOpen(false);
                  setFocused(-1);
                }}
                className={`
                  flex items-center justify-between
                  px-3.5 py-2.5 cursor-pointer text-sm
                  transition-colors duration-100 select-none
                  ${isSelected
                    ? 'text-white font-semibold'
                    : 'text-white/70 font-normal'
                  }
                  ${isFocused && !isSelected ? 'bg-white/[0.07] text-white/90' : ''}
                  ${isSelected ? 'bg-indigo-500/20' : ''}
                `}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
