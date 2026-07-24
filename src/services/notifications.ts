// Push Notifications Service
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_URL = 'https://gametok-backend-production.up.railway.app';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Register for push notifications and get token
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log('[Notifications] Must use physical device for push notifications');
    return null;
  }

  try {
    // Android needs a channel before notifications are posted. Keeping this early
    // makes real-device Android less flaky than configuring it after token fetch.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'GameTok',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#A855F7',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    // Get push token - must pass projectId for dev/Xcode builds
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 'a8a4606e-1211-4011-ab35-08afb8194d9d';
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[Notifications] Push token:', token.data);

    return token.data;
  } catch (error) {
    console.log('[Notifications] Error registering:', error);
    return null;
  }
};

// Save push token to backend
export const savePushToken = async (token: string, authToken: string): Promise<void> => {
  try {
    await fetch(`${API_URL}/api/notifications/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pushToken: token }),
    });
    console.log('[Notifications] Token saved to backend');
  } catch (error) {
    console.log('[Notifications] Failed to save token:', error);
  }
};

// Remove push token from backend (on logout)
export const removePushToken = async (authToken: string, pushToken?: string): Promise<void> => {
  try {
    await fetch(`${API_URL}/api/notifications/unregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      // Send this device's token so only it is detached (not the user's other devices).
      body: JSON.stringify(pushToken ? { pushToken } : {}),
    });
    console.log('[Notifications] Token removed from backend');
  } catch (error) {
    console.log('[Notifications] Failed to remove token:', error);
  }
};

// Handle notification tap
export const addNotificationResponseListener = (
  callback: (notification: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

// Handle notification received while app is open
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
) => {
  return Notifications.addNotificationReceivedListener(callback);
};

// Clear all notifications
export const clearAllNotifications = async (): Promise<void> => {
  await Notifications.dismissAllNotificationsAsync();
};

// Get badge count
export const getBadgeCount = async (): Promise<number> => {
  return await Notifications.getBadgeCountAsync();
};

// Set badge count
export const setBadgeCount = async (count: number): Promise<void> => {
  await Notifications.setBadgeCountAsync(count);
};

export const scheduleCookingNotification = async (jobId: string, prompt?: string): Promise<string | null> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const shortPrompt = (prompt || 'your game').trim().slice(0, 64);
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Cooking your game',
        body: `"${shortPrompt}" is assembling in the background.`,
        data: { type: 'creation', action: 'game_cooking', jobId },
      },
      trigger: Platform.OS === 'android' ? ({ seconds: 1, channelId: 'default' } as any) : null,
    });
  } catch (error) {
    console.log('[Notifications] Failed to schedule cooking notification:', error);
    return null;
  }
};

export const scheduleGameReadyNotification = async (draftId: string, title?: string): Promise<string | null> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const gameTitle = (title || 'Your game').trim().slice(0, 64);
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Game ready',
        body: `${gameTitle} is done cooking. Tap to open the forge.`,
        data: { type: 'creation', action: 'game_ready', draftId },
        sound: 'default',
      },
      trigger: Platform.OS === 'android' ? ({ seconds: 1, channelId: 'default' } as any) : null,
    });
  } catch (error) {
    console.log('[Notifications] Failed to schedule ready notification:', error);
    return null;
  }
};

export const cancelLocalNotification = async (notificationId: string | null): Promise<void> => {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (error) {
    console.log('[Notifications] Failed to cancel local notification:', error);
  }
};
