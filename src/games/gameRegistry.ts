import { GameConfig } from '../types';

export const GAMES: GameConfig[] = [
  {
    id: 'pacman',
    name: 'Pac-Man',
    description: 'Eat dots, avoid ghosts! Classic arcade action 👻',
    color: '#FFFF00',
    icon: '🟡',
  },
  {
    id: 'fruit-slicer',
    name: 'Fruit Slicer',
    description: 'Swipe to slice fruits! Avoid bombs 💣',
    color: '#ff6b6b',
    icon: '🍉',
  },
];

export const getRandomGame = (): GameConfig => {
  return GAMES[Math.floor(Math.random() * GAMES.length)];
};

export const getGameById = (id: string): GameConfig | undefined => {
  return GAMES.find(game => game.id === id);
};
