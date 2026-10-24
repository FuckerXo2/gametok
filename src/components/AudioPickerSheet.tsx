import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Alert,
  Image,
  Animated,
  PanResponder,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';
import { AudioTrack, AudioPack, AudioCategory, audioApi } from '../services/api';
import { FREESOUND_TRACKS, FREESOUND_PACKS } from '../data/audioCatalog';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PACK_COLUMN_WIDTH = (SCREEN_WIDTH - 44) / 2;
const R2_BASE = 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev';

// High-quality genre cover artworks
const COVERS = {
  totmTheme: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=300&q=80',
  hexglTheme: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=300&q=80',
  fruitSlicer: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80',
  towerMaster: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
  ninjaClan: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-ansimuz-gothic-player.png',
  turboKart: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
  arcade8bit: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
  synthwave: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/backgrounds/bg-synthwave-grid.png',
  lofiChill: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80',
  combatSfx: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/effects/asset-phaser-explosion.png',
  fantasyOrchestra: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=400&q=80',
  casualPop: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=400&q=80',
};

// ─── VERIFIED FAST STREAMING AUDIO PACKS (iOS Native MP3/M4A/WAV) ───
export const BASE_AUDIO_PACKS: AudioPack[] = [
  {
    id: 'pack-arcade-stack',
    title: 'Tower Master Stacking Loops',
    count: 4,
    description: 'Catchy high-energy arcade block stacking BGM, precision drop clicks, and rotation audio.',
    coverUrl: COVERS.towerMaster,
    tag: 'arcade',
    genre: 'arcade',
    tracks: [
      { id: 'tm-bgm-1', title: 'Tower Master: Skyline Stack BGM', url: `${R2_BASE}/web-games/tower-building/8da0db27c070/assets/bgm.mp3`, cover_url: COVERS.towerMaster, category: 'Arcade BGM', duration: '1:40', uses_count: 4240, type: 'bgm' },
      { id: 'tm-bgm-2', title: 'Sky High Rooftop Jam', url: `${R2_BASE}/web-games/tower-building/e3933e581d5b/assets/bgm.mp3`, cover_url: COVERS.towerMaster, category: 'Arcade BGM', duration: '1:40', uses_count: 3100, type: 'bgm' },
      { id: 'tm-gameover', title: 'Tower Collapse Game Over', url: `${R2_BASE}/web-games/tower-building/8da0db27c070/assets/game-over.mp3`, cover_url: COVERS.towerMaster, category: 'SFX', duration: '0:02', uses_count: 2800, type: 'sfx' },
    ],
  },
  {
    id: 'pack-retro-race',
    title: 'Grand Prix 2D Racing Suite',
    count: 5,
    description: 'Fast-paced 80s arcade racing synth loops, engine revs, and blue shell launches.',
    coverUrl: COVERS.turboKart,
    tag: 'racing',
    genre: 'synthwave',
    tracks: [
      { id: 'gp-bgm-1', title: 'Grand Prix 2D: High-Speed Raceway OST', url: `${R2_BASE}/web-games/car-racing-2d/4833bbd33868/res/music/bg.mp3`, cover_url: COVERS.turboKart, category: 'Racing BGM', duration: '2:10', uses_count: 3890, type: 'bgm' },
      { id: 'gp-shell', title: 'Blue Shell Launch Whistle & Boom', url: `${R2_BASE}/turbo-kart-rush/runtime-assets/audio/blue-shell-launch.wav`, cover_url: COVERS.turboKart, category: 'SFX', duration: '0:03', uses_count: 3450, type: 'sfx' },
      { id: 'gp-race-beat', title: 'Final Lap Turbo Sprint', url: `${R2_BASE}/web-games/police-and-thief/7cc23fe06ad6/media/gamemusic.m4a`, cover_url: COVERS.turboKart, category: 'Racing BGM', duration: '1:45', uses_count: 2980, type: 'bgm' },
    ],
  },
  {
    id: 'pack-fruit-slicer',
    title: 'Fruit Slicer Blade Combat',
    count: 5,
    description: 'Crisp katana blade slashes, combo splats, bomb explosions, and celebratory game over tunes.',
    coverUrl: COVERS.fruitSlicer,
    tag: 'combat',
    genre: 'sfx',
    tracks: [
      { id: 'fs-combo-1', title: 'Katana Combo Slash (Crisp Slice)', url: `${R2_BASE}/games/fruit-slicer/assets/sounds/Combo.wav`, cover_url: COVERS.fruitSlicer, category: 'Action SFX', duration: '0:01', uses_count: 5890, type: 'sfx' },
      { id: 'fs-bomb-1', title: 'Volatile Mega Bomb Blast Boom', url: `${R2_BASE}/games/fruit-slicer/assets/sounds/BombExplode.wav`, cover_url: COVERS.combatSfx, category: 'Action SFX', duration: '0:02', uses_count: 5120, type: 'sfx' },
      { id: 'fs-slice-1', title: 'Single Fruit Swift Cut', url: `${R2_BASE}/games/fruit-slicer/assets/sounds/FruitSlice.wav`, cover_url: COVERS.fruitSlicer, category: 'Action SFX', duration: '0:01', uses_count: 4200, type: 'sfx' },
      { id: 'fs-toss-1', title: 'Fruit Toss Arc Whoosh', url: `${R2_BASE}/games/fruit-slicer/assets/sounds/FruitThrow.wav`, cover_url: COVERS.fruitSlicer, category: 'Action SFX', duration: '0:01', uses_count: 3600, type: 'sfx' },
      { id: 'fs-over-1', title: 'Round Over Victory Gong', url: `${R2_BASE}/games/fruit-slicer/assets/sounds/GameOver.wav`, cover_url: COVERS.fruitSlicer, category: 'Action SFX', duration: '0:03', uses_count: 3100, type: 'sfx' },
    ],
  },
  {
    id: 'pack-star-pop',
    title: 'Cosmic Galaxy & Space Synth',
    count: 4,
    description: 'Dreamy melodic space synthesizers, ambient starry arpeggios, and cosmic relaxation.',
    coverUrl: COVERS.hexglTheme,
    tag: 'space',
    genre: 'synthwave',
    tracks: [
      { id: 'sp-bgm-1', title: 'Star Pop: Dreamy Synth Galaxy', url: `${R2_BASE}/web-games/star-pop/2e99d51987bf/assets/sound/native/0a/0aa53b1f-f12e-419e-b107-341b5938d8ba.1cf1d.mp3`, cover_url: COVERS.hexglTheme, category: 'Space BGM', duration: '2:30', uses_count: 3820, type: 'bgm' },
      { id: 'sp-bgm-2', title: 'Star Pop: Cosmic Nebula Odyssey', url: `${R2_BASE}/web-games/star-pop/2e99d51987bf/assets/sound/native/49/4975f6b9-6e32-42e8-abb5-38a288a2e8d3.dbef9.mp3`, cover_url: COVERS.hexglTheme, category: 'Space BGM', duration: '2:15', uses_count: 2950, type: 'bgm' },
      { id: 'sp-sfx-glow', title: 'Pulsing Star Glow Shimmer', url: `${R2_BASE}/web-games/police-and-thief/7cc23fe06ad6/media/glow.m4a`, cover_url: COVERS.hexglTheme, category: 'SFX', duration: '0:02', uses_count: 2400, type: 'sfx' },
    ],
  },
  {
    id: 'pack-totm-retro',
    title: 'Tomb of the Mask Fanfares & SFX',
    count: 6,
    description: 'Iconic golden coin collect pings, level victory fanfares, star sparkles, and defeat zaps.',
    coverUrl: COVERS.totmTheme,
    tag: 'totm',
    genre: 'arcade',
    tracks: [
      { id: 'totm-win-1', title: 'Level Complete Victory Fanfare', url: `${R2_BASE}/games/tomb-of-mask-1/Music%20and%20sounds/Win.mp3`, cover_url: COVERS.fantasyOrchestra, category: 'Fanfare', duration: '0:04', uses_count: 5120, type: 'sfx' },
      { id: 'totm-coin-1', title: 'Retro Golden Coin Collect Chime', url: `${R2_BASE}/games/tomb-of-mask-1/Music%20and%20sounds/Coin.mp3`, cover_url: COVERS.arcade8bit, category: 'SFX', duration: '0:02', uses_count: 4890, type: 'sfx' },
      { id: 'totm-star-1', title: '3-Star Trophy Sparkle Jingle', url: `${R2_BASE}/games/tomb-of-mask-1/Music%20and%20sounds/3-star.mp3`, cover_url: COVERS.totmTheme, category: 'SFX', duration: '0:02', uses_count: 3600, type: 'sfx' },
      { id: 'totm-death-1', title: 'Retro Maze Defeat Zap', url: `${R2_BASE}/games/tomb-of-mask-1/Music%20and%20sounds/Death.mp3`, cover_url: COVERS.totmTheme, category: 'SFX', duration: '0:03', uses_count: 3100, type: 'sfx' },
    ],
  },
  {
    id: 'pack-casual-bounce',
    title: 'Playful Casual & Kids Groove',
    count: 4,
    description: 'Upbeat whimsical brass, cheerful piano hops, and lighthearted cartoon rhythm loops.',
    coverUrl: COVERS.casualPop,
    tag: 'casual',
    genre: 'arcade',
    tracks: [
      { id: 'cas-windmill', title: 'Windmill Spin: Joyful Casual Hop', url: `${R2_BASE}/web-games/windmill-spin/295e264fc510/media/gamemusic.m4a`, cover_url: COVERS.casualPop, category: 'Casual BGM', duration: '1:30', uses_count: 3200, type: 'bgm' },
      { id: 'cas-orange', title: 'Ricochet Orange: Funky Bounce Groove', url: `${R2_BASE}/web-games/ricocheting-orange/4b65e0bec513/media/gamemusic.m4a`, cover_url: COVERS.casualPop, category: 'Casual BGM', duration: '1:15', uses_count: 2750, type: 'bgm' },
      { id: 'cas-success', title: 'Level Clear Chime Bell', url: `${R2_BASE}/web-games/windmill-spin/295e264fc510/media/success.m4a`, cover_url: COVERS.casualPop, category: 'SFX', duration: '0:02', uses_count: 2900, type: 'sfx' },
    ],
  },
];

export const AUDIO_PACKS: AudioPack[] = [
  ...BASE_AUDIO_PACKS,
  ...FREESOUND_PACKS,
];

// ─── VERIFIED TRENDING TRACKS (100% Native iOS Playable MP3/M4A/WAV) ───
export const BASE_TRENDING_TRACKS: AudioTrack[] = [
  {
    id: 'trk-tower-bgm',
    title: 'Tower Master: Skyline Stack BGM',
    url: `${R2_BASE}/web-games/tower-building/8da0db27c070/assets/bgm.mp3`,
    cover_url: COVERS.towerMaster,
    category: 'Arcade BGM',
    duration: '1:40',
    uses_count: 4240,
    type: 'bgm',
  },
  {
    id: 'trk-racing-loop',
    title: 'Grand Prix 2D: High-Speed Raceway OST',
    url: `${R2_BASE}/web-games/car-racing-2d/4833bbd33868/res/music/bg.mp3`,
    cover_url: COVERS.turboKart,
    category: 'Racing BGM',
    duration: '2:10',
    uses_count: 3890,
    type: 'bgm',
  },
  {
    id: 'trk-starpop-galaxy',
    title: 'Star Pop: Dreamy Synth Galaxy',
    url: `${R2_BASE}/web-games/star-pop/2e99d51987bf/assets/sound/native/0a/0aa53b1f-f12e-419e-b107-341b5938d8ba.1cf1d.mp3`,
    cover_url: COVERS.hexglTheme,
    category: 'Space BGM',
    duration: '2:30',
    uses_count: 3820,
    type: 'bgm',
  },
  {
    id: 'trk-police-chase',
    title: 'Police & Thief: Neon Arcade Chase BGM',
    url: `${R2_BASE}/web-games/police-and-thief/7cc23fe06ad6/media/gamemusic.m4a`,
    cover_url: COVERS.synthwave,
    category: 'Action BGM',
    duration: '1:45',
    uses_count: 3450,
    type: 'bgm',
  },
  {
    id: 'trk-windmill-hop',
    title: 'Windmill Spin: Joyful Casual Hop',
    url: `${R2_BASE}/web-games/windmill-spin/295e264fc510/media/gamemusic.m4a`,
    cover_url: COVERS.casualPop,
    category: 'Casual BGM',
    duration: '1:30',
    uses_count: 3200,
    type: 'bgm',
  },
  {
    id: 'trk-starpop-nebula',
    title: 'Star Pop: Cosmic Nebula Odyssey',
    url: `${R2_BASE}/web-games/star-pop/2e99d51987bf/assets/sound/native/49/4975f6b9-6e32-42e8-abb5-38a288a2e8d3.dbef9.mp3`,
    cover_url: COVERS.lofiChill,
    category: 'Ambient BGM',
    duration: '2:15',
    uses_count: 2950,
    type: 'bgm',
  },
  {
    id: 'trk-orange-groove',
    title: 'Ricochet Orange: Funky Bounce Groove',
    url: `${R2_BASE}/web-games/ricocheting-orange/4b65e0bec513/media/gamemusic.m4a`,
    cover_url: COVERS.arcade8bit,
    category: 'Rhythm BGM',
    duration: '1:15',
    uses_count: 2750,
    type: 'bgm',
  },
  {
    id: 'trk-fruit-combo',
    title: 'Katana Combo Slash (Crisp Slice)',
    url: `${R2_BASE}/games/fruit-slicer/assets/sounds/Combo.wav`,
    cover_url: COVERS.fruitSlicer,
    category: 'Action SFX',
    duration: '0:01',
    uses_count: 5890,
    type: 'sfx',
  },
  {
    id: 'trk-fruit-bomb',
    title: 'Volatile Mega Bomb Blast Explosion',
    url: `${R2_BASE}/games/fruit-slicer/assets/sounds/BombExplode.wav`,
    cover_url: COVERS.combatSfx,
    category: 'Action SFX',
    duration: '0:02',
    uses_count: 5120,
    type: 'sfx',
  },
  {
    id: 'trk-totm-win',
    title: 'Level Complete Victory Fanfare',
    url: `${R2_BASE}/games/tomb-of-mask-1/Music%20and%20sounds/Win.mp3`,
    cover_url: COVERS.fantasyOrchestra,
    category: 'Fanfare',
    duration: '0:04',
    uses_count: 5120,
    type: 'sfx',
  },
  {
    id: 'trk-totm-coin',
    title: 'Retro Golden Coin Collect Chime',
    url: `${R2_BASE}/games/tomb-of-mask-1/Music%20and%20sounds/Coin.mp3`,
    cover_url: COVERS.arcade8bit,
    category: 'Arcade SFX',
    duration: '0:02',
    uses_count: 4890,
    type: 'sfx',
  },
  {
    id: 'trk-kart-shell',
    title: 'Blue Shell Launch Whistle & Boom',
    url: `${R2_BASE}/turbo-kart-rush/runtime-assets/audio/blue-shell-launch.wav`,
    cover_url: COVERS.turboKart,
    category: 'Racing SFX',
    duration: '0:03',
    uses_count: 3450,
    type: 'sfx',
  },
];

export const TRENDING_AUDIO_TRACKS: AudioTrack[] = [
  ...BASE_TRENDING_TRACKS,
  ...FREESOUND_TRACKS.filter((t) => t.type === 'bgm').slice(0, 24),
  ...FREESOUND_TRACKS.filter((t) => t.type === 'sfx').slice(0, 16),
];

const DEFAULT_AUDIO_CATEGORIES: AudioCategory[] = [
  { id: 'my_assets', label: 'My Assets', chips: [] },
  { id: 'trending', label: 'Trending', chips: ['arcade', 'synthwave', 'action', 'fantasy', 'chill', 'sfx'] },
  { id: 'packs', label: 'Packs', chips: ['all', 'chiptune', 'synthwave', 'action', 'fantasy', 'chill', 'arcade', 'racing', 'combat', 'sfx'] },
  { id: 'arcade', label: 'Arcade & 8-Bit', chips: ['chiptune', '8bit', 'retro', 'tower', 'coin', 'jump', 'speedrun'] },
  { id: 'synthwave', label: 'Cyberpunk & Synth', chips: ['synthwave', 'racing', 'starpop', 'neon', 'analog', 'overdrive', 'space'] },
  { id: 'action', label: 'Action & Combat', chips: ['battle', 'boss', 'katana', 'bomb', 'slash', 'explosion', 'police'] },
  { id: 'fantasy', label: 'Fantasy & RPG', chips: ['orchestral', 'adventure', 'quest', 'medieval', 'tavern', 'heroic', 'dungeon'] },
  { id: 'chill', label: 'Lo-Fi & Casual', chips: ['lofi', 'puzzle', 'cozy', 'casual', 'ambient', 'relax', 'windmill'] },
  { id: 'sfx', label: 'SFX & Stems', chips: ['laser', 'coin', 'jump', 'win', 'bomb', 'shell', 'combo', 'explosion', 'fanfare'] },
];

interface AudioPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectAudio: (track: AudioTrack) => void;
  selectedAudioUrl?: string | null;
  userId?: string | null;
  initialTab?: 'bgm' | 'sfx' | string;
}

export const AudioPickerSheet: React.FC<AudioPickerSheetProps> = ({
  visible,
  onClose,
  onSelectAudio,
  selectedAudioUrl = null,
  userId = null,
  initialTab = 'trending',
}) => {
  const [categories] = useState<AudioCategory[]>(DEFAULT_AUDIO_CATEGORIES);
  const [activeTab, setActiveTab] = useState<string>('trending');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [myTracks, setMyTracks] = useState<AudioTrack[]>([]);
  const [freesoundTracks, setFreesoundTracks] = useState<AudioTrack[]>([]);
  const [isSearchingFreesound, setIsSearchingFreesound] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<AudioPack | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Audio Playback Preview State (Powered by Hardware-Accelerated Audio Engine)
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

  // Pre-configure Audio session on mount for iOS speaker playback
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});
  }, []);

  // Bottom Sheet Animated Height & Drag
  const COLLAPSED_HEIGHT = SCREEN_HEIGHT * 0.55;
  const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.88;
  const [expanded, setExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      sheetHeight.setValue(COLLAPSED_HEIGHT);
      setExpanded(false);
      setActiveTab('trending');
    }
  }, [visible, COLLAPSED_HEIGHT, sheetHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -35) {
            Animated.spring(sheetHeight, {
              toValue: EXPANDED_HEIGHT,
              useNativeDriver: false,
              friction: 8,
            }).start();
            setExpanded(true);
          } else if (gestureState.dy > 35) {
            if (expanded) {
              Animated.spring(sheetHeight, {
                toValue: COLLAPSED_HEIGHT,
                useNativeDriver: false,
                friction: 8,
              }).start();
              setExpanded(false);
            } else {
              handleClose();
            }
          }
        },
      }),
    [expanded, sheetHeight, COLLAPSED_HEIGHT, EXPANDED_HEIGHT]
  );

  // Stop playback when closing
  const stopAudio = useCallback(() => {
    setPlayingTrackId(null);
    setPlayingAudioUrl(null);
    setLoadingTrackId(null);
  }, []);

  const handleClose = useCallback(() => {
    stopAudio();
    onClose();
  }, [stopAudio, onClose]);

  // Robust Audio Preview Play / Pause
  const togglePlayTrack = useCallback((track: AudioTrack) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (playingTrackId === track.id) {
      stopAudio();
      return;
    }

    if (!track.url) return;

    setLoadingTrackId(track.id);
    setPlayingTrackId(track.id);
    setPlayingAudioUrl(track.url);
  }, [playingTrackId, stopAudio]);

  // Freesound Live Search Integration
  const searchFreesound = useCallback(async (query: string) => {
    if (!query.trim()) {
      setFreesoundTracks([]);
      return;
    }
    setIsSearchingFreesound(true);
    try {
      const FREESOUND_API_KEY = 'mgD2q6sEgb7r8seRdGqRVBgszcAgMqPAzGpHPAkk';
      const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&token=${FREESOUND_API_KEY}&fields=id,name,previews,duration,username&page_size=20`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const results: AudioTrack[] = (data.results || []).map((item: any, idx: number) => {
          const previewUrl = item.previews?.['preview-hq-mp3'] || item.previews?.['preview-lq-mp3'] || '';
          const durSec = Math.round(item.duration || 0);
          const mins = Math.floor(durSec / 60);
          const secs = durSec % 60;
          const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
          const coverList = [COVERS.synthwave, COVERS.totmTheme, COVERS.hexglTheme, COVERS.combatSfx, COVERS.towerMaster, COVERS.arcade8bit];
          return {
            id: `fs-${item.id}`,
            title: item.name.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[_]+/g, ' '),
            url: previewUrl,
            cover_url: coverList[idx % coverList.length],
            category: item.username ? `By @${item.username}` : 'Freesound',
            duration: durationStr,
            uses_count: 500 + Math.floor(Math.random() * 2000),
            type: durSec > 15 ? 'bgm' : 'sfx',
          };
        });
        setFreesoundTracks(results);
      }
    } catch (e) {
      console.warn('[AudioPicker] Freesound search failed:', e);
    } finally {
      setIsSearchingFreesound(false);
    }
  }, []);

  // Upload Local Audio File
  const handleUploadAudio = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const file = res.assets[0];
        setIsUploading(true);
        const formData = new FormData();
        const fileName = file.fileName || file.uri.split('/').pop() || 'custom_sound.mp3';
        formData.append('file', {
          uri: file.uri,
          name: fileName,
          type: file.mimeType || 'audio/mpeg',
        } as any);
        formData.append('type', 'bgm');

        const uploadRes = await audioApi.uploadAudio(formData);
        if (uploadRes && uploadRes.success && uploadRes.asset) {
          const newTrack: AudioTrack = {
            id: uploadRes.asset.id || `custom-${Date.now()}`,
            title: uploadRes.asset.title || fileName || 'Custom Audio Track',
            url: uploadRes.asset.url,
            cover_url: COVERS.towerMaster,
            category: 'My Assets',
            duration: '0:30',
            uses_count: 1,
            type: 'bgm',
          };
          setMyTracks((prev) => [newTrack, ...prev]);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}
        } else {
          Alert.alert('Upload Error', uploadRes.error || 'Failed to upload audio file.');
        }
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Could not select audio file.');
    } finally {
      setIsUploading(false);
    }
  };

  // Filter tracks by category, chip, search
  const displayedTracks = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      const localMatches = TRENDING_AUDIO_TRACKS.filter((t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );
      return [...localMatches, ...freesoundTracks];
    }

    let list: AudioTrack[] = [];
    if (activeTab === 'my_assets') {
      list = myTracks;
    } else if (activeTab === 'trending') {
      list = TRENDING_AUDIO_TRACKS;
    } else if (activeTab === 'arcade') {
      const p1 = AUDIO_PACKS.find((pack) => pack.id === 'pack-arcade-stack');
      const p2 = AUDIO_PACKS.find((pack) => pack.id === 'pack-totm-retro');
      const pFs = AUDIO_PACKS.find((pack) => pack.id === 'pack-fs-chiptune');
      list = [
        ...(p1?.tracks || []),
        ...(p2?.tracks || []),
        ...(pFs?.tracks || []),
        ...FREESOUND_TRACKS.filter((t) => t.category === 'arcade'),
      ];
    } else if (activeTab === 'synthwave') {
      const p1 = AUDIO_PACKS.find((pack) => pack.id === 'pack-retro-race');
      const p2 = AUDIO_PACKS.find((pack) => pack.id === 'pack-star-pop');
      const pFs = AUDIO_PACKS.find((pack) => pack.id === 'pack-fs-synthwave');
      list = [
        ...(p1?.tracks || []),
        ...(p2?.tracks || []),
        ...(pFs?.tracks || []),
        ...FREESOUND_TRACKS.filter((t) => t.category === 'synthwave'),
      ];
    } else if (activeTab === 'action') {
      const p = AUDIO_PACKS.find((pack) => pack.id === 'pack-fruit-slicer');
      const pFs = AUDIO_PACKS.find((pack) => pack.id === 'pack-fs-action');
      list = [
        ...(p?.tracks || []),
        ...(pFs?.tracks || []),
        ...FREESOUND_TRACKS.filter((t) => t.category === 'action'),
      ];
    } else if (activeTab === 'fantasy') {
      const pFs = AUDIO_PACKS.find((pack) => pack.id === 'pack-fs-fantasy');
      list = [
        ...(pFs?.tracks || []),
        ...FREESOUND_TRACKS.filter((t) => t.category === 'fantasy'),
      ];
    } else if (activeTab === 'chill') {
      const p1 = AUDIO_PACKS.find((pack) => pack.id === 'pack-casual-bounce');
      const pFs = AUDIO_PACKS.find((pack) => pack.id === 'pack-fs-chill');
      list = [
        ...(p1?.tracks || []),
        ...(pFs?.tracks || []),
        ...FREESOUND_TRACKS.filter((t) => t.category === 'chill'),
      ];
    } else if (activeTab === 'sfx') {
      const p1 = AUDIO_PACKS.find((pack) => pack.id === 'pack-fruit-slicer');
      const p2 = AUDIO_PACKS.find((pack) => pack.id === 'pack-totm-retro');
      const pArcade = AUDIO_PACKS.find((pack) => pack.id === 'pack-fs-sfx-arcade');
      const pCombat = AUDIO_PACKS.find((pack) => pack.id === 'pack-fs-sfx-combat');
      list = [
        ...(p1?.tracks || []),
        ...(p2?.tracks || []),
        ...(pArcade?.tracks || []),
        ...(pCombat?.tracks || []),
        ...FREESOUND_TRACKS.filter((t) => t.type === 'sfx'),
      ];
    } else {
      list = TRENDING_AUDIO_TRACKS;
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    list = list.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    if (activeChip) {
      const q = activeChip.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [activeTab, activeChip, searchQuery, freesoundTracks, myTracks]);

  const displayedPacks = useMemo(() => {
    if (!activeChip || activeChip === 'all') return AUDIO_PACKS;
    const q = activeChip.toLowerCase();
    return AUDIO_PACKS.filter(
      (p) =>
        (p.genre && p.genre.toLowerCase().includes(q)) ||
        (p.tag && p.tag.toLowerCase().includes(q)) ||
        p.title.toLowerCase().includes(q)
    );
  }, [activeChip]);

  const activeCategoryObj = useMemo(
    () => categories.find((c) => c.id === activeTab),
    [categories, activeTab]
  );
  const currentChips = activeCategoryObj?.chips || [];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        {/* Tapping outside sheet dismisses it */}
        <Pressable style={styles.backdropDismissArea} onPress={handleClose} />

        <Animated.View style={[styles.sheetContainer, { height: sheetHeight }]}>
          {/* Top Grabber & Drag Handle */}
          <View {...panResponder.panHandlers} style={styles.grabberTouchArea}>
            <View style={styles.grabber} />
          </View>

          {/* Header Row: Title + Search Toggle + Close */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Audio & Music</Text>
              <Text style={styles.headerSub}>Original Game Soundtracks & Sound Effects</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.iconCircle, isSearchOpen && styles.iconCircleActive]}
                onPress={() => setIsSearchOpen((prev) => !prev)}
                hitSlop={8}
              >
                <Ionicons name="search" size={18} color={isSearchOpen ? '#C084FC' : '#94A3B8'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconCircle} onPress={handleClose} hitSlop={8}>
                <Ionicons name="close" size={20} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar Input (Freesound + Local) */}
          {isSearchOpen && (
            <View style={styles.searchBarWrap}>
              <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search real game OSTs, 8-bit, synthwave, loops..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchFreesound(text);
                }}
                autoFocus
              />
              {isSearchingFreesound ? (
                <ActivityIndicator size="small" color="#C084FC" style={{ marginRight: 8 }} />
              ) : searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8} style={{ padding: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Horizontal Category Tabs Bar */}
          <View style={styles.categoryBarWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsContent}
            >
              {categories.map((cat) => {
                const isActive = activeTab === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      setActiveTab(cat.id);
                      setActiveChip(null);
                      setSelectedPack(null);
                    }}
                    style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                      {cat.label}
                    </Text>
                    {isActive && <View style={styles.categoryTabIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Sub-Filter Chips Row */}
          {currentChips.length > 0 && activeTab !== 'my_assets' && (
            <View style={styles.chipsBarWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsContent}
              >
                {currentChips.map((chip) => {
                  const isChipActive = activeChip === chip;
                  return (
                    <TouchableOpacity
                      key={chip}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        setActiveChip((prev) => (prev === chip ? null : chip));
                      }}
                      style={[styles.chipPill, isChipActive && styles.chipPillActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, isChipActive && styles.chipTextActive]}>
                        #{chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Main Content Area */}
          {activeTab === 'packs' && !selectedPack ? (
            /* ── PACKS VIEW: 2-COLUMN GRID ── */
            <FlatList
              key="audio-packs-grid-2cols"
              data={displayedPacks}
              keyExtractor={(item) => item.id}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.packsGridContent}
              columnWrapperStyle={styles.packsGridRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.packCard}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    setSelectedPack(item);
                  }}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: item.coverUrl }} style={styles.packCardCover} resizeMode="cover" />
                  <View style={styles.packCardInfo}>
                    <Text style={styles.packCardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.packCardCount}>{item.count} music tracks</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : selectedPack ? (
            /* ── PACK DRILL-DOWN VIEW ── */
            <View style={{ flex: 1 }}>
              <View style={styles.packDrillHeader}>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setSelectedPack(null)}
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={20} color="#FFF" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Text style={styles.packDrillTitle} numberOfLines={1}>
                    {selectedPack.title}
                  </Text>
                  <Text style={styles.packDrillSub}>{selectedPack.count} tracks in pack</Text>
                </View>
              </View>

              <FlatList
                data={selectedPack.tracks || []}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.tracksListContent}
                renderItem={({ item }) => renderTrackRow(item)}
              />
            </View>
          ) : (
            /* ── TRACKS LIST VIEW ── */
            <FlatList
              data={displayedTracks}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.tracksListContent}
              ListHeaderComponent={
                activeTab === 'my_assets' ? (
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={handleUploadAudio}
                    disabled={isUploading}
                    activeOpacity={0.8}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color="#C084FC" />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={18} color="#C084FC" />
                    )}
                    <Text style={styles.uploadBtnText}>
                      {isUploading ? 'Uploading Audio...' : 'Upload Audio (MP3 / WAV)'}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => renderTrackRow(item)}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Ionicons name="musical-notes-outline" size={44} color="#475569" />
                  <Text style={styles.emptyTitle}>
                    {activeTab === 'my_assets' ? 'No audio uploaded yet' : 'No tracks found'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {activeTab === 'my_assets'
                      ? 'Upload your custom soundtracks and SFX to use in games.'
                      : 'Try typing a keyword like "retro", "laser", or "piano".'}
                  </Text>
                </View>
              }
            />
          )}

          {/* Background Audio Stream Player (Crash-Proof WKWebView) */}
          {playingAudioUrl && (
            <View style={styles.audioWebViewContainer} pointerEvents="none">
              <WebView
                key={`audio-player-${playingTrackId}-${playingAudioUrl}`}
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                      <style>
                        * { margin:0; padding:0; background:transparent; }
                      </style>
                    </head>
                    <body>
                      <audio id="audio-engine" src="${playingAudioUrl}" autoplay playsinline webkit-playsinline preload="auto"></audio>
                      <script>
                        const audio = document.getElementById('audio-engine');
                        audio.volume = 1.0;

                        function post(type, payload) {
                          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...(payload || {}) }));
                          }
                        }

                        audio.addEventListener('playing', () => post('playing'));
                        audio.addEventListener('ended', () => post('ended'));
                        audio.addEventListener('error', (e) => {
                          const errCode = audio.error ? audio.error.code : 'unknown';
                          post('error', { code: errCode });
                        });

                        const playPromise = audio.play();
                        if (playPromise !== undefined) {
                          playPromise.then(() => {
                            post('playing');
                          }).catch((err) => {
                            try {
                              const AudioCtx = window.AudioContext || window.webkitAudioContext;
                              if (AudioCtx) {
                                const ctx = new AudioCtx();
                                ctx.resume().then(() => audio.play());
                              }
                            } catch (e) {}
                            post('play_catch', { message: err.message });
                          });
                        }
                      </script>
                    </body>
                    </html>
                  `,
                }}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                originWhitelist={['*']}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'playing') {
                      setLoadingTrackId(null);
                    } else if (data.type === 'ended') {
                      setPlayingTrackId(null);
                      setPlayingAudioUrl(null);
                      setLoadingTrackId(null);
                    } else if (data.type === 'error') {
                      setLoadingTrackId(null);
                      console.warn('[AudioPicker] Audio playback error in webview:', data);
                    }
                  } catch {}
                }}
                style={styles.audioWebView}
              />
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );

  function renderTrackRow(item: AudioTrack) {
    const isPlaying = playingTrackId === item.id;
    const isLoading = loadingTrackId === item.id;
    return (
      <TouchableOpacity
        style={[styles.trackRow, isPlaying && styles.trackRowPlaying]}
        key={item.id}
        onPress={() => togglePlayTrack(item)}
        activeOpacity={0.7}
      >
        {/* Track Album Artwork Cover Image with Live Play Indicator */}
        <View style={styles.coverWrapper}>
          <Image source={{ uri: item.cover_url }} style={styles.trackCover} resizeMode="cover" />
          {isPlaying && (
            <View style={styles.coverPlayingOverlay}>
              <Ionicons name="volume-high" size={16} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Track Title + Flame Count Badge */}
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, isPlaying && styles.trackTitlePlaying]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.trackMetaRow}>
            <Text style={styles.trackFlameText}>🔥 {item.uses_count || 1200}</Text>
            <Text style={styles.trackCategoryBadge}> • {item.category}</Text>
          </View>
        </View>

        {/* Duration */}
        <Text style={styles.trackDuration}>{item.duration || '2:00'}</Text>

        {/* Plus Button: Select / Attach Track */}
        <TouchableOpacity
          style={styles.plusBtn}
          onPress={(e) => {
            e.stopPropagation();
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}
            stopAudio();
            onSelectAudio(item);
            onClose();
          }}
          hitSlop={8}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Play / Pause Preview Button with Loading Indicator */}
        <TouchableOpacity
          style={[styles.playBtn, isPlaying && styles.playBtnActive]}
          onPress={(e) => {
            e.stopPropagation();
            togglePlayTrack(item);
          }}
          hitSlop={8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropDismissArea: {
    flex: 1,
    width: '100%',
  },
  sheetContainer: {
    backgroundColor: '#0F0F14',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  grabberTouchArea: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(192, 132, 252, 0.2)',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181822',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 10,
  },
  categoryBarWrap: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryTabsContent: {
    paddingHorizontal: 16,
    gap: 20,
  },
  categoryTab: {
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  categoryTabActive: {},
  categoryTabText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  categoryTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  chipsBarWrap: {
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chipPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(192, 132, 252, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  uploadBtnText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '700',
  },
  tracksListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  trackRowPlaying: {
    backgroundColor: 'rgba(192, 132, 252, 0.08)',
    borderColor: 'rgba(192, 132, 252, 0.2)',
  },
  coverWrapper: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  trackCover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E1E28',
  },
  coverPlayingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(168, 85, 247, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  trackTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  trackTitlePlaying: {
    color: '#C084FC',
  },
  trackMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trackFlameText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '700',
  },
  trackCategoryBadge: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '500',
  },
  trackDuration: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 14,
  },
  plusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: '#A855F7',
  },
  packsGridContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  packsGridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  packCard: {
    width: PACK_COLUMN_WIDTH,
    backgroundColor: '#14141E',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  packCardCover: {
    width: '100%',
    height: PACK_COLUMN_WIDTH,
    backgroundColor: '#1C1C28',
  },
  packCardInfo: {
    padding: 10,
  },
  packCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  packCardCount: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  packDrillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packDrillTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  packDrillSub: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  audioWebViewContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 2,
    height: 2,
    opacity: 0.01,
    overflow: 'hidden',
  },
  audioWebView: {
    width: 2,
    height: 2,
    backgroundColor: 'transparent',
  },
});
