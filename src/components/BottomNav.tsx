import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, StyleSheet, Pressable, Text, Animated as RNAnimated } from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../../App';
import { Avatar } from './Avatar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
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
  const { isGameDeckActive, setIsGameDeckActive, isHudHidden, setIsHudHidden, triggerGameRestart, triggerGameSkip } = useNavigation();
  const [showDeckCoach, setShowDeckCoach] = useState(false);
  const [hasShownDeckCoachThisOpen, setHasShownDeckCoachThisOpen] = useState(false);
  const coachOpacity = useRef(new RNAnimated.Value(0)).current;
  const coachScale = useRef(new RNAnimated.Value(0.96)).current;
  const coachGlowOpacity = useSharedValue(0.18);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setHasShownDeckCoachThisOpen(false);
        setShowDeckCoach(false);
        coachOpacity.stopAnimation();
        coachScale.stopAnimation();
        coachOpacity.setValue(0);
        coachScale.setValue(0.96);
        coachGlowOpacity.value = 0;
      }
    });
    return () => sub.remove();
  }, [coachGlowOpacity, coachOpacity]);

  useEffect(() => {
    if (activeTab !== 'home' || !isGameDeckActive || hasShownDeckCoachThisOpen) return;
    coachOpacity.stopAnimation();
    coachScale.stopAnimation();
    coachOpacity.setValue(0);
    coachScale.setValue(0.96);
    coachGlowOpacity.value = 0;
    setShowDeckCoach(true);
    setHasShownDeckCoachThisOpen(true);
  }, [activeTab, coachGlowOpacity, coachOpacity, coachScale, hasShownDeckCoachThisOpen, isGameDeckActive]);

  useEffect(() => {
    if (!showDeckCoach) return;
    coachOpacity.stopAnimation();
    coachScale.stopAnimation();
    coachOpacity.setValue(0);
    coachScale.setValue(0.96);
    coachGlowOpacity.value = 0.12;
    RNAnimated.timing(coachOpacity, {
      toValue: 1,
      duration: 850,
      useNativeDriver: true,
    }).start();
    RNAnimated.sequence([
      RNAnimated.timing(coachScale, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      }),
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(coachScale, {
            toValue: 1.025,
            duration: 900,
            useNativeDriver: true,
          }),
          RNAnimated.timing(coachScale, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();
    coachGlowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.32, { duration: 780 }),
        withTiming(0.12, { duration: 780 }),
      ),
      -1,
      false,
    );
    const fadeOut = setTimeout(() => {
      coachScale.stopAnimation();
      RNAnimated.timing(coachOpacity, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }).start();
      RNAnimated.timing(coachScale, {
        toValue: 0.98,
        duration: 650,
        useNativeDriver: true,
      }).start();
      coachGlowOpacity.value = withTiming(0, { duration: 420 });
    }, 4350);
    const hide = setTimeout(() => setShowDeckCoach(false), 5000);
    return () => {
      coachScale.stopAnimation();
      clearTimeout(fadeOut);
      clearTimeout(hide);
    };
  }, [coachGlowOpacity, coachOpacity, coachScale, showDeckCoach]);

  const deckCoachAnimatedStyle = {
    opacity: coachOpacity,
    transform: [{ scale: coachScale }],
  };
  const deckCoachGlowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: coachGlowOpacity.value,
  }));

  const left: TabSpec[] = [
    { name: 'home', icon: 'home-outline', iconActive: 'home', label: 'Home' },
    { name: 'explore', icon: 'compass-outline', iconActive: 'compass', label: 'Explore' },
  ];

  const right: TabSpec[] = [
    { name: 'connect', icon: 'people-outline', iconActive: 'people', label: 'Connect' },
    { name: 'profile', icon: 'person-outline', iconActive: 'person', label: 'Profile' },
  ];

  // GAME DECK RENDER
  if (activeTab === 'home' && isGameDeckActive) {
    return (
      <View style={styles.deckShell} pointerEvents="box-none">
        {showDeckCoach && (
          <RNAnimated.View
            pointerEvents="none"
            style={[
              styles.deckCoach,
              { bottom: (insets.bottom || 8) + 78 },
              deckCoachAnimatedStyle,
            ]}
          >
            <Animated.View
              style={[styles.deckCoachGlow, deckCoachGlowAnimatedStyle]}
            />
            <Text style={styles.deckCoachText}>
              Use the center controls to switch games or restart.
            </Text>
          </RNAnimated.View>
        )}
        <View
          style={[
            styles.container,
            styles.gameDeckContainer,
            { paddingBottom: insets.bottom || 8 },
          ]}
        >
          {/* Left Anchor: Home Button acts as the 'More/Menu' button to show standard tabs */}
          <Pressable 
            style={[styles.deckSideBtn, noFocusRing]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Toggle back to standard navigation
              setIsGameDeckActive(false);
              setIsHudHidden(false);
            }}
          >
            <Ionicons name="home-outline" size={24} color={NAV_WHITE} />
            <Text style={[styles.label, { color: NAV_WHITE }]}>Home</Text>
          </Pressable>

          {/* Faint divider between Home and media controls */}
          <View style={{ width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 1 }} />

          {/* Center: The Game Player Scroll Zone */}
          <View style={styles.deckPlayerZone}>
          <Pressable 
            style={[styles.deckPlayerIcon, noFocusRing]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              triggerGameSkip('prev');
            }}
          >
            <MaterialIcons name="skip-previous" size={32} color={NAV_WHITE} />
          </Pressable>
          
          <Pressable 
            style={[styles.deckPlayBtn, noFocusRing]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              triggerGameRestart();
            }}
          >
            <MaterialIcons name="replay" size={28} color="#000" />
          </Pressable>
          
          <Pressable 
            style={[styles.deckPlayerIcon, noFocusRing]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              triggerGameSkip('next');
            }}
          >
            <MaterialIcons name="skip-next" size={32} color={NAV_WHITE} />
          </Pressable>
          </View>

          {/* Right Anchor: Toggle HUD Visibility */}
            <Pressable 
              style={[styles.deckSideBtn, noFocusRing]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsHudHidden(!isHudHidden);
              }}
            >
              <FontAwesome5 
                name={isHudHidden ? "chevron-up" : "chevron-down"} 
                size={22} 
                color={NAV_WHITE} 
              />
            </Pressable>
        </View>
      </View>
    );
  }

  // STANDARD TABS RENDER
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
    backgroundColor: '#000', // Standard tabs remain #000
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
  
  /* GAME DECK STYLES */
  deckShell: {
    position: 'relative',
    zIndex: 10000,
    elevation: 10000,
  },
  deckCoach: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '86%',
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: '#fff',
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    overflow: 'visible',
  },
  deckCoachGlow: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  deckCoachText: {
    color: '#111',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  gameDeckContainer: {
    backgroundColor: '#0a0b16', // Competitor uses a subtle bluish/purplish black
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 0,
  },
  deckSideBtn: {
    width: '15%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  deckPlayerZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  deckPlayerZoneHidden: {
    flex: 1,
  },
  deckPlayerIcon: {
    padding: 10,
  },
  deckPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
});
