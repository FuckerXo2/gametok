import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  Share,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { users } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AVATAR_SIZE = 60;

interface Friend {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  gameIcon?: string;
  gameColor?: string;
  onSendToFriend?: (friendId: string, gameId: string, isChallenge?: boolean) => Promise<void>;
}

const EXTERNAL_SHARE_OPTIONS = [
  { id: 'copy', icon: 'link', label: 'Copy link', color: '#3478F6' },
  { id: 'snapchat', icon: 'logo-snapchat', label: 'Snapchat', color: '#FFFC00', iconColor: '#000' },
  { id: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25D366' },
  { id: 'sms', icon: 'chatbubble', label: 'SMS', color: '#34C759' },
  { id: 'instagram', icon: 'logo-instagram', label: 'Instagram', color: '#E4405F' },
  { id: 'more', icon: 'ellipsis-horizontal', label: 'More', color: '#636366' },
];

export const ShareSheet: React.FC<ShareSheetProps> = ({
  visible,
  onClose,
  gameId,
  gameName,
  gameIcon,
  gameColor,
  onSendToFriend,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  // Load friends (following list)
  useEffect(() => {
    if (visible && user) {
      loadFriends();
    }
  }, [visible, user]);

  const loadFriends = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const following = await users.following(user.id);
      setFriends(Array.isArray(following) ? following : []);
    } catch (e) {
      console.error('Failed to load friends:', e);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    if (sentTo.has(friendId)) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setSelectedFriends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleSend = async () => {
    if (selectedFriends.size === 0 || sending) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    
    try {
      // Send to all selected friends
      await Promise.all(
        Array.from(selectedFriends).map(friendId => 
          onSendToFriend?.(friendId, gameId, false)
        )
      );
      
      // Mark as sent
      setSentTo(prev => new Set([...prev, ...selectedFriends]));
      setSelectedFriends(new Set());
    } catch (e) {
      console.error('Failed to send:', e);
    } finally {
      setSending(false);
    }
  };

  const getShareUrl = () => `https://gametok.app/game/${gameId}`;
  const getShareMessage = () => `Check out ${gameName} on GameTok! 🎮 ${getShareUrl()}`;

  const handleExternalShare = async (optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const shareUrl = getShareUrl();
    const shareMessage = getShareMessage();

    switch (optionId) {
      case 'copy':
        await Clipboard.setStringAsync(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        break;
      case 'snapchat':
        Linking.openURL(`snapchat://`);
        break;
      case 'whatsapp':
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareMessage)}`);
        break;
      case 'sms':
        Linking.openURL(`sms:&body=${encodeURIComponent(shareMessage)}`);
        break;
      case 'instagram':
        Linking.openURL('instagram://app');
        break;
      case 'more':
        Share.share({ message: shareMessage });
        break;
    }
  };

  const renderFriend = useCallback(
    ({ item }: { item: Friend }) => {
      const isSelected = selectedFriends.has(item.id);
      const isSent = sentTo.has(item.id);
      
      return (
        <TouchableOpacity
          style={styles.friendItem}
          onPress={() => toggleFriendSelection(item.id)}
          activeOpacity={0.7}
          disabled={isSent}
        >
          <View style={styles.avatarContainer}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                <Text style={[styles.avatarText, { color: colors.text }]}>
                  {(item.displayName || item.username).charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Selection indicator */}
            {isSelected && !isSent && (
              <View style={[styles.selectedBadge, { borderColor: colors.surface }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
            {/* Sent indicator */}
            {isSent && (
              <View style={[styles.sentBadge, { borderColor: colors.surface }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </View>
          <Text 
            style={[
              styles.friendName, 
              { color: colors.text }, 
              isSent && styles.friendNameSent,
              isSelected && !isSent && styles.friendNameSelected
            ]} 
            numberOfLines={1}
          >
            {item.displayName || item.username}
          </Text>
          {isSent && <Text style={styles.sentLabel}>Sent</Text>}
        </TouchableOpacity>
      );
    },
    [selectedFriends, sentTo, colors]
  );

  const renderExternalOption = ({ item }: { item: typeof EXTERNAL_SHARE_OPTIONS[0] }) => (
    <TouchableOpacity
      style={styles.externalOption}
      onPress={() => handleExternalShare(item.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.externalIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon as any} size={24} color={(item as any).iconColor || '#fff'} />
      </View>
      <Text style={[styles.externalLabel, { color: colors.text }]}>
        {item.id === 'copy' && copiedLink ? 'Copied!' : item.label}
      </Text>
    </TouchableOpacity>
  );

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedFriends(new Set());
      setSentTo(new Set());
      setSending(false);
    }
  }, [visible]);

  const hasSelection = selectedFriends.size > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.searchIcon}>
              <Ionicons name="search" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Send to</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Friends List */}
          <View style={styles.friendsSection}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : friends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Follow people to share games with them
                </Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                renderItem={renderFriend}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.friendsList}
              />
            )}
          </View>

          {/* Send Button - shows when friends are selected */}
          {hasSelection && (
            <TouchableOpacity 
              style={[styles.sendButton, { backgroundColor: colors.primary }]}
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendButtonText}>
                  Send{selectedFriends.size > 1 ? ` (${selectedFriends.size})` : ''}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* External Share Options */}
          <FlatList
            data={EXTERNAL_SHARE_OPTIONS}
            renderItem={renderExternalOption}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.externalList}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendsSection: {
    minHeight: 110,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    height: 100,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
  friendsList: {
    paddingHorizontal: 12,
  },
  friendItem: {
    alignItems: 'center',
    width: 76,
    marginRight: 4,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
  },
  selectedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF8E53',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  sentBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#34C759',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  friendName: {
    fontSize: 11,
    color: '#fff',
    marginTop: 6,
    textAlign: 'center',
  },
  friendNameSelected: {
    fontWeight: '600',
  },
  friendNameSent: {
    color: '#8E8E93',
  },
  sentLabel: {
    fontSize: 10,
    color: '#34C759',
    marginTop: 2,
  },
  sendButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#3A3A3C',
    marginTop: 16,
    marginBottom: 12,
  },
  externalList: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  externalOption: {
    alignItems: 'center',
    width: 76,
    marginRight: 4,
  },
  externalIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  externalLabel: {
    fontSize: 11,
    color: '#fff',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default ShareSheet;
