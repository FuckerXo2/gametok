import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

type TabName = 'home' | 'discover' | 'inbox' | 'profile';

interface BottomNavProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const tabs: { name: TabName; icon: string; iconActive: string; label: string }[] = [
    { name: 'home', icon: 'home-outline', iconActive: 'home', label: 'Home' },
    { name: 'discover', icon: 'search-outline', iconActive: 'search', label: 'Discover' },
    { name: 'inbox', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses', label: 'Inbox' },
    { name: 'profile', icon: 'person-outline', iconActive: 'person', label: 'Profile' },
  ];

  return (
    <View style={[
      styles.container, 
      { 
        paddingBottom: insets.bottom || 8,
        backgroundColor: colors.background,
        borderTopColor: colors.border,
      }
    ]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={styles.tab}
          onPress={() => onTabPress(tab.name)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={(activeTab === tab.name ? tab.iconActive : tab.icon) as any}
            size={24}
            color={activeTab === tab.name ? colors.text : colors.textSecondary}
          />
          <Text style={[
            styles.label, 
            { color: activeTab === tab.name ? colors.text : colors.textSecondary }
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
  },
});
