import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { LoopsColors } from '../constants/LoopsColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GameLoadingScreenProps {
  gameName: string;
  gameThumbnail?: string;
  creatorName?: string | null;
  progress?: number; // 0-100 — real load progress fed by the host WebView
}

export const GameLoadingScreen: React.FC<GameLoadingScreenProps> = ({
  gameName,
  gameThumbnail,
  creatorName,
  progress = 0,
}) => {
  const [displayProgress, setDisplayProgress] = React.useState(0);
  // Gentle trickle so the bar shows motion before the first real
  // onLoadProgress event lands; caps at 12% and never moves backwards.
  const [trickle, setTrickle] = React.useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Pulse animation for loading icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Keep the number label in sync with the animated bar.
    const listenerId = progressAnim.addListener(({ value }) => {
      setDisplayProgress(Math.round(value));
    });

    const trickleId = setInterval(() => {
      setTrickle((t) => (t >= 12 ? t : t + 1));
    }, 120);

    return () => {
      progressAnim.removeListener(listenerId);
      clearInterval(trickleId);
    };
  }, []);

  // Drive the bar toward the real load progress. `target` is monotonic
  // (both inputs only grow), so the bar never jumps backwards.
  useEffect(() => {
    const target = Math.min(100, Math.max(progress, trickle));
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [progress, trickle]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Blurred background - use game thumbnail if available */}
      {gameThumbnail ? (
        <Image
          source={{ uri: gameThumbnail }}
          style={styles.backgroundImage}
          blurRadius={20}
        />
      ) : (
        <Image
          source={require('../../assets/ui/loading/default_loading_bg.png')}
          style={styles.backgroundImage}
        />
      )}

      {/* Dark overlay */}
      <View style={styles.darkOverlay} />

      {/* Content */}
      <View style={styles.content}>
        {/* Game thumbnail as icon (not the loading icon) */}
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
          {gameThumbnail ? (
            <Image
              source={{ uri: gameThumbnail }}
              style={styles.gameThumbnail}
            />
          ) : (
            <Image
              source={require('../../assets/ui/loading/ic_loading_images.png')}
              style={styles.loadingIcon}
            />
          )}
        </Animated.View>

        {/* Game name */}
        <Text style={styles.gameName} numberOfLines={2}>
          {gameName}
        </Text>

        <Text style={styles.branding}>By {creatorName?.trim() || 'GameTok'}</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressText}>{displayProgress}%</Text>
        </View>

        {/* Loading text */}
        <Text style={styles.loadingText}>LOADING...</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LoopsColors.black,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: '100%',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LoopsColors.black70,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: LoopsColors.white10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: LoopsColors.white20,
  },
  loadingIcon: {
    width: 64,
    height: 64,
  },
  gameThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  gameName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: LoopsColors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  branding: {
    fontSize: 14,
    color: LoopsColors.white60,
    marginBottom: 32,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: LoopsColors.white20,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: LoopsColors.mainGreen,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: LoopsColors.white80,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 11,
    color: LoopsColors.white50,
    letterSpacing: 2,
    fontWeight: '600',
  },
});
