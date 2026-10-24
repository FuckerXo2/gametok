import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { genexColors, genexRadii, genexSpacing } from './genexTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type StageTab = 'live' | 'builds' | 'assets';

export interface BuildNode {
  id: string;
  label: string;
  part: string;
  status: 'done' | 'running' | 'failed';
  time: string;
  notes?: string;
  hasJudgement?: boolean;
}

export interface AssetItem {
  id: string;
  name: string;
  kind: 'model' | 'audio' | 'texture';
  url?: string;
  status: 'ready' | 'generating';
}

interface GenexStageProps {
  previewHtml?: string;
  previewUrl?: string;
  isBuilding: boolean;
  isBehind: boolean; // True when agent has created a newer build waiting to be reloaded
  buildNodes: BuildNode[];
  assets: AssetItem[];
  orientation: 'portrait' | 'landscape';
  onToggleOrientation: () => void;
  onPublishPress: () => void;
  onReloadPress: () => void;
}

export const GenexStage: React.FC<GenexStageProps> = ({
  previewHtml,
  previewUrl,
  isBuilding,
  isBehind,
  buildNodes,
  assets,
  orientation,
  onToggleOrientation,
  onPublishPress,
  onReloadPress,
}) => {
  const [activeTab, setActiveTab] = useState<StageTab>('live');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const webViewRef = useRef<WebView>(null);

  const handleReload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    webViewRef.current?.reload();
    onReloadPress();
  };

  const handleTogglePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPlaying((prev) => !prev);
    // Injects pause/play to Three.js clock if supported
    webViewRef.current?.injectJavaScript(`
      if (window.__studio) {
        window.__studio.paused = ${isPlaying};
      }
      true;
    `);
  };

  return (
    <View style={styles.container}>
      {/* ── GENEX STAGE STRIP (Tabs + Toolbar) ───────────────────── */}
      <View style={styles.stageStrip}>
        {/* Stage View Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'live' && styles.tabButtonActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('live');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'live' && styles.tabTextActive]}>Live</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'builds' && styles.tabButtonActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('builds');
            }}
          >
            <View style={styles.tabWithIndicator}>
              <Text style={[styles.tabText, activeTab === 'builds' && styles.tabTextActive]}>
                Builds
              </Text>
              {isBuilding && <View style={styles.activeDot} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'assets' && styles.tabButtonActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('assets');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'assets' && styles.tabTextActive]}>
              Assets ({assets.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stage Controls */}
        <View style={styles.controlsRow}>
          {/* Reload Button (Lit with behind dot if new code is ready) */}
          <TouchableOpacity
            style={[styles.stageIconBtn, isBehind && styles.stageIconBtnBehind]}
            onPress={handleReload}
          >
            <Ionicons
              name="reload"
              size={15}
              color={isBehind ? genexColors.foreground : genexColors.mutedForeground}
            />
            {isBehind && <View style={styles.behindIndicator} />}
          </TouchableOpacity>

          {/* Play / Stop Toggle */}
          <TouchableOpacity style={styles.stageIconBtn} onPress={handleTogglePlay}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={15}
              color={genexColors.foreground}
            />
          </TouchableOpacity>

          {/* Sound Toggle */}
          <TouchableOpacity
            style={styles.stageIconBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsMuted((prev) => !prev);
            }}
          >
            <Ionicons
              name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
              size={15}
              color={genexColors.foreground}
            />
          </TouchableOpacity>

          {/* Orientation Toggle */}
          <TouchableOpacity style={styles.stageIconBtn} onPress={onToggleOrientation}>
            <Ionicons
              name={orientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'}
              size={15}
              color={genexColors.foreground}
            />
          </TouchableOpacity>

          {/* Publish Trigger */}
          <TouchableOpacity style={styles.publishBtn} onPress={onPublishPress}>
            <Text style={styles.publishBtnText}>Publish</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── STAGE SURFACES ───────────────────────────────────────── */}
      <View style={styles.stageContent}>
        {/* 1. LIVE VIEW (WebGL Canvas) */}
        {activeTab === 'live' && (
          <View style={styles.surfaceFill}>
            {previewHtml || previewUrl ? (
              <WebView
                ref={webViewRef}
                source={previewUrl ? { uri: previewUrl } : { html: previewHtml || '' }}
                style={styles.webView}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                originWhitelist={['*']}
                scalesPageToFit={false}
              />
            ) : (
              <View style={styles.emptyStageBox}>
                <ActivityIndicator size="large" color={genexColors.accentHover} />
                <Text style={styles.emptyStageText}>Connecting to Three.js Live Stage...</Text>
              </View>
            )}

            {/* Shimmering Build Banner if compiling in background */}
            {isBuilding && (
              <View style={styles.liveBuildingPill}>
                <View style={styles.pulseDot} />
                <Text style={styles.liveBuildingText}>Compiling new build in background...</Text>
              </View>
            )}
          </View>
        )}

        {/* 2. BUILDS VIEW (Genex RunGraph Timeline) */}
        {activeTab === 'builds' && (
          <ScrollView style={styles.surfaceFill} contentContainerStyle={styles.buildsScrollContent}>
            <Text style={styles.graphHeader}>Run Timeline</Text>
            {buildNodes.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No runs completed yet. Send a prompt to start.</Text>
              </View>
            ) : (
              buildNodes.map((node, index) => (
                <View key={node.id} style={styles.graphRow}>
                  {/* Step Connector Line */}
                  <View style={styles.graphTimelineCol}>
                    <View
                      style={[
                        styles.timelineDot,
                        node.status === 'done' && styles.timelineDotDone,
                        node.status === 'running' && styles.timelineDotRunning,
                      ]}
                    />
                    {index < buildNodes.length - 1 && <View style={styles.timelineLine} />}
                  </View>

                  {/* Step Card */}
                  <View style={styles.graphCard}>
                    <View style={styles.graphCardHeader}>
                      <Text style={styles.graphCardPart}>{node.part}</Text>
                      <Text style={styles.graphCardTime}>{node.time}</Text>
                    </View>
                    <Text style={styles.graphCardLabel}>{node.label}</Text>
                    {node.notes && <Text style={styles.graphCardNotes}>{node.notes}</Text>}
                    {node.hasJudgement && (
                      <View style={styles.judgeBadge}>
                        <Ionicons name="eye-outline" size={13} color={genexColors.accentHover} />
                        <Text style={styles.judgeBadgeText}>Reviewed by AI Judge</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* 3. ASSETS VIEW (Genex AssetsCanvas Inventory) */}
        {activeTab === 'assets' && (
          <ScrollView style={styles.surfaceFill} contentContainerStyle={styles.assetsScrollContent}>
            <Text style={styles.graphHeader}>Project Assets</Text>
            {assets.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>No assets in this project yet.</Text>
              </View>
            ) : (
              <View style={styles.assetsGrid}>
                {assets.map((asset) => (
                  <View key={asset.id} style={styles.assetCard}>
                    <View style={styles.assetIconThumb}>
                      <Ionicons
                        name={
                          asset.kind === 'model'
                            ? 'cube-outline'
                            : asset.kind === 'audio'
                            ? 'musical-notes-outline'
                            : 'image-outline'
                        }
                        size={22}
                        color={genexColors.foreground}
                      />
                    </View>
                    <Text style={styles.assetName} numberOfLines={1}>
                      {asset.name}
                    </Text>
                    <Text style={styles.assetKind}>{asset.kind.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: genexColors.background,
  },
  stageStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: genexSpacing.sm,
    paddingVertical: 6,
    backgroundColor: genexColors.sidebar,
    borderBottomWidth: 1,
    borderBottomColor: genexColors.border,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: genexColors.controlQuiet,
    borderRadius: genexRadii.button,
    padding: 2,
    borderWidth: 1,
    borderColor: genexColors.controlQuietEdge,
  },
  tabButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: genexRadii.sm,
  },
  tabButtonActive: {
    backgroundColor: genexColors.card,
  },
  tabText: {
    color: genexColors.mutedForeground,
    fontSize: 12,
    fontWeight: '500',
  },
  tabTextActive: {
    color: genexColors.foreground,
    fontWeight: '600',
  },
  tabWithIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: genexColors.warning,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageIconBtn: {
    width: 30,
    height: 30,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.controlQuiet,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stageIconBtnBehind: {
    backgroundColor: genexColors.accentTint,
    borderColor: genexColors.accent,
  },
  behindIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: genexColors.accentHover,
  },
  publishBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.accentFill,
  },
  publishBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stageContent: {
    flex: 1,
  },
  surfaceFill: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  emptyStageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyStageText: {
    color: genexColors.mutedForeground,
    fontSize: 13,
  },
  liveBuildingPill: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: genexRadii.pill,
    backgroundColor: 'rgba(20,20,22,0.92)',
    borderWidth: 1,
    borderColor: genexColors.accent,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: genexColors.accentHover,
  },
  liveBuildingText: {
    color: genexColors.foreground,
    fontSize: 11,
    fontWeight: '500',
  },

  // Builds Tab Styles
  buildsScrollContent: {
    padding: genexSpacing.md,
    gap: 12,
  },
  graphHeader: {
    color: genexColors.dimForeground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  graphRow: {
    flexDirection: 'row',
    gap: 12,
  },
  graphTimelineCol: {
    alignItems: 'center',
    width: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: genexColors.controlQuietEdge,
    marginTop: 6,
  },
  timelineDotDone: {
    backgroundColor: genexColors.success,
  },
  timelineDotRunning: {
    backgroundColor: genexColors.warning,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: genexColors.border,
    marginVertical: 4,
  },
  graphCard: {
    flex: 1,
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.md,
    padding: genexSpacing.md,
    borderWidth: 1,
    borderColor: genexColors.border,
    gap: 4,
  },
  graphCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  graphCardPart: {
    color: genexColors.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
  graphCardTime: {
    color: genexColors.dimForeground,
    fontSize: 11,
  },
  graphCardLabel: {
    color: genexColors.mutedForeground,
    fontSize: 12,
  },
  graphCardNotes: {
    color: genexColors.dimForeground,
    fontSize: 11,
    fontStyle: 'italic',
  },
  judgeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  judgeBadgeText: {
    color: genexColors.accentHover,
    fontSize: 11,
    fontWeight: '500',
  },

  // Assets Tab Styles
  assetsScrollContent: {
    padding: genexSpacing.md,
    gap: 12,
  },
  assetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  assetCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.md,
    padding: genexSpacing.md,
    borderWidth: 1,
    borderColor: genexColors.border,
    alignItems: 'center',
    gap: 6,
  },
  assetIconThumb: {
    width: 48,
    height: 48,
    borderRadius: genexRadii.sm,
    backgroundColor: genexColors.controlQuiet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetName: {
    color: genexColors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  assetKind: {
    color: genexColors.dimForeground,
    fontSize: 10,
    fontWeight: '700',
  },
  emptyCard: {
    padding: genexSpacing.xl,
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.md,
    alignItems: 'center',
  },
  emptyCardText: {
    color: genexColors.mutedForeground,
    fontSize: 13,
  },
});
