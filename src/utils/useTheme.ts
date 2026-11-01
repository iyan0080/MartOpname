import { useState, useEffect } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('mart_theme_mode') as ThemeMode) || 'system';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = (localStorage.getItem('mart_theme_mode') as ThemeMode) || 'system';
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      let activeIsDark = false;
      if (themeMode === 'dark') {
        activeIsDark = true;
      } else if (themeMode === 'light') {
        activeIsDark = false;
      } else {
        // System preference
        activeIsDark = mediaQuery.matches;
      }

      setIsDark(activeIsDark);
      if (activeIsDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    updateTheme();

    // Listen to OS device settings changes
    const handler = () => {
      if (themeMode === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('mart_theme_mode', mode);
    } catch {
      // ignore
    }
  };

  return {
    themeMode,
    isDark,
    setThemeMode,
  };
}
