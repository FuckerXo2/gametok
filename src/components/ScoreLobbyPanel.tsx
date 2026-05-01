/**
 * ScoreLobbyPanel — slide-up leaderboard for games that have a score lobby.
 *
 * Usage:
 *   <ScoreLobbyPanel gameId={game.id} active={isCurrentGame} score={localScore} />
 *
 * - Auto-joins the lobby when `active && gameId` is truthy.
 * - Sends `score` to the lobby whenever it increases.
 * - Shows live top-10 leaderboard; gracefully handles "you're alone in here".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useScoreLobby } from '../hooks/useScoreLobby';
import { Avatar } from './Avatar';

interface ScoreLobbyPanelProps {
    gameId: string | null;
    active: boolean;
    score: number;
    style?: any;
}

const formatScore = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

export const ScoreLobbyPanel: React.FC<ScoreLobbyPanelProps> = ({ gameId, active, score, style }) => {
    const { players, isLive, joinError, sendScore } = useScoreLobby(gameId, active);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        sendScore(score);
    }, [score, sendScore]);

    const topPlayers = useMemo(() => players.slice(0, 10), [players]);
    const playerCount = players.length;

    if (joinError && !isLive) {
        // Lobby not enabled or auth issue; render nothing
        return null;
    }

    return (
        <View style={[styles.container, style]}>
            {/* Collapsed pill */}
            {!expanded ? (
                <Pressable style={styles.pill} onPress={() => setExpanded(true)}>
                    <View style={styles.pillDot} />
                    <Ionicons name="trophy" size={14} color="#fff" />
                    <Text style={styles.pillText}>
                        {playerCount > 1 ? `${playerCount} live` : 'Lobby'}
                    </Text>
                </Pressable>
            ) : (
                <View style={styles.panel}>
                    <LinearGradient
                        colors={['rgba(168,85,247,0.32)', 'rgba(17,17,23,0.92)', 'rgba(8,8,12,0.96)']}
                        locations={[0, 0.4, 1]}
                        style={StyleSheet.absoluteFillObject}
                    />
                    <View style={styles.panelHeader}>
                        <View style={styles.panelHeaderLeft}>
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                            <Text style={styles.panelTitle}>Score Lobby</Text>
                        </View>
                        <Pressable onPress={() => setExpanded(false)} hitSlop={8}>
                            <Ionicons name="close" size={18} color="rgba(255,255,255,0.65)" />
                        </Pressable>
                    </View>

                    {topPlayers.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>
                                You&apos;re first in the lobby. Score points to claim #1.
                            </Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                            {topPlayers.map((p, i) => (
                                <View key={p.userId} style={styles.row}>
                                    <Text style={styles.rank}>{i + 1}</Text>
                                    <View style={styles.avatar}>
                                        <Avatar uri={p.avatar} userId={p.userId} size={28} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {p.displayName}
                                            </Text>
                                            {p.verified ? (
                                                <View style={styles.verifiedDot}>
                                                    <Text style={styles.verifiedCheck}>✓</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                    <Text style={styles.score}>{formatScore(p.score)}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 90,
        right: 12,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.5)',
    },
    pillDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22c55e',
    },
    pillText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    panel: {
        width: 240,
        maxHeight: 360,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.4)',
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    panelHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    panelTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: '#ef4444',
    },
    liveDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#fff',
    },
    liveText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    empty: {
        padding: 16,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        lineHeight: 16,
    },
    list: {
        paddingHorizontal: 6,
        paddingTop: 4,
        paddingBottom: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 8,
        paddingVertical: 7,
        borderRadius: 10,
    },
    rank: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: '800',
        width: 18,
        textAlign: 'center',
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(168,85,247,0.18)',
    },
    avatarInitial: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    name: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: -0.1,
        flexShrink: 1,
    },
    verifiedDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#a855f7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifiedCheck: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '900',
        marginTop: -1,
    },
    score: {
        color: '#d8b4fe',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: -0.3,
        minWidth: 40,
        textAlign: 'right',
    },
});
