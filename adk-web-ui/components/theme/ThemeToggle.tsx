'use client';

import { useRef, type KeyboardEvent } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemePref } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from './ThemeProvider';

const OPTIONS: Array<{ value: ThemePref; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeToggle({ className, showLabels = false }: { className?: string; showLabels?: boolean }) {
  const { pref, setPref } = useTheme();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (index: number) => {
    const target = (index + OPTIONS.length) % OPTIONS.length;
    setPref(OPTIONS[target].value);
    refs.current[target]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(OPTIONS.length - 1);
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex items-center rounded-full bg-md-surface-container p-0.5', className)}
    >
      {OPTIONS.map(({ value, label, Icon }, i) => (
        <button
          key={value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={label}
          title={label}
          tabIndex={pref === value ? 0 : -1}
          onClick={() => setPref(value)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={cn(
            'inline-flex h-8 items-center justify-center gap-1.5 rounded-full transition-colors',
            showLabels ? 'px-3 text-label-large' : 'w-8',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
            pref === value
              ? 'bg-md-primary-container text-md-on-primary-container'
              : 'text-md-on-surface-variant hover:bg-md-on-surface/8'
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {showLabels ? label : null}
        </button>
      ))}
    </div>
  );
}

/** Compact theme picker for the top bar: one icon button that opens a menu. */
export function ThemeMenu({ className }: { className?: string }) {
  const { pref, setPref } = useTheme();
  const current = OPTIONS.find((o) => o.value === pref) ?? OPTIONS[2];
  const CurrentIcon = current.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="text" size="icon" className={className} aria-label={`Theme: ${current.label}`}>
          <CurrentIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[160px]">
        <DropdownMenuRadioGroup value={pref} onValueChange={(v) => setPref(v as ThemePref)}>
          {OPTIONS.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
