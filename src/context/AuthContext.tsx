import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, getToken } from '../services/api';
import { registerForPushNotifications, savePushToken, removePushToken } from '../services/notifications';

interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string;
  followers: string[];
  following: string[];
  totalScore: number;
  gamesPlayed: number;
  verified?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, displayName?: string, email?: string) => Promise<void>;
  loginWithOAuth: (provider: 'apple' | 'google', data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = await getToken();
    console.log('[Auth] Checking stored token:', token ? 'exists' : 'none');

    // Immediately restore cached user to prevent "flickering" logout on slow connections
    const cachedUser = await AsyncStorage.getItem('authUser');
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch (e) {
        console.error('[Auth] Failed to parse cached user:', e);
      }
    }

    if (!token) {
      console.log('[Auth] No token stored');
      setUser(null);
      await AsyncStorage.removeItem('authUser');
      return;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const data = await auth.me();
        console.log('[Auth] Token valid, user:', data.user?.username);
        setUser(data.user);
        await AsyncStorage.setItem('authUser', JSON.stringify(data.user));
        return; // Success — done
      } catch (e: any) {
        const status = e?.status || e?.response?.status;
        if (status === 401 || status === 403) {
          // Token is genuinely invalid — this is the only case we should log out
          console.log('[Auth] Token rejected by server (', status, '), logging out');
          await auth.logout();
          setUser(null);
          await AsyncStorage.removeItem('authUser');
          return;
        }
        // Network error, server error, timeout — retry
        console.log(`[Auth] Attempt ${attempt}/3 failed (${e.message}), ${attempt < 3 ? 'retrying...' : 'giving up but keeping session'}`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1500));
        }
      }
    }
    // All 3 retries failed with non-auth errors — keep the token, don't log out
    console.log('[Auth] All retries failed but token preserved — user stays logged in');
  };

  useEffect(() => {
    const init = async () => {
      await refreshUser();
      setIsLoading(false);

      // Prompt ALL users for push notifications (not just logged-in users).
      // This lets us re-engage users who haven't signed up yet.
      // Delay slightly so the app feels loaded before the system prompt appears.
      setTimeout(async () => {
        const pushToken = await registerForPushNotifications();
        if (pushToken) {
          // Store token locally so we can send it to backend when they sign up later
          await AsyncStorage.setItem('pushToken', pushToken);

          // If user is already authenticated, save to backend with auth
          const authToken = await getToken();
          if (authToken) {
            await savePushToken(pushToken, authToken);
          } else {
            // Not logged in — register as anonymous so backend can send re-engagement
            try {
              await fetch('https://gametok-backend-production.up.railway.app/api/notifications/register-anonymous', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pushToken }),
              });
            } catch (e) {
              console.log('[Notifications] Failed to register anonymous token:', e);
            }
          }
        }
      }, 2000);
    };
    init();
  }, []);

  const login = async (username: string, password: string) => {
    console.log('[Auth] Logging in:', username);
    const data = await auth.login(username, password);
    console.log('[Auth] Login successful, token saved');
    setUser(data.user);
    await AsyncStorage.setItem('authUser', JSON.stringify(data.user));

    // Send push token to backend (may have been collected before sign-in)
    const pushToken = await AsyncStorage.getItem('pushToken') || await registerForPushNotifications();
    if (pushToken) {
      await AsyncStorage.setItem('pushToken', pushToken);
      const authToken = await getToken();
      if (authToken) {
        await savePushToken(pushToken, authToken);
      }
    }
  };

  const signup = async (username: string, password: string, displayName?: string, email?: string) => {
    console.log('[Auth] Signing up:', username);
    const data = await auth.signup(username, password, displayName, email);
    console.log('[Auth] Signup successful, token saved');
    setUser(data.user);
    await AsyncStorage.setItem('authUser', JSON.stringify(data.user));

    // Send push token to backend (may have been collected before sign-up)
    const pushToken = await AsyncStorage.getItem('pushToken') || await registerForPushNotifications();
    if (pushToken) {
      await AsyncStorage.setItem('pushToken', pushToken);
      const authToken = await getToken();
      if (authToken) {
        await savePushToken(pushToken, authToken);
      }
    }
  };

  const loginWithOAuth = async (provider: 'apple' | 'google', oauthData: any) => {
    console.log('[Auth] OAuth login with:', provider);
    const data = await auth.oauth(provider, oauthData);
    console.log('[Auth] OAuth successful, token saved');
    setUser(data.user);
    await AsyncStorage.setItem('authUser', JSON.stringify(data.user));

    // Send push token to backend (may have been collected before OAuth)
    const pushToken = await AsyncStorage.getItem('pushToken') || await registerForPushNotifications();
    if (pushToken) {
      await AsyncStorage.setItem('pushToken', pushToken);
      const authToken = await getToken();
      if (authToken) {
        await savePushToken(pushToken, authToken);
      }
    }

    return data;
  };

  const logout = async () => {
    // Remove this device's push token from backend so it stops receiving
    // notifications for the account being logged out of.
    const authToken = await getToken();
    if (authToken) {
      const pushToken = await AsyncStorage.getItem('pushToken');
      await removePushToken(authToken, pushToken || undefined);
    }

    await auth.logout();
    await AsyncStorage.removeItem('authUser');
    // Clear onboarding flag to show welcome screen again
    await AsyncStorage.removeItem('hasSeenOnboarding');
    await AsyncStorage.removeItem('hasLaunchedBefore');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      loginWithOAuth,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
