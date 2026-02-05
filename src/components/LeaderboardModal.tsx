import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gamification } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  points: number;
  playTime: number;
}

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
}

const formatPoints = (points: number): string => {
  if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
  if (points >= 1000) return `${(points / 1000).toFixed(1)}K`;
  return points.toString();
};

const formatPlayTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  visible,
  onClose,
  gameId,
  gameName,
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; points: number } | null>(null);

  useEffect(() => {
    if (visible && gameId) {
      loadLeaderboard();
    }
  }, [visible, gameId]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await gamification.getGameLeaderboard(gameId, 100);
      setLeaderboard(data.leaderboard || []);
      setUserRank(data.userRank || null);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank: number): string => {
    if (rank === 1) return '#ffd700';
    if (rank === 2) return '#c0c0c0';
    if (rank === 3) return '#cd7f32';
    return '#666';
  };

  const getRankIcon = (rank: number): string | null => {
    if (rank === 1) return 'trophy';
    if (rank === 2) return 'medal';
    if (rank === 3) return 'ribbon';
    return null;
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const rankIcon = getRankIcon(item.rank);
    const isTopThree = item.rank <= 3;

    return (
      <View style={[styles.row, isTopThree && styles.topThreeRow]}>
        <View style={[styles.rankBadge, { backgroundColor: isTopThree ? getRankColor(item.rank) : 'rgba(255,255,255,0.1)' }]}>
          {rankIcon ? (
            <Ionicons name={rankIcon as any} size={16} color={isTopThree ? '#000' : '#fff'} />
          ) : (
            <Text style={[styles.rankText, isTopThree && styles.topThreeRankText]}>
              {item.rank}
            </Text>
          )}
        </View>

        <Image
          source={item.avatar ? { uri: item.avatar } : require('../../assets/icon.png')}
          style={styles.avatar}
        />

        <View style={styles.userInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {item.displayName || item.username}
          </Text>
          <Text style={styles.playTime}>
            <Ionicons name="time-outline" size={10} color="#888" /> {formatPlayTime(item.playTime)}
          </Text>
        </View>

        <View style={styles.pointsContainer}>
          <Ionicons name="flash" size={14} color="#ffd60a" />
          <Text style={styles.points}>{formatPoints(item.points)}</Text>
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.gameIconWrap}>
        <Ionicons name="game-controller" size={32} color="#fff" />
      </View>
      <Text style={styles.gameTitle}>{gameName}</Text>
      <Text style={styles.subtitle}>Global Leaderboard</Text>
      
      {userRank && (
        <View style={styles.yourRankCard}>
          <Text style={styles.yourRankLabel}>Your Rank</Text>
          <View style={styles.yourRankRow}>
            <Text style={styles.yourRankNumber}>#{userRank.rank}</Text>
            <View style={styles.yourPointsWrap}>
              <Ionicons name="flash" size={16} color="#ffd60a" />
              <Text style={styles.yourPoints}>{formatPoints(userRank.points)}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="podium-outline" size={64} color="#444" />
      <Text style={styles.emptyTitle}>No players yet</Text>
      <Text style={styles.emptySubtitle}>Be the first to play and claim the top spot!</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="trophy" size={20} color="#ffd60a" />
              <Text style={styles.headerTitle}>Leaderboard</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ffd60a" />
              <Text style={styles.loadingText}>Loading leaderboard...</Text>
            </View>
          ) : (
            <FlatList
              data={leaderboard}
              keyExtractor={(item) => item.userId}
              renderItem={renderItem}
              ListHeaderComponent={ListHeader}
              ListEmptyComponent={EmptyList}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  gameIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,214,10,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gameTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  yourRankCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255,214,10,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.3)',
  },
  yourRankLabel: {
    fontSize: 12,
    color: '#ffd60a',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  yourRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  yourRankNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  yourPointsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  yourPoints: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffd60a',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  topThreeRow: {
    backgroundColor: 'rgba(255,214,10,0.1)',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  topThreeRankText: {
    color: '#000',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  playTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,214,10,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  points: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffd60a',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default LeaderboardModal;
