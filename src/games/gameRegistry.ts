import { GameConfig } from '../types';

export const GAMES: GameConfig[] = [
  {
    id: 'no-rules-fc',
    name: 'No Rules FC',
    description: '5v5 hero football. No ref, no fouls, every hero has a super.',
    color: '#ff3a6a',
    icon: '⚽',
  },
];

export const getRandomGame = (): GameConfig => {
  return GAMES[0];
};

export const getGameById = (id: string): GameConfig | undefined => {
  return GAMES.find(game => game.id === id) || GAMES[0];
};
