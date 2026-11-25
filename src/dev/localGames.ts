// While working on a game: the app (dev builds only) opens it from this Mac instead of its published copy, so a
// change shows on the simulator before anything is published. The game id -> its local URL (the game's own dev
// server, see .claude/launch.json). Keep it empty when committing.
// No Rules FC: launch config "street-5s"; ?server= keeps it on the live game server (your real account).
export const LOCAL_GAMES: Record<string, string> = __DEV__ ? {
  'supreme-fight-club': 'http://localhost:8960',
  'knockout': 'http://localhost:8990',
  'who-among-us': 'http://localhost:8998',
} : {};
