import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { LoopsColors } from '../constants/LoopsColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GameLoadingScreenProps {
  gameName: string;
  gameThumbnail?: string;
  progress?: number; // 0-100
}

export const GameLoadingScreen: React.FC<GameLoadingScreenProps> = ({
  gameName,
  gameThumbnail,
  progress = 0, // Kept for backwards compatibility if needed elsewhere
}) => {
  const [fakeProgress, setFakeProgress] = React.useState(0);
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

    // Smooth progress animation to 100%
    // Reaches 100% in ~2.8s, just before the 3s onLoadEnd dismissal
    Animated.timing(progressAnim, {
      toValue: 100,
      duration: 2800,
      useNativeDriver: false,
    }).start();

    // Update the local text state to match the animated value
    const listenerId = progressAnim.addListener(({ value }) => {
      setFakeProgress(Math.floor(value));
    });

    return () => {
      progressAnim.removeListener(listenerId);
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
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

        {/* "By GameTok" branding */}
        <Text style={styles.branding}>By GameTok</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.progressText}>{fakeProgress}%</Text>
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
