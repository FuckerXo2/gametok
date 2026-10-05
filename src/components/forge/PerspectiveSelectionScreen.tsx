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
import { isLandscape, type Orientation } from '../../constants/orientation';

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
  orientation?: string | Orientation;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 14;
const GRID_GAP = 12;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2);
const ARTWORK_HEIGHT = Math.round(CARD_WIDTH * 1.42); // Substantially taller, hero-sized cards
const CARD_HEIGHT = ARTWORK_HEIGHT + 56; // Total card height including title & tagline

const PerspectiveArtwork = ({
  perspective,
  themeColors,
  active,
}: {
  perspective: CameraPerspective;
  themeColors: readonly string[] | string[];
  active: boolean;
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const bgColors = (themeColors && themeColors.length >= 2
    ? [themeColors[0], themeColors[1], '#07090E']
    : ['#0F172A', '#1E1B4B', '#07090E']) as [string, string, ...string[]];

  if (perspective.imageUrl && !imageError) {
    return (
      <>
        {/* Themed background under image - NEVER black while image renders */}
        <LinearGradient
          colors={bgColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Image
          source={{ uri: perspective.imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
        <LinearGradient
          colors={['transparent', 'rgba(13, 17, 29, 0.35)', '#0D111D']}
          locations={[0, 0.75, 1]}
          style={styles.cardImageOverlay}
        />
      </>
    );
  }

  return (
    <>
      <LinearGradient
        colors={bgColors}
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
      <LinearGradient
        colors={['transparent', 'rgba(13, 17, 29, 0.35)', '#0D111D']}
        locations={[0, 0.75, 1]}
        style={styles.cardImageOverlay}
      />
    </>
  );
};

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
  orientation,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [activeId, setActiveId] = useState<string | null>(selectedId || perspectives[0]?.id || null);
  const [refinement, setRefinement] = useState('');

  const isLand = isLandscape(orientation);
  const cardWidth = isLand
    ? SCREEN_WIDTH - HORIZONTAL_PADDING * 2
    : Math.floor((SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2);
  const artworkHeight = isLand
    ? Math.round(cardWidth * (9 / 16))
    : Math.round(cardWidth * 1.42);
  const cardHeight = artworkHeight + (isLand ? 58 : 56);

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
          {/* Main Title - Subtitle removed as requested to give more room for larger cards */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              Here are a few camera perspectives{'\n'}for your game.
            </Text>
          </View>

          {/* Grid of Camera Perspective Cards: 1-col widescreen for landscape, 2x2 for portrait */}
          {isLoading || perspectives.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.loadingText}>
                Synthesizing camera viewports in {selectedDirection?.name || 'chosen style'}...
              </Text>
            </View>
          ) : (
            <View style={[styles.grid, isLand && { flexDirection: 'column', gap: 16 }]}>
              {perspectives.map((perspective, index) => {
                const active = perspective.id === (activeId || chosen?.id);

                return (
                  <Pressable
                    key={perspective.id || index}
                    onPress={() => handleCardPress(perspective)}
                    style={[styles.card, { width: cardWidth, height: cardHeight }, active && styles.cardActive]}
                  >
                    {/* Artwork Viewport */}
                    <View style={[styles.artworkContainer, { height: artworkHeight }]}>
                      <PerspectiveArtwork
                        perspective={perspective}
                        themeColors={themeColors}
                        active={active}
                      />

                      {/* Active Checkmark */}
                      {active && (
                        <View style={styles.artworkTopRow} pointerEvents="none">
                          <View style={styles.activeCheckmark}>
                            <Ionicons name="checkmark-circle" size={20} color="#a855f7" />
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Card Meta Info */}
                    <View style={[styles.cardInfo, isLand && { height: 56, paddingVertical: 10 }]}>
                      <Text style={[styles.perspectiveName, isLand && { fontSize: 15 }]} numberOfLines={1}>
                        {perspective.name}
                      </Text>
                      <Text style={[styles.perspectiveTagline, isLand && { fontSize: 12.5 }]} numberOfLines={1}>
                        {perspective.tagline}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Bottom Refine Input Bar - Matching VisualDirectionScreen */}
        {chosen && (
          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: Math.max(insets.bottom, 14),
              },
            ]}
          >
            <View style={styles.inputCapsule}>
              <TextInput
                value={refinement}
                onChangeText={setRefinement}
                placeholder="Adjust camera angle..."
                placeholderTextColor="#64748B"
                style={styles.textInput}
                returnKeyType="send"
                onSubmitEditing={() => onUsePerspective(chosen, refinement.trim())}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && styles.submitBtnPressed,
                ]}
                onPress={() => onUsePerspective(chosen, refinement.trim())}
                hitSlop={8}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitGradient}
                >
                  <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </View>
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
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    lineHeight: 28,
    textAlign: 'center',
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
  artworkLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
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

  /* Bottom Refine Input Bar matching VisualDirectionScreen */
  bottomBar: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  inputCapsule: {
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(11, 16, 32, 0.96)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14.5,
    paddingVertical: 0,
  },
  submitBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
  },
  submitGradient: {
    flex: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
