import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    useColorScheme,
} from 'react-native';
import { SlideRightModal } from './SlideRightModal';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { users } from '../services/api';
import { Avatar } from './Avatar';
import { AnimatedButton } from './AnimatedButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface UserItem {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
}

interface FindFriendsModalProps {
    visible: boolean;
    onClose: () => void;
    onOpenProfile: (user: any) => void;
}

const themes = {
    light: {
        bg: '#ffffff',
        text: '#000000',
        textSecondary: '#666666',
        cardLight: '#f2f2f2',
        border: '#eeeeee',
        primary: '#a855f7',
    },
    dark: {
        bg: '#000000',
        text: '#ffffff',
        textSecondary: '#a1a1aa',
        cardLight: '#1f2937',
        border: '#333333',
        primary: '#a855f7',
    },
};

export const FindFriendsModal: React.FC<FindFriendsModalProps> = ({
    visible,
    onClose,
    onOpenProfile,
}) => {
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const theme = themes[colorScheme === 'dark' ? 'dark' : 'light'];

    const [recommended, setRecommended] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
    const [loadingFollow, setLoadingFollow] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (visible) {
            loadRecommended();
        }
    }, [visible]);

    const loadRecommended = async () => {
        setLoading(true);
        try {
            const res = await users.recommended();
            setRecommended(res.users || []);
        } catch (e) {
            console.log('Error loading recommended users', e);
        } finally {
            setLoading(false);
        }
    };

    const shareApp = async () => {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
            try {
                await Sharing.shareAsync('https://gametok.com/invite', {
                    dialogTitle: 'Invite friends to GameTok!',
                });
            } catch (e) {
                console.log('Error sharing:', e);
            }
        } else {
            alert('Sharing is not available on this device');
        }
    };

    const handleFollow = async (userId: string) => {
        setLoadingFollow(prev => ({ ...prev, [userId]: true }));
        try {
            await users.follow(userId);
            setFollowingMap(prev => ({ ...prev, [userId]: true }));
        } catch (e) {
            console.log('Error following user', e);
        } finally {
            setLoadingFollow(prev => ({ ...prev, [userId]: false }));
        }
    };

    return (
        <SlideRightModal visible={visible} onClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={28} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Find Friends</Text>
                    <View style={styles.backBtn} />
                </View>

                {/* Share Section */}
                <View style={styles.shareSection}>
                    <TouchableOpacity
                        style={[styles.shareBtn, { backgroundColor: theme.primary }]}
                        onPress={shareApp}
                        activeOpacity={0.8}
                    >
                        <View style={styles.shareBtnContent}>
                            <Ionicons name="link" size={20} color="#fff" />
                            <Text style={styles.shareBtnText}>Invite friends via Link</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <Text style={[styles.shareSub, { color: theme.textSecondary }]}>
                        Share GameTok to WhatsApp, Instagram, Snapchat, etc.
                    </Text>
                </View>

                {/* Recommended List */}
                <View style={styles.listContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                        Suggested for you
                    </Text>

                    {loading ? (
                        <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
                    ) : recommended.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                No recommendations found right now.
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={recommended}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ paddingBottom: 60 }}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isFollowing = followingMap[item.id];
                                const isLoading = loadingFollow[item.id];

                                return (
                                    <TouchableOpacity
                                        style={styles.userRow}
                                        activeOpacity={0.7}
                                        onPress={() => onOpenProfile(item)}
                                    >
                                        <Avatar uri={item.avatar} size={48} />
                                        <View style={styles.userInfo}>
                                            <Text style={[styles.displayName, { color: theme.text }]} numberOfLines={1}>
                                                {item.displayName || item.username}
                                            </Text>
                                            <Text style={[styles.username, { color: theme.textSecondary }]}>
                                                @{item.username}
                                            </Text>
                                        </View>

                                        <AnimatedButton
                                            style={[
                                                styles.followBtn,
                                                isFollowing
                                                    ? { backgroundColor: theme.cardLight }
                                                    : { backgroundColor: theme.primary }
                                            ]}
                                            onPress={() => !isFollowing && handleFollow(item.id)}
                                            disabled={isFollowing || isLoading}
                                        >
                                            {isLoading ? (
                                                <ActivityIndicator color={isFollowing ? theme.text : '#fff'} size="small" />
                                            ) : isFollowing ? (
                                                <Text style={[styles.followBtnText, { color: theme.text }]}>Added</Text>
                                            ) : (
                                                <Text style={[styles.followBtnText, { color: '#fff' }]}>Add</Text>
                                            )}
                                        </AnimatedButton>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}
                </View>
            </SafeAreaView>
        </SlideRightModal>
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
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    shareSection: {
        padding: 20,
        alignItems: 'center',
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 16,
        width: '100%',
    },
    shareBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    shareBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    shareSub: {
        fontSize: 12,
        marginTop: 12,
        textAlign: 'center',
    },
    listContainer: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 12,
    },
    displayName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    username: {
        fontSize: 13,
    },
    followBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 80,
        alignItems: 'center',
    },
    followBtnText: {
        fontWeight: '700',
        fontSize: 14,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 40,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 15,
    },
});

export default FindFriendsModal;
