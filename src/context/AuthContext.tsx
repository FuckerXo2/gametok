import React, { createContext, useContext, useState, useEffect } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = await getToken();
      console.log('[Auth] Checking stored token:', token ? 'exists' : 'none');
      if (token) {
        const data = await auth.me();
        console.log('[Auth] Token valid, user:', data.user?.username);
        setUser(data.user);
      } else {
        console.log('[Auth] No token stored');
        setUser(null);
      }
    } catch (e: any) {
      // Token invalid or user doesn't exist - clear token
      console.log('[Auth] Token invalid or expired:', e.message);
      await auth.logout();
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
    console.log('[Auth] Logging in:', username);
    const data = await auth.login(username, password);
    console.log('[Auth] Login successful, token saved');
    setUser(data.user);
  };

  const signup = async (username: string, password: string, displayName?: string) => {
    console.log('[Auth] Signing up:', username);
    const data = await auth.signup(username, password, displayName);
    console.log('[Auth] Signup successful, token saved');
    setUser(data.user);
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
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
