import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameFeed } from './src/components/GameFeed';
import { BottomNav } from './src/components/BottomNav';
import { InboxScreen } from './src/components/InboxScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { DiscoverScreen } from './src/components/DiscoverScreen';
import { OnboardingFlow } from './src/components/OnboardingFlow';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { requestTrackingPermission } from './src/services/ads';

type TabName = 'home' | 'discover' | 'inbox' | 'profile';

const MainApp = () => {
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const { isDark, colors } = useTheme();

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <GameFeed />;
      case 'discover':
        return <DiscoverScreen />;
      case 'inbox':
        return <InboxScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <GameFeed />;
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
  const { isLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    checkOnboarding();
    // Request ATT permission early, before any tracking
    requestTrackingPermission();
  }, []);

  const checkOnboarding = async () => {
    try {
      const seen = await AsyncStorage.getItem('hasSeenOnboarding');
      // Only skip onboarding if already seen AND authenticated
      setShowOnboarding(seen !== 'true');
    } catch {
      setShowOnboarding(true);
    } finally {
      setCheckingOnboarding(false);
    }
  };

  const handleOnboardingComplete = () => {
    AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  if (isLoading || checkingOnboarding) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show onboarding until explicitly completed
  if (showOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // Require auth after onboarding
  if (!isAuthenticated) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  return <MainApp />;
};

export default function App() {
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
