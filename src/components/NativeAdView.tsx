import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isExpoGo, getNativeAdUnitId } from '../services/ads';

// Import AdMob components directly (will be undefined in Expo Go)
let NativeAdClass: any;
let NativeAdViewComponent: any;
let NativeMediaView: any;
let NativeAsset: any;
let NativeAssetType: any;
let TestIds: any;

try {
  const adModule = require('react-native-google-mobile-ads');
  NativeAdClass = adModule.NativeAd;
  NativeAdViewComponent = adModule.NativeAdView;
  NativeMediaView = adModule.NativeMediaView;
  NativeAsset = adModule.NativeAsset;
  NativeAssetType = adModule.NativeAssetType;
  TestIds = adModule.TestIds;
} catch (e) {
  console.log('[Ad] AdMob module not available');
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
  const adRef = useRef<any>(null);

  // Check if AdMob is available
  const hasAdMob = !isExpoGo && NativeAdClass && NativeAdViewComponent && NativeMediaView;

  // Load native ad
  useEffect(() => {
    if (!hasAdMob) return;

    const loadAd = async () => {
      try {
        const adUnitId = __DEV__ ? TestIds.NATIVE : getNativeAdUnitId();
        console.log('[Ad] Loading native ad with unit ID:', adUnitId);

        const ad = await NativeAdClass.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: false,
        });

        adRef.current = ad;
        setNativeAd(ad);
        setAdLoaded(true);
        setAdFailed(false);
        console.log('[Ad] Native ad loaded successfully');
      } catch (error: any) {
        console.log('[Ad] Failed to load native ad:', error?.message || error);
        if (retryCount < 2) {
          setTimeout(() => setRetryCount(prev => prev + 1), 2000);
        } else {
          setAdFailed(true);
        }
      }
    };

    loadAd();

    return () => {
      if (adRef.current?.destroy) {
        adRef.current.destroy();
      }
    };
  }, [hasAdMob, retryCount]);

  // Placeholder for Expo Go or if AdMob not available
  if (isExpoGo || !hasAdMob) {
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

  // Render AdMob native ad
  return (
    <View style={[styles.container, { height: contentHeight }]}>
      <NativeAdViewComponent nativeAd={nativeAd} style={styles.nativeAdWrapper}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.adContainer}
        >
          <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>

          <View style={styles.mediaContainer}>
            <NativeMediaView style={styles.nativeMediaView} />
          </View>

          <View style={[styles.adInfoOverlay, { paddingBottom: insets.bottom + 90 }]}>
            <View style={styles.adHeader}>
              {nativeAd.icon && NativeAsset && (
                <NativeAsset assetType={NativeAssetType?.ICON}>
                  <Image
                    source={{ uri: nativeAd.icon.url }}
                    style={styles.adIcon}
                  />
                </NativeAsset>
              )}
              {!nativeAd.icon && (
                <View style={styles.adIconPlaceholder}>
                  <Ionicons name="megaphone" size={24} color="#FF8E53" />
                </View>
              )}

              <View style={styles.adTitleContainer}>
                {NativeAsset && (
                  <NativeAsset assetType={NativeAssetType?.HEADLINE}>
                    <Text style={styles.adHeadline} numberOfLines={1}>
                      {nativeAd.headline || 'Advertisement'}
                    </Text>
                  </NativeAsset>
                )}

                {nativeAd.body && NativeAsset && (
                  <NativeAsset assetType={NativeAssetType?.BODY}>
                    <Text style={styles.adSubtitle} numberOfLines={2}>
                      {nativeAd.body}
                    </Text>
                  </NativeAsset>
                )}
                {!nativeAd.body && (
                  <Text style={styles.adSubtitle}>Tap to learn more</Text>
                )}
              </View>

              {nativeAd.callToAction && NativeAsset && (
                <NativeAsset assetType={NativeAssetType?.CALL_TO_ACTION}>
                  <View style={styles.ctaButton}>
                    <Text style={styles.ctaText}>{nativeAd.callToAction}</Text>
                  </View>
                </NativeAsset>
              )}
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
      </NativeAdViewComponent>
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
  nativeAdWrapper: {
    flex: 1,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeMediaView: {
    width: '100%',
    height: '100%',
  },
  adInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 70,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  adIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
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
  ctaButton: {
    backgroundColor: '#FF8E53',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
