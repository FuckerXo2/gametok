import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useColorScheme, Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  cardLight: string;
  text: string;
  textSecondary: string;
  textDim: string;
  border: string;
  primary: string;
  accent: string;
}

export const lightColors: ThemeColors = {
  background: '#ffffff',
  surface: '#f5f5f5',
  card: '#ffffff',
  cardLight: '#f1f3f5',
  text: '#111827',
  textSecondary: '#6b7280',
  textDim: 'rgba(0,0,0,0.45)',
  border: '#e5e7eb',
  primary: '#47ab9a',
  accent: '#25F4EE',
};

export const darkColors: ThemeColors = {
  background: '#08090a',
  surface: '#141617',
  card: '#181a1c',
  cardLight: '#1f2224',
  text: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textDim: 'rgba(255,255,255,0.45)',
  border: 'rgba(255,255,255,0.1)',
  primary: '#47ab9a',
  accent: '#25F4EE',
};

export interface ThemeContextType {
  isDark: boolean;
  themeMode: ThemeMode;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'gametok_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [effectiveSystemScheme, setEffectiveSystemScheme] = useState<ColorSchemeName>(() => {
    return systemColorScheme || Appearance.getColorScheme() || 'dark';
  });

  // Keep effectiveSystemScheme synchronized whenever phone appearance changes
  useEffect(() => {
    if (systemColorScheme) {
      setEffectiveSystemScheme(systemColorScheme);
    }
  }, [systemColorScheme]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) {
        setEffectiveSystemScheme(colorScheme);
      }
    });
    return () => subscription.remove();
  }, []);

  // Load saved preference from storage (dark unless the player picked another in the menu)
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        // ("System default" is gone: anyone who had it gets dark)
        if (stored === 'light') setThemeModeState('light');
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return effectiveSystemScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, effectiveSystemScheme]);

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark');
  }, [isDark, setThemeMode]);

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, colors, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
