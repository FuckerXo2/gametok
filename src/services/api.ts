// GameTok API Service
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = 'https://gametok-backend-production.up.railway.app/api';
const CLIENT_ID_STORAGE_KEY = 'clientId';

// Default per-request timeout. Without this, a fetch that never settles hangs
// the caller forever (the inbox spinner never clearing was exactly this).
// Long-running endpoints (AI generation, publish) pass their own larger value;
// pass 0 to disable the timeout entirely.
const DEFAULT_TIMEOUT_MS = 20000;

const createClientId = () => `gtk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

const getClientId = async () => {
  let clientId = await AsyncStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!clientId) {
    clientId = createClientId();
    await AsyncStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }
  return clientId;
};

// Token management - always read from AsyncStorage to avoid stale cache
export const setToken = async (token: string | null) => {
  if (token) {
    console.log('[API] Saving token to AsyncStorage');
    await AsyncStorage.setItem('authToken', token);
  } else {
    console.log('[API] Clearing token from AsyncStorage');
    await AsyncStorage.removeItem('authToken');
  }
};

export const getToken = async () => {
  const token = await AsyncStorage.getItem('authToken');
  console.log('[API] Got token from AsyncStorage:', token ? 'found' : 'not found');
  return token;
};

const headers = async () => {
  const token = await getToken();
  const clientId = await getClientId();
  return {
    'Content-Type': 'application/json',
    'X-Client-Id': clientId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Generic request handler
const request = async (endpoint: string, options: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS) => {
  // Use caller's signal if provided (for cancellation), otherwise create one for timeout
  const externalSignal = options.signal as AbortSignal | undefined;
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = timeoutMs ? setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs) : null;

  // If external signal aborts, propagate to our controller
  if (externalSignal) {
    if (externalSignal.aborted) { controller.abort(); }
    else { externalSignal.addEventListener('abort', () => controller.abort(), { once: true }); }
  }

  try {
    const { signal: _, ...restOptions } = options;
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...restOptions,
      headers: await headers(),
      signal: controller.signal,
    });

    // Get response text first to handle non-JSON responses
    const text = await response.text();

    let data;
    try {
      // The backend sends whitespace heartbeats to keep connections alive.
      // Strip them before parsing JSON.
      data = JSON.parse(text.trim());
    } catch (e) {
      console.error('[API] Invalid JSON response:', text.substring(0, 200));
      const error: any = new Error(response.ok ? 'Server returned invalid response' : `Request failed with status ${response.status}`);
      error.status = response.status;
      error.responseText = text;
      throw error;
    }

    if (!response.ok) {
      const error: any = new Error(data.error || data.message || `Request failed. Dump: ${JSON.stringify(data)}`);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error: any) {
    if (didTimeout) {
      const timeoutError: any = new Error('Request timed out.');
      timeoutError.code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const requestJsonIfAvailable = async (endpoint: string, options: RequestInit = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: await headers(),
      signal: controller.signal,
    });

    const text = await response.text();
    const trimmed = text.trim();

    if (!response.ok) {
      return null;
    }

    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

// Auth API
export const auth = {
  signup: async (username: string, password: string, displayName?: string, email?: string) => {
    const data = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName, email }),
    });
    await setToken(data.token);
    return data;
  },

  login: async (username: string, password: string) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    await setToken(data.token);
    return data;
  },

  oauth: async (provider: 'apple' | 'google', oauthData: any) => {
    const data = await request('/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ provider, ...oauthData }),
    });
    await setToken(data.token);
    return data;
  },

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (e) { }
    await setToken(null);
  },

  me: async () => {
    return request('/auth/me');
  },

  deleteAccount: async () => {
    await request('/auth/delete-account', { method: 'DELETE' });
    await setToken(null);
  },
};


// Users API
export const users = {
  get: async (userId: string) => {
    return request(`/users/${userId}`);
  },

  created: async (userId: string, limit = 30) => {
    return request(`/users/${userId}/created?limit=${limit}`);
  },

  update: async (userId: string, data: { username?: string; displayName?: string; bio?: string; avatar?: string }) => {
    return request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  follow: async (userId: string) => {
    return request(`/users/${userId}/follow`, { method: 'POST' });
  },

  acceptRequest: async (userId: string) => {
    try {
      return await request(`/users/${userId}/accept-request`, { method: 'POST' });
    } catch (error: any) {
      const missingEndpoint =
        error?.status === 404 &&
        typeof error?.responseText === 'string' &&
        (error.responseText.includes('Cannot POST') || error.responseText.includes('<!DOCTYPE'));

      if (missingEndpoint) {
        return request(`/users/${userId}/follow`, { method: 'POST' });
      }

      throw error;
    }
  },

  followers: async (userId: string) => {
    return request(`/users/${userId}/followers`);
  },

  pendingRequests: async (userId: string) => {
    return request(`/users/${userId}/pending-requests`);
  },

  pendingCount: async (userId: string) => {
    return request(`/users/${userId}/pending-count`);
  },

  following: async (userId: string) => {
    return request(`/users/${userId}/following`);
  },

  played: async (userId: string, limit = 30) => {
    return request(`/users/${userId}/played?limit=${limit}`);
  },

  search: async (query: string) => {
    return request(`/users/search/${encodeURIComponent(query)}`);
  },
  recommended: async () => {
    return request(`/users/recommended`);
  }
};

// Games API
export const games = {
  list: async (limit = 10, offset = 0, options?: { sort?: string }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (options?.sort) params.set('sort', options.sort);
    return request(`/games?${params.toString()}`);
  },

  discoverLanes: async (
    tab: 'Explore' | 'Games' | 'Horror' | 'Quiz' | 'Roleplay',
    limit = 12,
  ) => {
    const params = new URLSearchParams({
      tab,
      limit: String(limit),
    });
    return request(`/games/discover-lanes?${params.toString()}`);
  },

  discoverDebug: async (
    tab: 'Explore' | 'Games' | 'Horror' | 'Quiz' | 'Roleplay',
    limit = 25,
  ) => {
    const params = new URLSearchParams({
      tab,
      limit: String(limit),
    });
    return request(`/games/discover-debug?${params.toString()}`);
  },

  trendingSummary: async (
    tab: 'Explore' | 'Games' | 'Horror' | 'Quiz' | 'Roleplay',
    limit = 5,
  ) => {
    const params = new URLSearchParams({
      tab,
      limit: String(limit),
    });
    return requestJsonIfAvailable(`/games/trending-summary?${params.toString()}`) || {
      tab,
      pulses: { searchHeat: 0, creatorsRising: 0, gamesPopping: 0 },
      topSearches: [],
      topCreators: [],
      topGames: [],
    };
  },

  top: async (
    tab: 'Explore' | 'Games' | 'Horror' | 'Quiz' | 'Roleplay',
    limit = 10,
  ) => {
    const params = new URLSearchParams({
      tab,
      limit: String(limit),
    });
    const data = await requestJsonIfAvailable(`/games/top?${params.toString()}`);
    return data || { tab, games: [] };
  },

  // Get multiplayer-only games (for Connect screen)
  multiplayer: async (limit = 50, offset = 0) => {
    return request(`/games/multiplayer?limit=${limit}&offset=${offset}`);
  },

  search: async (query: string, limit = 50) => {
    return request(`/games/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },

  get: async (gameId: string) => {
    return request(`/games/${gameId}`);
  },

  recordPlay: async (gameId: string) => {
    return request(`/games/${gameId}/play`, { method: 'POST' });
  },
};

export const search = {
  trending: async (limit = 12) => {
    const data = await requestJsonIfAvailable(`/search/trending?limit=${limit}`);
    return data || { topics: [] };
  },

  track: async (query: string, source = 'explore') => {
    const data = await requestJsonIfAvailable('/search/track', {
      method: 'POST',
      body: JSON.stringify({ query, source }),
    });
    return data || { success: false, tracked: false };
  },
};

// Scores API
export const scores = {
  submit: async (gameId: string, score: number) => {
    return request('/scores', {
      method: 'POST',
      body: JSON.stringify({ gameId, score }),
    });
  },

  leaderboard: async (gameId: string, type: 'global' | 'friends' = 'global', limit = 10) => {
    return request(`/scores/leaderboard/${gameId}?type=${type}&limit=${limit}`);
  },

  userScores: async (userId: string, limit = 20) => {
    return request(`/scores/user/${userId}?limit=${limit}`);
  },
};

// Likes API
export const likes = {
  toggle: async (gameId: string) => {
    return request('/likes', {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    });
  },

  check: async (gameIds: string[]) => {
    return request('/likes/check', {
      method: 'POST',
      body: JSON.stringify({ gameIds }),
    });
  },

  userLikes: async (userId: string) => {
    return request(`/likes/user/${userId}`);
  },
};

// Saved Games API (Bookmarks)
export const savedGames = {
  toggle: async (gameId: string) => {
    return request('/saved-games', {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    });
  },

  check: async (gameIds: string[]) => {
    return request('/saved-games/check', {
      method: 'POST',
      body: JSON.stringify({ gameIds }),
    });
  },

  userSaved: async (userId: string) => {
    return request(`/saved-games/user/${userId}`);
  },
};

// Game Progress API (Cloud Saves)
export const gameProgress = {
  get: async (gameId: string) => {
    return request(`/games/${gameId}/progress`);
  },

  save: async (gameId: string, storageData: Record<string, string>) => {
    return request(`/games/${gameId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ storageData }),
    });
  },
};

// Feed API
export const feed = {
  activity: async (limit = 20) => {
    return request(`/feed/activity?limit=${limit}`);
  },
  global: async (limit = 20) => {
    return request(`/feed/global?limit=${limit}`);
  },
};

// Stories API
export const stories = {
  list: async () => {
    return request('/stories');
  },

  create: async (mediaUrl: string, mediaType: 'image' | 'video' = 'image', caption?: string) => {
    return request('/stories', {
      method: 'POST',
      body: JSON.stringify({ mediaUrl, mediaType, caption }),
    });
  },

  view: async (storyId: string) => {
    return request(`/stories/${storyId}/view`, { method: 'POST' });
  },

  delete: async (storyId: string) => {
    return request(`/stories/${storyId}`, { method: 'DELETE' });
  },
};

// Messages API
export const messages = {
  getConversations: async () => {
    return request('/conversations');
  },

  getConversation: async (userId: string) => {
    return request(`/conversations/${userId}`);
  },

  send: async (data: { conversationId?: string; recipientId?: string; text?: string; gameShare?: { gameId: string } }) => {
    return request('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  markRead: async (messageId: string) => {
    return request(`/messages/${messageId}/read`, { method: 'POST' });
  },
};

// Comments API
export const comments = {
  list: async (gameId: string, limit = 50) => {
    return request(`/comments/${gameId}?limit=${limit}`);
  },

  create: async (gameId: string, text: string, gifUrl?: string) => {
    return request('/comments', {
      method: 'POST',
      body: JSON.stringify({ gameId, text, gifUrl }),
    });
  },

  like: async (commentId: string) => {
    return request(`/comments/${commentId}/like`, { method: 'POST' });
  },

  delete: async (commentId: string) => {
    return request(`/comments/${commentId}`, { method: 'DELETE' });
  },
};

// Moderation API (report, block)
export const moderation = {
  report: async (userId: string, reason: string, details?: string, contentType?: string, contentId?: string) => {
    return request('/report', {
      method: 'POST',
      body: JSON.stringify({ userId, reason, details, contentType, contentId }),
    });
  },

  block: async (userId: string) => {
    return request('/block', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  unblock: async (userId: string) => {
    return request(`/block/${userId}`, { method: 'DELETE' });
  },

  getBlockedUsers: async () => {
    return request('/blocked');
  },
};

// Gamification API
// Gamification API - REMOVED
// All gamification endpoints have been removed
export const gamification = {
  getStats: async () => ({
    points: {
      balance: 0,
      lifetimeEarned: 0,
      usdValue: 0,
      coinsPerUsd: 5667,
    },
    streak: {
      current: 0,
      longest: 0,
      lastClaimDate: null,
      multiplier: 1,
    },
  }),
  getChallenges: async () => ({
    challenges: [],
  }),
  getAchievements: async () => ({
    achievements: [],
  }),
  getRewards: async () => ({
    rewards: [],
  }),
  claimChallenge: async (_challengeId: string) => ({
    success: true,
    pointsEarned: 0,
  }),
  claimReward: async (_rewardId: string) => ({
    success: true,
    newBalance: 0,
  }),
  claimAdReward: async () => ({
    success: true,
    pointsEarned: 0,
    newBalance: 0,
  }),
  getGameLeaderboard: async (_gameId: string, _limit = 100) => ({
    leaderboard: [],
  }),
};

// Multiplayer API
export const multiplayer = {
  // Matchmaking
  joinQueue: async (matchType: '1v1' | '2v2') => {
    return request('/multiplayer/queue/join', {
      method: 'POST',
      body: JSON.stringify({ matchType }),
    });
  },

  leaveQueue: async (queueId: string) => {
    return request('/multiplayer/queue/leave', {
      method: 'DELETE',
      body: JSON.stringify({ queueId }),
    });
  },

  getQueueStatus: async () => {
    return request('/multiplayer/queue/status');
  },

  // Matches
  getActiveMatches: async () => {
    return request('/multiplayer/matches/active');
  },

  getMatch: async (matchId: string) => {
    return request(`/multiplayer/matches/${matchId}`);
  },

  setMatchGame: async (matchId: string, gameId: string) => {
    return request(`/multiplayer/matches/${matchId}/game`, {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    });
  },

  updateScore: async (matchId: string, score: number) => {
    return request(`/multiplayer/matches/${matchId}/score`, {
      method: 'POST',
      body: JSON.stringify({ score }),
    });
  },

  completeMatch: async (matchId: string) => {
    return request(`/multiplayer/matches/${matchId}/complete`, {
      method: 'POST',
    });
  },

  getMatchHistory: async (limit = 20) => {
    return request(`/multiplayer/matches/history?limit=${limit}`);
  },

  // Challenges
  sendChallenge: async (toUserId: string, gameId: string, matchType: '1v1' | '2v2', message?: string) => {
    return request('/multiplayer/challenges/send', {
      method: 'POST',
      body: JSON.stringify({ toUserId, gameId, matchType, message }),
    });
  },

  acceptChallenge: async (challengeId: string) => {
    return request(`/multiplayer/challenges/${challengeId}/accept`, {
      method: 'POST',
    });
  },

  declineChallenge: async (challengeId: string) => {
    return request(`/multiplayer/challenges/${challengeId}/decline`, {
      method: 'POST',
    });
  },

  getReceivedChallenges: async () => {
    return request('/multiplayer/challenges/received');
  },
};

// // DreamStream AI Engine API
export const ai = {
  cancelDreamJob: async (jobId: string) => {
    return request(`/ai/dream/cancel/${jobId}`, { method: 'POST' });
  },

  retryDreamJob: async (jobId: string) => {
    return request(`/ai/dream/retry/${jobId}`, { method: 'POST' });
  },

  narrativeChat: async (messages: { role: 'ai' | 'user'; text: string }[]) => {
    return request('/ai/narrative/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }, 45000);
  },

  generateSpec: async (prompt: string) => {
    return request('/ai/generate-spec', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }, 30000);
  },

  refineSpec: async (conversationHistory: Array<{ role: 'ai' | 'user'; content: string }>, userMessage: string) => {
    return request('/ai/refine-spec', {
      method: 'POST',
      body: JSON.stringify({ conversationHistory, userMessage }),
    }, 30000);
  },

  interpretEdit: async (payload: {
    instructions: string;
    gameTitle?: string;
    currentSummary?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) => {
    return request('/ai/interpret-edit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 25000);
  },

  // Apply an edit to an existing game: POST /ai/edit returns a jobId, then poll
  // /ai/dream/status/:jobId (the same status endpoint, which surfaces edit progress).
  editGame: (
    draftId: string,
    instructions: string,
    attachments: Array<{ type: string; role?: string; url: string; instruction: string; label?: string }> = [],
    options?: { onStatus?: (status: any) => void },
  ) => {
    const controller = new AbortController();
    const promise = new Promise<any>(async (resolve, reject) => {
      try {
        const res = await request('/ai/edit', {
          method: 'POST',
          body: JSON.stringify({ draftId, instructions, attachments }),
          signal: controller.signal,
        }, 60000);
        const jobId = res.jobId;
        if (!jobId) { reject(new Error(res.error || 'Edit did not start')); return; }
        let errs = 0;
        const interval = setInterval(async () => {
          if (controller.signal.aborted) { clearInterval(interval); reject(new Error('aborted')); return; }
          try {
            const status = await request(`/ai/dream/status/${jobId}`);
            options?.onStatus?.(status);
            if (status.status === 'complete') { clearInterval(interval); resolve(status); }
            else if (status.status === 'error') { clearInterval(interval); reject(new Error(status.error || 'Edit failed')); }
            errs = 0;
          } catch (e: any) {
            if (++errs >= 10) { clearInterval(interval); reject(new Error('Lost connection to the edit job.')); }
          }
        }, 2500);
        controller.signal.addEventListener('abort', () => clearInterval(interval));
      } catch (e) { reject(e); }
    });
    return { promise, cancel: () => controller.abort() };
  },

  dreamLabs: (
    prompt: string,
    attachments: any[] = [],
    options?: { onJobStarted?: (jobId: string) => void; onStatus?: (status: any) => void },
  ) => {
    const controller = new AbortController();
    let remoteJobId: string | null = null;

    const cancelRemoteJob = () => {
      controller.abort();
      if (remoteJobId) {
        request(`/ai/dream/cancel/${remoteJobId}`, { method: 'POST' })
          .catch((err: any) => console.warn('[DreamLabs] Remote cancel failed:', err?.message || err));
      }
    };
    
    const promise = new Promise(async (resolve, reject) => {
      try {
        const res = await request('/ai/dream-labs', {
          method: 'POST',
          body: JSON.stringify({ prompt, attachments }),
          signal: controller.signal,
        }, 300000); // Allow up to 5 minutes for the initial DreamLabs job handshake

        if (!res.jobId && res.htmlPreview) {
          resolve(res);
          return;
        }

        const jobId = res.jobId;
        remoteJobId = jobId || null;
        if (jobId) {
          options?.onJobStarted?.(jobId);
        }
        console.log(`[DreamLabs] Background Job ${jobId} initiated. Polling status...`);

        let pollErrorCount = 0;
        const interval = setInterval(async () => {
          if (controller.signal.aborted) {
            clearInterval(interval);
            reject(new Error('aborted'));
            return;
          }

          try {
            const statusRes = await request(`/ai/dream/status/${jobId}`);
            options?.onStatus?.(statusRes);
            
            if (statusRes.status === 'complete') {
              clearInterval(interval);
              resolve(statusRes);
            } else if (statusRes.status === 'error') {
              clearInterval(interval);
              reject(new Error(statusRes.error || 'Unknown AI server error'));
            } else if (statusRes.status === 'canceled') {
              clearInterval(interval);
              reject(new Error(statusRes.error || 'Generation cancelled'));
            }
            // Reset error count on successful poll
            pollErrorCount = 0;
          } catch (pollingErr: any) {
            pollErrorCount++;
            console.warn(`[DreamLabs] Polling error ${pollErrorCount}/10:`, pollingErr.message);
            // After 10 consecutive errors (50 seconds), give up
            if (pollErrorCount >= 10) {
              clearInterval(interval);
              reject(new Error('Generation lost - server may have restarted. Please try again.'));
            }
          }
        }, 5000);

        controller.signal.addEventListener('abort', () => clearInterval(interval));
        
      } catch (err) {
        reject(err);
      }
    });

    return { promise, cancel: () => controller.abort(), cancelRemote: cancelRemoteJob };
  },
  dream: (
    prompt: string,
    attachments: any[] = [],
    options?: { onJobStarted?: (jobId: string) => void; onStatus?: (status: any) => void },
  ) => {
    const controller = new AbortController();
    let remoteJobId: string | null = null;

    const cancelRemoteJob = () => {
      controller.abort();
      if (remoteJobId) {
        request(`/ai/dream/cancel/${remoteJobId}`, { method: 'POST' })
          .catch((err: any) => console.warn('[DreamStream] Remote cancel failed:', err?.message || err));
      }
    };
    
    const promise = new Promise(async (resolve, reject) => {
      try {
        // Step 1: Tell backend to start generation process and return immediately
        const res = await request('/ai/dream', {
          method: 'POST',
          body: JSON.stringify({ prompt, attachments }),
          signal: controller.signal,
        }, 300000); // Allow up to 5 minutes for the initial Dream job handshake

        // Fallback or legacy instant-return support
        if (!res.jobId && res.htmlPreview) {
          resolve(res);
          return;
        }

        const jobId = res.jobId;
        remoteJobId = jobId || null;
        if (jobId) {
          options?.onJobStarted?.(jobId);
        }
        console.log(`[DreamStream] Background Job ${jobId} initiated. Polling status...`);

        // Step 2: Poll the backend every 5 seconds until generation finishes
        let pollErrorCount = 0;
        const interval = setInterval(async () => {
          if (controller.signal.aborted) {
            clearInterval(interval);
            reject(new Error('aborted'));
            return;
          }

          try {
            const statusRes = await request(`/ai/dream/status/${jobId}?t=${Date.now()}`);
            options?.onStatus?.(statusRes);
            
            if (statusRes.status === 'complete') {
              clearInterval(interval);
              resolve(statusRes);
            } else if (statusRes.status === 'error') {
              clearInterval(interval);
              reject(new Error(statusRes.error || 'Unknown AI server error'));
            } else if (statusRes.status === 'canceled') {
              clearInterval(interval);
              reject(new Error(statusRes.error || 'Generation cancelled'));
            } else {
              // Status is 'pending', just keep waiting
              console.log(`[DreamStream] Job ${jobId} is still pending...`);
            }
            // Reset error count on successful poll
            pollErrorCount = 0;
          } catch (pollingErr: any) {
            pollErrorCount++;
            console.warn(`[DreamStream] Polling error ${pollErrorCount}/10:`, pollingErr.message);
            // After 10 consecutive errors (50 seconds), give up
            if (pollErrorCount >= 10) {
              clearInterval(interval);
              reject(new Error('Generation lost - server may have restarted. Please try again.'));
            }
          }
        }, 5000);

        controller.signal.addEventListener('abort', () => clearInterval(interval));
        
      } catch (err) {
        reject(err);
      }
    });

    return { promise, cancel: () => controller.abort(), cancelRemote: cancelRemoteJob };
  },
  resumeDreamJob: (jobId: string, options?: { onStatus?: (status: any) => void }) => {
    const controller = new AbortController();

    const promise = new Promise(async (resolve, reject) => {
      try {
        const checkStatus = async () => {
          const statusRes = await request(`/ai/dream/status/${jobId}?t=${Date.now()}`);
          options?.onStatus?.(statusRes);
          if (statusRes.status === 'complete') {
            resolve(statusRes);
            return true;
          }
          if (statusRes.status === 'error') {
            reject(new Error(statusRes.error || 'Unknown AI server error'));
            return true;
          }
          if (statusRes.status === 'canceled') {
            reject(new Error(statusRes.error || 'Generation cancelled'));
            return true;
          }
          return false;
        };

        const resolvedImmediately = await checkStatus();
        if (resolvedImmediately) {
          return;
        }

        let pollErrorCount = 0;
        const interval = setInterval(async () => {
          if (controller.signal.aborted) {
            clearInterval(interval);
            reject(new Error('aborted'));
            return;
          }

          try {
            const resolved = await checkStatus();
            if (resolved) {
              clearInterval(interval);
            }
            pollErrorCount = 0;
          } catch (pollingErr: any) {
            pollErrorCount++;
            console.warn(`[DreamStream] Resume polling error ${pollErrorCount}/10:`, pollingErr.message);
            if (pollErrorCount >= 10) {
              clearInterval(interval);
              reject(new Error('Generation lost - server may have restarted. Please try again.'));
            }
          }
        }, 5000);

        controller.signal.addEventListener('abort', () => clearInterval(interval));
      } catch (err) {
        reject(err);
      }
    });

    return { promise, cancel: () => controller.abort() };
  },
  edit: (draftId: string, instructions: string, newAsset?: any, attachments: any[] = []) => {
    const controller = new AbortController();
    
    const promise = new Promise(async (resolve, reject) => {
      try {
        const res = await request('/ai/edit', {
          method: 'POST',
          body: JSON.stringify({ draftId, instructions, newAsset, attachments }),
          signal: controller.signal,
        }, 300000); // Allow up to 5 minutes for the initial edit job handshake

        if (!res.jobId && res.htmlPreview) {
          resolve(res);
          return;
        }

        const jobId = res.jobId;
        const interval = setInterval(async () => {
          if (controller.signal.aborted) {
            clearInterval(interval);
            reject(new Error('aborted'));
            return;
          }

          try {
            const statusRes = await request(`/ai/dream/status/${jobId}?t=${Date.now()}`);
            if (statusRes.status === 'complete') {
              clearInterval(interval);
              resolve(statusRes);
            } else if (statusRes.status === 'error') {
              clearInterval(interval);
              reject(new Error(statusRes.error || 'Unknown AI server error'));
            } else if (statusRes.status === 'canceled') {
              clearInterval(interval);
              reject(new Error(statusRes.error || 'Generation cancelled'));
            }
          } catch (pollingErr: any) {
            console.warn('[DreamStream] Polling blip (ignoring):', pollingErr.message);
          }
        }, 5000);

        controller.signal.addEventListener('abort', () => clearInterval(interval));
      } catch (err) {
        reject(err);
      }
    });

    return { promise, cancel: () => controller.abort() };
  },
  generateAsset: async (prompt: string) => {
    return request('/ai/generate-asset', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
  },
  drafts: async () => {
    return request('/ai/drafts');
  },
  getDraft: async (draftId: string) => {
    return request(`/ai/drafts/${draftId}`);
  },
  // Remix a public published game -> returns a fresh draft owned by the current user.
  remixGame: async (sourceId: string) => {
    return request(`/ai/remix/${sourceId}`, { method: 'POST' });
  },
  deleteDraft: async (draftId: string) => {
    return request(`/ai/drafts/${draftId}`, { method: 'DELETE' });
  },
  publish: async (draftId: string, title?: string, privacy?: string, html?: string) => {
    // Publishing uploads the full game HTML — allow longer than the default.
    return request(`/ai/publish/${draftId}`, { method: 'POST', body: JSON.stringify({ title, privacy, html }) }, 60000);
  },
  reclassifyPublished: async (draftId?: string, limit = 20) => {
    return request('/ai/reclassify-published', {
      method: 'POST',
      body: JSON.stringify({ draftId, limit }),
    });
  },
};
