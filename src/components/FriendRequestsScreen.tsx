import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { users } from '../services/api';
import { Avatar } from './Avatar';

interface Follower {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  isMutual?: boolean;
}

interface FriendRequestsScreenProps {
  visible: boolean;
  onClose: () => void;
  onOpenChat?: (user: { id: string; username: string; displayName?: string; avatar?: string }) => void;
}

export const FriendRequestsScreen: React.FC<FriendRequestsScreenProps> = ({ visible, onClose, onOpenChat }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuth();
  
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addedBack, setAddedBack] = useState<Set<string>>(new Set());

  const fetchFollowers = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    try {
      const data = await users.pendingRequests(user.id);
      setFollowers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Failed to fetch pending requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (visible) {
      fetchFollowers();
    }
  }, [visible, fetchFollowers]);

  const handleAddBack = async (userId: string) => {
    try {
      await users.follow(userId);
      setAddedBack(prev => new Set([...prev, userId]));
    } catch (error) {
      console.log('Follow back error:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFollowers();
  };

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Friend Requests</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : followers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No friend requests</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            When someone adds you, they'll appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={followers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={[styles.requestItem, { borderBottomColor: colors.border }]}>
              <Avatar uri={item.avatar || null} size={48} />
              <View style={styles.requestContent}>
                <Text style={[styles.requestName, { color: colors.text }]}>
                  {item.displayName || item.username}
                </Text>
                <Text style={[styles.requestText, { color: colors.textSecondary }]}>
                  {(item.isMutual || addedBack.has(item.id)) ? 'You are now friends' : 'wants to be friends'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (item.isMutual || addedBack.has(item.id)) {
                    // Open chat with this user
                    onOpenChat?.({
                      id: item.id,
                      username: item.username,
                      displayName: item.displayName,
                      avatar: item.avatar,
                    });
                  } else {
                    handleAddBack(item.id);
                  }
                }}
              >
                {(item.isMutual || addedBack.has(item.id)) ? (
                  <Ionicons name="chatbubble" size={18} color="#fff" />
                ) : (
                  <Ionicons name="person-add" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
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
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  listContent: {
    paddingVertical: 8,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  requestContent: {
    flex: 1,
    marginLeft: 12,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
  },
  requestText: {
    fontSize: 13,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
