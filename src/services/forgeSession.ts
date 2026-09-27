import AsyncStorage from '@react-native-async-storage/async-storage';
import { Orientation } from '../constants/orientation';
import { VisualDirection } from '../components/forge/VisualDirectionScreen';
import { CameraPerspective } from '../components/forge/PerspectiveSelectionScreen';

const ACTIVE_FORGE_SESSION_KEY = '@gametok_active_forge_session';
const FORGE_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export type ForgeJourneyView =
  | 'understanding'
  | 'directions'
  | 'perspective-understanding'
  | 'perspective'
  | 'building'
  | 'ready'
  | 'creator'
  | 'assets'
  | 'play';

export interface ActiveForgeSession {
  sessionId: string;
  prompt: string;
  gameName: string;
  orientation?: Orientation;
  journeyView: ForgeJourneyView;
  visualDirections: VisualDirection[];
  selectedDirection?: VisualDirection | null;
  selectedDirectionId?: string | null;
  perspectives: CameraPerspective[];
  selectedPerspectiveId?: string | null;
  isDirectionsReady?: boolean;
  isPerspectivesReady?: boolean;
  brief?: any;
  createdAt: number;
  updatedAt: number;
}

export const createForgeSessionId = (): string => {
  return `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Persists the current in-progress or ready forge state so the user can leave,
 * background the app, or close it, and resume exactly where they left off.
 */
export const saveActiveForgeSession = async (
  sessionUpdate: Partial<ActiveForgeSession> & { sessionId?: string }
): Promise<void> => {
  try {
    const existing = await getActiveForgeSession();
    const now = Date.now();

    const merged: ActiveForgeSession = {
      sessionId: sessionUpdate.sessionId || existing?.sessionId || createForgeSessionId(),
      prompt: sessionUpdate.prompt ?? existing?.prompt ?? '',
      gameName: sessionUpdate.gameName ?? existing?.gameName ?? 'Your game',
      orientation: sessionUpdate.orientation ?? existing?.orientation ?? 'portrait',
      journeyView: sessionUpdate.journeyView ?? existing?.journeyView ?? 'understanding',
      visualDirections: sessionUpdate.visualDirections ?? existing?.visualDirections ?? [],
      selectedDirection: sessionUpdate.selectedDirection !== undefined ? sessionUpdate.selectedDirection : existing?.selectedDirection ?? null,
      selectedDirectionId: sessionUpdate.selectedDirectionId !== undefined ? sessionUpdate.selectedDirectionId : existing?.selectedDirectionId ?? null,
      perspectives: sessionUpdate.perspectives ?? existing?.perspectives ?? [],
      selectedPerspectiveId: sessionUpdate.selectedPerspectiveId !== undefined ? sessionUpdate.selectedPerspectiveId : existing?.selectedPerspectiveId ?? null,
      isDirectionsReady: sessionUpdate.isDirectionsReady ?? existing?.isDirectionsReady ?? false,
      isPerspectivesReady: sessionUpdate.isPerspectivesReady ?? existing?.isPerspectivesReady ?? false,
      brief: sessionUpdate.brief ?? existing?.brief ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await AsyncStorage.setItem(ACTIVE_FORGE_SESSION_KEY, JSON.stringify(merged));
    console.log('[ForgeSession] Saved active session:', merged.sessionId, merged.journeyView);
  } catch (error) {
    console.warn('[ForgeSession] Failed to save session:', error);
  }
};

/**
 * Retrieves the currently active forge session, if valid and not expired.
 */
export const getActiveForgeSession = async (): Promise<ActiveForgeSession | null> => {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_FORGE_SESSION_KEY);
    if (!raw) return null;

    const parsed: ActiveForgeSession = JSON.parse(raw);
    const age = Date.now() - (parsed.updatedAt || parsed.createdAt || 0);

    if (age > FORGE_SESSION_MAX_AGE_MS) {
      console.log('[ForgeSession] Session expired, removing:', parsed.sessionId);
      await clearActiveForgeSession();
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[ForgeSession] Failed to load session:', error);
    return null;
  }
};

/**
 * Clears the active forge session once the user finishes, publishes, or explicitly discards.
 */
export const clearActiveForgeSession = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_FORGE_SESSION_KEY);
    console.log('[ForgeSession] Active session cleared');
  } catch (error) {
    console.warn('[ForgeSession] Failed to clear session:', error);
  }
};
