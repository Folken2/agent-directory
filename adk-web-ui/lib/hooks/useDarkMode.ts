'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.classList.contains('dark');
const getServerSnapshot = () => false;

/**
 * Tracks whether the .dark class is present on <html>. That class is set
 * before first paint by THEME_INIT_SCRIPT (lib/theme.ts) and kept in sync by
 * ThemeProvider; downstream components (chart libs, syntax highlighting)
 * need a boolean to react to it.
 */
export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
