import React from 'react';
import {
  Dimensions,
  Image,
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
const ARTWORK_HEIGHT = CARD_WIDTH; // 1:1 square aspect ratio matching AI image generator
const CARD_HEIGHT = ARTWORK_HEIGHT + 64;

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
            Camera Perspective
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      <View style={styles.promptBar}>
        <Text style={styles.subtitle} numberOfLines={2}>
          Visual Style: <Text style={{ color: themeColors[2] || '#38BDF8', fontWeight: '800' }}>{selectedDirection.name}</Text>. Select your gameplay camera angle:
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={styles.loadingText}>Synthesizing game viewports...</Text>
          <Text style={styles.loadingSubtext}>Generating 4 in-game angles with {selectedDirection.name}</Text>
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
                  ? 'rgba(168, 85, 247, 0.4)'
                  : perspective.dimension === '2.5D'
                  ? 'rgba(56, 189, 248, 0.4)'
                  : 'rgba(52, 211, 153, 0.4)';
              const badgeColor =
                perspective.dimension === '3D'
                  ? '#E9D5FF'
                  : perspective.dimension === '2.5D'
                  ? '#BAE6FD'
                  : '#A7F3D0';

              return (
                <Pressable
                  key={perspective.id || index}
                  onPress={() => onSelect(perspective)}
                  style={[
                    styles.card,
                    active && styles.cardActive,
                  ]}
                >
                  {/* Artwork Viewport */}
                  <View style={styles.artworkContainer}>
                    {perspective.imageUrl ? (
                      <Image
                        source={{ uri: perspective.imageUrl }}
                        style={styles.artworkImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <LinearGradient
                        colors={[themeColors[0] || '#0F172A', themeColors[1] || '#1E1B4B', '#07090E']}
                        style={StyleSheet.absoluteFill}
                      >
                        <View style={styles.placeholderIconWrap}>
                          <Ionicons
                            name={(perspective.icon as any) || 'videocam'}
                            size={38}
                            color={active ? '#C084FC' : 'rgba(255,255,255,0.7)'}
                          />
                        </View>
                      </LinearGradient>
                    )}

                    <LinearGradient
                      colors={['transparent', 'rgba(7, 9, 14, 0.4)', '#07090E']}
                      locations={[0, 0.65, 1]}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />

                    {/* Top Floating Badges */}
                    <View style={styles.artworkTopRow} pointerEvents="none">
                      <View style={[styles.dimensionBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.dimensionText, { color: badgeColor }]}>
                          {perspective.dimension}
                        </Text>
                      </View>
                      {active && (
                        <View style={styles.activeCheckmark}>
                          <Ionicons name="checkmark-circle" size={20} color="#a855f7" />
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Card Meta Info */}
                  <View style={styles.cardInfo}>
                    <Text style={styles.perspectiveName} numberOfLines={1}>
                      {index + 1}. {perspective.name}
                    </Text>
                    <Text style={styles.perspectiveTagline} numberOfLines={1}>
                      {perspective.tagline}
                    </Text>
                  </View>

                  {/* Active highlight rim */}
                  {active && <View style={styles.activeInnerRim} pointerEvents="none" />}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Bottom Sticky Action Footer */}
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
                Forge Game ({chosen.dimension} · {chosen.name})
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
  promptBar: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 10,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '700',
  },
  loadingSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 24,
    paddingTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    backgroundColor: '#0F121C',
  },
  cardActive: {
    borderColor: '#a855f7',
    borderWidth: 2,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  artworkContainer: {
    width: '100%',
    height: ARTWORK_HEIGHT,
    position: 'relative',
    backgroundColor: '#07090E',
    overflow: 'hidden',
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  placeholderIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkTopRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dimensionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dimensionText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 2,
  },
  perspectiveName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  perspectiveTagline: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  activeInnerRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.6)',
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
