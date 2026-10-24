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
import { models3dApi, Model3DAsset, Model3DCategory } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 44) / 2;

interface Model3DPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectModel: (model: Model3DAsset) => void;
  selectedModelUrl?: string | null;
  userId?: string | null;
}

export const DEFAULT_3D_CATEGORIES: Model3DCategory[] = [
  { id: 'trending', label: 'All 3D Models', chips: [] },
  { id: 'lagos', label: '🇳🇬 Lagos Legends', chips: ['street_hustler', 'tech_bro', 'veteran', 'lagos'] },
  { id: 'fighters', label: 'Fighters & Ninjas', chips: ['martial_arts', 'ninja', 'combat'] },
  { id: 'superheroes', label: 'Superheroes', chips: ['green_lantern', 'hero'] },
  { id: 'my_models', label: 'My Uploads', chips: [] },
];

/**
 * Real Blender 3D Renders bundled for instant offline display
 */
const LOCAL_THUMBNAILS: Record<string, any> = {
  'gt-lagos-street-hustler': require('../../assets/models3d/thumbnails/street_hustler.png'),
  'gt-lagos-tech-bro': require('../../assets/models3d/thumbnails/tech_bro.png'),
  'gt-lagos-veteran': require('../../assets/models3d/thumbnails/veteran.png'),
  'gt-liu-kang': require('../../assets/models3d/thumbnails/liu_kang.png'),
  'gt-scorpion': require('../../assets/models3d/thumbnails/scorpion.png'),
  'gt-green-lantern': require('../../assets/models3d/thumbnails/hal_jordan.png'),
};

/**
 * ONLY REAL 3D ASSETS IN STORAGE
 */
export const CURATED_3D_MODELS: Model3DAsset[] = [
  {
    id: 'gt-lagos-street-hustler',
    name: 'Street Hustler',
    title: 'Lagos Street Hustler',
    category: 'characters',
    subcategory: 'lagos',
    tags: ['lagos', 'street_hustler', 'agbero', 'conductor', 'rigged', 'ue5_bones', 'character'],
    url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/assets/3d/characters/gt_characters_07c99b16f29e.glb',
    cdn_url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/assets/3d/characters/gt_characters_07c99b16f29e.glb',
    thumbnail_url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/thumbnails/07c99b16f29e088e.webp',
    thumb: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/thumbnails/07c99b16f29e088e.webp',
    is_rigged: true,
    rig_type: 'ue5_humanoid',
    bone_count: 100,
    format: 'glb',
    file_size: '2.4 MB',
    file_size_bytes: 2516582,
    uses_count: 1420,
    description: 'Lagos street conductor archetype. Rigged to UE5 Master Skeleton (100 bones).',
  },
  {
    id: 'gt-lagos-tech-bro',
    name: 'Tech Bro',
    title: 'Lekki Tech Bro',
    category: 'characters',
    subcategory: 'lagos',
    tags: ['lagos', 'tech_bro', 'lekki', 'developer', 'startup', 'rigged', 'ue5_bones', 'character'],
    url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/assets/3d/characters/gt_characters_7cc29526e7f7.glb',
    cdn_url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/assets/3d/characters/gt_characters_7cc29526e7f7.glb',
    thumbnail_url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/thumbnails/7cc29526e7f7a80e.webp',
    thumb: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/thumbnails/7cc29526e7f7a80e.webp',
    is_rigged: true,
    rig_type: 'ue5_humanoid',
    bone_count: 100,
    format: 'glb',
    file_size: '2.1 MB',
    file_size_bytes: 2162688,
    uses_count: 1180,
    description: 'Lekki Phase 1 tech founder archetype. Rigged to UE5 Master Skeleton (100 bones).',
  },
  {
    id: 'gt-lagos-veteran',
    name: 'Military Veteran',
    title: 'Nigerian Military Veteran',
    category: 'characters',
    subcategory: 'lagos',
    tags: ['lagos', 'veteran', 'soldier', 'military', 'fighter', 'tactical', 'rigged', 'ue5_bones', 'character'],
    url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/assets/3d/characters/gt_characters_67f3eac80f68.glb',
    cdn_url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/assets/3d/characters/gt_characters_67f3eac80f68.glb',
    thumbnail_url: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/thumbnails/67f3eac80f68480e.webp',
    thumb: 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/thumbnails/67f3eac80f68480e.webp',
    is_rigged: true,
    rig_type: 'ue5_humanoid',
    bone_count: 100,
    format: 'glb',
    file_size: '3.1 MB',
    file_size_bytes: 3282042,
    uses_count: 980,
    description: 'Tactical veteran character. Auto-compressed from 16.7MB to 3.1MB and rigged (100 bones).',
  },
  {
    id: 'gt-liu-kang',
    name: 'Liu Kang',
    title: 'Shaolin Martial Artist',
    category: 'characters',
    subcategory: 'fighters',
    tags: ['fighter', 'martial_arts', 'liu_kang', 'combat', 'warrior', 'rigged', 'ue5_bones'],
    url: '/storage/models3d/rigged/liu_kang_rigged.glb',
    cdn_url: '/storage/models3d/rigged/liu_kang_rigged.glb',
    thumbnail_url: '',
    is_rigged: true,
    rig_type: 'humanoid',
    bone_count: 85,
    format: 'glb',
    file_size: '0.99 MB',
    uses_count: 840,
    description: 'Shaolin martial artist warrior model rigged with full combat skeleton.',
  },
  {
    id: 'gt-scorpion',
    name: 'Scorpion',
    title: 'Scorpion Ninja Warrior',
    category: 'characters',
    subcategory: 'fighters',
    tags: ['ninja', 'scorpion', 'fighter', 'warrior', 'assassin', 'rigged', 'ue5_bones'],
    url: '/storage/models3d/rigged/scorpion_rigged.glb',
    cdn_url: '/storage/models3d/rigged/scorpion_rigged.glb',
    thumbnail_url: '',
    is_rigged: true,
    rig_type: 'humanoid',
    bone_count: 85,
    format: 'glb',
    file_size: '0.43 MB',
    uses_count: 910,
    description: 'Netherrealm ninja warrior rigged with martial arts skeleton.',
  },
  {
    id: 'gt-green-lantern',
    name: 'Green Lantern',
    title: 'Green Lantern (Hal Jordan)',
    category: 'characters',
    subcategory: 'superheroes',
    tags: ['superhero', 'green_lantern', 'hal_jordan', 'hero', 'rigged', 'ue5_bones'],
    url: '/storage/models3d/rigged/hal_jordan_green_lantern_rigged.glb',
    cdn_url: '/storage/models3d/rigged/hal_jordan_green_lantern_rigged.glb',
    thumbnail_url: '',
    is_rigged: true,
    rig_type: 'humanoid',
    bone_count: 90,
    format: 'glb',
    file_size: '1.41 MB',
    uses_count: 730,
    description: 'Cosmic hero with power ring suit rigged to standard skeleton.',
  },
];

export const Model3DPickerSheet: React.FC<Model3DPickerSheetProps> = ({
  visible,
  onClose,
  onSelectModel,
  selectedModelUrl = null,
  userId = null,
}) => {
  const [categories, setCategories] = useState<Model3DCategory[]>(DEFAULT_3D_CATEGORIES);
  const [activeTab, setActiveTab] = useState<string>('trending');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [models, setModels] = useState<Model3DAsset[]>(CURATED_3D_MODELS);
  const [myModels, setMyModels] = useState<Model3DAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model3DAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Height and drag expansion
  const COLLAPSED_HEIGHT = SCREEN_HEIGHT * 0.58;
  const EXPANDED_HEIGHT = SCREEN_HEIGHT * 0.90;
  const [expanded, setExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      sheetHeight.setValue(COLLAPSED_HEIGHT);
      setExpanded(false);
      setActiveTab('trending');
      setActiveChip(null);
      setSearchQuery('');
    }
  }, [visible, COLLAPSED_HEIGHT, sheetHeight]);

  useEffect(() => {
    if (selectedModelUrl) {
      const match = [...models, ...CURATED_3D_MODELS].find(
        (m) => m.url === selectedModelUrl || m.cdn_url === selectedModelUrl
      );
      if (match) setSelectedModel(match);
    }
  }, [selectedModelUrl, models]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -50) {
            Animated.spring(sheetHeight, {
              toValue: EXPANDED_HEIGHT,
              useNativeDriver: false,
              friction: 8,
            }).start();
            setExpanded(true);
          } else if (gestureState.dy > 120 && expanded) {
            Animated.spring(sheetHeight, {
              toValue: COLLAPSED_HEIGHT,
              useNativeDriver: false,
              friction: 8,
            }).start();
            setExpanded(false);
          } else if (gestureState.dy > 160 && !expanded) {
            onClose();
          }
        },
      }),
    [expanded, onClose, sheetHeight, COLLAPSED_HEIGHT, EXPANDED_HEIGHT]
  );

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await models3dApi.getCategories();
      if (cats && cats.length > 0) {
        setCategories(cats);
      }
    } catch {
      setCategories(DEFAULT_3D_CATEGORIES);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    try {
      const res = await models3dApi.getModels({
        category: activeTab !== 'trending' && activeTab !== 'my_models' ? activeTab : undefined,
        tag: activeChip || undefined,
        search: searchQuery.trim() || undefined,
        creator_id: activeTab === 'my_models' ? userId || undefined : undefined,
      });

      if (res && res.models && res.models.length > 0) {
        const seenIds = new Set(res.models.map((m) => m.id));
        const relevantCurated = CURATED_3D_MODELS.filter((c) => !seenIds.has(c.id));
        setModels([...res.models, ...relevantCurated]);
      } else {
        setModels(CURATED_3D_MODELS);
      }
    } catch {
      setModels(CURATED_3D_MODELS);
    } finally {
      setLoading(false);
    }
  }, [visible, activeTab, activeChip, searchQuery, userId]);

  useEffect(() => {
    if (visible) {
      fetchCategories();
    }
  }, [visible, fetchCategories]);

  useEffect(() => {
    if (visible) {
      fetchModels();
    }
  }, [visible, fetchModels]);

  const handleUploadModel = async () => {
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setIsUploading(true);
      const file = result.assets[0];
      const filename = file.uri.split('/').pop() || 'model.glb';

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: filename,
        type: 'model/gltf-binary',
      } as any);
      formData.append('category', 'characters');
      formData.append('name', filename.replace(/\.[^/.]+$/, ''));

      const uploadRes = await models3dApi.uploadModel(formData);

      if (uploadRes && (uploadRes.success || uploadRes.url || uploadRes.asset)) {
        const newAsset: Model3DAsset = {
          id: uploadRes.asset?.id || `user-3d-${Date.now()}`,
          name: uploadRes.asset?.name || filename,
          title: uploadRes.asset?.name || filename,
          category: 'characters',
          tags: ['custom_upload', '3d'],
          url: uploadRes.asset?.cdn_url || uploadRes.asset?.url || uploadRes.url,
          cdn_url: uploadRes.asset?.cdn_url || uploadRes.url,
          thumbnail_url: uploadRes.asset?.thumbnail_url || '',
          is_rigged: Boolean(uploadRes.asset?.is_rigged),
          bone_count: uploadRes.asset?.bone_count || 0,
          format: 'glb',
          file_size: 'Uploaded',
        };

        setMyModels((prev) => [newAsset, ...prev]);
        setModels((prev) => [newAsset, ...prev]);
        setSelectedModel(newAsset);
        Alert.alert('Upload Successful', `3D asset "${newAsset.name}" is ready!`);
      } else {
        Alert.alert('Upload Error', uploadRes?.error || 'Failed to upload 3D file.');
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Could not upload 3D asset.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredModels = useMemo(() => {
    let list = activeTab === 'my_models' ? myModels : models;

    if (activeTab === 'lagos') {
      list = list.filter(
        (m) =>
          m.subcategory === 'lagos' ||
          m.tags?.some((t) => ['lagos', 'tech_bro', 'hustler', 'veteran', 'lekki'].includes(t.toLowerCase()))
      );
    } else if (activeTab === 'fighters') {
      list = list.filter(
        (m) =>
          m.subcategory === 'fighters' ||
          m.tags?.some((t) => ['fighter', 'martial_arts', 'ninja', 'combat'].includes(t.toLowerCase()))
      );
    } else if (activeTab === 'superheroes') {
      list = list.filter(
        (m) =>
          m.subcategory === 'superheroes' ||
          m.tags?.some((t) => ['superhero', 'hero', 'green_lantern'].includes(t.toLowerCase()))
      );
    }

    if (activeChip) {
      const chipLower = activeChip.toLowerCase();
      list = list.filter(
        (m) =>
          m.tags?.some((t) => t.toLowerCase().includes(chipLower)) ||
          m.title.toLowerCase().includes(chipLower) ||
          m.name.toLowerCase().includes(chipLower)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.tags?.some((t) => t.toLowerCase().includes(q)) ||
          (m.description && m.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [models, myModels, activeTab, activeChip, searchQuery]);

  const currentChips = useMemo(() => {
    const cat = categories.find((c) => c.id === activeTab);
    return cat ? cat.chips : [];
  }, [categories, activeTab]);

  const handleSelectModel = (model: Model3DAsset) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedModel(model);
  };

  const handleConfirmSelection = () => {
    if (!selectedModel) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onSelectModel(selectedModel);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View style={[styles.sheetContainer, { height: sheetHeight }]}>
          {/* DRAG HANDLE */}
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragBar} />
          </View>

          {/* HEADER */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.icon3DBadge}>
                <Ionicons name="cube" size={18} color="#38BDF8" />
              </View>
              <View>
                <Text style={styles.headerTitle}>3D Models & Rigs</Text>
                <Text style={styles.headerSubtitle}>
                  {filteredModels.length} rigged 3D models available
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={() => setIsSearchOpen((prev) => !prev)}
              >
                <Ionicons
                  name={isSearchOpen ? 'close' : 'search'}
                  size={18}
                  color="#FFF"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconCircleBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* SEARCH BAR */}
          {isSearchOpen && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search rigged characters, street hustler, veteran..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* CATEGORY TABS */}
          <View style={styles.tabsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScrollContent}
            >
              {categories.map((cat) => {
                const isActive = activeTab === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => {
                      try {
                        Haptics.selectionAsync();
                      } catch {}
                      setActiveTab(cat.id);
                      setActiveChip(null);
                    }}
                  >
                    <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                      {cat.label}
                    </Text>
                    {isActive && <View style={styles.tabIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* FILTER CHIPS */}
          {currentChips.length > 0 && (
            <View style={styles.chipsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScrollContent}
              >
                <TouchableOpacity
                  style={[styles.chipButton, activeChip === null && styles.chipButtonActive]}
                  onPress={() => setActiveChip(null)}
                >
                  <Text style={[styles.chipButtonText, activeChip === null && styles.chipButtonTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>

                {currentChips.map((chip) => {
                  const isChipActive = activeChip === chip;
                  return (
                    <TouchableOpacity
                      key={chip}
                      style={[styles.chipButton, isChipActive && styles.chipButtonActive]}
                      onPress={() => {
                        try {
                          Haptics.selectionAsync();
                        } catch {}
                        setActiveChip(isChipActive ? null : chip);
                      }}
                    >
                      <Text style={[styles.chipButtonText, isChipActive && styles.chipButtonTextActive]}>
                        #{chip.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 3D MODELS GRID */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text style={styles.loadingText}>Loading 3D Rigs...</Text>
            </View>
          ) : (
            <FlatList
              data={[{ isUploadCard: true }, ...filteredModels]}
              keyExtractor={(item: any, index) =>
                item.isUploadCard ? 'upload-3d-card' : item.id || `model-${index}`
              }
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gridContentContainer}
              columnWrapperStyle={styles.gridColumnWrapper}
              renderItem={({ item }: any) => {
                if (item.isUploadCard) {
                  return (
                    <TouchableOpacity
                      style={styles.uploadCard}
                      onPress={handleUploadModel}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color="#38BDF8" />
                      ) : (
                        <View style={styles.uploadIconContainer}>
                          <Ionicons name="cloud-upload-outline" size={28} color="#38BDF8" />
                        </View>
                      )}
                      <Text style={styles.uploadCardTitle}>Upload 3D Asset</Text>
                      <Text style={styles.uploadCardSubtitle}>.GLB Rigged File</Text>
                    </TouchableOpacity>
                  );
                }

                const model = item as Model3DAsset;
                const isSelected = selectedModel?.id === model.id || selectedModel?.url === model.url;
                const thumbSource = LOCAL_THUMBNAILS[model.id]
                  ? LOCAL_THUMBNAILS[model.id]
                  : model.thumbnail_url || model.thumb
                  ? { uri: model.thumbnail_url || model.thumb }
                  : null;

                return (
                  <TouchableOpacity
                    style={[styles.modelCard, isSelected && styles.modelCardSelected]}
                    onPress={() => handleSelectModel(model)}
                    activeOpacity={0.85}
                  >
                    {/* THUMBNAIL / PREVIEW */}
                    <View style={styles.modelThumbContainer}>
                      {thumbSource ? (
                        <Image
                          source={thumbSource}
                          style={styles.modelThumbImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Ionicons name="body" size={48} color="#38BDF8" />
                        </View>
                      )}

                      {/* 3D BADGE */}
                      <View style={styles.formatBadge}>
                        <Text style={styles.formatBadgeText}>3D GLB</Text>
                      </View>

                      {/* RIGGED BADGE */}
                      {model.is_rigged && (
                        <View style={styles.riggedBadge}>
                          <Ionicons name="body" size={10} color="#FFF" style={{ marginRight: 3 }} />
                          <Text style={styles.riggedBadgeText}>
                            {model.bone_count ? `${model.bone_count} Bones` : 'RIGGED'}
                          </Text>
                        </View>
                      )}

                      {/* FILE SIZE */}
                      {model.file_size && (
                        <View style={styles.sizeBadge}>
                          <Text style={styles.sizeBadgeText}>{model.file_size}</Text>
                        </View>
                      )}

                      {/* SELECTED CHECKMARK OVERLAY */}
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <Ionicons name="checkmark-circle" size={24} color="#38BDF8" />
                        </View>
                      )}
                    </View>

                    {/* METADATA */}
                    <View style={styles.modelCardMeta}>
                      <Text style={styles.modelCardTitle} numberOfLines={1}>
                        {model.title || model.name}
                      </Text>
                      <Text style={styles.modelCardCategory} numberOfLines={1}>
                        {model.subcategory ? `🇳🇬 ${model.subcategory}` : model.category}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* BOTTOM ACTION / STICKY CONFIRMATION BAR */}
          {selectedModel && (
            <View style={styles.bottomBar}>
              <View style={styles.bottomBarPreview}>
                <View style={styles.bottomBarThumb}>
                  {LOCAL_THUMBNAILS[selectedModel.id] ? (
                    <Image
                      source={LOCAL_THUMBNAILS[selectedModel.id]}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons name="body" size={24} color="#38BDF8" />
                  )}
                </View>
                <View style={styles.bottomBarTextContainer}>
                  <Text style={styles.bottomBarTitle} numberOfLines={1}>
                    {selectedModel.title || selectedModel.name}
                  </Text>
                  <Text style={styles.bottomBarSubtitle} numberOfLines={1}>
                    {selectedModel.is_rigged
                      ? `Rigged (${selectedModel.bone_count || 100} bones) • Ready for animations`
                      : `3D Model • ${selectedModel.file_size || 'GLB'}`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmSelection}>
                <Ionicons name="cube" size={18} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.confirmButtonText}>Use in Game</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    width: '100%',
    backgroundColor: '#141416',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dragHandleContainer: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon3DBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#1E1E22',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 4,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
  },
  tabButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -5,
    width: 16,
    height: 2,
    backgroundColor: '#38BDF8',
    borderRadius: 1,
  },
  chipsContainer: {
    paddingVertical: 8,
  },
  chipsScrollContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  chipButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipButtonActive: {
    backgroundColor: '#38BDF8',
  },
  chipButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  chipButtonTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  gridContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 110,
  },
  gridColumnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  uploadCard: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.15,
    borderRadius: 18,
    backgroundColor: 'rgba(56,189,248,0.06)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(56,189,248,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  uploadIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(56,189,248,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadCardTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  uploadCardSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  modelCard: {
    width: COLUMN_WIDTH,
    borderRadius: 18,
    backgroundColor: '#1B1B1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  modelCardSelected: {
    borderColor: '#38BDF8',
    borderWidth: 2,
    backgroundColor: 'rgba(56,189,248,0.06)',
  },
  modelThumbContainer: {
    width: '100%',
    height: COLUMN_WIDTH * 1.05,
    backgroundColor: '#0D0D10',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  modelThumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  formatBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  riggedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  riggedBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  sizeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  sizeBadgeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '700',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
  },
  modelCardMeta: {
    padding: 10,
  },
  modelCardTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modelCardCategory: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#161619',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomBarPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bottomBarThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0D0D10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  bottomBarTextContainer: {
    flex: 1,
  },
  bottomBarTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBarSubtitle: {
    color: '#38BDF8',
    fontSize: 11,
    marginTop: 2,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 46,
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
});
