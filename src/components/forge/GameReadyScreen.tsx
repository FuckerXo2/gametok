import React, { useEffect } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreviewPane } from '../wish/PreviewPane';
import { DEFAULT_ORIENTATION, type Orientation } from '../../constants/orientation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FORGE_MASCOT = require('../../../assets/forge/forge_mascot.png');
const FALLBACK_GAME_PREVIEW = require('../../../assets/forge/direction_coral.jpg');

const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 430);
// Longer, taller hero card filling the screen so buttons and mascot sit snug at the bottom
const CARD_HEIGHT = Math.min(
  Math.round(CARD_WIDTH * 1.25),
  Math.max(380, Math.floor(SCREEN_HEIGHT * 0.525)),
);

interface Props {
  gameName: string;
  html: string | null;
  gameUrl: string | null;
  orientation?: Orientation;
  onPlay: () => void;
  onCreate?: () => void;
  onPublish: () => void;
  onClose?: () => void;
  onShare?: () => void;
  onSave?: () => void;
}

export const GameReadyScreen: React.FC<Props> = ({
  gameName = 'Your game',
  html,
  gameUrl,
  orientation = DEFAULT_ORIENTATION,
  onPlay,
  onCreate,
  onPublish,
  onClose,
  onShare,
  onSave,
}) => {
  const insets = useSafeAreaInsets();

  // Mascot Companion Idle Bobbing
  const mascotBob = useSharedValue(0);
  const hammerGlow = useSharedValue(0.7);

  useEffect(() => {
    mascotBob.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    hammerGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.55, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [hammerGlow, mascotBob]);

  const mascotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mascotBob.value }],
  }));

  const hammerGlowStyle = useAnimatedStyle(() => ({
    opacity: hammerGlow.value,
  }));

  const handleSave = () => {
    if (onSave) {
      onSave();
      return;
    }
    Alert.alert('Saved', `${gameName} is safely saved to your drafts.`);
  };

  return (
    <View style={styles.container}>
      {/* Deep Obsidian Midnight Background */}
      <LinearGradient
        colors={['#00050D', '#010814', '#00040A']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {/* Back Button */}
        <Pressable
          style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
          onPress={onClose || onCreate}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>

        {/* Game Title */}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {gameName || 'Your game'}
        </Text>

        {/* Right Header Spacer to optically center title */}
        <View style={styles.headerSpacer} pointerEvents="none" />
      </View>

      {/* Content Body */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 14) + 8 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Game Preview Stage Card */}
        <View style={styles.cardContainer}>
          <View style={styles.gameCard}>
            <View style={styles.previewInner} pointerEvents="none">
              {html || gameUrl ? (
                <PreviewPane
                  state="ready"
                  gameName={gameName}
                  beats={[]}
                  html={html}
                  gameUrl={gameUrl}
                  orientation={orientation}
                  containerStyle={styles.previewPaneOverride}
                />
              ) : (
                <Image
                  source={FALLBACK_GAME_PREVIEW}
                  style={styles.fallbackImage}
                  resizeMode="cover"
                />
              )}
            </View>

            {/* Floating Top Pill with Game Title */}
            <View style={styles.floatingTitlePill} pointerEvents="none">
              <Text style={styles.floatingTitleText} numberOfLines={1}>
                {gameName || 'Your game'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Section */}
        <View style={styles.actionsSection}>
          {/* 1. Play Game Button (True Royal Purple Gradient) */}
          <Pressable
            style={({ pressed }) => [styles.playBtn, pressed && styles.playBtnPressed]}
            onPress={onPlay}
          >
            <LinearGradient
              colors={['#9333EA', '#6B21A8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playGradient}
            >
              <Ionicons name="play" size={19} color="#FFFFFF" />
              <Text style={styles.playText}>Play Game</Text>
            </LinearGradient>
          </Pressable>

          {/* 2. Edit in Creator */}
          <Pressable
            style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
            onPress={onCreate}
          >
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Edit in Creator</Text>
          </Pressable>

          {/* 3. Utility Actions Row: Save | Publish */}
          <View style={styles.utilityRow}>
            {/* Save */}
            <Pressable
              style={({ pressed }) => [styles.utilBtn, pressed && styles.utilBtnPressed]}
              onPress={handleSave}
            >
              <Ionicons name="download-outline" size={17} color="#FFFFFF" />
              <Text style={styles.utilBtnText}>Save</Text>
            </Pressable>

            {/* Publish */}
            <Pressable
              style={({ pressed }) => [styles.utilBtn, pressed && styles.utilBtnPressed]}
              onPress={onPublish}
            >
              <Ionicons name="arrow-up-circle-outline" size={17} color="#FFFFFF" />
              <Text style={styles.utilBtnText}>Publish</Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom Companion Mascot & Speech Bubble */}
        <View style={styles.mascotRow}>
          {/* Ground Contact Shadow */}
          <View style={styles.groundShadow} pointerEvents="none" />

          {/* Hammer Warm Glow Aura */}
          <Animated.View style={[styles.hammerAura, hammerGlowStyle]} pointerEvents="none" />

          {/* Visor Cyan Glow Aura */}
          <View style={styles.visorAura} pointerEvents="none" />

          {/* Companion Character with living idle breathing animation */}
          <Animated.View style={[styles.mascotWrap, mascotAnimatedStyle]}>
            <Image source={FORGE_MASCOT} style={styles.mascotImage} resizeMode="contain" />
          </Animated.View>

          {/* Speech Bubble */}
          <View style={styles.speechBubble}>
            <View style={styles.speechTail} />
            <Text style={styles.speechTitle}>It's alive!</Text>
            <Text style={styles.speechSubtitle}>Now make it your own.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#01060E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    transform: [{ scale: 0.96 }],
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
    gap: 10,
  },
  cardContainer: {
    width: '100%',
    alignItems: 'center',
  },
  gameCard: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#070C18',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.32)',
    position: 'relative',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
  },
  previewInner: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewPaneOverride: {
    margin: 0,
    borderWidth: 0,
    borderRadius: 26,
    backgroundColor: 'transparent',
  },
  fallbackImage: {
    width: '100%',
    height: '100%',
  },
  floatingTitlePill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 15, 29, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  floatingTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  actionsSection: {
    width: '100%',
    gap: 8,
    marginTop: 0,
  },
  playBtn: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9333EA',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  playBtnPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  playGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  editBtn: {
    width: '100%',
    height: 44,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#A855F7',
    backgroundColor: 'rgba(147, 51, 234, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnPressed: {
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    transform: [{ scale: 0.985 }],
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 0,
  },
  utilBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  utilBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ scale: 0.97 }],
  },
  utilBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginTop: 4,
    position: 'relative',
  },
  groundShadow: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    width: 82,
    height: 11,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    transform: [{ scaleX: 1.1 }],
  },
  hammerAura: {
    position: 'absolute',
    bottom: 56,
    left: 6,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.95,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  visorAura: {
    position: 'absolute',
    bottom: 40,
    left: 38,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(103, 232, 249, 0.22)',
    shadowColor: '#67E8F9',
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  mascotWrap: {
    width: 98,
    height: 106,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 5,
  },
  mascotImage: {
    width: 98,
    height: 106,
  },
  speechBubble: {
    flex: 1,
    marginLeft: 10,
    marginBottom: 0,
    backgroundColor: 'rgba(14, 21, 38, 0.94)',
    borderWidth: 1.3,
    borderColor: 'rgba(103, 232, 249, 0.28)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 4,
  },
  speechTail: {
    position: 'absolute',
    bottom: 20,
    left: -9,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderTopColor: 'transparent',
    borderBottomWidth: 7,
    borderBottomColor: 'transparent',
    borderRightWidth: 10,
    borderRightColor: 'rgba(14, 21, 38, 0.94)',
  },
  speechTitle: {
    color: '#F8FAFC',
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: '800',
  },
  speechSubtitle: {
    color: '#CBD5E1',
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 2,
  },
});
