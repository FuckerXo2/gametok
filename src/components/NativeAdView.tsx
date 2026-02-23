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
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo' || (Constants.executionEnvironment as string) === 'expoGo';

// Import Google Mobile Ads native ad components (will be undefined in Expo Go)
let GNativeAd: any;
let GNativeAdView: any;
let GNativeAsset: any;
let GNativeAssetType: any;
let GNativeMediaView: any;
let GTestIds: any;

try {
  const gmaModule = require('react-native-google-mobile-ads');
  GNativeAd = gmaModule.NativeAd;
  GNativeAdView = gmaModule.NativeAdView;
  GNativeAsset = gmaModule.NativeAsset;
  GNativeAssetType = gmaModule.NativeAssetType;
  GNativeMediaView = gmaModule.NativeMediaView;
  GTestIds = gmaModule.TestIds;
} catch (e) {
  console.log('[Ad] Google Mobile Ads module not available');
}

// TODO: Replace with your real native ad unit ID from AdMob
const NATIVE_AD_UNIT_ID = __DEV__
  ? GTestIds?.NATIVE || 'ca-app-pub-3940256099942544/3986624511' // Test ID
  : 'ca-app-pub-1961802731817431/8986743812'; // Production ad unit ID

interface NativeAdViewProps {
  contentHeight: number;
}

const NativeAdComponent: React.FC<NativeAdViewProps> = ({ contentHeight }) => {
  const insets = useSafeAreaInsets();
  const [nativeAd, setNativeAd] = useState<any>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Check if Google Mobile Ads is available
  const hasGMA = !isExpoGo && GNativeAd && GNativeAdView;

  // Create and load native ad
  useEffect(() => {
    if (!hasGMA) return;

    let destroyed = false;

    const loadAd = async () => {
      try {
        console.log('[Ad] Creating Google native ad...');
        const ad = await GNativeAd.createForAdRequest(NATIVE_AD_UNIT_ID, {
          requestNonPersonalizedAdsOnly: false,
        });

        if (destroyed) {
          ad.destroy();
          return;
        }

        console.log('[Ad] Google native ad loaded:', ad.headline);
        setNativeAd(ad);
        setAdLoaded(true);
        setAdFailed(false);
      } catch (error: any) {
        console.log('[Ad] Google native ad load failed:', error?.message || error);
        if (!destroyed && retryCount < 2) {
          console.log('[Ad] Retrying... (attempt', retryCount + 1, 'of 2)');
          setTimeout(() => {
            if (!destroyed) setRetryCount(prev => prev + 1);
          }, 3000);
        } else if (!destroyed) {
          console.log('[Ad] Max retries reached, showing fallback');
          setAdFailed(true);
        }
      }
    };

    loadAd();

    // Timeout after 15 seconds if no response
    const timeout = setTimeout(() => {
      if (!adLoaded && !destroyed) {
        console.log('[Ad] Native ad load timeout - no response after 15s');
        setAdFailed(true);
      }
    }, 15000);

    return () => {
      destroyed = true;
      clearTimeout(timeout);
      if (nativeAd) {
        try {
          nativeAd.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [hasGMA, retryCount]);

  // Placeholder for Expo Go or if GMA not available
  if (isExpoGo || !hasGMA) {
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

  // Render Google native ad with custom layout
  return (
    <View style={[styles.container, { height: contentHeight }]}>
      <GNativeAdView
        nativeAd={nativeAd}
        style={[styles.container, { width: '100%', height: '100%' }]}
      >
        <View
          style={[styles.adContainer, { backgroundColor: '#16213e' }]}
        >
          <View style={[styles.sponsoredBadge, { top: insets.top + 10 }]}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>

          <View style={styles.nativeAdInner}>
            {/* Media content (image/video) */}
            {GNativeMediaView && (
              <GNativeMediaView style={styles.nativeMediaView} />
            )}

            {/* Ad icon + headline */}
            <View style={styles.nativeAdInfo}>
              {nativeAd.icon && (
                <GNativeAsset assetType={GNativeAssetType.ICON}>
                  <Image
                    source={{ uri: nativeAd.icon.uri }}
                    style={styles.nativeAdIcon}
                  />
                </GNativeAsset>
              )}
              <View style={styles.nativeAdTextContainer}>
                <GNativeAsset assetType={GNativeAssetType.HEADLINE}>
                  <Text style={styles.nativeAdHeadline} numberOfLines={2}>
                    {nativeAd.headline}
                  </Text>
                </GNativeAsset>
                {nativeAd.advertiser && (
                  <GNativeAsset assetType={GNativeAssetType.ADVERTISER}>
                    <Text style={styles.nativeAdAdvertiser} numberOfLines={1}>
                      {nativeAd.advertiser}
                    </Text>
                  </GNativeAsset>
                )}
              </View>
            </View>

            {/* Body text */}
            {nativeAd.body && (
              <GNativeAsset assetType={GNativeAssetType.BODY}>
                <Text style={styles.nativeAdBody} numberOfLines={3}>
                  {nativeAd.body}
                </Text>
              </GNativeAsset>
            )}

            {/* Star rating */}
            {nativeAd.starRating && (
              <View style={styles.starRatingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(nativeAd.starRating) ? 'star' : 'star-outline'}
                    size={16}
                    color="#FFD700"
                  />
                ))}
                <Text style={styles.starRatingText}>{nativeAd.starRating.toFixed(1)}</Text>
              </View>
            )}

            {/* CTA Button */}
            {nativeAd.callToAction && (
              <GNativeAsset assetType={GNativeAssetType.CALL_TO_ACTION}>
                <View style={styles.nativeCtaButton}>
                  <Text style={styles.nativeCtaText}>{nativeAd.callToAction}</Text>
                </View>
              </GNativeAsset>
            )}

            {/* Store & price */}
            {(nativeAd.store || nativeAd.price) && (
              <View style={styles.storeRow}>
                {nativeAd.store && (
                  <GNativeAsset assetType={GNativeAssetType.STORE}>
                    <Text style={styles.storeText}>{nativeAd.store}</Text>
                  </GNativeAsset>
                )}
                {nativeAd.price && (
                  <GNativeAsset assetType={GNativeAssetType.PRICE}>
                    <Text style={styles.priceText}>{nativeAd.price}</Text>
                  </GNativeAsset>
                )}
              </View>
            )}
          </View>

          <View style={[styles.sideActions, { bottom: insets.bottom + 100 }]}>
            <View style={styles.actionBtn}>
              <View style={styles.actionIcon}>
                <Ionicons name="information-circle-outline" size={26} color="rgba(255,255,255,0.6)" />
              </View>
              <Text style={styles.actionLabel}>Ad Info</Text>
            </View>
          </View>
        </View>
      </GNativeAdView>
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
  // Google native ad styles
  nativeAdContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 120,
  },
  nativeAdInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 120,
  },
  nativeMediaView: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  nativeAdInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nativeAdIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  nativeAdTextContainer: {
    flex: 1,
  },
  nativeAdHeadline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  nativeAdAdvertiser: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  nativeAdBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    marginBottom: 16,
  },
  starRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  starRatingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginLeft: 8,
  },
  nativeCtaButton: {
    backgroundColor: '#FF8E53',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  nativeCtaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  storeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  storeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  priceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  // Shared styles
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

export default NativeAdComponent;
