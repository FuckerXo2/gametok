import React, { useState, useEffect, createContext, useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { HomeScreen } from './src/screens/HomeScreen';
import { BottomNav } from './src/components/BottomNav';
import { InboxScreen } from './src/components/InboxScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { ConnectScreen } from './src/components/ConnectScreen';
import { RewardsScreen } from './src/components/RewardsScreen';
import { OnboardingFlow } from './src/components/OnboardingFlow';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { requestTrackingPermission } from './src/services/ads';

// Prevent native splash from auto-hiding
SplashScreen.preventAutoHideAsync();

// Deep link context - to pass shared game ID to HomeScreen
interface DeepLinkContextType {
  sharedGameId: string | null;
  clearSharedGame: () => void;
}
const DeepLinkContext = createContext<DeepLinkContextType>({ sharedGameId: null, clearSharedGame: () => {} });
export const useDeepLink = () => useContext(DeepLinkContext);

// Auth screen context - to show login/signup from anywhere
interface AuthScreenContextType {
  showAuthScreen: () => void;
  showLoginScreen: () => void;
  hideAuthScreen: () => void;
}
const AuthScreenContext = createContext<AuthScreenContextType>({ showAuthScreen: () => {}, showLoginScreen: () => {}, hideAuthScreen: () => {} });
export const useAuthScreen = () => useContext(AuthScreenContext);

type TabName = 'home' | 'explore' | 'rewards' | 'connect' | 'profile';

const MainApp = () => {
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const { isDark, colors } = useTheme();

  // Keep all screens mounted, just hide/show them
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Home - always mounted */}
        <View style={[styles.screenContainer, { display: activeTab === 'home' ? 'flex' : 'none' }]} pointerEvents={activeTab === 'home' ? 'auto' : 'none'}>
          <HomeScreen isActive={activeTab === 'home'} />
        </View>
        
        {/* Explore (game discovery) - always mounted */}
        <View style={[styles.screenContainer, { display: activeTab === 'explore' ? 'flex' : 'none' }]} pointerEvents={activeTab === 'explore' ? 'auto' : 'none'}>
          <ConnectScreen />
        </View>
        
        {/* Rewards - always mounted */}
        <View style={[styles.screenContainer, { display: activeTab === 'rewards' ? 'flex' : 'none' }]} pointerEvents={activeTab === 'rewards' ? 'auto' : 'none'}>
          <RewardsScreen isActive={activeTab === 'rewards'} />
        </View>
        
        {/* Connect (social + messages) - always mounted */}
        <View style={[styles.screenContainer, { display: activeTab === 'connect' ? 'flex' : 'none' }]} pointerEvents={activeTab === 'connect' ? 'auto' : 'none'}>
          <InboxScreen />
        </View>
        
        {/* Profile - always mounted */}
        <View style={[styles.screenContainer, { display: activeTab === 'profile' ? 'flex' : 'none' }]} pointerEvents={activeTab === 'profile' ? 'auto' : 'none'}>
          <ProfileScreen isActive={activeTab === 'profile'} />
        </View>
      </View>
      <BottomNav activeTab={activeTab} onTabPress={setActiveTab} />
    </>
  );
};

const AppContent = () => {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [sharedGameId, setSharedGameId] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [startWithLogin, setStartWithLogin] = useState(false);

  useEffect(() => {
    checkOnboarding();
    requestTrackingPermission();
    handleDeepLink();
  }, []);

  // Hide auth screen when user successfully logs in
  useEffect(() => {
    if (isAuthenticated && showAuth) {
      setShowAuth(false);
    }
  }, [isAuthenticated]);

  const checkOnboarding = async () => {
    try {
      const seen = await AsyncStorage.getItem('hasSeenOnboarding');
      setShowOnboarding(seen !== 'true');
    } catch {
      setShowOnboarding(true);
    }
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

  // Still loading auth or onboarding check
  if (showOnboarding === null || authLoading) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  // User hasn't seen onboarding yet - show intro slides
  if (showOnboarding) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingFlow onComplete={handleOnboardingComplete} isAuthLoading={false} />
      </View>
    );
  }

  // Show auth screen (triggered from AuthGate)
  if (showAuth) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingFlow 
          onComplete={() => { setShowAuth(false); setStartWithLogin(false); }} 
          isAuthLoading={false} 
          skipIntro={startWithLogin} 
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

  // AnimatedSplash renders FIRST, before any providers
  if (showAnimatedSplash) {
    return <AnimatedSplash onAnimationComplete={() => setShowAnimatedSplash(false)} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.container}>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
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
