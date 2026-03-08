// Multiplayer Game Lobby Modal
// Real-time lobby where you see who's online and can challenge anyone
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useGameLobby, LobbyPlayer, IncomingChallenge, MatchReady } from '../services/lobby';
import { Avatar } from './Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MultiplayerModalProps {
  visible: boolean;
  gameId: string;
  gameName: string;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  visible,
  gameId,
  gameName,
  onClose,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const token = (user as any)?.token || null;

  const {
    connected,
    players,
    playerCount,
    incomingChallenge,
    sentChallenge,
    matchReady,
    error,
    finding,
    challengePlayer,
    acceptChallenge,
    declineChallenge,
    cancelChallenge,
    findAnyone,
    clearMatch,
  } = useGameLobby(
    visible ? token : null,
    visible ? gameId : null,
    gameName,
  );

  const handleClose = useCallback(() => {
    clearMatch();
    onClose();
  }, [clearMatch, onClose]);

  const handleChallenge = useCallback((targetId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    challengePlayer(targetId);
  }, [challengePlayer]);

  const handleAccept = useCallback(() => {
    if (!incomingChallenge) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    acceptChallenge(incomingChallenge.challengeId);
  }, [incomingChallenge, acceptChallenge]);

  const handleDecline = useCallback(() => {
    if (!incomingChallenge) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    declineChallenge(incomingChallenge.challengeId);
  }, [incomingChallenge, declineChallenge]);

  const handleFindAnyone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    findAnyone();
  }, [findAnyone]);

  // Render a player card in the lobby
  const renderPlayer = useCallback(({ item, index }: { item: LobbyPlayer; index: number }) => {
    const isChallenged = sentChallenge?.to?.id === item.id;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 60).springify()}
        style={styles.playerCard}
      >
        <View style={[styles.playerCardInner, { backgroundColor: colors.surface }]}>
          <View style={styles.playerCardLeft}>
            <View style={styles.playerAvatarWrap}>
              <Avatar uri={item.avatar || null} size={48} />
              <View style={[styles.onlineDot, { borderColor: colors.surface }]} />
            </View>
            <View style={styles.playerTextWrap}>
              <Text style={[styles.playerName, { color: colors.text }]} numberOfLines={1}>
                {item.displayName || item.username}
              </Text>
              <Text style={[styles.playerUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.challengeBtn,
              isChallenged && styles.challengeBtnSent,
            ]}
            activeOpacity={0.7}
            onPress={() => isChallenged ? cancelChallenge() : handleChallenge(item.id)}
            disabled={!!sentChallenge && !isChallenged}
          >
            <LinearGradient
              colors={isChallenged ? ['#ef4444', '#dc2626'] : ['#a855f7', '#7c3aed']}
              style={styles.challengeBtnGradient}
            >
              {isChallenged ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.challengeBtnText}>Waiting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={styles.challengeBtnText}>Challenge</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }, [colors, sentChallenge, handleChallenge, cancelChallenge]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{gameName}</Text>
            <View style={styles.headerBadge}>
              <View style={styles.headerOnlineDot} />
              <Text style={styles.headerBadgeText}>
                {playerCount} in lobby
              </Text>
            </View>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {/* Connection Status */}
        {!connected && (
          <Animated.View entering={FadeIn} style={styles.connectingBar}>
            <ActivityIndicator size="small" color="#a855f7" />
            <Text style={[styles.connectingText, { color: colors.textSecondary }]}>
              Connecting to lobby...
            </Text>
          </Animated.View>
        )}

        {/* Quick Match Button */}
        <View style={styles.quickMatchSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleFindAnyone}
            disabled={finding || !!sentChallenge}
          >
            <LinearGradient
              colors={['#a855f7', '#6366f1', '#3b82f6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.quickMatchBtn}
            >
              {finding ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.quickMatchText}>Finding opponent...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="flash" size={22} color="#fff" />
                  <Text style={styles.quickMatchText}>Play Anyone Online</Text>
                  <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Online Players Section */}
        <View style={styles.lobbySection}>
          <Text style={[styles.lobbySectionTitle, { color: colors.textSecondary }]}>
            {players.length > 0
              ? `PLAYERS IN LOBBY (${players.length})`
              : 'WAITING FOR PLAYERS'}
          </Text>
        </View>

        {players.length > 0 ? (
          <FlatList
            data={players}
            renderItem={renderPlayer}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.playersList}
            showsVerticalScrollIndicator={false}
          />
        ) : connected ? (
          <View style={styles.emptyLobby}>
            <Animated.View entering={ZoomIn.delay(200).springify()}>
              <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            </Animated.View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              You're the first one here!
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Other players will appear here when they join this game's lobby. Hang tight!
            </Text>
          </View>
        ) : null}

        {/* ========== INCOMING CHALLENGE OVERLAY ========== */}
        {incomingChallenge && (
          <Animated.View
            entering={SlideInDown.springify()}
            exiting={FadeOut}
            style={styles.challengeOverlay}
          >
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.challengeCard}>
              <View style={styles.challengeGlow} />
              <Text style={styles.challengeEmoji}>⚔️</Text>
              <Text style={styles.challengeTitle}>Incoming Challenge!</Text>

              <View style={styles.challengerInfo}>
                <Avatar uri={incomingChallenge.from.avatar || null} size={56} />
                <Text style={styles.challengerName}>
                  {incomingChallenge.from.displayName || incomingChallenge.from.username}
                </Text>
                <Text style={styles.challengerGame}>
                  wants to play {incomingChallenge.gameName}
                </Text>
              </View>

              <View style={styles.challengeActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  activeOpacity={0.8}
                  onPress={handleAccept}
                >
                  <LinearGradient
                    colors={['#22c55e', '#16a34a']}
                    style={styles.challengeActionGradient}
                  >
                    <Ionicons name="checkmark" size={24} color="#fff" />
                    <Text style={styles.challengeActionText}>Accept</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.declineBtn}
                  activeOpacity={0.8}
                  onPress={handleDecline}
                >
                  <View style={styles.declineBtnInner}>
                    <Ionicons name="close" size={24} color="#ef4444" />
                    <Text style={[styles.challengeActionText, { color: '#ef4444' }]}>Decline</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ========== MATCH READY OVERLAY ========== */}
        {matchReady && (
          <Animated.View
            entering={FadeIn}
            style={styles.matchOverlay}
          >
            <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
            <Animated.View entering={ZoomIn.delay(200).springify()} style={styles.matchCard}>
              <Text style={styles.matchEmoji}>🎮</Text>
              <Text style={styles.matchTitle}>Match Found!</Text>
              <Text style={styles.matchSubtitle}>
                vs {matchReady.opponent.displayName || matchReady.opponent.username}
              </Text>

              <View style={styles.matchVsRow}>
                <View style={styles.matchPlayerCol}>
                  <Avatar uri={(user as any)?.avatar || null} size={64} />
                  <Text style={styles.matchPlayerName}>You</Text>
                </View>
                <Animated.Text entering={ZoomIn.delay(400).springify()} style={styles.matchVsText}>
                  VS
                </Animated.Text>
                <View style={styles.matchPlayerCol}>
                  <Avatar uri={matchReady.opponent.avatar || null} size={64} />
                  <Text style={styles.matchPlayerName}>
                    {matchReady.opponent.displayName || matchReady.opponent.username}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.matchPlayBtn}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  // TODO: Navigate to actual game screen with matchId
                  handleClose();
                }}
              >
                <LinearGradient
                  colors={['#a855f7', '#7c3aed']}
                  style={styles.matchPlayGradient}
                >
                  <Ionicons name="game-controller" size={22} color="#fff" />
                  <Text style={styles.matchPlayText}>Let's Go!</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        )}

        {/* Error Toast */}
        {error && (
          <Animated.View entering={FadeInUp} exiting={FadeOut} style={styles.errorToast}>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}
      </View>
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
    paddingBottom: 12,
  },
  closeBtn: {
    padding: 4,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  headerOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a855f7',
  },

  // Connecting
  connectingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  connectingText: {
    fontSize: 14,
  },

  // Quick Match
  quickMatchSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  quickMatchText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // Lobby Section
  lobbySection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  lobbySectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Players List
  playersList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  playerCard: {
    marginBottom: 8,
  },
  playerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
  },
  playerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  playerAvatarWrap: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
  },
  playerTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  playerUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  challengeBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  challengeBtnSent: {
    opacity: 0.9,
  },
  challengeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  challengeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty lobby
  emptyLobby: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Incoming Challenge Overlay
  challengeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
  },
  challengeCard: {
    width: '100%',
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  challengeGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  challengeEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  challengeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
  },
  challengerInfo: {
    alignItems: 'center',
    marginBottom: 28,
  },
  challengerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
  },
  challengerGame: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  challengeActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  declineBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  challengeActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  declineBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 14,
  },
  challengeActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Match Ready Overlay
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 200,
  },
  matchCard: {
    width: '100%',
    backgroundColor: 'rgba(20, 20, 30, 0.97)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  matchEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  matchTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  matchSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 28,
  },
  matchVsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
  },
  matchPlayerCol: {
    alignItems: 'center',
    width: 90,
  },
  matchPlayerName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  matchVsText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#a855f7',
  },
  matchPlayBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  matchPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  matchPlayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  // Error Toast
  errorToast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#ef4444',
    padding: 14,
    borderRadius: 12,
    zIndex: 300,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default MultiplayerModal;
