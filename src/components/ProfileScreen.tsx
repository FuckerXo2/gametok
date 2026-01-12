import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ImageBackground,
  Modal,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/api';
import { AddFriendsScreen } from './AddFriendsScreen';
import { EditProfileModal } from './EditProfileModal';
import { Avatar } from './Avatar';

const SUGGESTED_FRIENDS: any[] = [];

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const username = isAuthenticated ? user?.username : 'guest';
  const displayName = isAuthenticated ? user?.displayName : '';
  const avatar = isAuthenticated ? user?.avatar : null;
  const bio = isAuthenticated ? (user?.bio || '') : '';
  const followers = isAuthenticated ? (user?.followers?.length || 0) : 0;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}>
      {/* Header with background */}
      <View style={styles.headerSection}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800' }}
          style={[styles.coverImage, { paddingTop: insets.top }]}
          resizeMode="cover"
        >
          {/* Top buttons */}
          <View style={styles.topButtons}>
            <View style={styles.topRight}>
              <TouchableOpacity style={styles.topBtn}>
                <Ionicons name="notifications-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBtn}>
                <Ionicons name="share-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBtn} onPress={() => setShowSettings(true)}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile info overlay */}
          <View style={styles.profileOverlay}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <Avatar uri={avatar} size={70} />
            </View>
            
            {/* Username and followers */}
            <View style={styles.userInfo}>
              <Text style={styles.username}>{displayName || username}</Text>
              <Text style={styles.followers}>· {followers.toLocaleString()} Followers</Text>
            </View>

            {/* Bio */}
            {bio ? (
              <Text style={styles.bio}>{bio}</Text>
            ) : null}

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.editProfileBtn} onPress={() => setShowEditProfile(true)}>
                <Ionicons name="pencil" size={18} color="#fff" />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* Find Friends Section */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => setShowAddFriends(true)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Find Friends</Text>
        </TouchableOpacity>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.friendsScroll}
        >
          {SUGGESTED_FRIENDS.map((friend) => (
            <View key={friend.id} style={[styles.friendCard, { backgroundColor: colors.background }]}>
              <TouchableOpacity style={styles.dismissBtn}>
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <View style={styles.friendAvatarContainer}>
                <Avatar uri={friend.avatar} size={56} />
                {friend.online && <View style={styles.onlineDot} />}
              </View>
              
              <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                {friend.name}
              </Text>
              <Text style={[styles.friendStatus, { color: colors.textSecondary }]}>
                {friend.status}
              </Text>
              
              <TouchableOpacity style={[styles.addBtn, { borderColor: colors.border }]}>
                <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>Add</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Extra space at bottom */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Friends Modal */}
      <AddFriendsScreen visible={showAddFriends} onClose={() => setShowAddFriends(false)} />
      
      {/* Edit Profile Modal */}
      <EditProfileModal visible={showEditProfile} onClose={() => setShowEditProfile(false)} />

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent onRequestClose={() => setShowSettings(false)}>
        <View style={styles.settingsOverlay}>
          <TouchableOpacity style={styles.settingsDismiss} onPress={() => setShowSettings(false)} activeOpacity={1} />
          <View style={[styles.settingsContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.settingsHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.settingsContent}>
              {/* Account Section */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
              
              <TouchableOpacity style={[styles.settingsItem, { borderBottomColor: colors.border }]}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="person-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.settingsItem, { borderBottomColor: colors.border }]}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="lock-closed-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Privacy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.settingsItem, { borderBottomColor: colors.border }]}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="notifications-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Notifications</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Preferences Section */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>PREFERENCES</Text>
              
              <View style={[styles.settingsItem, { borderBottomColor: colors.border }]}>
                <View style={styles.settingsItemLeft}>
                  <Ionicons name={isDark ? "moon" : "sunny-outline"} size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Dark Mode</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {/* Support Section */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>SUPPORT</Text>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomColor: colors.border }]}
                onPress={() => Linking.openURL('mailto:support@gametok.app')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="mail-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Contact Us</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomColor: colors.border }]}
                onPress={() => Linking.openURL('https://gametok.app/help')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="help-circle-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Help Center</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomColor: colors.border }]}
                onPress={() => Linking.openURL('https://gametok.app/privacy')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.settingsItem, { borderBottomColor: colors.border }]}
                onPress={() => Linking.openURL('https://gametok.app/terms')}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="document-text-outline" size={22} color={colors.text} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Terms of Service</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity 
                style={[styles.settingsItem, { marginTop: 24 }]} 
                onPress={() => {
                  setShowSettings(false);
                  logout();
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
                  <Text style={[styles.settingsItemText, { color: '#FF3B30' }]}>Log Out</Text>
                </View>
              </TouchableOpacity>

              {/* Delete Account */}
              <TouchableOpacity 
                style={[styles.settingsItem, styles.deleteItem]} 
                onPress={() => {
                  Alert.alert(
                    'Delete Account',
                    'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Delete', 
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await auth.deleteAccount();
                            setShowSettings(false);
                            logout();
                          } catch (error) {
                            Alert.alert('Error', 'Failed to delete account. Please try again.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <View style={styles.settingsItemLeft}>
                  <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                  <Text style={[styles.settingsItemText, { color: '#FF3B30' }]}>Delete Account</Text>
                </View>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    height: 380,
  },
  coverImage: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRight: {
    flexDirection: 'row',
    gap: 8,
  },
  profileOverlay: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  avatarContainer: {
    marginBottom: 8,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  followers: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginLeft: 4,
  },
  bio: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editProfileBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  editProfileText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
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
  friendsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  friendCard: {
    width: 110,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  friendAvatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendEmoji: {
    fontSize: 28,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: '#fff',
  },
  friendName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  friendStatus: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Settings Modal
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  settingsDismiss: {
    flex: 1,
  },
  settingsContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  settingsContent: {
    paddingHorizontal: 20,
  },
  settingsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  settingsItemText: {
    fontSize: 16,
  },
  logoutItem: {
    marginTop: 24,
    borderBottomWidth: 0,
  },
  deleteItem: {
    borderBottomWidth: 0,
  },
});
