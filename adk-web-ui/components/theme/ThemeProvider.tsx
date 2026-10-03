'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { parseThemePref, resolveTheme, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePref } from '@/lib/theme';

type ThemeContextValue = { pref: ThemePref; resolved: ResolvedTheme; setPref: (p: ThemePref) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe defaults; real values are read on mount so hydration matches.
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefState(readStoredPref());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    setReady(true);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveTheme(pref, systemDark);

  useEffect(() => {
    // The head init script already painted the correct theme; do not touch
    // the DOM until real values have been read to avoid a flash.
    if (!ready) return;
    applyTheme(resolved);
  }, [resolved, ready]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p);
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
