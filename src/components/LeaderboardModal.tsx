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
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.8;

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

// Tier definitions
const TIERS = [
  { name: 'Champion', color: '#9333ea', gradient: ['#a855f7', '#7c3aed'] as [string, string], icon: 'trophy', minRank: 1, maxRank: 1 },
  { name: 'Diamond', color: '#3b82f6', gradient: ['#60a5fa', '#2563eb'] as [string, string], icon: 'diamond', minRank: 2, maxRank: 2 },
  { name: 'Gold', color: '#eab308', gradient: ['#facc15', '#ca8a04'] as [string, string], icon: 'star', minRank: 3, maxRank: 5 },
  { name: 'Silver', color: '#6b7280', gradient: ['#9ca3af', '#4b5563'] as [string, string], icon: 'medal', minRank: 6, maxRank: 15 },
  { name: 'Bronze', color: '#ea580c', gradient: ['#fb923c', '#c2410c'] as [string, string], icon: 'award', minRank: 16, maxRank: Infinity },
];

const formatPoints = (points: number): string => {
  if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
  if (points >= 1000) return `${(points / 1000).toFixed(0)}K`;
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
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set(TIERS.map(t => t.name)));
  
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

  const toggleTier = (tierName: string) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tierName)) next.delete(tierName);
      else next.add(tierName);
      return next;
    });
  };

  const mergedLeaderboard = getMergedLeaderboard();
  const currentUserEntry = mergedLeaderboard.find(e => e.isCurrentUser);

  const getPlayersInTier = (tier: typeof TIERS[0]) => {
    return mergedLeaderboard.filter(p => p.rank >= tier.minRank && p.rank <= tier.maxRank && !p.isCurrentUser);
  };

  const renderPlayer = (player: LeaderboardEntry, showRank = true) => (
    <View key={player.userId} style={[styles.playerRow, player.isCurrentUser && styles.playerRowMe]}>
      <Image
        source={player.avatar ? { uri: player.avatar } : require('../../assets/icon.png')}
        style={styles.playerAvatar}
      />
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.displayName || player.username}
          {player.isCurrentUser && <Text style={styles.meTag}> (Me)</Text>}
        </Text>
      </View>
      {player.rank <= 3 && (
        <FontAwesome5 
          name="medal" 
          size={16} 
          color={player.rank === 1 ? '#ffd700' : player.rank === 2 ? '#c0c0c0' : '#cd7f32'} 
          style={styles.medalIcon}
        />
      )}
      <Text style={styles.playerPoints}>{formatPoints(player.points)}</Text>
    </View>
  );

  const renderTier = (tier: typeof TIERS[0]) => {
    const players = getPlayersInTier(tier);
    const isExpanded = expandedTiers.has(tier.name);
    const hasPlayers = players.length > 0;

    return (
      <View key={tier.name} style={styles.tierSection}>
        <TouchableOpacity 
          style={styles.tierHeader} 
          onPress={() => toggleTier(tier.name)}
          activeOpacity={0.8}
        >
          <LinearGradient colors={tier.gradient} style={styles.tierGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <FontAwesome5 name={tier.icon} size={16} color="#fff" style={styles.tierIcon} />
            <Text style={styles.tierName}>{tier.name}</Text>
            <View style={styles.tierRight}>
              <View style={styles.expandBtn}>
                <Ionicons name={isExpanded ? 'remove' : 'add'} size={18} color="#fff" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        
        {isExpanded && hasPlayers && (
          <View style={styles.tierPlayers}>
            {players.map(p => renderPlayer(p))}
          </View>
        )}
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

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <LinearGradient colors={['#e0f2fe', '#bfdbfe', '#93c5fd']} style={StyleSheet.absoluteFill} />
          
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Top Run</Text>
            <Ionicons name="information-circle-outline" size={20} color="#64748b" />
          </View>
          <Text style={styles.subHeader}>{gameName}</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {TIERS.map(tier => renderTier(tier))}
              <View style={{ height: 100 }} />
            </ScrollView>
          )}

          {/* Fixed bottom - current user position */}
          {currentUserEntry && (
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
              <View style={styles.myPosition}>
                <Text style={styles.myRank}>#{currentUserEntry.rank}</Text>
                <Image
                  source={currentUserEntry.avatar ? { uri: currentUserEntry.avatar } : require('../../assets/icon.png')}
                  style={styles.myAvatar}
                />
                <Text style={styles.myName} numberOfLines={1}>
                  {currentUserEntry.displayName || currentUserEntry.username} (Me)
                </Text>
                <Text style={styles.myPoints}>{formatPoints(currentUserEntry.points)}</Text>
              </View>
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={closeSheet}>
            <View style={styles.closeBtnInner}>
              <Ionicons name="close" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { height: SHEET_HEIGHT, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  subHeader: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 12 },
  
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1, paddingHorizontal: 12 },
  
  // Tier styles
  tierSection: { marginBottom: 8 },
  tierHeader: { borderRadius: 8, overflow: 'hidden' },
  tierGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  tierIcon: { marginRight: 10 },
  tierName: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  tierRight: { flexDirection: 'row', alignItems: 'center' },
  expandBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  
  tierPlayers: { backgroundColor: 'rgba(255,255,255,0.7)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingVertical: 4 },
  
  // Player row
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  playerRowMe: { backgroundColor: 'rgba(59,130,246,0.1)' },
  playerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0', marginRight: 12 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  meTag: { color: '#3b82f6', fontWeight: '700' },
  medalIcon: { marginRight: 8 },
  playerPoints: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  
  // Bottom bar (your position)
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1e3a5f', paddingTop: 12, paddingHorizontal: 16 },
  myPosition: { flexDirection: 'row', alignItems: 'center' },
  myRank: { fontSize: 16, fontWeight: '800', color: '#fff', width: 40 },
  myAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155', marginRight: 10, borderWidth: 2, borderColor: '#60a5fa' },
  myName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  myPoints: { fontSize: 16, fontWeight: '700', color: '#fbbf24' },
  
  // Close button
  closeBtn: { position: 'absolute', bottom: 20, alignSelf: 'center' },
  closeBtnInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
});

export default LeaderboardModal;
