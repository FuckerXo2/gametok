import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SlideRightModal } from './SlideRightModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { users } from '../services/api';
import { Avatar } from './Avatar';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

// Name and bio. The picture is the headshot of the player's 3D avatar: they change their look in Profile.
export const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (visible && user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
    }
  }, [visible, user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await users.update(user.id, { displayName: displayName.trim() || user.displayName, bio: bio.trim() });
      await refreshUser();
      onClose();
    } catch (error) {
      console.log('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SlideRightModal visible={visible} onClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.profileHero}>
            <View style={[styles.profileAvatarRing, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Avatar uri={user?.avatar} userId={user?.id} size={126} />
            </View>
            <Text style={[styles.profileEditName, { color: colors.text }]} numberOfLines={2}>
              {displayName.trim() || user?.displayName || 'GameTOK player'}
            </Text>
            <Text style={[styles.profileEditHandle, { color: colors.textSecondary }]}>
              @{user?.username || 'gametok'}
            </Text>
            <Text style={[styles.avatarSubtitle, { color: colors.textSecondary }]}>
              Your picture is your avatar. Change your look in Profile.
            </Text>
          </View>

          <View style={[styles.panel, styles.profileDetailsPanel, { borderTopColor: colors.border }]}>
            <Text style={[styles.panelHeading, { color: colors.textSecondary }]}>About you</Text>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Display name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
                placeholder="Enter display name"
                placeholderTextColor={colors.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={30}
              />
            </View>

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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 60 },
  headerBtnText: { fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16 },
  profileHero: {
    alignItems: 'center',
    paddingTop: 34,
    paddingBottom: 28,
  },
  profileAvatarButton: {
    position: 'relative',
    marginBottom: 18,
  },
  profileAvatarRing: {
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profilePencilBadge: {
    position: 'absolute',
    right: 6,
    bottom: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#000',
  },
  profileEditName: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.6,
    paddingHorizontal: 24,
  },
  profileEditHandle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  profileDetailsPanel: {
    paddingHorizontal: 2,
    paddingTop: 24,
  },
  characterStage: {
    marginTop: 14,
    marginBottom: 14,
    borderRadius: 34,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 14,
  },
  previewHalo: {
    width: 228,
    height: 228,
    borderRadius: 114,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 20,
  },
  avatarSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 38,
    lineHeight: 20,
  },
  previewActionRow: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  vibeWrap: {
    marginTop: 16,
    maxHeight: 42,
  },
  vibeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  vibeChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  vibeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetCard: {
    borderRadius: 32,
    marginBottom: 14,
    overflow: 'hidden',
  },
  panel: {
    width: '100%',
    paddingTop: 20,
    marginBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  panelInsideSheet: {
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  builderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 14,
  },
  builderTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  builderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 2,
  },
  builderBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  panelHeading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  categoryRailWrap: {
    marginBottom: 10,
  },
  categoryRail: {
    flexDirection: 'row',
    gap: 16,
    paddingRight: 4,
  },
  categoryItem: {
    width: 64,
    alignItems: 'center',
    gap: 6,
  },
  categoryIconBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTileText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  categoryActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tabBarWrap: { marginBottom: 8, maxHeight: 48 },
  tabBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tabPillTextWrap: { justifyContent: 'center' },
  tabPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  block: { marginBottom: 22 },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  shuffleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 14,
  },
  swatchColumn: {
    alignItems: 'center',
    width: 52,
  },
  avatarBgChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  swatchCaption: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  pickerBlock: {
    marginBottom: 24,
  },
  pickerScrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 4,
    paddingRight: 8,
  },
  chipOuter: {},
  chipRing: {
    borderRadius: 999,
    padding: 2,
    overflow: 'hidden',
  },
  chipColumn: {
    alignItems: 'center',
    width: 102,
  },
  chipCaption: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  attribution: {
    fontSize: 11,
    marginTop: 8,
    marginBottom: 4,
  },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  bioInput: { height: 100, textAlignVertical: 'top', paddingTop: 14 },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 6 },
});
