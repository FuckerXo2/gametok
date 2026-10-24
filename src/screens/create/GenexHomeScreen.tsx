import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { genexColors, genexRadii, genexSpacing } from './genexTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PROMPT_IDEAS = [
  'A neon Tokyo drift racer with responsive touch steering, smoke particle trails, and synthwave music.',
  'An action runner dodging Danfo buses and okadas in high-energy Lagos with afrobeat rhythm.',
  'A stylized 3D anime sword battle where the hero slashes attacking mechs and deflects lasers.',
  'A low-poly voxel island survival game where you mine glowing power cubes and build bridges.',
  'Street 5s cage soccer with fast passing, curved power shots, and graffiti-covered walls.',
  'A retro-futuristic zero-gravity space shooter slingshotting around planetary gravity wells.',
];

interface GenexHomeScreenProps {
  onStartGame: (prompt: string, mode: 'auto' | 'loop' | 'plan', model: string) => void;
  recentProjects?: Array<{ id: string; title: string; version: number }>;
  onResumeProject?: (id: string) => void;
  onClose?: () => void;
}

export const GenexHomeScreen: React.FC<GenexHomeScreenProps> = ({
  onStartGame,
  recentProjects = [],
  onResumeProject,
  onClose,
}) => {
  const [promptText, setPromptText] = useState('');
  const [mode, setMode] = useState<'auto' | 'loop' | 'plan'>('auto');
  const [model, setModel] = useState('Claude 3.7 Sonnet');
  const [showModelPicker, setShowModelPicker] = useState(false);

  const handleSuggestPrompt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const randomIndex = Math.floor(Math.random() * PROMPT_IDEAS.length);
    setPromptText(PROMPT_IDEAS[randomIndex]);
  };

  const handleSend = () => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartGame(trimmed, mode, model);
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={genexColors.foreground} />
          </TouchableOpacity>
        )}
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>GENEX STUDIO</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Genex Hero Headline */}
        <View style={styles.heroBlock}>
          <Text style={styles.heroHeadline}>Everything you need to ship a game</Text>
          <Text style={styles.heroSubheadline}>
            Describe your idea. Autonomous agents plan, generate 3D assets, write Three.js code, and test in real time.
          </Text>
        </View>

        {/* Central Genex Composer */}
        <View style={styles.composerCard}>
          <TextInput
            style={styles.composerInput}
            placeholder="Describe the game you want to build..."
            placeholderTextColor={genexColors.dimForeground}
            multiline
            numberOfLines={4}
            value={promptText}
            onChangeText={setPromptText}
            textAlignVertical="top"
          />

          {/* Prompt Controls Bar */}
          <View style={styles.composerControls}>
            <View style={styles.leftPillsRow}>
              {/* Suggest prompt chip */}
              <TouchableOpacity style={styles.pillControl} onPress={handleSuggestPrompt}>
                <Ionicons name="sparkles" size={13} color={genexColors.accentHover} />
                <Text style={styles.pillText}>Suggest prompt</Text>
              </TouchableOpacity>

              {/* Mode Selector Pill (Auto / Loop / Plan) */}
              <TouchableOpacity
                style={[styles.pillControl, mode !== 'auto' && styles.pillControlActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMode((prev) => (prev === 'auto' ? 'loop' : prev === 'loop' ? 'plan' : 'auto'));
                }}
              >
                <Ionicons
                  name={mode === 'plan' ? 'bulb-outline' : mode === 'loop' ? 'sync' : 'flash-outline'}
                  size={13}
                  color={mode !== 'auto' ? genexColors.foreground : genexColors.mutedForeground}
                />
                <Text style={[styles.pillText, mode !== 'auto' && styles.pillTextActive]}>
                  {mode.toUpperCase()}
                </Text>
              </TouchableOpacity>

              {/* Model Pill */}
              <TouchableOpacity
                style={styles.pillControl}
                onPress={() => setShowModelPicker(!showModelPicker)}
              >
                <Ionicons name="hardware-chip-outline" size={13} color={genexColors.mutedForeground} />
                <Text style={styles.pillText}>{model.split(' ')[0]}</Text>
              </TouchableOpacity>
            </View>

            {/* Send Action Button */}
            <TouchableOpacity
              style={[styles.sendButton, !promptText.trim() && styles.sendButtonDisabled]}
              disabled={!promptText.trim()}
              onPress={handleSend}
            >
              <Ionicons name="arrow-up" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Model Picker Drawer */}
          {showModelPicker && (
            <View style={styles.modelPickerRow}>
              {['Claude 3.7 Sonnet', 'GPT-4o', 'Ollama Local'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modelOptionChip, model === m && styles.modelOptionChipActive]}
                  onPress={() => {
                    setModel(m);
                    setShowModelPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[styles.modelOptionText, model === m && styles.modelOptionTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Recent Studio Projects */}
        {recentProjects.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Recent Games</Text>
            {recentProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={styles.recentProjectRow}
                onPress={() => onResumeProject && onResumeProject(project.id)}
              >
                <View style={styles.projectIconBox}>
                  <Ionicons name="game-controller" size={16} color={genexColors.accentHover} />
                </View>
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {project.title}
                  </Text>
                  <Text style={styles.projectMeta}>Revision v{project.version}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={genexColors.dimForeground} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: genexColors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: genexSpacing.lg,
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: genexColors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: genexRadii.pill,
    backgroundColor: genexColors.controlQuiet,
    borderWidth: 1,
    borderColor: genexColors.controlQuietEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    alignItems: 'center',
  },
  brandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: genexRadii.pill,
    backgroundColor: genexColors.card,
    borderWidth: 1,
    borderColor: genexColors.borderStrong,
  },
  brandBadgeText: {
    color: genexColors.foreground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: genexSpacing.lg,
    paddingTop: genexSpacing.xxl,
  },
  heroBlock: {
    marginBottom: genexSpacing.xl,
    gap: 8,
  },
  heroHeadline: {
    color: genexColors.foreground,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubheadline: {
    color: genexColors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
  },
  composerCard: {
    backgroundColor: genexColors.composer,
    borderRadius: genexRadii.card,
    borderWidth: 1,
    borderColor: genexColors.borderStrong,
    padding: genexSpacing.md,
    gap: 12,
  },
  composerInput: {
    color: genexColors.foreground,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 90,
  },
  composerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: genexColors.border,
    paddingTop: genexSpacing.sm,
  },
  leftPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pillControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.controlQuiet,
    borderWidth: 1,
    borderColor: genexColors.controlQuietEdge,
  },
  pillControlActive: {
    backgroundColor: genexColors.accentTint,
    borderColor: genexColors.accent,
  },
  pillText: {
    color: genexColors.mutedForeground,
    fontSize: 12,
    fontWeight: '500',
  },
  pillTextActive: {
    color: genexColors.foreground,
    fontWeight: '600',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: genexRadii.pill,
    backgroundColor: genexColors.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.35,
    backgroundColor: genexColors.controlQuiet,
  },
  modelPickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: genexColors.border,
  },
  modelOptionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.card,
    borderWidth: 1,
    borderColor: genexColors.border,
  },
  modelOptionChipActive: {
    borderColor: genexColors.accent,
    backgroundColor: genexColors.accentTint,
  },
  modelOptionText: {
    color: genexColors.mutedForeground,
    fontSize: 12,
  },
  modelOptionTextActive: {
    color: genexColors.foreground,
    fontWeight: '600',
  },
  recentSection: {
    marginTop: genexSpacing.xxxl,
    gap: 10,
  },
  recentTitle: {
    color: genexColors.mutedForeground,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recentProjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.md,
    padding: genexSpacing.md,
    borderWidth: 1,
    borderColor: genexColors.border,
  },
  projectIconBox: {
    width: 32,
    height: 32,
    borderRadius: genexRadii.sm,
    backgroundColor: genexColors.controlQuiet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    color: genexColors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  projectMeta: {
    color: genexColors.dimForeground,
    fontSize: 12,
  },
});
