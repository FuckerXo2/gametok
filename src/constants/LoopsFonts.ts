/**
 * Loops Font Family Constants
 * 
 * Graphik Arabic font family from Loops app
 * Modern, clean sans-serif with excellent readability
 * Supports both Latin and Arabic scripts
 */

export const LoopsFonts = {
  // Regular weight (400)
  regular: 'Graphik-Regular',
  
  // Medium weight (500)
  medium: 'Graphik-Medium',
  
  // Semi-bold weight (600)
  semiBold: 'Graphik-SemiBold',
  
  // Bold weight (700)
  bold: 'Graphik-Bold',
} as const;

/**
 * Font weight mapping for easy reference
 */
export const FontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

/**
 * Common font styles for reuse
 */
export const FontStyles = {
  // Headers
  h1: {
    fontFamily: LoopsFonts.bold,
    fontSize: 32,
    lineHeight: 40,
  },
  h2: {
    fontFamily: LoopsFonts.bold,
    fontSize: 24,
    lineHeight: 32,
  },
  h3: {
    fontFamily: LoopsFonts.semiBold,
    fontSize: 20,
    lineHeight: 28,
  },
  h4: {
    fontFamily: LoopsFonts.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  
  // Body text
  bodyLarge: {
    fontFamily: LoopsFonts.regular,
    fontSize: 18,
    lineHeight: 26,
  },
  body: {
    fontFamily: LoopsFonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySmall: {
    fontFamily: LoopsFonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  
  // UI elements
  button: {
    fontFamily: LoopsFonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  buttonSmall: {
    fontFamily: LoopsFonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: LoopsFonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: LoopsFonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  
  // Special
  number: {
    fontFamily: LoopsFonts.bold,
    fontSize: 24,
    lineHeight: 32,
  },
} as const;

/**
 * Usage example:
 * 
 * import { LoopsFonts, FontStyles } from '@/constants/LoopsFonts';
 * 
 * const styles = StyleSheet.create({
 *   title: {
 *     ...FontStyles.h1,
 *     color: LoopsColors.white,
 *   },
 *   subtitle: {
 *     fontFamily: LoopsFonts.medium,
 *     fontSize: 16,
 *   },
 * });
 */
