import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Share,
  Dimensions,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 80;

interface ShareProfileCardProps {
  visible: boolean;
  onClose: () => void;
}

export const ShareProfileCard: React.FC<ShareProfileCardProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const profileUrl = `https://gametok-games.pages.dev/u/${user?.username || 'user'}`;

  const handleShare = async (platform?: string) => {
    try {
      await Share.share({
        message: `Add me on GameTOK! ${profileUrl}`,
        url: profileUrl,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleCopyLink = () => {
    // In a real app, use Clipboard API
    handleShare();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={80} tint="dark" style={styles.container}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        {/* Header */}
        <View style={[styles.header, { top: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.findContactsBtn}>
            <Ionicons name="people" size={18} color="#fff" />
            <Text style={styles.findContactsText}>Find Contacts</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.cardContainer}>
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53', '#FFC107']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* QR Code */}
            <View style={styles.qrContainer}>
              <QRCode
                value={profileUrl}
                size={160}
                backgroundColor="transparent"
                color="#000"
              />
              {/* Avatar overlay in center of QR */}
              <View style={styles.avatarOverlay}>
                <Avatar uri={user?.avatar} size={40} />
              </View>
            </View>

            {/* User Info */}
            <Text style={styles.displayName}>
              {user?.displayName || user?.username || 'GameTOK User'}
            </Text>
            <Text style={styles.username}>@{user?.username || 'username'}</Text>
          </LinearGradient>
        </View>

        {/* Share Options */}
        <View style={[styles.shareOptions, { paddingBottom: insets.bottom + 20 }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shareScroll}
          >
            <TouchableOpacity style={styles.shareBtn} onPress={handleCopyLink}>
              <View style={[styles.shareIcon, { backgroundColor: '#666' }]}>
                <Ionicons name="link" size={24} color="#fff" />
              </View>
              <Text style={styles.shareLabel}>Copy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare('whatsapp')}>
              <View style={[styles.shareIcon, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#fff" />
              </View>
              <Text style={styles.shareLabel}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare('instagram')}>
              <View style={[styles.shareIcon, { backgroundColor: '#E4405F' }]}>
                <Ionicons name="logo-instagram" size={24} color="#fff" />
              </View>
              <Text style={styles.shareLabel}>Instagram</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare('messages')}>
              <View style={[styles.shareIcon, { backgroundColor: '#34C759' }]}>
                <Ionicons name="chatbubble" size={24} color="#fff" />
              </View>
              <Text style={styles.shareLabel}>Messages</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare('twitter')}>
              <View style={[styles.shareIcon, { backgroundColor: '#000' }]}>
                <Ionicons name="logo-twitter" size={24} color="#fff" />
              </View>
              <Text style={styles.shareLabel}>X</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare()}>
              <View style={[styles.shareIcon, { backgroundColor: '#007AFF' }]}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
              </View>
              <Text style={styles.shareLabel}>More</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  findContactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  findContactsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cardContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    width: CARD_WIDTH,
    paddingVertical: 40,
    paddingHorizontal: 30,
    borderRadius: 24,
    alignItems: 'center',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    position: 'relative',
  },
  avatarOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 2,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.6)',
    fontWeight: '500',
  },
  shareOptions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  shareScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  shareBtn: {
    alignItems: 'center',
    width: 70,
  },
  shareIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
