import React, { useCallback, useState } from 'react';
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
import {
  Avatar,
  DICEBEAR_ACCESSORY_OPTIONS,
  DICEBEAR_BACKGROUNDS,
  DICEBEAR_BROW_OPTIONS,
  DICEBEAR_EARRING_OPTIONS,
  DICEBEAR_EYE_OPTIONS,
  DICEBEAR_FEATURE_OPTIONS,
  DICEBEAR_HAIR_COLORS,
  DICEBEAR_HAIR_OPTIONS,
  DICEBEAR_MOUTH_OPTIONS,
  DICEBEAR_SKIN_TONES,
  DicebearConfig,
  getDicebearConfig,
  makeDicebearAvatarUri,
} from './Avatar';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const PREVIEW_SIZE = 56;
const PREVIEW_RING = 3;

type PickerKey = 'hair' | 'eyes' | 'eyebrows' | 'mouth' | 'accessory' | 'feature' | 'earrings';
type AppearanceTab = 'bg' | 'skin' | 'hair' | 'eyes' | 'brows' | 'mouth' | 'extras';
type EditorMode = 'profile' | 'avatar';

type PickerColors = {
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  surface: string;
};

const APPEARANCE_TABS: {
  id: AppearanceTab;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'bg', label: 'Scene', hint: 'Choose the backdrop color people see behind you.', icon: 'images-outline' },
  { id: 'skin', label: 'Skin', hint: 'Tune the skin tone first so the face feels right.', icon: 'body-outline' },
  { id: 'hair', label: 'Hair', hint: 'Pick the cut and color together.', icon: 'cut-outline' },
  { id: 'eyes', label: 'Eyes', hint: 'Choose the eyes that carry the attitude.', icon: 'eye-outline' },
  { id: 'brows', label: 'Brows', hint: 'Small change, big expression.', icon: 'analytics-outline' },
  { id: 'mouth', label: 'Mouth', hint: 'Set the smile, smirk, or chaos.', icon: 'chatbubble-ellipses-outline' },
  { id: 'extras', label: 'Extras', hint: 'Glasses and finishing touches.', icon: 'sparkles-outline' },
];

/** Matches `DICEBEAR_SKIN_TONES` order in `Avatar.tsx`. */
const SKIN_SWATCH_LABELS = ['Fair', 'Warm', 'Tan', 'Rich', 'Deep'];

/** Matches `DICEBEAR_HAIR_COLORS` order — short hue names for the picker. */
const HAIR_DYE_LABELS = ['Espresso', 'Mocha', 'Chestnut', 'Honey', 'Platinum', 'Wine', 'Slate'];

const HAIR_STYLE_LABELS: Record<string, string> = {
  short01: 'Classic crop',
  short02: 'Neat fade',
  short03: 'Soft fringe',
  short04: 'Side sweep',
  short05: 'Buzz cut',
  short06: 'Taper cut',
  long01: 'Loose waves',
  long02: 'Long layers',
  long03: 'Curly drop',
  long04: 'Straight flow',
};

const EYE_PRESET_LABELS = ['Wide awake', 'Focused', 'Soft', 'Sleepy', 'Curious', 'Playful', 'Bold', 'Bright'];
const BROW_PRESET_LABELS = ['Lifted', 'Calm', 'Sharp', 'Soft', 'Hero', 'Chill', 'Arc', 'Serious'];
const MOUTH_PRESET_LABELS = ['Smile', 'Smirk', 'Open grin', 'Soft grin', 'Calm', 'Wide laugh', 'Tiny smile', 'Cheerful'];

const VIBE_PRESETS: Array<{
  id: string;
  label: string;
  config: Partial<DicebearConfig>;
}> = [
  {
    id: 'soft',
    label: 'Soft',
    config: {
      bg: DICEBEAR_BACKGROUNDS[1],
      hair: 'long02',
      hairColor: DICEBEAR_HAIR_COLORS[4],
      eyes: 'variant03',
      eyebrows: 'variant02',
      mouth: 'variant01',
      accessory: 'blank',
      feature: 'blush',
      earrings: 'blank',
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    config: {
      bg: DICEBEAR_BACKGROUNDS[2],
      hair: 'short04',
      hairColor: DICEBEAR_HAIR_COLORS[0],
      eyes: 'variant07',
      eyebrows: 'variant07',
      mouth: 'variant06',
      accessory: 'variant02',
      feature: 'birthmark',
      earrings: 'variant03',
    },
  },
  {
    id: 'chill',
    label: 'Chill',
    config: {
      bg: DICEBEAR_BACKGROUNDS[3],
      hair: 'short02',
      hairColor: DICEBEAR_HAIR_COLORS[1],
      eyes: 'variant02',
      eyebrows: 'variant06',
      mouth: 'variant05',
      accessory: 'variant01',
      feature: 'freckles',
      earrings: 'blank',
    },
  },
  {
    id: 'chaos',
    label: 'Chaos',
    config: {
      bg: DICEBEAR_BACKGROUNDS[5],
      hair: 'long03',
      hairColor: DICEBEAR_HAIR_COLORS[5],
      eyes: 'variant06',
      eyebrows: 'variant03',
      mouth: 'variant07',
      accessory: 'blank',
      feature: 'mustache',
      earrings: 'variant05',
    },
  },
];

const accessoryLabel = (v: string) =>
  v === 'blank' ? 'None' : v === 'variant01' ? 'Glasses' : v === 'variant02' ? 'Shades' : `Frame ${v.replace('variant', '')}`;

const featureLabel = (v: string) =>
  v === 'blank' ? 'None' : v === 'birthmark' ? 'Birthmark' : v.charAt(0).toUpperCase() + v.slice(1);

const earringLabel = (v: string) => (v === 'blank' ? 'None' : `Earring ${v.replace('variant', '')}`);

const hairStyleLabel = (id: string) => {
  return HAIR_STYLE_LABELS[id] || 'Style';
};

const variantPresetLabel = (id: string, labels: string[]) => {
  const m = id.match(/^variant0*(\d+)$/i);
  if (!m) return 'Preset';
  const index = Math.max(0, parseInt(m[1], 10) - 1);
  return labels[index] || `Preset ${index + 1}`;
};

const withPickerValue = (config: DicebearConfig, key: PickerKey, value: string): DicebearConfig => ({
  ...config,
  [key]: value,
});

const AvatarPreviewChip = React.memo(function AvatarPreviewChip({
  uri,
  userId,
  selected,
  borderIdle,
  borderSelected,
  onPress,
}: {
  uri: string;
  userId?: string;
  selected: boolean;
  borderIdle: string;
  borderSelected: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.chipOuter}>
      <View
        style={[
          styles.chipRing,
          {
            borderColor: selected ? borderSelected : borderIdle,
            borderWidth: selected ? PREVIEW_RING : 2,
          },
        ]}
      >
        <Avatar uri={uri} userId={userId} size={PREVIEW_SIZE} />
      </View>
    </TouchableOpacity>
  );
});

function AvatarOptionRow({
  title,
  optionKey,
  options,
  avatarConfig,
  userId,
  colors,
  onSelect,
  bottomLabel,
  onShuffle,
}: {
  title: string;
  optionKey: PickerKey;
  options: readonly string[];
  avatarConfig: DicebearConfig;
  userId?: string;
  colors: PickerColors;
  onSelect: (key: PickerKey, value: string) => void;
  bottomLabel: (value: string) => string;
  onShuffle: () => void;
}) {
  return (
    <View style={styles.pickerBlock}>
      <View style={styles.blockHeader}>
        <Text style={[styles.blockTitle, { color: colors.text }]}>{title}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onShuffle}
          style={[styles.shuffleBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Ionicons name="shuffle-outline" size={14} color={colors.primary} />
          <Text style={[styles.shuffleBtnText, { color: colors.primary }]}>Mix</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.pickerScrollContent}
      >
        {options.map((opt) => {
          const current = avatarConfig[optionKey];
          const selected =
            optionKey === 'accessory' ? (current || 'blank') === opt : current === opt;
          const uri = makeDicebearAvatarUri(withPickerValue(avatarConfig, optionKey, opt));
          return (
            <View key={opt} style={styles.chipColumn}>
              <AvatarPreviewChip
                uri={uri}
                userId={userId}
                selected={selected}
                borderIdle={colors.border}
                borderSelected={colors.primary}
                onPress={() => onSelect(optionKey, opt)}
              />
              <Text
                style={[styles.chipCaption, { color: selected ? colors.primary : colors.textSecondary }]}
                numberOfLines={2}
              >
                {bottomLabel(opt)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarConfig, setAvatarConfig] = useState<DicebearConfig>({
    seed: user?.id || 'gametok',
    bg: DICEBEAR_BACKGROUNDS[0],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [appearanceTab, setAppearanceTab] = useState<AppearanceTab>('skin');
  const [editorMode, setEditorMode] = useState<EditorMode>('profile');

  React.useEffect(() => {
    if (visible && user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      const nextConfig = getDicebearConfig(user.avatar) || {
        seed: user.id || user.username || 'gametok',
        bg: DICEBEAR_BACKGROUNDS[0],
      };
      setAvatarConfig(nextConfig);
      setAppearanceTab('skin');
      setEditorMode('profile');
    }
  }, [visible, user]);

  const pickerColors: PickerColors = {
    text: colors.text,
    textSecondary: colors.textSecondary,
    border: colors.border,
    primary: colors.primary,
    surface: colors.surface,
  };

  const onPickPart = useCallback((key: PickerKey, value: string) => {
    setAvatarConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const randomizePart = useCallback((key: PickerKey, options: readonly string[]) => {
    setAvatarConfig((prev) => {
      const next = options[Math.floor(Math.random() * options.length)] || options[0];
      return { ...prev, [key]: next };
    });
  }, []);

  const rerollAvatar = useCallback(() => {
    setAvatarConfig((prev) => ({
      ...prev,
      bg: DICEBEAR_BACKGROUNDS[Math.floor(Math.random() * DICEBEAR_BACKGROUNDS.length)] || prev.bg,
      skinColor:
        DICEBEAR_SKIN_TONES[Math.floor(Math.random() * DICEBEAR_SKIN_TONES.length)] || prev.skinColor,
      hairColor:
        DICEBEAR_HAIR_COLORS[Math.floor(Math.random() * DICEBEAR_HAIR_COLORS.length)] || prev.hairColor,
      hair: DICEBEAR_HAIR_OPTIONS[Math.floor(Math.random() * DICEBEAR_HAIR_OPTIONS.length)] || prev.hair,
      eyes: DICEBEAR_EYE_OPTIONS[Math.floor(Math.random() * DICEBEAR_EYE_OPTIONS.length)] || prev.eyes,
      eyebrows:
        DICEBEAR_BROW_OPTIONS[Math.floor(Math.random() * DICEBEAR_BROW_OPTIONS.length)] || prev.eyebrows,
      mouth: DICEBEAR_MOUTH_OPTIONS[Math.floor(Math.random() * DICEBEAR_MOUTH_OPTIONS.length)] || prev.mouth,
      accessory:
        DICEBEAR_ACCESSORY_OPTIONS[Math.floor(Math.random() * DICEBEAR_ACCESSORY_OPTIONS.length)] ||
        prev.accessory,
      feature:
        DICEBEAR_FEATURE_OPTIONS[Math.floor(Math.random() * DICEBEAR_FEATURE_OPTIONS.length)] ||
        prev.feature,
      earrings:
        DICEBEAR_EARRING_OPTIONS[Math.floor(Math.random() * DICEBEAR_EARRING_OPTIONS.length)] ||
        prev.earrings,
    }));
  }, []);

  const applyVibePreset = useCallback((preset: Partial<DicebearConfig>) => {
    setAvatarConfig((prev) => ({ ...prev, ...preset }));
  }, []);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const result = await users.update(user.id, {
        displayName: displayName.trim() || user.displayName,
        bio: bio.trim(),
        avatar: makeDicebearAvatarUri(avatarConfig),
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

  const tabHint = APPEARANCE_TABS.find((t) => t.id === appearanceTab)?.hint ?? '';
  const handleBack = editorMode === 'avatar' ? () => setEditorMode('profile') : onClose;

  return (
    <SlideRightModal visible={visible} onClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {editorMode === 'avatar' ? 'Avatar' : 'Edit Profile'}
          </Text>
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
          {editorMode === 'profile' ? (
            <>
              <View style={styles.profileHero}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setEditorMode('avatar')}
                  style={styles.profileAvatarButton}
                >
                  <View style={[styles.profileAvatarRing, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <Avatar uri={makeDicebearAvatarUri(avatarConfig)} userId={user?.id} size={126} />
                  </View>
                  <View style={[styles.profilePencilBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="pencil" size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={[styles.profileEditName, { color: colors.text }]} numberOfLines={2}>
                  {displayName.trim() || user?.displayName || 'GameTOK player'}
                </Text>
                <Text style={[styles.profileEditHandle, { color: colors.textSecondary }]}>
                  @{user?.username || 'gametok'}
                </Text>
                <Text style={[styles.avatarSubtitle, { color: colors.textSecondary }]}>
                  Tap your avatar to customize the full DiceBear look.
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
            </>
          ) : (
            <>
          <View style={[styles.characterStage, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.hero}>
              <View style={[styles.previewHalo, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Avatar uri={makeDicebearAvatarUri(avatarConfig)} userId={user?.id} size={176} />
              </View>
              <Text style={[styles.avatarTitle, { color: colors.text }]}>Build your look</Text>
              <Text style={[styles.avatarSubtitle, { color: colors.textSecondary }]}>
                Pick a vibe, then sculpt the details.
              </Text>
              <View style={styles.previewActionRow}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={rerollAvatar}
                  style={[styles.primaryActionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Ionicons name="shuffle-outline" size={18} color={colors.text} />
                  <Text style={[styles.primaryActionText, { color: colors.text }]}>Random look</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.vibeRow}
                style={styles.vibeWrap}
              >
                {VIBE_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    activeOpacity={0.88}
                    onPress={() => applyVibePreset(preset.config)}
                    style={[styles.vibeChip, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <Text style={[styles.vibeChipText, { color: colors.text }]}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={[styles.sheetCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.panel, styles.panelInsideSheet, { borderTopColor: 'transparent' }]}>
              <View style={styles.builderHeader}>
                <View>
                  <Text style={[styles.panelHeading, { color: colors.textSecondary }]}>Avatar Studio</Text>
                  <Text style={[styles.builderTitle, { color: colors.text }]}>
                    {APPEARANCE_TABS.find((t) => t.id === appearanceTab)?.label}
                  </Text>
                </View>
                <View style={[styles.builderBadge, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={[styles.builderBadgeText, { color: colors.primary }]}>DiceBear</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.categoryRail}
                style={styles.categoryRailWrap}
              >
                {APPEARANCE_TABS.map((tab) => {
                  const active = appearanceTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      activeOpacity={0.88}
                      onPress={() => setAppearanceTab(tab.id)}
                      style={styles.categoryItem}
                    >
                      <View
                        style={[
                          styles.categoryIconBubble,
                          {
                            backgroundColor: active ? `${colors.primary}22` : colors.background,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={tab.icon}
                          size={22}
                          color={active ? colors.primary : colors.textSecondary}
                        />
                      </View>
                      <Text style={[styles.categoryTileText, { color: active ? colors.primary : colors.textSecondary }]}>
                        {tab.label}
                      </Text>
                      <View
                        style={[
                          styles.categoryActiveDot,
                          { backgroundColor: active ? colors.primary : 'transparent' },
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

            <Text style={[styles.tabHint, { color: colors.textSecondary }]}>{tabHint}</Text>

            {appearanceTab === 'bg' && (
              <>
                <View style={styles.block}>
                  <Text style={[styles.blockTitle, { color: colors.text }]}>Background</Text>
                  <View style={styles.swatchRow}>
                    {DICEBEAR_BACKGROUNDS.map((bg, index) => (
                      <TouchableOpacity
                        key={bg}
                        activeOpacity={0.85}
                        onPress={() => setAvatarConfig((prev) => ({ ...prev, bg }))}
                        style={styles.swatchColumn}
                      >
                        <View
                          style={[
                            styles.avatarBgChip,
                            {
                              backgroundColor: `#${bg}`,
                              borderColor: avatarConfig.bg === bg ? colors.primary : colors.border,
                              borderWidth: avatarConfig.bg === bg ? 3 : 2,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.swatchCaption,
                            { color: avatarConfig.bg === bg ? colors.primary : colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {`Slot ${index + 1}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {appearanceTab === 'skin' && (
              <>
                <View style={styles.block}>
                  <Text style={[styles.blockTitle, { color: colors.text }]}>Skin tone</Text>
                  <View style={styles.swatchRow}>
                    {DICEBEAR_SKIN_TONES.map((tone, index) => (
                      <TouchableOpacity
                        key={tone}
                        activeOpacity={0.85}
                        onPress={() => setAvatarConfig((prev) => ({ ...prev, skinColor: tone }))}
                        style={styles.swatchColumn}
                      >
                        <View
                          style={[
                            styles.avatarBgChip,
                            {
                              backgroundColor: `#${tone}`,
                              borderColor: avatarConfig.skinColor === tone ? colors.primary : colors.border,
                              borderWidth: avatarConfig.skinColor === tone ? 3 : 2,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.swatchCaption,
                            { color: avatarConfig.skinColor === tone ? colors.primary : colors.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {SKIN_SWATCH_LABELS[index] ?? `Tone ${index + 1}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {appearanceTab === 'hair' && (
              <>
                <AvatarOptionRow
                  title="Hair style"
                  optionKey="hair"
                  options={DICEBEAR_HAIR_OPTIONS}
                  avatarConfig={avatarConfig}
                  userId={user?.id}
                  colors={pickerColors}
                  onSelect={onPickPart}
                  bottomLabel={hairStyleLabel}
                  onShuffle={() => randomizePart('hair', DICEBEAR_HAIR_OPTIONS)}
                />
                <View style={styles.block}>
                  <Text style={[styles.blockTitle, { color: colors.text }]}>Hair color</Text>
                  <View style={styles.swatchRow}>
                    {DICEBEAR_HAIR_COLORS.map((tone, index) => (
                      <TouchableOpacity
                        key={tone}
                        activeOpacity={0.85}
                        onPress={() => setAvatarConfig((prev) => ({ ...prev, hairColor: tone }))}
                        style={styles.swatchColumn}
                      >
                        <View
                          style={[
                            styles.avatarBgChip,
                            {
                              backgroundColor: `#${tone}`,
                              borderColor: avatarConfig.hairColor === tone ? colors.primary : colors.border,
                              borderWidth: avatarConfig.hairColor === tone ? 3 : 2,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.swatchCaption,
                            { color: avatarConfig.hairColor === tone ? colors.primary : colors.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {HAIR_DYE_LABELS[index] ?? `Tone ${index + 1}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            {appearanceTab === 'eyes' && (
              <>
                <AvatarOptionRow
                  title="Eyes"
                  optionKey="eyes"
                  options={DICEBEAR_EYE_OPTIONS}
                  avatarConfig={avatarConfig}
                  userId={user?.id}
                  colors={pickerColors}
                  onSelect={onPickPart}
                  bottomLabel={(value) => variantPresetLabel(value, EYE_PRESET_LABELS)}
                  onShuffle={() => randomizePart('eyes', DICEBEAR_EYE_OPTIONS)}
                />
              </>
            )}

            {appearanceTab === 'brows' && (
              <>
                <AvatarOptionRow
                  title="Brows"
                  optionKey="eyebrows"
                  options={DICEBEAR_BROW_OPTIONS}
                  avatarConfig={avatarConfig}
                  userId={user?.id}
                  colors={pickerColors}
                  onSelect={onPickPart}
                  bottomLabel={(value) => variantPresetLabel(value, BROW_PRESET_LABELS)}
                  onShuffle={() => randomizePart('eyebrows', DICEBEAR_BROW_OPTIONS)}
                />
              </>
            )}

            {appearanceTab === 'mouth' && (
              <>
                <AvatarOptionRow
                  title="Mouth"
                  optionKey="mouth"
                  options={DICEBEAR_MOUTH_OPTIONS}
                  avatarConfig={avatarConfig}
                  userId={user?.id}
                  colors={pickerColors}
                  onSelect={onPickPart}
                  bottomLabel={(value) => variantPresetLabel(value, MOUTH_PRESET_LABELS)}
                  onShuffle={() => randomizePart('mouth', DICEBEAR_MOUTH_OPTIONS)}
                />
              </>
            )}

            {appearanceTab === 'extras' && (
              <>
                <AvatarOptionRow
                  title="Accessories"
                  optionKey="accessory"
                  options={DICEBEAR_ACCESSORY_OPTIONS}
                  avatarConfig={avatarConfig}
                  userId={user?.id}
                  colors={pickerColors}
                  onSelect={onPickPart}
                  bottomLabel={accessoryLabel}
                  onShuffle={() => randomizePart('accessory', DICEBEAR_ACCESSORY_OPTIONS)}
                />
                <AvatarOptionRow
                  title="Face details"
                  optionKey="feature"
                  options={DICEBEAR_FEATURE_OPTIONS}
                  avatarConfig={avatarConfig}
                  userId={user?.id}
                  colors={pickerColors}
                  onSelect={onPickPart}
                  bottomLabel={featureLabel}
                  onShuffle={() => randomizePart('feature', DICEBEAR_FEATURE_OPTIONS)}
                />
                <AvatarOptionRow
                  title="Earrings"
                  optionKey="earrings"
                  options={DICEBEAR_EARRING_OPTIONS}
                  avatarConfig={avatarConfig}
                  userId={user?.id}
                  colors={pickerColors}
                  onSelect={onPickPart}
                  bottomLabel={earringLabel}
                  onShuffle={() => randomizePart('earrings', DICEBEAR_EARRING_OPTIONS)}
                />
                <Text style={[styles.attribution, { color: colors.textSecondary }]}>
                  Avatars by DiceBear Adventurer
                </Text>
              </>
            )}
            </View>
          </View>
            </>
          )}

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
