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
  Platform,
  Alert,
  Image,
  Animated,
  PanResponder,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { assetsApi, CommunityAsset, AssetCategory } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 44) / 3;
const PACK_COLUMN_WIDTH = (SCREEN_WIDTH - 44) / 2;

export interface AssetPack {
  id: string;
  title: string;
  count: number;
  description: string;
  coverUrl: string;
  genre?: string;
  tag?: string;
  category?: string;
  idsPrefix?: string;
}

export const ASSET_PACKS: AssetPack[] = [
  {
    id: 'pack-ninja-frog',
    title: 'Ninja Frog Character',
    count: 7,
    description: 'Complete 7-state hero sprite set: Idle, Run, Jump, Double Jump, Wall Jump, Fall, and Hit.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-pixelfrog-ninja-frog-idle.png',
    tag: 'ninja_frog',
  },
  {
    id: 'pack-foxy',
    title: 'SunnyLand Foxy Character',
    count: 13,
    description: 'Complete 13-frame animation suite by Ansimuz: Idle 1-4, Run 1-6, Jump Ascend/Fall, and Hurt.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-ansimuz-foxy-idle-1.png',
    tag: 'foxy',
  },
  {
    id: 'pack-gothicvania',
    title: 'Gothicvania Knight & Spells',
    count: 4,
    description: 'Dark fantasy gothic sprites: Dark Knight, Arcane Wizard, Burning Ghoul, and Flaming Comet.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-ansimuz-gothic-player.png',
    tag: 'gothicvania',
  },
  {
    id: 'pack-2d-fighter',
    title: '2D Fighter Character',
    count: 28,
    description: "2D Fighter poses for ARPGs and brawlers: attack combos, duck, hit, jump, and run.",
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-kenney-toon-robot-attack0.png',
    idsPrefix: 'asset-kenney-toon',
  },
  {
    id: 'pack-forest-enemies',
    title: 'Platformer Forest Enemies',
    count: 13,
    description: 'Classic adversaries: Angry Pig, Snail, Slime, Cavern Bat, Rhino, Chicken, Bunny, and Chameleon.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-pixelfrog-enemy-angry-pig.png',
    tag: 'platform_enemies',
  },
  {
    id: 'pack-space-fleet',
    title: 'Retro Shmup Space Fleet',
    count: 12,
    description: 'Starfighters, alien UFO saucers, enemy interceptors, and vector combat ships.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/objects/asset-kenney-space-playerShip1_blue.png',
    tag: 'space_fleet',
  },
  {
    id: 'pack-arcade-monsters',
    title: 'Arcade Classic Monsters',
    count: 7,
    description: 'Retro creeps and bosses: Metal Slug Mummy, Pac-Chomper, Blinky Ghost, Inky Ghost, and Storm Dragon.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-phaser-metalslug-mummy.png',
    tag: 'arcade_monsters',
  },
  {
    id: 'pack-vfx-explosions',
    title: 'Arcade VFX & Explosions',
    count: 15,
    description: 'High-octane visual effects: explosions, blasts, lasers, blade slashes, muzzle flashes, and sparks.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/effects/asset-phaser-explosion.png',
    category: 'effects',
  },
  {
    id: 'pack-fruits',
    title: 'Tropical Fruits & Pickups',
    count: 10,
    description: 'Vibrant collectibles: Apple, Bananas, Cherries, Kiwi, Melon, Orange, Pineapple, and Strawberry.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/objects/asset-pixelfrog-fruit-apple.png',
    tag: 'fruit',
  },
  {
    id: 'pack-pixel-food',
    title: '2D Pixel Food & Dining',
    count: 102,
    description: '102 retro pixel-art dishes, snacks, breakfast, burgers, sushi, ramen, and drinks.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/food/15_burger.png',
    tag: 'food',
  },
  {
    id: 'pack-50s-diner',
    title: '50s Retro Diner & Furniture',
    count: 82,
    description: 'Classic 1950s retro diner booths, counters, neon clocks, bar stools, and props.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/furniture/booth_bench_red.png',
    tag: 'furniture',
  },
  {
    id: 'pack-minecraft',
    title: 'Minecraft Mobs & Gear',
    count: 52,
    description: 'Iconic voxel mobs: Creeper, Steve, Skeleton, Zombie, diamond swords, and golden apples.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-mc-iconic-creeper.png',
    tag: 'minecraft',
  },
  {
    id: 'pack-rpg-weapons',
    title: 'RPG Weapons & Loot',
    count: 35,
    description: 'Swords, bows, shields, potions, dungeon keys, gems, and treasure chests.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/objects/asset-kenney-item-004.png',
    idsPrefix: 'asset-kenney-item',
  },
  {
    id: 'pack-animals',
    title: 'Animals Remastered',
    count: 30,
    description: 'Cute round animal sprites: bears, pandas, dogs, monkeys, frogs, and penguins.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/characters/asset-kenney-animal-bear.png',
    idsPrefix: 'asset-kenney-animal',
  },
  {
    id: 'pack-game-skies',
    title: 'Game Skies & Panoramas',
    count: 25,
    description: 'Pixel skies, synthwave neon grids, dungeon caverns, deep space fields, and landscapes.',
    coverUrl: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/community-assets/backgrounds/bg-synthwave-grid.png',
    category: 'backgrounds',
  },
];

interface AssetPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectAssets: (assets: CommunityAsset[]) => void;
  selectedAssetIds?: string[];
  userId?: string | null;
}

const DEFAULT_CATEGORIES: AssetCategory[] = [
  { id: 'my_assets', label: 'My Assets', chips: [] },
  { id: 'trending', label: 'Trending', chips: [] },
  { id: 'packs', label: 'Packs', chips: ['all', 'characters', 'effects', 'vehicles', 'fantasy', 'sci-fi', 'ui', 'nature', 'modern-urban', 'tiles-terrain'] },
  { id: 'characters', label: 'Characters', chips: ['ninja_frog', 'foxy', 'gothicvania', 'fighter', 'platform_enemies', 'minecraft', 'arcade_monsters', 'animal', 'style:pixel', 'style:cartoon'] },
  { id: 'backgrounds', label: 'Backgrounds', chips: ['pixel', 'space', 'dungeon', 'cavern', 'sunset', 'cyberpunk'] },
  { id: 'objects', label: 'Objects', chips: ['fruit', 'food', 'furniture', 'weapon', 'space_fleet', 'loot', 'coin', 'gem', 'style:pixel'] },
  { id: 'icons', label: 'Icons', chips: ['medal', 'badge', 'star', 'achievement', 'action', 'symbol'] },
  { id: 'ui', label: 'UI', chips: ['style:flat_vector', 'style:minimalist', 'button', 'ui', 'arrow', 'control', 'hud', 'joystick', 'frame', 'heart'] },
  { id: 'effects', label: 'Effects', chips: ['explosion', 'fire', 'laser', 'sparkle', 'plasma', 'bullet'] },
  { id: 'portraits', label: 'Portraits', chips: ['hero', 'villain', 'monster', 'avatar'] },
  { id: 'memes', label: 'Memes', chips: ['trending', 'doge', 'pepe', 'cat', 'anime', 'reaction', 'gaming', 'funny', 'dance', 'rage', 'pixel', 'troll'] }
];

const MEME_CHIPS = ['trending', 'doge', 'pepe', 'cat', 'anime', 'reaction', 'gaming', 'funny', 'dance', 'rage', 'pixel', 'troll'];
const GIPHY_API_KEY = 'SwEhCBr38RpeNNffpxmtsZK9Umum8edV';

export const AssetPickerSheet: React.FC<AssetPickerSheetProps> = ({
  visible,
  onClose,
  onSelectAssets,
  selectedAssetIds = [],
  userId = null,
}) => {
  const [categories, setCategories] = useState<AssetCategory[]>(DEFAULT_CATEGORIES);
  const [activeTab, setActiveTab] = useState<string>('trending');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [assets, setAssets] = useState<CommunityAsset[]>([]);
  const [myAssets, setMyAssets] = useState<CommunityAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Record<string, CommunityAsset>>({});

  // Memes Giphy State
  const [memeSubTab, setMemeSubTab] = useState<'gifs' | 'stickers'>('gifs');
  const [giphyItems, setGiphyItems] = useState<CommunityAsset[]>([]);
  const [isGiphyLoading, setIsGiphyLoading] = useState(false);
  const [isGiphyLoadingMore, setIsGiphyLoadingMore] = useState(false);
  const [giphyHasMore, setGiphyHasMore] = useState(true);

  // Packs State
  const [packs, setPacks] = useState<AssetPack[]>(ASSET_PACKS);
  const [loadingPacks, setLoadingPacks] = useState(false);

  // Pack Drill-Down State
  const [selectedPack, setSelectedPack] = useState<AssetPack | null>(null);
  const [packAssets, setPackAssets] = useState<CommunityAsset[]>([]);
  const [loadingPackAssets, setLoadingPackAssets] = useState(false);

  // Create Asset Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPrompt, setCreatePrompt] = useState('');
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);

  // Height and drag expansion
  const COLLAPSED_HEIGHT = SCREEN_HEIGHT * 0.55;
  const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.88;
  const [expanded, setExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      sheetHeight.setValue(COLLAPSED_HEIGHT);
      setExpanded(false);
    }
  }, [visible, COLLAPSED_HEIGHT, sheetHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -35) {
            // Dragged UP -> expand
            Animated.spring(sheetHeight, {
              toValue: EXPANDED_HEIGHT,
              useNativeDriver: false,
              friction: 8,
            }).start();
            setExpanded(true);
          } else if (gestureState.dy > 35) {
            if (expanded) {
              // Dragged DOWN from expanded -> collapse to 55%
              Animated.spring(sheetHeight, {
                toValue: COLLAPSED_HEIGHT,
                useNativeDriver: false,
                friction: 8,
              }).start();
              setExpanded(false);
            } else {
              // Dragged DOWN from collapsed -> close sheet
              onClose();
            }
          }
        },
      }),
    [expanded, onClose, sheetHeight, COLLAPSED_HEIGHT, EXPANDED_HEIGHT]
  );

  // Initialize selectedMap from props
  useEffect(() => {
    if (visible) {
      setSelectedMap({});
    }
  }, [visible]);

  // Load category definitions
  useEffect(() => {
    if (!visible) return;
    assetsApi.getCategories().then((cats) => {
      if (cats && cats.length > 0) {
        setCategories(cats);
      }
    }).catch((err) => {
      console.warn('[AssetPicker] Failed to load categories:', err);
    });
  }, [visible]);

  // Load packs dynamically from /api/assets/packs
  useEffect(() => {
    if (!visible || activeTab !== 'packs') return;
    setLoadingPacks(true);
    const genreParam = activeChip && activeChip !== 'all' ? activeChip : undefined;
    assetsApi.getPacks({
      genre: genreParam,
      search: searchQuery.trim() || undefined,
      limit: 100,
    })
      .then((res) => {
        if (res.packs && res.packs.length > 0) {
          setPacks(res.packs);
        } else {
          if (genreParam) {
            setPacks(ASSET_PACKS.filter((p) => p.genre === genreParam || p.category === genreParam));
          } else {
            setPacks(ASSET_PACKS);
          }
        }
      })
      .catch((err) => {
        console.warn('[AssetPicker] Failed to load packs from API:', err);
      })
      .finally(() => {
        setLoadingPacks(false);
      });
  }, [visible, activeTab, activeChip, searchQuery]);

  // Active category chips
  const currentCategoryObj = useMemo(() => {
    return categories.find((c) => c.id === activeTab);
  }, [categories, activeTab]);

  const currentChips = useMemo(() => {
    return currentCategoryObj?.chips || [];
  }, [currentCategoryObj]);

  // Load assets based on activeTab, activeChip, and searchQuery
  const loadAssets = useCallback(async () => {
    if (!visible || activeTab === 'memes') return;
    setLoading(true);
    try {
      if (activeTab === 'my_assets') {
        const res = await assetsApi.getAssets({
          category: 'my_assets',
          creator_id: userId || undefined,
          search: searchQuery.trim() || undefined,
          limit: 60,
        });
        setMyAssets(res.assets || []);
      } else {
        const styleParam = activeChip?.startsWith('style:') ? activeChip : undefined;
        const tagParam = activeChip && !activeChip.startsWith('style:') ? activeChip : undefined;

        const res = await assetsApi.getAssets({
          category: activeTab,
          style: styleParam,
          tag: tagParam,
          search: searchQuery.trim() || undefined,
          limit: 60,
        });
        setAssets(res.assets || []);
      }
    } catch (e) {
      console.warn('[AssetPicker] Error loading assets:', e);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [visible, activeTab, activeChip, searchQuery, userId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Fetch Giphy GIFs / Stickers
  const fetchGiphy = useCallback(
    async (
      subTab: 'gifs' | 'stickers',
      query: string = '',
      offset: number = 0,
      append: boolean = false
    ) => {
      if (offset === 0) {
        setIsGiphyLoading(true);
      } else {
        setIsGiphyLoadingMore(true);
      }

      try {
        const cleanQuery = query.trim();
        const endpoint = cleanQuery ? 'search' : 'trending';
        const qParam = cleanQuery ? `&q=${encodeURIComponent(cleanQuery)}` : '';
        const url = `https://api.giphy.com/v1/${subTab}/${endpoint}?api_key=${GIPHY_API_KEY}&limit=24&offset=${offset}${qParam}`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Giphy API error: ${response.status}`);
        }
        const data = await response.json();
        const rawItems = data.data || [];

        const formatted: CommunityAsset[] = rawItems.map((item: any) => {
          const gifUrl = item.images?.fixed_height?.url || item.images?.original?.url || '';
          const thumbUrl = item.images?.fixed_height_small?.url || item.images?.fixed_height?.url || gifUrl;
          return {
            id: `giphy-${item.id}`,
            title: item.title || (subTab === 'stickers' ? 'Meme Sticker' : 'Meme GIF'),
            category: 'memes',
            style: subTab === 'stickers' ? 'sticker' : 'gif',
            tags: ['meme', subTab],
            image_url: gifUrl,
            thumbnail_url: thumbUrl,
            uses_count: Math.floor(Math.random() * 400) + 50,
            is_transparent: subTab === 'stickers',
          };
        });

        if (append) {
          setGiphyItems((prev) => [...prev, ...formatted]);
        } else {
          setGiphyItems(formatted);
        }
        setGiphyHasMore(rawItems.length >= 24);
      } catch (error) {
        console.warn('[AssetPicker] Error fetching Giphy:', error);
        if (!append) {
          setGiphyItems([]);
        }
      } finally {
        setIsGiphyLoading(false);
        setIsGiphyLoadingMore(false);
      }
    },
    []
  );

  // Trigger Giphy fetch on memes tab changes or debounced search query
  useEffect(() => {
    if (!visible || activeTab !== 'memes') return;

    const timer = setTimeout(() => {
      const q = searchQuery.trim() || (activeChip && activeChip !== 'trending' ? activeChip : '');
      fetchGiphy(memeSubTab, q, 0, false);
    }, searchQuery.trim() ? 350 : 0);

    return () => clearTimeout(timer);
  }, [visible, activeTab, memeSubTab, activeChip, searchQuery, fetchGiphy]);

  const handleLoadMoreGiphy = () => {
    if (activeTab !== 'memes' || isGiphyLoading || isGiphyLoadingMore || !giphyHasMore) return;
    const currentQuery = searchQuery.trim() || (activeChip && activeChip !== 'trending' ? activeChip : '');
    fetchGiphy(memeSubTab, currentQuery, giphyItems.length, true);
  };

  // Handle Tab Change
  const handleTabChange = (tabId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActiveTab(tabId);
    setActiveChip(null);
    setSelectedPack(null);
    if (tabId === 'memes') {
      setMemeSubTab('gifs');
    }
  };

  // Helper to fetch assets for a pack
  const fetchPackAssets = async (pack: AssetPack): Promise<CommunityAsset[]> => {
    let items: CommunityAsset[] = [];
    if (pack.idsPrefix) {
      const res = await assetsApi.getAssets({ idsPrefix: pack.idsPrefix, limit: 100 });
      items = res.assets || [];
    }
    if (items.length === 0 && pack.tag) {
      const res = await assetsApi.getAssets({ tag: pack.tag, limit: 100 });
      items = res.assets || [];
    }
    if (items.length === 0 && pack.id) {
      const cleanId = pack.id.replace('pack-', '');
      const res = await assetsApi.getAssets({ idsPrefix: cleanId, limit: 100 });
      items = res.assets || [];
    }
    if (items.length === 0 && pack.category) {
      const res = await assetsApi.getAssets({ category: pack.category, limit: 100 });
      items = res.assets || [];
    }
    return items;
  };

  // Handle opening a pack - AUTOMATICALLY SELECTS ALL ASSETS IN THAT PACK
  const handleOpenPack = async (pack: AssetPack) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedPack(pack);
    setLoadingPackAssets(true);
    try {
      const items = await fetchPackAssets(pack);
      setPackAssets(items);

      // Automatically select all things in this pack
      if (items.length > 0) {
        setSelectedMap((prev) => {
          const next = { ...prev };
          items.forEach((a) => {
            next[a.id] = a;
          });
          return next;
        });
      }
    } catch (e) {
      console.warn('[AssetPicker] Error loading pack items:', e);
      setPackAssets([]);
    } finally {
      setLoadingPackAssets(false);
    }
  };

  // Quick-toggle all assets of a pack from the packs grid
  const handleQuickTogglePack = async (pack: AssetPack) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    try {
      const items = await fetchPackAssets(pack);
      if (items.length === 0) return;
      const allSelected = items.every((a) => !!selectedMap[a.id]);
      setSelectedMap((prev) => {
        const next = { ...prev };
        if (allSelected) {
          items.forEach((a) => delete next[a.id]);
        } else {
          items.forEach((a) => {
            next[a.id] = a;
          });
        }
        return next;
      });
    } catch (e) {
      console.warn('[AssetPicker] Error toggling pack items:', e);
    }
  };

  const getPackSelectedCount = useCallback((pack: AssetPack) => {
    const selectedList = Object.values(selectedMap);
    if (selectedList.length === 0) return 0;
    if (pack.idsPrefix) {
      return selectedList.filter((a) => a.id.startsWith(pack.idsPrefix!)).length;
    }
    if (pack.tag) {
      return selectedList.filter((a) => a.tags?.includes(pack.tag!)).length;
    }
    const cleanId = pack.id.replace('pack-', '');
    return selectedList.filter((a) => a.id.includes(cleanId)).length;
  }, [selectedMap]);

  // Close drill-down back to packs overview
  const handleClosePack = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedPack(null);
    setPackAssets([]);
  };

  // Toggle select all in current pack
  const handleToggleSelectAllInPack = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (packAssets.length === 0) return;

    const allSelected = packAssets.every((a) => !!selectedMap[a.id]);

    setSelectedMap((prev) => {
      const next = { ...prev };
      if (allSelected) {
        packAssets.forEach((a) => delete next[a.id]);
      } else {
        packAssets.forEach((a) => {
          next[a.id] = a;
        });
      }
      return next;
    });
  };

  const selectedPackCount = useMemo(() => {
    return packAssets.filter((a) => !!selectedMap[a.id]).length;
  }, [packAssets, selectedMap]);

  const isAllPackSelected = useMemo(() => {
    return packAssets.length > 0 && selectedPackCount === packAssets.length;
  }, [packAssets, selectedPackCount]);

  // Handle Chip Change
  const handleChipToggle = (chip: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActiveChip((prev) => (prev === chip ? null : chip));
  };

  // Toggle Selection
  const toggleSelectAsset = (asset: CommunityAsset) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[asset.id]) {
        delete next[asset.id];
      } else {
        next[asset.id] = asset;
      }
      return next;
    });
  };

  // Launch Camera Roll
  const handlePickFromAlbum = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please enable photo access to select assets.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        uploadLocalFile(result.assets[0].uri, 'album_photo.png');
      }
    } catch (e: any) {
      Alert.alert('Album Error', e.message || 'Failed to open photo album.');
    }
  };

  // Launch Camera
  const handlePickFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please enable camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        uploadLocalFile(result.assets[0].uri, 'camera_photo.png');
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e.message || 'Failed to capture photo.');
    }
  };

  // Upload file helper
  const uploadLocalFile = async (uri: string, filename: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: filename,
        type: 'image/png',
      } as any);
      formData.append('type', 'image');
      formData.append('category', 'objects');
      if (userId) formData.append('creator_id', userId);

      const res = await assetsApi.uploadAsset(formData);
      if (res.success && res.asset) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setMyAssets((prev) => [res.asset, ...prev]);
        toggleSelectAsset(res.asset);
      } else {
        Alert.alert('Upload Failed', res.error || 'Could not upload image.');
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Error uploading file.');
    } finally {
      setLoading(false);
    }
  };

  // AI Create Asset
  const handleGenerateAsset = async () => {
    if (!createPrompt.trim()) return;
    setIsCreatingAsset(true);
    try {
      const res = await assetsApi.generateAsset(createPrompt.trim(), 'objects', 'style:3d_render');
      if (res.success && res.asset) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setShowCreateModal(false);
        setCreatePrompt('');
        setMyAssets((prev) => [res.asset, ...prev]);
        toggleSelectAsset(res.asset);
      } else {
        Alert.alert('Generation Failed', res.error || 'Could not generate asset.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create asset sticker.');
    } finally {
      setIsCreatingAsset(false);
    }
  };

  // Confirm selection and close
  const handleConfirmUse = () => {
    const list = Object.values(selectedMap);
    if (list.length > 0) {
      // Record usage in background
      list.forEach((item) => assetsApi.recordUse(item.id).catch(() => {}));
      onSelectAssets(list);
    }
    onClose();
  };

  // Display count helper
  const formatUses = (count: number) => {
    if (!count) return '10 used';
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K used`;
    }
    return `${count} used`;
  };

  const selectedCount = Object.keys(selectedMap).length;
  const isCurrentLoading = activeTab === 'memes' ? isGiphyLoading : loading;
  const currentList = activeTab === 'my_assets' ? myAssets : activeTab === 'memes' ? giphyItems : assets;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tapping outside sheet dismisses it */}
        <Pressable style={styles.backdropDismissArea} onPress={onClose} />

        <Animated.View style={[styles.sheetContainer, { height: sheetHeight }]}>
          {/* Top Grabber & Drag handle */}
          <View {...panResponder.panHandlers} style={styles.grabberTouchArea}>
            <View style={styles.grabber} />
          </View>

          {selectedPack ? (
            /* ── PACK DRILL-DOWN VIEW (Exact Match: Screenshot 2) ── */
            <View style={{ flex: 1 }}>
              {/* Pack Header Row: Back Arrow + Title/Desc + Use N of M CTA */}
              <View style={styles.packHeaderRow}>
                <TouchableOpacity
                  style={styles.packBackBtn}
                  onPress={handleClosePack}
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.packHeaderCenter}>
                  <Text style={styles.packHeaderTitle} numberOfLines={1}>
                    {selectedPack.title}
                  </Text>
                  <Text style={styles.packHeaderDesc} numberOfLines={1}>
                    {selectedPack.description}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.packUseBtn,
                    selectedPackCount === 0 && styles.packUseBtnDisabled,
                  ]}
                  onPress={handleConfirmUse}
                  activeOpacity={0.8}
                >
                  <Text style={styles.packUseBtnText}>
                    Use {selectedPackCount} of {packAssets.length}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Pack Subheader: Included Count + Select All Toggle */}
              <View style={styles.packSubheaderRow}>
                <Text style={styles.packIncludedText}>
                  {selectedPackCount} of {packAssets.length} included
                </Text>
                <TouchableOpacity onPress={handleToggleSelectAllInPack} hitSlop={8}>
                  <Text style={styles.packSelectAllText}>
                    {isAllPackSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Grid of Pack Items (3 Columns) */}
              {loadingPackAssets ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator size="large" color="#A855F7" />
                  <Text style={styles.loaderText}>Loading pack items...</Text>
                </View>
              ) : packAssets.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="images-outline" size={44} color="#475569" />
                  <Text style={styles.emptyTitle}>No items found</Text>
                  <Text style={styles.emptySub}>This pack doesn't contain items yet.</Text>
                </View>
              ) : (
                <FlatList
                  key={`pack-drilldown-${selectedPack?.id || 'pack'}-3cols`}
                  data={packAssets}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.gridContent}
                  columnWrapperStyle={styles.gridRow}
                  renderItem={({ item }) => {
                    const isSelected = !!selectedMap[item.id];
                    return (
                      <TouchableOpacity
                        style={[styles.assetCard, isSelected && styles.assetCardSelected]}
                        onPress={() => toggleSelectAsset(item)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.imageContainer}>
                          <Image
                            source={{ uri: item.image_url }}
                            style={styles.assetImage}
                            resizeMode="contain"
                          />
                        </View>

                        {/* Usage Count Badge */}
                        <View style={styles.usesBadge}>
                          <Text style={styles.usesText}>{formatUses(item.uses_count)}</Text>
                        </View>

                        {/* Selection Checkmark */}
                        <View style={[styles.packCheckCircle, isSelected && styles.packCheckCircleSelected]}>
                          {isSelected && <Ionicons name="checkmark" size={13} color="#FFF" />}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          ) : (
            /* ── MAIN CATEGORIES & PACKS OVERVIEW VIEW (Screenshot 1) ── */
            <>
              {/* Header Row: Title + Search Toggle + Close */}
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <Text style={styles.headerTitle}>Asset Library</Text>
                  <Text style={styles.headerSub}>Characters, objects & backgrounds</Text>
                </View>
                <View style={styles.headerRight}>
                  <TouchableOpacity
                    style={[styles.iconCircle, isSearchOpen && styles.iconCircleActive]}
                    onPress={() => setIsSearchOpen((prev) => !prev)}
                    hitSlop={8}
                  >
                    <Ionicons name="search" size={18} color={isSearchOpen ? '#C084FC' : '#94A3B8'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconCircle} onPress={onClose} hitSlop={8}>
                    <Ionicons name="close" size={20} color="#E2E8F0" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar Input (Expands when open) */}
              {isSearchOpen && (
                <View style={styles.searchBarWrap}>
                  <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginLeft: 12 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search characters, food, weapons, liminal spaces..."
                    placeholderTextColor="#64748B"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  {searchQuery ? (
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
                        onPress={() => handleTabChange(cat.id)}
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

              {/* Memes Sub-Header: GIFs vs Stickers Toggle + Quick Chips */}
              {activeTab === 'memes' && (
                <View style={styles.memesSubHeader}>
                  {/* Segmented Toggle: GIFs vs Stickers */}
                  <View style={styles.memesToggleRow}>
                    <TouchableOpacity
                      style={[styles.memesToggleBtn, memeSubTab === 'gifs' && styles.memesToggleBtnActive]}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        setMemeSubTab('gifs');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.memesToggleBtnText, memeSubTab === 'gifs' && styles.memesToggleBtnTextActive]}>
                        👾 GIFs
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.memesToggleBtn, memeSubTab === 'stickers' && styles.memesToggleBtnActive]}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        setMemeSubTab('stickers');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.memesToggleBtnText, memeSubTab === 'stickers' && styles.memesToggleBtnTextActive]}>
                        🙂 Stickers
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Meme Filter Chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.memeChipsContent}
                  >
                    {MEME_CHIPS.map((chip) => {
                      const isChipActive = (!activeChip && chip === 'trending') || activeChip === chip;
                      return (
                        <TouchableOpacity
                          key={chip}
                          onPress={() => {
                            try {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            } catch {}
                            setActiveChip(chip === 'trending' ? null : chip);
                          }}
                          style={[styles.chipPill, isChipActive && styles.chipPillActive]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, isChipActive && styles.chipTextActive]}>
                            {chip}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Secondary Sub-Filter Chips Row (Hidden for Packs, My Assets & Memes) */}
              {currentChips.length > 0 && activeTab !== 'my_assets' && activeTab !== 'packs' && activeTab !== 'memes' && (
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
                          onPress={() => handleChipToggle(chip)}
                          style={[styles.chipPill, isChipActive && styles.chipPillActive]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.chipText, isChipActive && styles.chipTextActive]}>
                            {chip.replace('style:', '')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* My Assets 3-Action Bar */}
              {activeTab === 'my_assets' && (
                <View style={styles.myAssetsActionsRow}>
                  <TouchableOpacity
                    style={styles.actionPillBtn}
                    onPress={handlePickFromAlbum}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images-outline" size={18} color="#C084FC" />
                    <Text style={styles.actionPillText}>Album</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionPillBtn}
                    onPress={handlePickFromCamera}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={18} color="#38BDF8" />
                    <Text style={styles.actionPillText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionPillBtn, styles.actionPillBtnSparkle]}
                    onPress={() => setShowCreateModal(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="sparkles" size={16} color="#F59E0B" />
                    <Text style={[styles.actionPillText, { color: '#F59E0B' }]}>Create asset</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Main Content Area */}
              {activeTab === 'packs' ? (
                /* ── 2-COLUMN PACKS GRID (Screenshot 1) ── */
                <FlatList
                  key="packs-grid-2cols"
                  data={packs}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.packGridContent}
                  columnWrapperStyle={styles.packGridRow}
                  renderItem={({ item }) => {
                    const selCount = getPackSelectedCount(item);
                    const isAnySelected = selCount > 0;
                    return (
                      <TouchableOpacity
                        style={[styles.packCard, isAnySelected && styles.packCardSelected]}
                        onPress={() => handleOpenPack(item)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.packCoverContainer}>
                          <Image
                            source={{ uri: item.coverUrl }}
                            style={styles.packCoverImage}
                            resizeMode="contain"
                          />
                          <TouchableOpacity
                            style={[
                              styles.packCardCheckCircle,
                              isAnySelected && styles.packCardCheckCircleSelected,
                            ]}
                            onPress={() => handleQuickTogglePack(item)}
                            hitSlop={8}
                          >
                            {isAnySelected && <Ionicons name="checkmark" size={13} color="#FFF" />}
                          </TouchableOpacity>
                        </View>
                        <View style={styles.packInfo}>
                          <Text style={styles.packTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={[styles.packCountText, isAnySelected && styles.packCountTextSelected]}>
                            {isAnySelected ? `${selCount} of ${item.count} selected` : `${item.count} images`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              ) : isCurrentLoading ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator size="large" color="#A855F7" />
                  <Text style={styles.loaderText}>
                    {activeTab === 'memes' ? 'Loading Giphy memes...' : 'Loading assets...'}
                  </Text>
                </View>
              ) : currentList.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name={activeTab === 'memes' ? 'happy-outline' : activeTab === 'my_assets' ? 'folder-open-outline' : 'search-outline'}
                    size={44}
                    color="#475569"
                  />
                  <Text style={styles.emptyTitle}>
                    {activeTab === 'memes'
                      ? 'No memes found'
                      : activeTab === 'my_assets'
                      ? 'No materials yet'
                      : 'No assets found'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {activeTab === 'memes'
                      ? 'Try another search term or switch between GIFs and Stickers.'
                      : activeTab === 'my_assets'
                      ? 'Upload images from your album or generate stickers with AI.'
                      : 'Try selecting a different filter or search term.'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  key={`assets-grid-${activeTab}-${activeTab === 'memes' ? memeSubTab : 'tab'}-3cols`}
                  data={currentList}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.gridContent}
                  columnWrapperStyle={styles.gridRow}
                  onEndReached={() => {
                    if (activeTab === 'memes') {
                      handleLoadMoreGiphy();
                    }
                  }}
                  onEndReachedThreshold={0.4}
                  ListFooterComponent={
                    activeTab === 'memes' && isGiphyLoadingMore ? (
                      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#C084FC" />
                      </View>
                    ) : (
                      <View style={{ height: 20 }} />
                    )
                  }
                  renderItem={({ item }) => {
                    const isSelected = !!selectedMap[item.id];
                    const isBg = item.category === 'backgrounds';
                    const isMeme = activeTab === 'memes' || item.category === 'memes';
                    const isSticker = isMeme && (item.style === 'sticker' || memeSubTab === 'stickers');

                    return (
                      <TouchableOpacity
                        style={[
                          styles.assetCard,
                          isSelected && styles.assetCardSelected,
                          isSticker && styles.stickerCardBg,
                        ]}
                        onPress={() => toggleSelectAsset(item)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.imageContainer}>
                          <Image
                            source={{ uri: item.thumbnail_url || item.image_url }}
                            style={styles.assetImage}
                            resizeMode={isBg ? 'cover' : 'contain'}
                          />
                        </View>

                        {/* Meme GIF / Sticker Badge */}
                        {isMeme && (
                          <View style={styles.memeBadge}>
                            <Text style={styles.memeBadgeText}>
                              {isSticker ? 'STICKER' : 'GIF'}
                            </Text>
                          </View>
                        )}

                        {/* Usage Count Badge */}
                        <View style={styles.usesBadge}>
                          <Text style={styles.usesText}>{formatUses(item.uses_count)}</Text>
                        </View>

                        {/* Selection Checkmark */}
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              {/* Bottom Confirmation Bar */}
              {selectedCount > 0 && (
                <View style={styles.bottomBar}>
                  <View style={styles.bottomBarLeft}>
                    <Text style={styles.selectedCountText}>
                      {selectedCount} asset{selectedCount > 1 ? 's' : ''} selected
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.useButton}
                    onPress={handleConfirmUse}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.useButtonText}>Use In Game</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Create Asset AI Dialog Modal */}
          <Modal visible={showCreateModal} animationType="fade" transparent onRequestClose={() => setShowCreateModal(false)}>
            <View style={styles.createModalBackdrop}>
              <View style={styles.createModalCard}>
                <View style={styles.createModalHeader}>
                  <Text style={styles.createModalTitle}>Create Asset with AI</Text>
                  <TouchableOpacity onPress={() => setShowCreateModal(false)} hitSlop={8}>
                    <Ionicons name="close" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.createModalSub}>
                  Describe an item, character, or object. AI will generate it with a transparent background.
                </Text>

                <TextInput
                  style={styles.createModalInput}
                  placeholder="e.g. golden slime monster, pixel ruby sword, futuristic laser gun..."
                  placeholderTextColor="#64748B"
                  value={createPrompt}
                  onChangeText={setCreatePrompt}
                  multiline
                  maxLength={120}
                  autoFocus
                />

                <View style={styles.createModalActions}>
                  <TouchableOpacity
                    style={styles.createModalCancelBtn}
                    onPress={() => setShowCreateModal(false)}
                  >
                    <Text style={styles.createModalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.createModalSubmitBtn, (!createPrompt.trim() || isCreatingAsset) && styles.btnDisabled]}
                    onPress={handleGenerateAsset}
                    disabled={!createPrompt.trim() || isCreatingAsset}
                  >
                    {isCreatingAsset ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={16} color="#FFF" />
                        <Text style={styles.createModalSubmitText}>Generate</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </Animated.View>
      </View>
    </Modal>
  );
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    paddingVertical: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: 'rgba(255, 255, 255, 0.45)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderColor: '#C084FC',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E28',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
    color: '#FFF',
    fontSize: 13,
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
    paddingVertical: 12,
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
    backgroundColor: '#C084FC',
    borderRadius: 2,
  },
  chipsBarWrap: {
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chipPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  myAssetsActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  actionPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionPillBtnSparkle: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  actionPillText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  assetCard: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.25,
    borderRadius: 16,
    backgroundColor: '#181824',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    position: 'relative',
  },
  assetCardSelected: {
    borderColor: '#C084FC',
    borderWidth: 2,
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
  },
  imageContainer: {
    flex: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetImage: {
    width: '100%',
    height: '100%',
  },
  usesBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  usesText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 9,
    fontWeight: '700',
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySub: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 15, 20, 0.95)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomBarLeft: {},
  selectedCountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#9333EA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  useButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  createModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  createModalCard: {
    width: '100%',
    backgroundColor: '#1E1E28',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  createModalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  createModalSub: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  createModalInput: {
    backgroundColor: '#121218',
    borderRadius: 14,
    padding: 14,
    color: '#FFF',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  createModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  createModalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createModalCancelText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '700',
  },
  createModalSubmitBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#9333EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  createModalSubmitText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  // ── PACK OVERVIEW GRID STYLES (Screenshot 1) ──
  packGridContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  packGridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  packCard: {
    width: PACK_COLUMN_WIDTH,
    backgroundColor: '#191822',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  packCardSelected: {
    borderColor: '#C084FC',
    borderWidth: 2,
    backgroundColor: 'rgba(192, 132, 252, 0.08)',
  },
  packCoverContainer: {
    width: '100%',
    aspectRatio: 1.15,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    position: 'relative',
  },
  packCoverImage: {
    width: '100%',
    height: '100%',
  },
  packCardCheckCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packCardCheckCircleSelected: {
    backgroundColor: '#9333EA',
    borderColor: '#C084FC',
  },
  packInfo: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  packTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  packCountText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  packCountTextSelected: {
    color: '#C084FC',
    fontWeight: '700',
  },

  // ── PACK DRILL-DOWN STYLES (Screenshot 2) ──
  packHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  packBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  packHeaderCenter: {
    flex: 1,
  },
  packHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  packHeaderDesc: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    marginTop: 2,
  },
  packUseBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packUseBtnDisabled: {
    opacity: 0.5,
  },
  packUseBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  packSubheaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  packIncludedText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  packSelectAllText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  packCheckCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packCheckCircleSelected: {
    backgroundColor: '#A855F7',
    borderColor: '#A855F7',
  },
  // ── MEMES & GIPHY STYLES ──
  memesSubHeader: {
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  memesToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#1C1B24',
    borderRadius: 22,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  memesToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 22,
    borderRadius: 19,
    backgroundColor: 'transparent',
  },
  memesToggleBtnActive: {
    backgroundColor: '#2E2D3D',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.4)',
  },
  memesToggleBtnText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '700',
  },
  memesToggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  memeChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  memeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(192, 132, 252, 0.4)',
  },
  memeBadgeText: {
    color: '#C084FC',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stickerCardBg: {
    backgroundColor: '#12121A',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
