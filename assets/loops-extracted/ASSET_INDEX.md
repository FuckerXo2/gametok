# Loops App - Extracted Assets

This directory contains all extracted assets from the Loops app (com.rings.lobahplay).

## 📁 Directory Structure

- `drawable/` - Default density images
- `drawable-hdpi/` - High density images (240dpi)
- `drawable-mdpi/` - Medium density images (160dpi)
- `drawable-xhdpi/` - Extra high density images (320dpi)
- `drawable-xxhdpi/` - Extra extra high density images (480dpi)
- `drawable-xxxhdpi/` - Extra extra extra high density images (640dpi)
- `drawable-xml/` - Vector graphics, shapes, gradients (XML)
- `layouts/` - UI layout files
- `colors/` - Color definitions
- `values/` - Strings, dimensions, styles (multiple languages)
- `animations/` - Animation definitions
- `fonts/` - Font files
- `raw/` - Raw assets (audio, video, etc.)

## 🎨 Asset Categories

### UI Elements
- Buttons: `bt_*.png`, `button_*.png`
- Backgrounds: `bg_*.png`
- Icons: `ic_*.png`, `icon_*.png`
- Shapes: `shape_*.xml`

### Game Assets
- Game icons: `ic_game_*.png`
- Loading screens: `*loading*.png`
- Progress bars: `progress_*.png`

### Social Features
- Profile elements: `profile_*.png`, `ic_profile_*.png`
- Chat/messaging: `ic_messages_*.png`, `chat_*.png`
- Live streaming: `ic_live_*.png`, `bt_live_*.png`

### Rewards & Gamification
- Coins: `coins_*.png`, `ic_coin*.png`
- Diamonds: `diamond_*.png`, `ic_diamond*.png`
- Leaderboard: `leaderboard_*.png`, `ic_topfans_*.png`
- Gifts: `ic_gift_*.png`, `gift_*.png`

### Branding (DO NOT USE)
- Logo files: `logo_*.png`
- Branded elements: `loops_*.png`, `lobah_*.png`

## ⚖️ Legal Notes

These assets are extracted for reference and inspiration only. 

**Safe to use:**
- Generic UI patterns (buttons, backgrounds, shapes)
- Common icons (arrows, checkmarks, close buttons)
- Color schemes and gradients
- Layout patterns and structures

**DO NOT use:**
- Their logo or branding
- Unique character designs
- Copyrighted images
- Photos of real people

## 🔍 Finding Assets

Use grep to find specific assets:
```bash
# Find all coin-related assets
find . -name "*coin*"

# Find all button assets
find . -name "bt_*" -o -name "button_*"

# Find all backgrounds
find . -name "bg_*"
```

## 📊 Statistics

- Total files extracted: 3729
- Total size:  45M
- Extraction date: Wed Mar  4 18:33:07 WAT 2026
