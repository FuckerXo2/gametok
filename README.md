# SwipePlay 🎮

TikTok for games. Swipe up, new game. Instant dopamine.

## Run it

```bash
cd swipeplay
npx expo start
```

Then scan the QR code with Expo Go app on your phone.

## Games included

- 🔄 **Gravity Flip** - Tap to flip gravity, dodge obstacles
- 🏗️ **Stack Tower** - Time your drops perfectly  
- 🎨 **Color Match** - Fast-paced color reaction
- 🌙 **Orbit** - Keep the ball orbiting, collect stars

## Features

- Vertical swipe feed (TikTok-style)
- Juicy animations & particle effects
- Haptic feedback
- Like & share games
- Score tracking

## Adding new games

1. Create game HTML in `src/games/YourGame.ts`
2. Add to `gameRegistry.ts`
3. Import in `GameFeed.tsx`
