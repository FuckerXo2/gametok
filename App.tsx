import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameFeed } from './src/components/GameFeed';
import { BottomNav } from './src/components/BottomNav';
import { InboxScreen } from './src/components/InboxScreen';
import { ProfileScreen } from './src/components/ProfileScreen';
import { DiscoverScreen } from './src/components/DiscoverScreen';
import { AuthScreen } from './src/components/AuthScreen';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

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

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Require login
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return <MainApp />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
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
