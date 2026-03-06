# Loops App - Color Palette

Extracted from their decompiled app. Use these exact colors to match their design.

## Primary Colors

```typescript
export const LoopsColors = {
  // Main brand colors
  mainGreen: '#55dd88',      // Their primary green
  mainPink: '#ec2c7a',       // Accent pink
  mainBlue: '#0db8f6',       // Blue accent
  
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
  black10: '#1a000000',
  black16: '#29000000',
  black20: '#33000000',
  black30: '#4d000000',
  black40: '#66000000',
  black50: '#80000000',
  black60: '#99000000',
  black70: '#b3000000',
  black80: '#cc000000',
  black90: '#e6000000',
  
  // Alpha whites
  halfWhite: '#80ffffff',
  lightWhite: '#30ffffff',
  
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
  colorE6A500: '#e6a500',  // Gold/yellow
  
  // Gradients (use these for buttons)
  color1: '#fda76e',  // Orange
  color2: '#ffc26d',  // Light orange
  color3: '#34d939',  // Green
  color4: '#73dceb',  // Cyan
  color5: '#3e99d2',  // Blue
  color6: '#908fef',  // Purple
  color7: '#d17cfc',  // Pink purple
  color8: '#fe89b1',  // Pink
  color9: '#fda76e',  // Orange (duplicate)
};
```

## Usage Examples

### Onboarding Background
```typescript
// Their onboarding uses a dark gradient
colors={['#0f0c29', '#302b63', '#24243e']}
```

### Button Gradients
```typescript
// Primary button (green)
colors={['#55dd88', '#34a350']}

// Secondary button (pink)
colors={['#ec2c7a', '#d17cfc']}

// Disabled button
colors={['#666', '#555']}
```

### Text Colors
```typescript
// Primary text
color: '#2c2c30'  // mainDark

// Secondary text
color: '#71717b'  // mainLightDark

// Tertiary/hint text
color: '#abadbb'  // mainGray
```

### Backgrounds
```typescript
// Main background
backgroundColor: '#f9f9f9'  // mainGrayBg

// Card/container background
backgroundColor: '#ffffff'  // white

// Divider
backgroundColor: '#e5e5e5'  // colorDividerLine
```

### Overlays
```typescript
// Dark overlay (50% opacity)
backgroundColor: '#80000000'  // black50

// Light overlay
backgroundColor: '#30ffffff'  // lightWhite
```

## Color Combinations They Use

### Game Loading Screen
- Background: `#000000` (black)
- Overlay: `#80000000` (black50)
- Text: `#ffffff` (white)
- Accent: `#55dd88` (mainGreen)

### Onboarding
- Background gradient: `['#0f0c29', '#302b63', '#24243e']`
- Text: `#ffffff` (white)
- Secondary text: `#d6d3de` (light purple-grey)
- Button: `#55dd88` (mainGreen)

### Rewards/Coins
- Primary: `#e6a500` (gold)
- Background: `#dcfadf` (greenDc - light green)
- Text: `#00be6d` (greenText)

### Profile
- Background: `#f9f9f9` (mainGrayBg)
- Card: `#ffffff` (white)
- Border: `#e5e5e5` (colorDividerLine)
- Text: `#2c2c30` (mainDark)
- Secondary: `#71717b` (mainLightDark)

