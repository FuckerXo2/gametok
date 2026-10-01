import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  onUsePerspective: (perspective: CameraPerspective, refinement?: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 18;
const GRID_GAP = 12;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2);
const ARTWORK_HEIGHT = CARD_WIDTH; // 1:1 square aspect ratio matching AI image generator & VisualDirectionScreen
const CARD_HEIGHT = ARTWORK_HEIGHT + 58; // Total card height including title & tagline

export const PerspectiveSelectionScreen = ({
  gameTitle,
  prompt,
  selectedDirection,
  perspectives = [],
  isLoading = false,
  selectedId,
  onSelect,
  onUsePerspective,
  onBack,
  onClose,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState<string | null>(selectedId || perspectives[0]?.id || null);
  const [refinement, setRefinement] = useState('');

  const chosen = perspectives.find((p) => p.id === (activeId || selectedId)) || perspectives[0];
  const themeColors = selectedDirection?.colors || ['#1E1B4B', '#6366F1', '#38BDF8', '#F43F5E'];

  const handleCardPress = (perspective: CameraPerspective) => {
    if (activeId === perspective.id) {
      // Double tap advances immediately to game building
      onUsePerspective(perspective, refinement.trim());
      return;
    }
    setActiveId(perspective.id);
    onSelect(perspective);
  };

  return (
    <View style={styles.root}>
      {/* Deep obsidian midnight background matching VisualDirectionScreen exactly */}
      <LinearGradient
        colors={['#00050D', '#010814', '#00040A']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Header Bar matching VisualDirectionScreen */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerLeft}>
          {onBack && (
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
              onPress={onBack}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>
          )}
          <Text style={styles.logoText}>gametok</Text>
        </View>

        {onClose && (
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            onPress={onClose}
            hitSlop={12}
          >
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Title & Subtitle matching VisualDirectionScreen */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              Here are a few camera perspectives{'\n'}for your game.
            </Text>
            <Text style={styles.subtitle}>
              Rendered in <Text style={{ color: themeColors[2] || '#38BDF8', fontWeight: '800' }}>{selectedDirection?.name || 'Selected Style'}</Text>. Select your gameplay camera angle.
            </Text>
          </View>

          {/* 2x2 Grid of Camera Perspective Cards */}
          {isLoading || perspectives.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.loadingText}>
                Synthesizing camera viewports in {selectedDirection?.name || 'chosen style'}...
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {perspectives.map((perspective, index) => {
                const active = perspective.id === (activeId || chosen?.id);
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
                    onPress={() => handleCardPress(perspective)}
                    style={[styles.card, active && styles.cardActive]}
                  >
                    {/* Artwork Viewport */}
                    <View style={styles.artworkContainer}>
                      {perspective.imageUrl ? (
                        <Image
                          source={{ uri: perspective.imageUrl }}
                          style={styles.cardImage}
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
                              size={36}
                              color={active ? '#C084FC' : 'rgba(255,255,255,0.7)'}
                            />
                          </View>
                        </LinearGradient>
                      )}

                      <LinearGradient
                        colors={['transparent', 'rgba(13, 17, 29, 0.35)', '#0D111D']}
                        locations={[0, 0.75, 1]}
                        style={styles.cardImageOverlay}
                      />

                      {/* Dimension Badge & Active Checkmark */}
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
                        {perspective.name}
                      </Text>
                      <Text style={styles.perspectiveTagline} numberOfLines={1}>
                        {perspective.tagline}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Bottom Bar: Action Button to Forge Game */}
        {chosen && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable
              style={({ pressed }) => [styles.forgeBtn, pressed && styles.forgeBtnPressed]}
              onPress={() => onUsePerspective(chosen, refinement.trim())}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.forgeBtnGradient}
              >
                <Text style={styles.forgeBtnText}>
                  Forge Game with {chosen.name}
                </Text>
                <Ionicons name="flash" size={17} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#01060E',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 24,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },

  /* Title Section */
  titleSection: {
    marginTop: 6,
    marginBottom: 20,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 6,
    lineHeight: 18,
  },

  /* Grid */
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    backgroundColor: '#0F121C',
  },
  cardActive: {
    borderColor: '#A855F7',
    borderWidth: 2,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 8,
  },

  /* Artwork Viewport */
  artworkContainer: {
    width: '100%',
    height: ARTWORK_HEIGHT,
    position: 'relative',
    backgroundColor: '#07090E',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageOverlay: {
    ...StyleSheet.absoluteFill,
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

  /* Card Meta */
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

  /* Loading State */
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  /* Bottom Action Bar */
  bottomBar: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  forgeBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  forgeBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  forgeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  forgeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
