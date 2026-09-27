import React, { useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VisualDirection } from './VisualDirectionScreen';

export interface CameraPerspective {
  id: string;
  name: string;
  tagline: string;
  dimension: '2D' | '2.5D' | '3D';
  icon: keyof typeof Ionicons.glyphMap;
  cameraInstruction: string;
  modifier?: string;
  imageUrl?: string;
}

interface Props {
  gameTitle: string;
  prompt: string;
  selectedDirection: VisualDirection;
  perspectives: CameraPerspective[];
  isLoading?: boolean;
  selectedId: string | null;
  onSelect: (perspective: CameraPerspective) => void;
  onUsePerspective: (perspective: CameraPerspective) => void;
  onBack?: () => void;
  onClose?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 18;
const GRID_GAP = 12;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2);

export const PerspectiveSelectionScreen = ({
  gameTitle,
  prompt,
  selectedDirection,
  perspectives,
  isLoading = false,
  selectedId,
  onSelect,
  onUsePerspective,
  onBack,
  onClose,
}: Props) => {
  const insets = useSafeAreaInsets();
  const themeColors = selectedDirection?.colors || ['#1E1B4B', '#6366F1', '#38BDF8', '#F43F5E'];

  const chosen = perspectives.find((p) => p.id === selectedId) || perspectives[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.stepBadge}>STEP 2 OF 2</Text>
          <Text style={styles.title} numberOfLines={1}>
            Choose Camera Perspective
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      <Text style={styles.subtitle}>
        Selected style: <Text style={{ color: themeColors[2] || '#38BDF8', fontWeight: '700' }}>{selectedDirection.name}</Text>. How do you want to view and play your game?
      </Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={styles.loadingText}>Synthesizing playable perspectives...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {perspectives.map((perspective, index) => {
              const active = perspective.id === (selectedId || chosen?.id);
              const badgeBg =
                perspective.dimension === '3D'
                  ? 'rgba(168, 85, 247, 0.25)'
                  : perspective.dimension === '2.5D'
                  ? 'rgba(56, 189, 248, 0.25)'
                  : 'rgba(52, 211, 153, 0.25)';
              const badgeColor =
                perspective.dimension === '3D'
                  ? '#C084FC'
                  : perspective.dimension === '2.5D'
                  ? '#38BDF8'
                  : '#34D399';

              return (
                <Pressable
                  key={perspective.id || index}
                  onPress={() => onSelect(perspective)}
                  style={[
                    styles.card,
                    active && { borderColor: '#a855f7', borderWidth: 2 },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      active ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.04)',
                      'rgba(0,0,0,0.6)',
                    ]}
                    style={styles.cardGradient}
                  >
                    {/* Dimension Badge */}
                    <View style={styles.cardTopRow}>
                      <View style={[styles.dimensionBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.dimensionText, { color: badgeColor }]}>
                          {perspective.dimension}
                        </Text>
                      </View>
                      {active && (
                        <View style={styles.checkmarkWrap}>
                          <Ionicons name="checkmark-circle" size={18} color="#a855f7" />
                        </View>
                      )}
                    </View>

                    {/* Icon Box */}
                    <View style={styles.iconBox}>
                      <Ionicons
                        name={(perspective.icon as any) || 'videocam'}
                        size={32}
                        color={active ? '#C084FC' : '#FFF'}
                      />
                    </View>

                    {/* Meta */}
                    <View style={styles.metaWrap}>
                      <Text style={styles.perspectiveName} numberOfLines={1}>
                        {perspective.name}
                      </Text>
                      <Text style={styles.perspectiveTagline} numberOfLines={2}>
                        {perspective.tagline}
                      </Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Bottom Action Footer */}
      {!isLoading && chosen && (
        <View style={styles.footer}>
          <Pressable
            style={styles.actionButton}
            onPress={() => onUsePerspective(chosen)}
          >
            <LinearGradient
              colors={['#9333EA', '#7928CA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonText}>
                Forge Game in {chosen.name}
              </Text>
              <Ionicons name="flash" size={18} color="#FFF" style={{ marginLeft: 6 }} />
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  stepBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a855f7',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.05,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    backgroundColor: '#0F121C',
  },
  cardGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dimensionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dimensionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  checkmarkWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    alignSelf: 'center',
    marginVertical: 10,
  },
  metaWrap: {
    gap: 4,
  },
  perspectiveName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  perspectiveTagline: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 14,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
});
