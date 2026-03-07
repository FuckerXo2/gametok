import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { users } from '../services/api';
import { Avatar } from './Avatar';
import { AvatarCreatorModal, AvatarConfig, getAvatarById } from './AvatarCreator';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [localAvatarImage, setLocalAvatarImage] = useState<any>(null);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible && user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatar || '');
      setLocalAvatarImage(null);
    }
  }, [visible, user]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const result = await users.update(user.id, {
        displayName: displayName.trim() || user.displayName,
        bio: bio.trim(),
        avatar: avatarUrl || undefined,
      });
      console.log('[EditProfile] Update result:', result);
      await refreshUser();
      onClose();
    } catch (error) {
      console.log('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarCreated = (config: AvatarConfig, imageSource: any) => {
    setAvatarConfig(config);
    setLocalAvatarImage(imageSource);
    setAvatarUrl(`avatar-creator://${config.avatarId}?bg=${encodeURIComponent(config.backgroundColor)}`);
    setShowAvatarCreator(false);
  };

  // Determine what avatar to show in the preview
  const renderAvatarPreview = () => {
    if (localAvatarImage && avatarConfig) {
      return (
        <View style={styles.avatarWrapper}>
          <View style={[styles.creatorAvatarPreview, { backgroundColor: avatarConfig.backgroundColor }]}>
            <Image source={localAvatarImage} style={styles.creatorAvatarImage} />
          </View>
          <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.avatarWrapper}>
        <Avatar uri={avatarUrl || null} size={96} />
        <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
          <Ionicons name="sparkles" size={16} color="#fff" />
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={isSaving}>
            <Text style={[styles.headerBtnText, { color: colors.primary }]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={() => setShowAvatarCreator(true)}>
              {renderAvatarPreview()}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createAvatarBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAvatarCreator(true)}
            >
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.createAvatarText}>Create Avatar</Text>
            </TouchableOpacity>
          </View>

          {/* Display Name */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Display Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Enter display name"
              placeholderTextColor={colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={30}
            />
          </View>

          {/* Bio */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput, { backgroundColor: colors.surface, color: colors.text }]}
              placeholder="Tell us about yourself"
              placeholderTextColor={colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={150}
            />
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>{bio.length}/150</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Avatar Creator Modal */}
      <AvatarCreatorModal
        visible={showAvatarCreator}
        onClose={() => setShowAvatarCreator(false)}
        onSave={handleAvatarCreated}
        initialConfig={avatarConfig || undefined}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  headerBtn: { minWidth: 60 },
  headerBtnText: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  content: { flex: 1, padding: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
  },
  creatorAvatarPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarImage: {
    width: 96,
    height: 96,
    resizeMode: 'cover',
  },
  createAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 6,
  },
  createAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  bioInput: { height: 100, textAlignVertical: 'top', paddingTop: 14 },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 6 },
});
