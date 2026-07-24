// PublishSheet — the "ship it to the Feed" step of the Wish studio.
//
// Appears only once a game is live (created + playable). Lets the maker name the
// game and pick who can see it, then posts it to the Feed. Deliberately minimal:
// publishing is a commit action, not another place to keep tinkering.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, radii, type as t } from '../../theme/tokens';

export type Privacy = 'public' | 'unlisted';

interface Props {
  visible: boolean;
  defaultTitle: string;
  publishing: boolean;
  onCancel: () => void;
  onPublish: (title: string, privacy: Privacy) => void;
}

const VISIBILITY: { key: Privacy; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'public', label: 'Public', sub: 'Anyone can find and play it', icon: 'globe-outline' },
  { key: 'unlisted', label: 'Unlisted', sub: 'Only people with the link', icon: 'link-outline' },
];

export const PublishSheet = ({ visible, defaultTitle, publishing, onCancel, onPublish }: Props) => {
  const [title, setTitle] = useState(defaultTitle);
  const [privacy, setPrivacy] = useState<Privacy>('public');

  // Re-seed the title each time the sheet opens on a fresh game.
  useEffect(() => {
    if (visible) setTitle(defaultTitle);
  }, [visible, defaultTitle]);

  const canPost = title.trim().length > 0 && !publishing;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Tap the scrim to dismiss — but not while a publish is in flight. */}
        <Pressable style={styles.scrim} onPress={publishing ? undefined : onCancel} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Publish to Feed</Text>
              <Text style={styles.subtitle}>Your game goes live for others to play.</Text>
            </View>
            <Pressable onPress={onCancel} hitSlop={10} disabled={publishing} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={palette.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>GAME NAME</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Name your game"
            placeholderTextColor={palette.textGhost}
            maxLength={48}
            editable={!publishing}
            returnKeyType="done"
          />

          <Text style={styles.fieldLabel}>VISIBILITY</Text>
          <View style={styles.visRow}>
            {VISIBILITY.map((opt) => {
              const active = privacy === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => !publishing && setPrivacy(opt.key)}
                  style={[styles.visCard, active && styles.visCardActive]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={active ? palette.purpleSoft : palette.textDim}
                  />
                  <Text style={[styles.visLabel, active && styles.visLabelActive]}>{opt.label}</Text>
                  <Text style={styles.visSub}>{opt.sub}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => canPost && onPublish(title.trim(), privacy)}
            disabled={!canPost}
            style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
          >
            {publishing ? (
              <ActivityIndicator size="small" color={palette.black} />
            ) : (
              <>
                <Ionicons name="rocket" size={18} color={palette.black} />
                <Text style={styles.postText}>Post to Feed</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: palette.scrim },
  sheet: {
    marginTop: 'auto',
    backgroundColor: palette.ink800,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
    borderTopWidth: 1,
    borderColor: palette.line,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: palette.lineStrong,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl },
  title: {
    color: palette.text,
    fontSize: t.size.h3,
    fontFamily: t.family.bold,
    letterSpacing: t.letter.snug,
  },
  subtitle: {
    color: palette.textDim,
    fontSize: t.size.small,
    fontFamily: t.family.regular,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.glassWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    color: palette.textDim,
    fontSize: t.size.micro,
    fontFamily: t.family.semibold,
    letterSpacing: t.letter.wide,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: palette.ink600,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.semibold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  visRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl },
  visCard: {
    flex: 1,
    backgroundColor: palette.ink600,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: palette.line,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  visCardActive: {
    borderColor: palette.purple,
    backgroundColor: palette.glassWhite,
  },
  visLabel: {
    color: palette.textMuted,
    fontSize: t.size.body,
    fontFamily: t.family.bold,
    marginTop: 2,
  },
  visLabelActive: { color: palette.text },
  visSub: {
    color: palette.textDim,
    fontSize: t.size.caption,
    fontFamily: t.family.regular,
    lineHeight: 16,
  },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: palette.text,
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
  },
  postBtnDisabled: { opacity: 0.4 },
  postText: {
    color: palette.black,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.bold,
    letterSpacing: t.letter.snug,
  },
});
