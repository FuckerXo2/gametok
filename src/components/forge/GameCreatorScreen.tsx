import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PreviewPane } from '../wish/PreviewPane';
import { DEFAULT_ORIENTATION, type Orientation } from '../../constants/orientation';
import { palette, radii, spacing, type as t } from '../../theme/tokens';
import type { WishMessage } from '../wish/wishTypes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const FULL_PREVIEW_HEIGHT = Math.min(520, Math.max(360, Math.round(SCREEN_HEIGHT * 0.52)));
const SPLIT_PREVIEW_HEIGHT = Math.min(240, Math.max(180, Math.round(SCREEN_HEIGHT * 0.28)));
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
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(38);
  const [viewMode, setViewMode] = useState<'split' | 'game' | 'chat'>('split');
  const chatListRef = useRef<FlatList<WishMessage>>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      const kh = e.endCoordinates ? e.endCoordinates.height : 336;
      setKeyboardHeight(kh);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!input) {
      setInputHeight(38);
    }
  }, [input]);

  // Keep chat scrolled to newest message
  useEffect(() => {
    const timer = setTimeout(() => {
      chatListRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [messages.length, isEditing, viewMode]);

  const promptBarHeight = Math.max(52, inputHeight + 14);
  const controlsHeight = promptBarHeight + (attachedAssets.length > 0 ? 44 : 0) + 16;
  const activeKeyboardHeight = isKeyboardVisible ? (keyboardHeight || 336) : 0;

  // Determine preview height based on mode & keyboard state
  const computedPreviewHeight = (() => {
    if (viewMode === 'chat') return 0;
    if (viewMode === 'game') {
      return isKeyboardVisible
        ? Math.max(120, Math.floor(SCREEN_HEIGHT - insets.top - 56 - activeKeyboardHeight - controlsHeight))
        : FULL_PREVIEW_HEIGHT;
    }
    // 'split' mode
    return isKeyboardVisible ? 120 : SPLIT_PREVIEW_HEIGHT;
  })();

  const renderMessageItem = ({ item }: { item: WishMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.chatRow, isUser ? styles.chatRowUser : styles.chatRowKimi]}>
        {!isUser && (
          <View style={styles.kimiAvatar}>
            <Image source={FORGE_MASCOT} style={styles.kimiAvatarImg} resizeMode="contain" />
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
      <View style={[styles.contentContainer, { paddingTop: insets.top }]}>
        <View
          style={[
            styles.keyboardArea,
            isKeyboardVisible && { paddingBottom: activeKeyboardHeight },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                onBack();
              }}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={22} color={palette.text} />
            </Pressable>

            {/* Title & View Selector */}
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={1}>
                {gameName || 'Your game'}
              </Text>
              <View style={styles.modeTabs}>
                <Pressable
                  style={[styles.modeTab, viewMode === 'split' && styles.modeTabActive]}
                  onPress={() => setViewMode('split')}
                >
                  <Ionicons name="git-compare-outline" size={12} color={viewMode === 'split' ? '#00F0FF' : 'rgba(255,255,255,0.45)'} />
                  <Text style={[styles.modeTabText, viewMode === 'split' && styles.modeTabTextActive]}>Split</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeTab, viewMode === 'game' && styles.modeTabActive]}
                  onPress={() => setViewMode('game')}
                >
                  <Ionicons name="game-controller-outline" size={12} color={viewMode === 'game' ? '#00F0FF' : 'rgba(255,255,255,0.45)'} />
                  <Text style={[styles.modeTabText, viewMode === 'game' && styles.modeTabTextActive]}>Game</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeTab, viewMode === 'chat' && styles.modeTabActive]}
                  onPress={() => setViewMode('chat')}
                >
                  <Ionicons name="chatbubbles-outline" size={12} color={viewMode === 'chat' ? '#00F0FF' : 'rgba(255,255,255,0.45)'} />
                  <Text style={[styles.modeTabText, viewMode === 'chat' && styles.modeTabTextActive]}>Chat</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.headerActions}>
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

          {/* Game Preview Pane (hidden in full chat mode) */}
          {viewMode !== 'chat' && (
            <Pressable
              onPress={isKeyboardVisible ? Keyboard.dismiss : undefined}
              style={[
                styles.previewFrame,
                { height: computedPreviewHeight },
              ]}
            >
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
            </Pressable>
          )}

          {/* If preview is hidden in full chat mode, show compact pill to switch back */}
          {viewMode === 'chat' && (
            <Pressable style={styles.previewCollapsedBanner} onPress={() => setViewMode('split')}>
              <Ionicons name="eye-outline" size={16} color="#00F0FF" />
              <Text style={styles.previewCollapsedText}>Game Preview is live · Tap to view</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}

          {/* Continuous Chat Conversation Stream (visible in 'split' and 'chat' modes) */}
          {viewMode !== 'game' ? (
            <View style={styles.chatSection}>
              <FlatList
                ref={chatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessageItem}
                contentContainerStyle={styles.chatListContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyChatWrap}>
                    <Text style={styles.emptyChatText}>
                      Every wish changes the game. Type any modification below to continue.
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  isEditing ? (
                    <View style={[styles.chatRow, styles.chatRowKimi]}>
                      <View style={styles.kimiAvatar}>
                        <Image source={FORGE_MASCOT} style={styles.kimiAvatarImg} resizeMode="contain" />
                      </View>
                      <View style={[styles.chatBubble, styles.chatBubbleKimi, styles.chatBubbleEditing]}>
                        <ActivityIndicator size="small" color="#00F0FF" style={{ marginRight: 8 }} />
                        <Text style={styles.chatEditingText}>GameTok is applying code diff...</Text>
                      </View>
                    </View>
                  ) : null
                }
              />
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {/* Bottom Controls & Prompt Bar */}
          <View style={[styles.creatorControls, isKeyboardVisible && styles.creatorControlsKeyboard]}>
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

            <View style={styles.promptBar}>
              <View style={styles.promptLeading}>
                {isKeyboardVisible ? (
                  <Pressable
                    onPress={() => Keyboard.dismiss()}
                    hitSlop={8}
                    style={styles.leadingIconButton}
                  >
                    <Ionicons name="chevron-down" size={20} color={palette.textMuted} />
                  </Pressable>
                ) : (
                  <Ionicons name="mic-outline" size={20} color={palette.textMuted} />
                )}
              </View>
              <TextInput
                value={input}
                onChangeText={onChangeInput}
                placeholder="Ask GameTok to change anything..."
                placeholderTextColor={palette.textDim}
                multiline
                scrollEnabled
                style={[
                  styles.promptInput,
                  { height: Math.max(38, Math.min(100, inputHeight)) },
                ]}
                onContentSizeChange={(e) => {
                  const h = e.nativeEvent?.contentSize?.height;
                  if (h && h > 0) {
                    setInputHeight(h);
                  }
                }}
              />
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  onSend();
                }}
                disabled={!input.trim() || isEditing}
                style={({ pressed }) => [
                  styles.sendButton,
                  input.trim() && !isEditing ? styles.sendButtonActive : styles.sendButtonDisabled,
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

            {!isKeyboardVisible && (
              <View style={styles.bottomActions}>
                <CreatorButton icon="add" label="Add" onPress={onAdd} />
                <CreatorButton icon="cube-outline" label="Game" onPress={onGameSettings} />
                <CreatorButton icon="play" label="Play" onPress={onPlay} />
              </View>
            )}
          </View>
        </View>
      </View>
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
    <Ionicons name={icon} size={20} color={palette.text} />
    <Text style={styles.creatorButtonText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  contentContainer: { flex: 1 },
  keyboardArea: { flex: 1 },
  header: {
    height: 54,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.glassWhite,
    borderWidth: 1,
    borderColor: palette.lineStrong,
  },
  titleWrap: {
    flex: 1,
    marginHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  title: {
    color: palette.text,
    fontSize: 15,
    fontFamily: t.family.bold,
  },
  modeTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modeTabActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.16)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  modeTabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: t.family.semibold,
  },
  modeTabTextActive: {
    color: '#00F0FF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.62, transform: [{ scale: 0.97 }] },
  previewFrame: {
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
    backgroundColor: 'rgba(10, 18, 36, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.45)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  editingBadgeText: {
    color: '#E0F7FF',
    fontSize: 13,
    fontFamily: t.family.semibold,
  },
  previewCollapsedBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: 'rgba(10, 20, 38, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCollapsedText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontFamily: t.family.semibold,
    flex: 1,
    marginLeft: 8,
  },
  chatSection: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginTop: 6,
    marginBottom: 4,
  },
  chatListContent: {
    paddingVertical: 6,
    gap: 8,
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
  kimiAvatar: {
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
  kimiAvatarImg: {
    width: 22,
    height: 22,
  },
  chatBubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '82%',
  },
  chatBubbleUser: {
    backgroundColor: 'rgba(14, 165, 233, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.45)',
    borderBottomRightRadius: 4,
  },
  chatBubbleKimi: {
    backgroundColor: 'rgba(18, 26, 44, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomLeftRadius: 4,
  },
  chatBubbleEditing: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  chatBubbleText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  chatTextUser: {
    color: '#F0F9FF',
    fontFamily: t.family.medium,
  },
  chatTextKimi: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: t.family.regular,
  },
  chatEditingText: {
    color: '#00F0FF',
    fontSize: 12.5,
    fontFamily: t.family.semibold,
  },
  emptyChatWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyChatText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  creatorControls: {
    paddingHorizontal: spacing.md,
    paddingTop: 4,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  creatorControlsKeyboard: {
    paddingTop: 2,
    paddingBottom: 4,
    gap: 6,
  },
  attachedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
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
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(12, 19, 34, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.22)',
  },
  promptLeading: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadingIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptInput: {
    flex: 1,
    color: palette.text,
    fontSize: t.size.bodyLg,
    fontFamily: t.family.medium,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 4,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
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
    marginTop: 2,
  },
  creatorButton: {
    flex: 1,
    height: 50,
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
    fontSize: 14,
    fontFamily: t.family.semibold,
  },
});
