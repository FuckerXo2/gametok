import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { HomeScreen } from './src/screens/HomeScreen';
import { BottomNav } from './src/components/BottomNav';
import { InboxScreen } from './src/components/InboxScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { DiscoverScreen } from './src/components/DiscoverScreen';
import { OnboardingFlow } from './src/components/OnboardingFlow';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { requestTrackingPermission } from './src/services/ads';

// Prevent native splash from auto-hiding
SplashScreen.preventAutoHideAsync();

type TabName = 'home' | 'discover' | 'inbox' | 'profile';

const MainApp = () => {
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const { isDark, colors } = useTheme();

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      case 'discover':
        return <DiscoverScreen />;
      case 'inbox':
        return <InboxScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        {renderScreen()}
      </View>
      <BottomNav activeTab={activeTab} onTabPress={setActiveTab} />
    </>
  );
};

const AppContent = () => {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    checkOnboarding();
    requestTrackingPermission();
  }, []);

  const checkOnboarding = async () => {
    try {
      const seen = await AsyncStorage.getItem('hasSeenOnboarding');
      setShowOnboarding(seen !== 'true');
    } catch {
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = () => {
    AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  // Still loading auth or onboarding check
  if (showOnboarding === null || authLoading) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  // User hasn't seen onboarding yet
  if (showOnboarding) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingFlow onComplete={handleOnboardingComplete} isAuthLoading={false} />
      </View>
    );
  }

  // Onboarding done, not logged in - show login
  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingFlow onComplete={handleOnboardingComplete} isAuthLoading={false} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MainApp />
    </View>
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
