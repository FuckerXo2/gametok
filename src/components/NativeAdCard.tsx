import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isExpoGo } from '../services/ads';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Use window dimensions that update on rotation/resize
const useScreenDimensions = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);
  
  return dimensions;
};

interface NativeAdCardProps {
  isActive?: boolean;
}

export const NativeAdCard: React.FC<NativeAdCardProps> = () => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useScreenDimensions();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const [AdComponents, setAdComponents] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // In Expo Go, just show placeholder - don't even try to load ad modules
    if (isExpoGo) {
      setAdLoaded(true);
      return;
    }

    // Dynamic import for native builds only
    // This code path is NEVER executed in Expo Go
    const loadAdComponent = async () => {
      try {
        // Use dynamic import with error handling
        const adModule = await import('react-native-google-mobile-ads');
        if (adModule && adModule.BannerAd) {
          setAdComponents({
            BannerAd: adModule.BannerAd,
            BannerAdSize: adModule.BannerAdSize,
            TestIds: adModule.TestIds,
          });
        } else {
          console.log('[Ad] Ad module loaded but components missing');
          setAdFailed(true);
        }
      } catch (e) {
        console.log('[Ad] Failed to load ad component:', e);
        setAdFailed(true);
      }
    };
    
    // Delay ad loading slightly to not block app launch
    const timer = setTimeout(loadAdComponent, 100);
    return () => clearTimeout(timer);
  }, []);

  // Placeholder/mock ad for Expo Go
  if (isExpoGo) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.adContainer}
        >
          {/* Sponsored badge */}
          <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>

          {/* Mock ad content */}
          <View style={styles.mockAdContent}>
            <View style={styles.mockAdImage}>
              <Ionicons name="game-controller" size={80} color="rgba(99, 102, 241, 0.5)" />
            </View>
            <Text style={styles.mockAdTitle}>Download Now!</Text>
            <Text style={styles.mockAdSubtitle}>The #1 Game of 2025</Text>
            <View style={styles.mockAdButton}>
              <Text style={styles.mockAdButtonText}>Install</Text>
            </View>
            <Text style={styles.mockAdNote}>[ Test Ad - Real ads in production build ]</Text>
          </View>

          {/* Bottom info */}
          <View style={[styles.adInfo, { paddingBottom: insets.bottom + 90 }]}>
            <View style={styles.adHeader}>
              <View style={styles.adIconPlaceholder}>
                <Ionicons name="megaphone" size={24} color="#FF8E53" />
              </View>
              <View style={styles.adTitleContainer}>
                <Text style={styles.adHeadline}>Advertisement</Text>
                <Text style={styles.adSubtitle}>Tap to learn more</Text>
              </View>
            </View>
          </View>

          {/* Side actions */}
          <View style={[styles.sideActions, { bottom: insets.bottom + 100 }]}>
            <View style={styles.actionBtn}>
              <View style={styles.actionIcon}>
                <Ionicons name="information-circle-outline" size={26} color="rgba(255,255,255,0.6)" />
              </View>
              <Text style={styles.actionLabel}>Ad Info</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // If ad components not loaded yet, show loading
  if (!AdComponents) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.errorContainer}
        >
          <View style={styles.errorContent}>
            <ActivityIndicator size="large" color="#FF8E53" />
            <Text style={styles.errorText}>Loading ad...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const { BannerAd, BannerAdSize, TestIds} = AdComponents;
  // Use test ads in development, real ads in production
  const AD_UNIT_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-1961802731817431/8986743812';

  // If ad failed after retries, show a nice fallback
  if (adFailed) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.adContainer}
        >
          {/* Sponsored badge */}
          <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>

          {/* Fallback ad content */}
          <View style={styles.mockAdContent}>
            <View style={styles.mockAdImage}>
              <Ionicons name="game-controller" size={80} color="rgba(99, 102, 241, 0.5)" />
            </View>
            <Text style={styles.mockAdTitle}>GameTOK</Text>
            <Text style={styles.mockAdSubtitle}>Play unlimited games</Text>
            <View style={styles.mockAdButton}>
              <Text style={styles.mockAdButtonText}>Keep Playing</Text>
            </View>
          </View>

          {/* Bottom info */}
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

          {/* Side actions */}
          <View style={[styles.sideActions, { bottom: insets.bottom + 100 }]}>
            <View style={styles.actionBtn}>
              <View style={styles.actionIcon}>
                <Ionicons name="information-circle-outline" size={26} color="rgba(255,255,255,0.6)" />
              </View>
              <Text style={styles.actionLabel}>Ad Info</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f0f23']}
        style={styles.adContainer}
      >
        {/* Sponsored badge */}
        <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
          <Text style={styles.sponsoredText}>Sponsored</Text>
        </View>

        {/* Ad content area */}
        <View style={styles.adContent}>
          {!adLoaded && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FF8E53" />
            </View>
          )}
          
          <BannerAd
            unitId={AD_UNIT_ID}
            size={BannerAdSize.MEDIUM_RECTANGLE}
            requestOptions={{
              requestNonPersonalizedAdsOnly: false,
            }}
            onAdLoaded={() => {
              console.log('[Ad] Ad loaded successfully');
              setAdLoaded(true);
              setAdFailed(false);
            }}
            onAdFailedToLoad={(error: any) => {
              console.log('[Ad] Failed to load - Error code:', error?.code);
              console.log('[Ad] Error message:', error?.message);
              console.log('[Ad] Full error:', JSON.stringify(error));
              // After 2 retries, show fallback
              if (retryCount >= 2) {
                setAdFailed(true);
              } else {
                // Retry after delay
                setTimeout(() => setRetryCount(prev => prev + 1), 2000);
              }
            }}
          />
        </View>

        {/* Bottom info */}
        <View style={[styles.adInfo, { paddingBottom: insets.bottom + 90 }]}>
          <View style={styles.adHeader}>
            <View style={styles.adIconPlaceholder}>
              <Ionicons name="megaphone" size={24} color="#FF8E53" />
            </View>
            <View style={styles.adTitleContainer}>
              <Text style={styles.adHeadline}>Advertisement</Text>
              <Text style={styles.adSubtitle}>Tap to learn more</Text>
            </View>
          </View>
        </View>

        {/* Side actions */}
        <View style={[styles.sideActions, { bottom: insets.bottom + 100 }]}>
          <View style={styles.actionBtn}>
            <View style={styles.actionIcon}>
              <Ionicons name="information-circle-outline" size={26} color="rgba(255,255,255,0.6)" />
            </View>
            <Text style={styles.actionLabel}>Ad Info</Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    alignItems: 'center',
  },
  errorTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  errorText: {
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
    fontSize: 14,
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
  adContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Mock ad styles for Expo Go
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
  adInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 70,
    paddingHorizontal: 16,
  },
  adHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sideActions: {
    position: 'absolute',
    right: 8,
    alignItems: 'center',
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default NativeAdCard;
