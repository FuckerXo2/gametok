import { createContext, useContext } from 'react';

export type TabName = 'home' | 'explore' | 'rewards' | 'connect' | 'profile';

// Deep link context - to pass a shared game ID to the games screen
export interface DeepLinkContextType {
  sharedGameId: string | null;
  clearSharedGame: () => void;
  openSharedGame: (gameId: string) => void;
}
export const DeepLinkContext = createContext<DeepLinkContextType>({
  sharedGameId: null,
  clearSharedGame: () => {},
  openSharedGame: () => {},
});
export const useDeepLink = () => useContext(DeepLinkContext);

// Auth screen context - to show login/signup from anywhere
export interface AuthScreenContextType {
  showAuthScreen: () => void;
  showLoginScreen: () => void;
  hideAuthScreen: () => void;
}
export const AuthScreenContext = createContext<AuthScreenContextType>({
  showAuthScreen: () => {},
  showLoginScreen: () => {},
  hideAuthScreen: () => {},
});
export const useAuthScreen = () => useContext(AuthScreenContext);

// Navigation context - to switch tabs from anywhere (e.g., notification taps)
export interface NavigationContextType {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  pendingChatUserId: string | null;
  setPendingChatUserId: (userId: string | null) => void;
  searchModalVisible: boolean;
  setSearchModalVisible: (visible: boolean) => void;
  activityRequestNonce: number;
}
export const NavigationContext = createContext<NavigationContextType>({
  activeTab: 'home',
  setActiveTab: () => {},
  pendingChatUserId: null,
  setPendingChatUserId: () => {},
  searchModalVisible: false,
  setSearchModalVisible: () => {},
  activityRequestNonce: 0,
});
export const useNavigation = () => useContext(NavigationContext);
