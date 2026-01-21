import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isExpoGo } from '../services/ads';

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

export const NativeAdCard: React.FC<NativeAdCardProps> = ({ isActive }) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useScreenDimensions();
  const [nativeAd, setNativeAd] = useState<any>(null);
  const [adFailed, setAdFailed] = useState(false);
  const [AdComponents, setAdComponents] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load ad components dynamically (for native builds only)
  useEffect(() => {
    if (isExpoGo) {
      setIsLoading(false);
      return;
    }

    const loadAdModule = async () => {
      try {
        const adModule = await import('react-native-google-mobile-ads');
        setAdComponents({
          NativeAd: adModule.NativeAd,
          NativeAdView: adModule.NativeAdView,
          NativeMediaView: adModule.NativeMediaView,
          NativeAsset: adModule.NativeAsset,
          NativeAssetType: adModule.NativeAssetType,
          TestIds: adModule.TestIds,
        });
      } catch (e) {
        console.log('[Ad] Failed to load ad module:', e);
        setAdFailed(true);
        setIsLoading(false);
      }
    };
    
    loadAdModule();
  }, []);

  // Load the actual ad once components are ready
  useEffect(() => {
    if (!AdComponents || isExpoGo) return;

    const { NativeAd, TestIds } = AdComponents;
    const AD_UNIT_ID = __DEV__ ? TestIds.NATIVE : 'ca-app-pub-1961802731817431/8986743812';

    console.log('[Ad] Loading native ad with unit ID:', AD_UNIT_ID);

    NativeAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    })
      .then((ad: any) => {
        console.log('[Ad] Native ad loaded successfully');
        console.log('[Ad] Headline:', ad.headline);
        console.log('[Ad] Body:', ad.body);
        setNativeAd(ad);
        setIsLoading(false);
      })
      .catch((error: any) => {
        console.log('[Ad] Failed to load native ad:', error);
        console.log('[Ad] Error code:', error?.code);
        console.log('[Ad] Error message:', error?.message);
        setAdFailed(true);
        setIsLoading(false);
      });

    // Cleanup
    return () => {
      if (nativeAd) {
        nativeAd.destroy?.();
      }
    };
  }, [AdComponents]);

  // Placeholder/mock ad for Expo Go
  if (isExpoGo) {
    return (
      <View style={styles.container}>
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
            <Text style={styles.mockAdSubtitle}>The #1 Game of 2026</Text>
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
        </LinearGradient>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.loadingContainer}
        >
          <ActivityIndicator size="large" color="#FF8E53" />
          <Text style={styles.loadingText}>Loading ad...</Text>
        </LinearGradient>
      </View>
    );
  }

  // Failed state - show fallback
  if (adFailed || !nativeAd) {
    return (
      <View style={styles.container}>
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
        </LinearGradient>
      </View>
    );
  }

  // Real native ad
  const { NativeAdView, NativeMediaView, NativeAsset, NativeAssetType } = AdComponents;

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.nativeAdViewRoot}>
      {/* Sponsored badge at top */}
      <View style={[styles.sponsoredBadgeTop, { marginTop: insets.top + 10 }]}>
        <Text style={styles.sponsoredText}>Sponsored</Text>
      </View>

      {/* Media content - takes up available space */}
      <View style={styles.mediaContainerFlex}>
        <NativeMediaView style={styles.nativeMediaViewFlex} resizeMode="contain" />
      </View>

      {/* Ad info at bottom - using flex, not absolute */}
      <View style={[styles.adInfoBottom, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.adHeader}>
          {nativeAd.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image 
                source={{ uri: nativeAd.icon.url }} 
                style={styles.adIcon}
              />
            </NativeAsset>
          ) : null}
          <View style={[styles.adTitleContainer, !nativeAd.icon && { marginLeft: 0 }]}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.adHeadline} numberOfLines={1}>
                {nativeAd.headline || 'Advertisement'}
              </Text>
            </NativeAsset>
            {nativeAd.body && (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={styles.adSubtitle} numberOfLines={1}>
                  {nativeAd.body}
                </Text>
              </NativeAsset>
            )}
          </View>
        </View>
        {nativeAd.callToAction && (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.ctaButtonText}>{nativeAd.callToAction}</Text>
          </NativeAsset>
        )}
      </View>
    </NativeAdView>
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
  // Old absolute positioned badge (for mock ads)
  sponsoredBadge: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  // New flex-based badge for real ads
  sponsoredBadgeTop: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sponsoredText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  // Root NativeAdView - full screen, flex column
  nativeAdViewRoot: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  nativeAdView: {
    flex: 1,
  },
  nativeAdViewFull: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  mediaContainerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Flex-based media container
  mediaContainerFlex: {
    flex: 1,
  },
  nativeMediaView: {
    width: '100%',
    height: '100%',
  },
  nativeMediaViewFull: {
    width: '100%',
    height: '100%',
  },
  nativeMediaViewFlex: {
    flex: 1,
  },
  nativeAdInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  // Flex-based bottom info (not absolute)
  adInfoBottom: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  adHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // CTA as direct Text child of NativeAsset (per docs)
  ctaButtonText: {
    backgroundColor: '#FF8E53',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    overflow: 'hidden',
    textAlign: 'center',
    marginBottom: 8,
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
