import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type TabName = 'home' | 'explore' | 'rewards' | 'connect' | 'profile' | 'create';

interface BottomNavProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

const NAV_WHITE = '#ffffff';
const BRAND_PURPLE = '#a855f7';
const INACTIVE = 'rgba(255,255,255,0.55)';
const noFocusRing = { outlineStyle: 'none' } as any;

interface TabSpec {
  name: TabName;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  label: string;
}

const NavTab = ({
  tab,
  isActive,
  onPress,
  user,
}: {
  tab: TabSpec;
  isActive: boolean;
  onPress: () => void;
  user: any;
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.05 : 1, { damping: 14, stiffness: 220 });
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.92, { duration: 90 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(isActive ? 1.05 : 1, { damping: 14, stiffness: 220 });
  };
  const handlePress = () => {
    if (!isActive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const color = isActive ? BRAND_PURPLE : INACTIVE;

  return (
    <Pressable
      style={[styles.tab, noFocusRing]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <Animated.View style={[styles.tabInner, animatedStyle]}>
        {tab.name === 'profile' ? (
          <View style={[styles.avatarRing, isActive && styles.avatarRingActive]}>
            <Avatar uri={user?.avatar} userId={user?.id} size={26} />
          </View>
        ) : (
          <Ionicons name={isActive ? tab.iconActive : tab.icon} size={24} color={color} />
        )}
        <Animated.Text
          style={[
            styles.label,
            { color },
            isActive && styles.labelActive,
          ]}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
};

const CreateButton = ({ onPress }: { onPress: () => void }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withTiming(0.85, { duration: 90 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 220 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={[styles.createTab, noFocusRing]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
    >
      <Animated.View style={[styles.createButtonWrapper, animatedStyle]}>
        <View style={[styles.createButtonGlitch, styles.createButtonGlitchCyan]} />
        <View style={[styles.createButtonGlitch, styles.createButtonGlitchPurple]} />
        <View style={styles.createButton}>
          <Ionicons name="add" size={24} color="#000" />
        </View>
      </Animated.View>
    </Pressable>
  );
};

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const left: TabSpec[] = [
    { name: 'home', icon: 'home-outline', iconActive: 'home', label: 'Home' },
    { name: 'explore', icon: 'compass-outline', iconActive: 'compass', label: 'Explore' },
  ];

  const right: TabSpec[] = [
    { name: 'connect', icon: 'people-outline', iconActive: 'people', label: 'Connect' },
    { name: 'profile', icon: 'person-outline', iconActive: 'person', label: 'Profile' },
  ];

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom || 8 },
      ]}
    >
      {left.map((tab) => (
        <NavTab
          key={tab.name}
          tab={tab}
          isActive={activeTab === tab.name}
          onPress={() => onTabPress(tab.name)}
          user={user}
        />
      ))}

      <CreateButton onPress={() => onTabPress('create')} />

      {right.map((tab) => (
        <NavTab
          key={tab.name}
          tab={tab}
          isActive={activeTab === tab.name}
          onPress={() => onTabPress(tab.name)}
          user={user}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
    paddingHorizontal: 4,
    zIndex: 9999,
    elevation: 9999,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  labelActive: {
    fontWeight: '700',
  },
  avatarRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingActive: {
    borderWidth: 2,
    borderColor: BRAND_PURPLE,
  },
  createTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  createButtonWrapper: {
    width: 44,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonGlitch: {
    position: 'absolute',
    width: 44,
    height: 30,
    borderRadius: 8,
  },
  createButtonGlitchCyan: {
    left: -3,
    backgroundColor: '#00e5ff',
  },
  createButtonGlitchPurple: {
    right: -3,
    backgroundColor: '#a855f7',
  },
  createButton: {
    width: 44,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
