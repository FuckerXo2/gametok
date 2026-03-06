/**
 * Loops App Color Palette
 * Extracted from their decompiled app
 * Use these for consistent branding and polish
 */

export const LoopsColors = {
  // Main brand colors
  mainGreen: '#55dd88',
  mainPink: '#ec2c7a',
  mainBlue: '#0db8f6',
  
  // Greens
  green: '#34a350',
  greenLight: '#51d287',
  greenText: '#00be6d',
  greenBg: '#03ad8f',
  greenDc: '#dcfadf',
  
  // Backgrounds
  mainGrayBg: '#f9f9f9',
  commonBackground: '#e9eded',
  mainLightWhiteGrey: '#eaebed',
  
  // Text colors
  mainDark: '#2c2c30',
  mainContent: '#3f3e4c',
  mainLightDark: '#71717b',
  mainDeepGrey: '#777681',
  mainGray: '#abadbb',
  darkGrey: '#333333',
  
  // Blacks & Whites
  black: '#000000',
  white: '#ffffff',
  darkerBlack: '#282831',
  
  // Alpha blacks (for overlays)
  black10: 'rgba(0,0,0,0.1)',
  black16: 'rgba(0,0,0,0.16)',
  black20: 'rgba(0,0,0,0.2)',
  black30: 'rgba(0,0,0,0.3)',
  black40: 'rgba(0,0,0,0.4)',
  black50: 'rgba(0,0,0,0.5)',
  black60: 'rgba(0,0,0,0.6)',
  black70: 'rgba(0,0,0,0.7)',
  black80: 'rgba(0,0,0,0.8)',
  black90: 'rgba(0,0,0,0.9)',
  
  // Alpha whites
  white05: 'rgba(255,255,255,0.05)',
  white10: 'rgba(255,255,255,0.1)',
  white20: 'rgba(255,255,255,0.2)',
  white30: 'rgba(255,255,255,0.3)',
  white40: 'rgba(255,255,255,0.4)',
  white50: 'rgba(255,255,255,0.5)',
  white60: 'rgba(255,255,255,0.6)',
  white70: 'rgba(255,255,255,0.7)',
  white80: 'rgba(255,255,255,0.8)',
  white90: 'rgba(255,255,255,0.9)',
  
  // Accent colors
  blue: '#375bf1',
  blueLink: '#0a84ff',
  red: '#ff0000',
  
  // UI colors
  borderSilver: '#dddddd',
  lineColorGray: '#e2e2e2',
  colorDividerLine: '#e5e5e5',
  
  // Special colors
  clubYellow: '#d7bf7e',
  gold: '#e6a500',
  coinGold: '#ffd60a',
  
  // Status colors
  success: '#10b981',
  successDark: '#059669',
  warning: '#f59e0b',
  warningDark: '#d97706',
  error: '#ef4444',
  errorDark: '#dc2626',
  
  // Background colors
  bgDark: '#0f0f0f',
  
  // Category/Game colors (for gradients)
  color1: '#1a1a2e',  // Dark blue (card backgrounds)
  color2: '#f97316',  // Orange (streak flame)
  color3: '#16213e',  // Medium dark blue
  color4: '#0f3460',  // Deep blue
  color5: '#3e99d2',  // Blue
  color6: '#a855f7',  // Purple (main accent)
  color7: '#6366f1',  // Indigo
  color8: '#7c3aed',  // Deep purple
  color9: '#0891b2',  // Cyan
  color10: '#db2777',  // Deep pink
  color11: '#4f46e5',  // Indigo blue
};

// Common gradients used in Loops
export const LoopsGradients = {
  primary: [LoopsColors.mainGreen, LoopsColors.green],
  secondary: [LoopsColors.mainPink, LoopsColors.color7],
  blue: [LoopsColors.mainBlue, LoopsColors.color5],
  gold: [LoopsColors.gold, LoopsColors.clubYellow],
  dark: [LoopsColors.darkerBlack, LoopsColors.black],
};

// Semantic color mappings for easier use
export const SemanticColors = {
  // Success/positive
  success: LoopsColors.mainGreen,
  successLight: LoopsColors.greenLight,
  successDark: '#16a34a',
  successBg: LoopsColors.greenDc,
  
  // Error/negative
  error: LoopsColors.red,
  errorLight: LoopsColors.mainPink,
  
  // Info/neutral
  info: LoopsColors.mainBlue,
  infoLight: LoopsColors.color4,
  
  // Warning
  warning: LoopsColors.gold,
  warningLight: LoopsColors.color2,
  warningDark: '#f59e0b',
  
  // Coins/rewards
  coin: LoopsColors.coinGold,
  premium: LoopsColors.color7,
  
  // Text
  textPrimary: LoopsColors.mainDark,
  textSecondary: LoopsColors.mainLightDark,
  textTertiary: LoopsColors.mainGray,
  textInverse: LoopsColors.white,
  
  // Backgrounds
  bgPrimary: LoopsColors.white,
  bgSecondary: LoopsColors.mainGrayBg,
  bgTertiary: LoopsColors.mainLightWhiteGrey,
  bgDark: '#0a0a0f',
  
  // Borders
  border: LoopsColors.colorDividerLine,
  borderLight: LoopsColors.lineColorGray,
  borderDark: LoopsColors.borderSilver,
  
  // Overlays
  overlay: LoopsColors.black50,
  overlayLight: LoopsColors.black30,
  overlayDark: LoopsColors.black70,
};
