// Showcase: a development-only switch that fills the Games screen like the design mock (gametok/design/games-mocks):
// the backend's other games as stand-ins, and three sample friends online. Never on in a release build (__DEV__).
// Sample headshots come from the avatar-editor server on the Mac (launch config "avatar-editor").
export const SHOWCASE = __DEV__ && false;

const HEADS = 'http://localhost:8980/assets/thumbs';
export const SHOWCASE_FRIENDS = [
  { id: 'demo-tobi', name: 'tobi', avatar: `${HEADS}/head-tobi.png`, status: 'in-game', gameId: 'no-rules-fc' },
  { id: 'demo-ada', name: 'ada', avatar: `${HEADS}/head-ada.png`, status: 'in-game', gameId: 'turbo-kart-rush' },
  { id: 'demo-kola', name: 'kola', avatar: `${HEADS}/head-kola.png`, status: 'in-game', gameId: 'gta-lagos' },
];
export const SHOWCASE_RECENT = ['no-rules-fc', 'turbo-kart-rush', 'gta-lagos'];
