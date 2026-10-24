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
import { WebView } from 'react-native-webview';
import { videosApi, BackgroundVideo, VideoCategory } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 44) / 2;

interface VideoPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectVideo: (video: BackgroundVideo) => void;
  selectedVideoUrl?: string | null;
  userId?: string | null;
}

const DEFAULT_VIDEO_CATEGORIES: VideoCategory[] = [
  { id: 'my_videos', label: 'My Videos', chips: [] },
  { id: 'trending', label: 'Trending', chips: [] },
  { id: 'brainrot', label: 'Brainrot', chips: ['italian', 'tung_tung', 'brr_brr', 'tralalero', 'skibidi', 'sigma', 'ohio', 'mewing'] },
  { id: 'parkour', label: 'Parkour', chips: ['subway_surfers', 'minecraft', 'roblox', 'speedrun', 'stunt', 'loop'] },
  { id: 'memes', label: 'Memes', chips: ['cursed', 'npc', 'viral', 'funny', 'compilation'] },
  { id: 'synthwave', label: 'Synthwave', chips: ['neon', 'grid', 'retro', '80s', 'outrun', 'horizon'] },
  { id: 'space', label: 'Space', chips: ['warp', 'stars', 'galaxy', 'nebula', 'hyperspace', 'orbit'] },
  { id: 'cyberpunk', label: 'Cyberpunk', chips: ['rain', 'city', 'matrix', 'tunnel', 'hologram', 'speed'] },
  { id: 'particles', label: 'Particles', chips: ['dust', 'sparks', 'fire', 'light', 'magic', 'energy'] },
  { id: 'atmosphere', label: 'Atmosphere', chips: ['fog', 'dungeon', 'underwater', 'torches', 'clouds', 'dark'] },
  { id: 'nature', label: 'Nature', chips: ['forest', 'waterfall', 'mountains', 'night', 'ocean', 'sunset'] },
  { id: 'abstract', label: 'Abstract', chips: ['fluid', 'gradient', 'waves', 'geometric', 'minimal', 'vj'] },
];

const sortVideoCategories = (rawCats: VideoCategory[]): VideoCategory[] => {
  const priority = ['my_videos', 'trending', 'brainrot', 'parkour', 'memes'];
  return [...rawCats].sort((a, b) => {
    const idxA = priority.indexOf(a.id);
    const idxB = priority.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });
};

export const VideoPickerSheet: React.FC<VideoPickerSheetProps> = ({
  visible,
  onClose,
  onSelectVideo,
  selectedVideoUrl = null,
  userId = null,
}) => {
  const [categories, setCategories] = useState<VideoCategory[]>(DEFAULT_VIDEO_CATEGORIES);
  const [activeTab, setActiveTab] = useState<string>('trending');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [videos, setVideos] = useState<BackgroundVideo[]>([]);
  const [myVideos, setMyVideos] = useState<BackgroundVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<BackgroundVideo | null>(null);
  const [previewVideo, setPreviewVideo] = useState<BackgroundVideo | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Height and drag expansion
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

  // Load categories
  useEffect(() => {
    if (!visible) return;
    videosApi
      .getCategories()
      .then((cats) => {
        if (cats && cats.length > 0) setCategories(sortVideoCategories(cats));
      })
      .catch((err) => {
        console.warn('[VideoPicker] Failed to load categories:', err);
      });
  }, [visible]);

  // Load videos
  const loadVideos = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    try {
      if (activeTab === 'my_videos') {
        const res = await videosApi.getVideos({
          category: 'my_videos',
          creator_id: userId || undefined,
          search: searchQuery.trim() || undefined,
          limit: 40,
        });
        setMyVideos(res.videos || []);
      } else {
        const res = await videosApi.getVideos({
          category: activeTab,
          tag: activeChip || undefined,
          search: searchQuery.trim() || undefined,
          limit: 40,
        });
        setVideos(res.videos || []);
      }
    } catch (e) {
      console.warn('[VideoPicker] Error loading videos:', e);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [visible, activeTab, activeChip, searchQuery, userId]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Active Category Chips
  const currentCategoryObj = useMemo(() => {
    return categories.find((c) => c.id === activeTab);
  }, [categories, activeTab]);

  const currentChips = useMemo(() => {
    return currentCategoryObj?.chips || [];
  }, [currentCategoryObj]);

  // Handle Tab Change
  const handleTabChange = (tabId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActiveTab(tabId);
    setActiveChip(null);
  };

  // Handle Chip Toggle
  const handleChipToggle = (chip: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setActiveChip((prev) => (prev === chip ? null : chip));
  };

  // Handle Card Click - Select & Open Live Preview
  const handleSelectCard = (video: BackgroundVideo) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    if (selectedVideo?.id === video.id) {
      // Open preview modal if already selected
      setPreviewVideo(video);
    } else {
      setSelectedVideo(video);
    }
  };

  // Handle Confirm Selection
  const handleConfirmUse = (videoToUse?: BackgroundVideo) => {
    const target = videoToUse || selectedVideo;
    if (!target) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    videosApi.recordUse(target.id).catch(() => {});
    onSelectVideo(target);
    onClose();
  };

  // Upload Local Video (Camera Roll / Files)
  const handleUploadVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please enable media access to upload videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 20,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setIsUploading(true);
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: asset.fileName || 'custom-loop.mp4',
          type: 'video/mp4',
        } as any);
        formData.append('category', 'abstract');
        if (userId) formData.append('creator_id', userId);

        const res = await videosApi.uploadVideo(formData);
        if (res.success && res.video) {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}
          setMyVideos((prev) => [res.video, ...prev]);
          setSelectedVideo(res.video);
        } else {
          Alert.alert('Upload Failed', res.error || 'Could not upload video.');
        }
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to select video.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatUses = (count: number) => {
    if (!count) return '10 used';
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K used`;
    }
    return `${count} used`;
  };

  const currentList = activeTab === 'my_videos' ? myVideos : videos;

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

          {/* Header Row: Title + Search Toggle + Close */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Video Backgrounds</Text>
              <Text style={styles.headerSub}>Looping 60fps vistas for game stages & backdrops</Text>
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
                placeholder="Search neon, space, warp, cyberpunk, rain, matrix..."
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

          {/* Sub-Filter Chips Row */}
          {currentChips.length > 0 && activeTab !== 'my_videos' && (
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
                        #{chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* My Videos Action Pill */}
          {activeTab === 'my_videos' && (
            <View style={styles.myVideosActionsRow}>
              <TouchableOpacity
                style={styles.actionPillBtn}
                onPress={handleUploadVideo}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#C084FC" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color="#C084FC" />
                )}
                <Text style={styles.actionPillText}>
                  {isUploading ? 'Uploading Video...' : 'Upload Video Loop (Max 15s)'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Video Grid Content */}
          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#A855F7" />
              <Text style={styles.loaderText}>Loading background loops...</Text>
            </View>
          ) : currentList.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons
                name={activeTab === 'my_videos' ? 'film-outline' : 'search-outline'}
                size={44}
                color="#475569"
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'my_videos' ? 'No video loops uploaded yet' : 'No background loops found'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'my_videos'
                  ? 'Upload your own MP4 looping video background from your device.'
                  : 'Try selecting another genre or clearing the search filter.'}
              </Text>
            </View>
          ) : (
            <FlatList
              key={`videos-grid-${activeTab}-2cols`}
              data={currentList}
              keyExtractor={(item) => item.id}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gridContent}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => {
                const isSelected = selectedVideo?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.videoCard, isSelected && styles.videoCardSelected]}
                    onPress={() => handleSelectCard(item)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.videoCoverContainer}>
                      <Image source={{ uri: item.thumbnail_url }} style={styles.videoThumbImage} resizeMode="cover" />

                      {/* Duration Badge */}
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{item.duration || '00:15'}</Text>
                      </View>

                      {/* Quick Preview Icon */}
                      <TouchableOpacity
                        style={styles.previewIconBtn}
                        onPress={() => setPreviewVideo(item)}
                        hitSlop={8}
                      >
                        <Ionicons name="play" size={12} color="#FFFFFF" />
                      </TouchableOpacity>

                      {/* Selection Check Circle */}
                      <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={12} color="#FFF" />}
                      </View>
                    </View>

                    <View style={styles.videoInfo}>
                      <Text style={styles.videoTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.videoSubRow}>
                        <Text style={styles.videoCategoryText}>{item.category}</Text>
                        <Text style={styles.videoUsesText}>{formatUses(item.uses_count)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Bottom Confirmation Bar */}
          {selectedVideo && (
            <View style={styles.bottomBar}>
              <View style={styles.bottomBarLeft}>
                <Image source={{ uri: selectedVideo.thumbnail_url }} style={styles.bottomThumb} resizeMode="cover" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.bottomTitle} numberOfLines={1}>
                    {selectedVideo.title}
                  </Text>
                  <Text style={styles.bottomSub}>Looping Game Background</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.previewBtn}
                onPress={() => setPreviewVideo(selectedVideo)}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={15} color="#C084FC" />
                <Text style={styles.previewBtnText}>Preview</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.useButton}
                onPress={() => handleConfirmUse(selectedVideo)}
                activeOpacity={0.85}
              >
                <Text style={styles.useButtonText}>Use</Text>
                <Ionicons name="arrow-forward" size={15} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Full Screen Live Looping Preview Modal */}
          {previewVideo && (
            <Modal
              visible={true}
              animationType="fade"
              transparent
              onRequestClose={() => setPreviewVideo(null)}
            >
              <View style={styles.previewModalBackdrop}>
                <View style={styles.previewModalContainer}>
                  {/* Preview Header */}
                  <View style={styles.previewModalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewModalTitle} numberOfLines={1}>
                        {previewVideo.title}
                      </Text>
                      <Text style={styles.previewModalSub}>
                        {previewVideo.category} • Video Preview
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.previewCloseCircle}
                      onPress={() => setPreviewVideo(null)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={20} color="#E2E8F0" />
                    </TouchableOpacity>
                  </View>

                  {/* Video Player Box with Crash-Proof Hardware-Accelerated WebView */}
                  <View style={styles.playerWrapper}>
                    <WebView
                      source={{
                        html: `
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                            <style>
                              * { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
                              body, html { width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                              video { width: 100%; height: 100%; object-fit: contain; }
                            </style>
                          </head>
                          <body>
                            <video src="${previewVideo.video_url}" autoplay loop muted playsinline webkit-playsinline></video>
                          </body>
                          </html>
                        `,
                      }}
                      style={styles.videoPlayer}
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction={false}
                      scrollEnabled={false}
                    />
                  </View>

                  {/* Preview Modal Actions */}
                  <View style={styles.previewModalActions}>
                    <TouchableOpacity
                      style={styles.previewCancelBtn}
                      onPress={() => setPreviewVideo(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.previewCancelText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.previewSelectBtn}
                      onPress={() => {
                        const target = previewVideo;
                        setPreviewVideo(null);
                        handleConfirmUse(target);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.previewSelectText}>Use Background</Text>
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
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
    paddingTop: 8,
    paddingBottom: 10,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    color: '#FFF',
    fontSize: 13,
  },
  categoryBarWrap: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryTabsContent: {
    paddingHorizontal: 16,
    gap: 18,
  },
  categoryTab: {
    paddingVertical: 10,
    position: 'relative',
  },
  categoryTabActive: {},
  categoryTabText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 14,
    fontWeight: '600',
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
    borderRadius: 1.5,
    backgroundColor: '#C084FC',
  },
  chipsBarWrap: {
    paddingVertical: 10,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chipPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  chipPillActive: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderColor: '#C084FC',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#C084FC',
    fontWeight: '800',
  },
  myVideosActionsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
  actionPillText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 110,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  videoCard: {
    width: COLUMN_WIDTH,
    backgroundColor: '#181824',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  videoCardSelected: {
    borderColor: '#C084FC',
    borderWidth: 2,
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
  },
  videoCoverContainer: {
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  videoThumbImage: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  previewIconBtn: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: '#9333EA',
    borderColor: '#C084FC',
  },
  videoInfo: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  videoSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoCategoryText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  videoUsesText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
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
    backgroundColor: 'rgba(15, 15, 20, 0.96)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 10,
  },
  bottomBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomThumb: {
    width: 44,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  bottomTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSub: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  previewBtnText: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#9333EA',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  useButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  previewModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  previewModalContainer: {
    width: '100%',
    backgroundColor: '#181824',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  previewModalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  previewModalSub: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  previewCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 16,
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  previewModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  previewCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCancelText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    fontWeight: '700',
  },
  previewSelectBtn: {
    flex: 2,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9333EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  previewSelectText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
