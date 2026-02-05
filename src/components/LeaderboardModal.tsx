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
  isLive?: boolean;
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

const formatPoints = (points: number): string => {
  if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
  if (points >= 1000) return `${(points / 1000).toFixed(1)}K`;
  return points.toString();
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
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
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

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await gamification.getGameLeaderboard(gameId, 50);
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
    
    const currentUserEntry = {
      rank: 0,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName || null,
      avatar: currentUser.avatar || null,
      points: totalPoints,
      playTime: totalPlayTime,
      isCurrentUser: true as boolean,
      isLive: sessionPoints > 0 as boolean,
    };
    
    let merged = leaderboard
      .filter(e => e.userId !== currentUser.id)
      .map(e => ({ ...e, isCurrentUser: false as boolean, isLive: false as boolean }));
    
    merged.push(currentUserEntry);
    merged.sort((a, b) => b.points - a.points);
    merged = merged.map((entry, index) => ({ ...entry, rank: index + 1 }));
    
    return merged;
  };

  const mergedLeaderboard = getMergedLeaderboard();
  const top3 = mergedLeaderboard.slice(0, 3);
  const rest = mergedLeaderboard.slice(3);
  const currentUserEntry = mergedLeaderboard.find(e => e.isCurrentUser);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  const renderPodiumPlayer = (player: LeaderboardEntry | undefined, position: 1 | 2 | 3) => {
    if (!player) {
      return (
        <View style={[styles.podiumSlot, position === 1 && styles.podiumFirst]}>
          <View style={[styles.podiumAvatarWrap, styles.podiumEmpty, position === 1 && styles.podiumAvatarFirst]}>
            <Ionicons name="person" size={position === 1 ? 32 : 24} color="rgba(255,255,255,0.3)" />
          </View>
          <View style={[styles.podiumBase, position === 1 ? styles.podiumBaseFirst : position === 2 ? styles.podiumBaseSecond : styles.podiumBaseThird]}>
            <Text style={styles.podiumRank}>{position}</Text>
          </View>
        </View>
      );
    }

    const colors: [string, string] = position === 1 
      ? ['#ffd700', '#f59e0b'] 
      : position === 2 
        ? ['#94a3b8', '#64748b'] 
        : ['#f97316', '#c2410c'];

    return (
      <View style={[styles.podiumSlot, position === 1 && styles.podiumFirst]}>
        <View style={[styles.podiumAvatarWrap, position === 1 && styles.podiumAvatarFirst]}>
          <LinearGradient colors={colors} style={styles.podiumAvatarBorder}>
            <Image
              source={player.avatar ? { uri: player.avatar } : require('../../assets/icon.png')}
              style={[styles.podiumAvatar, position === 1 && styles.podiumAvatarFirstImg]}
            />
          </LinearGradient>
          {player.isCurrentUser && (
            <View style={styles.podiumYouBadge}>
              <Text style={styles.podiumYouText}>YOU</Text>
            </View>
          )}
          {position === 1 && (
            <View style={styles.crownWrap}>
              <FontAwesome5 name="crown" size={20} color="#ffd700" />
            </View>
          )}
        </View>
        <Text style={styles.podiumName} numberOfLines={1}>
          {player.displayName || player.username}
        </Text>
        <View style={styles.podiumPoints}>
          <FontAwesome5 name="coins" size={10} color="#ffd60a" />
          <Text style={styles.podiumPointsText}>{formatPoints(player.points)}</Text>
        </View>
        <LinearGradient colors={colors} style={[
          styles.podiumBase,
          position === 1 ? styles.podiumBaseFirst : position === 2 ? styles.podiumBaseSecond : styles.podiumBaseThird
        ]}>
          <Text style={styles.podiumRank}>{position}</Text>
        </LinearGradient>
      </View>
    );
  };

  const renderListItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => (
    <View style={[styles.listRow, item.isCurrentUser && styles.listRowCurrent]}>
      <Text style={styles.listRank}>{item.rank}</Text>
      <Image
        source={item.avatar ? { uri: item.avatar } : require('../../assets/icon.png')}
        style={[styles.listAvatar, item.isCurrentUser && styles.listAvatarCurrent]}
      />
      <View style={styles.listInfo}>
        <View style={styles.listNameRow}>
          <Text style={[styles.listName, item.isCurrentUser && styles.listNameCurrent]} numberOfLines={1}>
            {item.displayName || item.username}
          </Text>
          {item.isCurrentUser && <View style={styles.youDot} />}
        </View>
      </View>
      <View style={styles.listPoints}>
        <FontAwesome5 name="coins" size={10} color="#ffd60a" />
        <Text style={styles.listPointsText}>{formatPoints(item.points)}</Text>
      </View>
    </View>
  );

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

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{gameName}</Text>
            <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#ffd60a" />
            </View>
          ) : (
            <>
              {/* Podium */}
              <View style={styles.podium}>
                {renderPodiumPlayer(podiumOrder[0], 2)}
                {renderPodiumPlayer(podiumOrder[1], 1)}
                {renderPodiumPlayer(podiumOrder[2], 3)}
              </View>

              {/* Your position if not in top 3 */}
              {currentUserEntry && currentUserEntry.rank > 3 && (
                <View style={styles.yourPosition}>
                  <Text style={styles.yourPositionLabel}>Your Position</Text>
                  <View style={styles.yourPositionCard}>
                    <Text style={styles.yourPositionRank}>#{currentUserEntry.rank}</Text>
                    <Image
                      source={currentUserEntry.avatar ? { uri: currentUserEntry.avatar } : require('../../assets/icon.png')}
                      style={styles.yourPositionAvatar}
                    />
                    <Text style={styles.yourPositionName} numberOfLines={1}>
                      {currentUserEntry.displayName || currentUserEntry.username}
                    </Text>
                    <View style={styles.yourPositionPoints}>
                      <FontAwesome5 name="coins" size={12} color="#ffd60a" />
                      <Text style={styles.yourPositionPointsText}>{formatPoints(currentUserEntry.points)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Rest of leaderboard */}
              {rest.length > 0 && (
                <FlatList
                  data={rest}
                  keyExtractor={(item) => item.userId}
                  renderItem={renderListItem}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  ListHeaderComponent={<Text style={styles.listHeader}>Leaderboard</Text>}
                />
              )}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handleArea: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center', flex: 1 },
  closeBtn: { position: 'absolute', right: 12, top: 0 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // Podium
  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  podiumSlot: { alignItems: 'center', width: (SCREEN_WIDTH - 60) / 3 },
  podiumFirst: { marginBottom: 20 },
  podiumAvatarWrap: { marginBottom: 8, position: 'relative' },
  podiumAvatarFirst: { marginBottom: 12 },
  podiumEmpty: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  podiumAvatarBorder: { padding: 3, borderRadius: 32 },
  podiumAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333' },
  podiumAvatarFirstImg: { width: 64, height: 64, borderRadius: 32 },
  podiumYouBadge: { position: 'absolute', bottom: -4, backgroundColor: '#22c55e', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  podiumYouText: { fontSize: 8, fontWeight: '800', color: '#fff' },
  crownWrap: { position: 'absolute', top: -18, alignSelf: 'center' },
  podiumName: { fontSize: 12, fontWeight: '600', color: '#fff', textAlign: 'center', maxWidth: 80 },
  podiumPoints: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  podiumPointsText: { fontSize: 12, fontWeight: '700', color: '#ffd60a' },
  podiumBase: { width: 50, height: 40, borderTopLeftRadius: 8, borderTopRightRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  podiumBaseFirst: { height: 56, width: 60 },
  podiumBaseSecond: { height: 44 },
  podiumBaseThird: { height: 36 },
  podiumRank: { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Your position
  yourPosition: { paddingHorizontal: 16, marginBottom: 12 },
  yourPositionLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  yourPositionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  yourPositionRank: { fontSize: 16, fontWeight: '800', color: '#22c55e', width: 40 },
  yourPositionAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 2, borderColor: '#22c55e' },
  yourPositionName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  yourPositionPoints: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  yourPositionPointsText: { fontSize: 14, fontWeight: '700', color: '#ffd60a' },

  // List
  listHeader: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  listRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10, marginBottom: 6 },
  listRowCurrent: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  listRank: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)', width: 28, textAlign: 'center' },
  listAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: '#333' },
  listAvatarCurrent: { borderWidth: 2, borderColor: '#22c55e' },
  listInfo: { flex: 1 },
  listNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  listNameCurrent: { color: '#22c55e' },
  youDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  listPoints: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listPointsText: { fontSize: 12, fontWeight: '700', color: '#ffd60a' },
});

export default LeaderboardModal;
