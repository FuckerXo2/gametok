import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  RadialGradient,
  Stop,
  Polygon,
  Path,
  Circle,
  G,
} from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ORB_SIZE = Math.min(SCREEN_WIDTH * 0.78, 290);

interface ForgeOrbViewProps {
  mode?: 'understanding' | 'building';
}

interface SatelliteData {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  borderColor?: string;
}

const UNDERSTANDING_SATELLITES: SatelliteData[] = [
  { id: 'mechanics', label: 'Game Mechanics', icon: 'game-controller', color: '#67E8F9' },
  { id: 'styles', label: 'Visual Styles', icon: 'images', color: '#67E8F9' },
  { id: 'systems', label: 'Core Systems', icon: 'settings', color: '#D8B4FE' },
  { id: 'platform', label: 'Target Platform', icon: 'layers', color: '#C4B5FD' },
];

const BUILDING_SATELLITES: SatelliteData[] = [
  { id: '3d-models', label: '3D Models', icon: 'cube-outline', color: '#C084FC', borderColor: 'rgba(192, 132, 252, 0.45)' },
  { id: 'textures', label: 'Textures', icon: 'image-outline', color: '#2DD4BF', borderColor: 'rgba(45, 212, 191, 0.45)' },
  { id: 'animations', label: 'Animations', icon: 'walk-outline', color: '#00FFF0', borderColor: 'rgba(0, 255, 240, 0.45)' },
  { id: 'ui-effects', label: 'UI & Effects', icon: 'sparkles-outline', color: '#F472B6', borderColor: 'rgba(244, 114, 182, 0.45)' },
  { id: 'logic', label: 'Game Logic', icon: 'code-slash-outline', color: '#818CF8', borderColor: 'rgba(129, 140, 248, 0.45)' },
  { id: 'audio', label: 'Audio', icon: 'pulse-outline', color: '#38BDF8', borderColor: 'rgba(56, 189, 248, 0.45)' },
];

const OrbitalSatellite: React.FC<{
  satellite: SatelliteData;
  index: number;
  total: number;
  orbitAngle: SharedValue<number>;
  radiusX: number;
  radiusY: number;
}> = ({ satellite, index, total, orbitAngle, radiusX, radiusY }) => {
  const animatedStyle = useAnimatedStyle(() => {
    // Distribute cards evenly around the orbital loop
    const baseOffset = (index / total) * 2 * Math.PI;
    const currentAngle = (orbitAngle.value * Math.PI) / 180 + baseOffset;

    const x = Math.cos(currentAngle) * radiusX;
    const y = Math.sin(currentAngle) * radiusY;

    // Depth perspective: bottom is foreground, top is background
    const depth = Math.sin(currentAngle);
    const scale = 0.92 + (depth + 1) * 0.06;
    const opacity = 0.78 + (depth + 1) * 0.11;

    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
      ],
      opacity,
      zIndex: depth > 0 ? 25 : 8,
    };
  });

  return (
    <Animated.View style={[styles.orbitingBadge, animatedStyle]} pointerEvents="none">
      <View
        style={[
          styles.iconBox,
          satellite.borderColor ? { borderColor: satellite.borderColor } : null,
        ]}
      >
        <Ionicons name={satellite.icon} size={22} color={satellite.color} />
      </View>
      <Text style={styles.satLabel} numberOfLines={1}>
        {satellite.label}
      </Text>
    </Animated.View>
  );
};

export const ForgeOrbView: React.FC<ForgeOrbViewProps> = ({ mode = 'understanding' }) => {
  // Animation values
  const orbitAngle = useSharedValue(0);
  const spin = useSharedValue(0);
  const spinReverse = useSharedValue(0);
  const pulse = useSharedValue(1);
  const coreGlow = useSharedValue(0.7);
  const beamScale = useSharedValue(1);
  const arcRotate = useSharedValue(0);
  const shardOrbit = useSharedValue(0);
  const moteDrift = useSharedValue(0);

  useEffect(() => {
    // Gyroscopic rings spin
    spin.value = withRepeat(
      withTiming(360, { duration: 18000, easing: Easing.linear }),
      -1,
      false
    );
    spinReverse.value = withRepeat(
      withTiming(-360, { duration: 24000, easing: Easing.linear }),
      -1,
      false
    );

    // Crystal breathing pulse
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.96, { duration: 2200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Specular bloom glow
    coreGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.65, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Vertical beam energy pulse
    beamScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.92, { duration: 1600, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Plasma energy arc slight rotation oscillation
    arcRotate.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(-8, { duration: 3200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Shard orbiting angle
    shardOrbit.value = withRepeat(
      withTiming(360, { duration: 14000, easing: Easing.linear }),
      -1,
      false
    );

    // Mote upward drift
    moteDrift.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );

    // Orbiting satellite cards revolving around the central crystal
    orbitAngle.value = withRepeat(
      withTiming(360, { duration: 26000, easing: Easing.linear }),
      -1,
      false
    );
  }, [arcRotate, beamScale, coreGlow, moteDrift, orbitAngle, pulse, shardOrbit, spin, spinReverse]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const spinReverseStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinReverse.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: coreGlow.value,
  }));

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: beamScale.value }],
    opacity: 0.75 + (beamScale.value - 0.92) * 1.2,
  }));

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${arcRotate.value}deg` }],
  }));

  const arcSoftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-arcRotate.value * 1.2}deg` }],
  }));

  const shardOrbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shardOrbit.value}deg` }],
  }));

  const shardOrbitReverseStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-shardOrbit.value * 0.8}deg` }],
  }));

  // Ambient motes data
  const staticMotes = useMemo(
    () => [
      { id: 'm0', x: 28, y: 35, size: 2.5, opacity: 0.45 },
      { id: 'm1', x: 65, y: 70, size: 2, opacity: 0.3 },
      { id: 'm2', x: 220, y: 45, size: 3, opacity: 0.5 },
      { id: 'm3', x: 250, y: 110, size: 2.2, opacity: 0.35 },
      { id: 'm4', x: 45, y: 195, size: 2.8, opacity: 0.4 },
      { id: 'm5', x: 235, y: 220, size: 3.2, opacity: 0.55 },
      { id: 'm6', x: 130, y: 25, size: 2, opacity: 0.25 },
      { id: 'm7', x: 160, y: 245, size: 2.6, opacity: 0.4 },
    ],
    []
  );

  const satellites = useMemo(
    () => (mode === 'building' ? BUILDING_SATELLITES : UNDERSTANDING_SATELLITES),
    [mode]
  );

  return (
    <View style={[styles.container, mode === 'building' && styles.containerBuilding]}>
      {/* 1. Ambient Floating Motes (From former forge) */}
      {staticMotes.map((mote) => (
        <View
          key={mote.id}
          style={[
            styles.mote,
            {
              left: mote.x,
              top: mote.y,
              width: mote.size,
              height: mote.size,
              borderRadius: mote.size / 2,
              opacity: mote.opacity,
            },
          ]}
        />
      ))}

      {/* 2. Revolving Orbital Satellite Cards */}
      {satellites.map((sat, index) => (
        <OrbitalSatellite
          key={sat.id}
          satellite={sat}
          index={index}
          total={satellites.length}
          orbitAngle={orbitAngle}
          radiusX={mode === 'building' ? 128 : 124}
          radiusY={mode === 'building' ? 90 : 86}
        />
      ))}

      {/* 3. Centerpiece Stage */}
      <View style={styles.orbCenterStage}>
        {/* Layered Energy Halos (From former forge) */}
        <Animated.View style={[styles.haloOuter, pulseStyle]} pointerEvents="none" />
        <Animated.View style={[styles.haloMid, pulseStyle]} pointerEvents="none" />
        <Animated.View style={[styles.coreBloom, pulseStyle]} pointerEvents="none" />

        {/* Vertical Ascending Energy Conduit Beam (From former forge) */}
        <Animated.View style={[styles.beamWrap, beamStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(103, 232, 249, 0)', 'rgba(103, 232, 249, 0.28)', 'rgba(103, 232, 249, 0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.beamWide}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.75)', 'rgba(255, 255, 255, 0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.beamNarrow}
          />
        </Animated.View>

        {/* Horizontal Specular Refraction Cross Light (From former forge) */}
        <Animated.View style={[styles.crossLightWrap, pulseStyle]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(216, 180, 254, 0)', 'rgba(216, 180, 254, 0.55)', 'rgba(216, 180, 254, 0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.crossLight}
          />
        </Animated.View>

        {/* Plasma Energy Arcs (From former forge) */}
        <Animated.View style={[styles.energyArcWrap, arcStyle]} pointerEvents="none">
          <View style={styles.energyArc} />
        </Animated.View>
        <Animated.View style={[styles.energyArcWrap, arcSoftStyle]} pointerEvents="none">
          <View style={styles.energyArcSoft} />
        </Animated.View>

        {/* Orbiting Crystal Shards Layer 1 (From former forge) */}
        <Animated.View style={[styles.shardOrbitLayer, shardOrbitStyle]} pointerEvents="none">
          <View style={[styles.shard, styles.shard1]} />
          <View style={[styles.shard, styles.shard2]} />
          <View style={[styles.shard, styles.shard3]} />
        </Animated.View>

        {/* Orbiting Crystal Shards Layer 2 (From former forge) */}
        <Animated.View style={[styles.shardOrbitLayer, shardOrbitReverseStyle]} pointerEvents="none">
          <View style={[styles.shard, styles.shard4]} />
          <View style={[styles.shard, styles.shard5]} />
        </Animated.View>

        {/* Gyroscopic Orbital Ring 2 (Counter-rotating) */}
        <Animated.View style={[styles.ringLayer, spinReverseStyle]} pointerEvents="none">
          <Svg width={ORB_SIZE} height={ORB_SIZE} viewBox="0 0 200 200">
            <Defs>
              <SvgGradient id="ringGrad2" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
                <Stop offset="40%" stopColor="#A855F7" stopOpacity="0.3" />
                <Stop offset="70%" stopColor="#22D3EE" stopOpacity="0.75" />
                <Stop offset="100%" stopColor="#C084FC" stopOpacity="0.1" />
              </SvgGradient>
            </Defs>
            <G transform="rotate(-35 100 100)">
              <Path
                d="M 100 22 A 78 46 0 1 0 100 178 A 78 46 0 1 0 100 22"
                fill="none"
                stroke="url(#ringGrad2)"
                strokeWidth="1.8"
              />
              <Circle cx="170" cy="92" r="2.8" fill="#67E8F9" />
              <Circle cx="30" cy="108" r="2" fill="#E9D5FF" />
            </G>
          </Svg>
        </Animated.View>

        {/* Gyroscopic Orbital Ring 1 (Forward rotating) */}
        <Animated.View style={[styles.ringLayer, spinStyle]} pointerEvents="none">
          <Svg width={ORB_SIZE} height={ORB_SIZE} viewBox="0 0 200 200">
            <Defs>
              <SvgGradient id="ringGrad1" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#E9D5FF" stopOpacity="0.95" />
                <Stop offset="30%" stopColor="#818CF8" stopOpacity="0.6" />
                <Stop offset="65%" stopColor="#38BDF8" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#A855F7" stopOpacity="0.2" />
              </SvgGradient>
              <SvgGradient id="ringGradInner" x1="1" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#F472B6" stopOpacity="0.7" />
                <Stop offset="50%" stopColor="#C084FC" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#38BDF8" stopOpacity="0.7" />
              </SvgGradient>
            </Defs>
            <G transform="rotate(28 100 100)">
              <Path
                d="M 100 14 A 86 52 0 1 0 100 186 A 86 52 0 1 0 100 14"
                fill="none"
                stroke="url(#ringGrad1)"
                strokeWidth="2.2"
              />
              <Path
                d="M 100 38 A 62 38 0 1 0 100 162 A 62 38 0 1 0 100 38"
                fill="none"
                stroke="url(#ringGradInner)"
                strokeWidth="1.2"
                strokeDasharray="4 4"
              />
              <Circle cx="184" cy="98" r="3.2" fill="#FFFFFF" />
              <Circle cx="16" cy="102" r="2.5" fill="#38BDF8" />
              <Circle cx="100" cy="14" r="2" fill="#E879F9" />
            </G>
          </Svg>
        </Animated.View>

        {/* Central Faceted Glowing Octahedron Crystal */}
        <Animated.View style={[styles.crystalContainer, pulseStyle]}>
          <Svg width={110} height={130} viewBox="0 0 110 130">
            <Defs>
              {/* Facet gradients */}
              <SvgGradient id="facetTopLeft" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#E9D5FF" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#A855F7" stopOpacity="0.85" />
              </SvgGradient>

              <SvgGradient id="facetTopRight" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
                <Stop offset="60%" stopColor="#C084FC" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#7E22CE" stopOpacity="0.8" />
              </SvgGradient>

              <SvgGradient id="facetTopCenter" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#F5D0FE" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#9333EA" stopOpacity="0.95" />
              </SvgGradient>

              <SvgGradient id="facetBottomLeft" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#9333EA" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#581C87" stopOpacity="0.9" />
              </SvgGradient>

              <SvgGradient id="facetBottomRight" x1="1" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#7E22CE" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#3B0764" stopOpacity="0.95" />
              </SvgGradient>

              <SvgGradient id="facetBottomCenter" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#A855F7" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#4A044E" stopOpacity="0.95" />
              </SvgGradient>

              <RadialGradient id="coreSpecular" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                <Stop offset="30%" stopColor="#F0ABFC" stopOpacity="0.8" />
                <Stop offset="70%" stopColor="#A855F7" stopOpacity="0.25" />
                <Stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Upper Pyramids */}
            <Polygon points="55,6 14,62 38,68" fill="url(#facetTopLeft)" />
            <Polygon points="55,6 38,68 55,72" fill="url(#facetTopCenter)" />
            <Polygon points="55,6 55,72 72,68" fill="url(#facetTopRight)" />
            <Polygon points="55,6 72,68 96,62" fill="url(#facetTopRight)" />

            {/* Lower Inverted Pyramids */}
            <Polygon points="14,62 38,68 55,124" fill="url(#facetBottomLeft)" />
            <Polygon points="38,68 55,72 55,124" fill="url(#facetBottomCenter)" />
            <Polygon points="55,72 72,68 55,124" fill="url(#facetBottomCenter)" />
            <Polygon points="72,68 96,62 55,124" fill="url(#facetBottomRight)" />

            {/* Refraction edge lines */}
            <Path
              d="M 55 6 L 14 62 L 55 124 L 96 62 Z"
              fill="none"
              stroke="#E9D5FF"
              strokeWidth="0.8"
              strokeOpacity="0.7"
            />
            <Path
              d="M 55 6 L 55 72 L 55 124"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1"
              strokeOpacity="0.85"
            />
            <Path
              d="M 14 62 L 38 68 L 55 72 L 72 68 L 96 62"
              fill="none"
              stroke="#F5D0FE"
              strokeWidth="0.9"
              strokeOpacity="0.7"
            />

            {/* Bright Center Specular Star Flare */}
            <Circle cx="55" cy="62" r="28" fill="url(#coreSpecular)" />
            <Path
              d="M 55 46 Q 55 62 68 62 Q 55 62 55 78 Q 55 62 42 62 Q 55 62 55 46 Z"
              fill="#FFFFFF"
            />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  mote: {
    position: 'absolute',
    backgroundColor: '#67E8F9',
    shadowColor: '#67E8F9',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 1,
  },
  orbCenterStage: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  haloMid: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
    shadowColor: '#A855F7',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  coreBloom: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(216, 180, 254, 0.22)',
    shadowColor: '#D8B4FE',
    shadowOpacity: 0.85,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  beamWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    height: 250,
  },
  beamWide: {
    position: 'absolute',
    width: 74,
    height: 240,
    borderRadius: 37,
  },
  beamNarrow: {
    position: 'absolute',
    width: 14,
    height: 220,
    borderRadius: 7,
  },
  crossLightWrap: {
    position: 'absolute',
    width: 210,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossLight: {
    width: 210,
    height: 38,
    borderRadius: 19,
  },
  energyArcWrap: {
    position: 'absolute',
    width: 190,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyArc: {
    width: 190,
    height: 140,
    borderRadius: 95,
    borderWidth: 1.2,
    borderColor: 'rgba(103, 232, 249, 0.28)',
  },
  energyArcSoft: {
    width: 172,
    height: 122,
    borderRadius: 86,
    borderWidth: 1,
    borderColor: 'rgba(216, 180, 254, 0.25)',
  },
  shardOrbitLayer: {
    position: 'absolute',
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shard: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(216, 180, 254, 0.28)',
    borderColor: 'rgba(216, 180, 254, 0.65)',
    shadowColor: '#C084FC',
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  shard1: {
    width: 22,
    height: 8,
    top: 26,
    left: 45,
    transform: [{ rotate: '15deg' }],
  },
  shard2: {
    width: 16,
    height: 7,
    bottom: 30,
    right: 38,
    transform: [{ rotate: '-25deg' }],
  },
  shard3: {
    width: 14,
    height: 6,
    top: 90,
    right: 14,
    transform: [{ rotate: '45deg' }],
  },
  shard4: {
    width: 20,
    height: 7,
    bottom: 50,
    left: 22,
    transform: [{ rotate: '-35deg' }],
    backgroundColor: 'rgba(103, 232, 249, 0.28)',
    borderColor: 'rgba(103, 232, 249, 0.65)',
    shadowColor: '#67E8F9',
  },
  shard5: {
    width: 15,
    height: 6,
    top: 40,
    right: 55,
    transform: [{ rotate: '30deg' }],
    backgroundColor: 'rgba(103, 232, 249, 0.25)',
    borderColor: 'rgba(103, 232, 249, 0.55)',
    shadowColor: '#67E8F9',
  },
  ringLayer: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crystalContainer: {
    width: 110,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C084FC',
    shadowOpacity: 0.9,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 10,
  },
  orbitingBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 86,
    top: '50%',
    left: '50%',
    marginTop: -35,
    marginLeft: -43,
  },
  containerBuilding: {
    height: 290,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 24, 48, 0.76)',
    borderWidth: 1.2,
    borderColor: 'rgba(103, 232, 249, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  satLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});
