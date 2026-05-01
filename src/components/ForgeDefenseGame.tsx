import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ForgeDefenseGameProps {
  prompt: string;
  activeStep: number;
  labsMode: boolean;
  onCancel: () => void;
  onMinimize: () => void;
  generationSteps: { icon: string; text: string }[];
  cookingStatusLines: string[];
}

const FRAME_MS = 1000 / 24;
const STATUS_EMOJIS = ['✦', '◈', '✧', '⬢', '✺', '◉'];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const ForgeDefenseGame: React.FC<ForgeDefenseGameProps> = ({
  prompt,
  activeStep,
  labsMode,
  onCancel,
  onMinimize,
  generationSteps,
  cookingStatusLines,
}) => {
  const insets = useSafeAreaInsets();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((current) => current + 1);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, []);

  const bottomBarReserve = 174 + Math.max(insets.bottom, 16);
  const stageHeight = Math.max(SCREEN_HEIGHT - insets.top - bottomBarReserve - 62, 360);
  const stageWidth = SCREEN_WIDTH - 16;
  const time = frame / 24;

  const warm = labsMode ? '#4CFFB8' : '#FFB45E';
  const warmSoft = labsMode ? '#A6FFE0' : '#FFE3AF';
  const cold = labsMode ? '#86FFF6' : '#99D8FF';
  const inkTop = labsMode ? '#04110E' : '#080C16';
  const inkMid = labsMode ? '#09161A' : '#10192B';
  const inkBottom = labsMode ? '#04070F' : '#070B14';

  const progress = clamp(28 + activeStep * 18 + Math.sin(time * 0.7) * 5, 14, 96);
  const energy = clamp(56 + activeStep * 10 + Math.sin(time * 1.2) * 14, 30, 98);
  const beamScale = 0.92 + (Math.sin(time * 2.2) + 1) * 0.09;
  const haloScale = 0.9 + (Math.sin(time * 1.7) + 1) * 0.1;

  const centerX = stageWidth * 0.5;
  const centerY = stageHeight * 0.42;

  const motes = useMemo(
    () =>
      Array.from({ length: 12 }, (_, idx) => ({
        id: `mote-${idx}`,
        x: 22 + (((time * (0.045 + idx * 0.002)) + idx * 0.11) % 1) * (stageWidth - 44),
        y: 42 + ((idx * 37) % Math.max(stageHeight - 130, 1)),
        size: 2 + (idx % 3),
        opacity: 0.08 + (idx % 4) * 0.05,
      })),
    [stageHeight, stageWidth, time]
  );

  const shards = useMemo(
    () =>
      Array.from({ length: 5 }, (_, idx) => {
        const angle = time * (0.7 + idx * 0.04) + idx * 0.9;
        const radiusX = 76 + (idx % 3) * 20;
        const radiusY = 36 + (idx % 2) * 18;
        return {
          id: `shard-${idx}`,
          x: centerX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle * 1.15) * radiusY,
          width: 24 + (idx % 2) * 22,
          height: 10 + (idx % 3) * 5,
          rotate: `${Math.sin(angle) * 26}deg`,
          active: idx < 2 + activeStep,
        };
      }),
    [activeStep, centerX, centerY, time]
  );

  const pillars = useMemo(
    () =>
      Array.from({ length: 3 }, (_, idx) => ({
        id: `pillar-${idx}`,
        left: stageWidth * 0.18 + idx * stageWidth * 0.2,
        height: 180 + idx * 28,
        opacity: idx === 1 ? 0.1 : 0.05,
      })),
    [stageWidth]
  );

  const guideSpokes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, idx) => ({
        id: `spoke-${idx}`,
        rotate: `${idx * 30 - 75}deg`,
      })),
    []
  );

  const phaseTitle = activeStep === 0
    ? 'Forging your world'
    : activeStep === 1
      ? 'Assembling the systems'
      : activeStep === 2
        ? 'Shaping the feel'
        : 'Finishing the magic';

  const stepChip = activeStep === 0
    ? 'World layout'
    : activeStep === 1
      ? 'Rules and loops'
      : activeStep === 2
        ? 'Camera and feel'
        : 'Polish pass';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={[inkTop, inkMid, inkBottom]} style={StyleSheet.absoluteFillObject} />

      <Animated.View entering={FadeIn.duration(240)} style={styles.header}>
        <Pressable style={styles.closeBtn} onPressIn={onCancel}>
          <Ionicons name="close" size={20} color="#FFF" />
        </Pressable>
        <View style={[styles.headerChip, labsMode && styles.headerChipLabs]}>
          <Ionicons name="sparkles" size={14} color={warm} />
          <Text style={[styles.headerChipText, labsMode && styles.headerChipTextLabs]}>
            {labsMode ? 'Labs Forge' : 'Dream Forge'}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      <View style={[styles.stage, { height: stageHeight }]}>
        <LinearGradient
          colors={labsMode ? ['#0E211B', '#0B121A'] : ['#111B30', '#0B111C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.015)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.stageShell}
        />

        <LinearGradient
          colors={['rgba(0,0,0,0.34)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.42)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.stageVignette}
        />

        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.leftAtmosphere}
        />

        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.topAtmosphere}
        />

        <LinearGradient
          colors={['rgba(255,180,96,0)', 'rgba(255,180,96,0.06)', 'rgba(255,180,96,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.centerGlow}
        />

        <View style={styles.horizonLine} />
        <View style={styles.horizonGlow} />
        <View style={styles.forgeRingLarge} />
        <View style={styles.forgeRingMid} />

        {guideSpokes.map((spoke) => (
          <View
            key={spoke.id}
            style={[
              styles.guideSpoke,
              {
                left: centerX - stageWidth * 0.36,
                top: centerY - 2,
                transform: [{ rotate: spoke.rotate }],
              },
            ]}
          />
        ))}

        {pillars.map((pillar) => (
          <View
            key={pillar.id}
            style={[
              styles.depthPillar,
              {
                left: pillar.left,
                height: pillar.height,
                opacity: pillar.opacity,
              },
            ]}
          />
        ))}

        <View
          style={[
            styles.haloOuter,
            {
              left: centerX - 122,
              top: centerY - 118,
              backgroundColor: `${cold}20`,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
        <View
          style={[
            styles.haloMid,
            {
              left: centerX - 78,
              top: centerY - 78,
              backgroundColor: `${warm}32`,
              transform: [{ scale: haloScale }],
            },
          ]}
        />

        <View
          style={[
            styles.coreBloom,
            {
              left: centerX - 96,
              top: centerY - 94,
              backgroundColor: `${warmSoft}22`,
              opacity: 0.7 + Math.sin(time * 1.8) * 0.08,
              transform: [{ scale: 0.96 + Math.sin(time * 1.6) * 0.04 }],
            },
          ]}
        />

        <LinearGradient
          colors={['rgba(255,255,255,0)', `${cold}7F`, 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[
            styles.beam,
            {
              left: centerX - 58,
              top: centerY - 136,
              opacity: beamScale,
              transform: [{ scale: beamScale }],
            },
          ]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[
            styles.beamCore,
            {
              left: centerX - 9,
              top: centerY - 132,
              opacity: 0.82 + Math.sin(time * 2.1) * 0.08,
              transform: [{ scaleY: beamScale }],
            },
          ]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0)', `${warmSoft}72`, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.crossLight,
            {
              left: centerX - 116,
              top: centerY - 26,
              opacity: 0.82 + Math.sin(time * 2.4) * 0.1,
            },
          ]}
        />

        <View style={[styles.corePlate, { left: centerX - 72, top: centerY - 54 }]} />
        <View style={[styles.corePlateInner, { left: centerX - 50, top: centerY - 34 }]} />
        <View style={[styles.coreNode, { left: centerX - 12, top: centerY - 14 }]} />
        <View
          style={[
            styles.energyArc,
            {
              left: centerX - 108,
              top: centerY - 76,
              transform: [{ rotate: `${Math.sin(time * 0.9) * 6}deg` }],
            },
          ]}
        />
        <View
          style={[
            styles.energyArcSoft,
            {
              left: centerX - 96,
              top: centerY - 66,
              transform: [{ rotate: `${-8 + Math.sin(time * 1.1) * 4}deg` }],
            },
          ]}
        />

        {shards.map((shard) => (
          <View
            key={shard.id}
            style={[
              styles.shard,
              {
                left: shard.x,
                top: shard.y,
                width: shard.width,
                height: shard.height,
                transform: [{ rotate: shard.rotate }],
                backgroundColor: shard.active ? 'rgba(255,227,175,0.22)' : 'rgba(255,255,255,0.08)',
                borderColor: shard.active ? 'rgba(255,227,175,0.5)' : 'rgba(255,255,255,0.12)',
                opacity: shard.active ? 0.95 : 0.55,
              },
            ]}
          />
        ))}

        {motes.map((mote) => (
          <View
            key={mote.id}
            style={[
              styles.mote,
              {
                left: mote.x,
                top: mote.y,
                width: mote.size,
                height: mote.size,
                borderRadius: mote.size,
                opacity: mote.opacity,
              },
            ]}
          />
        ))}

        <View style={styles.copyWrap}>
          <Text style={styles.kicker}>GAME WORLD IN PROGRESS</Text>
          <Text style={styles.title}>{phaseTitle}</Text>
          <Text style={styles.subtitle}>
            Geometry, motion, audio, and feel are being fused into one playable world.
          </Text>
        </View>

        <View style={styles.progressPanel}>
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.progressPanelSheen}
          />
          <View style={styles.panelTopRow}>
            <View>
              <Text style={styles.panelLabel}>ASSEMBLY PROGRESS</Text>
              <Text style={styles.panelHeadline}>{Math.round(progress)}% complete</Text>
            </View>
            <View style={styles.panelChip}>
              <Text style={styles.panelChipText}>{stepChip}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[warm, warmSoft]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <View style={styles.energyRow}>
            <Text style={styles.energyLabel}>Forge energy</Text>
            <View style={styles.energyMeter}>
              <View style={[styles.progressFillSoft, { width: `${energy}%`, backgroundColor: cold }]} />
            </View>
            <Text style={styles.energyValue}>{Math.round(energy)}%</Text>
          </View>
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot}>
            <View style={[styles.statusPulse, { shadowColor: warm }]} />
            <ActivityIndicator size="small" color={warm} />
          </View>
          <View style={styles.statusTextCol}>
            <Text style={styles.statusHeadline} numberOfLines={1}>
              {cookingStatusLines[activeStep % cookingStatusLines.length]}
            </Text>
            <Text style={styles.statusMeta} numberOfLines={1}>
              {generationSteps[activeStep]?.text || 'Finishing up...'}
            </Text>
          </View>
        </View>

        <View style={styles.promptPill}>
          <Text style={styles.promptLabel}>SPELL</Text>
          <Text style={styles.promptEmoji}>{STATUS_EMOJIS[activeStep % STATUS_EMOJIS.length]}</Text>
          <Text style={styles.promptText} numberOfLines={1}>
            {prompt.length > 58 ? `${prompt.slice(0, 58)}...` : prompt}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.cancelActionBtn, pressed && styles.pressedBtn]}
            onPressIn={onCancel}
          >
            <Ionicons name="stop-circle-outline" size={16} color="#FF7B7B" />
            <Text style={styles.cancelText}>Stop</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.minimizeBtn, pressed && styles.pressedBtn]}
            onPressIn={onMinimize}
          >
            <Ionicons name="flame" size={16} color="#000" />
            <Text style={styles.minimizeText}>Cook in background</Text>
            <Ionicons name="chevron-down" size={14} color="#666" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#08101B',
    zIndex: 99999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    zIndex: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,180,96,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,180,96,0.2)',
    gap: 6,
  },
  headerChipLabs: {
    backgroundColor: 'rgba(59,245,144,0.12)',
    borderColor: 'rgba(59,245,144,0.2)',
  },
  headerChipText: {
    color: '#FFB860',
    fontSize: 13,
    fontWeight: '800',
  },
  headerChipTextLabs: {
    color: '#3BF590',
  },
  stage: {
    borderRadius: 24,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.035)',
    backgroundColor: 'rgba(0,0,0,0.14)',
    shadowColor: '#000',
    shadowOpacity: 0.26,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  stageShell: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  stageVignette: {
    ...StyleSheet.absoluteFillObject,
  },
  leftAtmosphere: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 120,
  },
  topAtmosphere: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: 160,
  },
  centerGlow: {
    position: 'absolute',
    top: 40,
    bottom: 60,
    left: 70,
    right: 70,
  },
  horizonLine: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: '58%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  horizonGlow: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: '55%',
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  forgeRingLarge: {
    position: 'absolute',
    width: 286,
    height: 286,
    borderRadius: 999,
    left: '50%',
    top: '44%',
    marginLeft: -143,
    marginTop: -143,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  forgeRingMid: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 999,
    left: '50%',
    top: '44%',
    marginLeft: -107,
    marginTop: -107,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  guideSpoke: {
    position: 'absolute',
    width: '72%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  depthPillar: {
    position: 'absolute',
    top: 58,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  haloOuter: {
    position: 'absolute',
    width: 248,
    height: 248,
    borderRadius: 999,
  },
  haloMid: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 999,
  },
  coreBloom: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: 999,
  },
  beam: {
    position: 'absolute',
    width: 116,
    height: 272,
    borderRadius: 58,
  },
  beamCore: {
    position: 'absolute',
    width: 18,
    height: 264,
    borderRadius: 12,
  },
  crossLight: {
    position: 'absolute',
    width: 232,
    height: 52,
    borderRadius: 30,
  },
  corePlate: {
    position: 'absolute',
    width: 144,
    height: 108,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  corePlateInner: {
    position: 'absolute',
    width: 100,
    height: 68,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  coreNode: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,224,161,0.9)',
    shadowColor: '#FFD27D',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  energyArc: {
    position: 'absolute',
    width: 216,
    height: 152,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(153,216,255,0.18)',
  },
  energyArcSoft: {
    position: 'absolute',
    width: 192,
    height: 132,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,228,176,0.12)',
  },
  shard: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  mote: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  copyWrap: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: 46,
    alignItems: 'center',
  },
  kicker: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 272,
  },
  progressPanel: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 38,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(6,9,15,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressPanelSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  panelTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  panelLabel: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  panelHeadline: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  panelChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  panelChipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  energyLabel: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 11,
    fontWeight: '700',
  },
  energyMeter: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFillSoft: {
    height: '100%',
    borderRadius: 999,
  },
  energyValue: {
    color: '#DDF4FF',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  statusDot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  statusPulse: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,180,96,0.25)',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  statusTextCol: {
    flex: 1,
  },
  statusHeadline: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  statusMeta: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  promptLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  promptEmoji: {
    fontSize: 14,
  },
  promptText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  cancelActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,123,123,0.35)',
    backgroundColor: 'rgba(75,16,14,0.35)',
  },
  cancelText: {
    color: '#FFB2B2',
    fontSize: 14,
    fontWeight: '800',
  },
  minimizeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4F1EC',
  },
  minimizeText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
  },
  pressedBtn: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
