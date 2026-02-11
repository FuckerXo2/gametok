import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo' || (Constants.executionEnvironment as string) === 'expoGo';

// Import LevelPlay components (will be undefined in Expo Go)
let LevelPlayNativeAd: any;
let LevelPlayNativeAdView: any;
let LevelPlayTemplateType: any;

try {
  const levelPlayModule = require('unity-levelplay-mediation');
  LevelPlayNativeAd = levelPlayModule.LevelPlayNativeAd;
  LevelPlayNativeAdView = levelPlayModule.LevelPlayNativeAdView;
  LevelPlayTemplateType = levelPlayModule.LevelPlayTemplateType;
} catch (e) {
  console.log('[Ad] LevelPlay module not available');
}

interface NativeAdViewProps {
  contentHeight: number;
}

const NativeAdView: React.FC<NativeAdViewProps> = ({ contentHeight }) => {
  const insets = useSafeAreaInsets();
  const [nativeAd, setNativeAd] = useState<any>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Check if LevelPlay is available
  const hasLevelPlay = !isExpoGo && LevelPlayNativeAd && LevelPlayNativeAdView;

  // Create and load native ad
  useEffect(() => {
    if (!hasLevelPlay) return;

    let ad: any = null;

    const createAd = () => {
      try {
        console.log('[Ad] Creating LevelPlay native ad...');
        
        const listener = {
          onAdLoaded: (loadedAd: any, adInfo: any) => {
            console.log('[Ad] LevelPlay native ad loaded:', JSON.stringify(adInfo));
            setAdLoaded(true);
            setAdFailed(false);
          },
          onAdLoadFailed: (failedAd: any, error: any) => {
            console.log('[Ad] LevelPlay native ad load failed:', JSON.stringify(error));
            if (retryCount < 2) {
              setTimeout(() => setRetryCount(prev => prev + 1), 3000);
            } else {
              setAdFailed(true);
            }
          },
          onAdImpression: (impressionAd: any, adInfo: any) => {
            console.log('[Ad] LevelPlay native ad impression');
          },
          onAdClicked: (clickedAd: any, adInfo: any) => {
            console.log('[Ad] LevelPlay native ad clicked');
          },
        };

        console.log('[Ad] Building native ad with placement: Home_Screen');
        ad = LevelPlayNativeAd.builder()
          .withPlacement('Home_Screen')
          .withListener(listener)
          .build();

        setNativeAd(ad);
        
        console.log('[Ad] Native ad object created, calling loadAd()...');
        // Load the ad
        ad.loadAd();
        console.log('[Ad] LevelPlay native ad load requested');
        
        // Timeout after 10 seconds if no response
        setTimeout(() => {
          if (!adLoaded) {
            console.log('[Ad] Native ad load timeout - no response after 10s');
            setAdFailed(true);
          }
        }, 10000);
      } catch (error: any) {
        console.log('[Ad] Error creating LevelPlay native ad:', error?.message || error);
        setAdFailed(true);
      }
    };

    createAd();

    return () => {
      if (ad) {
        try {
          ad.destroyAd();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [hasLevelPlay, retryCount]);

  // Placeholder for Expo Go or if LevelPlay not available
  if (isExpoGo || !hasLevelPlay) {
    return (
      <View style={[styles.container, { height: contentHeight }]}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.adContainer}
        >
          <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>

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

  // Fallback if ad failed
  if (adFailed) {
    return (
      <View style={[styles.container, { height: contentHeight }]}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.adContainer}
        >
          <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>

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

  // Loading state
  if (!adLoaded || !nativeAd) {
    return (
      <View style={[styles.container, { height: contentHeight }]}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.adContainer}
        >
          <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF8E53" />
            <Text style={styles.loadingText}>Loading ad...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Render LevelPlay native ad using Medium template (better for full-screen feed)
  return (
    <View style={[styles.container, { height: contentHeight }]}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f0f23']}
        style={styles.adContainer}
      >
        <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
          <Text style={styles.sponsoredText}>Sponsored</Text>
        </View>

        <View style={styles.nativeAdContainer}>
          <LevelPlayNativeAdView
            style={styles.levelPlayNativeAd}
            nativeAd={nativeAd}
            templateType={LevelPlayTemplateType.Medium}
          />
        </View>

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
    backgroundColor: '#000',
  },
  adContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
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
  nativeAdContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  levelPlayNativeAd: {
    width: 300,
    height: 350,
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

export default NativeAdView;
