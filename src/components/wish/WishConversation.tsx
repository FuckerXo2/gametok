// WishConversation — the one continuous thread that IS the game's lifecycle.
//
// Voice rules made visual: Kimi speaks as plain text on the canvas (a director
// talking, not a bot in a box); the user's wishes sit in soft pill bubbles on
// the right. The brief renders inline as Kimi's pitch card.

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing, type as t } from '../../theme/tokens';
import { BriefCard } from './BriefCard';
import type { WishMessage, StudioPhase } from './wishTypes';

interface Props {
  messages: WishMessage[];
  phase: StudioPhase;
  input: string;
  onChangeInput: (v: string) => void;
  onSend: () => void;
  onCreate: () => void;
  /** Retry the failed planning turn (creation unavailable). */
  onRetry: () => void;
  /** Show the "just say so" teach line under the first brief only. */
  isFirstGame: boolean;
  kimiThinking: boolean;
}

export const WishConversation = ({
  messages,
  phase,
  input,
  onChangeInput,
  onSend,
  onCreate,
  onRetry,
  isFirstGame,
  kimiThinking,
}: Props) => {
  const listRef = useRef<FlatList<WishMessage>>(null);

  // Only the NEWEST pitch is buildable. Older ones are superseded history —
  // leaving their Create button live would build a game from an idea the user
  // has already revised away from.
  const latestBriefId = [...messages].reverse().find((m) => m.brief)?.id ?? null;

  useEffect(() => {
    // Keep the newest turn in view as the conversation grows.
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages.length, kimiThinking]);

  const renderMessage = ({ item }: { item: WishMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.kimiRow}>
        {item.text ? <Text style={styles.kimiText}>{item.text}</Text> : null}
        {item.brief && item.id === latestBriefId && (
          <BriefCard
            brief={item.brief}
            onCreate={onCreate}
            creating={phase === 'building'}
            showTeachLine={isFirstGame && phase === 'planning'}
          />
        )}
        {item.brief && item.id !== latestBriefId && (
          <Text style={styles.superseded}>{item.brief.name} — revised</Text>
        )}
        {item.canRetry && (
          <Pressable onPress={onRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        // Swipe the conversation down to dismiss the keyboard; keep taps (like
        // the Create button) working even while the keyboard is open.
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          kimiThinking ? <Text style={styles.thinking}>…</Text> : null
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={onChangeInput}
          placeholder="Tap to wish…"
          placeholderTextColor={palette.textGhost}
          multiline
          onSubmitEditing={onSend}
        />
        <Pressable
          onPress={onSend}
          disabled={!input.trim()}
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
        >
          <Ionicons name="arrow-up" size={20} color={palette.text} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  kimiRow: { alignSelf: 'stretch' },
  kimiText: {
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.regular,
    lineHeight: 26,
  },
  userRow: { alignItems: 'flex-end' },
  userBubble: {
    backgroundColor: palette.glassWhite,
    borderRadius: radii.xxl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    maxWidth: '85%',
  },
  userText: {
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.regular,
    lineHeight: 24,
  },
  thinking: {
    color: palette.textDim,
    fontSize: t.size.h3,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  superseded: {
    color: palette.textGhost,
    fontSize: t.size.small,
    fontFamily: t.family.regular,
    marginTop: spacing.sm,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.lineStrong,
  },
  retryText: {
    color: palette.text,
    fontSize: t.size.body,
    fontFamily: t.family.semibold,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: palette.ink800,
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.regular,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { backgroundColor: palette.ink500 },
});
