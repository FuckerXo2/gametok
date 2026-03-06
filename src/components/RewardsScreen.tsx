import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { RewardedAd, RewardedAdEventType, TestIds, AdEventType } from 'react-native-google-mobile-ads';
import { isExpoGo } from '../services/ads';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { gamification } from '../services/api';
import { RewardPopup } from './RewardPopup';
import { useAuthScreen } from '../../App';
import { AchievementsModal } from './AchievementsModal';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';
import { FontStyles } from '../constants/LoopsFonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GamificationStats {
  points: { balance: number; lifetimeEarned: number; usdValue?: number; coinsPerUsd?: number };
  streak: { current: number; longest: number; lastClaimDate: string | null; multiplier: number };
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  reward_points: number;
  reward_xp: number;
  completed: boolean;
  claimed: boolean;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  reward_points: number;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: string;
  image_url?: string;
  stock?: number;
}

// Hero card with animated gradient background
const HeroCard: React.FC<{
  balance: number;
  streak: number;
  multiplier: number;
  usdValue?: number;
  loading: boolean;
}> = ({ balance, streak, multiplier, usdValue, loading }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    if (streak > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [streak]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View style={styles.heroCard}>
      <LinearGradient
        colors={[LoopsColors.color1, LoopsColors.color3, LoopsColors.color4]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <Animated.View
          style={[styles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]}
        >
          <LinearGradient
            colors={['transparent', LoopsColors.white05, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.heroMain}>
          <Text style={styles.heroLabel}>TOTAL COINS</Text>
          {loading ? (
            <ActivityIndicator color={LoopsColors.coinGold} size="large" />
          ) : (
            <>
              <View style={styles.balanceRow}>
                <View style={styles.bigCoinIcon}>
                  <Image source={require('../../assets/ui/coins/coins_small_1.png')} style={{ width: 40, height: 40 }} />
                </View>
                <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
              </View>
              <Text style={styles.usdValue}>≈ ${(usdValue !== undefined && usdValue > 0 ? usdValue : balance / 5667).toFixed(2)} USD</Text>
            </>
          )}
        </View>

        {/* Streak section */}
        {streak > 0 && (
          <View style={styles.streakSection}>
            <Animated.View style={[styles.streakBadge, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="flame" size={22} color={LoopsColors.color2} />
              <Text style={styles.streakNum}>{streak}</Text>
            </Animated.View>
            <Text style={styles.streakLabel}>Day Streak</Text>
            {multiplier > 1 && (
              <View style={styles.multiplierPill}>
                <Text style={styles.multiplierText}>{multiplier}x bonus</Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

// Get icon for challenge type
const getChallengeIcon = (iconName: string): { name: string; family: 'ionicons' | 'material' | 'fontawesome' } => {
  const iconMap: Record<string, { name: string; family: 'ionicons' | 'material' | 'fontawesome' }> = {
    '🎮': { name: 'game-controller', family: 'ionicons' },
    '🏆': { name: 'trophy', family: 'ionicons' },
    '⏱️': { name: 'timer', family: 'ionicons' },
    '❤️': { name: 'heart', family: 'ionicons' },
    '💬': { name: 'chatbubble', family: 'ionicons' },
    '👥': { name: 'people', family: 'ionicons' },
    '🔗': { name: 'share-social', family: 'ionicons' },
    '📱': { name: 'phone-portrait', family: 'ionicons' },
    '⭐': { name: 'star', family: 'ionicons' },
    '🎯': { name: 'bullseye', family: 'material' },
  };
  return iconMap[iconName] || { name: 'game-controller', family: 'ionicons' };
};

const ChallengeIconComponent: React.FC<{ icon: string; size?: number; color?: string }> = ({ icon, size = 20, color = LoopsColors.white }) => {
  const iconData = getChallengeIcon(icon);
  if (iconData.family === 'material') {
    return <MaterialCommunityIcons name={iconData.name as any} size={size} color={color} />;
  }
  return <Ionicons name={iconData.name as any} size={size} color={color} />;
};

// Daily missions section
const DailyMissions: React.FC<{
  challenges: Challenge[];
  onClaim: (id: string) => void;
  claimingId: string | null;
  loading: boolean;
}> = ({ challenges, onClaim, claimingId, loading }) => {
  const hoursLeft = 24 - new Date().getHours();

  const displayChallenges = challenges.length > 0 ? challenges : [
    { id: '1', title: 'Play 3 Games', icon: '🎮', progress: 0, target: 3, reward_points: 50, completed: false, claimed: false },
    { id: '2', title: 'Win 1 Game', icon: '🏆', progress: 0, target: 1, reward_points: 100, completed: false, claimed: false },
    { id: '3', title: 'Play for 10 min', icon: '⏱️', progress: 0, target: 10, reward_points: 75, completed: false, claimed: false },
  ] as Challenge[];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: LoopsColors.color6 + '33' }]}>
            <MaterialCommunityIcons name="target" size={18} color={LoopsColors.color6} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Daily Missions</Text>
            <Text style={styles.sectionSub}>Resets in {hoursLeft}h</Text>
          </View>
        </View>
        <View style={styles.missionProgress}>
          <Text style={styles.missionProgressText}>
            {displayChallenges.filter(c => c.completed).length}/{displayChallenges.length}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={LoopsColors.color6} />
        </View>
      ) : (
        <View style={styles.missionsGrid}>
          {displayChallenges.map((challenge) => {
            const progress = Math.min(challenge.progress / challenge.target, 1);
            const isComplete = challenge.completed && !challenge.claimed;
            const isClaimed = challenge.claimed;

            return (
              <TouchableOpacity
                key={challenge.id}
                style={[
                  styles.missionCard,
                  isComplete && styles.missionCardComplete,
                  isClaimed && styles.missionCardClaimed,
                ]}
                onPress={isComplete ? () => onClaim(challenge.id) : undefined}
                activeOpacity={isComplete ? 0.8 : 1}
                disabled={claimingId === challenge.id}
              >
                <View style={styles.missionTop}>
                  <View style={[styles.missionIconWrap, isComplete && styles.missionIconComplete]}>
                    <ChallengeIconComponent icon={challenge.icon} size={18} color={isComplete ? LoopsColors.coinGold : LoopsColors.color6} />
                  </View>
                  <View style={styles.missionReward}>
                    <Text style={styles.missionRewardText}>+{challenge.reward_points}</Text>
                    <Image source={require('../../assets/ui/coins/coins_small.png')} style={{ width: 12, height: 12 }} />
                  </View>
                </View>

                <Text style={styles.missionTitle}>{challenge.title}</Text>

                <View style={styles.missionProgressBar}>
                  <LinearGradient
                    colors={isClaimed ? [LoopsColors.mainGreen, LoopsColors.successDark] : isComplete ? [LoopsColors.coinGold, LoopsColors.warningDark] : [LoopsColors.color6, LoopsColors.color7]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.missionProgressFill, { width: `${progress * 100}%` }]}
                  />
                </View>

                <Text style={styles.missionProgressText2}>
                  {isClaimed ? '✓ Claimed' : `${challenge.progress}/${challenge.target}`}
                </Text>

                {isComplete && claimingId !== challenge.id && (
                  <View style={styles.claimOverlay}>
                    <Text style={styles.claimOverlayText}>TAP TO CLAIM</Text>
                  </View>
                )}
                {claimingId === challenge.id && (
                  <View style={styles.claimOverlay}>
                    <ActivityIndicator color={LoopsColors.white} size="small" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

// Get icon for achievement
const getAchievementIcon = (iconName: string): { name: string; family: 'ionicons' | 'material' | 'fontawesome' } => {
  const iconMap: Record<string, { name: string; family: 'ionicons' | 'material' | 'fontawesome' }> = {
    '👶': { name: 'footsteps', family: 'ionicons' },
    '🎮': { name: 'game-controller', family: 'ionicons' },
    '🔥': { name: 'flame', family: 'ionicons' },
    '🦋': { name: 'people', family: 'ionicons' },
    '💎': { name: 'diamond', family: 'ionicons' },
    '🏆': { name: 'trophy', family: 'ionicons' },
    '⭐': { name: 'star', family: 'ionicons' },
    '🎯': { name: 'bullseye', family: 'material' },
    '💪': { name: 'fitness', family: 'ionicons' },
    '🚀': { name: 'rocket', family: 'ionicons' },
  };
  return iconMap[iconName] || { name: 'ribbon', family: 'ionicons' };
};

const AchievementIconComponent: React.FC<{ icon: string; size?: number; color?: string }> = ({ icon, size = 24, color = LoopsColors.white }) => {
  const iconData = getAchievementIcon(icon);
  if (iconData.family === 'material') {
    return <MaterialCommunityIcons name={iconData.name as any} size={size} color={color} />;
  }
  return <Ionicons name={iconData.name as any} size={size} color={color} />;
};

// Achievements showcase
const AchievementsShowcase: React.FC<{
  achievements: Achievement[];
  onPress: (a: Achievement) => void;
  onSeeAll: () => void;
}> = ({ achievements, onPress, onSeeAll }) => {
  const displayAchievements = achievements.length > 0 ? achievements : [
    { id: '1', name: 'First Steps', icon: '👶', unlocked: false, reward_points: 100 },
    { id: '2', name: 'Game Master', icon: '🎮', unlocked: false, reward_points: 250 },
    { id: '3', name: 'On Fire', icon: '🔥', unlocked: false, reward_points: 500 },
    { id: '4', name: 'Social Star', icon: '🦋', unlocked: false, reward_points: 200 },
    { id: '5', name: 'Collector', icon: '💎', unlocked: false, reward_points: 1000 },
  ] as Achievement[];

  const unlockedCount = displayAchievements.filter(a => a.unlocked).length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: LoopsColors.warningDark + '33' }]}>
            <Ionicons name="trophy" size={18} color={LoopsColors.warningDark} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Text style={styles.sectionSub}>{unlockedCount} of {displayAchievements.length} unlocked</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.seeAllBtn} onPress={onSeeAll}>
          <Text style={styles.seeAllText}>See All</Text>
          <Ionicons name="chevron-forward" size={16} color={LoopsColors.color6} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.achievementsScroll}
      >
        {displayAchievements.slice(0, 8).map((achievement) => (
          <TouchableOpacity
            key={achievement.id}
            style={[styles.achievementCard, !achievement.unlocked && styles.achievementLocked]}
            onPress={() => onPress(achievement)}
            activeOpacity={0.8}
          >
            <View style={[styles.achievementIconWrap, achievement.unlocked && styles.achievementIconUnlocked]}>
              <AchievementIconComponent
                icon={achievement.icon}
                size={24}
                color={achievement.unlocked ? LoopsColors.color6 : LoopsColors.white40}
              />
              {achievement.unlocked && (
                <View style={styles.achievementCheck}>
                  <Ionicons name="checkmark-circle" size={18} color={LoopsColors.mainGreen} />
                </View>
              )}
            </View>
            <Text style={styles.achievementName} numberOfLines={2}>{achievement.name}</Text>
            <View style={styles.achievementReward}>
              <Text style={styles.achievementRewardText}>+{achievement.reward_points}</Text>
              <Image source={require('../../assets/ui/coins/coins_small.png')} style={{ width: 11, height: 11 }} />
            </View>
            {!achievement.unlocked && <View style={styles.lockedOverlay} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Rewards marketplace
const RewardsMarketplace: React.FC<{
  rewards: Reward[];
  balance: number;
  onClaim: (r: Reward) => void;
}> = ({ rewards, balance, onClaim }) => {
  const displayRewards = rewards.length > 0 ? rewards : [
    { id: '1', name: '$5 Amazon Gift Card', description: 'Redeem for Amazon credit', cost: 5000, category: 'giftcard' },
    { id: '2', name: '$10 App Store', description: 'iOS App Store credit', cost: 10000, category: 'giftcard' },
    { id: '3', name: 'VIP Badge', description: 'Show off your status', cost: 2500, category: 'badge' },
    { id: '4', name: '2x Points Boost', description: '24 hour double points', cost: 1000, category: 'boost' },
    { id: '5', name: 'Custom Avatar Frame', description: 'Stand out from the crowd', cost: 1500, category: 'cosmetic' },
    { id: '6', name: '$25 PlayStation', description: 'PSN Store credit', cost: 25000, category: 'giftcard' },
  ] as Reward[];

  const getCategoryGradient = (category: string): [string, string] => {
    switch (category) {
      case 'giftcard': return [LoopsColors.warningDark, LoopsColors.warning];
      case 'badge': return [LoopsColors.color6, LoopsColors.color8];
      case 'boost': return [LoopsColors.mainBlue, LoopsColors.color9];
      case 'cosmetic': return [LoopsColors.mainPink, LoopsColors.color10];
      default: return [LoopsColors.color7, LoopsColors.color11];
    }
  };

  const getCategoryIcon = (category: string): { name: string; family: 'ionicons' | 'fontawesome' } => {
    switch (category) {
      case 'giftcard': return { name: 'gift', family: 'ionicons' };
      case 'badge': return { name: 'ribbon', family: 'ionicons' };
      case 'boost': return { name: 'flash', family: 'ionicons' };
      case 'cosmetic': return { name: 'sparkles', family: 'ionicons' };
      default: return { name: 'game-controller', family: 'ionicons' };
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIconWrap, { backgroundColor: LoopsColors.mainGreen + '33' }]}>
            <Ionicons name="storefront" size={18} color={LoopsColors.mainGreen} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Rewards Shop</Text>
            <Text style={styles.sectionSub}>Spend your coins</Text>
          </View>
        </View>
        <View style={styles.balancePill}>
          <Image source={require('../../assets/ui/coins/coins_small.png')} style={{ width: 14, height: 14 }} />
          <Text style={styles.balancePillText}>{balance.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.rewardsGrid}>
        {displayRewards.map((reward) => {
          const canAfford = balance >= reward.cost;
          const outOfStock = reward.stock !== undefined && reward.stock !== null && reward.stock <= 0;
          const iconData = getCategoryIcon(reward.category);

          return (
            <TouchableOpacity
              key={reward.id}
              style={[styles.rewardCard, !canAfford && styles.rewardCardDim]}
              onPress={canAfford && !outOfStock ? () => onClaim(reward) : undefined}
              activeOpacity={canAfford ? 0.8 : 1}
            >
              <LinearGradient
                colors={getCategoryGradient(reward.category)}
                style={styles.rewardIconBg}
              >
                <Ionicons name={iconData.name as any} size={24} color={LoopsColors.white} />
              </LinearGradient>

              <Text style={styles.rewardName} numberOfLines={2}>{reward.name}</Text>
              <Text style={styles.rewardDesc} numberOfLines={1}>{reward.description}</Text>

              <View style={[styles.rewardCostBadge, canAfford && styles.rewardCostAfford]}>
                <Image source={require('../../assets/ui/coins/coins_small.png')} style={{ width: 14, height: 14, tintColor: canAfford ? LoopsColors.mainGreen : LoopsColors.white50 }} />
                <Text style={[styles.rewardCostText, canAfford && styles.rewardCostTextAfford]}>
                  {reward.cost.toLocaleString()}
                </Text>
              </View>

              {outOfStock && (
                <View style={styles.soldOutBadge}>
                  <Text style={styles.soldOutText}>SOLD OUT</Text>
                </View>
              )}

              {!canAfford && !outOfStock && (
                <View style={styles.needMoreBadge}>
                  <Text style={styles.needMoreText}>Need {(reward.cost - balance).toLocaleString()} more</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Main component
export const RewardsScreen: React.FC<{ isActive?: boolean; onClose?: () => void }> = ({ isActive, onClose }) => {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { showAuthScreen, showLoginScreen } = useAuthScreen();

  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingChallenge, setClaimingChallenge] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Reward popup state
  const [rewardPopupVisible, setRewardPopupVisible] = useState(false);
  const [rewardPopupCoins, setRewardPopupCoins] = useState(0);
  const [rewardPopupTitle, setRewardPopupTitle] = useState('Reward Claimed!');
  const [rewardPopupSubtitle, setRewardPopupSubtitle] = useState<string | undefined>(undefined);
  const [achievementsModalVisible, setAchievementsModalVisible] = useState(false);

  // Rewarded Ad state
  const [rewardedAd, setRewardedAd] = useState<RewardedAd | null>(null);
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  // Store today's ad watches (can be 0 to 3)
  const [adWatchCount, setAdWatchCount] = useState(0);

  // Define reward logic explicitly for rewarded ads
  useEffect(() => {
    if (isExpoGo) return;

    // Use test ID in dev, real ID in prod
    const adUnitId = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-1961802731817431/8717446152';

    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsAdLoaded(true);
    });

    const unsubscribeEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      reward => {
        // Assume they get 1000 coins for completing the ad
        setAdWatchCount(prev => prev + 1);
        handleAdRewardEarned();
      },
    );

    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setIsAdLoaded(false);
      // Reload next ad if under limit
      if (adWatchCount < 3) {
        rewarded.load();
      }
    });

    // Start loading the ad 
    rewarded.load();
    setRewardedAd(rewarded);

    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
    };
  }, [adWatchCount]);

  const handleWatchAdPress = () => {
    if (adWatchCount >= 3) {
      Alert.alert("Daily Limit Reached", "You've already watched 3 ads today! Come back tomorrow for more.");
      return;
    }

    if (isExpoGo) {
      // Fake watch in Expo Go
      Alert.alert(
        "Mock Ad",
        "Watching a fake ad in Expo Go...",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Finish Ad",
            onPress: () => {
              setAdWatchCount(prev => prev + 1);
              handleAdRewardEarned();
            }
          }
        ]
      );
    } else if (isAdLoaded && rewardedAd) {
      try {
        rewardedAd.show();
      } catch (e) {
        Alert.alert("Ad Error", "Failed to show ad. Please try again later.");
      }
    } else {
      Alert.alert("Ad Loading", "The ad is still loading, please wait a moment and try again.");
    }
  };

  const handleAdRewardEarned = async () => {
    try {
      // Call backend to claim reward
      const res = await gamification.claimAdReward();

      if (res.success) {
        // Add coins locally
        setStats(prev => prev ? {
          ...prev,
          points: {
            ...prev.points,
            balance: prev.points.balance + res.pointsEarned,
            lifetimeEarned: prev.points.lifetimeEarned + res.pointsEarned
          }
        } : null);

        // Show success popup
        setRewardPopupCoins(res.pointsEarned);
        setRewardPopupTitle('Reward Earned!');
        setRewardPopupSubtitle(`Thanks for watching. ${res.pointsEarned} coins have been added to your balance!`);
        setRewardPopupVisible(true);
      }
    } catch (error) {
      console.error('Failed to claim ad reward:', error);
      Alert.alert("Claim Failed", "Could not verify your ad reward. Please try again later.");
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Refresh when tab becomes active (but not too frequently)
  useEffect(() => {
    if (isActive && isAuthenticated && !loading) {
      const now = Date.now();
      // Only refresh if it's been more than 5 seconds since last fetch
      if (now - lastFetchRef.current > 5000) {
        // Small delay to allow HomeScreen's sync to complete first
        setTimeout(() => {
          fetchData(true);
        }, 500);
      }
    }
  }, [isActive]); const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsRes, challengesRes, achievementsRes, rewardsRes] = await Promise.all([
        gamification.getStats(),
        gamification.getChallenges(),
        gamification.getAchievements(),
        gamification.getRewards(),
      ]);
      setStats(statsRes);
      setChallenges(challengesRes.challenges || []);
      setAchievements(achievementsRes.achievements || []);
      setRewards(rewardsRes.rewards || []);
      lastFetchRef.current = Date.now();
    } catch (e) {
      console.log('Failed to fetch rewards data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleClaimChallenge = async (challengeId: string) => {
    setClaimingChallenge(challengeId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await gamification.claimChallenge(challengeId);
      setStats(prev => prev ? {
        ...prev,
        points: {
          ...prev.points,
          balance: prev.points.balance + result.pointsEarned,
          lifetimeEarned: prev.points.lifetimeEarned + result.pointsEarned
        }
      } : null);
      setChallenges(prev => prev.map(c =>
        c.id === challengeId ? { ...c, claimed: true } : c
      ));
      // Show custom reward popup
      setRewardPopupCoins(result.pointsEarned);
      setRewardPopupTitle('Mission Complete!');
      setRewardPopupSubtitle('Coins added to your balance');
      setRewardPopupVisible(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to claim reward');
    } finally {
      setClaimingChallenge(null);
    }
  };

  const handleClaimReward = async (reward: Reward) => {
    Alert.alert(
      reward.name,
      `Spend ${reward.cost.toLocaleString()} coins on this reward?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              const result = await gamification.claimReward(reward.id);
              setStats(prev => prev ? {
                ...prev,
                points: { ...prev.points, balance: result.newBalance }
              } : null);
              // Show custom reward popup for successful claim
              setRewardPopupCoins(0);
              setRewardPopupTitle('Reward Claimed!');
              setRewardPopupSubtitle(`You've claimed: ${reward.name}\n\nCheck your email for redemption details.`);
              setRewardPopupVisible(true);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to claim');
            }
          }
        }
      ]
    );
  };

  const showAchievementDetail = (achievement: Achievement) => {
    Alert.alert(
      achievement.name,
      `${achievement.description || 'Complete this achievement to earn rewards!'}\n\n${achievement.unlocked ? 'Unlocked!' : `Reward: +${achievement.reward_points} coins`}`
    );
  };

  // Auth overlay component
  const AuthOverlay = () => (
    <View style={styles.authOverlay}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={styles.authTitle}>Sign up to continue</Text>
      <TouchableOpacity style={styles.authBtn} onPress={showAuthScreen} activeOpacity={0.8}>
        <LinearGradient colors={[LoopsColors.color6, LoopsColors.color8]} style={styles.authBtnGradient}>
          <Text style={styles.authBtnText}>Sign Up</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity onPress={showLoginScreen}>
        <Text style={styles.authLoginText}>or log in</Text>
      </TouchableOpacity>
    </View>
  );

  // Mock data for unauthenticated preview
  const previewStats = { points: { balance: 2450, usdValue: 0.02 }, streak: { current: 3, multiplier: 1.15 } };
  const previewChallenges = [
    { id: '1', title: 'Play 3 Games', icon: '🎮', progress: 1, target: 3, reward_points: 50, completed: false, claimed: false },
    { id: '2', title: 'Play 10 Minutes', icon: '⏱️', progress: 4, target: 10, reward_points: 75, completed: false, claimed: false },
    { id: '3', title: 'Like 5 Games', icon: '❤️', progress: 2, target: 5, reward_points: 30, completed: false, claimed: false },
  ] as Challenge[];

  return (
    <View style={[styles.container, { backgroundColor: LoopsColors.bgDark }]}>
      {onClose && (
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, zIndex: 10, alignSelf: 'flex-end', position: 'absolute' }}>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: LoopsColors.white20, justifyContent: 'center', alignItems: 'center' }}>
            <Image source={require('../../assets/ui/icons/ic_close.png')} style={{ width: 24, height: 24, tintColor: LoopsColors.white }} />
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={isAuthenticated}
      >
        <View style={{ paddingTop: insets.top + 8 }}>
          <HeroCard
            balance={isAuthenticated ? (stats?.points.balance || 0) : previewStats.points.balance}
            streak={isAuthenticated ? (stats?.streak.current || 0) : previewStats.streak.current}
            multiplier={isAuthenticated ? (stats?.streak.multiplier || 1) : previewStats.streak.multiplier}
            usdValue={isAuthenticated ? stats?.points.usdValue : previewStats.points.usdValue}
            loading={isAuthenticated && loading}
          />
        </View>

        {/* Watch Ad for Coins */}
        {isAuthenticated && (
          <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
            <TouchableOpacity
              style={[
                styles.adWatchRow,
                adWatchCount >= 3 && styles.adWatchRowDisabled
              ]}
              onPress={handleWatchAdPress}
              disabled={adWatchCount >= 3}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[LoopsColors.color6, LoopsColors.color8]} style={styles.adWatchGradient}>
                <View style={styles.adWatchContent}>
                  <View style={styles.adWatchIconContainer}>
                    <Ionicons name="play-circle" size={28} color={LoopsColors.white} />
                  </View>
                  <View style={styles.adWatchTextContainer}>
                    <Text style={styles.adWatchTitle}>Watch Ad for Coins</Text>
                    <Text style={styles.adWatchSubtitle}>
                      {3 - adWatchCount} left today • +1,000 coins each
                    </Text>
                  </View>
                  <Image source={require('../../assets/ui/coins/coins_small_1.png')} style={{ width: 24, height: 24 }} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <DailyMissions
          challenges={isAuthenticated ? challenges : previewChallenges}
          onClaim={handleClaimChallenge}
          claimingId={claimingChallenge}
          loading={isAuthenticated && loading}
        />

        <AchievementsShowcase
          achievements={achievements}
          onPress={showAchievementDetail}
          onSeeAll={() => setAchievementsModalVisible(true)}
        />

        <RewardsMarketplace
          rewards={rewards}
          balance={isAuthenticated ? (stats?.points.balance || 0) : previewStats.points.balance}
          onClaim={handleClaimReward}
        />
      </ScrollView>

      {!isAuthenticated && <AuthOverlay />}

      <RewardPopup
        visible={rewardPopupVisible}
        coins={rewardPopupCoins}
        title={rewardPopupTitle}
        subtitle={rewardPopupSubtitle}
        onClose={() => setRewardPopupVisible(false)}
      />

      <AchievementsModal
        visible={achievementsModalVisible}
        achievements={achievements}
        onClose={() => setAchievementsModalVisible(false)}
      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },

  // Hero Card
  heroCard: { marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', marginBottom: 8 },
  heroGradient: { padding: 24, paddingBottom: 20 },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 100 },
  heroMain: { alignItems: 'center', marginBottom: 16 },
  heroLabel: { ...FontStyles.label, color: LoopsColors.white50, fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigCoinIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: LoopsColors.coinGold + '26', justifyContent: 'center', alignItems: 'center' },
  balanceValue: { ...FontStyles.h1, color: LoopsColors.coinGold, fontSize: 48 },
  usdValue: { ...FontStyles.bodySmall, color: LoopsColors.white50, marginTop: 4 },

  // Streak section
  streakSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakNum: { ...FontStyles.h4, color: LoopsColors.white },
  streakLabel: { ...FontStyles.bodySmall, color: LoopsColors.white60, fontSize: 13 },
  multiplierPill: { backgroundColor: LoopsColors.warningDark + '4D', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  multiplierText: { ...FontStyles.caption, color: LoopsColors.warning, fontWeight: '700' },

  // Sections
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { ...FontStyles.h4, color: LoopsColors.white },
  sectionSub: { ...FontStyles.caption, color: LoopsColors.white50, marginTop: 2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { ...FontStyles.label, color: LoopsColors.color6, fontSize: 13 },

  // Missions
  missionProgress: { backgroundColor: LoopsColors.color6 + '33', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  missionProgressText: { ...FontStyles.label, color: LoopsColors.color6, fontSize: 13 },
  loadingBox: { height: 150, justifyContent: 'center', alignItems: 'center' },
  missionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  missionCard: {
    width: (SCREEN_WIDTH - 42) / 3,
    backgroundColor: LoopsColors.color1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  missionCardComplete: { borderColor: LoopsColors.coinGold, backgroundColor: LoopsColors.coinGold + '1A' },
  missionCardClaimed: { opacity: 0.6 },
  missionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  missionIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: LoopsColors.color6 + '33', justifyContent: 'center', alignItems: 'center' },
  missionIconComplete: { backgroundColor: LoopsColors.coinGold + '4D' },
  missionReward: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  missionRewardText: { ...FontStyles.caption, color: LoopsColors.coinGold, fontWeight: '700' },
  missionTitle: { ...FontStyles.label, color: LoopsColors.white, fontSize: 11, marginBottom: 8, height: 28 },
  missionProgressBar: { height: 4, backgroundColor: LoopsColors.white10, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  missionProgressFill: { height: '100%', borderRadius: 2 },
  missionProgressText2: { ...FontStyles.caption, color: LoopsColors.white50, textAlign: 'center' },
  claimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LoopsColors.coinGold + 'E6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  claimOverlayText: { color: LoopsColors.black, fontSize: 10, fontWeight: '800' },

  // Achievements
  achievementsScroll: { paddingRight: 16 },
  achievementCard: {
    width: 90,
    backgroundColor: LoopsColors.color1,
    borderRadius: 16,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',
  },
  achievementLocked: { opacity: 0.5 },
  achievementIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: LoopsColors.white10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementIconUnlocked: { backgroundColor: LoopsColors.color6 + '4D', borderWidth: 2, borderColor: LoopsColors.color6 },
  achievementCheck: { position: 'absolute', bottom: -2, right: -2 },
  achievementName: { color: LoopsColors.white, fontSize: 11, textAlign: 'center', fontWeight: '600', marginBottom: 6, height: 28 },
  achievementReward: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  achievementRewardText: { color: LoopsColors.coinGold, fontSize: 11, fontWeight: '700' },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LoopsColors.black40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Rewards
  balancePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: LoopsColors.coinGold + '26', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  balancePillText: { color: LoopsColors.coinGold, fontSize: 14, fontWeight: '700' },
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rewardCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: LoopsColors.color1,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  rewardCardDim: { opacity: 0.6 },
  rewardIconBg: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  rewardName: { color: LoopsColors.white, fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 4, height: 36 },
  rewardDesc: { color: LoopsColors.white50, fontSize: 11, textAlign: 'center', marginBottom: 12 },
  rewardCostBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: LoopsColors.white10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  rewardCostAfford: { backgroundColor: LoopsColors.mainGreen + '33' },
  rewardCostText: { color: LoopsColors.white70, fontSize: 14, fontWeight: '700' },
  rewardCostTextAfford: { color: LoopsColors.mainGreen },
  soldOutBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: LoopsColors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  soldOutText: { color: LoopsColors.white, fontSize: 9, fontWeight: '800' },
  needMoreBadge: { position: 'absolute', bottom: 8, left: 8, right: 8 },
  needMoreText: { color: LoopsColors.white40, fontSize: 9, textAlign: 'center' },

  // Not logged in
  notLoggedIn: { flex: 1 },
  notLoggedInContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  notLoggedInIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: LoopsColors.color6 + '26', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  notLoggedInTitle: { color: LoopsColors.white, fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  notLoggedInSub: { color: LoopsColors.white60, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  previewRewards: { flexDirection: 'row', gap: 16, marginTop: 32 },
  previewIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: LoopsColors.white10, justifyContent: 'center', alignItems: 'center' },
  signUpBtn: { marginTop: 24, width: '100%', maxWidth: 280, borderRadius: 16, overflow: 'hidden' },
  signUpGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  signUpText: { color: LoopsColors.white, fontSize: 17, fontWeight: '700' },

  // Auth overlay - minimal
  authOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  authTitle: { color: LoopsColors.white, fontSize: 20, fontWeight: '700', marginBottom: 20 },
  authBtn: { width: 200, borderRadius: 25, overflow: 'hidden' },
  authBtnGradient: { paddingVertical: 14, alignItems: 'center' },
  authBtnText: { color: LoopsColors.white, fontSize: 16, fontWeight: '700' },
  authLoginText: { color: LoopsColors.white50, fontSize: 14, marginTop: 16 },

  // Ad Watch
  adWatchRow: { borderRadius: 16, overflow: 'hidden' as const },
  adWatchRowDisabled: { opacity: 0.5 },
  adWatchGradient: { padding: 16 },
  adWatchContent: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  adWatchIconContainer: { marginRight: 12 },
  adWatchTextContainer: { flex: 1, marginRight: 16 },
  adWatchTitle: { fontSize: 16, fontWeight: '800' as const, color: LoopsColors.white, marginBottom: 2 },
  adWatchSubtitle: { fontSize: 12, color: LoopsColors.white80, fontWeight: '600' as const },
});
