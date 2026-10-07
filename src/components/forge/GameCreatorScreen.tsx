import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreviewPane } from '../wish/PreviewPane';
import { DEFAULT_ORIENTATION, type Orientation } from '../../constants/orientation';
import { palette, radii, spacing, type as t } from '../../theme/tokens';
import type { WishMessage } from '../wish/wishTypes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PREVIEW_HEIGHT = Math.min(520, Math.max(360, Math.round(SCREEN_HEIGHT * 0.52)));
const FORGE_MASCOT = require('../../../assets/forge/forge_mascot.png');

interface Props {
  gameName: string;
  html: string | null;
  gameUrl: string | null;
  orientation?: Orientation;
  runtime?: 'web' | 'native';
  gameScript?: string | null;
  input: string;
  onChangeInput: (value: string) => void;
  onSend: () => void;
  onBack: () => void;
  onPlay: () => void;
  onAdd: () => void;
  onGameSettings: () => void;
  onUndo: () => void;
  onMore: () => void;
  isEditing?: boolean;
  messages?: WishMessage[];
  attachedAssets?: any[];
  onRemoveAsset?: (id: string) => void;
}

export const GameCreatorScreen: React.FC<Props> = ({
  gameName,
  html,
  gameUrl,
  orientation = DEFAULT_ORIENTATION,
  runtime = 'web',
  gameScript = null,
  input,
  onChangeInput,
  onSend,
  onBack,
  onPlay,
  onAdd,
  onGameSettings,
  onUndo,
  onMore,
  isEditing = false,
  messages = [],
  attachedAssets = [],
  onRemoveAsset,
}) => {
  const insets = useSafeAreaInsets();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatListRef = useRef<FlatList<WishMessage>>(null);

  // Auto-scroll chat to bottom when new messages arrive or editing starts
  useEffect(() => {
    if (isChatOpen) {
      const timer = setTimeout(() => {
        chatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isEditing, isChatOpen]);

  // Main input send: automatically opens the chat session to show conversation & progress
  const handleMainSend = () => {
    if (!input.trim() && attachedAssets.length === 0) return;
    setIsChatOpen(true);
    onSend();
  };

  const handleChatSend = () => {
    if (!input.trim() && attachedAssets.length === 0) return;
    onSend();
  };

  const mascotMessage = isEditing
    ? 'Making that happen...'
    : input.trim()
      ? "I'm listening..."
      : messages.length > 0
        ? "Tap here to view chat, or ask anything to change your game!"
        : "Describe any changes you'd like to make, or tap Play to test!";

  const renderMessageItem = ({ item }: { item: WishMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.chatRow, isUser ? styles.chatRowUser : styles.chatRowKimi]}>
        {!isUser && (
          <View style={styles.chatAvatar}>
            <Image source={FORGE_MASCOT} style={styles.chatAvatarImg} resizeMode="contain" />
          </View>
        )}
        <View style={[styles.chatBubble, isUser ? styles.chatBubbleUser : styles.chatBubbleKimi]}>
          <Text style={[styles.chatBubbleText, isUser ? styles.chatTextUser : styles.chatTextKimi]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#00050D', '#010814', '#00040A']} style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header - Pure original design */}
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={22} color={palette.text} />
            </Pressable>

            <Text style={styles.title} numberOfLines={1}>
              {gameName || 'Your game'}
            </Text>

            <View style={styles.headerActions}>
              {messages.length > 0 && (
                <Pressable
                  onPress={() => setIsChatOpen(true)}
                  style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
                  hitSlop={8}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#00F0FF" />
                </Pressable>
              )}
              <Pressable
                onPress={onUndo}
                style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Ionicons name="arrow-undo-outline" size={20} color={palette.text} />
              </Pressable>
              <Pressable
                onPress={onMore}
                style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-horizontal" size={21} color={palette.text} />
              </Pressable>
            </View>
          </View>

          {/* Full Game Preview Frame */}
          <View style={styles.previewFrame}>
            <PreviewPane
              state={html || gameUrl || gameScript ? 'ready' : 'empty'}
              gameName={gameName}
              beats={[]}
              html={html}
              gameUrl={gameUrl}
              orientation={orientation}
              runtime={runtime}
              gameScript={gameScript}
              containerStyle={styles.preview}
            />
            {isEditing && (
              <View style={styles.editingBadge}>
                <ActivityIndicator size="small" color="#00F0FF" style={{ marginRight: 8 }} />
                <Text style={styles.editingBadgeText}>Applying changes...</Text>
              </View>
            )}
          </View>

          {/* Controls Area */}
          <View style={styles.creatorControls}>
            {attachedAssets.length > 0 && (
              <View style={styles.attachedRow}>
                {attachedAssets.map((asset) => (
                  <View key={asset.id} style={styles.attachedChip}>
                    <Image source={asset.source} style={styles.attachedThumb} resizeMode="contain" />
                    <Text style={styles.attachedName} numberOfLines={1}>
                      {asset.name}
                    </Text>
                    {onRemoveAsset && (
                      <Pressable onPress={() => onRemoveAsset(asset.id)} hitSlop={6}>
                        <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.6)" />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Prompt Bar - Typing prompt & sending opens chat session */}
            <View style={styles.promptBar}>
              <Ionicons name="mic-outline" size={20} color={palette.textMuted} />
              <TextInput
                value={input}
                onChangeText={onChangeInput}
                onSubmitEditing={handleMainSend}
                placeholder="Ask GameTok..."
                placeholderTextColor={palette.textDim}
                returnKeyType="send"
                style={styles.promptInput}
              />
              <Pressable
                onPress={handleMainSend}
                disabled={!input.trim() && attachedAssets.length === 0}
                style={({ pressed }) => [
                  styles.sendButton,
                  (input.trim() || attachedAssets.length > 0)
                    ? styles.sendButtonActive
                    : styles.sendButtonDisabled,
                  pressed && styles.pressed,
                ]}
                hitSlop={8}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={(input.trim() || attachedAssets.length > 0) ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)'}
                />
              </Pressable>
            </View>

            {/* Action Buttons: Add, Game, Play */}
            <View style={styles.bottomActions}>
              <CreatorButton icon="add" label="Add" onPress={onAdd} />
              <CreatorButton icon="cube-outline" label="Game" onPress={onGameSettings} />
              <CreatorButton icon="play" label="Play" onPress={onPlay} />
            </View>
          </View>

          {/* Mascot Row - Tapping also opens chat */}
          <Pressable
            style={styles.mascotRow}
            onPress={() => setIsChatOpen(true)}
            hitSlop={6}
          >
            <Image source={FORGE_MASCOT} style={styles.mascot} resizeMode="contain" />
            <View style={styles.mascotBubble}>
              <View style={styles.mascotBubbleTail} />
              <Text style={styles.mascotMessage}>{mascotMessage}</Text>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Chat Session Modal - Opens when message is sent or opened by user */}
      <Modal
        visible={isChatOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsChatOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setIsChatOpen(false)}
          />
          <KeyboardAvoidingView
            style={styles.chatSheet}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <Image source={FORGE_MASCOT} style={styles.sheetHeaderAvatar} resizeMode="contain" />
                <View>
                  <Text style={styles.sheetHeaderTitle}>GameTok AI</Text>
                  <Text style={styles.sheetHeaderSubtitle}>
                    {isEditing ? 'Applying surgical updates...' : (gameName || 'Game Editor')}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => setIsChatOpen(false)}
                style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
                hitSlop={8}
              >
                <Ionicons name="chevron-down" size={20} color="#00F0FF" />
                <Text style={styles.sheetCloseText}>Game</Text>
              </Pressable>
            </View>

            {/* Chat Messages Stream */}
            <FlatList
              ref={chatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.modalChatContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.modalEmptyChat}>
                  <Text style={styles.modalEmptyText}>
                    Ask any change in the box below to modify your game!
                  </Text>
                </View>
              }
              ListFooterComponent={
                isEditing ? (
                  <View style={[styles.chatRow, styles.chatRowKimi]}>
                    <View style={styles.chatAvatar}>
                      <Image source={FORGE_MASCOT} style={styles.chatAvatarImg} resizeMode="contain" />
                    </View>
                    <View style={[styles.chatBubble, styles.chatBubbleKimi, styles.chatBubbleEditing]}>
                      <ActivityIndicator size="small" color="#00F0FF" style={{ marginRight: 8 }} />
                      <Text style={styles.chatEditingText}>GameTok is applying code diff...</Text>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* Chat Input Bar */}
            <View style={[styles.modalInputBarWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              {attachedAssets.length > 0 && (
                <View style={styles.attachedRow}>
                  {attachedAssets.map((asset) => (
                    <View key={asset.id} style={styles.attachedChip}>
                      <Image source={asset.source} style={styles.attachedThumb} resizeMode="contain" />
                      <Text style={styles.attachedName} numberOfLines={1}>
                        {asset.name}
                      </Text>
                      {onRemoveAsset && (
                        <Pressable onPress={() => onRemoveAsset(asset.id)} hitSlop={6}>
                          <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.6)" />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.modalInputBar}>
                <TextInput
                  value={input}
                  onChangeText={onChangeInput}
                  onSubmitEditing={handleChatSend}
                  placeholder="Ask GameTok to change anything..."
                  placeholderTextColor={palette.textDim}
                  returnKeyType="send"
                  style={styles.modalTextInput}
                />
                <Pressable
                  onPress={handleChatSend}
                  disabled={!input.trim() || isEditing}
                  style={({ pressed }) => [
                    styles.modalSendBtn,
                    input.trim() && !isEditing ? styles.modalSendBtnActive : styles.modalSendBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  hitSlop={8}
                >
                  {isEditing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons
                      name="arrow-up"
                      size={18}
                      color={input.trim() ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)'}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const CreatorButton = ({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.creatorButton, pressed && styles.creatorButtonPressed]}
  >
    <Ionicons name={icon} size={23} color={palette.text} />
    <Text style={styles.creatorButtonText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardArea: { flex: 1 },
  header: {
    height: 58,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassWhite,
    borderWidth: 1,
    borderColor: palette.lineStrong,
  },
  title: {
    flex: 1,
    marginHorizontal: spacing.md,
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.bold,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.62, transform: [{ scale: 0.97 }] },
  previewFrame: {
    height: PREVIEW_HEIGHT,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.ink900,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.32)',
  },
  preview: {
    flex: 1,
    margin: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
  editingBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 18, 36, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.45)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  editingBadgeText: {
    color: '#E0F7FF',
    fontSize: 13,
    fontFamily: t.family.semibold,
  },
  creatorControls: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  attachedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  attachedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(147, 51, 234, 0.22)',
    borderWidth: 1,
    borderColor: '#A855F7',
    gap: 6,
    maxWidth: 160,
  },
  attachedThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  attachedName: {
    color: '#F3E8FF',
    fontSize: 12.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  promptBar: {
    minHeight: 66,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(12, 19, 34, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.22)',
  },
  promptInput: {
    flex: 1,
    minHeight: 62,
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.medium,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  creatorButton: {
    flex: 1,
    height: 62,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(12, 19, 34, 0.96)',
    borderWidth: 1,
    borderColor: palette.lineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  creatorButtonPressed: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderColor: palette.purple,
    transform: [{ scale: 0.98 }],
  },
  creatorButtonText: {
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.semibold,
  },
  mascotRow: {
    flex: 1,
    minHeight: 112,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mascot: {
    width: 92,
    height: 104,
  },
  mascotBubble: {
    flex: 1,
    marginLeft: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.2,
    borderColor: 'rgba(103, 232, 249, 0.28)',
    backgroundColor: 'rgba(14, 21, 38, 0.94)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  mascotBubbleTail: {
    position: 'absolute',
    left: -9,
    top: 24,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderTopColor: 'transparent',
    borderBottomWidth: 7,
    borderBottomColor: 'transparent',
    borderRightWidth: 10,
    borderRightColor: 'rgba(14, 21, 38, 0.94)',
  },
  mascotMessage: {
    color: palette.text,
    fontSize: t.size.bodyLg,
    lineHeight: 24,
    fontFamily: t.family.bold,
  },

  // Modal Chat Session Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 4, 12, 0.72)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    height: 80,
  },
  chatSheet: {
    flex: 1,
    backgroundColor: '#060B18',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 10,
  },
  sheetHeader: {
    height: 56,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetHeaderAvatar: {
    width: 32,
    height: 32,
  },
  sheetHeaderTitle: {
    color: palette.text,
    fontSize: 15,
    fontFamily: t.family.bold,
  },
  sheetHeaderSubtitle: {
    color: 'rgba(0, 240, 255, 0.8)',
    fontSize: 12,
    fontFamily: t.family.medium,
  },
  sheetCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.35)',
  },
  sheetCloseText: {
    color: '#00F0FF',
    fontSize: 13,
    fontFamily: t.family.semibold,
  },
  modalChatContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 12,
  },
  modalEmptyChat: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    maxWidth: '100%',
  },
  chatRowUser: {
    justifyContent: 'flex-end',
  },
  chatRowKimi: {
    justifyContent: 'flex-start',
  },
  chatAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 20, 38, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    overflow: 'hidden',
  },
  chatAvatarImg: {
    width: 22,
    height: 22,
  },
  chatBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '82%',
  },
  chatBubbleUser: {
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.5)',
    borderBottomRightRadius: 4,
  },
  chatBubbleKimi: {
    backgroundColor: 'rgba(18, 26, 44, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderBottomLeftRadius: 4,
  },
  chatBubbleEditing: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatTextUser: {
    color: '#F0F9FF',
    fontFamily: t.family.medium,
  },
  chatTextKimi: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontFamily: t.family.regular,
  },
  chatEditingText: {
    color: '#00F0FF',
    fontSize: 13,
    fontFamily: t.family.semibold,
  },
  modalInputBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(6, 11, 24, 0.98)',
  },
  modalInputBar: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(14, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.25)',
  },
  modalTextInput: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
    fontFamily: t.family.medium,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  modalSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSendBtnActive: {
    backgroundColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  modalSendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
