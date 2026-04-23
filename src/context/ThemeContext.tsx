import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  accent: string;
}

const lightColors: ThemeColors = {
  background: '#fff',
  surface: '#f5f5f5',
  text: '#000',
  textSecondary: '#666',
  border: '#e0e0e0',
  primary: '#a855f7',
  accent: '#25F4EE',
};

const darkColors: ThemeColors = {
  background: '#000',
  surface: '#1a1a1a',
  text: '#fff',
  textSecondary: '#888',
  border: '#333',
  primary: '#a855f7',
  accent: '#25F4EE',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'gametok_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedTheme) => {
        if (!mounted) return;
        if (storedTheme === 'dark' || storedTheme === 'light') {
          setIsDark(storedTheme === 'dark');
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
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
