import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// FREESOUND_TOKEN=… node scripts/fetch-freesound-catalog.mjs   (key from freesound.org/apiv2/apply)
const token = process.env.FREESOUND_TOKEN;
if (!token) throw new Error('Set FREESOUND_TOKEN to your Freesound API key');

const COVERS = {
  arcade: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
  synthwave: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/backgrounds/bg-synthwave-grid.png',
  action: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
  fantasy: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=400&q=80',
  chill: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80',
  scifi: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=400&q=80',
  combatSfx: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/effects/asset-phaser-explosion.png',
  fanfare: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
  retroSfx: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
  casual: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=400&q=80',
};

const SEARCH_CONFIGS = [
  { query: 'chiptune loop', category: 'arcade', genre: 'arcade', type: 'bgm', cover: COVERS.arcade, limit: 12 },
  { query: 'synthwave loop', category: 'synthwave', genre: 'synthwave', type: 'bgm', cover: COVERS.synthwave, limit: 12 },
  { query: 'action game loop', category: 'action', genre: 'action', type: 'bgm', cover: COVERS.action, limit: 12 },
  { query: 'orchestral game', category: 'fantasy', genre: 'fantasy', type: 'bgm', cover: COVERS.fantasy, limit: 12 },
  { query: 'lofi game loop', category: 'chill', genre: 'chill', type: 'bgm', cover: COVERS.chill, limit: 10 },
  { query: 'laser sfx', category: 'sfx', genre: 'scifi', type: 'sfx', cover: COVERS.scifi, limit: 10 },
  { query: '8bit coin', category: 'sfx', genre: 'arcade', type: 'sfx', cover: COVERS.arcade, limit: 10 },
  { query: 'retro jump', category: 'sfx', genre: 'arcade', type: 'sfx', cover: COVERS.retroSfx, limit: 10 },
  { query: 'game explosion', category: 'sfx', genre: 'combat', type: 'sfx', cover: COVERS.combatSfx, limit: 10 },
  { query: 'victory fanfare', category: 'sfx', genre: 'fanfare', type: 'sfx', cover: COVERS.fanfare, limit: 10 },
  { query: 'game over jingle', category: 'sfx', genre: 'fanfare', type: 'sfx', cover: COVERS.casual, limit: 8 },
];

function cleanTitle(raw) {
  let title = raw
    .replace(/\.[a-zA-Z0-9]+$/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Capitalize words
  title = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return title || 'Game Sound';
}

function formatDuration(sec) {
  const s = Math.round(sec || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

async function fetchCollection() {
  console.log('Fetching sounds from Freesound API...');
  const collectedTracks = [];
  const seenIds = new Set();

  for (const cfg of SEARCH_CONFIGS) {
    const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(cfg.query)}&token=${token}&fields=id,name,previews,duration,username,tags,num_downloads&page_size=${cfg.limit}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Failed fetch for ${cfg.query}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      const items = data.results || [];
      console.log(`✓ Fetched ${items.length} tracks for "${cfg.query}"`);

      for (const item of items) {
        if (seenIds.has(item.id)) continue;
        const mp3Url = item.previews?.['preview-hq-mp3'] || item.previews?.['preview-lq-mp3'];
        if (!mp3Url) continue;

        seenIds.add(item.id);
        collectedTracks.push({
          id: `fs-${item.id}`,
          title: cleanTitle(item.name),
          url: mp3Url,
          cover_url: cfg.cover,
          category: cfg.category,
          genre: cfg.genre,
          duration: formatDuration(item.duration),
          uses_count: (item.num_downloads || 500) + 1200,
          type: cfg.type,
          tags: item.tags || [cfg.category, cfg.genre],
          creator: item.username || 'Freesound',
        });
      }
    } catch (e) {
      console.error(`Error querying ${cfg.query}:`, e);
    }
  }

  console.log(`Total collected tracks: ${collectedTracks.length}`);

  // Now create Audio Packs grouping them
  const packs = [
    {
      id: 'pack-fs-chiptune',
      title: 'Freesound 8-Bit Chiptune Arcade',
      count: collectedTracks.filter(t => t.category === 'arcade' && t.type === 'bgm').length,
      description: 'Iconic retro chiptune melodies and upbeat 8-bit arcade themes for platformers and puzzles.',
      coverUrl: COVERS.arcade,
      tag: 'arcade',
      genre: 'arcade',
      tracks: collectedTracks.filter(t => t.category === 'arcade' && t.type === 'bgm'),
    },
    {
      id: 'pack-fs-synthwave',
      title: 'Freesound Synthwave & Cyberpunk',
      count: collectedTracks.filter(t => t.category === 'synthwave').length,
      description: 'Driving neon arpeggios, analog basslines, and retro-futuristic darksynth OSTs.',
      coverUrl: COVERS.synthwave,
      tag: 'synthwave',
      genre: 'synthwave',
      tracks: collectedTracks.filter(t => t.category === 'synthwave'),
    },
    {
      id: 'pack-fs-action',
      title: 'Freesound High-Octane Action Battles',
      count: collectedTracks.filter(t => t.category === 'action').length,
      description: 'Adrenaline boss battle soundtracks, rhythmic drums, and intense gaming loops.',
      coverUrl: COVERS.action,
      tag: 'action',
      genre: 'action',
      tracks: collectedTracks.filter(t => t.category === 'action'),
    },
    {
      id: 'pack-fs-fantasy',
      title: 'Freesound RPG Fantasy Orchestral',
      count: collectedTracks.filter(t => t.category === 'fantasy').length,
      description: 'Sweeping orchestral adventure themes, medieval taverns, and heroic dungeon explorations.',
      coverUrl: COVERS.fantasy,
      tag: 'fantasy',
      genre: 'fantasy',
      tracks: collectedTracks.filter(t => t.category === 'fantasy'),
    },
    {
      id: 'pack-fs-chill',
      title: 'Freesound Cozy Lo-Fi & Casual Ambience',
      count: collectedTracks.filter(t => t.category === 'chill').length,
      description: 'Smooth relaxing keys, warm tape saturation, and mellow loops for puzzle games.',
      coverUrl: COVERS.chill,
      tag: 'chill',
      genre: 'arcade',
      tracks: collectedTracks.filter(t => t.category === 'chill'),
    },
    {
      id: 'pack-fs-sfx-arcade',
      title: 'Freesound Retro Arcade & Coin SFX',
      count: collectedTracks.filter(t => t.category === 'sfx' && (t.genre === 'arcade' || t.genre === 'fanfare')).length,
      description: 'Coin pings, jumps, powerups, extra lives, and celebratory level victory fanfares.',
      coverUrl: COVERS.fanfare,
      tag: 'sfx',
      genre: 'arcade',
      tracks: collectedTracks.filter(t => t.category === 'sfx' && (t.genre === 'arcade' || t.genre === 'fanfare')),
    },
    {
      id: 'pack-fs-sfx-combat',
      title: 'Freesound Combat Lasers & Blasts',
      count: collectedTracks.filter(t => t.category === 'sfx' && (t.genre === 'scifi' || t.genre === 'combat')).length,
      description: 'Sci-fi blaster lasers, heavy explosions, shield impacts, and combat strikes.',
      coverUrl: COVERS.combatSfx,
      tag: 'combat',
      genre: 'action',
      tracks: collectedTracks.filter(t => t.category === 'sfx' && (t.genre === 'scifi' || t.genre === 'combat')),
    },
  ];

  // Output TypeScript file
  const outPath = path.resolve(__dirname, '../src/data/audioCatalog.ts');
  const fileContent = `// Auto-generated Freesound & Game Audio Catalog
// Generated on ${new Date().toISOString()}

import { AudioTrack, AudioPack } from '../services/api';

export const FREESOUND_TRACKS: AudioTrack[] = ${JSON.stringify(collectedTracks, null, 2)};

export const FREESOUND_PACKS: AudioPack[] = ${JSON.stringify(packs, null, 2)};
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, fileContent, 'utf8');
  console.log(`Successfully wrote ${collectedTracks.length} tracks to ${outPath}`);
}

fetchCollection();
