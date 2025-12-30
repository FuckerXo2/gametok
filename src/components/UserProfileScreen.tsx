import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { users } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SUGGESTED_FRIENDS = [
  { id: '1', name: 'Remiii��🦋', username: 'remi0031', avatar: '🦋', online: true },
  { id: '2', name: 'aliyah', username: 'aliyah', avatar: '😎', status: 'IN MY CONTACTS', online: false },
  { id: '3', name: 'Uyi🐝', username: 'uyiante', avatar: '🐝', online: true },
  { id: '4', name: 'DUMIE 🌸', username: 'temilase22', avatar: '🌸', online: true },
];

interface UserProfileScreenProps {
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    status?: string;
    isFollowing?: boolean;
  };
  onClose: () => void;
}

export const UserProfileScreen: React.FC<UserProfileScreenProps> = ({ user, onClose }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [isAdded, setIsAdded] = useState(user.isFollowing || false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    setIsLoading(true);
    try {
      await users.follow(user.id);
      setIsAdded(true);
    } catch (error) {
      console.log('Follow error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const status = user.status || 'RECENTLY JOINED';

  return (
    <View style={styles.container}>
      {/* Purple gradient header */}
      <LinearGradient
        colors={['#8B5CF6', '#A78BFA', '#C4B5FD']}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        {/* Top buttons */}
        <View style={styles.topButtons}>
          <TouchableOpacity style={styles.topBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topRight}>
            <TouchableOpacity style={styles.topBtn}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBtn}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>{user.avatar || '😊'}</Text>
              </View>
              <View style={styles.onlineDot} />
            </View>
            <View style={styles.userInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{user.displayName || user.username}</Text>
                <Text style={styles.verifiedBadge}>🐴</Text>
                <View style={styles.starBadge}>
                  <Text style={styles.starText}>⭐</Text>
                </View>
              </View>
              <Text style={styles.status}>{status}</Text>
            </View>
          </View>

          {/* Add button */}
          <TouchableOpacity 
            style={[styles.addButton, isAdded && styles.addedButton]}
            onPress={handleAdd}
            disabled={isAdded || isLoading}
          >
            <Ionicons 
              name={isAdded ? "checkmark" : "person-add"} 
              size={20} 
              color={isAdded ? '#8B5CF6' : '#000'} 
            />
            <Text style={[styles.addButtonText, isAdded && styles.addedButtonText]}>
              {isAdded ? 'Added' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Find Friends section */}
      <ScrollView 
        style={[styles.content, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Find Friends</Text>
        
        <View style={styles.friendsGrid}>
          {SUGGESTED_FRIENDS.map((friend) => (
            <View key={friend.id} style={[styles.friendCard, { backgroundColor: colors.background }]}>
              <TouchableOpacity style={styles.dismissBtn}>
                <Ionicons name="close" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <View style={styles.friendAvatarContainer}>
                <View style={[styles.friendAvatar, { backgroundColor: colors.surface }]}>
                  <Text style={styles.friendEmoji}>{friend.avatar}</Text>
                </View>
                {friend.online && <View style={styles.friendOnlineDot} />}
              </View>
              
              <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                {friend.name}
              </Text>
              <Text style={[styles.friendUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                {friend.status || friend.username}
              </Text>
              
              <TouchableOpacity style={[styles.friendAddBtn, { borderColor: colors.border }]}>
                <Ionicons name="person-add-outline" size={14} color={colors.text} />
                <Text style={[styles.friendAddText, { color: colors.text }]}>Add</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 20,
  },
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 60,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRight: {
    flexDirection: 'row',
    gap: 8,
  },
  profileSection: {
    paddingHorizontal: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: '#8B5CF6',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  verifiedBadge: {
    fontSize: 16,
  },
  starBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  starText: {
    fontSize: 12,
  },
  status: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFC00',
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  addedButton: {
    backgroundColor: '#fff',
  },
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  addedButtonText: {
    color: '#8B5CF6',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  friendsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  friendCard: {
    width: (SCREEN_WIDTH - 48) / 4,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  friendAvatarContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendEmoji: {
    fontSize: 24,
  },
  friendOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: '#fff',
  },
  friendName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 1,
  },
  friendUsername: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 8,
  },
  friendAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  friendAddText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
