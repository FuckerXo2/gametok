// API client for SwipePlay backend

// Change this to your actual backend URL when deployed
const API_URL = 'http://localhost:3000/api';

export interface Game {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  game_url: string;
  thumbnail_url: string | null;
  play_count: number;
  like_count: number;
}

export interface User {
  id: string;
  username: string | null;
}

// ============================================
// GAMES
// ============================================

export const getGames = async (limit = 10, offset = 0): Promise<{ games: Game[]; total: number }> => {
  const response = await fetch(`${API_URL}/games?limit=${limit}&offset=${offset}`);
  return response.json();
};

export const getGame = async (id: string): Promise<{ game: Game }> => {
  const response = await fetch(`${API_URL}/games/${id}`);
  return response.json();
};

export const recordPlay = async (gameId: string): Promise<void> => {
  await fetch(`${API_URL}/games/${gameId}/play`, { method: 'POST' });
};

// ============================================
// USERS
// ============================================

export const createUser = async (username?: string): Promise<{ user: User }> => {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  return response.json();
};

export const getUser = async (id: string): Promise<{ user: User; stats: any }> => {
  const response = await fetch(`${API_URL}/users/${id}`);
  return response.json();
};

// ============================================
// SCORES
// ============================================

export const submitScore = async (gameId: string, score: number, userId?: string): Promise<void> => {
  await fetch(`${API_URL}/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, score, user_id: userId }),
  });
};

export const getLeaderboard = async (gameId: string, limit = 10): Promise<{ leaderboard: any[] }> => {
  const response = await fetch(`${API_URL}/scores/leaderboard/${gameId}?limit=${limit}`);
  return response.json();
};

// ============================================
// LIKES
// ============================================

export const toggleLike = async (userId: string, gameId: string): Promise<{ liked: boolean }> => {
  const response = await fetch(`${API_URL}/likes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, game_id: gameId }),
  });
  return response.json();
};

export const checkLike = async (userId: string, gameId: string): Promise<{ liked: boolean }> => {
  const response = await fetch(`${API_URL}/likes/check/${userId}/${gameId}`);
  return response.json();
};

export const getUserLikes = async (userId: string): Promise<{ games: Game[] }> => {
  const response = await fetch(`${API_URL}/likes/${userId}`);
  return response.json();
};
