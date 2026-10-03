'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemePref } from '@/lib/theme';
import { useTheme } from './ThemeProvider';

const OPTIONS: Array<{ value: ThemePref; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { pref, setPref } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex items-center rounded-full bg-md-surface-container p-0.5', className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          onClick={() => setPref(value)}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
            pref === value
              ? 'bg-md-primary-container text-md-on-primary-container'
              : 'text-md-on-surface-variant hover:bg-md-on-surface/8'
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
