// GameTok API Service
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = 'https://gametok-backend-production.up.railway.app/api';

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
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Generic request handler
const request = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: await headers(),
  });
  
  // Get response text first to handle non-JSON responses
  const text = await response.text();
  
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('[API] Invalid JSON response:', text.substring(0, 200));
    throw new Error('Server returned invalid response');
  }
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
};

// Auth API
export const auth = {
  signup: async (username: string, password: string, displayName?: string) => {
    const data = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
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
    } catch (e) {}
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
  
  update: async (userId: string, data: { displayName?: string; bio?: string; avatar?: string }) => {
    return request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  follow: async (userId: string) => {
    return request(`/users/${userId}/follow`, { method: 'POST' });
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
  
  search: async (query: string) => {
    return request(`/users/search/${encodeURIComponent(query)}`);
  },
};

// Games API
export const games = {
  list: async (limit = 10, offset = 0) => {
    return request(`/games?limit=${limit}&offset=${offset}`);
  },
  
  get: async (gameId: string) => {
    return request(`/games/${gameId}`);
  },
  
  recordPlay: async (gameId: string) => {
    return request(`/games/${gameId}/play`, { method: 'POST' });
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
  
  create: async (gameId: string, text: string) => {
    return request('/comments', {
      method: 'POST',
      body: JSON.stringify({ gameId, text }),
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
export const gamification = {
  // Get user's points, streak, and level stats
  getStats: async () => {
    return request('/gamification/stats');
  },
  
  // Claim daily login bonus
  claimDaily: async () => {
    return request('/gamification/daily-claim', { method: 'POST' });
  },
  
  // Record game played (awards points/XP)
  gamePlayed: async (gameId: string, playTimeSeconds?: number) => {
    return request('/gamification/game-played', {
      method: 'POST',
      body: JSON.stringify({ gameId, playTimeSeconds }),
    });
  },
  
  // Get daily challenges
  getChallenges: async () => {
    return request('/gamification/challenges');
  },
  
  // Claim challenge reward
  claimChallenge: async (challengeId: string) => {
    return request(`/gamification/challenges/${challengeId}/claim`, { method: 'POST' });
  },
  
  // Get all achievements
  getAchievements: async () => {
    return request('/gamification/achievements');
  },
  
  // Get rewards shop
  getRewards: async () => {
    return request('/gamification/rewards');
  },
  
  // Claim a reward
  claimReward: async (rewardId: string) => {
    return request(`/gamification/rewards/${rewardId}/claim`, { method: 'POST' });
  },
  
  // Get user's claimed rewards
  getMyRewards: async () => {
    return request('/gamification/my-rewards');
  },
  
  // Get points transaction history
  getTransactions: async (limit = 50) => {
    return request(`/gamification/transactions?limit=${limit}`);
  },
  
  // Get leaderboard
  getLeaderboard: async (type: 'points' | 'level' | 'streak' = 'points', limit = 50) => {
    return request(`/gamification/leaderboard?type=${type}&limit=${limit}`);
  },
};
