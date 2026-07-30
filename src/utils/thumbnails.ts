import { API_URL } from '../services/api';

const GAMES_HOST = 'https://games.gametok.co';
const API_ORIGIN = API_URL.replace(/\/api$/, '');

type ThumbnailGame = {
  id?: string | null;
  name?: string | null;
  title?: string | null;
};

export const resolveGameThumbnail = (
  thumbnail?: string | null,
  _gameId?: string | null,
  _game?: ThumbnailGame | null,
) => {
  const value = thumbnail?.trim();
  if (value) {
    if (value.startsWith('http') || value.startsWith('data:')) return value;

    if (value.startsWith('/uploads/covers/') || value.startsWith('uploads/covers/')) {
      return `${API_ORIGIN}/${value.replace(/^\/+/, '')}`;
    }

    if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
    if (value.startsWith('uploads/') || value.startsWith('covers/')) return `${API_ORIGIN}/${value}`;
    return `${GAMES_HOST}/${value.replace(/^\/+/, '')}`;
  }

  return 'https://gametok.co/app-assets/dream-forge-hero.png';
};
