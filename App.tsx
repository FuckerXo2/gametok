import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Linking, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { HomeScreen } from './src/screens/HomeScreen';
import { BottomNav } from './src/components/BottomNav';
import { ConnectScreen } from './src/components/ConnectScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { ExploreScreen } from './src/components/ExploreScreen';
import { OnboardingFlow } from './src/components/OnboardingFlow';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { requestTrackingPermission } from './src/services/ads';
import { addNotificationResponseListener, addNotificationReceivedListener, registerForPushNotifications, savePushToken } from './src/services/notifications';
import { getToken } from './src/services/api';
import { startGameDownload } from './src/services/gameDownloader';

// Prevent native splash from auto-hiding
SplashScreen.preventAutoHideAsync();

// Deep link context - to pass shared game ID to HomeScreen
interface DeepLinkContextType {
  sharedGameId: string | null;
  clearSharedGame: () => void;
}
const DeepLinkContext = createContext<DeepLinkContextType>({ sharedGameId: null, clearSharedGame: () => { } });
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
}
const NavigationContext = createContext<NavigationContextType>({ 
  activeTab: 'home', 
  setActiveTab: () => {}, 
  pendingChatUserId: null,
  setPendingChatUserId: () => {}
});
export const useNavigation = () => useContext(NavigationContext);

type TabName = 'home' | 'explore' | 'rewards' | 'connect' | 'profile';

const MainApp = () => {
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [homeRefreshTrigger, setHomeRefreshTrigger] = useState(0);
  const [pendingChatUserId, setPendingChatUserId] = useState<string | null>(null);
  const { isDark, colors } = useTheme();

  const handleTabPress = (tab: TabName) => {
    if (tab === 'home' && activeTab === 'home') {
      // Already on home — trigger refresh
      setHomeRefreshTrigger(prev => prev + 1);
    }
    setActiveTab(tab);
  };

  // Keep all screens mounted, just hide/show them
  return (
    <NavigationContext.Provider value={{ activeTab, setActiveTab, pendingChatUserId, setPendingChatUserId }}>
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
    </NavigationContext.Provider>
  );
};

const AppContent = () => {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [sharedGameId, setSharedGameId] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [startWithLogin, setStartWithLogin] = useState(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    checkOnboarding();
    requestTrackingPermission();
    handleDeepLink();
    setupNotifications();
    
    // Start background download of multiplayer games immediately
    startGameDownload().catch(e => console.log('[GameDownload] Background download error:', e));

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

  // Setup notification handlers
  const setupNotifications = () => {
    // Handle notification received while app is open
    notificationListener.current = addNotificationReceivedListener(notification => {
      console.log('[Notifications] Received:', notification);
    });

    // Handle notification tap
    responseListener.current = addNotificationResponseListener(response => {
      console.log('[Notifications] Tapped:', response);
      const data = response.notification.request.content.data;

      // Handle different notification types
      if (data.type === 'game') {
        setSharedGameId(data.gameId as string);
      } else if (data.type === 'message') {
        // Navigate to inbox
        // You can add a callback here to switch tabs
      } else if (data.type === 'social') {
        // Navigate to profile or connect tab
      }
    });
  };

  // Hide auth screen when user successfully logs in
  useEffect(() => {
    if (isAuthenticated && showAuth) {
      setShowAuth(false);
    }
  }, [isAuthenticated]);

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
      // Handle gametok://game/flappy-bird or https://gametok.app/game.html?id=flappy-bird
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
      <DeepLinkContext.Provider value={{ sharedGameId, clearSharedGame }}>
        <View style={{ flex: 1 }}>
          <MainApp />
        </View>
      </DeepLinkContext.Provider>
    </AuthScreenContext.Provider>
  );
};

export default function App() {
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  // Load Graphik fonts
  const [fontsLoaded] = useFonts({
    'Graphik-Regular': require('./assets/fonts/graphik_arabic.otf'),
    'Graphik-Medium': require('./assets/fonts/graphik_arabic_medium.otf'),
    'Graphik-SemiBold': require('./assets/fonts/graphik_arabic_semibold.otf'),
    'Graphik-Bold': require('./assets/fonts/graphik_arabic_bold.otf'),
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
