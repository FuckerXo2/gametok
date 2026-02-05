import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  points: number;
  playTime: number;
  isCurrentUser?: boolean;
}

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  currentUser?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatar?: string | null;
  } | null;
  sessionPoints: number;
  sessionPlayTime: number;
}

const TIERS = [
  { name: 'Champion', color: '#a855f7', icon: 'crown', minRank: 1, maxRank: 1 },
  { name: 'Diamond', color: '#3b82f6', icon: 'gem', minRank: 2, maxRank: 3 },
  { name: 'Gold', color: '#eab308', icon: 'star', minRank: 4, maxRank: 10 },
  { name: 'Silver', color: '#94a3b8', icon: 'medal', minRank: 11, maxRank: 25 },
  { name: 'Bronze', color: '#f97316', icon: 'award', minRank: 26, maxRank: Infinity },
];

const getTier = (rank: number) => TIERS.find(t => rank >= t.minRank && rank <= t.maxRank) || TIERS[4];

const formatPoints = (points: number): string => {
  if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
  if (points >= 1000) return `${(points / 1000).toFixed(1)}K`;
  return points.toLocaleString();
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
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) closeSheet();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(SHEET_HEIGHT);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      loadLeaderboard();
    }
  }, [visible, gameId]);

  // Force re-render every second to update live points display
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, [visible]);

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await gamification.getGameLeaderboard(gameId, 100);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const getMergedLeaderboard = (): LeaderboardEntry[] => {
    if (!currentUser) return leaderboard;
    
    const existingEntry = leaderboard.find(e => e.userId === currentUser.id);
    const totalPoints = (existingEntry?.points || 0) + sessionPoints;
    const totalPlayTime = (existingEntry?.playTime || 0) + sessionPlayTime;
    
    const currentUserEntry: LeaderboardEntry = {
      rank: 0,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName || null,
      avatar: currentUser.avatar || null,
      points: totalPoints,
      playTime: totalPlayTime,
      isCurrentUser: true,
    };
    
    let merged: LeaderboardEntry[] = leaderboard
      .filter(e => e.userId !== currentUser.id)
      .map(e => ({ ...e, isCurrentUser: false }));
    
    merged.push(currentUserEntry);
    merged.sort((a, b) => b.points - a.points);
    merged = merged.map((entry, index) => ({ ...entry, rank: index + 1 }));
    
    return merged;
  };

  const mergedLeaderboard = getMergedLeaderboard();
  const currentUserEntry = mergedLeaderboard.find(e => e.isCurrentUser);
  const currentTier = currentUserEntry ? getTier(currentUserEntry.rank) : null;

  const renderPlayer = (player: LeaderboardEntry) => {
    const tier = getTier(player.rank);
    const isMe = player.isCurrentUser;
    
    return (
      <View key={player.userId} style={[styles.playerRow, isMe && styles.playerRowMe]}>
        <View style={[styles.rankBadge, { backgroundColor: tier.color + '30' }]}>
          <Text style={[styles.rankText, { color: tier.color }]}>{player.rank}</Text>
        </View>
        
        <Image
          source={player.avatar ? { uri: player.avatar } : require('../../assets/icon.png')}
          style={[styles.avatar, isMe && { borderColor: '#22c55e', borderWidth: 2 }]}
        />
        
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.playerName, isMe && styles.playerNameMe]} numberOfLines={1}>
              {player.displayName || player.username}
            </Text>
            {isMe && (
              <View style={styles.youBadge}>
                <Text style={styles.youText}>YOU</Text>
              </View>
            )}
          </View>
          <View style={styles.tierRow}>
            <FontAwesome5 name={tier.icon} size={10} color={tier.color} />
            <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.name}</Text>
          </View>
        </View>
        
        <View style={styles.pointsWrap}>
          <FontAwesome5 name="coins" size={12} color="#ffd60a" />
          <Text style={styles.pointsText}>{formatPoints(player.points)}</Text>
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSheet} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom }]}>
          <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={StyleSheet.absoluteFill} />
          
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="trophy" size={22} color="#ffd60a" />
              <Text style={styles.headerTitle}>Leaderboard</Text>
            </View>
            <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.gameName}>{gameName}</Text>

          {/* Your rank card */}
          {currentUserEntry && currentTier && (
            <View style={styles.myRankCard}>
              <LinearGradient 
                colors={[currentTier.color + '40', currentTier.color + '20']} 
                style={StyleSheet.absoluteFill} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
              />
              <View style={styles.myRankLeft}>
                <FontAwesome5 name={currentTier.icon} size={18} color={currentTier.color} />
                <View>
                  <Text style={styles.myRankLabel}>Your Rank</Text>
                  <Text style={styles.myRankTier}>{currentTier.name}</Text>
                </View>
              </View>
              <View style={styles.myRankRight}>
                <Text style={styles.myRankNum}>#{currentUserEntry.rank}</Text>
                <View style={styles.myRankPoints}>
                  <FontAwesome5 name="coins" size={12} color="#ffd60a" />
                  <Text style={styles.myRankPointsText}>{formatPoints(currentUserEntry.points)}</Text>
                </View>
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#a855f7" />
            </View>
          ) : mergedLeaderboard.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="podium-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No players yet</Text>
              <Text style={styles.emptySubtext}>Start playing to claim the top spot!</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {mergedLeaderboard.map(renderPlayer)}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handleArea: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  closeBtn: { padding: 4 },
  
  gameName: { fontSize: 14, color: 'rgba(255,255,255,0.6)', paddingHorizontal: 16, marginBottom: 12 },
  
  myRankCard: { marginHorizontal: 16, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  myRankLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myRankLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  myRankTier: { fontSize: 14, fontWeight: '700', color: '#fff' },
  myRankRight: { alignItems: 'flex-end' },
  myRankNum: { fontSize: 18, fontWeight: '800', color: '#fff' },
  myRankPoints: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  myRankPointsText: { fontSize: 12, fontWeight: '600', color: '#ffd60a' },
  
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  emptySubtext: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  
  list: { flex: 1, paddingHorizontal: 12 },
  
  playerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 },
  playerRowMe: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' },
  
  rankBadge: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  rankText: { fontSize: 12, fontWeight: '700' },
  
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 8 },
  
  playerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  playerName: { fontSize: 13, fontWeight: '600', color: '#fff', flexShrink: 1 },
  playerNameMe: { color: '#22c55e' },
  youBadge: { backgroundColor: '#22c55e', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  youText: { fontSize: 8, fontWeight: '800', color: '#fff' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  tierLabel: { fontSize: 10, fontWeight: '600' },
  
  pointsWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pointsText: { fontSize: 13, fontWeight: '700', color: '#ffd60a' },
});

export default LeaderboardModal;
