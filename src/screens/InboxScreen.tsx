import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const NOTIFICATIONS = [
  {
    id: 1,
    type: 'like',
    user: 'gamer_pro',
    avatar: '👤',
    message: 'liked your high score',
    time: '2h',
    game: 'Stack Ball',
  },
  {
    id: 2,
    type: 'follow',
    user: 'ninja_master',
    avatar: '🥷',
    message: 'started following you',
    time: '5h',
  },
  {
    id: 3,
    type: 'challenge',
    user: 'speedrunner99',
    avatar: '⚡',
    message: 'challenged you to beat their score',
    time: '1d',
    game: 'Fruit Slicer',
    score: 2450,
  },
  {
    id: 4,
    type: 'achievement',
    user: 'system',
    avatar: '🏆',
    message: 'You unlocked "First Blood" achievement!',
    time: '2d',
  },
];

const MESSAGES = [
  { id: 1, user: 'gamer_pro', avatar: '👤', lastMessage: 'GG! That was insane 🔥', time: '2h', unread: 2 },
  { id: 2, user: 'ninja_master', avatar: '🥷', lastMessage: 'Wanna play together?', time: '1d', unread: 0 },
];

export const InboxScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inbox</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Messages Section */}
        <TouchableOpacity style={styles.messagesHeader}>
          <View style={styles.messagesHeaderLeft}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
            <Text style={styles.messagesHeaderText}>Messages</Text>
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>2</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        {/* Quick Messages Preview */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.messagesPreview}>
          {MESSAGES.map((msg) => (
            <TouchableOpacity key={msg.id} style={styles.messagePreviewItem}>
              <View style={styles.messageAvatar}>
                <Text style={styles.messageAvatarText}>{msg.avatar}</Text>
                {msg.unread > 0 && (
                  <View style={styles.messageUnreadDot} />
                )}
              </View>
              <Text style={styles.messageUsername}>{msg.user}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Notifications */}
        <View style={styles.notificationsSection}>
          <Text style={styles.sectionTitle}>Activity</Text>
          
          {NOTIFICATIONS.map((notif) => (
            <TouchableOpacity key={notif.id} style={styles.notificationItem}>
              <View style={styles.notificationAvatar}>
                <Text style={styles.notificationAvatarText}>{notif.avatar}</Text>
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationText}>
                  <Text style={styles.notificationUser}>{notif.user}</Text>
                  {' '}{notif.message}
                  {notif.game && <Text style={styles.notificationGame}> on {notif.game}</Text>}
                </Text>
                {notif.score && (
                  <Text style={styles.notificationScore}>Score to beat: {notif.score}</Text>
                )}
                <Text style={styles.notificationTime}>{notif.time}</Text>
              </View>
              {notif.type === 'challenge' && (
                <TouchableOpacity style={styles.acceptButton}>
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
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
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  messagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messagesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messagesHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  unreadBadge: {
    backgroundColor: '#FE2C55',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  messagesPreview: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  messagePreviewItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  messageAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageAvatarText: {
    fontSize: 24,
  },
  messageUnreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FE2C55',
    borderWidth: 2,
    borderColor: '#000',
  },
  messageUsername: {
    color: '#fff',
    fontSize: 12,
  },
  notificationsSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a1a',
  },
  notificationAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationAvatarText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  notificationUser: {
    fontWeight: '600',
  },
  notificationGame: {
    color: '#999',
  },
  notificationScore: {
    color: '#FE2C55',
    fontSize: 13,
    marginTop: 2,
  },
  notificationTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  acceptButton: {
    backgroundColor: '#FE2C55',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
