import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gamification } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  points: number;
  playTime: number;
  isCurrentUser?: boolean;
  isLive?: boolean;
}

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  // Current user info for live display
  currentUser?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
  } | null;
  sessionPoints: number;
  sessionPlayTime: number;
}

const formatPoints = (points: number): string => {
  if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
  if (points >= 1000) return `${(points / 1000).toFixed(1)}K`;
  return points.toString();
};

const formatPlayTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
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
  currentUser,
  sessionPoints,
  sessionPlayTime,
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(SHEET_HEIGHT);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      loadLeaderboard();
    }
  }, [visible, gameId]);

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await gamification.getGameLeaderboard(gameId, 50);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  // Merge current user with live points into leaderboard
  const getMergedLeaderboard = (): LeaderboardEntry[] => {
    if (!currentUser) return leaderboard;
    
    // Find if current user is already in leaderboard
    const existingEntry = leaderboard.find(e => e.userId === currentUser.id);
    const totalPoints = (existingEntry?.points || 0) + sessionPoints;
    const totalPlayTime = (existingEntry?.playTime || 0) + sessionPlayTime;
    
    // Create current user entry
    const currentUserEntry = {
      rank: 0, // Will be calculated
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName || null,
      avatar: currentUser.avatar || null,
      points: totalPoints,
      playTime: totalPlayTime,
      isCurrentUser: true as boolean,
      isLive: sessionPoints > 0 as boolean,
    };
    
    // Filter out existing entry for current user and add updated one
    let merged = leaderboard
      .filter(e => e.userId !== currentUser.id)
      .map(e => ({ ...e, isCurrentUser: false as boolean, isLive: false as boolean }));
    
    // Add current user
    merged.push(currentUserEntry);
    
    // Sort by points descending
    merged.sort((a, b) => b.points - a.points);
    
    // Assign ranks
    merged = merged.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
    
    return merged;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: ['#ffd700', '#f59e0b'], text: '#000' };
    if (rank === 2) return { bg: ['#e5e7eb', '#9ca3af'], text: '#000' };
    if (rank === 3) return { bg: ['#f59e0b', '#b45309'], text: '#000' };
    return { bg: ['rgba(168,85,247,0.3)', 'rgba(99,102,241,0.3)'], text: '#fff' };
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const rankStyle = getRankStyle(item.rank);
    const isTopThree = item.rank <= 3;

    return (
      <View style={[
        styles.row, 
        isTopThree && styles.topThreeRow,
        item.isCurrentUser && styles.currentUserRow
      ]}>
        <LinearGradient
          colors={rankStyle.bg as [string, string]}
          style={styles.rankBadge}
        >
          <Text style={[styles.rankText, { color: rankStyle.text }]}>{item.rank}</Text>
        </LinearGradient>
        <Image
          source={item.avatar ? { uri: item.avatar } : require('../../assets/icon.png')}
          style={[styles.avatar, item.isCurrentUser && styles.currentUserAvatar]}
        />
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.displayName, item.isCurrentUser && styles.currentUserName]} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            {item.isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
            {item.isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.playTime}>{formatPlayTime(item.playTime)} played</Text>
        </View>
        <View style={[styles.pointsBadge, item.isCurrentUser && styles.currentUserPoints]}>
          <FontAwesome5 name="coins" size={10} color="#ffd60a" />
          <Text style={styles.points}>{formatPoints(item.points)}</Text>
        </View>
      </View>
    );
  };

  const mergedLeaderboard = getMergedLeaderboard();
  const currentUserRank = mergedLeaderboard.find(e => e.isCurrentUser);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.container}>
        <Animated.View 
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSheet} activeOpacity={1} />
        </Animated.View>

        <Animated.View 
          style={[
            styles.sheet, 
            { 
              transform: [{ translateY }],
              paddingBottom: insets.bottom + 10,
            }
          ]}
        >
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f3460']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.trophyWrap}>
                <Ionicons name="trophy" size={18} color="#ffd60a" />
              </View>
              <Text style={styles.headerTitle}>{gameName}</Text>
            </View>
            <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {currentUser && currentUserRank && (
            <View style={styles.yourRank}>
              <LinearGradient
                colors={['rgba(34,197,94,0.3)', 'rgba(22,163,74,0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.yourRankLabel}>Your Rank</Text>
              <Text style={styles.yourRankValue}>#{currentUserRank.rank}</Text>
              <View style={styles.yourPointsWrap}>
                <FontAwesome5 name="coins" size={12} color="#ffd60a" />
                <Text style={styles.yourPointsText}>{formatPoints(currentUserRank.points)}</Text>
                {sessionPoints > 0 && (
                  <Text style={styles.livePointsText}>+{sessionPoints}</Text>
                )}
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#a855f7" />
            </View>
          ) : (
            <FlatList
              data={mergedLeaderboard}
              keyExtractor={(item) => item.userId}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  trophyWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,214,10,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  yourRank: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  yourRankLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  yourRankValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  yourPointsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,214,10,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  yourPointsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffd60a',
  },
  livePointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
    marginLeft: 4,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  topThreeRow: {
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  currentUserRow: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  currentUserAvatar: {
    borderColor: '#22c55e',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flexShrink: 1,
  },
  currentUserName: {
    color: '#22c55e',
  },
  youBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ef4444',
  },
  playTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,214,10,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  currentUserPoints: {
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  points: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffd60a',
  },
});

export default LeaderboardModal;
