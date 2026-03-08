import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { users } from '../services/api';
import { Avatar } from './Avatar';
import { SlideRightModal } from './SlideRightModal';
import { AnimatedButton } from './AnimatedButton';
import { useAuth } from '../context/AuthContext';

interface UserItem {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    isFollowing?: boolean;
}

interface FollowListModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    username: string;
    initialTab?: 'followers' | 'following';
    onUserPress?: (user: UserItem) => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
    visible,
    onClose,
    userId,
    username,
    initialTab = 'followers',
    onUserPress,
}) => {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
    const [followers, setFollowers] = useState<UserItem[]>([]);
    const [following, setFollowing] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Sync initial tab when modal opens
    useEffect(() => {
        if (visible) {
            setActiveTab(initialTab);
            fetchData();
        }
    }, [visible, initialTab, userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [followersList, followingList] = await Promise.all([
                users.followers(userId),
                users.following(userId)
            ]);
            setFollowers(followersList || []);
            setFollowing(followingList || []);
        } catch (e) {
            console.log('Failed to fetch follow lists:', e);
        } finally {
            setLoading(false);
        }
    };

    const currentData = activeTab === 'followers' ? followers : following;

    const renderItem = ({ item }: { item: UserItem }) => {
        const isCurrentMe = currentUser?.id === item.id;

        return (
            <TouchableOpacity
                style={styles.userRow}
                onPress={() => onUserPress && onUserPress(item)}
                activeOpacity={0.7}
            >
                <Avatar uri={item.avatar} size={54} />
                <View style={styles.userInfo}>
                    <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                        {item.username}
                    </Text>
                    <Text style={[styles.displayName, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.displayName || item.username}
                    </Text>
                </View>
                {!isCurrentMe && (
                    <AnimatedButton
                        style={[
                            styles.actionButton,
                            item.isFollowing ? styles.messageBtn : styles.followBtn
                        ]}
                        onPress={() => onUserPress && onUserPress(item)}
                    >
                        <Text style={[
                            styles.actionButtonText,
                            item.isFollowing ? styles.messageBtnText : styles.followBtnText
                        ]}>
                            {item.isFollowing ? 'Message' : 'Follow'}
                        </Text>
                    </AnimatedButton>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SlideRightModal visible={visible} onClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.iconButton} onPress={onClose}>
                        <Ionicons name="chevron-back" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>{username}</Text>
                    <TouchableOpacity style={styles.iconButton}>
                        <Ionicons name="person-add-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'followers' && { borderBottomColor: colors.text }]}
                        onPress={() => setActiveTab('followers')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'followers' ? colors.text : colors.textSecondary }]}>
                            {followers.length} followers
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'following' && { borderBottomColor: colors.text }]}
                        onPress={() => setActiveTab('following')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'following' ? colors.text : colors.textSecondary }]}>
                            {following.length} following
                        </Text>
                    </TouchableOpacity>
                </View>

                {!loading && (
                    <View style={styles.listHeader}>
                        <Text style={[styles.listHeaderText, { color: colors.text }]}>All {activeTab}</Text>
                    </View>
                )}

                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#a855f7" />
                    </View>
                ) : (
                    <FlatList
                        data={currentData}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.centerContainer}>
                                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                                    No {activeTab} yet.
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
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
        paddingHorizontal: 8,
        paddingBottom: 12,
        paddingTop: 8,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconButtonSmall: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        borderBottomWidth: 1.5,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    listHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    listHeaderText: {
        fontSize: 15,
        fontWeight: '700',
    },
    list: {
        paddingVertical: 4,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    username: {
        fontSize: 14,
        fontWeight: '700',
    },
    displayName: {
        fontSize: 14,
        marginTop: 2,
    },
    actionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 10,
    },
    messageBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    followBtn: {
        backgroundColor: '#a855f7',
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    messageBtnText: {
        color: '#ffffff',
    },
    followBtnText: {
        color: '#ffffff',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
