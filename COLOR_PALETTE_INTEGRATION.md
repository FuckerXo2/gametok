# 🎨 Loops Color Palette Integration

## ✅ Completed

### 1. Created Color Constants File
**File:** `src/constants/LoopsColors.ts`

**Includes:**
- 50+ color definitions from Loops
- Common gradient combinations
- Semantic color mappings for easier use
- Alpha variants for overlays

**Usage:**
```typescript
import { LoopsColors, SemanticColors, LoopsGradients } from '../constants/LoopsColors';

// Direct colors
backgroundColor: LoopsColors.mainGreen
color: LoopsColors.coinGold

// Semantic colors (recommended)
backgroundColor: SemanticColors.success
color: SemanticColors.textPrimary

// Gradients
<LinearGradient colors={LoopsGradients.primary} />
```

### 2. Updated Components

**GameLoadingScreen.tsx** ✅
- Replaced all hardcoded colors with LoopsColors
- Using: mainGreen, white variants, black variants

**ProfileScreen.tsx** ✅
- Updated coin badge colors
- Updated level badge colors
- Updated streak badge colors
- Updated rewards vault colors
- Using: coinGold, color6 (purple), color2 (orange), white variants

**RewardsScreen.tsx** ✅
- Added import (ready for color updates)

---

## 🎯 Next: Replace Remaining Hardcoded Colors

### High Priority Components:

1. **LeaderboardModal.tsx**
   - Tier colors (Champion, Diamond, Gold, etc.)
   - Background gradients
   - Badge colors

2. **RewardsScreen.tsx**
   - Mission card colors
   - Achievement colors
   - Reward cost badges
   - Progress bars

3. **AchievementsModal.tsx**
   - Achievement card colors
   - Unlock states
   - Progress indicators

4. **CommentsSheet.tsx**
   - Header gradient
   - Like button colors
   - Reply indicators

5. **ShareSheet.tsx**
   - Platform colors
   - Button states

### Medium Priority:

6. **ConnectScreen.tsx**
7. **ExploreScreen.tsx**
8. **DiscoverScreen.tsx**
9. **InboxScreen.tsx**
10. **StoryViewer.tsx**

---

## 📊 Color Usage Guide

### Primary Actions
```typescript
// Success/Positive
SemanticColors.success        // #55dd88 (Loops green)
SemanticColors.successLight    // #51d287
SemanticColors.successBg       // #dcfadf

// Error/Negative
SemanticColors.error           // #ff0000
SemanticColors.errorLight      // #ec2c7a (Loops pink)

// Info/Neutral
SemanticColors.info            // #0db8f6 (Loops blue)
SemanticColors.infoLight       // #73dceb
```

### Coins & Rewards
```typescript
SemanticColors.coin            // #ffd60a (gold)
SemanticColors.premium         // #d17cfc (purple-pink)
SemanticColors.warning         // #e6a500 (darker gold)
```

### Text
```typescript
SemanticColors.textPrimary     // #2c2c30 (dark)
SemanticColors.textSecondary   // #71717b (gray)
SemanticColors.textTertiary    // #abadbb (light gray)
SemanticColors.textInverse     // #ffffff (white)
```

### Backgrounds
```typescript
SemanticColors.bgPrimary       // #ffffff (white)
SemanticColors.bgSecondary     // #f9f9f9 (light gray)
SemanticColors.bgTertiary      // #eaebed (lighter gray)
```

### Overlays
```typescript
SemanticColors.overlay         // rgba(0,0,0,0.5)
SemanticColors.overlayLight    // rgba(0,0,0,0.3)
SemanticColors.overlayDark     // rgba(0,0,0,0.7)
```

### Borders
```typescript
SemanticColors.border          // #e5e5e5
SemanticColors.borderLight     // #e2e2e2
SemanticColors.borderDark      // #dddddd
```

---

## 🎨 Common Patterns

### Badge with Background
```typescript
<View style={{
  backgroundColor: LoopsColors.coinGold + '26', // 15% opacity
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 12,
}}>
  <Text style={{ color: LoopsColors.coinGold }}>
    1,234 Coins
  </Text>
</View>
```

### Gradient Button
```typescript
<LinearGradient
  colors={LoopsGradients.primary}
  style={styles.button}
>
  <Text style={{ color: LoopsColors.white }}>
    Claim Reward
  </Text>
</LinearGradient>
```

### Modal Overlay
```typescript
<View style={{
  backgroundColor: SemanticColors.overlay,
  ...StyleSheet.absoluteFillObject,
}} />
```

---

## 🔄 Migration Strategy

### Step 1: Find & Replace Common Colors
```bash
# Coin gold
'#ffd60a' → LoopsColors.coinGold

# Purple
'#a855f7' → LoopsColors.color6

# Green
'#55dd88' → LoopsColors.mainGreen

# White overlays
'rgba(255,255,255,0.1)' → LoopsColors.white10
'rgba(255,255,255,0.5)' → LoopsColors.white50

# Black overlays
'rgba(0,0,0,0.5)' → LoopsColors.black50
'rgba(0,0,0,0.7)' → LoopsColors.black70
```

### Step 2: Add Import
```typescript
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';
```

### Step 3: Replace Inline Styles
```typescript
// Before
style={{ color: '#ffd60a' }}

// After
style={{ color: LoopsColors.coinGold }}
```

### Step 4: Update StyleSheet
```typescript
// Before
const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(255,214,10,0.15)',
  },
});

// After
const styles = StyleSheet.create({
  badge: {
    backgroundColor: LoopsColors.coinGold + '26',
  },
});
```

---

## 📈 Progress

### Completed: 3/30 components (10%)
- ✅ GameLoadingScreen
- ✅ ProfileScreen (partial)
- ✅ RewardsScreen (import only)

### Remaining: 27 components
- 🔲 LeaderboardModal
- 🔲 AchievementsModal
- 🔲 CommentsSheet
- 🔲 ShareSheet
- 🔲 ConnectScreen
- 🔲 ExploreScreen
- 🔲 DiscoverScreen
- 🔲 InboxScreen
- 🔲 StoryViewer
- 🔲 HomeScreen
- 🔲 ... and more

---

## 🎯 Benefits

1. **Consistency** - Same colors across entire app
2. **Maintainability** - Change once, update everywhere
3. **Branding** - Professional Loops-inspired palette
4. **Readability** - Semantic names vs hex codes
5. **Flexibility** - Easy to create variants (opacity, tints)

---

## 💡 Tips

1. **Use Semantic Colors** when possible (more readable)
2. **Add opacity with hex suffix**: `LoopsColors.mainGreen + '26'` = 15% opacity
3. **Use LoopsGradients** for common gradient patterns
4. **Keep theme context** for light/dark mode support
5. **Test on both themes** to ensure colors work in both modes

---

## 🚀 Next Steps

1. Update LeaderboardModal (highest visual impact)
2. Update RewardsScreen (lots of colors)
3. Update AchievementsModal
4. Batch update remaining modals
5. Update main screens (Home, Explore, etc.)

**Estimated time to complete:** 2-3 hours for all components
