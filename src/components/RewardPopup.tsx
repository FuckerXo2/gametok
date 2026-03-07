import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RewardPopupProps {
  visible: boolean;
  coins: number;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

export const RewardPopup: React.FC<RewardPopupProps> = ({
  visible,
  coins,
  title = 'Reward Claimed!',
  subtitle,
  onClose,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const coinScaleAnim = useRef(new Animated.Value(0)).current;
  const coinRotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset animations
      scaleAnim.setValue(0);
      coinScaleAnim.setValue(0);
      coinRotateAnim.setValue(0);
      shimmerAnim.setValue(0);

      // Pop in animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Coin bounce animation
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(coinScaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();

      // Coin spin
      Animated.loop(
        Animated.timing(coinRotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Shimmer
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const coinRotate = coinRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />

        <Animated.View style={[styles.popup, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            style={StyleSheet.absoluteFill}
          />

          {/* Shimmer effect */}
          <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.1)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Close button */}
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Image source={require('../../assets/ui/icons/ic_close.png')} style={{ width: 24, height: 24, tintColor: 'rgba(255,255,255,0.5)' }} />
          </TouchableOpacity>

          {/* Coin icon */}
          <Animated.View style={[
            styles.coinContainer,
            {
              transform: [
                { scale: coinScaleAnim },
                { rotate: coinRotate }
              ]
            }
          ]}>
            <LinearGradient
              colors={['#ffd60a', '#f59e0b', '#d97706']}
              style={styles.coinGradient}
            >
              <FontAwesome5 name="coins" size={40} color="#fff" />
            </LinearGradient>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Coins amount */}
          <View style={styles.coinsRow}>
            <Text style={styles.plus}>+</Text>
            <Text style={styles.coinsAmount}>{coins.toLocaleString()}</Text>
            <FontAwesome5 name="coins" size={24} color="#ffd60a" style={{ marginLeft: 8 }} />
          </View>

          {/* Subtitle */}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {/* Collect button */}
          <TouchableOpacity style={styles.collectBtn} onPress={handleClose} activeOpacity={0.8}>
            <LinearGradient
              colors={['#a855f7', '#7c3aed']}
              style={styles.collectGradient}
            >
              <Text style={styles.collectText}>Collect</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    width: SCREEN_WIDTH * 0.85,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  coinContainer: {
    marginBottom: 20,
  },
  coinGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffd60a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  plus: {
    color: '#a855f7',
    fontSize: 32,
    fontWeight: '800',
    marginRight: 4,
  },
  coinsAmount: {
    color: '#ffd60a',
    fontSize: 48,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  collectBtn: {
    marginTop: 24,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  collectGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  collectText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default RewardPopup;
