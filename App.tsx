import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Linking, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Audio } from 'expo-av';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { HomeScreen } from './src/screens/HomeScreen';
import { BottomNav } from './src/components/BottomNav';
import { ConnectScreen } from './src/components/ConnectScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { ExploreScreen } from './src/components/ExploreScreen';
import { OnboardingFlow } from './src/components/OnboardingFlow';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { CreateScreen } from './src/screens/CreateScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';

import { addNotificationResponseListener, addNotificationReceivedListener, registerForPushNotifications, savePushToken } from './src/services/notifications';
import { getToken } from './src/services/api';
import { startGameDownload } from './src/services/gameDownloader';

// Prevent native splash from auto-hiding
SplashScreen.preventAutoHideAsync();


// Deep link context - to pass shared game ID to HomeScreen
interface DeepLinkContextType {
  sharedGameId: string | null;
  clearSharedGame: () => void;
  openSharedGame: (gameId: string) => void;
}
const DeepLinkContext = createContext<DeepLinkContextType>({ sharedGameId: null, clearSharedGame: () => { }, openSharedGame: () => { } });
export const useDeepLink = () => useContext(DeepLinkContext);

// Auth screen context - to show login/signup from anywhere
interface AuthScreenContextType {
  showAuthScreen: () => void;
  showLoginScreen: () => void;
  hideAuthScreen: () => void;
}
const AuthScreenContext = createContext<AuthScreenContextType>({ showAuthScreen: () => { }, showLoginScreen: () => { }, hideAuthScreen: () => { } });
export const useAuthScreen = () => useContext(AuthScreenContext);

// Navigation context - to switch tabs from anywhere (e.g., notification taps)
interface NavigationContextType {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
  pendingChatUserId: string | null;
  setPendingChatUserId: (userId: string | null) => void;
  searchModalVisible: boolean;
  setSearchModalVisible: (visible: boolean) => void;
  isGameDeckActive: boolean;
  setIsGameDeckActive: (active: boolean) => void;
  isHudHidden: boolean;
  setIsHudHidden: (hidden: boolean) => void;
  gameRestartTrigger: number;
  triggerGameRestart: () => void;
  gameSkipCounter: { direction: 'next' | 'prev', count: number };
  triggerGameSkip: (direction: 'next' | 'prev') => void;
  pendingDraftId: string | null;
  setPendingDraftId: (id: string | null) => void;
  activityRequestNonce: number;
}
const NavigationContext = createContext<NavigationContextType>({
  activeTab: 'home', 
  setActiveTab: () => {}, 
  pendingChatUserId: null,
  setPendingChatUserId: () => {},
  searchModalVisible: false,
  setSearchModalVisible: () => {},
  isGameDeckActive: false,
  setIsGameDeckActive: () => {},
  isHudHidden: false,
  setIsHudHidden: () => {},
  gameRestartTrigger: 0,
  triggerGameRestart: () => {},
  gameSkipCounter: { direction: 'next', count: 0 },
  triggerGameSkip: () => {},
  pendingDraftId: null,
  setPendingDraftId: () => {},
  activityRequestNonce: 0
});
export const useNavigation = () => useContext(NavigationContext);

type TabName = 'home' | 'explore' | 'rewards' | 'connect' | 'profile' | 'create';

const MainApp = ({
  openCreateNonce = 0,
  notifChatUserId = null,
  onNotifChatHandled,
  notifActivityNonce = 0,
}: {
  openCreateNonce?: number;
  notifChatUserId?: string | null;
  onNotifChatHandled?: () => void;
  notifActivityNonce?: number;
}) => {
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [previousTab, setPreviousTab] = useState<TabName>('home');
  const [homeRefreshTrigger, setHomeRefreshTrigger] = useState(0);
  const [pendingChatUserId, setPendingChatUserId] = useState<string | null>(null);
  const [activityRequestNonce, setActivityRequestNonce] = useState(0);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [isGameDeckActive, setIsGameDeckActive] = useState(false);
  const [isHudHidden, setIsHudHidden] = useState(false);
  const [gameRestartTrigger, setGameRestartTrigger] = useState(0);
  const [gameSkipCounter, setGameSkipCounter] = useState<{ direction: 'next' | 'prev', count: number }>({ direction: 'next', count: 0 });
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const { isDark, colors } = useTheme();

  const handleTabPress = (tab: TabName) => {
    if (tab === 'home' && activeTab === 'home') {
      // Already on home — trigger refresh
      setHomeRefreshTrigger(prev => prev + 1);
    }
    
    // Remember where we came from so the modal can slide back flawlessly
    if (tab !== 'create') {
      setPreviousTab(tab);
    }
    
    setActiveTab(tab);
    // Reset game deck when switching tabs manually
    if (tab === 'home') {
      setIsGameDeckActive(true);
    } else {
      setIsGameDeckActive(false);
      setIsHudHidden(false); // Reset HUD when leaving home
    }
  };

  const triggerGameRestart = () => {
    setGameRestartTrigger(prev => prev + 1);
  };

  const triggerGameSkip = (direction: 'next' | 'prev') => {
    setGameSkipCounter(prev => ({ direction, count: prev.count + 1 }));
  };

  useEffect(() => {
    if (!openCreateNonce) return;
    if (activeTab !== 'create') {
      setPreviousTab(activeTab);
    }
    setIsGameDeckActive(false);
    setIsHudHidden(false);
    setActiveTab('create');
  }, [openCreateNonce]);

  // Notification tap → open the Connect tab straight into the sender's DM.
  useEffect(() => {
    if (!notifChatUserId) return;
    setActiveTab('connect');
    setPendingChatUserId(notifChatUserId);
    onNotifChatHandled?.();
  }, [notifChatUserId]);

  // Follow / social notification tap → open the Connect tab's Activity feed.
  useEffect(() => {
    if (!notifActivityNonce) return;
    setActiveTab('connect');
    setActivityRequestNonce((n) => n + 1);
  }, [notifActivityNonce]);

  // Keep all screens mounted, just hide/show them
  return (
    <NavigationContext.Provider value={{ 
      activeTab, 
      setActiveTab, 
      pendingChatUserId, 
      setPendingChatUserId, 
      searchModalVisible, 
      setSearchModalVisible,
      isGameDeckActive,
      setIsGameDeckActive,
      isHudHidden,
      setIsHudHidden,
      gameRestartTrigger,
      triggerGameRestart,
      gameSkipCounter,
      triggerGameSkip,
      pendingDraftId,
      setPendingDraftId,
      activityRequestNonce
    }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Home - always mounted */}
        <View style={[styles.screenContainer, { opacity: activeTab === 'home' ? 1 : 0, zIndex: activeTab === 'home' ? 1 : 0 }]} pointerEvents={activeTab === 'home' ? 'auto' : 'none'}>
          <HomeScreen isActive={activeTab === 'home'} refreshTrigger={homeRefreshTrigger} />
        </View>

        {/* Explore (game discovery) - always mounted */}
        <View style={[styles.screenContainer, { opacity: activeTab === 'explore' ? 1 : 0, zIndex: activeTab === 'explore' ? 1 : 0 }]} pointerEvents={activeTab === 'explore' ? 'auto' : 'none'}>
          <ExploreScreen />
        </View>

        {/* Connect (social + messages) - always mounted */}
        <View style={[styles.screenContainer, { opacity: activeTab === 'connect' ? 1 : 0, zIndex: activeTab === 'connect' ? 1 : 0 }]} pointerEvents={activeTab === 'connect' ? 'auto' : 'none'}>
          <ConnectScreen />
        </View>

        {/* Profile - always mounted */}
        <View style={[styles.screenContainer, { opacity: activeTab === 'profile' ? 1 : 0, zIndex: activeTab === 'profile' ? 1 : 0 }]} pointerEvents={activeTab === 'profile' ? 'auto' : 'none'}>
          <ProfileScreen isActive={activeTab === 'profile'} />
        </View>
      </View>
      
      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />
      
      {/* Sliding Create Screen Modal - Overlays everything natively */}
      <CreateScreen
        isActive={activeTab === 'create'}
        onClose={() => setActiveTab(previousTab)}
        openDraftId={pendingDraftId}
        onDraftOpened={() => setPendingDraftId(null)}
      />
      
    </NavigationContext.Provider>
  );
};

const AppContent = () => {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [sharedGameId, setSharedGameId] = useState<string | null>(null);
  const [creationNotificationNonce, setCreationNotificationNonce] = useState(0);
  // Notification deep-links handed down to MainApp (which owns tab state).
  const [pendingChatNotifUserId, setPendingChatNotifUserId] = useState<string | null>(null);
  const [activityNotifNonce, setActivityNotifNonce] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [startWithLogin, setStartWithLogin] = useState(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    checkOnboarding();
    handleDeepLink();
    setupNotifications();
    
    // Start background download of multiplayer games immediately on native.
    if (Platform.OS !== 'web') {
      startGameDownload().catch(e => console.log('[GameDownload] Background download error:', e));
      
      // Configure audio so WebViews can play sound even if iOS silent switch is ON
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      }).catch(e => console.log('[AudioConfig] Error:', e));
    }

    // Request notification permission on app start (for existing users after update)
    if (isAuthenticated) {
      registerForPushNotifications().then(async (token) => {
        if (token) {
          const authToken = await getToken();
          if (authToken) {
            await savePushToken(token, authToken);
          }
        }
      }).catch(e => console.log('[Notifications] Registration error:', e));
    }

    return () => {
      // Cleanup notification listeners
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Route a tapped notification's payload to the right screen.
  const handleNotificationData = (data: any) => {
    if (!data) return;
    if (data.type === 'game') {
      setSharedGameId(data.gameId as string);
    } else if (data.type === 'creation') {
      setCreationNotificationNonce((value) => value + 1);
    } else if (data.type === 'message') {
      // Open the Connect tab straight into the DM with the sender.
      if (data.userId) setPendingChatNotifUserId(String(data.userId));
    } else if (data.type === 'social') {
      // A follow / social event — open the Connect tab's Activity feed.
      setActivityNotifNonce((value) => value + 1);
    }
  };

  // Setup notification handlers
  const setupNotifications = () => {
    // Handle notification received while app is open
    notificationListener.current = addNotificationReceivedListener(notification => {
      console.log('[Notifications] Received:', notification);
    });

    // Handle notification tap (app already running / backgrounded)
    responseListener.current = addNotificationResponseListener(response => {
      console.log('[Notifications] Tapped:', response);
      handleNotificationData(response.notification.request.content.data);
    });

    // Handle the tap that cold-started the app from a killed state — the
    // listener above only fires for taps while the JS runtime is alive.
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (response) handleNotificationData(response.notification.request.content.data);
      })
      .catch(e => console.log('[Notifications] getLastResponse error:', e));
  };

  // Removed automatic hiding of auth screen so OnboardingFlow can manage its own lifecycle

  // Re-check onboarding when user logs out
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      // Force re-check by resetting state first
      setShowOnboarding(null);
      checkOnboarding();
    }
  }, [isAuthenticated, authLoading]);

  const checkOnboarding = async () => {
    // Never show onboarding on launch — users go straight to home screen.
    // Sign up / login is only accessible through auth gates on locked tabs.
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  // Handle deep links
  const handleDeepLink = async () => {
    // Check if app was opened via deep link
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      parseDeepLink(initialUrl);
    }

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      parseDeepLink(url);
    });

    return () => subscription.remove();
  };

  const parseDeepLink = (url: string) => {
    try {
      // Handle gametok://game/flappy-bird or https://gametok.co/game.html?id=flappy-bird
      const gameMatch = url.match(/game[\/=]([^\/\?&]+)/);
      if (gameMatch) {
        const gameId = gameMatch[1];
        console.log('[DeepLink] Opening game:', gameId);
        setSharedGameId(gameId);
      }
    } catch (e) {
      console.log('[DeepLink] Parse error:', e);
    }
  };

  const clearSharedGame = () => setSharedGameId(null);
  const openSharedGame = (gameId: string) => setSharedGameId(gameId);

  const handleOnboardingComplete = () => {
    AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  // Still loading auth check
  if (showOnboarding === null || authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Show auth screen (triggered from AuthGate on locked tabs)
  if (showAuth) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingFlow
          onComplete={() => { setShowAuth(false); setStartWithLogin(false); }}
          isAuthLoading={false}
          skipIntro={false}
          startWithLogin={startWithLogin}
        />
      </View>
    );
  }

  // Go straight to main app - individual screens handle auth gating
  return (
    <AuthScreenContext.Provider value={{
      showAuthScreen: () => { setStartWithLogin(false); setShowAuth(true); },
      showLoginScreen: () => { setStartWithLogin(true); setShowAuth(true); },
      hideAuthScreen: () => setShowAuth(false)
    }}>
      <DeepLinkContext.Provider value={{ sharedGameId, clearSharedGame, openSharedGame }}>
        <View style={{ flex: 1 }}>
          <MainApp
            openCreateNonce={creationNotificationNonce}
            notifChatUserId={pendingChatNotifUserId}
            onNotifChatHandled={() => setPendingChatNotifUserId(null)}
            notifActivityNonce={activityNotifNonce}
          />
        </View>
      </DeepLinkContext.Provider>
    </AuthScreenContext.Provider>
  );
};

export default function App() {
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  // Load Graphik (legacy) + Inter (V2 design system) fonts
  const [fontsLoaded] = useFonts({
    'Graphik-Regular': require('./assets/fonts/graphik_arabic.otf'),
    'Graphik-Medium': require('./assets/fonts/graphik_arabic_medium.otf'),
    'Graphik-SemiBold': require('./assets/fonts/graphik_arabic_semibold.otf'),
    'Graphik-Bold': require('./assets/fonts/graphik_arabic_bold.otf'),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {fontsLoaded && (
        <ErrorBoundary>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.container}>
              <ThemeProvider>
                <AuthProvider>
                  <SocketProvider>
                    <AppContent />
                  </SocketProvider>
                </AuthProvider>
              </ThemeProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </ErrorBoundary>
      )}

      {showAnimatedSplash && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}>
          <AnimatedSplash onAnimationComplete={() => setShowAnimatedSplash(false)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  screenContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
