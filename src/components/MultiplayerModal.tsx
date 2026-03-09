// Multiplayer Game Lobby Modal
// Real-time lobby where you see who's online and can challenge anyone
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
  ImageBackground
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useGameLobby, LobbyPlayer, IncomingChallenge, MatchReady } from '../services/lobby';
import { Avatar } from './Avatar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  // Use a predictable thumbnail URL for the game background
  const gameThumbnailUrl = `https://gametok-backend-production.up.railway.app/games/thumbnails/${gameId}.png`;

  // Render a player card in the lobby
  const renderPlayer = useCallback(({ item, index }: { item: LobbyPlayer; index: number }) => {
    const isChallenged = sentChallenge?.to?.id === item.id;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify().damping(15)}
        style={styles.playerCard}
      >
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={styles.playerCardInner}>
          <View style={styles.playerCardLeft}>
            <View style={styles.playerAvatarWrap}>
              <Avatar uri={item.avatar || null} size={50} />
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.playerTextWrap}>
              <Text style={styles.playerName} numberOfLines={1}>
                {item.displayName || item.username}
              </Text>
              <Text style={styles.playerUsername} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.challengeBtn,
              isChallenged && styles.challengeBtnSent,
            ]}
            activeOpacity={0.8}
            onPress={() => isChallenged ? cancelChallenge() : handleChallenge(item.id)}
            disabled={!!sentChallenge && !isChallenged}
          >
            <LinearGradient
              colors={isChallenged ? ['#ea580c', '#c2410c'] : ['#a855f7', '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.challengeBtnGradient}
            >
              {isChallenged ? (
                <>
                  <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.8 }] }} />
                  <Text style={styles.challengeBtnText}>Cancel</Text>
                </>
              ) : (
                <>
                  <Text style={styles.challengeBtnEmoji}>⚔️</Text>
                  <Text style={styles.challengeBtnText}>VS</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }, [sentChallenge, handleChallenge, cancelChallenge]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent onRequestClose={handleClose}>
      <View style={styles.container}>

        {/* Immersive Dark Background */}
        <ImageBackground
          source={{ uri: gameThumbnailUrl }}
          style={StyleSheet.absoluteFillObject}
          imageStyle={{ opacity: 0.4 }}
          blurRadius={40}
        />
        <View style={styles.darkGradientOverlay}>
          <LinearGradient
            colors={['rgba(9, 9, 11, 0.7)', 'rgba(9, 9, 11, 0.95)', '#09090b']}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <View style={styles.closeBtnInner}>
                <Ionicons name="close" size={24} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{gameName.toUpperCase()}</Text>
              <View style={styles.headerBadge}>
                <View style={styles.headerOnlineDot} />
                <Text style={styles.headerBadgeText}>
                  {playerCount} ONLINE
                </Text>
              </View>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Connection Status */}
          {!connected && (
            <Animated.View entering={FadeIn} style={styles.connectingBar}>
              <ActivityIndicator size="small" color="#a855f7" />
              <Text style={styles.connectingText}>
                Entering Live Arcade...
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
                colors={['#6366f1', '#a855f7', '#ec4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickMatchBtn}
              >
                <View style={styles.quickMatchBtnGlow} />
                {finding ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.quickMatchText}>SCANNING FOR OPPONENT...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="flash" size={20} color="#fff" />
                    <Text style={styles.quickMatchText}>PLAY ANYONE ONLINE</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Online Players Section */}
          <View style={styles.lobbySection}>
            <Text style={styles.lobbySectionTitle}>
              {players.length > 0
                ? `AVAILABLE CHALLENGERS`
                : 'WAITING FOR CHALLENGERS...'}
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
                <View style={styles.emptyLobbyCircle}>
                  <Ionicons name="radar-outline" size={48} color="#a855f7" />
                </View>
              </Animated.View>
              <Text style={styles.emptyTitle}>
                Lobby is empty
              </Text>
              <Text style={styles.emptySubtitle}>
                Invite your friends or wait for others to join {gameName}.
              </Text>
            </View>
          ) : null}

        </View>

        {/* ========== INCOMING CHALLENGE OVERLAY ========== */}
        {incomingChallenge && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={styles.challengeOverlay}
          >
            <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Animated.View entering={SlideInDown.springify().damping(14)} style={styles.challengeCard}>
              <LinearGradient
                colors={['rgba(168, 85, 247, 0.1)', 'rgba(30, 30, 40, 0.95)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.challengeGlow} />

              <Text style={styles.challengeTitle}>MATCH INVITE</Text>

              <View style={styles.challengerInfo}>
                <View style={styles.challengerAvatarContainer}>
                  <LinearGradient colors={['#a855f7', '#ec4899']} style={styles.avatarGlowBorder} />
                  <Avatar uri={incomingChallenge.from.avatar || null} size={80} />
                </View>
                <Text style={styles.challengerName}>
                  {incomingChallenge.from.displayName || incomingChallenge.from.username}
                </Text>
                <Text style={styles.challengerGame}>
                  Wants to play <Text style={{ color: '#fff', fontWeight: 'bold' }}>{incomingChallenge.gameName}</Text>
                </Text>
              </View>

              <View style={styles.challengeActions}>
                <TouchableOpacity
                  style={styles.declineBtn}
                  activeOpacity={0.8}
                  onPress={handleDecline}
                >
                  <BlurView intensity={20} tint="light" style={styles.declineBtnInner}>
                    <Text style={styles.declineText}>DECLINE</Text>
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.acceptBtn}
                  activeOpacity={0.8}
                  onPress={handleAccept}
                >
                  <LinearGradient
                    colors={['#22c55e', '#16a34a']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.challengeActionGradient}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.acceptText}>ACCEPT</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        )}

        {/* ========== MATCH READY OVERLAY ========== */}
        {matchReady && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={styles.matchOverlay}
          >
            <LinearGradient
              colors={['#09090b', '#18181b', '#09090b']}
              style={StyleSheet.absoluteFillObject}
            />
            <Animated.View entering={ZoomIn.delay(200).springify().damping(12)} style={styles.matchCard}>

              <Text style={styles.matchTitle}>GET READY!</Text>

              <View style={styles.matchVsRow}>
                <Animated.View entering={SlideInDown.delay(300).springify()} style={styles.matchPlayerCol}>
                  <Avatar uri={(user as any)?.avatar || null} size={72} />
                  <Text style={styles.matchPlayerName}>YOU</Text>
                </Animated.View>

                <Animated.View entering={ZoomIn.delay(600).springify()} style={styles.vsBadge}>
                  <Text style={styles.matchVsText}>VS</Text>
                </Animated.View>

                <Animated.View entering={SlideInDown.delay(400).springify()} style={styles.matchPlayerCol}>
                  <Avatar uri={matchReady.opponent.avatar || null} size={72} />
                  <Text style={styles.matchPlayerName}>
                    {matchReady.opponent.displayName?.toUpperCase() || matchReady.opponent.username.toUpperCase()}
                  </Text>
                </Animated.View>
              </View>

              <Animated.View entering={FadeInUp.delay(800).springify()}>
                <TouchableOpacity
                  style={styles.matchPlayBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    // Navigate logic goes here
                    handleClose();
                  }}
                >
                  <LinearGradient
                    colors={['#a855f7', '#ec4899']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.matchPlayGradient}
                  >
                    <Text style={styles.matchPlayText}>ENTER MATCH</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        )}

        {/* Error Toast */}
        {error && (
          <Animated.View entering={SlideInDown} exiting={FadeOut} style={styles.errorToast}>
            <LinearGradient colors={['#ef4444', '#b91c1c']} style={StyleSheet.absoluteFillObject} />
            <Text style={styles.errorText}>{error.toUpperCase()}</Text>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  darkGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    gap: 6,
  },
  headerOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4ade80',
    letterSpacing: 1,
  },

  // Connecting
  connectingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  connectingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a855f7',
    letterSpacing: 1,
  },

  // Quick Match
  quickMatchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  quickMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  quickMatchBtnGlow: {
    position: 'absolute',
    top: 0,
    left: '20%',
    width: '60%',
    height: 2,
    backgroundColor: '#fff',
    opacity: 0.5,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  quickMatchText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Lobby Section
  lobbySection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  lobbySectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
  },

  // Players List
  playersList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 10,
  },
  playerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  playerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingRight: 16,
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
    bottom: 2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#18181b', // approximate dark background
  },
  playerTextWrap: {
    marginLeft: 14,
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  playerUsername: {
    fontSize: 13,
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
  },
  challengeBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  challengeBtnSent: {
    opacity: 0.8,
  },
  challengeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  challengeBtnEmoji: {
    fontSize: 12,
  },
  challengeBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Empty lobby
  emptyLobby: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: -40,
  },
  emptyLobbyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.5)',
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
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    overflow: 'hidden',
    backgroundColor: '#18181b', // Fallback
  },
  challengeGlow: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: '#a855f7',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  challengeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#a855f7',
    letterSpacing: 2,
    marginBottom: 24,
  },
  challengerInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  challengerAvatarContainer: {
    padding: 4,
    marginBottom: 16,
  },
  avatarGlowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    opacity: 0.5,
  },
  challengerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  challengerGame: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 6,
  },
  challengeActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  challengeActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  acceptText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  declineBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  declineBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  declineText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
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
    alignItems: 'center',
  },
  matchTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 40,
    letterSpacing: 2,
    textShadowColor: 'rgba(168, 85, 247, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  matchVsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 48,
  },
  matchPlayerCol: {
    alignItems: 'center',
    width: 100,
  },
  matchPlayerName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    marginTop: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
  vsBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#a855f7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  matchVsText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    fontStyle: 'italic',
  },
  matchPlayBtn: {
    width: SCREEN_WIDTH - 64,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#ec4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  matchPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  matchPlayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Error Toast
  errorToast: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    zIndex: 300,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
});

export default MultiplayerModal;
