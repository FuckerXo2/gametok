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
import { View, Text, Modal, Pressable, StyleSheet, SafeAreaView, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, spacing, radii, type as t } from '../theme/tokens';
import { PreviewPane } from '../components/wish/PreviewPane';
import { ForgeDefenseGame } from '../components/ForgeDefenseGame';
import { ForgeUnderstandingScreen } from '../components/forge/ForgeUnderstandingScreen';
import {
  VisualDirectionScreen,
  type VisualDirection,
} from '../components/forge/VisualDirectionScreen';
import {
  PerspectiveSelectionScreen,
  type CameraPerspective,
} from '../components/forge/PerspectiveSelectionScreen';
import { ForgeBuildingScreen } from '../components/forge/ForgeBuildingScreen';
import { GameReadyScreen } from '../components/forge/GameReadyScreen';
import { GameCreatorScreen } from '../components/forge/GameCreatorScreen';
import { AddToGameScreen, type AssetItem } from '../components/forge/AddToGameScreen';
import { briefToPrompt } from '../services/planner';
import { ai } from '../services/api';
import {
  saveActiveForgeSession,
  clearActiveForgeSession,
  createForgeSessionId,
  type ActiveForgeSession,
} from '../services/forgeSession';
import {
  getStoredPushToken,
  scheduleVisualDirectionsReadyNotification,
  schedulePerspectivesReadyNotification,
} from '../services/notifications';
import { useForgeDirector } from '../hooks/useForgeDirector';
import type { WishMessage, StudioPhase, StudioTab, GameBrief } from '../components/wish/wishTypes';
import { normalizeOrientation, DEFAULT_ORIENTATION, isLandscape, type Orientation } from '../constants/orientation';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The brief the user forged on Dream Forge. */
  initialPrompt: string;
  /**
   * Open straight onto a game that already exists — a draft from the list, a
   * remix from the feed, a finished build. There is nothing to pitch, so the
   * studio skips planning and lands on Preview with the game playable.
   */
  initialGame?: {
    draftId: string;
    html: string | null;
    gameUrl: string | null;
    title: string;
    runtime?: 'web' | 'native';
    gameScript?: string | null;
  } | null;
  /** Images/Videos/Sounds/BGM they attached for the game to use. */
  initialAttachments?: any[];
  /**
   * Portrait or landscape, chosen on Dream Forge before the studio opened. The studio never asks —
   * it just carries the decision into the brief and onto the generation request.
   */
  initialOrientation?: Orientation;
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
  /**
   * Bump this to reopen the studio on a specific tab. Backing out of Publish
   * should land on 'preview' (the user wants their game back); "Edit game"
   * lands on 'wish', because they came to make a wish.
   */
  reopenNonce?: number;
  reopenTab?: StudioTab;
  /** Restored session state from background or push notification */
  restoredSession?: ActiveForgeSession | null;
  targetJourneyView?: JourneyView | null;
  onDiscardSession?: () => void;
  /** Rendered inside the studio's modal, above it — see the bottom of render. */
  children?: React.ReactNode;
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
const UNDERSTANDING_STEPS = [
  { icon: 'sparkles', text: 'Analyzing your request...' },
  { icon: 'game-controller', text: 'Exploring game mechanics...' },
  { icon: 'color-palette', text: 'Researching visual directions...' },
  { icon: 'layers', text: 'Identifying assets...' },
  { icon: 'cube', text: 'Preparing concepts...' },
];
const COMPANION_MESSAGES = [
  "Analyzing your game idea and core vision...",
  "Mapping out game mechanics, controls, and physics...",
  "Hermes is brainstorming 4 unique visual art directions...",
  "Synthesizing concept art and visual assets...",
  "Finishing up your style preview cards...",
  "All set! Choose your visual direction to begin building.",
];

const PERSPECTIVE_UNDERSTANDING_STEPS = [
  'Analyzing gameplay space & movement...',
  'Styling camera rigs for chosen art direction...',
  'Rendering in-game screenshot angles with GPT Image...',
  'Camera perspectives ready!',
];

let idCounter = 0;
const nextId = () => `w${++idCounter}`;

type JourneyView = 'understanding' | 'directions' | 'perspective-understanding' | 'perspective' | 'building' | 'ready' | 'play' | 'creator' | 'assets';

export const WishStudioScreen = ({
  visible,
  onClose,
  initialPrompt,
  initialGame = null,
  initialAttachments = [],
  initialOrientation = DEFAULT_ORIENTATION,
  onRequestPublish,
  reopenNonce = 0,
  reopenTab = 'wish',
  restoredSession = null,
  targetJourneyView = null,
  onDiscardSession,
  children,
}: Props) => {
  const insets = useSafeAreaInsets();
  const orientation: Orientation = isLandscape(initialOrientation) || /landscape/i.test(initialPrompt) ? 'landscape' : normalizeOrientation(initialOrientation);
  const isRestoredMatching =
    restoredSession &&
    (!initialPrompt.trim() ||
      restoredSession.prompt?.trim().toLowerCase() === initialPrompt.trim().toLowerCase());
  const [activeSessionId, setActiveSessionId] = useState<string>(() =>
    isRestoredMatching && restoredSession?.sessionId
      ? restoredSession.sessionId
      : createForgeSessionId()
  );
  const sessionIdRef = useRef<string>(activeSessionId);
  sessionIdRef.current = activeSessionId;

  const updateSessionId = useCallback((newId: string) => {
    sessionIdRef.current = newId;
    setActiveSessionId(newId);
  }, []);

  const lastPromptRef = useRef<string>(initialPrompt);

  if (lastPromptRef.current !== initialPrompt) {
    lastPromptRef.current = initialPrompt;
    if (!isRestoredMatching) {
      const freshId = createForgeSessionId();
      updateSessionId(freshId);
    }
  }

  useEffect(() => {
    if (isRestoredMatching && restoredSession?.sessionId) {
      updateSessionId(restoredSession.sessionId);
    }
  }, [restoredSession?.sessionId, isRestoredMatching, updateSessionId]);
  const [tab, setTab] = useState<StudioTab>(initialGame ? 'preview' : 'wish');
  const [phase, setPhase] = useState<StudioPhase>(initialGame ? 'live' : 'planning');
  const [messages, setMessages] = useState<WishMessage[]>([]);
  const [input, setInput] = useState('');
  const [kimiThinking, setKimiThinking] = useState(false);
  const [html, setHtml] = useState<string | null>(initialGame?.html || null);
  const [gameUrl, setGameUrl] = useState<string | null>(initialGame?.gameUrl || null);
  const [runtime, setRuntime] = useState<'web' | 'native'>(initialGame?.runtime || 'web');
  const [gameScript, setGameScript] = useState<string | null>(initialGame?.gameScript || null);
  const [previewHasNews, setPreviewHasNews] = useState(false);
  // The toggle exists only after the first Create. Before that: pure conversation.
  const [hasCreated, setHasCreated] = useState(Boolean(initialGame));
  // Live job telemetry feeding the forge scene.
  const [genProgress, setGenProgress] = useState<number | null>(null);
  const [genPhase, setGenPhase] = useState<string | null>(null);
  const [genStatusMessage, setGenStatusMessage] = useState<string | null>(null);
  const [backendStatusMessage, setBackendStatusMessage] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [journeyView, setJourneyView] = useState<JourneyView>(() => {
    if (initialGame) return 'creator';
    if (restoredSession?.perspectives?.length) return 'perspective';
    if (restoredSession?.visualDirections?.length) return 'directions';
    return targetJourneyView || (restoredSession?.journeyView as JourneyView) || 'understanding';
  });
  const [visualDirections, setVisualDirections] = useState<VisualDirection[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<VisualDirection | null>(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  const [perspectives, setPerspectives] = useState<CameraPerspective[]>([]);
  const [selectedPerspectiveId, setSelectedPerspectiveId] = useState<string | null>(null);
  const [isPerspectivesLoading, setIsPerspectivesLoading] = useState(false);
  const [isDirectionsLoading, setIsDirectionsLoading] = useState(false);
  const [directionsRetryNonce, setDirectionsRetryNonce] = useState(0);
  const [directionGeneration, setDirectionGeneration] = useState(0);
  const [understandingStep, setUnderstandingStep] = useState(0);
  const [perspectiveUnderstandingStep, setPerspectiveUnderstandingStep] = useState(0);
  const [briefReady, setBriefReady] = useState(false);
  const [attachedGameAssets, setAttachedGameAssets] = useState<AssetItem[]>([]);

  const briefRef = useRef<GameBrief | null>(null);
  const refinementsRef = useRef<string[]>([]);
  const draftIdRef = useRef<string | null>(null);
  const seededForRef = useRef<string | null>(null);
  const cancelJobRef = useRef<(() => void) | null>(null);
  const visualDirectionInstructionRef = useRef('');
  const cameraPerspectiveInstructionRef = useRef('');
  const selectedStyleModifierRef = useRef('');
  // Planning conversation history for /refine-spec (role 'ai' | 'user').
  const specHistoryRef = useRef<Array<{ role: 'ai' | 'user'; content: string }>>([]);
  const inFlightDirectionsPromptRef = useRef<string | null>(null);
  const isTransitioningDirectionsRef = useRef(false);
  const isTransitioningPerspectivesRef = useRef(false);
  const requiresPerspectiveSelectionRef = useRef<boolean | null>(null);
  const defaultPerspectiveRef = useRef<any>(null);
  const handleCreateRef = useRef<() => void>(() => {});

  const verifyAndPrefetchCards = useCallback(async (cards: any[]): Promise<boolean> => {
    if (!Array.isArray(cards) || cards.length < 4) return false;
    const fourCards = cards.slice(0, 4);
    const allHaveUrls = fourCards.every(
      (c) => c && typeof c.imageUrl === 'string' && c.imageUrl.startsWith('http')
    );
    if (!allHaveUrls) return false;

    try {
      await Promise.all(
        fourCards.map((c) =>
          Promise.race([
            Image.prefetch(c.imageUrl),
            new Promise((resolve) => setTimeout(resolve, 2500)),
          ]).catch((err) => {
            console.warn('[Prefetch] Best-effort warning for card:', c.name, err);
            return true;
          })
        )
      );
      return true;
    } catch {
      return true;
    }
  }, []);

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
    orientation,
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
    setBuildError('I could not understand the idea this time. Your brief is still safe.');
    pushMessage({
      role: 'kimi',
      text: 'Something’s wrong on my end — I can’t shape your idea right now. It’s saved, so we can pick this up in a moment.',
      canRetry: true,
    });
  }, [pushMessage]);

  /** First pitch. Seamlessly creates the brief with automatic fallbacks so Forge is never blocked. */
  const proposeBrief = useCallback(() => {
    setKimiThinking(true);
    ai.generateSpec(initialPrompt)
      .then((res: any) => {
        const spec = res?.spec;
        const brief = (spec && (spec.title || spec.description))
          ? specToBrief(spec)
          : {
              name: initialPrompt.slice(0, 24).trim() || 'Your Game',
              orientation,
              pitch: initialPrompt,
              structural: 'Responsive arcade gameplay loop.',
              spine: ['Responsive mobile touch controls', 'Dynamic physics', 'Score combo multipliers'],
              flavor: [],
            };
        briefRef.current = brief;
        specHistoryRef.current = [
          { role: 'user', content: initialPrompt },
          { role: 'ai', content: briefAsText(brief) },
        ];
        setBriefReady(true);
      })
      .catch((err: any) => {
        console.warn('[WishStudio] generate-spec non-fatal warning, using contextual brief:', err?.message);
        const fallbackBrief: GameBrief = {
          name: initialPrompt.slice(0, 24).trim() || 'Your Game',
          orientation,
          pitch: initialPrompt,
          structural: 'Responsive arcade gameplay loop.',
          spine: ['Responsive mobile touch controls', 'Dynamic physics', 'Score combo multipliers'],
          flavor: [],
        };
        briefRef.current = fallbackBrief;
        setBriefReady(true);
      })
      .finally(() => {
        setPhase('planning');
        setKimiThinking(false);
      });
  }, [initialPrompt, orientation]);

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

  const lastInitializedPromptRef = useRef<string | null>(null);
  const wasVisibleRef = useRef<boolean>(false);
  const seededGameRef = useRef<string | null>(null);

  // Opening handoff from Dream Forge: their brief lands as the first turn and
  // Kimi immediately pitches back. If restoredSession is provided, hydrate it straight into the scene!
  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      lastInitializedPromptRef.current = null;
      seededGameRef.current = null;
      setVisualDirections([]);
      setSelectedDirection(null);
      setSelectedDirectionId(null);
      setPerspectives([]);
      setSelectedPerspectiveId(null);
      setJourneyView(initialGame ? 'creator' : 'understanding');
      setBackendStatusMessage(null);
      setBuildError(null);
      setIsDirectionsLoading(false);
      setIsPerspectivesLoading(false);
      isTransitioningDirectionsRef.current = false;
      isTransitioningPerspectivesRef.current = false;
      return;
    }

    const isRestoredValid =
      restoredSession &&
      (!initialPrompt.trim() ||
        restoredSession.prompt?.trim().toLowerCase() === initialPrompt.trim().toLowerCase());

    if (isRestoredValid && restoredSession) {
      updateSessionId(restoredSession.sessionId);
      idCounter = 0;
      briefRef.current = restoredSession.brief || {
        name: restoredSession.gameName || 'Your game',
        orientation,
        pitch: restoredSession.prompt || initialPrompt,
        structural: '',
        spine: [],
        flavor: [],
      };
      setBriefReady(true);
      if (restoredSession.visualDirections?.length) {
        setVisualDirections(restoredSession.visualDirections);
        setSelectedDirection(restoredSession.selectedDirection || restoredSession.visualDirections[0]);
        setSelectedDirectionId(restoredSession.selectedDirectionId || restoredSession.visualDirections[0].id);
      }
      if (restoredSession.perspectives?.length) {
        setPerspectives(restoredSession.perspectives);
        setSelectedPerspectiveId(restoredSession.selectedPerspectiveId || restoredSession.perspectives[0].id);
      }

      const viewToSet: JourneyView =
        targetJourneyView ||
        (restoredSession.perspectives?.length
          ? 'perspective'
          : restoredSession.visualDirections?.length
          ? 'directions'
          : (restoredSession.journeyView as JourneyView) || 'understanding');

      setJourneyView(viewToSet);
      return;
    }

    if (initialGame) {
      setJourneyView((curr) =>
        curr === 'understanding' || curr === 'perspective-understanding' || curr === 'directions' || curr === 'perspective'
          ? 'creator'
          : curr
      );
      return;
    }

    if (!initialPrompt.trim()) return;

    const trimmedPrompt = initialPrompt.trim();
    if (wasVisibleRef.current && lastInitializedPromptRef.current === trimmedPrompt) {
      return;
    }
    wasVisibleRef.current = true;
    lastInitializedPromptRef.current = trimmedPrompt;

    // Fresh forge session for this prompt:
    const freshId = createForgeSessionId();
    updateSessionId(freshId);
    clearActiveForgeSession();

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
    setBackendStatusMessage(null);
    setJourneyView('understanding');
    setVisualDirections([]);
    setSelectedDirection(null);
    setSelectedDirectionId(null);
    setPerspectives([]);
    setSelectedPerspectiveId(null);
    setIsDirectionsLoading(false);
    setIsPerspectivesLoading(false);
    setDirectionGeneration(0);
    setUnderstandingStep(0);
    setPerspectiveUnderstandingStep(0);
    setBriefReady(false);
    visualDirectionInstructionRef.current = '';
    cameraPerspectiveInstructionRef.current = '';
    requiresPerspectiveSelectionRef.current = null;
    defaultPerspectiveRef.current = null;
    isTransitioningDirectionsRef.current = false;
    isTransitioningPerspectivesRef.current = false;

    const attachNote =
      initialAttachments.length > 0
        ? `  ·  ${initialAttachments.length} asset${initialAttachments.length > 1 ? 's' : ''} attached`
        : '';
    setMessages([{ id: nextId(), role: 'user', text: initialPrompt + attachNote }]);
    proposeBrief();
  }, [visible, initialGame, initialPrompt, initialAttachments.length, proposeBrief, restoredSession, targetJourneyView, orientation, updateSessionId]);

  // Sync background forge generation if restored during generation
  useEffect(() => {
    if (!visible || !restoredSession?.sessionId) return;
    if (journeyView === 'understanding' || journeyView === 'perspective-understanding') {
      ai.getForgeSession(restoredSession.sessionId)
        .then((res: any) => {
          if (res?.session) {
            const s = res.session;
            if (s.perspectives && s.perspectives.length > 0) {
              setPerspectives(s.perspectives);
              setSelectedPerspectiveId(s.selectedPerspectiveId || s.perspectives[0].id);
              if (s.selectedDirection) setSelectedDirection(s.selectedDirection);
              setJourneyView('perspective');
            } else if (s.visualDirections && s.visualDirections.length > 0) {
              setVisualDirections(s.visualDirections);
              setSelectedDirection(s.selectedDirection || s.visualDirections[0]);
              setSelectedDirectionId(s.selectedDirectionId || s.visualDirections[0].id);
              setJourneyView('directions');
            }
          }
        })
        .catch(() => {});
    }
  }, [visible, restoredSession?.sessionId, journeyView]);

  // Opening an existing game: no pitch, no planning — it is already built, so
  // the studio starts where the old draft editor used to, on the live game.
  useEffect(() => {
    if (!visible) {
      seededGameRef.current = null;
      return;
    }
    if (!initialGame) return;
    // Keyed on the payload, not just the id: reopening the same draft after it
    // changed elsewhere should show the new build, not the one we cached.
    const key = `${initialGame.draftId}::${initialGame.gameUrl ?? ''}::${initialGame.html?.length ?? 0}::${initialGame.gameScript?.length ?? 0}`;
    if (seededGameRef.current === key) {
      setJourneyView((curr) =>
        curr === 'understanding' || curr === 'perspective-understanding' || curr === 'directions' || curr === 'perspective'
          ? 'creator'
          : curr
      );
      return;
    }
    seededGameRef.current = key;

    idCounter = 0;
    const name = initialGame.title?.trim() || 'Your game';
    briefRef.current = { name, orientation, pitch: '', structural: '', spine: [], flavor: [] };
    refinementsRef.current = [];
    specHistoryRef.current = [];
    draftIdRef.current = initialGame.draftId;
    cancelJobRef.current = null;
    setHtml(initialGame.html);
    setGameUrl(initialGame.gameUrl);
    setRuntime(initialGame.runtime || 'web');
    setGameScript(initialGame.gameScript || null);
    setHasCreated(true);
    setPhase('live');
    setTab('preview');
    setPreviewHasNews(false);
    setInput('');
    setBuildError(null);
    setGenProgress(null);
    setGenPhase(null);
    setGenStatusMessage(null);
    setJourneyView('creator');
    setMessages([
      {
        id: nextId(),
        role: 'kimi',
        text: `${name} is here. Every wish changes the game — say it and I’ll make it so.`,
      },
    ]);
  }, [visible, initialGame, orientation]);

  const transitionToDirections = useCallback(() => {
    if (!briefRef.current) {
      briefRef.current = {
        name: initialPrompt.slice(0, 24).trim() || 'Your Game',
        orientation,
        pitch: initialPrompt,
        structural: '',
        spine: [],
        flavor: [],
      };
    }
    setJourneyView('directions');
    setDirectionGeneration(0);
    setSelectedDirectionId(null);
    pushMessage({ role: 'kimi', text: '', brief: briefRef.current });
  }, [initialPrompt, orientation, pushMessage]);

  // Fetch visual directions dynamically while user is on ForgeUnderstandingScreen
  useEffect(() => {
    if (!visible || journeyView !== 'understanding' || !initialPrompt.trim()) return;
    if (visualDirections.length > 0) return;

    let isCancelled = false;
    setIsDirectionsLoading(true);

    const currentSessionId = activeSessionId;
    console.log('[WishStudio] Firing visual directions for prompt:', initialPrompt, 'Session ID:', currentSessionId);

    getStoredPushToken().then((pushToken) => {
      if (isCancelled) return;
      ai.generateVisualDirections(initialPrompt, gameName || 'Your game', {
        sessionId: currentSessionId,
        pushToken: pushToken || undefined,
        attachments: initialAttachments,
        orientation,
      })
        .then(async (res: any) => {
          if (isCancelled || isTransitioningDirectionsRef.current) return;
          if (res?.directions && res.directions.length >= 4) {
            setBackendStatusMessage('Downloading visual direction cards...');
            setUnderstandingStep(4);
            // Non-blocking prefetch so UI immediately transitions
            verifyAndPrefetchCards(res.directions);
            if (isCancelled || isTransitioningDirectionsRef.current) return;

            if (res?.requiresPerspectiveSelection !== undefined) {
              requiresPerspectiveSelectionRef.current = Boolean(res.requiresPerspectiveSelection);
            }
            if (res?.defaultPerspective) {
              defaultPerspectiveRef.current = res.defaultPerspective;
            }

            isTransitioningDirectionsRef.current = true;
            setVisualDirections(res.directions.slice(0, 4));
            setSelectedDirection(res.directions[0]);
            setSelectedDirectionId(res.directions[0].id);
            setUnderstandingStep(5);

            saveActiveForgeSession({
              sessionId: currentSessionId,
              prompt: initialPrompt,
              gameName: gameName || 'Your game',
              orientation,
              journeyView: 'directions',
              visualDirections: res.directions.slice(0, 4),
              selectedDirection: res.directions[0],
              selectedDirectionId: res.directions[0].id,
              isDirectionsReady: true,
              requiresPerspectiveSelection: res?.requiresPerspectiveSelection,
              defaultPerspective: res?.defaultPerspective,
              brief: briefRef.current,
            });

            scheduleVisualDirectionsReadyNotification(initialPrompt, currentSessionId);

            setTimeout(() => {
              transitionToDirections();
              isTransitioningDirectionsRef.current = false;
            }, 300);
          }
        })
        .catch((err) => {
          console.warn('[WishStudio] Visual direction fetch error:', err);
          if (!isCancelled) {
            setBuildError(err?.message || 'Visual direction generation failed. Tap retry.');
          }
        })
        .finally(() => {
          setIsDirectionsLoading(false);
        });
    });

    return () => {
      isCancelled = true;
    };
  }, [visible, journeyView, initialPrompt, visualDirections.length, orientation, transitionToDirections, verifyAndPrefetchCards, directionsRetryNonce, activeSessionId]);

  // ── Hermes Agent-Driven Director: Real-time WebSocket Control ─────────────
  useForgeDirector(
    activeSessionId,
    {
      onThought: (evt) => {
        if (journeyView === 'understanding') {
          if (typeof evt.step === 'number') setUnderstandingStep(evt.step);
          if (evt.message) setBackendStatusMessage(evt.message);
        } else if (journeyView === 'perspective-understanding') {
          if (typeof evt.step === 'number') setPerspectiveUnderstandingStep(evt.step);
          if (evt.message) setBackendStatusMessage(evt.message);
        }
      },
      onCommand: (evt) => {
        const { command, payload } = evt;
        if (command === 'NAVIGATE_TO') {
          if (payload?.view === 'directions' && Array.isArray(payload.visualDirections) && payload.visualDirections.length >= 4) {
            if (isTransitioningDirectionsRef.current) return;
            isTransitioningDirectionsRef.current = true;
            if (payload.requiresPerspectiveSelection !== undefined) {
              requiresPerspectiveSelectionRef.current = Boolean(payload.requiresPerspectiveSelection);
            }
            if (payload.defaultPerspective) {
              defaultPerspectiveRef.current = payload.defaultPerspective;
            }
            // Non-blocking prefetch
            verifyAndPrefetchCards(payload.visualDirections);
            setVisualDirections(payload.visualDirections.slice(0, 4));
            setSelectedDirection(payload.visualDirections[0]);
            setSelectedDirectionId(payload.visualDirections[0].id);
            setUnderstandingStep(5);

            saveActiveForgeSession({
              sessionId: activeSessionId,
              prompt: initialPrompt,
              gameName: gameName || 'Your game',
              orientation,
              journeyView: 'directions',
              visualDirections: payload.visualDirections.slice(0, 4),
              selectedDirection: payload.visualDirections[0],
              selectedDirectionId: payload.visualDirections[0].id,
              isDirectionsReady: true,
              requiresPerspectiveSelection: payload.requiresPerspectiveSelection,
              defaultPerspective: payload.defaultPerspective,
              brief: briefRef.current,
            });

            setTimeout(() => {
              transitionToDirections();
              isTransitioningDirectionsRef.current = false;
            }, 300);
          } else if (payload?.view === 'perspective' && Array.isArray(payload.perspectives) && payload.perspectives.length >= 4) {
            if (isTransitioningPerspectivesRef.current) return;
            isTransitioningPerspectivesRef.current = true;
            setPerspectives(payload.perspectives.slice(0, 4));
            setSelectedPerspectiveId(payload.perspectives[0].id);
            setPerspectiveUnderstandingStep(3);

            saveActiveForgeSession({
              sessionId: sessionIdRef.current,
              prompt: initialPrompt,
              gameName: gameName || 'Your game',
              orientation,
              journeyView: 'perspective',
              selectedDirection: payload.selectedDirection,
              selectedDirectionId: payload.selectedDirection?.id,
              perspectives: payload.perspectives.slice(0, 4),
              selectedPerspectiveId: payload.perspectives[0].id,
              isPerspectivesReady: true,
            });

            setTimeout(() => {
              setJourneyView('perspective');
              isTransitioningPerspectivesRef.current = false;
            }, 300);
          } else if (payload?.view === 'building') {
            if (payload.defaultPerspective) {
              const def = payload.defaultPerspective;
              cameraPerspectiveInstructionRef.current = `${def.name} (${def.dimension}). ${def.cameraInstruction}.`;
              setSelectedPerspectiveId(def.id);
            }
            setJourneyView('building');
            handleCreateRef.current();
          }
        }
      },
      onError: (evt) => {
        setBuildError(evt.message || 'Generation failed. Tap retry to restart.');
      },
      onSync: (session) => {
        if (!session) return;
        if (
          session.journeyView === 'directions' &&
          Array.isArray(session.visualDirections) &&
          session.visualDirections.length >= 4 &&
          journeyView === 'understanding' &&
          !isTransitioningDirectionsRef.current
        ) {
          isTransitioningDirectionsRef.current = true;
          setVisualDirections(session.visualDirections.slice(0, 4));
          setSelectedDirection(session.selectedDirection || session.visualDirections[0]);
          setSelectedDirectionId(session.selectedDirectionId || session.visualDirections[0].id);
          setUnderstandingStep(5);
          setTimeout(() => {
            transitionToDirections();
            isTransitioningDirectionsRef.current = false;
          }, 300);
        } else if (
          session.journeyView === 'perspective' &&
          Array.isArray(session.perspectives) &&
          session.perspectives.length >= 4 &&
          journeyView === 'perspective-understanding' &&
          !isTransitioningPerspectivesRef.current
        ) {
          isTransitioningPerspectivesRef.current = true;
          setPerspectives(session.perspectives.slice(0, 4));
          setSelectedPerspectiveId(session.selectedPerspectiveId || session.perspectives[0].id);
          setPerspectiveUnderstandingStep(3);
          setTimeout(() => {
            setJourneyView('perspective');
            isTransitioningPerspectivesRef.current = false;
          }, 300);
        }
      },
    },
    visible && (journeyView === 'understanding' || journeyView === 'perspective-understanding')
  );

  // Resilient fallback sync: gentle polling every 3s with NO self-destruct timers
  useEffect(() => {
    if (!visible || (journeyView !== 'understanding' && journeyView !== 'perspective-understanding')) return;
    const sessionId = activeSessionId;
    if (!sessionId) return;

    let isPollingActive = true;
    let notFoundCount = 0;
    const pollInterval = setInterval(async () => {
      try {
        const res = await ai.getForgeSession(sessionId);
        if (!isPollingActive || !res?.session) return;
        notFoundCount = 0;
        const s = res.session;

        if (s.phase === 'failed' || s.error) {
          clearInterval(pollInterval);
          setBuildError(s.error || s.statusMessage || 'Generation failed. Tap retry to restart.');
          return;
        }

        if (journeyView === 'understanding') {
          if (typeof s.step === 'number') setUnderstandingStep(s.step);
          if (s.statusMessage) setBackendStatusMessage(s.statusMessage);

          const has4VisualCards =
            Array.isArray(s.visualDirections) &&
            s.visualDirections.length >= 4;

          if (
            (s.isDirectionsReady || (has4VisualCards && (s.phase === 'ready' || s.step >= 4)) || s.journeyView === 'directions') &&
            has4VisualCards &&
            !isTransitioningDirectionsRef.current
          ) {
            isTransitioningDirectionsRef.current = true;
            verifyAndPrefetchCards(s.visualDirections);
            setVisualDirections(s.visualDirections.slice(0, 4));
            setSelectedDirection(s.selectedDirection || s.visualDirections[0]);
            setSelectedDirectionId(s.selectedDirectionId || s.visualDirections[0].id);
            setUnderstandingStep(5);
            setTimeout(() => {
              transitionToDirections();
              isTransitioningDirectionsRef.current = false;
            }, 300);
          }
        } else if (journeyView === 'perspective-understanding') {
          if (typeof s.step === 'number') setPerspectiveUnderstandingStep(s.step);
          if (s.statusMessage) setBackendStatusMessage(s.statusMessage);

          if (s.requiresPerspectiveSelection === false && !isTransitioningPerspectivesRef.current) {
            isTransitioningPerspectivesRef.current = true;
            const defPerspective = s.selectedPerspective || s.perspectives?.[0];
            if (defPerspective) {
              cameraPerspectiveInstructionRef.current = `${defPerspective.name} (${defPerspective.dimension}). ${defPerspective.cameraInstruction}.`;
              setSelectedPerspectiveId(defPerspective.id);
            }
            setJourneyView('building');
            handleCreateRef.current();
            return;
          }

          const has4Perspectives =
            Array.isArray(s.perspectives) &&
            s.perspectives.length >= 4;

          if (
            (s.isPerspectivesReady || (has4Perspectives && (s.phase === 'ready' || s.step >= 3)) || s.journeyView === 'perspective') &&
            has4Perspectives &&
            !isTransitioningPerspectivesRef.current
          ) {
            isTransitioningPerspectivesRef.current = true;
            verifyAndPrefetchCards(s.perspectives);
            setPerspectives(s.perspectives.slice(0, 4));
            setSelectedPerspectiveId(s.selectedPerspectiveId || s.perspectives[0].id);
            setPerspectiveUnderstandingStep(3);
            setTimeout(() => {
              setJourneyView('perspective');
              isTransitioningPerspectivesRef.current = false;
            }, 300);
          }
        }
      } catch (err: any) {
        if (err?.status === 404) {
          notFoundCount++;
          if (notFoundCount >= 10) {
            console.warn('[WishStudio] Session 404 polling count reached threshold for:', sessionId);
          }
        }
      }
    }, 3000);

    return () => {
      isPollingActive = false;
      clearInterval(pollInterval);
    };
  }, [visible, journeyView, activeSessionId, visualDirections.length, perspectives.length, transitionToDirections, verifyAndPrefetchCards]);

  // Coming back from the Publish screen: land on the tab the parent asked for
  // rather than whatever was last open. Keyed on the nonce alone — the tab is
  // read through a ref so a re-render can't yank the user off their tab.
  const reopenTabRef = useRef(reopenTab);
  reopenTabRef.current = reopenTab;
  useEffect(() => {
    if (reopenNonce > 0) setTab(reopenTabRef.current);
  }, [reopenNonce]);

  // ── Create: the toggle is born, Preview opens on the forge ─────────────────

  const runBuild = useCallback(
    (job: { promise: Promise<any>; cancel: () => void }, doneLine: (name: string) => string) => {
      cancelJobRef.current = job.cancel;
      job.promise
        .then((res: any) => {
          cancelJobRef.current = null;
          const wasInitialBuild = !draftIdRef.current;
          draftIdRef.current = res?.draftId || res?.jobId || draftIdRef.current;
          if (res?.htmlPreview) setHtml(res.htmlPreview);
          if (res?.gameUrl) setGameUrl(res.gameUrl);
          if (res?.runtime) setRuntime(res.runtime);
          if (res?.gameScript) setGameScript(res.gameScript);
          setPhase('live');
          setJourneyView(wasInitialBuild ? 'ready' : 'creator');
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
    let brief = briefRef.current;
    if (!brief) {
      brief = {
        name: initialPrompt.slice(0, 24).trim() || 'Your Game',
        orientation,
        pitch: initialPrompt,
        structural: '',
        spine: [],
        flavor: [],
      };
      briefRef.current = brief;
    }
    if (phase === 'building' && !buildError) return;
    setPhase('building');
    setHasCreated(true);
    setTab('preview'); // land in the forge — the wait is a game, go play it
    setPreviewHasNews(false);
    setBuildError(null);
    setGenProgress(5);
    setGenStatusMessage('Reading your idea...');
    pushMessage({ role: 'kimi', text: `Forging ${brief.name}. Hold tight — defend the forge while I work.` });

    const activePerspective = perspectives.find((p) => p.id === selectedPerspectiveId) || null;

    const directionBlock = visualDirectionInstructionRef.current
      ? `\n\nSelected visual direction:\n${visualDirectionInstructionRef.current}`
      : selectedDirection
      ? `\n\nSelected visual direction:\n${selectedDirection.name}. ${selectedDirection.instruction || selectedDirection.description || ''}`
      : '';

    const perspectiveBlock = cameraPerspectiveInstructionRef.current
      ? `\n\nSelected camera perspective:\n${cameraPerspectiveInstructionRef.current}`
      : activePerspective
      ? `\n\nSelected camera perspective:\n${activePerspective.name} (${activePerspective.dimension}). ${activePerspective.cameraInstruction}.`
      : '';

    const prompt = `${briefToPrompt(brief, initialPrompt, refinementsRef.current)}${directionBlock}${perspectiveBlock}`;
    runBuild(
      // Orientation goes as a structured field, not just the prose line briefToPrompt adds — the
      // sandbox verifies at 844x390 vs 390x844 off this value.
      ai.dreamLabs(prompt, initialAttachments, {
        onStatus: onJobStatus,
        orientation,
        runtime: 'web',
        selectedDirection,
        selectedPerspective: activePerspective,
        dimension: activePerspective?.dimension,
        sessionId: sessionIdRef.current,
      }),
      (name) => `${name} is live — go play it. From here every wish changes the game: say it and I’ll make it so.`,
    );
  }, [
    phase,
    buildError,
    initialPrompt,
    initialAttachments,
    orientation,
    pushMessage,
    onJobStatus,
    runBuild,
    selectedDirection,
    perspectives,
    selectedPerspectiveId,
  ]);
  handleCreateRef.current = handleCreate;

  const handleUseDirection = useCallback(
    (direction: VisualDirection, refinement: string) => {
      visualDirectionInstructionRef.current = [direction.instruction, refinement].filter(Boolean).join(' ');
      selectedStyleModifierRef.current = (direction as any)?.modifier || direction.instruction || '';
      setSelectedDirectionId(direction.id);
      setSelectedDirection(direction);

      // AUTONOMOUS HERMES CAMERA BYPASS:
      // If Hermes determined camera selection is not needed, lock optimal 2D viewport & build immediately!
      if (requiresPerspectiveSelectionRef.current === false) {
        const defPerspective = defaultPerspectiveRef.current || {
          id: 'fixed-2d-viewport',
          name: 'Top-Down 2D Grid',
          dimension: '2D',
          cameraInstruction: 'Fixed 2D top-down camera with centered viewport',
        };
        cameraPerspectiveInstructionRef.current = `${defPerspective.name} (${defPerspective.dimension}). ${defPerspective.cameraInstruction}.`;
        setSelectedPerspectiveId(defPerspective.id);
        saveActiveForgeSession({
          sessionId: sessionIdRef.current,
          prompt: initialPrompt,
          gameName: gameName || 'Your game',
          orientation,
          journeyView: 'building',
          selectedDirection: direction,
          selectedDirectionId: direction.id,
          selectedPerspectiveId: defPerspective.id,
          isPerspectivesReady: true,
          requiresPerspectiveSelection: false,
        });
        setJourneyView('building');
        handleCreate();
        return;
      }

      // Transition to understanding screen for camera perspective styling!
      setJourneyView('perspective-understanding');
      setPerspectiveUnderstandingStep(0);
      setIsPerspectivesLoading(true);

      saveActiveForgeSession({
        sessionId: sessionIdRef.current,
        prompt: initialPrompt,
        gameName: gameName || 'Your game',
        orientation,
        journeyView: 'perspective-understanding',
        selectedDirection: direction,
        selectedDirectionId: direction.id,
        isPerspectivesReady: false,
      });

      getStoredPushToken().then((pushToken) => {
        ai.generatePerspectives(initialPrompt, gameName || 'Your game', direction, {
          sessionId: sessionIdRef.current,
          pushToken: pushToken || undefined,
          attachments: initialAttachments,
          requiresPerspectiveSelection: requiresPerspectiveSelectionRef.current,
          orientation,
        })
          .then(async (res: any) => {
            if (isTransitioningPerspectivesRef.current) return;

            // AUTONOMOUS HERMES CAMERA BYPASS (from perspective endpoint response):
            if (res?.requiresPerspectiveSelection === false) {
              const defPerspective = res.defaultPerspective || res.perspectives?.[0] || {
                id: 'fixed-2d-viewport',
                name: 'Top-Down 2D Grid',
                dimension: '2D',
                cameraInstruction: 'Fixed 2D top-down camera with centered viewport',
              };
              cameraPerspectiveInstructionRef.current = `${defPerspective.name} (${defPerspective.dimension}). ${defPerspective.cameraInstruction}.`;
              setSelectedPerspectiveId(defPerspective.id);
              saveActiveForgeSession({
                sessionId: sessionIdRef.current,
                prompt: initialPrompt,
                gameName: gameName || 'Your game',
                orientation,
                journeyView: 'building',
                selectedDirection: direction,
                selectedDirectionId: direction.id,
                selectedPerspectiveId: defPerspective.id,
                isPerspectivesReady: true,
                requiresPerspectiveSelection: false,
              });
              setJourneyView('building');
              handleCreate();
              return;
            }

            if (res?.perspectives && res.perspectives.length >= 4) {
              setBackendStatusMessage('Downloading camera perspective cards...');
              setPerspectiveUnderstandingStep(2);
              const allReady = await verifyAndPrefetchCards(res.perspectives);
              if (!allReady || isTransitioningPerspectivesRef.current) return;

              isTransitioningPerspectivesRef.current = true;
              setPerspectives(res.perspectives.slice(0, 4));
              setSelectedPerspectiveId(res.perspectives[0].id);
              setPerspectiveUnderstandingStep(3);

              saveActiveForgeSession({
                sessionId: sessionIdRef.current,
                prompt: initialPrompt,
                gameName: gameName || 'Your game',
                orientation,
                journeyView: 'perspective',
                selectedDirection: direction,
                selectedDirectionId: direction.id,
                perspectives: res.perspectives.slice(0, 4),
                selectedPerspectiveId: res.perspectives[0].id,
                isPerspectivesReady: true,
              });

              schedulePerspectivesReadyNotification(initialPrompt, sessionIdRef.current);

              setTimeout(() => {
                setJourneyView('perspective');
                isTransitioningPerspectivesRef.current = false;
              }, 300);
            } else {
              setBuildError('Failed to generate camera perspectives. Tap retry.');
            }
          })
          .catch((err) => {
            console.warn('[WishStudio] Perspective fetch error:', err);
            setBuildError(err?.message || 'Failed to generate camera perspectives. Tap retry.');
          })
          .finally(() => {
            setIsPerspectivesLoading(false);
          });
      });
    },
    [initialPrompt, gameName, orientation, verifyAndPrefetchCards, handleCreate],
  );

  const handleUsePerspective = useCallback(
    (perspective: CameraPerspective, refinement?: string) => {
      setSelectedPerspectiveId(perspective.id);
      const refinementText = refinement ? ` Camera refinement: ${refinement}.` : '';
      cameraPerspectiveInstructionRef.current = `${perspective.name} (${perspective.dimension}). ${perspective.cameraInstruction}.${refinementText}`;
      setJourneyView('building');

      saveActiveForgeSession({
        sessionId: sessionIdRef.current,
        journeyView: 'building',
        selectedPerspectiveId: perspective.id,
      });

      handleCreate();
    },
    [handleCreate],
  );

  const handleSkipDirections = useCallback(() => {
    visualDirectionInstructionRef.current = '';
    cameraPerspectiveInstructionRef.current = '';
    setJourneyView('building');
    handleCreate();
  }, [handleCreate]);

  const handleCloseRequest = useCallback(() => {
    if (
      journeyView === 'directions' ||
      journeyView === 'perspective' ||
      journeyView === 'understanding' ||
      journeyView === 'perspective-understanding'
    ) {
      Alert.alert(
        'Leave Dream Forge?',
        'Your generation progress is saved. When you tap Create, you can pick up right here.',
        [
          {
            text: 'Keep Draft',
            style: 'default',
            onPress: () => {
              onClose();
            },
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              clearActiveForgeSession();
              setVisualDirections([]);
              setSelectedDirection(null);
              setSelectedDirectionId(null);
              setPerspectives([]);
              setSelectedPerspectiveId(null);
              setJourneyView('understanding');
              seededForRef.current = null;
              updateSessionId(createForgeSessionId());
              onDiscardSession?.();
              onClose();
            },
          },
          {
            text: 'Stay',
            style: 'cancel',
          },
        ]
      );
    } else {
      onClose();
    }
  }, [journeyView, onClose, onDiscardSession]);

  // ── Live: every wish edits the game Kimi already built ─────────────────────

  const handleLiveWish = useCallback(
    (wish: string, attachments: any[] = []) => {
      const draftId = draftIdRef.current;
      if (!draftId) return;
      setPhase('building');
      setPreviewHasNews(false);
      setBuildError(null);
      setGenProgress(5);
      setGenStatusMessage('Making your wish real...');
      pushMessage({ role: 'kimi', text: 'On it.' });
      runBuild(
        ai.editGame(draftId, wish, attachments, { onStatus: onJobStatus }),
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
      setJourneyView('directions');
      pushMessage({ role: 'kimi', text: 'Stopped. The pitch is still here when you’re ready.' });
    }
  }, [pushMessage]);

  const handleRetryBuild = useCallback(() => {
    setBuildError(null);
    if (journeyView === 'understanding') {
      proposeBrief();
      return;
    }
    if (draftIdRef.current) setPhase('live');
    else {
      setPhase('planning');
      handleCreate();
    }
  }, [handleCreate, journeyView, proposeBrief]);

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
    if (!wish && attachedGameAssets.length === 0) return;
    const finalWish =
      wish || `Add these assets to the game: ${attachedGameAssets.map((a) => a.name).join(', ')}`;
    setInput('');
    const attachmentsToSend = [...attachedGameAssets];
    setAttachedGameAssets([]);
    pushMessage({ role: 'user', text: finalWish });

    if (draftIdRef.current) {
      handleLiveWish(finalWish, attachmentsToSend);
      return;
    }
    // Still planning — fold the reaction into the pitch, never interrogate.
    refinementsRef.current = [...refinementsRef.current, finalWish];
    refineBrief(finalWish);
  }, [input, attachedGameAssets, pushMessage, handleLiveWish, refineBrief]);

  /**
   * Retry a failed planning turn. The user's wish and assets were never lost,
   * so this re-asks with exactly what they already gave us — no re-typing.
   * If a pitch already exists we re-run the last revision; otherwise the first pitch.
   */
  const handleRetryPlanning = useCallback(() => {
    if (journeyView === 'understanding') {
      setBuildError(null);
      setVisualDirections([]);
      setSelectedDirection(null);
      setSelectedDirectionId(null);
      setUnderstandingStep(0);
      setBackendStatusMessage('Starting fresh generation...');
      updateSessionId(createForgeSessionId());
      setDirectionsRetryNonce((n) => n + 1);
      return;
    }
    const lastWish = refinementsRef.current[refinementsRef.current.length - 1];
    if (briefRef.current && lastWish) refineBrief(lastWish);
    else proposeBrief();
  }, [journeyView, refineBrief, proposeBrief]);

  // Derive the forge scene's step from job progress.
  const activeStep =
    genProgress == null ? 0 : genProgress < 30 ? 0 : genProgress < 60 ? 1 : genProgress < 85 ? 2 : 3;

  const building = phase === 'building';
  // Publish is offered only once there's a real, playable game to ship.
  const canPublish = phase === 'live' && (!!html || !!gameUrl);
  // When opening an existing draft or game, the studio must never display the understanding/concept phase.
  const activeJourneyView: JourneyView =
    initialGame &&
    (journeyView === 'understanding' ||
      journeyView === 'perspective-understanding' ||
      journeyView === 'directions' ||
      journeyView === 'perspective')
      ? 'creator'
      : journeyView;

  const showForgeChrome =
    activeJourneyView === 'understanding' ||
    activeJourneyView === 'directions' ||
    (building && !draftIdRef.current);

  if (!visible) return null;

  const handleModalClose = () => {
    if (activeJourneyView === 'assets') {
      setJourneyView('creator');
    } else if (activeJourneyView === 'creator') {
      setJourneyView('ready');
    } else if (activeJourneyView === 'play') {
      setJourneyView('ready');
    } else {
      handleCloseRequest();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleModalClose}
    >
      {activeJourneyView === 'understanding' && (
        <ForgeUnderstandingScreen
          prompt={initialPrompt}
          activeStep={understandingStep}
          steps={UNDERSTANDING_STEPS.map((s) => s.text)}
          mascotMessage={
            backendStatusMessage ||
            COMPANION_MESSAGES[understandingStep % COMPANION_MESSAGES.length] ||
            'Exploring a few different directions for your game...'
          }
          onClose={handleCloseRequest}
          onRetry={handleRetryPlanning}
          errorMessage={buildError}
          onSelectStep={setUnderstandingStep}
        />
      )}

      {activeJourneyView === 'directions' && (
        <VisualDirectionScreen
          gameTitle={gameName ?? 'Your game'}
          prompt={initialPrompt}
          directions={visualDirections}
          isLoading={isDirectionsLoading}
          selectedId={selectedDirectionId}
          generation={directionGeneration}
          orientation={orientation}
          onSelect={(direction) => {
            setSelectedDirectionId(direction.id);
            setSelectedDirection(direction);
          }}
          onUseDirection={handleUseDirection}
          onSkip={handleSkipDirections}
          onGenerateMore={() => {
            setDirectionGeneration((value) => value + 1);
          }}
          onClose={handleCloseRequest}
        />
      )}

      {activeJourneyView === 'perspective-understanding' && (
        <ForgeUnderstandingScreen
          prompt={initialPrompt}
          activeStep={perspectiveUnderstandingStep}
          steps={PERSPECTIVE_UNDERSTANDING_STEPS}
          mascotMessage={
            backendStatusMessage ||
            `Positioning camera perspectives for ${selectedDirection?.name || 'your game'}...`
          }
          onClose={handleCloseRequest}
          errorMessage={buildError}
          onSelectStep={setPerspectiveUnderstandingStep}
        />
      )}

      {activeJourneyView === 'perspective' && (
        <PerspectiveSelectionScreen
          gameTitle={gameName ?? 'Your game'}
          prompt={initialPrompt}
          selectedDirection={selectedDirection || visualDirections[0]}
          perspectives={perspectives}
          isLoading={isPerspectivesLoading}
          selectedId={selectedPerspectiveId}
          orientation={orientation}
          onSelect={(p) => setSelectedPerspectiveId(p.id)}
          onUsePerspective={handleUsePerspective}
          onBack={() => setJourneyView('directions')}
          onClose={handleCloseRequest}
        />
      )}

      {(activeJourneyView === 'building' || (building && !draftIdRef.current)) && (
        <ForgeBuildingScreen
          prompt={initialPrompt}
          gameTitle={gameName ?? 'Your game'}
          activeStep={activeStep >= 0 ? activeStep : 1}
          onClose={handleCloseRequest}
          onCookInBackground={() => {
            setJourneyView('creator');
            setTab('wish');
          }}
        />
      )}

      {activeJourneyView === 'assets' && (
        <AddToGameScreen
          styleModifier={selectedStyleModifierRef.current}
          onClose={() => setJourneyView('creator')}
          onApplyAssets={(applied) => {
            setAttachedGameAssets(applied);
            setJourneyView('creator');
            if (applied.length > 0) {
              const names = applied.map((a) => a.name).join(', ');
              setInput((prev) =>
                prev.trim()
                  ? `${prev} (Use: ${names})`
                  : `Add ${names} to the game and make them interactive!`,
              );
            }
          }}
        />
      )}

      {activeJourneyView === 'creator' && (
        <GameCreatorScreen
          gameName={gameName ?? initialGame?.title ?? 'Your game'}
          html={html ?? initialGame?.html ?? null}
          gameUrl={gameUrl ?? initialGame?.gameUrl ?? null}
          orientation={orientation}
          runtime={runtime ?? initialGame?.runtime ?? 'web'}
          gameScript={gameScript ?? initialGame?.gameScript ?? null}
          input={input}
          onChangeInput={setInput}
          onSend={handleSend}
          onBack={() => setJourneyView('ready')}
          onPlay={() => setJourneyView('play')}
          onAdd={() => setJourneyView('assets')}
          attachedAssets={attachedGameAssets}
          onRemoveAsset={(id) =>
            setAttachedGameAssets((prev) => prev.filter((a) => a.id !== id))
          }
          onGameSettings={() =>
            Alert.alert('Game settings', 'AI-tailored settings for this game will open here.')
          }
          onUndo={() => Alert.alert('Undo', 'There is nothing to undo yet.')}
          onMore={() => Alert.alert(gameName ?? initialGame?.title ?? 'Your game', 'More creator options will appear here.')}
          isEditing={phase === 'building'}
        />
      )}

      {activeJourneyView === 'ready' && (
        <GameReadyScreen
          gameName={gameName ?? initialGame?.title ?? 'Your game'}
          html={html ?? initialGame?.html ?? null}
          gameUrl={gameUrl ?? initialGame?.gameUrl ?? null}
          orientation={orientation}
          runtime={runtime ?? initialGame?.runtime ?? 'web'}
          gameScript={gameScript ?? initialGame?.gameScript ?? null}
          onPlay={() => setJourneyView('play')}
          onCreate={() => setJourneyView('creator')}
          onPublish={handlePublish}
          onClose={onClose}
        />
      )}

      {activeJourneyView === 'play' && (
        <View style={styles.playWrap}>
          <PreviewPane
            state={html || gameUrl || gameScript || initialGame?.html || initialGame?.gameUrl || initialGame?.gameScript ? 'ready' : 'empty'}
            gameName={gameName ?? initialGame?.title ?? null}
            beats={[]}
            html={html ?? initialGame?.html ?? null}
            gameUrl={gameUrl ?? initialGame?.gameUrl ?? null}
            orientation={orientation}
            runtime={runtime ?? initialGame?.runtime ?? 'web'}
            gameScript={gameScript ?? initialGame?.gameScript ?? null}
            containerStyle={{ margin: 0, borderWidth: 0 }}
          />
          <Pressable
            style={[
              styles.backPlayButton,
              { top: Math.max(insets.top, 16) + 6 },
            ]}
            onPress={() => setJourneyView('ready')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={18} color={palette.text} />
            <Text style={styles.backPlayText}>Back</Text>
          </Pressable>
        </View>
      )}

      {children}
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#01060E' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brandBack: {
    minWidth: 112,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandText: {
    color: palette.text,
    fontSize: t.size.body,
    fontFamily: t.family.bold,
    letterSpacing: t.letter.snug,
  },
  forgeHeaderSpacer: { width: 112, height: 40 },
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
  playWrap: { flex: 1 },
  backPlayButton: {
    position: 'absolute',
    left: spacing.md,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(10,10,15,0.88)',
    borderWidth: 1,
    borderColor: palette.lineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  backPlayText: {
    color: palette.text,
    fontSize: t.size.small,
    fontFamily: t.family.semibold,
  },
  exitPlayButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(10,10,15,0.86)',
    borderWidth: 1,
    borderColor: palette.lineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exitPlayText: {
    color: palette.text,
    fontSize: t.size.small,
    fontFamily: t.family.semibold,
  },
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
  understandingForge: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
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
