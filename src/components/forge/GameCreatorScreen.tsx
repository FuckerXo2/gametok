import React from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
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
import { PreviewPane } from '../wish/PreviewPane';
import { DEFAULT_ORIENTATION, type Orientation } from '../../constants/orientation';
import { palette, radii, spacing, type as t } from '../../theme/tokens';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PREVIEW_HEIGHT = Math.min(520, Math.max(360, Math.round(SCREEN_HEIGHT * 0.52)));
const FORGE_MASCOT = require('../../../assets/forge/forge_mascot.png');

interface Props {
  gameName: string;
  html: string | null;
  gameUrl: string | null;
  orientation?: Orientation;
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
  attachedAssets?: any[];
  onRemoveAsset?: (id: string) => void;
}

export const GameCreatorScreen: React.FC<Props> = ({
  gameName,
  html,
  gameUrl,
  orientation = DEFAULT_ORIENTATION,
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
  attachedAssets = [],
  onRemoveAsset,
}) => {
  const mascotMessage = isEditing
    ? 'Making that happen...'
    : input.trim()
      ? "I'm listening..."
      : 'What should we change?';

  return (
    <LinearGradient colors={['#00050D', '#010814', '#00040A']} style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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

          <View style={styles.previewFrame}>
            <PreviewPane
              state={html || gameUrl ? 'ready' : 'empty'}
              gameName={gameName}
              beats={[]}
              html={html}
              gameUrl={gameUrl}
              orientation={orientation}
              containerStyle={styles.preview}
            />
          </View>

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

            <View style={styles.promptBar}>
              <Ionicons name="mic-outline" size={20} color={palette.textMuted} />
              <TextInput
                value={input}
                onChangeText={onChangeInput}
                onSubmitEditing={onSend}
                placeholder="Ask GameTok..."
                placeholderTextColor={palette.textDim}
                returnKeyType="send"
                style={styles.promptInput}
              />
              <Pressable
                onPress={onSend}
                style={({ pressed }) => [styles.promptAction, pressed && styles.pressed]}
              >
                <View style={styles.waveform}>
                  {[10, 18, 27, 19, 12].map((height, index) => (
                    <View key={index} style={[styles.waveformBar, { height }]} />
                  ))}
                </View>
              </Pressable>
            </View>

            <View style={styles.bottomActions}>
              <CreatorButton icon="add" label="Add" onPress={onAdd} />
              <CreatorButton icon="cube-outline" label="Game" onPress={onGameSettings} />
              <CreatorButton icon="play" label="Play" onPress={onPlay} />
            </View>
          </View>

          <View style={styles.mascotRow}>
            <Image source={FORGE_MASCOT} style={styles.mascot} resizeMode="contain" />
            <View style={styles.mascotBubble}>
              <View style={styles.mascotBubbleTail} />
              <Text style={styles.mascotMessage}>{mascotMessage}</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  promptAction: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  waveformBar: {
    width: 3,
    borderRadius: 3,
    backgroundColor: palette.purpleSoft,
    shadowColor: palette.purple,
    shadowOpacity: 0.65,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
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
});
