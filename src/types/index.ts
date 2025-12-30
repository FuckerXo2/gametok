export interface GameConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface GameState {
  score: number;
  isPlaying: boolean;
  isGameOver: boolean;
  highScore: number;
}

export interface GameCallbacks {
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onStart: () => void;
}
