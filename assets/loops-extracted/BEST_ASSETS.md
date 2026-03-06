# 🎨 Best Assets to Use from Loops App

## 🎮 Game Loading Screen Assets

### Loading Backgrounds
- `drawable-hdpi/default_loading_bg.png` - Clean loading background
- `layouts/layout_game_loading.xml` - Their game loading layout structure

### Loading Animations
- `animations/anim/dj_round_loading.xml` - Spinning loader animation
- `drawable-hdpi/ic_loading_images.png` - Loading icon

### Progress Indicators
- `drawable-xml/progress_horizontal_green.xml` - Green progress bar
- `layouts/loading_bar_layout.xml` - Progress bar layout

## 🎁 Rewards & Coins

### Coin Icons
- `drawable-hdpi/coins_small.png` - Small coin icon
- `drawable-xhdpi/coins_small_1.png` - HD coin icon
- `drawable/profile_coins_icon.png` - Profile coin display

### Coin Backgrounds
- `drawable-xml/bg_coins_extra.xml` - Coin bonus background
- `drawable-xml/dialog_coins_background.xml` - Coin dialog background
- `drawable-xml/item_coin_background.xml` - Coin item background

### Diamond Icons
- `drawable-hdpi/diamond_supporters.png`
- `drawable-hdpi/diamond_topfans.png`

## 🏆 Leaderboard & Rankings

### Rank Badges
- `drawable-hdpi/leaderboard_number_01.png` - #1 badge
- `drawable-hdpi/leadboard_default_1.png` - 1st place
- `drawable-hdpi/leadboard_default_2.png` - 2nd place
- `drawable-hdpi/leadboard_default_3.png` - 3rd place

### Top Fans
- `drawable-hdpi/ic_topfans_1.png`
- `drawable-hdpi/ic_topfans_2.png`
- `drawable-hdpi/ic_topfans_3.png`

### Backgrounds
- `drawable-hdpi/bg_leaderboard.png` - Leaderboard background
- `drawable-hdpi/bg_topfans_1.png` - Top fan #1 background

## 🎨 UI Elements

### Buttons
- `drawable-hdpi/bt_new_m_normal.9.png` - Medium button (normal)
- `drawable-hdpi/bt_new_m_pressed.9.png` - Medium button (pressed)
- `drawable-hdpi/bt_new_m_disable.9.png` - Medium button (disabled)
- `drawable-xml/button_select_bg.xml` - Button selector

### Backgrounds
- `drawable-xml/bg_common_dialog.xml` - Dialog background
- `drawable-xml/bg_common_white.xml` - White background
- `drawable-xml/bg_common_white_16.xml` - White with 16dp radius
- `drawable-xml/bg_common_black_32.xml` - Black with 32dp radius
- `drawable-xml/bg_round_white_select_dialog.xml` - Rounded dialog

### Shapes & Borders
- `drawable-xml/shape_circle.xml` - Circle shape
- `drawable-xml/shape_circle_white.xml` - White circle
- `drawable-xml/rounded_corners_white_dialog.xml` - Rounded corners

## 🎯 Icons (Generic - Safe to Use)

### Navigation
- `drawable-hdpi/ic_back.png` - Back arrow
- `drawable-hdpi/ic_arrow_left_grey.png` - Left arrow
- `drawable-hdpi/ic_arrow_down.png` - Down arrow
- `drawable-hdpi/ic_arrow_up.png` - Up arrow

### Actions
- `drawable-hdpi/ic_close.png` - Close button
- `drawable-hdpi/ic_done.png` - Done/checkmark
- `drawable-hdpi/ic_search.png` - Search icon
- `drawable-hdpi/ic_clear.png` - Clear/X icon

### Social
- `drawable-hdpi/ic_profile_chat.png` - Chat icon
- `drawable-hdpi/ic_profile_gift.png` - Gift icon
- `drawable-hdpi/ic_share_more.png` - Share icon

### Game
- `drawable-hdpi/ic_game_lock.png` - Locked game
- `drawable-hdpi/ic_game_mute.png` - Mute icon

## 🎭 Animations

### Loading
- `animations/anim/dj_round_loading.xml` - Spinning loader
- `animations/anim/arrow_animation_01.xml` - Arrow animation frame 1
- `animations/anim/arrow_animation_02.xml` - Arrow animation frame 2
- `animations/anim/arrow_animation_03.xml` - Arrow animation frame 3

### Alarms/Notifications
- `drawable-hdpi/anim_alarm.webp` - Alarm animation
- `drawable-hdpi/anim_alarm3.webp` - Alarm animation variant

## 🎨 Colors & Gradients

### Color Definitions
- `colors/color/colors.xml` - All color definitions
- `colors/color-night/colors.xml` - Dark mode colors

### Gradients
- `drawable-xml/bg_guide_next.xml` - Next button gradient
- `drawable-xml/bg_guide_sign_in.xml` - Sign in button gradient
- `drawable-xml/selector_shape_green_r40.xml` - Green gradient selector

## 📐 Layouts to Study

### Onboarding
- `layouts/layout_guide.xml` - Main onboarding layout
- `layouts/layout_init_hobby.xml` - Game preference selection

### Game
- `layouts/layout_game_loading.xml` - Game loading screen
- `layouts/layout_game_info.xml` - Game info display

### Dialogs
- `layouts/dialog_common.xml` - Common dialog
- `layouts/dialog_reward.xml` - Reward dialog
- `layouts/dialog_coins.xml` - Coins dialog

### Profile
- `layouts/layout_profile.xml` - Profile screen
- `layouts/layout_profile_edit.xml` - Edit profile

## 🚫 DO NOT USE (Branding)

- `logo_loopsfont.png` - Their logo
- `loops_*.png` - Loops branded assets
- `lobah_*.png` - Lobah branded assets
- `bg_login.png` - Their login background (has branding)

## 💡 How to Use These Assets

### 1. Copy to your project
```bash
# Copy specific asset
cp gametok/assets/loops-extracted/drawable-hdpi/coins_small.png gametok/assets/

# Copy multiple assets
cp gametok/assets/loops-extracted/drawable-hdpi/ic_*.png gametok/assets/icons/
```

### 2. Convert XML to React Native
Their XML drawables need to be converted:
- Shapes → StyleSheet with borderRadius, backgroundColor
- Gradients → LinearGradient component
- Selectors → State-based styling

### 3. Use as reference
Study their layouts to understand:
- Component hierarchy
- Spacing and sizing
- Color combinations
- Animation timing

## 📊 Asset Statistics

- Total extracted: 3,729 files
- Size: 45MB
- Image formats: PNG, JPG, WEBP
- Vector formats: XML (Android drawables)
- Layouts: 511 XML files
- Animations: 144 files
- Fonts: 14 files

## 🔍 Quick Search Commands

```bash
# Find all button assets
find gametok/assets/loops-extracted -name 'bt_*' -o -name 'button_*'

# Find all backgrounds
find gametok/assets/loops-extracted -name 'bg_*'

# Find all icons
find gametok/assets/loops-extracted -name 'ic_*'

# Find loading assets
find gametok/assets/loops-extracted -name '*loading*'

# Find coin assets
find gametok/assets/loops-extracted -name '*coin*'

# Find reward assets
find gametok/assets/loops-extracted -name '*reward*'
```

## 🎯 Priority Assets for Phase 1

For implementing Phase 1 visual polish, focus on:

1. **Game Loading**: `default_loading_bg.png`, `layout_game_loading.xml`
2. **Rewards**: `coins_small.png`, `dialog_coins_background.xml`
3. **Buttons**: `bt_new_m_*.png` series
4. **Backgrounds**: `bg_common_*.xml` series
5. **Icons**: `ic_done.png`, `ic_close.png`, `ic_arrow_*.png`

