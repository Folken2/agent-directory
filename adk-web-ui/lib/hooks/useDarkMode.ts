'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks whether the .dark class is present on <html>. That class is set
 * before first paint by THEME_INIT_SCRIPT (lib/theme.ts) and kept in sync by
 * ThemeProvider; downstream components (chart libs, syntax highlighting)
 * need a boolean to react to it.
 */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}
