import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { auth, getToken } from '../services/api';

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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = await getToken();
      if (token) {
        const data = await auth.me();
        setUser(data.user);
      }
    } catch (e) {
      setUser(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      await refreshUser();
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await auth.login(username, password);
    setUser(data.user);
  };

  const signup = async (username: string, password: string, displayName?: string) => {
    const data = await auth.signup(username, password, displayName);
    setUser(data.user);
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
  };

  const loginWithGoogle = async () => {
    // For now, show coming soon - full implementation needs Google Cloud Console setup
    Alert.alert(
      'Coming Soon',
      'Google Sign-In requires additional setup. Use username/password for now.',
      [{ text: 'OK' }]
    );
    // TODO: Implement with @react-native-google-signin/google-signin
    // 1. Configure in Google Cloud Console
    // 2. Add iOS/Android client IDs to app.json
    // 3. Call GoogleSignin.signIn() and send token to backend
  };

  const loginWithApple = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Error', 'Apple Sign-In is only available on iOS');
      return;
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Create user from Apple credential
      const appleUsername = `apple_${credential.user.substring(0, 8)}`;
      const displayName = credential.fullName?.givenName 
        ? `${credential.fullName.givenName} ${credential.fullName.familyName || ''}`.trim()
        : 'Apple User';

      // Try to login, if fails create account
      try {
        const data = await auth.login(appleUsername, credential.user);
        setUser(data.user);
      } catch {
        // User doesn't exist, create account
        const data = await auth.signup(appleUsername, credential.user, displayName);
        setUser(data.user);
      }
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled, don't show error
        return;
      }
      throw e;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      refreshUser,
      loginWithGoogle,
      loginWithApple,
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
