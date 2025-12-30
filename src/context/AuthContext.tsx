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
