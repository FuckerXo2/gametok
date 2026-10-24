import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { genexColors, genexRadii, genexSpacing } from './genexTheme';

export interface ChatEntry {
  id: string;
  kind: 'user' | 'assistant' | 'work' | 'build' | 'plan';
  text?: string;
  steps?: string[];
  duration?: string;
  buildStatus?: 'ready' | 'running';
  partsAdded?: number;
  planText?: string;
  timestamp: number;
}

interface GenexTranscriptProps {
  entries: ChatEntry[];
  onRewind?: (entryId: string) => void;
  onPlayBuild?: () => void;
  onApprovePlan?: (entryId: string) => void;
  onRevisePlan?: (entryId: string) => void;
}

export const GenexTranscript: React.FC<GenexTranscriptProps> = ({
  entries,
  onRewind,
  onPlayBuild,
  onApprovePlan,
  onRevisePlan,
}) => {
  const [expandedWorkMap, setExpandedWorkMap] = useState<Record<string, boolean>>({});

  const toggleWorkExpanded = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWorkMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <ScrollView
      style={styles.transcriptScroll}
      contentContainerStyle={styles.transcriptContent}
      showsVerticalScrollIndicator={false}
    >
      {entries.map((entry) => {
        // 1. User Message with Rewind Button
        if (entry.kind === 'user') {
          return (
            <View key={entry.id} style={styles.userBubbleContainer}>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{entry.text}</Text>
              </View>
              {onRewind && (
                <TouchableOpacity
                  style={styles.rewindBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onRewind(entry.id);
                  }}
                >
                  <Ionicons name="arrow-undo-outline" size={12} color={genexColors.dimForeground} />
                  <Text style={styles.rewindBtnText}>Rewind</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }

        // 2. Genex WorkLog (Progressive Disclosure)
        if (entry.kind === 'work') {
          const isExpanded = !!expandedWorkMap[entry.id];
          const stepCount = entry.steps?.length || 1;
          return (
            <View key={entry.id} style={styles.workContainer}>
              <TouchableOpacity
                style={styles.workDisclosureHeader}
                onPress={() => toggleWorkExpanded(entry.id)}
              >
                <Ionicons
                  name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={genexColors.mutedForeground}
                />
                <Text style={styles.workDisclosureTitle}>
                  Worked on {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                </Text>
                {entry.duration && <Text style={styles.workDuration}>{entry.duration}</Text>}
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.expandedStepsFrame}>
                  {entry.steps?.map((step, idx) => (
                    <View key={idx} style={styles.stepRow}>
                      <Ionicons name="checkmark-circle" size={13} color={genexColors.success} />
                      <Text style={styles.stepRowText} numberOfLines={2}>
                        {step}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }

        // 3. Genex Build Card (Capture + Play CTA)
        if (entry.kind === 'build') {
          return (
            <View key={entry.id} style={styles.buildCard}>
              <View style={styles.buildCardLeft}>
                <View style={styles.buildStatusOrb} />
                <View>
                  <Text style={styles.buildCardTitle}>
                    {entry.buildStatus === 'ready' ? 'Build Ready' : 'Building game…'}
                  </Text>
                  <Text style={styles.buildCardSubtitle}>
                    {entry.partsAdded ? `${entry.partsAdded} parts added · Three.js active` : 'Compiling physics & touch controls'}
                  </Text>
                </View>
              </View>

              {entry.buildStatus === 'ready' && onPlayBuild && (
                <TouchableOpacity style={styles.playBuildButton} onPress={onPlayBuild}>
                  <Ionicons name="play" size={14} color="#ffffff" />
                  <Text style={styles.playBuildText}>Play</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }

        // 4. Genex Plan Question
        if (entry.kind === 'plan') {
          return (
            <View key={entry.id} style={styles.planCard}>
              <View style={styles.planHeader}>
                <Ionicons name="bulb-outline" size={16} color={genexColors.warning} />
                <Text style={styles.planTitle}>Proposed Game Plan</Text>
              </View>
              <Text style={styles.planBody}>{entry.planText || entry.text}</Text>
              <View style={styles.planActions}>
                <TouchableOpacity
                  style={[styles.planBtn, styles.planBtnApprove]}
                  onPress={() => onApprovePlan && onApprovePlan(entry.id)}
                >
                  <Text style={styles.planBtnApproveText}>Approve plan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.planBtn, styles.planBtnRevise]}
                  onPress={() => onRevisePlan && onRevisePlan(entry.id)}
                >
                  <Text style={styles.planBtnReviseText}>Make changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        // 5. Assistant Reply (Prose)
        return (
          <View key={entry.id} style={styles.assistantContainer}>
            <Text style={styles.assistantText}>{entry.text}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    paddingHorizontal: genexSpacing.md,
    paddingVertical: genexSpacing.sm,
    gap: 12,
  },
  userBubbleContainer: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    alignItems: 'flex-end',
    gap: 4,
  },
  userBubble: {
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.card,
    borderWidth: 1,
    borderColor: genexColors.borderStrong,
    paddingHorizontal: genexSpacing.md,
    paddingVertical: 10,
  },
  userBubbleText: {
    color: genexColors.foreground,
    fontSize: 15,
    lineHeight: 22,
  },
  rewindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rewindBtnText: {
    color: genexColors.dimForeground,
    fontSize: 11,
  },
  workContainer: {
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.md,
    borderWidth: 1,
    borderColor: genexColors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  workDisclosureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workDisclosureTitle: {
    color: genexColors.mutedForeground,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  workDuration: {
    color: genexColors.dimForeground,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  expandedStepsFrame: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: genexColors.border,
    gap: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepRowText: {
    color: genexColors.foreground,
    fontSize: 12,
    flex: 1,
  },
  buildCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.card,
    borderWidth: 1,
    borderColor: genexColors.borderStrong,
    padding: genexSpacing.md,
  },
  buildCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buildStatusOrb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: genexColors.success,
  },
  buildCardTitle: {
    color: genexColors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  buildCardSubtitle: {
    color: genexColors.dimForeground,
    fontSize: 12,
  },
  playBuildButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.accentFill,
  },
  playBuildText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  planCard: {
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.card,
    borderWidth: 1,
    borderColor: genexColors.warning,
    padding: genexSpacing.md,
    gap: 8,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planTitle: {
    color: genexColors.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  planBody: {
    color: genexColors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  planBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: genexRadii.button,
  },
  planBtnApprove: {
    backgroundColor: genexColors.accentFill,
  },
  planBtnApproveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  planBtnRevise: {
    backgroundColor: genexColors.controlQuiet,
  },
  planBtnReviseText: {
    color: genexColors.foreground,
    fontSize: 12,
  },
  assistantContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
  },
  assistantText: {
    color: genexColors.foreground,
    fontSize: 15,
    lineHeight: 22,
  },
});
