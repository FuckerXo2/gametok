# Loops Animations & Fonts

## Extracted Animations (WebP)

Located in: `gametok/assets/animations/`

### Swipe/Click Effects
1. **ic_swipe_click_effect.webp** (167KB)
   - Click/tap visual effect animation
   - Use for: User tap feedback on games/buttons

2. **ic_swipe_click_tap_play.webp** (64KB)
   - Tap to play animation
   - Use for: Game start prompts

3. **ic_swipe_guide_swipe.webp** (0KB - empty file)
   - Swipe gesture guide
   - Note: File is empty, may need to re-extract

### Guide/Tutorial Animations
4. **ani_swipe_guide_exit.webp** (98KB)
   - Exit/dismiss animation for swipe guide
   - Use for: Tutorial dismissal

5. **ic_swipe_game_anim.webp** (67KB)
   - Game swipe animation
   - Use for: Swipe-to-next-game transitions

### Spin Wheel Animations
6. **ic_home_spin_anim_new.webp** (983KB - largest file)
   - New user spin wheel animation
   - Use for: Daily spin wheel feature

7. **ic_spin_fireworks_loop.webp** (163KB)
   - Fireworks celebration loop
   - Use for: Reward celebrations, big wins

## Extracted Fonts

Located in: `gametok/assets/fonts/`

### Graphik Arabic Font Family
1. **graphik_arabic.otf** (200KB) - Regular
2. **graphik_arabic_bold.otf** (214KB) - Bold
3. **graphik_arabic_medium.otf** (213KB) - Medium
4. **graphik_arabic_semibold.otf** (213KB) - Semi-Bold

**Why Graphik Arabic?**
- Modern, clean sans-serif
- Excellent readability at all sizes
- Supports both Latin and Arabic scripts
- Used throughout Loops app for consistency
- Professional appearance

## How to Use in React Native

### 1. Configure Fonts in app.json

```json
{
  "expo": {
    "plugins": [
      [
        "expo-font",
        {
          "fonts": [
            "./assets/fonts/graphik_arabic.otf",
            "./assets/fonts/graphik_arabic_bold.otf",
            "./assets/fonts/graphik_arabic_medium.otf",
            "./assets/fonts/graphik_arabic_semibold.otf"
          ]
        }
      ]
    ]
  }
}
```

### 2. Load Fonts in App

```typescript
import { useFonts } from 'expo-font';

export default function App() {
  const [fontsLoaded] = useFonts({
    'Graphik-Regular': require('./assets/fonts/graphik_arabic.otf'),
    'Graphik-Bold': require('./assets/fonts/graphik_arabic_bold.otf'),
    'Graphik-Medium': require('./assets/fonts/graphik_arabic_medium.otf'),
    'Graphik-SemiBold': require('./assets/fonts/graphik_arabic_semibold.otf'),
  });

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  return <YourApp />;
}
```

### 3. Use in Styles

```typescript
const styles = StyleSheet.create({
  title: {
    fontFamily: 'Graphik-Bold',
    fontSize: 24,
  },
  body: {
    fontFamily: 'Graphik-Regular',
    fontSize: 16,
  },
  subtitle: {
    fontFamily: 'Graphik-SemiBold',
    fontSize: 18,
  },
});
```

### 4. Use WebP Animations

```typescript
import { Image } from 'expo-image';

// Click effect
<Image
  source={require('./assets/animations/ic_swipe_click_effect.webp')}
  style={{ width: 100, height: 100 }}
  contentFit="contain"
/>

// Spin wheel animation
<Image
  source={require('./assets/animations/ic_home_spin_anim_new.webp')}
  style={{ width: 200, height: 200 }}
  contentFit="contain"
/>

// Fireworks celebration
<Image
  source={require('./assets/animations/ic_spin_fireworks_loop.webp')}
  style={StyleSheet.absoluteFill}
  contentFit="cover"
/>
```

## Animation Use Cases

### Click Effect (`ic_swipe_click_effect.webp`)
- Show on game thumbnail tap
- Button press feedback
- Interactive element highlights

### Tap to Play (`ic_swipe_click_tap_play.webp`)
- Game start prompt overlay
- "Tap anywhere to begin" indicators

### Spin Wheel (`ic_home_spin_anim_new.webp`)
- Daily reward spin animation
- Wheel spinning effect
- Prize selection visual

### Fireworks (`ic_spin_fireworks_loop.webp`)
- Big win celebrations
- Achievement unlocks
- Level up effects
- Reward claim success

### Swipe Guide (`ani_swipe_guide_exit.webp`)
- Tutorial dismissal
- Onboarding completion
- Guide exit transitions

## Additional Animation Files Available

From `gametok/assets/loops-extracted/animations/anim/`:

### Custom Loops Animations
- `dj_round_loading.xml` - Spinning loader
- `anim_rotate.xml` - Rotation animation
- `anim_popup_in.xml` / `anim_popup_out.xml` - Popup transitions
- `anim_follow_btn.xml` - Follow button animation
- `anim_nav_item.xml` - Navigation item transitions

### Dialog Animations
- `dialog_enter.xml` / `dialog_exit.xml` - Dialog transitions
- `bottom_in.xml` / `bottom_out.xml` - Bottom sheet animations
- `fade_in.xml` / `fade_out.xml` - Fade transitions

### Slide Animations
- `slide_in_bottom.xml` / `slide_out_bottom.xml`
- `push_left_in.xml` / `push_left_out.xml`
- `push_right_in.xml` / `push_right_out.xml`

## Font Weight Mapping

| Weight | File | Use Case |
|--------|------|----------|
| 400 (Regular) | graphik_arabic.otf | Body text, descriptions |
| 500 (Medium) | graphik_arabic_medium.otf | Subheadings, labels |
| 600 (SemiBold) | graphik_arabic_semibold.otf | Buttons, emphasis |
| 700 (Bold) | graphik_arabic_bold.otf | Titles, headers |

## Next Steps

1. ✅ Fonts extracted and ready
2. ✅ Key animations extracted
3. ⏳ Configure fonts in app.json
4. ⏳ Load fonts in App.tsx
5. ⏳ Update LoopsColors.ts to include font family constants
6. ⏳ Apply fonts to existing components
7. ⏳ Integrate click effects in HomeScreen
8. ⏳ Add spin wheel animation to rewards
9. ⏳ Add fireworks to celebration moments

## Notes

- WebP format is well-supported in React Native via expo-image
- Graphik Arabic works for both LTR and RTL layouts
- All animations are optimized (under 1MB each)
- Font files are reasonable size (~200KB each)
