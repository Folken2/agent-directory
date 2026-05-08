'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks whether the .dark class is present on <html>. The app exposes a
 * theme toggle elsewhere that flips that class; downstream components (chart
 * libs, syntax highlighting) need a boolean to react to it.
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
