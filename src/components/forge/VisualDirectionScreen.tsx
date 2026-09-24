import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ai } from '../../services/api';

export interface VisualDirection {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string, string] | readonly [string, string, string, string];
  instruction: string;
  themeType:
    | 'coral'
    | 'ocean'
    | 'marine'
    | 'atlantis'
    | 'cyber'
    | 'void'
    | 'arcade'
    | 'scifi'
    | 'fantasy'
    | 'nature'
    | 'dark'
    | 'celestial';
  imageUrl?: string;
  imageSource?: any;
}

interface Props {
  gameTitle: string;
  prompt: string;
  selectedId: string | null;
  onSelect: (direction: VisualDirection) => void;
  onUseDirection: (direction: VisualDirection, refinement: string) => void;
  onSkip?: () => void;
  onGenerateMore: (refinement?: string) => void;
  onClose?: () => void;
  generation: number;
}

const CORAL_IMG = require('../../../assets/forge/direction_coral.jpg');
const OCEAN_IMG = require('../../../assets/forge/direction_ocean.jpg');
const MARINE_IMG = require('../../../assets/forge/direction_marine.jpg');
const ATLANTIS_IMG = require('../../../assets/forge/direction_atlantis.jpg');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 18;
const GRID_GAP = 12;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GRID_GAP) / 2);
const ARTWORK_HEIGHT = CARD_WIDTH; // 1:1 square aspect ratio matching AI image generators & mockup
const CARD_HEIGHT = ARTWORK_HEIGHT + 58; // Total card height including title & tagline

const DIRECTION_SETS: VisualDirection[][] = [
  // Set 0: Main 4 cards matching mockup (Coral Kingdom, Deep Ocean, Cartoon Marine, Royal Atlantis)
  [
    {
      id: 'coral-kingdom',
      name: 'Coral Kingdom',
      tagline: 'Bright & playful',
      description: 'Vibrant coral reef palace with warm sunbeams and playful energy',
      icon: 'sparkles',
      colors: ['#1A0B2E', '#991B1B', '#E11D48', '#38BDF8'],
      instruction:
        'Use a bright and playful coral kingdom art direction with vibrant pink and teal tones, warm sunbeams, and charming underwater palace details.',
      themeType: 'coral',
      imageSource: CORAL_IMG,
    },
    {
      id: 'deep-ocean',
      name: 'Deep Ocean',
      tagline: 'Mysterious & magical',
      description: 'Deep sapphire ocean depths with glowing bioluminescent shrines',
      icon: 'water',
      colors: ['#030712', '#0A1931', '#185ADB', '#00FFF0'],
      instruction:
        'Use a mysterious and magical deep ocean art direction with deep sapphire blues, glowing bioluminescent runes, and ancient underwater shrines.',
      themeType: 'ocean',
      imageSource: OCEAN_IMG,
    },
    {
      id: 'cartoon-marine',
      name: 'Cartoon Marine',
      tagline: 'Fun & whimsical',
      description: 'Joyful cartoon sea creatures, turquoise waters, and bouncy animations',
      icon: 'happy-outline',
      colors: ['#042F2E', '#0F766E', '#14B8A6', '#FBBF24'],
      instruction:
        'Use a fun and whimsical cartoon marine art direction with vibrant turquoise water, friendly stylized sea creatures, and bold expressive shapes.',
      themeType: 'marine',
      imageSource: MARINE_IMG,
    },
    {
      id: 'royal-atlantis',
      name: 'Royal Atlantis',
      tagline: 'Epic & detailed',
      description: 'Grand sunken palace with majestic golden pillars and sunlit waters',
      icon: 'shield-outline',
      colors: ['#0F172A', '#1E1B4B', '#0369A1', '#F59E0B'],
      instruction:
        'Use an epic and detailed royal Atlantis art direction with grand sunken marble and gold architecture, luminous turquoise ocean depth, and majestic scale.',
      themeType: 'atlantis',
      imageSource: ATLANTIS_IMG,
    },
  ],
  // Set 1: Sci-Fi / Cyber / Retro (Appended on 1st "Generate more")
  [
    {
      id: 'neon-cyber',
      name: 'Neon Cyber',
      tagline: 'Fast & electric',
      description: 'Luminous neon streets with holographic glow and high-voltage energy',
      icon: 'flash',
      colors: ['#0A0017', '#7928CA', '#FF0080', '#00DFD8'],
      instruction:
        'Use a fast, electric cyberpunk visual direction with hot pink, cyan neon highlights, and high-tech UI styling.',
      themeType: 'cyber',
    },
    {
      id: 'deep-void',
      name: 'Deep Void',
      tagline: 'Dark & atmospheric',
      description: 'Mysterious cosmic expanse with stellar nebula clouds and starlight',
      icon: 'planet-outline',
      colors: ['#02040A', '#0B132B', '#1C2541', '#6FFFE9'],
      instruction:
        'Use a dark atmospheric deep space direction with obsidian voids, cold nebula luminescence, and stark contrast.',
      themeType: 'void',
    },
    {
      id: 'retro-arcade',
      name: 'Retro Arcade',
      tagline: 'Punchy & nostalgic',
      description: 'Chunky pixel vibes, high contrast retro colors, and immediate readability',
      icon: 'game-controller',
      colors: ['#1A0B2E', '#9333EA', '#EC4899', '#FACC15'],
      instruction:
        'Use a punchy retro arcade art direction with saturated 16-bit colors, crisp silhouettes, and playful energy.',
      themeType: 'arcade',
    },
    {
      id: 'star-odyssey',
      name: 'Star Odyssey',
      tagline: 'Grand & cinematic',
      description: 'Cinematic sci-fi scale with gleaming orbital stations and cinematic lighting',
      icon: 'rocket-outline',
      colors: ['#030712', '#1E293B', '#3B82F6', '#60A5FA'],
      instruction:
        'Use a grand cinematic sci-fi art direction with clean spacecraft surfaces, dramatic rim lighting, and vast scale.',
      themeType: 'scifi',
    },
  ],
  // Set 2: Fantasy / Mythic / Nature (Appended on 2nd "Generate more")
  [
    {
      id: 'enchanted-grove',
      name: 'Enchanted Grove',
      tagline: 'Lush & magical',
      description: 'Glowing flora, floating fae spores, and ancient mossy stone ruins',
      icon: 'leaf-outline',
      colors: ['#022C22', '#065F46', '#10B981', '#A7F3D0'],
      instruction:
        'Use an enchanted magical forest visual direction with bioluminescent plants, emerald moss, and soft glowing particles.',
      themeType: 'nature',
    },
    {
      id: 'mythic-citadel',
      name: 'Mythic Citadel',
      tagline: 'Grand & regal',
      description: 'High fantasy stone citadels, royal banners, and golden sky illumination',
      icon: 'trophy-outline',
      colors: ['#1E1B4B', '#4338CA', '#818CF8', '#FCD34D'],
      instruction:
        'Use a grand mythic high fantasy art direction with majestic castle towers, golden light, and regal ornamentation.',
      themeType: 'fantasy',
    },
    {
      id: 'shadow-keep',
      name: 'Shadow Keep',
      tagline: 'Moody & intense',
      description: 'Gothic spire silhouettes, crimson moon glow, and dramatic shadows',
      icon: 'flame-outline',
      colors: ['#090A0F', '#450A0A', '#991B1B', '#F87171'],
      instruction:
        'Use a dark gothic fantasy art direction with crimson atmospheric light, deep cast shadows, and sharp silhouettes.',
      themeType: 'dark',
    },
    {
      id: 'celestial-skies',
      name: 'Celestial Skies',
      tagline: 'Ethereal & radiant',
      description: 'Floating sky islands, auroral clouds, and sun-kissed crystal shrines',
      icon: 'sunny-outline',
      colors: ['#1E1B4B', '#6366F1', '#A855F7', '#FDE047'],
      instruction:
        'Use an ethereal celestial art direction with floating cloud sanctuaries, radiant auroras, and crystalline glow.',
      themeType: 'celestial',
    },
  ],
  // Set 3: Indie / Anime / Hand-Crafted (Appended on 3rd "Generate more")
  [
    {
      id: 'pixel-craft',
      name: 'Pixel Craft',
      tagline: 'Charming & 8-bit',
      description: 'Nostalgic handcrafted 16-bit pixel art with bold colors and cozy charm',
      icon: 'cube-outline',
      colors: ['#1F2937', '#3B82F6', '#10B981', '#F59E0B'],
      instruction:
        'Use a charming 16-bit pixel art direction with crisp sprite readability, joyful color palettes, and retro arcade personality.',
      themeType: 'arcade',
    },
    {
      id: 'cozy-clay',
      name: 'Cozy Clay',
      tagline: 'Warm & tactile',
      description: 'Stop-motion claymation texture with soft lighting and charming imperfections',
      icon: 'color-palette-outline',
      colors: ['#451A03', '#B45309', '#F59E0B', '#FDE68A'],
      instruction:
        'Use a tactile stop-motion claymation art direction with warm physical textures, soft studio rim lighting, and friendly forms.',
      themeType: 'nature',
    },
    {
      id: 'neon-synthwave',
      name: 'Neon Synthwave',
      tagline: '80s retro sunset',
      description: 'Chrome wireframe horizons, gradient sunsets, and electric purple glow',
      icon: 'musical-notes-outline',
      colors: ['#180033', '#7928CA', '#F43F5E', '#FBBF24'],
      instruction:
        'Use an 80s outrun synthwave art direction with glowing neon wireframes, saturated gradient horizons, and high-energy contrast.',
      themeType: 'cyber',
    },
    {
      id: 'golden-steampunk',
      name: 'Golden Steampunk',
      tagline: 'Intricate & brass',
      description: 'Polished brass clockwork, ornate copper gears, and misty warm steam',
      icon: 'cog-outline',
      colors: ['#1C1917', '#78350F', '#D97706', '#FCD34D'],
      instruction:
        'Use an intricate steampunk art direction with polished brass gears, antique copper dials, atmospheric steam haze, and Victorian elegance.',
      themeType: 'atlantis',
    },
  ],
];

/**
 * Procedural stylized visual artwork placeholder matching the mockup aesthetics.
 * Seamlessly falls back to custom vector gradients & illustrations until real image generation is wired in.
 */
const DirectionArtwork = ({
  direction,
  isGenerating,
}: {
  direction: VisualDirection;
  isGenerating?: boolean;
}) => {
  const imageSource = direction.imageSource || (direction.imageUrl ? { uri: direction.imageUrl } : null);

  if (isGenerating) {
    return (
      <View style={[styles.artContainer, styles.generatingContainer]}>
        <LinearGradient
          colors={['#0F172A', '#1E1B4B', '#2E1065']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.generatingSpinner}>
          <Ionicons name="sparkles" size={24} color="#F0ABFC" />
        </View>
        <Text style={styles.generatingText}>Generating image...</Text>
      </View>
    );
  }

  if (imageSource) {
    return (
      <View style={styles.artContainer}>
        <Image
          source={imageSource}
          style={styles.cardImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(13, 17, 29, 0.25)', '#0D111D']}
          locations={[0, 0.75, 1]}
          style={styles.cardImageOverlay}
        />
      </View>
    );
  }

  const gradientColors = [...direction.colors] as [string, string, ...string[]];

  return (
    <View style={styles.artContainer}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Theme 1: Coral Kingdom */}
      {direction.themeType === 'coral' && (
        <>
          <View style={styles.sunbeamA} />
          <View style={styles.sunbeamB} />
          <View style={styles.coralSpireBase}>
            <View style={styles.coralSpireLeft} />
            <View style={styles.coralSpireCenter}>
              <View style={styles.castleWindow} />
              <View style={styles.castleWindowMini} />
            </View>
            <View style={styles.coralSpireRight} />
          </View>
          <View style={[styles.mote, { top: 22, left: 30, width: 4, height: 4 }]} />
          <View style={[styles.mote, { top: 45, right: 34, width: 6, height: 6 }]} />
          <View style={[styles.mote, { top: 70, left: 52, width: 3, height: 3 }]} />
        </>
      )}

      {/* Theme 2: Deep Ocean */}
      {direction.themeType === 'ocean' && (
        <>
          <LinearGradient
            colors={['rgba(0, 255, 240, 0.32)', 'rgba(24, 90, 219, 0)']}
            start={{ x: 0.5, y: 0.2 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.abyssBeam}
          />
          <View style={styles.deepTemple}>
            <View style={styles.templePillarL} />
            <View style={styles.templeCore}>
              <View style={styles.templeGlowCore} />
            </View>
            <View style={styles.templePillarR} />
          </View>
          <View style={[styles.bioOrb, { top: 30, right: 28 }]} />
          <View style={[styles.bioOrb, { top: 58, left: 32 }]} />
          <View style={[styles.bioOrb, { top: 78, right: 54 }]} />
        </>
      )}

      {/* Theme 3: Cartoon Marine */}
      {direction.themeType === 'marine' && (
        <>
          <View style={styles.marineCenter}>
            <View style={styles.fishBody}>
              <View style={styles.fishEye} />
              <View style={styles.fishTail} />
            </View>
            <View style={styles.turtleShell}>
              <View style={styles.turtleHead} />
              <View style={styles.turtleFlipper} />
            </View>
          </View>
          <View style={[styles.bubble, { bottom: 18, left: 24, width: 8, height: 8 }]} />
          <View style={[styles.bubble, { bottom: 36, left: 36, width: 12, height: 12 }]} />
          <View style={[styles.bubble, { bottom: 58, right: 26, width: 7, height: 7 }]} />
          <View style={[styles.bubble, { bottom: 82, right: 40, width: 10, height: 10 }]} />
        </>
      )}

      {/* Theme 4: Royal Atlantis */}
      {direction.themeType === 'atlantis' && (
        <>
          <View style={styles.atlantisPalace}>
            <View style={styles.atlantisPillar} />
            <View style={styles.atlantisArch}>
              <View style={styles.atlantisGoldenPortal} />
            </View>
            <View style={styles.atlantisPillar} />
          </View>
          <LinearGradient
            colors={['rgba(251, 191, 36, 0.4)', 'rgba(251, 191, 36, 0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.8 }}
            style={styles.goldenShimmer}
          />
        </>
      )}

      {/* Theme 5: Cyber */}
      {direction.themeType === 'cyber' && (
        <>
          <View style={styles.cyberHorizonGlow} />
          <View style={styles.cyberTowers}>
            <View style={styles.cyberTowerL} />
            <View style={styles.cyberTowerC} />
            <View style={styles.cyberTowerR} />
          </View>
          <View style={[styles.mote, { top: 25, right: 28, backgroundColor: '#00DFD8' }]} />
        </>
      )}

      {/* Theme 6: Deep Void */}
      {direction.themeType === 'void' && (
        <>
          <View style={styles.voidPlanetWrap}>
            <View style={styles.voidPlanetCore} />
            <View style={styles.voidPlanetRing} />
          </View>
          <View style={[styles.mote, { top: 20, right: 30, width: 3, height: 3 }]} />
          <View style={[styles.mote, { top: 38, left: 40, width: 4, height: 4 }]} />
        </>
      )}

      {/* Theme 7: Nature / Grove */}
      {direction.themeType === 'nature' && (
        <>
          <View style={styles.natureGrove}>
            <View style={styles.natureMushroomL} />
            <View style={styles.natureMushroomC} />
            <View style={styles.natureMushroomR} />
          </View>
          <View style={[styles.bioOrb, { top: 24, left: 28, backgroundColor: '#34D399', shadowColor: '#34D399' }]} />
          <View style={[styles.bioOrb, { top: 46, right: 36, backgroundColor: '#A7F3D0', shadowColor: '#A7F3D0' }]} />
        </>
      )}

      {/* Theme 8: Fantasy Citadel */}
      {direction.themeType === 'fantasy' && (
        <>
          <View style={styles.fantasyCitadel}>
            <View style={styles.fantasySpireL} />
            <View style={styles.fantasyKeepC} />
            <View style={styles.fantasySpireR} />
          </View>
        </>
      )}

      {/* Theme 9: Dark Gothic */}
      {direction.themeType === 'dark' && (
        <>
          <View style={styles.darkMoon} />
          <View style={styles.darkGothicSpire} />
        </>
      )}

      {/* Theme 10: Celestial */}
      {direction.themeType === 'celestial' && (
        <>
          <View style={styles.celestialSun} />
          <View style={styles.celestialShrine} />
        </>
      )}

      {/* Fallback stylized icons for other themes */}
      {direction.themeType !== 'coral' &&
        direction.themeType !== 'ocean' &&
        direction.themeType !== 'marine' &&
        direction.themeType !== 'atlantis' &&
        direction.themeType !== 'cyber' &&
        direction.themeType !== 'void' &&
        direction.themeType !== 'nature' &&
        direction.themeType !== 'fantasy' &&
        direction.themeType !== 'dark' &&
        direction.themeType !== 'celestial' && (
          <View style={styles.genericThemeIconWrap}>
            <View style={styles.genericThemeGlow} />
            <Ionicons name={direction.icon} size={36} color="rgba(255,255,255,0.92)" />
          </View>
        )}

      {/* Smooth bottom dark vignette fade into card footer */}
      <LinearGradient
        colors={['transparent', 'rgba(13, 17, 29, 0.45)', '#0D111D']}
        locations={[0, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

/**
 * Direction Card Component:
 * - The ENTIRE CARD (artwork + title + tagline + glowing frame) glides in slowly from LEFT to RIGHT
 * - Neon border halo blooms smoothly when active
 */
const AnimatedDirectionCard = ({
  direction,
  index,
  active,
  onPress,
  isNew,
  isGenerating,
}: {
  direction: VisualDirection;
  index: number;
  active: boolean;
  onPress: () => void;
  isNew?: boolean;
  isGenerating?: boolean;
}) => {
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const neonGlowAnim = useRef(new Animated.Value(0)).current;
  const isFirstMount = useRef(true);

  // Slow, cinematic left-to-right entrance for the entire card
  useEffect(() => {
    const batchIndex = index % 4;
    const baseDelay = isNew ? 60 : 100;
    const delay = baseDelay + batchIndex * 120;

    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(entranceAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, isNew]);

  // Smooth bloom transition for the glowing neon purple border on selection
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (active) {
        const batchIndex = index % 4;
        const baseDelay = isNew ? 60 : 100;
        const delay = baseDelay + batchIndex * 120;

        Animated.sequence([
          Animated.delay(delay + 400),
          Animated.timing(neonGlowAnim, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
        return;
      }
    }

    Animated.timing(neonGlowAnim, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active]);

  // Left-to-right entrance: whole card starts on the left (-160) and glides right into slot (0)
  const cardTranslateX = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 0],
  });

  const cardScale = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  const cardOpacity = entranceAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.75, 1],
  });

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: cardOpacity,
          transform: [{ translateX: cardTranslateX }, { scale: cardScale }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.cardPressable,
          pressed && styles.cardPressed,
        ]}
      >
        {/* Animated Radiant Neon Outer Glow Halos */}
        <Animated.View
          style={[
            styles.neonGlowOuter,
            {
              opacity: neonGlowAnim,
              transform: [
                {
                  scale: neonGlowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            styles.neonGlowMid,
            {
              opacity: neonGlowAnim,
            },
          ]}
          pointerEvents="none"
        />

        {/* Entire Card Shell (Artwork + Copy together) */}
        <View
          style={[
            styles.cardInner,
            active ? styles.cardInnerActive : styles.cardInnerInactive,
          ]}
        >
          {/* Visual Artwork Area */}
          <DirectionArtwork direction={direction} isGenerating={isGenerating} />

          {/* Card Copy Area */}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {index + 1}. {direction.name}
            </Text>
            <Text style={styles.cardTagline} numberOfLines={1}>
              {direction.tagline || direction.description}
            </Text>
          </View>

          {/* White-hot specular inner rim when active */}
          {active && <View style={styles.activeInnerGlow} pointerEvents="none" />}
        </View>
      </Pressable>
    </Animated.View>
  );
};

export const VisualDirectionScreen = ({
  gameTitle,
  prompt,
  selectedId,
  onSelect,
  onUseDirection,
  onSkip,
  onGenerateMore,
  onClose,
  generation,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [refinement, setRefinement] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Candidate pool for appending 2 cards at a time
  const CANDIDATE_PAIRS = useMemo(() => [
    ...DIRECTION_SETS[1],
    ...DIRECTION_SETS[2],
    ...DIRECTION_SETS[3],
  ], []);

  const [appendedCards, setAppendedCards] = useState<VisualDirection[]>([]);
  const [liveDirections, setLiveDirections] = useState<VisualDirection[]>([]);
  const [isGeneratingLive, setIsGeneratingLive] = useState(false);
  const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});
  const nextCandidateIndexRef = useRef(0);

  // If prompt or gameTitle changes, reset and fetch live visual directions from backend
  useEffect(() => {
    setAppendedCards([]);
    setGeneratingMap({});
    nextCandidateIndexRef.current = 0;

    let isMounted = true;
    if (prompt && prompt.trim()) {
      setIsGeneratingLive(true);
      ai.generateVisualDirections(prompt, gameTitle)
        .then((res: any) => {
          if (isMounted && res?.directions && res.directions.length > 0) {
            setLiveDirections(res.directions);
          }
        })
        .catch((err) => {
          console.warn('[VisualDirectionScreen] Live direction generation fallback:', err?.message || err);
        })
        .finally(() => {
          if (isMounted) setIsGeneratingLive(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [prompt, gameTitle]);

  const directions = useMemo(() => {
    const base = liveDirections.length > 0 ? liveDirections : DIRECTION_SETS[0];
    return [...base, ...appendedCards];
  }, [liveDirections, appendedCards]);

  const handleGenerateMore = () => {
    // Add 2 more cards from candidates
    const idx = nextCandidateIndexRef.current;
    const card1 = CANDIDATE_PAIRS[idx % CANDIDATE_PAIRS.length];
    const card2 = CANDIDATE_PAIRS[(idx + 1) % CANDIDATE_PAIRS.length];
    nextCandidateIndexRef.current = idx + 2;

    const round = Math.floor(idx / CANDIDATE_PAIRS.length);
    const id1 = round > 0 ? `${card1.id}-v${round}` : `${card1.id}-more`;
    const id2 = round > 0 ? `${card2.id}-v${round}` : `${card2.id}-more`;

    const newCard1: VisualDirection = { ...card1, id: id1 };
    const newCard2: VisualDirection = { ...card2, id: id2 };

    setAppendedCards((prev) => [...prev, newCard1, newCard2]);
    setGeneratingMap((prev) => ({ ...prev, [id1]: true, [id2]: true }));

    // Realistically resolve image after 2.4s
    setTimeout(() => {
      setGeneratingMap((prev) => ({ ...prev, [id1]: false, [id2]: false }));
    }, 2400);

    onGenerateMore(refinement.trim() || undefined);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  // Instant local active ID with prop syncing (null by default until user taps a card)
  const [activeId, setActiveId] = useState<string | null>(selectedId || null);

  useEffect(() => {
    if (selectedId) {
      setActiveId(selectedId);
    }
  }, [selectedId]);

  const selected = directions.find((item) => item.id === activeId) ?? null;

  const handleSubmit = () => {
    const request = refinement.trim();
    if (!request) {
      // Do NOT advance to next screen on empty send! Only double-tapping a card advances!
      return;
    }

    // Refinement message adds 1 custom card and starts generating an image on it
    const newId = `custom-refinement-${Date.now()}`;
    const customCard: VisualDirection = {
      id: newId,
      name: selected ? `${selected.name} (${request.slice(0, 14)})` : 'Custom Style',
      tagline: request,
      description: `Refined with: "${request}"`,
      icon: 'sparkles',
      colors: selected ? selected.colors : ['#1A0B2E', '#9333EA', '#EC4899', '#38BDF8'],
      instruction: `${selected?.instruction || ''} Visual refinement: ${request}`,
      themeType: selected?.themeType || 'coral',
      imageSource: selected?.imageSource,
    };

    setAppendedCards((prev) => [...prev, customCard]);
    setGeneratingMap((prev) => ({ ...prev, [newId]: true }));
    setActiveId(newId);
    onSelect(customCard);
    setRefinement('');

    setTimeout(() => {
      setGeneratingMap((prev) => ({ ...prev, [newId]: false }));
    }, 2600);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleCardPress = (direction: VisualDirection) => {
    if (activeId === direction.id) {
      // User tapped the already-selected card again! Advance to building screen!
      onUseDirection(direction, refinement.trim());
      return;
    }
    setActiveId(direction.id);
    onSelect(direction);
  };

  return (
    <View style={styles.root}>
      {/* Deep obsidian midnight background matching mockup exactly */}
      <LinearGradient
        colors={['#00050D', '#010814', '#00040A']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Header Bar (gametok brand on left, clean close button on right, NO Labs Forge) */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.logoText}>gametok</Text>

        {onClose && (
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
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
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Title & Subtitle - Completely static, never transitions */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              Here are a few visual directions{'\n'}for your game.
            </Text>
            <Text style={styles.subtitle}>
              {isGeneratingLive
                ? '✨ Flux AI is generating custom concept art...'
                : 'Choose a style, or ask for more variations.'}
            </Text>
          </View>

          {/* 2x2 Grid of Visual Direction Cards: Texts stay static, only images transition slowly left-to-right */}
          <View style={styles.grid}>
            {directions.map((direction, index) => {
              const active = direction.id === activeId;
              return (
                <AnimatedDirectionCard
                  key={direction.id}
                  direction={direction}
                  index={index}
                  active={active}
                  onPress={() => handleCardPress(direction)}
                  isNew={index >= 4}
                  isGenerating={!!generatingMap[direction.id]}
                />
              );
            })}
          </View>

          {/* "Generate more options" Button - Completely static, never transitions */}
          <View style={styles.generateMoreContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.generateMoreBtn,
                pressed && styles.generateMoreBtnPressed,
              ]}
              onPress={handleGenerateMore}
            >
              <LinearGradient
                colors={['rgba(28, 22, 54, 0.85)', 'rgba(15, 20, 38, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.generateMoreGradient}
              >
                <Ionicons name="sparkles" size={17} color="#F0ABFC" />
                <Text style={styles.generateMoreText}>Generate more options</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>

        {/* Bottom Refine Input Capsule - Completely static, never transitions */}
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
              placeholder="Make it more colorful..."
              placeholderTextColor="#64748B"
              style={styles.textInput}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
            />
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && styles.submitBtnPressed,
              ]}
              onPress={handleSubmit}
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
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },

  /* Title Section */
  titleSection: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13.5,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  /* 2x2 Grid of Cards */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: GRID_GAP,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: 4,
  },
  cardPressable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },

  /* Radiant Multi-layer Neon Glowing Borders */
  neonGlowOuter: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 23,
    backgroundColor: 'rgba(217, 70, 239, 0.28)',
    shadowColor: '#E879F9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 10,
  },
  neonGlowMid: {
    position: 'absolute',
    top: -2.5,
    left: -2.5,
    right: -2.5,
    bottom: -2.5,
    borderRadius: 20.5,
    backgroundColor: 'rgba(240, 171, 252, 0.42)',
    shadowColor: '#F5D0FE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },

  /* Card Inner Shell */
  cardInner: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0D111D',
  },
  cardInnerInactive: {
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardInnerActive: {
    borderWidth: 2,
    borderColor: '#F0ABFC', // Brilliant electric neon pink/lilac core
    shadowColor: '#E879F9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
  activeInnerGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.72)', // White-hot specular inner rim
  },

  /* Artwork Area Wrapper - keeps image strictly clipped inside card */
  artAreaWrapper: {
    width: '100%',
    height: ARTWORK_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#070B14',
    position: 'relative',
  },

  /* Artwork Container */
  artContainer: {
    width: '100%',
    height: ARTWORK_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070B14',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageOverlay: {
    ...StyleSheet.absoluteFill,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  generatingSpinner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(240, 171, 252, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(240, 171, 252, 0.5)',
  },
  generatingText: {
    color: '#DDD6FE',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  /* Card Copy Area */
  cardInfo: {
    height: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    backgroundColor: '#0D111D',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardTagline: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '400',
    marginTop: 2,
  },

  /* Coral Kingdom Theme Graphic Elements */
  sunbeamA: {
    position: 'absolute',
    top: -20,
    left: 20,
    width: 60,
    height: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '32deg' }],
  },
  sunbeamB: {
    position: 'absolute',
    top: -10,
    left: 70,
    width: 30,
    height: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    transform: [{ rotate: '32deg' }],
  },
  coralSpireBase: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  coralSpireLeft: {
    width: 22,
    height: 48,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    backgroundColor: 'rgba(244, 63, 94, 0.65)',
    marginRight: -4,
  },
  coralSpireCenter: {
    width: 34,
    height: 72,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    backgroundColor: 'rgba(251, 113, 133, 0.85)',
    alignItems: 'center',
    paddingTop: 12,
    zIndex: 2,
  },
  coralSpireRight: {
    width: 26,
    height: 54,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    backgroundColor: 'rgba(244, 63, 94, 0.65)',
    marginLeft: -4,
  },
  castleWindow: {
    width: 8,
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(254, 240, 138, 0.9)',
  },
  castleWindowMini: {
    width: 6,
    height: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(254, 240, 138, 0.75)',
    marginTop: 6,
  },
  mote: {
    position: 'absolute',
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },

  /* Deep Ocean Theme Graphic Elements */
  abyssBeam: {
    position: 'absolute',
    top: 0,
    width: 50,
    height: 130,
  },
  deepTemple: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  templePillarL: {
    width: 12,
    height: 52,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 240, 0.3)',
    marginRight: 6,
  },
  templeCore: {
    width: 38,
    height: 76,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(10, 25, 47, 0.95)',
    borderWidth: 1.2,
    borderColor: 'rgba(0, 255, 240, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templeGlowCore: {
    width: 14,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#00FFF0',
    shadowColor: '#00FFF0',
    shadowRadius: 10,
    shadowOpacity: 0.9,
  },
  templePillarR: {
    width: 12,
    height: 52,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 240, 0.3)',
    marginLeft: 6,
  },
  bioOrb: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FFF0',
    shadowColor: '#00FFF0',
    shadowRadius: 6,
    shadowOpacity: 0.9,
  },

  /* Cartoon Marine Graphic Elements */
  marineCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  fishBody: {
    width: 32,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FBBF24',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 6,
    marginBottom: 8,
  },
  fishEye: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#000000',
  },
  fishTail: {
    position: 'absolute',
    right: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#F59E0B',
  },
  turtleShell: {
    width: 44,
    height: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  turtleHead: {
    position: 'absolute',
    left: -10,
    top: 6,
    width: 14,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34D399',
  },
  turtleFlipper: {
    position: 'absolute',
    bottom: -4,
    left: 8,
    width: 14,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  bubble: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },

  /* Royal Atlantis Graphic Elements */
  atlantisPalace: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  atlantisPillar: {
    width: 14,
    height: 60,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(253, 224, 71, 0.6)',
  },
  atlantisArch: {
    width: 46,
    height: 78,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    backgroundColor: 'rgba(217, 119, 6, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(253, 224, 71, 0.8)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 4,
    paddingBottom: 4,
  },
  atlantisGoldenPortal: {
    width: 18,
    height: 32,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: '#FEF08A',
    shadowColor: '#FEF08A',
    shadowRadius: 10,
    shadowOpacity: 0.9,
  },
  goldenShimmer: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 90,
  },

  /* Cyber Theme Graphic Elements */
  cyberHorizonGlow: {
    position: 'absolute',
    bottom: 25,
    width: 100,
    height: 2,
    backgroundColor: '#FF0080',
    shadowColor: '#FF0080',
    shadowRadius: 8,
    shadowOpacity: 0.9,
  },
  cyberTowers: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  cyberTowerL: {
    width: 16,
    height: 48,
    backgroundColor: '#1E1B4B',
    borderTopWidth: 2,
    borderTopColor: '#00DFD8',
  },
  cyberTowerC: {
    width: 26,
    height: 68,
    backgroundColor: '#2E1065',
    borderTopWidth: 2,
    borderTopColor: '#FF0080',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cyberTowerR: {
    width: 18,
    height: 54,
    backgroundColor: '#1E1B4B',
    borderTopWidth: 2,
    borderTopColor: '#00DFD8',
  },

  /* Void Theme Graphic Elements */
  voidPlanetWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voidPlanetCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6FFFE9',
    shadowColor: '#6FFFE9',
    shadowRadius: 10,
    shadowOpacity: 0.8,
  },
  voidPlanetRing: {
    position: 'absolute',
    width: 52,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    transform: [{ rotate: '-25deg' }],
  },

  /* Nature Theme Graphic Elements */
  natureGrove: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  natureMushroomL: {
    width: 14,
    height: 32,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: '#10B981',
  },
  natureMushroomC: {
    width: 22,
    height: 48,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    backgroundColor: '#34D399',
  },
  natureMushroomR: {
    width: 16,
    height: 36,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#10B981',
  },

  /* Fantasy Theme Graphic Elements */
  fantasyCitadel: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  fantasySpireL: {
    width: 14,
    height: 44,
    backgroundColor: '#3730A3',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  fantasyKeepC: {
    width: 32,
    height: 64,
    backgroundColor: '#4338CA',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  fantasySpireR: {
    width: 14,
    height: 44,
    backgroundColor: '#3730A3',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },

  /* Dark Theme Graphic Elements */
  darkMoon: {
    position: 'absolute',
    top: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F87171',
    shadowColor: '#DC2626',
    shadowRadius: 12,
    shadowOpacity: 0.9,
  },
  darkGothicSpire: {
    position: 'absolute',
    bottom: 10,
    width: 22,
    height: 60,
    backgroundColor: '#18181B',
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },

  /* Celestial Theme Graphic Elements */
  celestialSun: {
    position: 'absolute',
    top: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDE047',
    shadowColor: '#FDE047',
    shadowRadius: 14,
    shadowOpacity: 0.85,
  },
  celestialShrine: {
    position: 'absolute',
    bottom: 12,
    width: 30,
    height: 52,
    backgroundColor: '#818CF8',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },

  /* Generic Theme Graphic Elements */
  genericThemeIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  genericThemeGlow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  /* "Generate more options" Button */
  generateMoreContainer: {
    width: '100%',
  },
  generateMoreBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  generateMoreGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  generateMoreBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
    borderColor: 'rgba(232, 121, 249, 0.5)',
  },
  generateMoreText: {
    color: '#DDD6FE', // Soft lilac lavender
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  /* Bottom Refine Input Bar */
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
