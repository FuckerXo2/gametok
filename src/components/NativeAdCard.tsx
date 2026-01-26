import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isExpoGo, showInterstitial } from '../services/ads';

interface NativeAdCardProps {
  isActive?: boolean;
}

export const NativeAdCard: React.FC<NativeAdCardProps> = ({ isActive }) => {
  const insets = useSafeAreaInsets();

  const handleAdPress = async () => {
    if (!isExpoGo) {
      await showInterstitial();
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f0f23']}
        style={styles.adContainer}
      >
        <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
          <Text style={styles.sponsoredText}>Sponsored</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.mockAdContent} 
          onPress={handleAdPress}
          activeOpacity={0.8}
        >
          <View style={styles.mockAdImage}>
            <Ionicons name="game-controller" size={80} color="rgba(99, 102, 241, 0.5)" />
          </View>
          <Text style={styles.mockAdTitle}>GameTOK</Text>
          <Text style={styles.mockAdSubtitle}>Swipe to keep playing</Text>
          <View style={styles.mockAdButton}>
            <Text style={styles.mockAdButtonText}>Continue</Text>
          </View>
          {isExpoGo && (
            <Text style={styles.mockAdNote}>[ Ads disabled in Expo Go ]</Text>
          )}
        </TouchableOpacity>
        
        <View style={[styles.adInfo, { paddingBottom: insets.bottom + 90 }]}>
          <View style={styles.adHeader}>
            <View style={styles.adIconPlaceholder}>
              <Ionicons name="megaphone" size={24} color="#FF8E53" />
            </View>
            <View style={styles.adTitleContainer}>
              <Text style={styles.adHeadline}>Advertisement</Text>
              <Text style={styles.adSubtitle}>Swipe to continue</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  adContainer: {
    flex: 1,
  },
  sponsoredBadge: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  sponsoredText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  adHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adTitleContainer: {
    flex: 1,
  },
  adHeadline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  adSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  adInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 70,
    paddingHorizontal: 16,
  },
  mockAdContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mockAdImage: {
    width: 160,
    height: 160,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  mockAdTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  mockAdSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
  },
  mockAdButton: {
    backgroundColor: '#FF8E53',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  mockAdButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  mockAdNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});

export default NativeAdCard;
