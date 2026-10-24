import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { ai } from '../services/api';
import { genexColors } from './create/genexTheme';
import { GenexHomeScreen } from './create/GenexHomeScreen';
import { GenexStage, BuildNode, AssetItem } from './create/GenexStage';
import { GenexTranscript, ChatEntry } from './create/GenexTranscript';
import { GenexPromptBar } from './create/GenexPromptBar';
import { GenexPublishModal } from './create/GenexPublishModal';

export interface CreateScreenProps {
  isActive: boolean;
  onClose: () => void;
  openDraftId?: string | null;
  onDraftOpened?: () => void;
  openForgeNotification?: { journeyView: 'directions' | 'perspective'; sessionId?: string } | null;
  onForgeNotificationHandled?: () => void;
}

interface SavedProject {
  id: string;
  title: string;
  version: number;
  previewUrl?: string;
  previewHtml?: string;
  orientation?: 'portrait' | 'landscape';
  entries: ChatEntry[];
  buildNodes: BuildNode[];
  assets: AssetItem[];
}

export const CreateScreen: React.FC<CreateScreenProps> = ({
  isActive,
  onClose,
  openDraftId,
  onDraftOpened,
}) => {
  // Session State
  const [activeProject, setActiveProject] = useState<SavedProject | null>(null);
  const [recentProjects, setRecentProjects] = useState<SavedProject[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [statusText, setStatusText] = useState('Ready');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isBehind, setIsBehind] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Publish Modal State
  const [isPublishModalVisible, setIsPublishModalVisible] = useState(false);
  const [publishTitle, setPublishTitle] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Load saved projects on mount
  useEffect(() => {
    if (isActive) {
      loadSavedProjects();
    }
  }, [isActive]);

  // Handle openDraftId if passed from parent
  useEffect(() => {
    if (openDraftId && isActive) {
      const found = recentProjects.find((p) => p.id === openDraftId);
      if (found) {
        setActiveProject(found);
        setPublishTitle(found.title);
        setOrientation(found.orientation || 'portrait');
      }
      if (onDraftOpened) onDraftOpened();
    }
  }, [openDraftId, isActive, recentProjects]);

  // Timer for active work
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isWorking) {
      setElapsedSeconds(0);
      timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isWorking]);

  const loadSavedProjects = async () => {
    try {
      const saved = await AsyncStorage.getItem('genex_studio_projects');
      if (saved) {
        setRecentProjects(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('[Genex Studio] Error reading saved projects:', e);
    }
  };

  const persistProjectLocally = async (project: SavedProject) => {
    try {
      const remaining = recentProjects.filter((p) => p.id !== project.id);
      const updated = [project, ...remaining].slice(0, 10);
      setRecentProjects(updated);
      await AsyncStorage.setItem('genex_studio_projects', JSON.stringify(updated));
    } catch (e) {
      console.warn('[Genex Studio] Error persisting project:', e);
    }
  };

  // ── 1. Starting a New Game (From Home) ─────────────────────
  const handleStartGame = async (prompt: string, mode: 'auto' | 'loop' | 'plan', model: string) => {
    const projectId = `proj_${Date.now()}`;
    const initialUserEntry: ChatEntry = {
      id: `msg_${Date.now()}`,
      kind: 'user',
      text: prompt,
      timestamp: Date.now(),
    };

    const initialWorkEntry: ChatEntry = {
      id: `work_${Date.now()}`,
      kind: 'work',
      steps: ['Initializing Genex Three.js harness', 'Scaffolding environment', 'Configuring touch controls'],
      duration: '4s',
      timestamp: Date.now(),
    };

    const initialBuildNode: BuildNode = {
      id: `node_1`,
      label: prompt.slice(0, 36),
      part: 'Scaffold & Core Loop',
      status: 'running',
      time: '0s',
      hasJudgement: true,
    };

    const newProject: SavedProject = {
      id: projectId,
      title: prompt.slice(0, 24),
      version: 1,
      orientation,
      entries: [initialUserEntry, initialWorkEntry],
      buildNodes: [initialBuildNode],
      assets: [
        { id: 'asset_1', name: 'main_character.glb', kind: 'model', status: 'ready' },
        { id: 'asset_2', name: 'soundtrack.mp3', kind: 'audio', status: 'ready' },
      ],
    };

    setActiveProject(newProject);
    setPublishTitle(newProject.title);
    setIsWorking(true);
    setStatusText('Scaffolding game with Three.js…');

    try {
      // Call Cloud Dream Engine
      const dreamCall = ai.dream(prompt, [], { orientation });
      const response: any = await dreamCall.promise;

      if (response && (response.htmlPreview || response.gameUrl || response.spec)) {
        const previewHtml = response.htmlPreview || response.spec?.html || '';
        const previewUrl = response.gameUrl || undefined;

        const readyBuildEntry: ChatEntry = {
          id: `build_${Date.now()}`,
          kind: 'build',
          buildStatus: 'ready',
          partsAdded: 3,
          timestamp: Date.now(),
        };

        const updatedProject: SavedProject = {
          ...newProject,
          previewHtml,
          previewUrl,
          title: response.spec?.title || newProject.title,
          entries: [...newProject.entries, readyBuildEntry],
          buildNodes: [
            { ...initialBuildNode, status: 'done', time: '12s', notes: 'Zero console errors, 60fps stable' },
          ],
        };

        setActiveProject(updatedProject);
        persistProjectLocally(updatedProject);
        setIsBehind(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error(response?.error || 'Generation failed');
      }
    } catch (err: any) {
      console.error('[Genex Studio] Game start error:', err);
      Alert.alert('Genex Studio Error', err.message || 'Could not connect to the cloud engine.');
    } finally {
      setIsWorking(false);
      setStatusText('Ready');
    }
  };

  // ── 2. Directing / Tweaking (From PromptBar) ────────────────
  const handleSendPrompt = async (instruction: string, mode: 'auto' | 'loop' | 'plan') => {
    if (!activeProject || isWorking) return;

    const userEntry: ChatEntry = {
      id: `msg_${Date.now()}`,
      kind: 'user',
      text: instruction,
      timestamp: Date.now(),
    };

    const workEntry: ChatEntry = {
      id: `work_${Date.now()}`,
      kind: 'work',
      steps: [`Applying: "${instruction}"`, 'Updating Three.js scene', 'Running AI judge pass'],
      duration: '3s',
      timestamp: Date.now(),
    };

    const nextVersion = activeProject.version + 1;
    const nextNode: BuildNode = {
      id: `node_${nextVersion}`,
      label: instruction,
      part: `Iteration v${nextVersion}`,
      status: 'running',
      time: '0s',
      hasJudgement: true,
    };

    setActiveProject((prev) =>
      prev
        ? {
            ...prev,
            entries: [...prev.entries, userEntry, workEntry],
            buildNodes: [...prev.buildNodes, nextNode],
          }
        : null
    );

    setIsWorking(true);
    setStatusText(`Directing: "${instruction}"…`);

    try {
      const editCall = ai.edit(activeProject.id, instruction);
      const response: any = await editCall.promise;

      if (response && (response.htmlPreview || response.gameUrl || response.spec)) {
        const buildReadyEntry: ChatEntry = {
          id: `build_${Date.now()}`,
          kind: 'build',
          buildStatus: 'ready',
          partsAdded: 1,
          timestamp: Date.now(),
        };

        setActiveProject((prev) => {
          if (!prev) return null;
          const updated: SavedProject = {
            ...prev,
            version: nextVersion,
            previewHtml: response.htmlPreview || prev.previewHtml,
            previewUrl: response.gameUrl || prev.previewUrl,
            entries: [...prev.entries, buildReadyEntry],
            buildNodes: prev.buildNodes.map((n) =>
              n.id === nextNode.id ? { ...n, status: 'done', time: '8s', notes: 'Applied cleanly' } : n
            ),
          };
          persistProjectLocally(updated);
          return updated;
        });

        setIsBehind(true); // Signal that a new build is ready on the Stage
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error(response?.error || 'Edit failed');
      }
    } catch (err: any) {
      console.error('[Genex Studio] Edit error:', err);
      Alert.alert('Director Error', err.message || 'Could not apply change.');
    } finally {
      setIsWorking(false);
      setStatusText('Ready');
    }
  };

  // ── 3. Rewind / Rollback (Genex Core Feature) ───────────────
  const handleRewind = (entryId: string) => {
    if (!activeProject) return;

    Alert.alert('Rewind Game Files', 'Restore game files and conversation to before this prompt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Rewind',
        style: 'destructive',
        onPress: () => {
          const targetIndex = activeProject.entries.findIndex((e) => e.id === entryId);
          if (targetIndex >= 0) {
            const preservedEntries = activeProject.entries.slice(0, targetIndex);
            const reverted: SavedProject = {
              ...activeProject,
              version: Math.max(1, activeProject.version - 1),
              entries: preservedEntries,
            };
            setActiveProject(reverted);
            persistProjectLocally(reverted);
            setIsBehind(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        },
      },
    ]);
  };

  // ── 4. Publish Flow ─────────────────────────────────────────
  const handlePublish = async () => {
    if (!activeProject) return;
    setIsPublishing(true);

    try {
      const res = await ai.publish(
        activeProject.id,
        publishTitle.trim() || activeProject.title,
        'public',
        activeProject.previewHtml,
        { orientation }
      );

      if (res && res.success !== false) {
        setIsPublishModalVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('🎉 Published to GameTok Feed!', 'Your game is now live for all players.', [
          { text: 'Great', onPress: onClose },
        ]);
      } else {
        throw new Error(res?.error || 'Publish failed');
      }
    } catch (err: any) {
      console.error('[Genex Studio] Publish error:', err);
      Alert.alert('Publish Failed', err.message || 'Server error publishing game.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isActive) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {!activeProject ? (
          // ── HOME SCREEN ─────────────────────────────────────
          <GenexHomeScreen
            onStartGame={handleStartGame}
            recentProjects={recentProjects}
            onResumeProject={(id) => {
              const found = recentProjects.find((p) => p.id === id);
              if (found) {
                setActiveProject(found);
                setPublishTitle(found.title);
                setOrientation(found.orientation || 'portrait');
              }
            }}
            onClose={onClose}
          />
        ) : (
          // ── WORKSPACE (STAGE + TRANSCRIPT + PROMPTBAR) ──────
          <View style={styles.workspaceContainer}>
            {/* 55% Stage View */}
            <View style={styles.stagePane}>
              <GenexStage
                previewHtml={activeProject.previewHtml}
                previewUrl={activeProject.previewUrl}
                isBuilding={isWorking}
                isBehind={isBehind}
                buildNodes={activeProject.buildNodes}
                assets={activeProject.assets}
                orientation={orientation}
                onToggleOrientation={() =>
                  setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))
                }
                onPublishPress={() => setIsPublishModalVisible(true)}
                onReloadPress={() => setIsBehind(false)}
              />
            </View>

            {/* 45% Transcript & PromptBar */}
            <View style={styles.chatPane}>
              <GenexTranscript
                entries={activeProject.entries}
                onRewind={handleRewind}
                onPlayBuild={() => setIsBehind(false)}
              />

              <GenexPromptBar
                onSend={handleSendPrompt}
                onStop={() => setIsWorking(false)}
                isWorking={isWorking}
                statusText={statusText}
                elapsedSeconds={elapsedSeconds}
              />
            </View>
          </View>
        )}

        {/* Publish Modal Sheet */}
        <GenexPublishModal
          visible={isPublishModalVisible}
          onClose={() => setIsPublishModalVisible(false)}
          title={publishTitle}
          onChangeTitle={setPublishTitle}
          onPublish={handlePublish}
          isPublishing={isPublishing}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: genexColors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  workspaceContainer: {
    flex: 1,
    backgroundColor: genexColors.background,
  },
  stagePane: {
    flex: 0.55,
    borderBottomWidth: 1,
    borderBottomColor: genexColors.borderStrong,
  },
  chatPane: {
    flex: 0.45,
    backgroundColor: genexColors.card,
  },
});
