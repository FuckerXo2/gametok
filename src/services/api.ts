// GameTok API Service
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://gametok-api-6rn7.onrender.com/api';

// Token management
let authToken: string | null = null;

export const setToken = async (token: string | null) => {
  authToken = token;
  if (token) {
    await AsyncStorage.setItem('authToken', token);
  } else {
    await AsyncStorage.removeItem('authToken');
  }
};

export const getToken = async () => {
  if (!authToken) {
    authToken = await AsyncStorage.getItem('authToken');
  }
  return authToken;
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
  
  const data = await response.json();
  
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
  
  userLikes: async (userId: string) => {
    return request(`/likes/user/${userId}`);
  },
};

// Feed API
export const feed = {
  activity: async (limit = 20) => {
    return request(`/feed/activity?limit=${limit}`);
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
  
  send: async (data: { conversationId?: string; recipientId?: string; text: string }) => {
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
  get: async (gameId: string, limit = 50) => {
    return request(`/comments/${gameId}?limit=${limit}`);
  },
  
  add: async (gameId: string, text: string) => {
    return request('/comments', {
      method: 'POST',
      body: JSON.stringify({ gameId, text }),
    });
  },
  
  delete: async (commentId: string) => {
    return request(`/comments/${commentId}`, { method: 'DELETE' });
  },
};
