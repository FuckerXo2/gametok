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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { gamification } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GamificationStats {
  points: { balance: number; lifetimeEarned: number };
  streak: { current: number; longest: number; lastClaimDate: string | null; multiplier: number };
  level: { current: number; xp: number; currentXp: number; xpForNextLevel: number; progress: number };
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

// Animated header with points
const PointsHeader: React.FC<{ balance: number; loading: boolean }> = ({ balance, loading }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [balance]);

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e']}
      style={styles.pointsHeader}
    >
      <Text style={styles.pointsLabel}>Your Balance</Text>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {loading ? (
          <ActivityIndicator color="#ffd60a" size="large" />
        ) : (
          <View style={styles.pointsRow}>
            <Text style={styles.pointsEmoji}>💰</Text>
            <Text style={styles.pointsValue}>{balance.toLocaleString()}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={styles.pointsSubtext}>Earn points by playing games</Text>
    </LinearGradient>
  );
};

// Challenge Card with progress
const ChallengeCard: React.FC<{ 
  challenge: Challenge; 
  onClaim: () => void;
  loading: boolean;
}> = ({ challenge, onClaim, loading }) => {
  const progress = Math.min(challenge.progress / challenge.target, 1);
  const isComplete = challenge.completed && !challenge.claimed;
  
  return (
    <View style={[styles.challengeCard, isComplete && styles.challengeCardComplete]}>
      <View style={styles.challengeTop}>
        <View style={styles.challengeIconWrap}>
          <Text style={styles.challengeIcon}>{challenge.icon}</Text>
        </View>
        <View style={styles.challengeInfo}>
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
          <Text style={styles.challengeDesc}>{challenge.progress}/{challenge.target}</Text>
        </View>
        <View style={styles.challengeRewardBadge}>
          <Text style={styles.challengeRewardText}>+{challenge.reward_points}</Text>
        </View>
      </View>
      
      <View style={styles.progressBg}>
        <LinearGradient
          colors={isComplete ? ['#22c55e', '#16a34a'] : ['#a855f7', '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${progress * 100}%` }]}
        />
      </View>
      
      {isComplete && (
        <TouchableOpacity 
          style={styles.claimBtn} 
          onPress={onClaim}
          disabled={loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#22c55e', '#16a34a']}
            style={styles.claimBtnGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.claimBtnText}>CLAIM REWARD</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}
      
      {challenge.claimed && (
        <View style={styles.claimedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
          <Text style={styles.claimedText}>Claimed</Text>
        </View>
      )}
    </View>
  );
};

// Achievement Badge
const AchievementBadge: React.FC<{ achievement: Achievement; onPress: () => void }> = ({ achievement, onPress }) => (
  <TouchableOpacity 
    style={[styles.achievementBadge, !achievement.unlocked && styles.achievementLocked]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={[styles.achievementIconWrap, achievement.unlocked && styles.achievementIconUnlocked]}>
      <Text style={styles.achievementIcon}>{achievement.icon}</Text>
    </View>
    <Text style={styles.achievementName} numberOfLines={2}>{achievement.name}</Text>
    {achievement.unlocked && (
      <View style={styles.achievementCheck}>
        <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
      </View>
    )}
  </TouchableOpacity>
);

// Reward Shop Item
const RewardItem: React.FC<{ 
  reward: Reward; 
  balance: number;
  onPress: () => void;
}> = ({ reward, balance, onPress }) => {
  const canAfford = balance >= reward.cost;
  const outOfStock = reward.stock !== undefined && reward.stock !== null && reward.stock <= 0;
  
  const getCategoryEmoji = () => {
    switch (reward.category) {
      case 'giftcard': return '🎁';
      case 'badge': return '🏅';
      case 'boost': return '⚡';
      case 'cosmetic': return '✨';
      case 'merch': return '👕';
      case 'perk': return '🌟';
      default: return '🎮';
    }
  };
  
  return (
    <TouchableOpacity 
      style={[styles.rewardItem, !canAfford && styles.rewardItemDim]}
      onPress={canAfford && !outOfStock ? onPress : undefined}
      activeOpacity={canAfford ? 0.8 : 1}
    >
      <View style={styles.rewardIconWrap}>
        <Text style={styles.rewardEmoji}>{getCategoryEmoji()}</Text>
      </View>
      <Text style={styles.rewardName} numberOfLines={2}>{reward.name}</Text>
      <Text style={styles.rewardDesc} numberOfLines={1}>{reward.description}</Text>
      <View style={[styles.rewardCostBadge, canAfford && styles.rewardCostAfford]}>
        <Text style={styles.rewardCostText}>{reward.cost.toLocaleString()}</Text>
      </View>
      {outOfStock && (
        <View style={styles.soldOutBadge}>
          <Text style={styles.soldOutText}>SOLD OUT</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const RewardsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingChallenge, setClaimingChallenge] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
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
    } catch (e) {
      console.log('Failed to fetch rewards data:', e);
    } finally {
      setLoading(false);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Failed to claim reward');
    } finally {
      setClaimingChallenge(null);
    }
  };

  const handleClaimReward = async (reward: Reward) => {
    Alert.alert(
      reward.name,
      `Spend ${reward.cost.toLocaleString()} points?`,
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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('🎉 Claimed!', `You got: ${reward.name}`);
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
      `${achievement.icon} ${achievement.name}`,
      `${achievement.description}\n\n${achievement.unlocked ? '✅ Unlocked!' : `🔒 Reward: +${achievement.reward_points} points`}`
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.notLoggedIn}>
          <Text style={styles.notLoggedInEmoji}>🎁</Text>
          <Text style={styles.notLoggedInTitle}>Sign in to earn rewards</Text>
          <Text style={styles.notLoggedInSub}>Complete challenges, unlock achievements, and claim prizes!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <ScrollView 
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Points Header */}
        <View style={{ paddingTop: insets.top }}>
          <PointsHeader balance={stats?.points.balance || 0} loading={loading} />
        </View>

        {/* Daily Challenges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Daily Challenges</Text>
              <Text style={styles.sectionSub}>Resets in {24 - new Date().getHours()}h</Text>
            </View>
            <TouchableOpacity onPress={fetchData}>
              <Ionicons name="refresh" size={20} color="#888" />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <ActivityIndicator color="#a855f7" style={{ marginVertical: 30 }} />
          ) : challenges.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No challenges available</Text>
            </View>
          ) : (
            challenges.map(challenge => (
              <ChallengeCard 
                key={challenge.id}
                challenge={challenge}
                onClaim={() => handleClaimChallenge(challenge.id)}
                loading={claimingChallenge === challenge.id}
              />
            ))
          )}
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <Text style={styles.sectionSub}>
                {achievements.filter(a => a.unlocked).length} / {achievements.length} unlocked
              </Text>
            </View>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsRow}
          >
            {achievements.map(achievement => (
              <AchievementBadge 
                key={achievement.id} 
                achievement={achievement}
                onPress={() => showAchievementDetail(achievement)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Rewards Shop */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Rewards Shop</Text>
              <Text style={styles.sectionSub}>Spend your hard-earned points</Text>
            </View>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillText}>💰 {(stats?.points.balance || 0).toLocaleString()}</Text>
            </View>
          </View>
          
          <View style={styles.rewardsGrid}>
            {rewards.map(reward => (
              <RewardItem 
                key={reward.id}
                reward={reward}
                balance={stats?.points.balance || 0}
                onPress={() => handleClaimReward(reward)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  
  // Points Header
  pointsHeader: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  pointsLabel: { color: '#888', fontSize: 14, marginBottom: 8 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointsEmoji: { fontSize: 40 },
  pointsValue: { color: '#ffd60a', fontSize: 48, fontWeight: '800' },
  pointsSubtext: { color: '#666', fontSize: 13, marginTop: 8 },
  
  // Sections
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sectionSub: { color: '#888', fontSize: 13, marginTop: 2 },
  
  // Challenges
  challengeCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  challengeCardComplete: { borderWidth: 1, borderColor: '#22c55e' },
  challengeTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  challengeIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(168,85,247,0.2)', justifyContent: 'center', alignItems: 'center' },
  challengeIcon: { fontSize: 24 },
  challengeInfo: { flex: 1, marginLeft: 12 },
  challengeTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  challengeDesc: { color: '#888', fontSize: 13, marginTop: 2 },
  challengeRewardBadge: { backgroundColor: 'rgba(168,85,247,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  challengeRewardText: { color: '#a855f7', fontSize: 13, fontWeight: '700' },
  progressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  claimBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  claimBtnGradient: { paddingVertical: 14, alignItems: 'center' },
  claimBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  claimedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, justifyContent: 'center' },
  claimedText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },

  // Achievements
  achievementsRow: { paddingRight: 16 },
  achievementBadge: { width: 80, alignItems: 'center', marginRight: 12 },
  achievementLocked: { opacity: 0.4 },
  achievementIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  achievementIconUnlocked: { backgroundColor: 'rgba(168,85,247,0.3)' },
  achievementIcon: { fontSize: 28 },
  achievementName: { color: '#fff', fontSize: 11, textAlign: 'center', lineHeight: 14 },
  achievementCheck: { position: 'absolute', top: 0, right: 8 },
  
  // Rewards
  balancePill: { backgroundColor: 'rgba(255,214,10,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  balancePillText: { color: '#ffd60a', fontSize: 13, fontWeight: '600' },
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rewardItem: { width: (SCREEN_WIDTH - 44) / 2, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, alignItems: 'center' },
  rewardItemDim: { opacity: 0.5 },
  rewardIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(168,85,247,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  rewardEmoji: { fontSize: 28 },
  rewardName: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  rewardDesc: { color: '#888', fontSize: 11, textAlign: 'center', marginBottom: 12 },
  rewardCostBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  rewardCostAfford: { backgroundColor: 'rgba(34,197,94,0.2)' },
  rewardCostText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  soldOutBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  soldOutText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  
  // Empty states
  emptyBox: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 30, alignItems: 'center' },
  emptyText: { color: '#666', fontSize: 14 },
  notLoggedIn: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  notLoggedInEmoji: { fontSize: 64, marginBottom: 16 },
  notLoggedInTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  notLoggedInSub: { color: '#888', fontSize: 14, textAlign: 'center' },
});
