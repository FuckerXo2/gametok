const fs = require('fs');
const filepath = '/Users/abiolalimitless/gameidea/gametok/src/screens/CreateScreen.tsx';
let code = fs.readFileSync(filepath, 'utf8');

// ============================================================
// 1. IMPORTS - Add Alert, Modal, ImagePicker, DocumentPicker, API exports
// ============================================================
code = code.replace(
  `  Image,
} from 'react-native';`,
  `  Image,
  Alert,
  Modal,
} from 'react-native';`
);

code = code.replace(
  "import { ai } from '../services/api';",
  `import { ai, API_URL, getToken } from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';`
);

// ============================================================
// 2. STATE VARIABLES - Add after existing state block
// ============================================================
code = code.replace(
  `  // Studio tab state
  const [studioTab, setStudioTab] = useState<StudioTab>('create');`,
  `  // Modal & UGC state
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imagePromptText, setImagePromptText] = useState('');
  const [showColorsModal, setShowColorsModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showSoundsModal, setShowSoundsModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [showVideosModal, setShowVideosModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioTab, setAudioTab] = useState<'bgm' | 'sfx'>('bgm');
  const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>({});
  const [communityVideos, setCommunityVideos] = useState<any[]>([]);
  const [communityAudios, setCommunityAudios] = useState<any[]>([]);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);

  // Studio tab state
  const [studioTab, setStudioTab] = useState<StudioTab>('create');`
);

// ============================================================
// 3. CONSTANTS - Add OPTIONS arrays before handleCancel
// ============================================================
const CONSTANTS_BLOCK = `
  // === TOOL OPTIONS ===
  const COLOR_PALETTES = [
    { name: 'Neon', bg: '#000', colors: ['#FF00FF', '#00FFFF', '#39FF14'], instruction: 'Change the entire color scheme to vibrant neon: magenta, cyan, neon green. Use black backgrounds with glow effects.' },
    { name: 'Sunset', bg: '#2A1B38', colors: ['#FF6B6B', '#FF8E53', '#FFD93D'], instruction: 'Change the entire color scheme to warm sunset tones: coral reds, burnt orange, golden yellow.' },
    { name: 'Ocean', bg: '#0F2027', colors: ['#0077B6', '#00B4D8', '#CAF0F8'], instruction: 'Change the color scheme to ocean tones: deep blue, cyan, ice white.' },
    { name: 'Pastel', bg: '#FDFBF7', colors: ['#FFB5E8', '#B5DEFF', '#BAFFC9'], instruction: 'Change the color scheme to soft pastels: pink, baby blue, mint green.' },
    { name: 'Dark Mode', bg: '#0D0D10', colors: ['#E94560', '#A855F7', '#3B82F6'], instruction: 'Change the color scheme to sleek dark mode with neon accents.' },
    { name: 'Retro 80s', bg: '#10002b', colors: ['#F72585', '#7209B7', '#4CC9F0'], instruction: 'Change the color scheme to synthwave retro: hot pink, deep purple, electric blue.' },
  ];

  const OPTIONS_SOUNDS = [
    { label: 'Add Full Sound Effects', icon: 'musical-notes', desc: 'Jumps, scores, collisions, and game over', instruction: 'Add rich sound effects throughout the game. Use window.playSound("jump") for jumps/taps, window.playSound("coin") for scoring, window.playSound("hit") for collisions, and window.playSound("gameover") for game over.' },
    { label: 'Mute Entire Game', icon: 'volume-mute', desc: 'Remove all audio completely', instruction: 'Remove all calls to window.playSound() from the entire game. Make it completely silent.' },
  ];

  const OPTIONS_BGM = [
    { label: 'BGM-gameplay-military-tense', duration: '01:25', url: 'https://cdn.freesound.org/previews/495/495537_495537-lq.mp3' },
    { label: 'BGM-menu-scifi-mysterious', duration: '01:41', url: 'https://cdn.freesound.org/previews/454/454593_454593-lq.mp3' },
    { label: 'BGM-gameplay-modern-exciting', duration: '01:36', url: 'https://cdn.freesound.org/previews/588/588496_588496-lq.mp3' },
    { label: 'BGM-retro-8bit-arcade', duration: '01:53', url: 'https://cdn.freesound.org/previews/251/251461_251461-lq.mp3' },
  ];

  const OPTIONS_VIDEOS = [
    { label: 'Hyperspace', thumb: 'https://picsum.photos/seed/hyper/200/300', url: 'https://cdn.pixabay.com/video/2020/09/20/50531-460875411_tiny.mp4' },
    { label: 'Neon Grid', thumb: 'https://picsum.photos/seed/neon/200/300', url: 'https://cdn.pixabay.com/video/2021/04/16/71239-537446549_tiny.mp4' },
    { label: 'Cloud Flight', thumb: 'https://picsum.photos/seed/cloud/200/300', url: 'https://cdn.pixabay.com/video/2021/08/04/83896-584742491_tiny.mp4' },
    { label: 'Pixel Snow', thumb: 'https://picsum.photos/seed/pixel/200/300', url: 'https://cdn.pixabay.com/video/2019/12/17/30419-380962372_tiny.mp4' },
  ];

  const OPTIONS_FEATURES = [
    { id: 'cam', icon: 'videocam', label: 'Live Camera', desc: 'Streams camera feed as game background.', instruction: 'Add HTML5 camera feed using navigator.mediaDevices.getUserMedia and render it as the game canvas background.' },
    { id: 'mic', icon: 'mic', label: 'Microphone Audio Input', desc: 'Captures mic for voice-driven gameplay.', instruction: 'Use navigator.mediaDevices.getUserMedia for the microphone, extract the volume/frequency, and use it for a core game mechanic.' },
    { id: 'gyro', icon: 'compass', label: 'Tilt / Gyroscope Control', desc: 'Uses phone gyroscope for movement.', instruction: 'Capture deviceorientation events and bind alpha/beta/gamma to player movement instead of touch.' },
    { id: 'haptic', icon: 'radio', label: 'Haptic Feedback', desc: 'Triggers vibrations on key events.', instruction: 'Add navigator.vibrate() calls: short on jump, medium on score, long burst on collision or game over.' },
  ];

  const MODIFY_OPTIONS = [
    { label: 'Add 3 Levels', icon: 'layers', instruction: 'Add 3 progressively harder levels to this game. Each level should increase difficulty.' },
    { label: 'Make it Harder', icon: 'trending-up', instruction: 'Increase the overall difficulty: faster speeds, tighter timing, more obstacles.' },
    { label: 'Make it Easier', icon: 'trending-down', instruction: 'Decrease difficulty: slower speeds, more forgiving timing, fewer obstacles.' },
    { label: 'Add Power-ups', icon: 'flash', instruction: 'Add 3 collectible power-ups: shield, speed boost, and double points.' },
    { label: 'Add Animations', icon: 'sparkles', instruction: 'Add smooth animations: screen shake on collision, particle effects on score, bouncy transitions.' },
  ];

  // === UGC HANDLERS ===
  const fetchCommunityAssets = async (type: string) => {
    try {
      const res = await fetch(\`\${API_URL}/assets/trending?type=\${type}\`);
      const data = await res.json();
      if (data.success && data.assets) {
        if (type === 'video') setCommunityVideos(data.assets);
        else if (type === 'bgm' || type === 'sfx') setCommunityAudios(data.assets);
      }
    } catch(err) { console.log(err); }
  };

  useEffect(() => {
    if (showVideosModal) fetchCommunityAssets('video');
  }, [showVideosModal]);

  useEffect(() => {
    if (showAudioModal) fetchCommunityAssets(audioTab);
  }, [showAudioModal, audioTab]);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const handleAssetUpload = async (type: 'video' | 'bgm' | 'sfx' | 'image') => {
    try {
      let result: any;
      if (type === 'video' || type === 'image') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      }
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      setIsUploadingAsset(true);
      const asset = result.assets[0];
      const formData = new FormData();
      const fileUri = asset.uri;
      const fileName = fileUri.split('/').pop() || 'upload.mp4';
      formData.append('file', { uri: fileUri, name: fileName, type: 'multipart/form-data' } as any);
      formData.append('type', type);
      formData.append('title', 'Community Upload');
      const token = await getToken();
      const uploadRes = await fetch(\`\${API_URL}/assets/upload\`, {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${token}\` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      setIsUploadingAsset(false);
      if (uploadData.success) {
        if (type === 'video') {
          setShowVideosModal(false);
          handleEdit(\`Add a full-screen looping background video: \${uploadData.url}\`);
        } else if (type === 'bgm' || type === 'sfx') {
          setShowAudioModal(false);
          handleEdit(\`Inject this audio URL into the game: \${uploadData.url}\`);
        }
      } else {
        Alert.alert('Upload Failed', uploadData.error || 'Failed');
      }
    } catch (e) {
      console.log(e);
      setIsUploadingAsset(false);
      Alert.alert('Error', 'Asset upload failed');
    }
  };

  const handleModify = () => setShowModifyModal(true);
  const handleGeneratePhoto = () => setShowImageModal(true);
  const handleSounds = () => setShowSoundsModal(true);
  const submitImageGeneration = async () => {
    if (!imagePromptText.trim()) return;
    setIsGeneratingImage(true);
    try {
      const result = await ai.generateAsset(imagePromptText);
      if (result && (result as any).imageUrl) {
        setGeneratedImageUri((result as any).imageUrl);
      }
    } catch (e) {
      Alert.alert('Error', 'Image generation failed');
    }
    setIsGeneratingImage(false);
  };

`;

code = code.replace(
  `  const handleCancel = () => {`,
  CONSTANTS_BLOCK + `  const handleCancel = () => {`
);

// ============================================================
// 4. REPLACE PREVIEW RETURN BLOCK - Full tool strip + modals
// ============================================================
const NEW_PREVIEW = `  if (phase === 'preview' && activeHtml) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={[styles.screen, { paddingTop: insets.top }]}
      >
        {/* === TOP BAR === */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.previewTopBar}>
          <Pressable style={styles.closeBtn} onPress={handleRegenerate}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
            {gameTitle || 'Preview'}
          </Text>
          <Pressable 
            style={[styles.previewPublishPill, { backgroundColor: colors.primary }]} 
            onPress={handlePublish}
          >
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>Publish</Text>
          </Pressable>
        </Animated.View>

        {/* === GAME WEBVIEW === */}
        <View style={styles.webviewContainer}>
          <WebView
            source={{ html: activeHtml, baseUrl: 'https://gametok.app' }}
            style={{ flex: 1, backgroundColor: '#000' }}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            bounces={false}
            scrollEnabled={false}
            allowsInlineMediaPlayback={true}
            mixedContentMode="always"
            allowUniversalAccessFromFileURLs={true}
            allowFileAccessFromFileURLs={true}
            onError={(e) => console.log('WebView Error:', e.nativeEvent)}
            onHttpError={(e) => console.log('WebView HTTP Error:', e.nativeEvent)}
          />
          {keyboardVisible && (
            <Pressable style={[StyleSheet.absoluteFill, { zIndex: 999 }]} onPress={() => Keyboard.dismiss()} />
          )}
        </View>

        {/* === BOTTOM TOOL STRIP === */}
        <Animated.View entering={SlideInDown.duration(500)} style={[styles.previewBottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
            {[
              { icon: 'options-outline', label: 'Modify', action: handleModify },
              { icon: 'hardware-chip-outline', label: 'Features', action: () => setShowFeaturesModal(true) },
              { icon: 'musical-notes-outline', label: 'Audio', action: () => setShowAudioModal(true) },
              { icon: 'film-outline', label: 'Videos', action: () => setShowVideosModal(true) },
              { icon: 'color-filter-outline', label: 'Colors', action: () => setShowColorsModal(true) },
              { icon: 'image-outline', label: 'Images', action: handleGeneratePhoto },
            ].map((tool, i) => (
              <Pressable key={i} style={{ alignItems: 'center', gap: 6 }} onPress={tool.action}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={tool.icon as any} size={22} color="#FFF" />
                </View>
                <Text style={{ color: '#AAA', fontSize: 11, fontWeight: '600' }}>{tool.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* === MODIFY MODAL === */}
        <Modal visible={showModifyModal} transparent animationType="fade" onRequestClose={() => setShowModifyModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowModifyModal(false)}>
            <Animated.View entering={FadeInUp.duration(300).springify()} style={{ width: '100%', maxWidth: 360, backgroundColor: '#141416', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onStartShouldSetResponder={() => true}>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 20 }}>Modify Game</Text>
              {MODIFY_OPTIONS.map((opt, i) => (
                <Pressable key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => { setShowModifyModal(false); handleEdit(opt.instruction); }}>
                  <Ionicons name={opt.icon as any} size={22} color="#FFF" style={{ marginRight: 14 }} />
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
                </Pressable>
              ))}
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === COLORS MODAL === */}
        <Modal visible={showColorsModal} transparent animationType="fade" onRequestClose={() => setShowColorsModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowColorsModal(false)}>
            <Animated.View entering={FadeInUp.duration(300).springify()} style={{ width: '100%', maxWidth: 360, backgroundColor: '#141416', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onStartShouldSetResponder={() => true}>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 16 }}>Color Palettes</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {COLOR_PALETTES.map((palette, i) => (
                  <Pressable key={i} style={{ padding: 16, borderRadius: 16, backgroundColor: palette.bg, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} onPress={() => { setShowColorsModal(false); handleEdit(palette.instruction); }}>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      {palette.colors.map(c => <View key={c} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c }} />)}
                    </View>
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>{palette.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === FEATURES MODAL === */}
        <Modal visible={showFeaturesModal} transparent animationType="fade" onRequestClose={() => setShowFeaturesModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => setShowFeaturesModal(false)}>
            <Animated.View entering={SlideInDown.duration(300).springify()} style={{ width: '100%', maxHeight: '80%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 20 }} onStartShouldSetResponder={() => true}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Feature Setup</Text>
              </View>
              <ScrollView style={{ paddingHorizontal: 20 }}>
                {OPTIONS_FEATURES.map((opt, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                      <Ionicons name={opt.icon as any} size={20} color="#999" />
                    </View>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{opt.label}</Text>
                      <Text style={{ color: '#888', fontSize: 13, lineHeight: 18 }}>{opt.desc}</Text>
                    </View>
                    <Pressable 
                      onPress={() => setActiveFeatures(prev => ({...prev, [opt.id]: !prev[opt.id]}))}
                      style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: activeFeatures[opt.id] ? '#D97736' : 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 2 }}
                    >
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: activeFeatures[opt.id] ? 'flex-end' : 'flex-start' }} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
                <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }} onPress={() => setActiveFeatures({})}>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Clear all</Text>
                </Pressable>
                <Pressable style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#D97736', alignItems: 'center' }} onPress={() => {
                  setShowFeaturesModal(false);
                  const activeKeys = Object.keys(activeFeatures).filter(k => activeFeatures[k]);
                  if (activeKeys.length === 0) return;
                  const inst = activeKeys.map(k => OPTIONS_FEATURES.find(o => o.id === k)?.instruction).join(' ');
                  handleEdit(inst);
                }}>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Apply</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === AUDIO MODAL === */}
        <Modal visible={showAudioModal} transparent animationType="fade" onRequestClose={() => setShowAudioModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => setShowAudioModal(false)}>
            <Animated.View entering={SlideInDown.duration(300).springify()} style={{ width: '100%', height: '85%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom }} onStartShouldSetResponder={() => true}>
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Pressable onPress={() => setAudioTab('bgm')} style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: audioTab === 'bgm' ? '#FFF' : 'transparent' }}>
                    <Text style={{ color: audioTab === 'bgm' ? '#FFF' : '#777', fontSize: 16, fontWeight: '700' }}>BGM</Text>
                  </Pressable>
                  <Pressable onPress={() => setAudioTab('sfx')} style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: audioTab === 'sfx' ? '#FFF' : 'transparent' }}>
                    <Text style={{ color: audioTab === 'sfx' ? '#FFF' : '#777', fontSize: 16, fontWeight: '700' }}>Sound effects</Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                <Pressable onPress={() => handleAssetUpload(audioTab)} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 16, width: 140, flexDirection: 'row', justifyContent: 'center' }}>
                  <Ionicons name="push-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Upload</Text>
                </Pressable>
                {audioTab === 'bgm' ? (
                  (communityAudios.length > 0 ? communityAudios : OPTIONS_BGM).map((opt: any, i: number) => (
                    <Pressable key={'b'+i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => { setShowAudioModal(false); handleEdit('Inject this auto-looping background music: ' + opt.url); }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>{opt.label || opt.title}</Text>
                        <Text style={{ color: '#666', fontSize: 12 }}>{opt.duration || ''}</Text>
                      </View>
                      <Ionicons name="play" size={24} color="#FFF" style={{ marginHorizontal: 16 }} />
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#777' }} />
                    </Pressable>
                  ))
                ) : (
                  OPTIONS_SOUNDS.map((opt, i) => (
                    <Pressable key={'s'+i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }} onPress={() => { setShowAudioModal(false); handleEdit(opt.instruction); }}>
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                        <Ionicons name={opt.icon as any} size={20} color="#FFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{opt.label}</Text>
                        <Text style={{ color: '#888', fontSize: 13 }}>{opt.desc}</Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === VIDEOS MODAL === */}
        <Modal visible={showVideosModal} transparent animationType="fade" onRequestClose={() => setShowVideosModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }} onPress={() => setShowVideosModal(false)}>
            <Animated.View entering={SlideInDown.duration(300).springify()} style={{ width: '100%', height: '80%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom }} onStartShouldSetResponder={() => true}>
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 12 }} />
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Video</Text>
              </View>
              <ScrollView style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, gap: 4 }}>
                  <Pressable onPress={() => handleAssetUpload('video')} style={{ width: '32%', aspectRatio: 0.8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    {isUploadingAsset ? <ActivityIndicator size="small" color="#D97736" style={{ marginBottom: 8 }} /> : <Ionicons name="push-outline" size={24} color="#D97736" style={{ marginBottom: 8 }} />}
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Upload</Text>
                    <Text style={{ color: '#666', fontSize: 11, marginTop: 4 }}>(Maximum 15s)</Text>
                  </Pressable>
                  {(communityVideos.length > 0 ? communityVideos : OPTIONS_VIDEOS).map((opt: any, i: number) => (
                    <Pressable key={i} style={{ width: '32%', aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', marginBottom: 8, backgroundColor: '#000' }} onPress={() => { setShowVideosModal(false); handleEdit('Add a full-screen looping background video, autoplaying and muted: ' + (opt.url || '')); }}>
                      <Image source={{ uri: opt.thumb || opt.thumbnail || 'https://picsum.photos/200/300' }} style={{ width: '100%', height: '100%', opacity: 0.8 }} resizeMode="cover" />
                      <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>00:15</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* === IMAGE MAKER MODAL === */}
        <Modal visible={showImageModal} transparent animationType="fade" onRequestClose={() => { if (!isGeneratingImage) setShowImageModal(false); }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 380, backgroundColor: '#141416', borderRadius: 28, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.15)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(168,85,247,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="sparkles" size={22} color="#a855f7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }}>AI Image Maker</Text>
                </View>
                {!isGeneratingImage && (
                  <Pressable onPress={() => setShowImageModal(false)} hitSlop={12}>
                    <Ionicons name="close-circle" size={30} color="rgba(255,255,255,0.2)" />
                  </Pressable>
                )}
              </View>
              {generatedImageUri ? (
                <View style={{ margin: 16, borderRadius: 16, overflow: 'hidden' }}>
                  <Image source={{ uri: generatedImageUri }} style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }} resizeMode="contain" />
                </View>
              ) : isGeneratingImage ? (
                <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 16, aspectRatio: 1.2, backgroundColor: '#0D0D10', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color="#a855f7" />
                  <Text style={{ color: '#CCC', fontSize: 15, fontWeight: '700', marginTop: 16 }}>Creating your image...</Text>
                </View>
              ) : (
                <View style={{ margin: 16 }}>
                  <TextInput
                    style={{ color: '#FFF', fontSize: 16, backgroundColor: '#0D0D10', borderRadius: 16, padding: 16, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(168,85,247,0.1)' }}
                    placeholder="Describe what you want to create..."
                    placeholderTextColor="#444"
                    value={imagePromptText}
                    onChangeText={setImagePromptText}
                    multiline
                    autoFocus
                  />
                </View>
              )}
              <View style={{ padding: 16, gap: 10 }}>
                {generatedImageUri ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable style={{ flex: 1, paddingVertical: 15, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }} onPress={() => { setGeneratedImageUri(null); setImagePromptText(''); }}>
                      <Text style={{ color: '#999', fontWeight: '700', fontSize: 14 }}>Try Again</Text>
                    </Pressable>
                    <Pressable style={{ flex: 1, borderRadius: 30, overflow: 'hidden' }} onPress={() => { setShowImageModal(false); setPrompt(prev => prev + (prev ? '\\n' : '') + '[AI Image attached]'); }}>
                      <LinearGradient colors={['#a855f7', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 15, alignItems: 'center', borderRadius: 30 }}>
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Use This Image</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                ) : !isGeneratingImage ? (
                  <Pressable style={{ borderRadius: 30, overflow: 'hidden' }} onPress={submitImageGeneration} disabled={!imagePromptText.trim()}>
                    <LinearGradient colors={imagePromptText.trim() ? ['#a855f7', '#7c3aed'] : ['#2A2A2D', '#222']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderRadius: 30 }}>
                      <Ionicons name="color-wand" size={18} color={imagePromptText.trim() ? '#FFF' : '#666'} />
                      <Text style={{ color: imagePromptText.trim() ? '#FFF' : '#666', fontWeight: '800', fontSize: 15 }}>Generate Image</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable style={{ paddingVertical: 15, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,59,48,0.2)', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.06)' }} onPress={() => { setIsGeneratingImage(false); setShowImageModal(false); }}>
                    <Text style={{ color: '#FF6B6B', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }`;

code = code.replace(
  /  \/\/ ======================\n  \/\/ RENDER: GAME PREVIEW\n  \/\/ ======================\n  if \(phase === 'preview' && activeHtml\) \{[\s\S]*?\n  \}/,
  NEW_PREVIEW
);

// ============================================================
// 5. ADD previewPublishPill STYLE if missing
// ============================================================
if (!code.includes('previewPublishPill')) {
  code = code.replace(
    '  previewTopBar: {',
    `  previewPublishPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewTopBar: {`
  );
}

fs.writeFileSync(filepath, code);
console.log('✅ Clean refactor applied! Lines:', code.split('\\n').length);
