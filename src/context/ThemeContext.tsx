import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

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
  primary: '#FF8E53',
  accent: '#25F4EE',
};

const darkColors: ThemeColors = {
  background: '#000',
  surface: '#1a1a1a',
  text: '#fff',
  textSecondary: '#888',
  border: '#333',
  primary: '#FF8E53',
  accent: '#25F4EE',
};

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(Appearance.getColorScheme() === 'dark');

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDark(colorScheme === 'dark');
    });
    return () => subscription.remove();
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
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
