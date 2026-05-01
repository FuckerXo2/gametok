import { API_URL } from '../services/api';

const GAMES_HOST = 'https://games.gametok.co';
const API_ORIGIN = API_URL.replace(/\/api$/, '');

type ThumbnailGame = {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  primaryTab?: string | null;
};

const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const pick = <T,>(items: T[], seed: number) => items[seed % items.length];

const STYLE_BY_KIND: Record<string, string[]> = {
  horror: [
    'grainy psychological horror still, desaturated blue black palette, lonely hallway, uneasy negative space',
    'found footage horror frame, dim flashlight beam, VHS noise, realistic shadows, oppressive atmosphere',
    'gothic survival-horror poster, fog, candlelit silhouettes, restrained crimson accents',
  ],
  racing: [
    'low angle racing photo-illustration, wet asphalt, motion blur, speed lines, chrome reflections',
    'arcade racing splash screen, dynamic car chase, sunset road, exaggerated perspective',
    'futuristic cockpit racing scene, glowing dashboard, tunnel lights, long exposure streaks',
  ],
  puzzle: [
    'clean isometric puzzle diorama, tactile blocks, soft studio lighting, clever geometric layout',
    'minimal brain teaser illustration, crisp shapes, high contrast symbols, calm matte palette',
    'cozy tabletop puzzle scene, cards and tokens, warm desk lamp, shallow depth of field',
  ],
  quiz: [
    'bright quiz-show stage, glowing podiums, confetti, playful question-mark props, game night energy',
    'social trivia party illustration, friends around phones, colorful lights, expressive faces',
    'bold educational game card, icons and abstract shapes, polished editorial style',
  ],
  roleplay: [
    'anime-inspired visual novel key scene, expressive character portrait, soft background depth',
    'fantasy roleplay world illustration, castle town, adventurer silhouettes, storybook lighting',
    'immersive social room scene, cozy neon lounge, avatars gathering, conversational mood',
  ],
  arcade: [
    'retro arcade cabinet attract-screen art, pixel energy, chunky shapes, saturated playful palette',
    'toy-like mobile arcade scene, floating collectibles, clean 3D clay render, cheerful lighting',
    'comic action game panel, bold outlines, kinetic pose, punchy colors, halftone texture',
  ],
  action: [
    'cinematic action game scene, dramatic pose, debris, rim lighting, sharp composition',
    'stylized combat arena, readable hero silhouette, energetic effects, high-impact splash art',
    'third-person adventure key frame, bold foreground character, layered environment depth',
  ],
  simulation: [
    'cozy simulator miniature world, isometric buildings, warm sunlight, charming tiny details',
    'management game diorama, clean interface-free scene, soft colors, delightful objects',
    'life-sim illustration, friendly town corner, natural light, relaxed inviting mood',
  ],
  default: [
    'mobile game thumbnail, distinctive illustrated scene, clear focal subject, polished but not generic',
    'playable game scene preview, readable action, strong silhouette, vibrant balanced colors',
    'stylized game world snapshot, unique subject matter, premium composition, no interface overlay',
  ],
};

const MEDIUMS = [
  'cinematic 3D game keyframe',
  'flat graphic poster illustration',
  'pixel-art inspired game scene',
  'clay-render mobile game diorama',
  'hand-painted storybook illustration',
  'anime key visual',
  'realistic found-footage still',
  'clean isometric game-board art',
];

const kindForGame = (game?: ThumbnailGame | null) => {
  const text = `${game?.primaryTab || ''} ${game?.category || ''} ${game?.subcategory || ''} ${game?.name || ''} ${game?.title || ''}`.toLowerCase();
  if (/horror|haunted|watched|ghost|nightmare|unsettling/.test(text)) return 'horror';
  if (/race|racing|drive|drift|car|night drive/.test(text)) return 'racing';
  if (/quiz|trivia|question|guess/.test(text)) return 'quiz';
  if (/roleplay|story|romance|fantasy|anime|school|world/.test(text)) return 'roleplay';
  if (/puzzle|block|logic|brain/.test(text)) return 'puzzle';
  if (/action|battle|combat|shoot|survival/.test(text)) return 'action';
  if (/sim|tycoon|farm|manage|garden|candy|cozy/.test(text)) return 'simulation';
  if (/arcade|runner|dash|rush|flick|stack|rhythm/.test(text)) return 'arcade';
  return 'default';
};

const subjectForTitle = (title: string, kind: string) => {
  const lower = title.toLowerCase();
  if (/watched/.test(lower)) return 'a lone figure sensing eyes in a dark corridor';
  if (/unsettling|note|message/.test(lower)) return 'a mysterious handwritten note glowing on a desk';
  if (/drive|frenzy|racer|racing/.test(lower)) return 'a fast car cutting through a dramatic road scene';
  if (/candy|sugar/.test(lower)) return 'a playful candy world with bouncing sweets';
  if (/block/.test(lower)) return 'falling puzzle blocks in a clever arrangement';
  if (/sound|rhythm|music/.test(lower)) return 'a rhythm stage with pulsing speakers and light beams';
  if (/garden|bloom/.test(lower)) return 'a tiny garden world blooming under soft sunlight';
  if (/dreamstream|game$/.test(lower)) return kind === 'arcade'
    ? 'an original arcade challenge scene with collectibles and a clear playable hero'
    : 'an original game world scene with a clear playable hero';
  return title;
};

export const generatedThumbnailUrl = (game?: ThumbnailGame | null) => {
  const title = String(game?.name || game?.title || 'GameTok game').trim();
  const kind = kindForGame(game);
  const seed = hashSeed(String(game?.id || title || 'gametok'));
  const style = pick(STYLE_BY_KIND[kind] || STYLE_BY_KIND.default, seed);
  const medium = pick(MEDIUMS, Math.floor(seed / 3));
  const camera = pick([
    'close-up composition',
    'wide establishing composition',
    'top-down readable game-board composition',
    'low angle dramatic composition',
    'centered character-and-environment composition',
  ], Math.floor(seed / 7));
  const palette = pick([
    'distinct color palette',
    'warm golden and teal palette',
    'cool blue and silver palette',
    'sunny pastel palette',
    'high contrast black white and accent color palette',
    'earthy green and amber palette',
  ], Math.floor(seed / 17));
  const prompt = [
    subjectForTitle(title, kind),
    medium,
    style,
    camera,
    palette,
    'portrait mobile game thumbnail with a unique visual identity',
    'environment and characters only',
    'avoid generic neon fantasy poster style',
    'no title text, no readable letters, no logo, no watermark, no UI, no buttons, no captions',
  ].join(', ');

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=768&nologo=true&enhance=true&model=flux&seed=${seed}`;
};

export const resolveGameThumbnail = (
  thumbnail?: string | null,
  gameId?: string | null,
  game?: ThumbnailGame | null,
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

  if (gameId) return generatedThumbnailUrl({ ...game, id: gameId });
  return generatedThumbnailUrl(game);
};
