# Push Notifications Setup Guide

## What We Built

Complete push notification system with 4 types:
1. **Social** - Likes, comments, follows, messages, score beaten
2. **Engagement** - New games, streaks, leaderboard, daily challenges  
3. **Re-engagement** - Inactive users, daily rewards, friends playing
4. **FOMO** - Limited events, double XP, trending games, friend achievements

## Installation Steps

### 1. Install Frontend Packages

```bash
cd gametok
npx expo install expo-notifications expo-device
```

### 2. Install Backend Package

```bash
cd gametok-backend
npm install
```

### 3. Add EAS Project ID

In `gametok/app.json`, add:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    }
  }
}
```

Get your project ID from: https://expo.dev

### 4. Configure iOS (for production)

In `gametok/app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#FF8E53",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ]
  }
}
```

### 5. Prebuild

```bash
cd gametok
npx expo prebuild --clean
```

## How It Works

### Frontend Flow

1. User logs in/signs up
2. App requests notification permission
3. Gets Expo push token
4. Sends token to backend
5. Backend stores token in database
6. Listens for notifications

### Backend Flow

1. User action triggers notification (like, comment, etc.)
2. Backend looks up recipient's push tokens
3. Sends notification via Expo Push API
4. User receives notification
5. Tapping notification opens relevant screen

## Notification Types Implemented

### 1. Social Notifications (Automatic)

```javascript
// Already integrated in backend:
- notifyLike() - When someone likes your game
- notifyComment() - When someone comments
- notifyFollow() - When someone follows you
- notifyMessage() - When you get a message
- notifyScoreBeaten() - When someone beats your score
```

### 2. Engagement Notifications (Manual/Scheduled)

```javascript
// Call these from admin panel or cron jobs:
- notifyNewGames(userIds, gameCount)
- notifyStreak(userId, streakDays)
- notifyLeaderboardPosition(userId, gameId, position)
- notifyDailyChallenge(userIds, description)
```

### 3. Re-engagement Notifications (Scheduled)

```javascript
// Set up cron jobs for these:
- sendDailyInactiveNotifications() // 9 AM daily
- sendDailyRewardNotifications() // 10 AM daily
- sendFriendsPlayingNotifications() // Every hour
```

### 4. FOMO Notifications (Event-based)

```javascript
// Trigger during special events:
- notifyLimitedTimeEvent(userIds, eventName, hoursLeft)
- notifyDoubleXP(userIds, minutesLeft)
- notifyTrendingGame(userIds, gameName, playerCount)
- notifyFriendAchievement(userId, friendName, achievement)
```

## Testing

### Test on Device

1. Build and install app on physical device
2. Log in
3. Grant notification permission
4. Call test endpoint:

```bash
curl -X POST https://your-backend.com/api/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Test Locally

```javascript
// In your app, after login:
import { scheduleLocalNotification } from './src/services/notifications';

scheduleLocalNotification(
  '🎮 Test',
  'Local notification works!',
  { type: 'test' },
  5 // seconds
);
```

## Setting Up Cron Jobs

Use a service like:
- **Railway Cron** (if using Railway)
- **Heroku Scheduler**
- **AWS EventBridge**
- **Vercel Cron**

Example cron schedule:

```javascript
// Daily at 9 AM - Inactive users
0 9 * * * /api/cron/inactive-users

// Daily at 10 AM - Daily rewards
0 10 * * * /api/cron/daily-rewards

// Every hour - Friends playing
0 * * * * /api/cron/friends-playing
```

## Best Practices

1. **Don't spam** - Max 3-5 notifications per day per user
2. **Personalize** - Use user's name, game names, etc.
3. **Time zones** - Send at appropriate times (9 AM-9 PM local time)
4. **A/B test** - Try different messages to see what works
5. **Unsubscribe** - Let users control notification types
6. **Track metrics** - Monitor open rates, conversion rates

## Notification Metrics to Track

- **Delivery rate** - % of notifications delivered
- **Open rate** - % of notifications tapped
- **Conversion rate** - % that led to desired action
- **Opt-out rate** - % of users disabling notifications
- **Best times** - When users engage most

## Next Steps

1. Install packages
2. Add EAS project ID
3. Prebuild and test
4. Set up cron jobs for scheduled notifications
5. Monitor metrics and optimize

## Troubleshooting

**Notifications not received:**
- Check device has internet
- Verify push token was saved to backend
- Check Expo push notification status: https://expo.dev/notifications
- Ensure app has notification permission

**Token not saving:**
- Check authorization header is correct
- Verify backend endpoint is reachable
- Check database has push_tokens table

**iOS not working:**
- Ensure you're using physical device (not simulator)
- Check Info.plist has UIBackgroundModes
- Verify Apple Push Notification service is enabled in Xcode

## Files Created/Modified

### Frontend
- `gametok/src/services/notifications.ts` - Notification service
- `gametok/src/context/AuthContext.tsx` - Auto-register on login
- `gametok/App.tsx` - Notification listeners

### Backend
- `gametok-backend/src/notifications.js` - All notification functions
- `gametok-backend/src/db.js` - Push token database methods
- `gametok-backend/src/index.js` - API endpoints
- `gametok-backend/package.json` - Added expo-server-sdk

Done! 🎉
