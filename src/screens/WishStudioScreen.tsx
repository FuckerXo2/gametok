// WishStudioScreen — where a forged brief comes to life and keeps evolving.
//
// SEQUENCE:
//   Dream Forge (CreateScreen) — user writes the brief, attaches assets, taps
//   "Forge It" → hands over { initialPrompt, initialAttachments } → THIS SCREEN.
//
// EXPERIENCE RULES (locked):
//   - Planning is a full-screen conversation. The Wish/Preview toggle does NOT
//     exist until the user taps "Create it" — before that there is nothing to
//     preview, so nothing competes with the pitch.
//   - The moment Create fires, the toggle appears and the user lands in
//     Preview, where the ForgeDefenseGame (the playable forge spinner) runs
//     until the real game replaces it.
//   - After that, one continuous thread: every wish edits the live game.
//
// Planning is composed locally today (src/services/planner.ts) — the seam
// where the live Kimi planning session plugs in later.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, radii, type as t } from '../theme/tokens';
import { WishConversation } from '../components/wish/WishConversation';
import { PreviewPane } from '../components/wish/PreviewPane';
import { StudioTabBar } from '../components/wish/StudioTabBar';
import { ForgeDefenseGame } from '../components/ForgeDefenseGame';
import { briefToPrompt } from '../services/planner';
import { ai } from '../services/api';
import type { WishMessage, StudioPhase, StudioTab, GameBrief } from '../components/wish/wishTypes';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The brief the user forged on Dream Forge. */
  initialPrompt: string;
  /** Images/Videos/Sounds/BGM they attached for the game to use. */
  initialAttachments?: any[];
  /**
   * Hand the finished game to Dream Forge's Publish Game screen (the original
   * one: live preview + privacy settings + Post Game). The studio closes and the
   * parent takes over from there.
   */
  onRequestPublish?: (game: {
    draftId: string;
    html: string | null;
    gameUrl: string | null;
    title: string;
  }) => void;
}

// Forge scene copy — same voice as Dream Forge's build screen.
const GENERATION_STEPS = [
  { icon: 'code-slash', text: 'Writing game logic...' },
  { icon: 'cube', text: 'Compiling physics engine...' },
  { icon: 'color-palette', text: 'Rendering world...' },
  { icon: 'musical-notes', text: 'Generating audio...' },
];
const COOKING_STATUS_LINES = [
  'Wizard is scribbling the game rules...',
  'Knight is keeping the forge safe...',
  'Teaching the zombies how to lose...',
  'Sanding the rough edges off the fun...',
];

let idCounter = 0;
const nextId = () => `w${++idCounter}`;

export const WishStudioScreen = ({ visible, onClose, initialPrompt, initialAttachments = [], onRequestPublish }: Props) => {
  const [tab, setTab] = useState<StudioTab>('wish');
  const [phase, setPhase] = useState<StudioPhase>('planning');
  const [messages, setMessages] = useState<WishMessage[]>([]);
  const [input, setInput] = useState('');
  const [kimiThinking, setKimiThinking] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [previewHasNews, setPreviewHasNews] = useState(false);
  // The toggle exists only after the first Create. Before that: pure conversation.
  const [hasCreated, setHasCreated] = useState(false);
  // Live job telemetry feeding the forge scene.
  const [genProgress, setGenProgress] = useState<number | null>(null);
  const [genPhase, setGenPhase] = useState<string | null>(null);
  const [genStatusMessage, setGenStatusMessage] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  const briefRef = useRef<GameBrief | null>(null);
  const refinementsRef = useRef<string[]>([]);
  const draftIdRef = useRef<string | null>(null);
  const seededForRef = useRef<string | null>(null);
  const cancelJobRef = useRef<(() => void) | null>(null);
  // Planning conversation history for /refine-spec (role 'ai' | 'user').
  const specHistoryRef = useRef<Array<{ role: 'ai' | 'user'; content: string }>>([]);

  const gameName = briefRef.current?.name ?? null;

  const pushMessage = useCallback((msg: Omit<WishMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: nextId() }]);
  }, []);

  const onJobStatus = useCallback((status: any) => {
    if (typeof status?.progress === 'number') setGenProgress(status.progress);
    if (typeof status?.phase === 'string') setGenPhase(status.phase);
    if (typeof status?.statusMessage === 'string') setGenStatusMessage(status.statusMessage);
  }, []);

  /** Map a backend spec (DeepSeek-written) into the brief the pitch renders. */
  const specToBrief = (spec: any): GameBrief => ({
    name: spec?.title || 'Your Game',
    pitch: spec?.description || '',
    structural: spec?.structural || '',
    spine: Array.isArray(spec?.features) ? spec.features : [],
    flavor: [],
  });

  /** What the model "said" for conversation history purposes. */
  const briefAsText = (brief: GameBrief) =>
    `${brief.name}: ${brief.pitch} ${brief.spine.join('. ')}`;

  /**
   * Shown whenever the model didn't actually write the pitch.
   *
   * We never render fallback/placeholder content as a pitch. A pitch carries a
   * live Create button, so shipping canned filler here would let the user build
   * a real game out of text the model never wrote — burning a build on an idea
   * that isn't theirs. Their wish and assets are untouched, so retry is one tap.
   */
  const pushUnavailable = useCallback(() => {
    pushMessage({
      role: 'kimi',
      text: 'Something’s wrong on my end — I can’t shape your idea right now. It’s saved, so we can pick this up in a moment.',
      canRetry: true,
    });
  }, [pushMessage]);

  /** First pitch. Only a real model-written spec becomes a brief. */
  const proposeBrief = useCallback(() => {
    setKimiThinking(true);
    ai.generateSpec(initialPrompt)
      .then((res: any) => {
        // The endpoint returns success:true even when the model call failed,
        // flagging it with `fallback` + `warning`. Treat that as a failure —
        // it means the copy is hardcoded filler, not Kimi's work.
        if (res?.fallback) {
          console.warn('[WishStudio] generate-spec fell back:', res?.warning);
          pushUnavailable();
          return;
        }
        const brief = specToBrief(res?.spec);
        if (!brief.pitch) {
          pushUnavailable();
          return;
        }
        briefRef.current = brief;
        specHistoryRef.current = [
          { role: 'user', content: initialPrompt },
          { role: 'ai', content: briefAsText(brief) },
        ];
        // No preamble — the pitch opens with the game's name and speaks for itself.
        pushMessage({ role: 'kimi', text: '', brief });
      })
      .catch((err: any) => {
        console.warn('[WishStudio] generate-spec failed:', err?.message);
        pushUnavailable();
      })
      .finally(() => {
        setPhase('planning');
        setKimiThinking(false);
      });
  }, [initialPrompt, pushMessage, pushUnavailable]);

  /**
   * Revision turn — fold the user's reaction in, hand back the updated pitch.
   * On failure the PREVIOUS pitch stays intact and buildable; we just report
   * that this revision didn't land, rather than replacing a good pitch with a
   * fabricated one.
   */
  const refineBrief = useCallback(
    (userMessage: string) => {
      setKimiThinking(true);
      ai.refineSpec(specHistoryRef.current, userMessage)
        .then((res: any) => {
          const brief = specToBrief(res?.spec);
          if (!brief.pitch) {
            pushUnavailable();
            return;
          }
          briefRef.current = brief;
          specHistoryRef.current = [
            ...specHistoryRef.current,
            { role: 'user', content: userMessage },
            { role: 'ai', content: res?.aiMessage || briefAsText(brief) },
          ];
          pushMessage({ role: 'kimi', text: res?.aiMessage || '', brief });
        })
        .catch((err: any) => {
          console.warn('[WishStudio] refine-spec failed:', err?.message);
          pushUnavailable();
        })
        .finally(() => {
          setPhase('planning');
          setKimiThinking(false);
        });
    },
    [pushMessage, pushUnavailable],
  );

  // Opening handoff from Dream Forge: their brief lands as the first turn and
  // Kimi immediately pitches back. No greeting, no re-asking.
  useEffect(() => {
    if (!visible || !initialPrompt.trim()) return;
    if (seededForRef.current === initialPrompt) return;
    seededForRef.current = initialPrompt;

    idCounter = 0;
    briefRef.current = null;
    refinementsRef.current = [];
    draftIdRef.current = null;
    cancelJobRef.current = null;
    setTab('wish');
    setPhase('planning');
    setHasCreated(false);
    setHtml(null);
    setGameUrl(null);
    setPreviewHasNews(false);
    setInput('');
    setBuildError(null);
    setGenProgress(null);
    setGenPhase(null);
    setGenStatusMessage(null);

    const attachNote =
      initialAttachments.length > 0
        ? `  ·  ${initialAttachments.length} asset${initialAttachments.length > 1 ? 's' : ''} attached`
        : '';
    setMessages([{ id: nextId(), role: 'user', text: initialPrompt + attachNote }]);
    proposeBrief();
  }, [visible, initialPrompt, initialAttachments.length, proposeBrief]);

  // ── Create: the toggle is born, Preview opens on the forge ─────────────────

  const runBuild = useCallback(
    (job: { promise: Promise<any>; cancel: () => void }, doneLine: (name: string) => string) => {
      cancelJobRef.current = job.cancel;
      job.promise
        .then((res: any) => {
          cancelJobRef.current = null;
          draftIdRef.current = res?.draftId || res?.jobId || draftIdRef.current;
          if (res?.htmlPreview) setHtml(res.htmlPreview);
          if (res?.gameUrl) setGameUrl(res.gameUrl);
          setPhase('live');
          setPreviewHasNews(true);
          pushMessage({ role: 'kimi', text: doneLine(briefRef.current?.name ?? 'Your game') });
        })
        .catch((err: any) => {
          cancelJobRef.current = null;
          const msg = err?.message || '';
          if (/aborted|cancel/i.test(msg)) return; // user canceled — already handled
          // Keep the forge on screen with its retry affordance.
          setBuildError(msg || 'The build hit a wall.');
        });
    },
    [pushMessage],
  );

  const handleCreate = useCallback(() => {
    const brief = briefRef.current;
    if (!brief || phase === 'building') return;
    setPhase('building');
    setHasCreated(true);
    setTab('preview'); // land in the forge — the wait is a game, go play it
    setPreviewHasNews(false);
    setBuildError(null);
    setGenProgress(5);
    setGenStatusMessage('Reading your idea...');
    pushMessage({ role: 'kimi', text: `Forging ${brief.name}. Hold tight — defend the forge while I work.` });

    const prompt = briefToPrompt(brief, initialPrompt, refinementsRef.current);
    runBuild(
      ai.dreamLabs(prompt, initialAttachments, { onStatus: onJobStatus }),
      (name) => `${name} is live — go play it. From here every wish changes the game: say it and I’ll make it so.`,
    );
  }, [phase, initialPrompt, initialAttachments, pushMessage, onJobStatus, runBuild]);

  // ── Live: every wish edits the game Kimi already built ─────────────────────

  const handleLiveWish = useCallback(
    (wish: string) => {
      const draftId = draftIdRef.current;
      if (!draftId) return;
      setPhase('building');
      setPreviewHasNews(false);
      setBuildError(null);
      setGenProgress(5);
      setGenStatusMessage('Making your wish real...');
      pushMessage({ role: 'kimi', text: 'On it.' });
      runBuild(
        ai.editGame(draftId, wish, [], { onStatus: onJobStatus }),
        () => 'Done — take a look.',
      );
    },
    [pushMessage, onJobStatus, runBuild],
  );

  const handleCancelBuild = useCallback(() => {
    cancelJobRef.current?.();
    cancelJobRef.current = null;
    setBuildError(null);
    if (draftIdRef.current) {
      setPhase('live');
      pushMessage({ role: 'kimi', text: 'Stopped. The game is as it was — wish again whenever.' });
    } else {
      setPhase('planning');
      setHasCreated(false); // back to pure conversation
      setTab('wish');
      pushMessage({ role: 'kimi', text: 'Stopped. The pitch is still here when you’re ready.' });
    }
  }, [pushMessage]);

  const handleRetryBuild = useCallback(() => {
    setBuildError(null);
    if (draftIdRef.current) setPhase('live');
    else {
      setPhase('planning');
      handleCreate();
    }
  }, [handleCreate]);

  // ── Publish: hand off to Dream Forge's Publish Game screen ─────────────────

  const handlePublish = useCallback(() => {
    const draftId = draftIdRef.current;
    if (!draftId) {
      Alert.alert('Not ready', 'Create the game first, then publish it.');
      return;
    }
    if (!onRequestPublish) {
      onClose();
      return;
    }
    onRequestPublish({
      draftId,
      html,
      gameUrl,
      title: briefRef.current?.name ?? '',
    });
  }, [html, gameUrl, onRequestPublish, onClose]);

  const handleSend = useCallback(() => {
    const wish = input.trim();
    if (!wish) return;
    setInput('');
    pushMessage({ role: 'user', text: wish });

    if (draftIdRef.current) {
      handleLiveWish(wish);
      return;
    }
    // Still planning — fold the reaction into the pitch, never interrogate.
    refinementsRef.current = [...refinementsRef.current, wish];
    refineBrief(wish);
  }, [input, pushMessage, handleLiveWish, refineBrief]);

  /**
   * Retry a failed planning turn. The user's wish and assets were never lost,
   * so this re-asks with exactly what they already gave us — no re-typing.
   * If a pitch already exists we re-run the last revision; otherwise the first pitch.
   */
  const handleRetryPlanning = useCallback(() => {
    const lastWish = refinementsRef.current[refinementsRef.current.length - 1];
    if (briefRef.current && lastWish) refineBrief(lastWish);
    else proposeBrief();
  }, [refineBrief, proposeBrief]);

  // Derive the forge scene's step from job progress.
  const activeStep =
    genProgress == null ? 0 : genProgress < 30 ? 0 : genProgress < 60 ? 1 : genProgress < 85 ? 2 : 3;

  const building = phase === 'building';
  // Publish is offered only once there's a real, playable game to ship.
  const canPublish = phase === 'live' && (!!html || !!gameUrl);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={palette.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              {/* Pre-create the pitch owns the title — don't echo it in the header. */}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {hasCreated ? gameName ?? 'New Game' : 'New Game'}
              </Text>
              {building && <Text style={styles.headerSub}>forging…</Text>}
            </View>
            {canPublish ? (
              <Pressable
                onPress={handlePublish}
                style={styles.publishPill}
                hitSlop={6}
              >
                <Ionicons name="rocket" size={14} color={palette.black} />
                <Text style={styles.publishPillText}>Publish</Text>
              </Pressable>
            ) : (
              <View style={styles.headerBtn} />
            )}
          </View>

          <View style={styles.body}>
            {tab === 'wish' ? (
              <WishConversation
                messages={messages}
                phase={phase}
                input={input}
                onChangeInput={setInput}
                onSend={handleSend}
                onCreate={handleCreate}
                onRetry={handleRetryPlanning}
                isFirstGame={!hasCreated}
                kimiThinking={kimiThinking}
              />
            ) : building || buildError ? (
              // The forge lives INSIDE the preview card — same frame the game will
              // occupy once it's ready, so it swaps in place rather than replacing
              // a separate full-screen scene.
              <View style={styles.forgeCard}>
                <ForgeDefenseGame
                  embedded
                  prompt={initialPrompt}
                  activeStep={activeStep}
                  labsMode
                  onCancel={handleCancelBuild}
                  onMinimize={() => setTab('wish')}
                  onRetry={handleRetryBuild}
                  errorMessage={buildError}
                  generationSteps={GENERATION_STEPS}
                  cookingStatusLines={COOKING_STATUS_LINES}
                  generationProgress={genProgress}
                  generationPhase={genPhase}
                  generationStatusMessage={genStatusMessage}
                />
              </View>
            ) : (
              <PreviewPane
                state={html || gameUrl ? 'ready' : 'empty'}
                gameName={gameName}
                beats={[]}
                html={html}
                gameUrl={gameUrl}
              />
            )}
          </View>

          {/* The toggle exists only once there's something on the other side. */}
          {hasCreated && (
            <StudioTabBar
              active={tab}
              onSelect={(next) => {
                setTab(next);
                if (next === 'preview') setPreviewHasNews(false);
              }}
              onHistory={() => {}}
              onSettings={() => {}}
              previewHasNews={previewHasNews}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink900 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: palette.text,
    fontSize: t.size.h3,
    fontFamily: t.family.bold,
    letterSpacing: t.letter.snug,
    textAlign: 'center',
  },
  headerSub: {
    color: palette.textDim,
    fontSize: t.size.caption,
    fontFamily: t.family.medium,
    marginTop: 1,
  },
  body: { flex: 1 },
  // Same frame the game occupies in PreviewPane's `gameCard`, so the forge → game
  // handoff happens in place with no visual jump.
  forgeCard: {
    flex: 1,
    margin: spacing.md,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.ink900,
    borderWidth: 1,
    borderColor: palette.line,
  },
  publishPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: palette.text,
  },
  publishPillText: {
    color: palette.black,
    fontSize: t.size.small,
    fontFamily: t.family.bold,
    letterSpacing: t.letter.snug,
  },
});
