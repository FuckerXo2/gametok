# 🎨 Loops UI Assets - Usage Guide

We've extracted 36 high-quality UI assets from Loops that we can use in GameTok.

## 📁 Asset Categories

### 🎯 Icons (`assets/ui/icons/`)
Generic navigation and action icons - safe to use anywhere:

```typescript
import { Image } from 'react-native';

// Back button
<Image source={require('./assets/ui/icons/ic_back.png')} style={{ width: 24, height: 24 }} />

// Close button
<Image source={require('./assets/ui/icons/ic_close.png')} style={{ width: 24, height: 24 }} />

// Done/checkmark
<Image source={require('./assets/ui/icons/ic_done.png')} style={{ width: 24, height: 24 }} />

// Search
<Image source={require('./assets/ui/icons/ic_search.png')} style={{ width: 24, height: 24 }} />

// Share
<Image source={require('./assets/ui/icons/ic_share_more.png')} style={{ width: 24, height: 24 }} />

// Arrows
<Image source={require('./assets/ui/icons/ic_arrow_up.png')} style={{ width: 16, height: 16 }} />
<Image source={require('./assets/ui/icons/ic_arrow_down.png')} style={{ width: 16, height: 16 }} />
<Image source={require('./assets/ui/icons/ic_arrow_left_grey.png')} style={{ width: 16, height: 16 }} />
```

### 💰 Coins & Rewards (`assets/ui/coins/`)
Perfect for displaying currency and rewards:

```typescript
// Small coin icon (for inline display)
<Image source={require('./assets/ui/coins/coins_small.png')} style={{ width: 20, height: 20 }} />

// HD coin icon (for larger displays)
<Image source={require('./assets/ui/coins/coins_small_1.png')} style={{ width: 32, height: 32 }} />

// Diamond icons
<Image source={require('./assets/ui/coins/diamond_supporters.png')} style={{ width: 24, height: 24 }} />
<Image source={require('./assets/ui/coins/diamond_topfans.png')} style={{ width: 24, height: 24 }} />
```

### 🏆 Rank Badges (`assets/ui/ranks/`)
For leaderboards and top players:

```typescript
// Top 3 badges
<Image source={require('./assets/ui/ranks/leadboard_default_1.png')} style={{ width: 40, height: 40 }} />
<Image source={require('./assets/ui/ranks/leadboard_default_2.png')} style={{ width: 40, height: 40 }} />
<Image source={require('./assets/ui/ranks/leadboard_default_3.png')} style={{ width: 40, height: 40 }} />

// Top fans badges
<Image source={require('./assets/ui/ranks/ic_topfans_1.png')} style={{ width: 32, height: 32 }} />
<Image source={require('./assets/ui/ranks/ic_topfans_2.png')} style={{ width: 32, height: 32 }} />
<Image source={require('./assets/ui/ranks/ic_topfans_3.png')} style={{ width: 32, height: 32 }} />

// Number badges with backgrounds
<Image source={require('./assets/ui/ranks/ic_topfans_num1.png')} style={{ width: 24, height: 24 }} />
```

### 🔘 Buttons (`assets/ui/buttons/`)
Button states for custom buttons (9-patch images):

```typescript
// Use with TouchableOpacity states
const [pressed, setPressed] = useState(false);

<TouchableOpacity
  onPressIn={() => setPressed(true)}
  onPressOut={() => setPressed(false)}
>
  <Image 
    source={pressed 
      ? require('./assets/ui/buttons/bt_new_m_pressed.9.png')
      : require('./assets/ui/buttons/bt_new_m_normal.9.png')
    }
    style={{ width: 200, height: 48 }}
  />
</TouchableOpacity>

// Disabled state
<Image source={require('./assets/ui/buttons/bt_new_m_disable.9.png')} />
```

### ⏳ Loading (`assets/ui/loading/`)
Game loading screens:

```typescript
// Loading background
<ImageBackground 
  source={require('./assets/ui/loading/default_loading_bg.png')}
  style={{ flex: 1 }}
>
  {/* Loading content */}
</ImageBackground>

// Loading icon
<Image source={require('./assets/ui/loading/ic_loading_images.png')} style={{ width: 64, height: 64 }} />
```

### 🎨 Backgrounds (`assets/ui/backgrounds/`)
Decorative backgrounds:

```typescript
// Leaderboard background
<ImageBackground 
  source={require('./assets/ui/backgrounds/bg_leaderboard.png')}
  style={{ flex: 1 }}
/>

// Top fans backgrounds (for #1, #2, #3)
<Image source={require('./assets/ui/backgrounds/bg_topfans_1.png')} />
```

## 🎯 Quick Wins - Where to Use These

### 1. Replace Ionicons with their icons
```typescript
// Before
<Ionicons name="close" size={24} color="#000" />

// After (more polished)
<Image source={require('./assets/ui/icons/ic_close.png')} style={{ width: 24, height: 24 }} />
```

### 2. Add coin displays
```typescript
// In ProfileScreen, RewardsScreen, etc.
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
  <Image source={require('./assets/ui/coins/coins_small.png')} style={{ width: 20, height: 20 }} />
  <Text style={{ marginLeft: 4 }}>1,234</Text>
</View>
```

### 3. Enhance leaderboards
```typescript
// In LeaderboardModal
{rank === 1 && (
  <Image source={require('./assets/ui/ranks/leadboard_default_1.png')} style={{ width: 32, height: 32 }} />
)}
```

### 4. Polish game loading
```typescript
// In game loading screen
<ImageBackground 
  source={require('./assets/ui/loading/default_loading_bg.png')}
  style={styles.loadingContainer}
>
  <Image source={require('./assets/ui/loading/ic_loading_images.png')} />
  <Text>Loading...</Text>
</ImageBackground>
```

## 🎨 Combine with Their Colors

Use these assets with their color palette from `LOOPS_COLORS.md`:

```typescript
import { LoopsColors } from './LOOPS_COLORS';

<View style={{ backgroundColor: LoopsColors.mainGreen }}>
  <Image source={require('./assets/ui/icons/ic_done.png')} />
</View>
```

## 📊 Asset Sizes

- Icons: 24x24 to 48x48 px
- Coins: 20x20 to 32x32 px
- Rank badges: 32x32 to 48x48 px
- Buttons: Stretchable (9-patch)
- Backgrounds: Various sizes

## 🚀 Next Steps

1. Replace generic Ionicons with their polished icons
2. Add coin displays to profile/rewards screens
3. Use rank badges in leaderboards
4. Polish game loading screen with their assets
5. Study their button styles for custom buttons

## 💡 Pro Tips

- These are production-quality assets from a successful app
- They're generic enough to not look "stolen"
- Combine with your own branding colors
- Use sparingly - don't make it look exactly like Loops
- Mix with your own custom assets for unique feel
