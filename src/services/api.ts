// GameTok API Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHOWCASE } from '../dev/showcase';

export const API_URL = 'https://gametok-backend-267787411422.us-central1.run.app/api';


const CLIENT_ID_STORAGE_KEY = 'clientId';

// Default per-request timeout. Without this, a fetch that never settles hangs
// the caller forever (the inbox spinner never clearing was exactly this).
// Long-running endpoints (AI generation, publish) pass their own larger value;
// pass 0 to disable the timeout entirely.
const DEFAULT_TIMEOUT_MS = 45000;

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
    const cleanEndpoint = endpoint.startsWith('/api/')
      ? endpoint.slice(4)
      : (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
    const response = await fetch(`${API_URL}${cleanEndpoint}`, {
      ...restOptions,
      headers: await headers(),
      signal: controller.signal,
    });

    // Get response text first to handle non-JSON responses
    const text = await response.text();

    let data: any = null;
    try {
      // The backend sends whitespace heartbeats to keep connections alive.
      // Strip them before parsing JSON.
      data = JSON.parse(text.trim());
    } catch (e) {
      if (!response.ok) {
        const error: any = new Error(`Request failed with status ${response.status}`);
        error.status = response.status;
        error.responseText = text;
        throw error;
      }
      console.warn('[API] Non-JSON response received:', text.substring(0, 100));
      const error: any = new Error('Server returned invalid response');
      error.status = response.status;
      error.responseText = text;
      throw error;
    }

    if (!response.ok) {
      const error: any = new Error(data.error || data.message || `Request failed. Dump: ${JSON.stringify(data)}`);
      error.status = response.status;
      // Carry the machine-readable code through so callers can react to a specific failure
      // instead of string-matching the human message.
      if (data.code) error.code = data.code;
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
  // Sign up like Roblox: birthday (YYYY-MM-DD), username, password; signed in at once
  signup: async (username: string, password: string, birthday: string) => {
    const data = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, birthday }),
    });
    await setToken(data.token);
    return data;
  },

  login: async (username: string, password: string) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, noCode: true }),
    });
    await setToken(data.token);
    return data;
  },

  changePassword: async (current: string, next: string) =>
    request('/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) }),

  // Is this username free? { available, valid }
  usernameAvailable: async (username: string): Promise<{ available: boolean; valid: boolean }> =>
    request(`/auth/username-available?username=${encodeURIComponent(username)}`),

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

  // who's online and which game they're in: { statuses: {id: status}, games: {id: gameId} }
  presence: async (userIds: string[]): Promise<{ statuses: Record<string, string>; games?: Record<string, string> }> =>
    request(`/presence?userIds=${userIds.map(encodeURIComponent).join(',')}`),
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

// Games API — exclusively scoped to No Rules FC
const isNoRulesFC = (game: any) => {
  if (!game) return false;
  const id = String(game.id || '').toLowerCase();
  const name = String(game.name || '').toLowerCase();
  return id === 'no-rules-fc' || id === 'street-5s' || /no rules fc/i.test(name) || /rules/i.test(name);
};

export const NO_RULES_FC_GAME = {
  id: 'no-rules-fc',
  name: 'No Rules FC',
  description: '5v5 hero football. No ref, no fouls, every hero has a super.',
  icon: '🎮',
  color: '#ff3a6a',
  thumbnail: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/web-games/no-rules-fc/thumb.jpg',
  previewVideoUrl: null,
  categories: ['sports', 'action', 'arcade'],
  embedUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/web-games/no-rules-fc/b395235fa095/index.html',
  orientation: 'landscape' as 'landscape' | 'portrait',
  platform: 'all',
  creatorDisplayName: 'GameTOK',
  creatorUsername: 'gametok',
  plays: 100,
  likes: 12,
  status: 'published',
};

const ensureNoRulesFC = (list: any[]) => {
  if (SHOWCASE) return list.filter((g) => g.thumbnail);   // dev showcase: every game with a picture
  const filtered = list.filter(isNoRulesFC).map((g) => ({
    ...g,
    categories: g.categories && g.categories.length ? g.categories : ['sports', 'action', 'arcade'],
  }));
  return filtered.length > 0 ? filtered : [NO_RULES_FC_GAME];
};

export const games = {
  list: async (limit = 10, offset = 0, options?: { sort?: string }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (options?.sort) params.set('sort', options.sort);
    try {
      const data = await request(`/games?${params.toString()}`);
      const filtered = ensureNoRulesFC(data?.games || []);
      return { ...data, games: filtered, total: filtered.length };
    } catch {
      return { games: [NO_RULES_FC_GAME], total: 1 };
    }
  },

  discoverLanes: async (
    tab: 'Explore' | 'Games' | 'Horror' | 'Quiz' | 'Roleplay',
    limit = 12,
  ) => {
    return {
      lanes: [
        {
          id: 'nrfc-featured',
          title: 'Featured Game',
          games: [NO_RULES_FC_GAME],
        },
      ],
    };
  },

  discoverDebug: async (
    tab: 'Explore' | 'Games' | 'Horror' | 'Quiz' | 'Roleplay',
    limit = 25,
  ) => {
    return { games: [NO_RULES_FC_GAME] };
  },

  trendingSummary: async (
    tab: 'Explore' | 'Games' | 'Horror' | 'Quiz' | 'Roleplay',
    limit = 5,
  ) => {
    return {
      tab,
      pulses: { searchHeat: 10, creatorsRising: 1, gamesPopping: 1 },
      topSearches: ['No Rules FC'],
      topCreators: [],
      topGames: [NO_RULES_FC_GAME],
    };
  },

  top: async (
    tab: 'Explore' | 'Games' | 'Horror' | 'Quiz' | 'Roleplay',
    limit = 10,
  ) => {
    return { tab, games: [NO_RULES_FC_GAME] };
  },

  // Get multiplayer-only games (for Connect screen)
  multiplayer: async (limit = 50, offset = 0) => {
    return { games: [NO_RULES_FC_GAME], total: 1 };
  },

  search: async (query: string, limit = 50) => {
    const q = query.trim().toLowerCase();
    const matches = !q || 'no rules fc'.includes(q) || 'football'.includes(q) || 'sports'.includes(q) || 'soccer'.includes(q);
    return { games: matches ? [NO_RULES_FC_GAME] : [] };
  },

  get: async (gameId: string) => {
    try {
      const data = await request(`/games/${gameId}`);
      if (data?.game && isNoRulesFC(data.game)) {
        return {
          ...data,
          game: {
            ...data.game,
            categories: data.game.categories && data.game.categories.length ? data.game.categories : ['sports', 'action', 'arcade'],
          },
        };
      }
    } catch {}
    return { game: NO_RULES_FC_GAME };
  },

  // A play: returns { counted, sessionId }. Report time played to the session with sessionTime.
  recordPlay: async (gameId: string) => {
    return request(`/games/${gameId}/play`, { method: 'POST' });
  },

  // The game came on screen. Fire-and-forget.
  recordView: (gameId: string) => {
    request(`/games/${gameId}/view`, { method: 'POST' }).catch(() => {});
  },

  // Seconds played so far in a play session. Fire-and-forget.
  sessionTime: (gameId: string, sessionId: string, seconds: number) => {
    request(`/games/${gameId}/sessions/${sessionId}`, { method: 'POST', body: JSON.stringify({ seconds }) }).catch(() => {});
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
// Who's playing a game (bridge.js GameTok.init()/session()): a short-lived signed player session
// for that game, as the signed-in user or, with no account, a guest tied to this device.
export const playerSessions = {
  // joinFriend: a friend's GameTok id (their Join): the reply carries who they are in this game
  create: async (gameId: string, joinFriend?: string | null) =>
    request(`/games/${encodeURIComponent(gameId)}/player-session`, { method: 'POST', ...(joinFriend ? { body: JSON.stringify({ joinFriend }) } : {}) }),
};

// The player's 3D avatar, owned items and TokBux, on their account (backend src/avatar-router.js).
// Prices are the server's; a purchase only counts once the server says so.
export const avatarAccount = {
  me: async () => request('/avatar/me'),
  items: async () => request('/avatar/items'),   // the Shop's items (no sign-in needed)
  feed: async () => request('/avatar/feed'),     // the Shop's front page order, for you (signed in or not)
  save: async (avatar: object) => request('/avatar/me', { method: 'PUT', body: JSON.stringify({ avatar }) }),
  buy: async (itemId: string, price?: number) => request('/avatar/buy', { method: 'POST', body: JSON.stringify({ itemId, price }) }),
  // the headshot of the 3D avatar (a PNG data: URL from the stage) becomes the profile picture
  headshot: async (png: string) => request('/avatar/headshot', { method: 'PUT', body: JSON.stringify({ png }) }),
};

// TokBux bought in the store: the backend checks the purchase with Apple / Google and adds the pack once
// (backend src/tokbux-store.js). token: Apple's signed transaction, or Google's purchase token.
export const tokbuxStore = {
  verify: async (platform: string, productId: string, token: string) =>
    request('/tokbux/verify', { method: 'POST', body: JSON.stringify({ platform, productId, token }) }),
};

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
