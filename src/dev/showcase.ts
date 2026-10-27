// Showcase: a development-only switch that fills the Games screen like the design mock (gametok/design/games-mocks):
// the backend's other games as stand-ins, and three sample friends online. Never on in a release build (__DEV__).
// Sample headshots come from the avatar-editor server on the Mac (launch config "avatar-editor").
export const SHOWCASE = __DEV__ && false;

const HEADS = 'http://localhost:8980/assets/thumbs';
// which friends situation to show: 'mixed' (some in games, one in the app, some offline), 'offline', 'none'
export const SHOWCASE_STATE = 'mixed' as 'mixed' | 'offline' | 'none';
const h = (n: number) => new Date(Date.now() - n * 3600e3).toISOString();
const f = (name: string, status: string, extra: object = {}) => ({ id: `demo-${name}`, name, avatar: `${HEADS}/head-${name}.png`, status, ...extra });
const OFF = [f('kola', 'offline', { lastAt: h(2), lastGame: 'gta-lagos' }), f('zee', 'offline', { lastAt: h(26), lastGame: 'backroom-escape' }), f('dami', 'offline', { lastAt: h(75) })];
export const SHOWCASE_FRIENDS = SHOWCASE_STATE === 'none' ? []
  : SHOWCASE_STATE === 'offline' ? OFF
  : [f('tobi', 'in-game', { gameId: 'no-rules-fc' }), f('ada', 'online'), ...OFF];
export const SHOWCASE_RECENT = ['no-rules-fc', 'turbo-kart-rush', 'gta-lagos'];
