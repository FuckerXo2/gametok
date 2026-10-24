import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { genexColors, genexRadii, genexSpacing } from './genexTheme';

const QUICK_TWEAKS = [
  '⚡ Boost speed by 30%',
  '💥 Add explosion physics',
  '🪙 Add glowing coins',
  '🌙 Switch to night mode',
  '👾 Add tougher boss',
  '🔊 Add punchy sound FX',
];

interface GenexPromptBarProps {
  onSend: (text: string, mode: 'auto' | 'loop' | 'plan') => void;
  onStop?: () => void;
  isWorking: boolean;
  statusText?: string;
  elapsedSeconds?: number;
}

export const GenexPromptBar: React.FC<GenexPromptBarProps> = ({
  onSend,
  onStop,
  isWorking,
  statusText,
  elapsedSeconds = 0,
}) => {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'auto' | 'loop' | 'plan'>('auto');

  const handleSend = (overrideText?: string) => {
    const raw = (overrideText || text).trim();
    if (!raw || isWorking) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText('');
    onSend(raw, mode);
  };

  const handleStop = () => {
    if (!isWorking || !onStop) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStop();
  };

  return (
    <View style={styles.container}>
      {/* 1. Status Orb Line (if working) */}
      {isWorking && (
        <View style={styles.statusLine}>
          <View style={styles.statusOrb} />
          <Text style={styles.statusText} numberOfLines={1}>
            {statusText || 'Working…'}
          </Text>
          {elapsedSeconds > 0 && (
            <Text style={styles.statusTime}>{elapsedSeconds}s</Text>
          )}
        </View>
      )}

      {/* 2. Quick Tweak Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tweaksScroll}
        contentContainerStyle={styles.tweaksContent}
      >
        {QUICK_TWEAKS.map((tweak, i) => (
          <TouchableOpacity
            key={i}
            style={styles.tweakChip}
            disabled={isWorking}
            onPress={() => handleSend(tweak)}
          >
            <Text style={styles.tweakChipText}>{tweak}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 3. Main Prompt Input Bar */}
      <View style={styles.composerBox}>
        <TextInput
          style={styles.input}
          placeholder={isWorking ? 'Wait for agent or tap Stop…' : 'Describe a change or next feature…'}
          placeholderTextColor={genexColors.dimForeground}
          value={text}
          onChangeText={setText}
          editable={!isWorking}
          onSubmitEditing={() => handleSend()}
        />

        {/* Action Button: Send or Stop */}
        {isWorking ? (
          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <Ionicons name="stop" size={14} color="#ffffff" />
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
            disabled={!text.trim()}
            onPress={() => handleSend()}
          >
            <Ionicons name="arrow-up" size={18} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      {/* 4. Bottom Mode Control Strip */}
      <View style={styles.modeStrip}>
        <View style={styles.modePills}>
          <TouchableOpacity
            style={[styles.modePill, mode === 'auto' && styles.modePillActive]}
            onPress={() => setMode('auto')}
          >
            <Text style={[styles.modePillText, mode === 'auto' && styles.modePillTextActive]}>
              Auto
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modePill, mode === 'loop' && styles.modePillActive]}
            onPress={() => setMode('loop')}
          >
            <Text style={[styles.modePillText, mode === 'loop' && styles.modePillTextActive]}>
              Loop
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modePill, mode === 'plan' && styles.modePillActive]}
            onPress={() => setMode('plan')}
          >
            <Ionicons
              name="bulb-outline"
              size={12}
              color={mode === 'plan' ? genexColors.foreground : genexColors.mutedForeground}
            />
            <Text style={[styles.modePillText, mode === 'plan' && styles.modePillTextActive]}>
              Plan
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.modelTag}>Claude 3.7 Sonnet</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: genexColors.composer,
    borderTopWidth: 1,
    borderTopColor: genexColors.borderStrong,
    paddingHorizontal: genexSpacing.md,
    paddingTop: genexSpacing.sm,
    paddingBottom: Platform.OS === 'ios' ? genexSpacing.lg : genexSpacing.sm,
    gap: 8,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  statusOrb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: genexColors.warning,
  },
  statusText: {
    color: genexColors.mutedForeground,
    fontSize: 12,
    flex: 1,
  },
  statusTime: {
    color: genexColors.dimForeground,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  tweaksScroll: {
    maxHeight: 34,
  },
  tweaksContent: {
    gap: 6,
  },
  tweakChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.controlQuiet,
    borderWidth: 1,
    borderColor: genexColors.controlQuietEdge,
  },
  tweakChipText: {
    color: genexColors.mutedForeground,
    fontSize: 11,
    fontWeight: '500',
  },
  composerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: genexColors.popover,
    borderRadius: genexRadii.card,
    borderWidth: 1,
    borderColor: genexColors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    color: genexColors.foreground,
    fontSize: 14,
    minHeight: 36,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: genexRadii.pill,
    backgroundColor: genexColors.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.3,
    backgroundColor: genexColors.controlQuiet,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.destructive,
  },
  stopButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  modeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  modePills: {
    flexDirection: 'row',
    backgroundColor: genexColors.controlQuiet,
    borderRadius: genexRadii.button,
    padding: 2,
    borderWidth: 1,
    borderColor: genexColors.controlQuietEdge,
    gap: 2,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: genexRadii.sm,
  },
  modePillActive: {
    backgroundColor: genexColors.card,
  },
  modePillText: {
    color: genexColors.dimForeground,
    fontSize: 11,
    fontWeight: '500',
  },
  modePillTextActive: {
    color: genexColors.foreground,
    fontWeight: '700',
  },
  modelTag: {
    color: genexColors.dimForeground,
    fontSize: 11,
  },
});
