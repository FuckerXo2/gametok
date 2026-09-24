import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { palette, radii, spacing, type as t } from '../../theme/tokens';
import { ai } from '../../services/api';

const CATEGORY_ROWS = [
  ['3D Models', '2D Assets'],
  ['Images', 'Videos', 'Audio'],
];

export interface AssetItem {
  id: string;
  name: string;
  source: ImageSourcePropType;
  category: string;
  tags: string[];
  color?: string;
  uri?: string;
}

const LIBRARY_ASSETS: AssetItem[] = [
  {
    id: 'coral-kingdom',
    name: 'Coral Kingdom',
    source: require('../../../assets/forge/direction_coral.jpg'),
    category: 'Images',
    tags: ['coral', 'ocean', 'underwater', 'reef', 'environment', 'stage'],
  },
  {
    id: 'atlantis',
    name: 'Atlantis Citadel',
    source: require('../../../assets/forge/direction_atlantis.jpg'),
    category: '3D Models',
    tags: ['atlantis', 'temple', 'architecture', 'palace', '3d'],
  },
  {
    id: 'marine',
    name: 'Reef Explorers',
    source: require('../../../assets/forge/direction_marine.jpg'),
    category: 'Videos',
    tags: ['turtle', 'fish', 'creature', 'marine', 'video', 'character'],
  },
  {
    id: 'deep-ocean',
    name: 'Abyssal Portal',
    source: require('../../../assets/forge/direction_ocean.jpg'),
    category: '3D Models',
    tags: ['portal', 'glow', 'abyss', 'magic', '3d', 'particles'],
  },
];

const INITIAL_PERSONAL_ASSETS: AssetItem[] = [
  {
    id: 'starfish',
    name: 'Ruby Starfish',
    source: require('../../../assets/forge/generated/starfish.png'),
    color: '#0F1A2E',
    category: '2D Assets',
    tags: ['starfish', 'collectible', 'item', 'points', 'star'],
  },
  {
    id: 'shell',
    name: 'Pearl Shell',
    source: require('../../../assets/forge/generated/shell.png'),
    color: '#0D1E30',
    category: '2D Assets',
    tags: ['shell', 'pearl', 'collectible', 'score', 'ocean'],
  },
  {
    id: 'coral',
    name: 'Pink Coral',
    source: require('../../../assets/forge/generated/coral.png'),
    color: '#13182C',
    category: '3D Models',
    tags: ['coral', 'nature', 'reef', 'obstacle', '3d'],
  },
  {
    id: 'treasure-chest',
    name: 'Golden Chest',
    source: require('../../../assets/forge/generated/treasure-chest.png'),
    color: '#111D33',
    category: '2D Assets',
    tags: ['chest', 'reward', 'gold', 'loot', 'treasure'],
  },
];

const AI_SUGGESTIONS = [
  '👑 Golden Crown',
  '⚡ Neon Laser Bolt',
  '🪙 Gold Coins',
  '🔮 Magic Orb',
  '🛡️ Energy Shield',
  '💎 Blue Diamond',
];

interface Props {
  onClose: () => void;
  onApplyAssets?: (assets: AssetItem[]) => void;
  onGenerate?: () => void;
  onUpload?: () => void;
}

export const AddToGameScreen: React.FC<Props> = ({
  onClose,
  onApplyAssets,
  onGenerate,
  onUpload,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [personalAssets, setPersonalAssets] = useState<AssetItem[]>(INITIAL_PERSONAL_ASSETS);
  const [expandedLibrary, setExpandedLibrary] = useState(false);
  const [expandedPersonal, setExpandedPersonal] = useState(false);

  // AI Generation Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter helper
  const filterAssets = (items: AssetItem[]) => {
    return items.filter((asset) => {
      // Category filter
      if (selectedCategory) {
        if (selectedCategory === '2D Assets') {
          if (asset.category !== '2D Assets' && asset.category !== '2D Sprites') {
            return false;
          }
        } else if (asset.category !== selectedCategory) {
          return false;
        }
      }
      // Query search filter
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesCat = asset.category.toLowerCase().includes(q);
        const matchesTag = asset.tags.some((t) => t.toLowerCase().includes(q));
        return matchesName || matchesCat || matchesTag;
      }
      return true;
    });
  };

  const filteredLibrary = filterAssets(LIBRARY_ASSETS);
  const filteredPersonal = filterAssets(personalAssets);

  // Launch native photo library picker
  const handleNativeUpload = async () => {
    if (onUpload) {
      onUpload();
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const picked = result.assets[0];
        const newAsset: AssetItem = {
          id: `upload-${Date.now()}`,
          name: picked.fileName || 'Uploaded Sprite',
          source: { uri: picked.uri },
          category: 'Images',
          tags: ['upload', 'sprite', 'custom', 'user'],
          color: '#121F2D',
          uri: picked.uri,
        };
        setPersonalAssets((prev) => [newAsset, ...prev]);
        if (onApplyAssets) {
          onApplyAssets([newAsset]);
        }
        onClose();
      }
    } catch (err: any) {
      Alert.alert('Upload Error', 'Could not open photo library.');
    }
  };

  // AI Asset Generation trigger
  const handleAIGenerate = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    setIsGenerating(true);

    try {
      const res = await ai.generateAsset(prompt);
      const imageUrl = (res as any)?.imageUrl || (res as any)?.base64;
      const cleanName = prompt.length > 22 ? prompt.slice(0, 20) + '...' : prompt;

      const newAsset: AssetItem = {
        id: `ai-${Date.now()}`,
        name: cleanName,
        source: imageUrl
          ? { uri: imageUrl }
          : require('../../../assets/forge/generated/starfish.png'),
        category: '2D Assets',
        tags: ['ai', 'generated', ...prompt.toLowerCase().split(' ')],
        color: '#1B1430',
        uri: imageUrl,
      };

      setPersonalAssets((prev) => [newAsset, ...prev]);
      setIsAiModalOpen(false);
      setAiPrompt('');
      if (onApplyAssets) {
        onApplyAssets([newAsset]);
      }
      onClose();
    } catch (e: any) {
      // Fallback local generated asset
      const cleanName = prompt.length > 22 ? prompt.slice(0, 20) + '...' : prompt;
      const newAsset: AssetItem = {
        id: `ai-${Date.now()}`,
        name: cleanName,
        source: require('../../../assets/forge/generated/treasure-chest.png'),
        category: '2D Assets',
        tags: ['ai', 'generated', ...prompt.toLowerCase().split(' ')],
        color: '#1B1430',
      };
      setPersonalAssets((prev) => [newAsset, ...prev]);
      setIsAiModalOpen(false);
      setAiPrompt('');
      if (onApplyAssets) {
        onApplyAssets([newAsset]);
      }
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAssetPress = (asset: AssetItem) => {
    if (selectedAsset?.id === asset.id) {
      if (onApplyAssets) {
        onApplyAssets([asset]);
      }
      onClose();
    } else {
      setSelectedAsset(asset);
    }
  };

  const swipeToClose = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 14 && Math.abs(gesture.dx) < 20,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80) onClose();
      },
    }),
  ).current;

  return (
    <LinearGradient colors={['#00040B', '#020A15', '#00040A']} style={styles.root}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.safeArea}>
        {/* Top Header: Back Button in Top Left */}
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Top Space: Live Asset Preview */}
        <View style={styles.topPreviewArea}>
          {selectedAsset ? (
            <View style={styles.previewCard}>
              <Pressable
                onPress={() => setSelectedAsset(null)}
                style={styles.previewCloseBtn}
                hitSlop={10}
              >
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
              </Pressable>

              <View
                style={[
                  styles.previewImageContainer,
                  selectedAsset.color ? { backgroundColor: selectedAsset.color } : undefined,
                ]}
              >
                <Image
                  source={selectedAsset.source}
                  style={styles.previewImage}
                  resizeMode={
                    selectedAsset.color ||
                    selectedAsset.category === '2D Sprites' ||
                    selectedAsset.category === 'UI'
                      ? 'contain'
                      : 'cover'
                  }
                />
              </View>

              <View style={styles.previewFooterRow}>
                <View style={styles.previewMeta}>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {selectedAsset.name}
                  </Text>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>{selectedAsset.category}</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    if (onApplyAssets) {
                      onApplyAssets([selectedAsset]);
                    }
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.previewAddBtn,
                    pressed && styles.previewAddBtnPressed,
                  ]}
                >
                  <LinearGradient
                    colors={['#A855F7', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.previewAddGradient}
                  >
                    <Ionicons name="add" size={17} color="#FFFFFF" />
                    <Text style={styles.previewAddText}>Add to Game</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.panel} {...swipeToClose.panHandlers}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add to your game</Text>
          </View>

          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={19} color={palette.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search assets, or describe what you need..."
                  placeholderTextColor={palette.textDim}
                  style={styles.searchInput}
                  clearButtonMode="while-editing"
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                )}
              </View>

              {/* Category Filter Pills */}
              <View style={styles.categoryGrid}>
                {CATEGORY_ROWS.map((row, rIdx) => (
                  <View key={rIdx} style={styles.categoryRow}>
                    {row.map((category) => {
                      const isSelected = selectedCategory === category;
                      return (
                        <Pressable
                          key={category}
                          onPress={() =>
                            setSelectedCategory((curr) => (curr === category ? null : category))
                          }
                          style={[
                            styles.categoryButton,
                            isSelected && styles.categoryButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.categoryText,
                              isSelected && styles.categoryTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {category}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Section 1: GameTok Library */}
              <SectionHeading
                title="GameTok Library"
                action={expandedLibrary ? 'Show less' : 'See all'}
                onActionPress={() => setExpandedLibrary((prev) => !prev)}
              />
              <View style={[styles.assetRow, expandedLibrary && styles.assetGridExpanded]}>
                {filteredLibrary.length > 0 ? (
                  (expandedLibrary ? filteredLibrary : filteredLibrary.slice(0, 4)).map((asset) => {
                    const isSelected = selectedAsset?.id === asset.id;
                    return (
                      <Pressable
                        key={asset.id}
                        onPress={() => handleAssetPress(asset)}
                        style={({ pressed }) => [
                          styles.assetCard,
                          expandedLibrary && styles.assetCardExpanded,
                          isSelected && styles.assetCardSelected,
                          pressed && styles.assetCardPressed,
                        ]}
                      >
                        <Image source={asset.source} style={styles.assetImage} resizeMode="cover" />
                        {isSelected && (
                          <View style={styles.cardCheckmark}>
                            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.emptyNotice}>No library assets match your filter</Text>
                )}
              </View>

              {/* Section 2: Your Assets */}
              <SectionHeading
                title="Your Assets"
                action={expandedPersonal ? 'Show less' : 'See all'}
                onActionPress={() => setExpandedPersonal((prev) => !prev)}
              />
              <View style={[styles.assetRow, expandedPersonal && styles.assetGridExpanded]}>
                {filteredPersonal.length > 0 ? (
                  (expandedPersonal ? filteredPersonal : filteredPersonal.slice(0, 4)).map((asset) => {
                    const isSelected = selectedAsset?.id === asset.id;
                    return (
                      <Pressable
                        key={asset.id}
                        onPress={() => handleAssetPress(asset)}
                        style={({ pressed }) => [
                          styles.assetCard,
                          { backgroundColor: asset.color || '#111D33' },
                          expandedPersonal && styles.assetCardExpanded,
                          isSelected && styles.assetCardSelected,
                          pressed && styles.assetCardPressed,
                        ]}
                      >
                        <Image
                          source={asset.source}
                          style={styles.personalAssetImage}
                          resizeMode="contain"
                        />
                        {isSelected && (
                          <View style={styles.cardCheckmark}>
                            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.emptyNotice}>No assets found. Generate one with AI below!</Text>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.footer}>
            {/* Generate with AI */}
            <Pressable
              onPress={() => {
                if (onGenerate) {
                  onGenerate();
                } else {
                  setIsAiModalOpen(true);
                }
              }}
              style={({ pressed }) => [styles.footerButton, pressed && styles.footerButtonPressed]}
            >
              <Ionicons name="sparkles" size={19} color={palette.purpleSoft} />
              <Text style={styles.footerButtonText}>Generate with AI</Text>
            </Pressable>

            {/* Upload */}
            <Pressable
              onPress={handleNativeUpload}
              style={({ pressed }) => [styles.footerButton, pressed && styles.footerButtonPressed]}
            >
              <Ionicons name="share-outline" size={19} color={palette.text} />
              <Text style={styles.footerButtonText}>Upload</Text>
            </Pressable>
          </View>
        </View>

        {/* AI Generation Modal Sheet */}
        <Modal
          visible={isAiModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIsAiModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.aiModalOverlay}
          >
            <View style={styles.aiModalSheet}>
              {/* Sheet Header */}
              <View style={styles.aiModalHeader}>
                <View style={styles.aiModalTitleRow}>
                  <Ionicons name="sparkles" size={20} color={palette.purpleSoft} />
                  <Text style={styles.aiModalTitle}>Generate with AI</Text>
                </View>
                <Pressable onPress={() => setIsAiModalOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
                </Pressable>
              </View>

              <Text style={styles.aiModalSubtitle}>
                Describe the sprite, item, or effect you want to add:
              </Text>

              {/* Text Input */}
              <TextInput
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder="e.g. golden mermaid crown, electric fireball..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.aiInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAIGenerate}
              />

              {/* Quick Suggestion Chips */}
              <View style={styles.suggestionChips}>
                {AI_SUGGESTIONS.map((sug) => (
                  <Pressable
                    key={sug}
                    onPress={() => setAiPrompt(sug.replace(/^[^\s]+\s/, ''))}
                    style={styles.sugChip}
                  >
                    <Text style={styles.sugText}>{sug}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Generate Action Button */}
              <Pressable
                onPress={handleAIGenerate}
                disabled={isGenerating || !aiPrompt.trim()}
                style={({ pressed }) => [
                  styles.aiSubmitBtn,
                  (!aiPrompt.trim() || isGenerating) && styles.aiSubmitBtnDisabled,
                  pressed && styles.aiSubmitBtnPressed,
                ]}
              >
                <LinearGradient
                  colors={['#9333EA', '#6B21A8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aiSubmitGradient}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={17} color="#FFFFFF" />
                      <Text style={styles.aiSubmitText}>Create Asset</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </LinearGradient>
  );
};

const SectionHeading = ({
  title,
  action,
  onActionPress,
}: {
  title: string;
  action?: string;
  onActionPress?: () => void;
}) => (
  <View style={styles.sectionHeading}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action ? (
      <Pressable onPress={onActionPress} style={styles.seeAllButton} hitSlop={8}>
        <Text style={styles.seeAllText}>{action}</Text>
        <Ionicons name="chevron-forward" size={15} color={palette.text} />
      </Pressable>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Top Navigation Bar
  topBar: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    transform: [{ scale: 0.95 }],
  },
  // Top Showcase Preview
  topPreviewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  previewCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 16, 30, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    padding: 14,
    alignItems: 'center',
    shadowColor: '#9333EA',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    position: 'relative',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  previewImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFooterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewMeta: {
    flex: 1,
  },
  previewName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: t.family.bold,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  previewBadgeText: {
    color: '#E9D5FF',
    fontSize: 11,
    fontFamily: t.family.bold,
  },
  previewAddBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#9333EA',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  previewAddBtnPressed: {
    transform: [{ scale: 0.97 }],
  },
  previewAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  previewAddText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: t.family.bold,
  },
  // Bottom Panel (Tightened)
  panel: {
    backgroundColor: 'rgba(5, 11, 23, 0.97)',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxHeight: '80%',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: palette.text,
    fontSize: 20,
    fontFamily: t.family.bold,
    letterSpacing: -0.3,
  },
  contentScroll: {
    maxHeight: 460,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: palette.text,
    fontSize: 13.5,
    fontFamily: t.family.medium,
  },
  categoryGrid: {
    gap: 6,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryButton: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  categoryButtonSelected: {
    backgroundColor: 'rgba(147, 51, 234, 0.25)',
    borderColor: '#A855F7',
    borderWidth: 1.2,
  },
  categoryText: {
    color: palette.text,
    fontSize: 12,
    fontFamily: t.family.bold,
  },
  categoryTextSelected: {
    color: '#F3E8FF',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 2,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 14.5,
    fontFamily: t.family.bold,
    letterSpacing: -0.2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    color: palette.text,
    fontSize: 12.5,
    fontFamily: t.family.semibold,
  },
  assetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  assetGridExpanded: {
    flexWrap: 'wrap',
  },
  assetCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#0E172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  assetCardExpanded: {
    flexGrow: 0,
    flexBasis: '23%',
    marginBottom: 8,
  },
  assetCardSelected: {
    borderColor: '#C084FC',
    borderWidth: 2,
    shadowColor: '#A855F7',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  assetCardPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  cardCheckmark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#9333EA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
  },
  assetImage: {
    width: '100%',
    height: '100%',
  },
  personalAssetImage: {
    width: '78%',
    height: '78%',
  },
  emptyNotice: {
    color: palette.textDim,
    fontSize: 12.5,
    fontFamily: t.family.regular,
    paddingVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerButton: {
    flex: 1,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  footerButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ scale: 0.985 }],
  },
  footerButtonText: {
    color: palette.text,
    fontSize: 13.5,
    fontFamily: t.family.bold,
  },
  // AI Modal Styles
  aiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  aiModalSheet: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  aiModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  aiModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  aiModalSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13.5,
    marginBottom: 14,
  },
  aiInput: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 14,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  sugChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  sugText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12.5,
    fontWeight: '600',
  },
  aiSubmitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  aiSubmitBtnDisabled: {
    opacity: 0.5,
  },
  aiSubmitBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  aiSubmitGradient: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aiSubmitText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
});
