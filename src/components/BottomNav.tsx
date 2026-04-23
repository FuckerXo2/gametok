import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolateColor
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type TabName = 'home' | 'explore' | 'rewards' | 'connect' | 'profile' | 'create';

interface BottomNavProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

const AnimatedTab = ({
  tab,
  isActive,
  onPress,
  colors,
  user
}: {
  tab: any;
  isActive: boolean;
  onPress: () => void;
  colors: any;
  user: any;
}) => {
  const scale = useSharedValue(isActive ? 1.15 : 1);
  const translateY = useSharedValue(isActive ? -4 : 0);
  const opacity = useSharedValue(isActive ? 1 : 0.6);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.15 : 1, { damping: 12, stiffness: 150 });
    translateY.value = withSpring(isActive ? -4 : 0, { damping: 12, stiffness: 150 });
    opacity.value = withTiming(isActive ? 1 : 0.6, { duration: 200 });
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ],
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: isActive ? 1.05 : 1 }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.85, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(isActive ? 1.15 : 1, { damping: 10, stiffness: 250 });
  };

  const handlePress = () => {
    if (!isActive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <Pressable
      style={styles.tab}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
        {tab.name === 'profile' ? (
          <View style={[styles.avatarContainer, isActive && { borderColor: colors.primary, borderWidth: 2 }]}>
            <Avatar
              uri={user?.avatar}
              size={24}
            />
          </View>
        ) : (
          <Ionicons
            name={isActive ? tab.iconActive : tab.icon}
            size={24}
            color={isActive ? colors.primary : '#888'}
          />
        )}
      </Animated.View>
      <Animated.Text style={[
        styles.label,
        animatedTextStyle,
        { color: isActive ? colors.primary : '#888' }
      ]}>
        {tab.label}
      </Animated.Text>
    </Pressable>
  );
};

const CreateButton = ({ onPress, colors, isDark }: { onPress: () => void, colors: any, isDark: boolean }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => { scale.value = withTiming(0.85, { duration: 100 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 10, stiffness: 250 }); };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Pressable
      style={styles.createButtonContainer}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
    >
      <Animated.View style={[styles.createButtonWrapper, animatedStyle]}>
        {/* Engineered Psychological 3D Depth using GameTok Brand Colors */}
        <View style={[styles.createButtonGlitch, { backgroundColor: '#00e5ff', left: -3 }]} />
        <View style={[styles.createButtonGlitch, { backgroundColor: colors.primary, right: -3 }]} />
        
        {/* High Contrast Core */}
        <View style={[styles.createButton, { backgroundColor: '#FFF' }]}>
          <Ionicons name="add" size={24} color="#000" />
        </View>
      </Animated.View>
    </Pressable>
  );
};

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const tabs: { name: TabName; icon: string; iconActive: string; label: string }[] = [
    { name: 'home', icon: 'home-outline', iconActive: 'home', label: 'Home' },
    { name: 'explore', icon: 'compass-outline', iconActive: 'compass', label: 'Explore' },
    { name: 'connect', icon: 'people-outline', iconActive: 'people', label: 'Connect' },
    { name: 'profile', icon: 'person-outline', iconActive: 'person', label: 'Profile' },
  ];

  return (
    <View style={[
      styles.container,
      {
        paddingBottom: insets.bottom || 8,
        backgroundColor: '#000',
        borderTopColor: '#333',
      }
    ]}>
      {tabs.slice(0, 2).map((tab) => (
        <AnimatedTab
          key={tab.name}
          tab={tab}
          isActive={activeTab === tab.name}
          onPress={() => onTabPress(tab.name)}
          colors={colors}
          user={user}
        />
      ))}

      {/* Custom GameTok AI Studio Button */}
      <CreateButton 
        onPress={() => onTabPress('create')} 
        colors={colors} 
        isDark={isDark} 
      />

      {tabs.slice(2).map((tab) => (
        <AnimatedTab
          key={tab.name}
          tab={tab}
          isActive={activeTab === tab.name}
          onPress={() => onTabPress(tab.name)}
          colors={colors}
          user={user}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    paddingTop: 8,
    zIndex: 9999,
    elevation: 9999,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  createButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2, 
  },
  createButtonWrapper: {
    width: 44,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonGlitch: {
    position: 'absolute',
    width: 44,
    height: 30,
    borderRadius: 8,
  },
  createButton: {
    width: 44,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 13,
    overflow: 'hidden',
  },
});
