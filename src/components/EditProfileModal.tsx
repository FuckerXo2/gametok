import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SlideRightModal } from './SlideRightModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { users } from '../services/api';
import { Avatar, AVATAR_BACKGROUNDS, AVATAR_PRESETS, getAvatarCreatorConfig, makeAvatarCreatorUri } from './Avatar';

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
  const [avatarBg, setAvatarBg] = useState(AVATAR_BACKGROUNDS[0]);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible && user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatar || '');
      setAvatarBg(getAvatarCreatorConfig(user.avatar)?.bg || AVATAR_BACKGROUNDS[0]);
    }
  }, [visible, user]);

  const selectedAvatarId = getAvatarCreatorConfig(avatarUrl)?.id || '';

  const handleSelectAvatar = (id: string) => {
    setAvatarUrl(makeAvatarCreatorUri(id, avatarBg));
  };

  const handleSelectAvatarBg = (bg: string) => {
    setAvatarBg(bg);
    if (selectedAvatarId) {
      setAvatarUrl(makeAvatarCreatorUri(selectedAvatarId, bg));
    }
  };

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

  const renderAvatarPreview = () => {
    return (
      <View style={styles.avatarWrapper}>
        <Avatar uri={avatarUrl || null} size={96} />
      </View>
    );
  };

  return (
    <SlideRightModal visible={visible} onClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
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
            {renderAvatarPreview()}
            <Text style={[styles.avatarTitle, { color: colors.text }]}>Choose your look</Text>
            <Text style={[styles.avatarSubtitle, { color: colors.textSecondary }]}>
              These show everywhere people see you.
            </Text>

            <View style={styles.avatarGrid}>
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = selectedAvatarId === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    activeOpacity={0.85}
                    onPress={() => handleSelectAvatar(preset.id)}
                    style={[
                      styles.avatarPreset,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <Avatar uri={makeAvatarCreatorUri(preset.id, avatarBg)} size={52} />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.avatarBgRow}>
              {AVATAR_BACKGROUNDS.map((bg) => (
                <TouchableOpacity
                  key={bg}
                  activeOpacity={0.85}
                  onPress={() => handleSelectAvatarBg(bg)}
                  style={[
                    styles.avatarBgChip,
                    {
                      backgroundColor: bg,
                      borderColor: avatarBg === bg ? colors.text : 'rgba(255,255,255,0.25)',
                    },
                  ]}
                />
              ))}
            </View>
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
    </SlideRightModal>
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
  avatarTitle: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  avatarSubtitle: { fontSize: 13, marginTop: 4, marginBottom: 18 },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  avatarPreset: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarBgRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  avatarBgChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
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
