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
import { Avatar } from './Avatar';
import { LoopsColors, SemanticColors } from '../constants/LoopsColors';

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
  onSendToFriend?: (friendId: string, gameId: string) => Promise<void>;
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
      await Promise.all(
        Array.from(selectedFriends).map(friendId =>
          onSendToFriend?.(friendId, gameId)
        )
      );
      setSentTo(prev => new Set([...prev, ...selectedFriends]));
      setSelectedFriends(new Set());
    } catch (e) {
      console.error('Failed to send:', e);
    } finally {
      setSending(false);
    }
  };

  const getThumbnailUrl = () => `https://games.gametok.co/thumbnails/${gameId}.png`;
  const getShareUrl = () => `https://gametok.co/game.html?id=${gameId}&name=${encodeURIComponent(gameName)}&img=${encodeURIComponent(getThumbnailUrl())}`;
  const getShareMessage = () => `Play ${gameName} with me on GameTOK! 🎮\n${getShareUrl()}`;

  const handleExternalShare = async (optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const shareUrl = getShareUrl();
    const shareMessage = getShareMessage();

    // Execute immediately instead of showing pill
    switch (optionId) {
      case 'copy':
        await Clipboard.setStringAsync(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        break;
      case 'snapchat': {
        // Snapchat doesn't support text via URL scheme - use system share
        Share.share({ message: shareMessage });
        break;
      }
      case 'whatsapp':
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareMessage)}`);
        break;
      case 'sms':
        Linking.openURL(`sms:&body=${encodeURIComponent(shareMessage)}`);
        break;
      case 'instagram': {
        // Instagram doesn't support text sharing via URL scheme - use system share
        Share.share({ message: shareMessage });
        break;
      }
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
            <Avatar uri={item.avatar} size={AVATAR_SIZE} />
            {isSelected && !isSent && (
              <View style={[styles.selectedBadge, { borderColor: colors.surface }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
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
            <View style={styles.headerSpacer} />
            <Text style={[styles.title, { color: colors.text }]}>Send to</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Image source={require('../../assets/ui/icons/ic_close.png')} style={{ width: 24, height: 24, tintColor: colors.text }} />
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

          {/* Send Button */}
          {hasSelection && (
            <View style={styles.sendSection}>
              <TouchableOpacity
                style={[styles.islandPill, { backgroundColor: colors.background }]}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.8}
              >
                <View style={[styles.slideIndicator, { backgroundColor: 'rgba(255,142,83,0.2)' }]} />
                <View style={styles.islandOption}>
                  {sending ? (
                    <ActivityIndicator color="#FF8E53" size="small" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={16} color="#FF8E53" />
                      <Text style={[styles.islandText, { color: '#FF8E53' }]}>
                        Send{selectedFriends.size > 1 ? ` (${selectedFriends.size})` : ''}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
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
  headerSpacer: {
    width: 32,
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
  sendSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  islandPill: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
    position: 'relative',
  },
  slideIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    right: 4,
    borderRadius: 16,
  },
  islandOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
    zIndex: 1,
  },
  islandText: {
    fontSize: 14,
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
