const fs = require('fs');
let code = fs.readFileSync('/Users/abiolalimitless/gameidea/gametok/src/screens/CreateScreen.tsx', 'utf8');

// 1. STATE VARIABLES
code = code.replace(
  'const [showSoundsModal, setShowSoundsModal] = useState(false);',
  `const [showSoundsModal, setShowSoundsModal] = useState(false);\n  const [showFeaturesModal, setShowFeaturesModal] = useState(false);\n  const [showVideosModal, setShowVideosModal] = useState(false);\n  const [showAudioModal, setShowAudioModal] = useState(false);\n  const [audioTab, setAudioTab] = useState<'bgm' | 'sfx'>('bgm');\n  const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>({});`
);

// 2. CONSTANTS
const CONSTANTS = `
  const OPTIONS_SOUNDS = [
    { label: 'Add Full Sound Effects', icon: 'musical-notes', desc: 'Jumps, scores, collisions, and game over', instruction: 'Add rich sound effects throughout the game. Use window.playSound("jump") for jumps/taps, window.playSound("coin") for scoring, window.playSound("hit") for collisions, and window.playSound("gameover") for game over.' },
    { label: 'Mute Entire Game', icon: 'volume-mute', desc: 'Remove all audio completely', instruction: 'Remove all calls to window.playSound() from the entire game. Make it completely silent.' },
  ];

  const OPTIONS_BGM = [
    { label: 'BGM-gameplay-military-tense', duration: '01:25', url: 'https://cdn.freesound.org/previews/495/495537_495537-lq.mp3' },
    { label: 'BGM-menu-scifi-mysterious', duration: '01:41', url: 'https://cdn.freesound.org/previews/454/454593_454593-lq.mp3' },
    { label: 'BGM-gameplay-modern-exciting', duration: '01:36', url: 'https://cdn.freesound.org/previews/588/588496_588496-lq.mp3' },
    { label: 'BGM-retro-8bit-arcade', duration: '01:53', url: 'https://cdn.freesound.org/previews/251/251461_251461-lq.mp3' }
  ];

  const OPTIONS_VIDEOS = [
    { label: 'Hyperspace', thumb: 'https://i.vimeocdn.com/video/961817748-0d1fc4f59add1e82b7db5f5fb7a3b378cc681d45dc5f6ebd40dfdfae5d0efdd6-d_640x360.jpg', url: 'https://cdn.pixabay.com/video/2020/09/20/50531-460875411_tiny.mp4' },
    { label: 'Neon Grid', thumb: 'https://i.vimeocdn.com/video/1113038334-9bb86daedeeada87b61f88031d6d843daabcbcc2ca20b22a075e7a911a3d34ff-d_640x360.jpg', url: 'https://cdn.pixabay.com/video/2021/04/16/71239-537446549_tiny.mp4' },
    { label: 'Cloud Flight', thumb: 'https://i.vimeocdn.com/video/1206145327-0ca1a1e0f06eec4e42777b75df9779df52d2f2c8d2d68997a6e1a4de6bfa62fc-d_640x360.jpg', url: 'https://cdn.pixabay.com/video/2021/08/04/83896-584742491_tiny.mp4' },
    { label: 'Pixel Snow', thumb: 'https://i.vimeocdn.com/video/841203678-ae701bb598287d3eac3fbb2d2d9aa9c34be45b410ff1a383f055a40bfa09930f-d_640x360.jpg', url: 'https://cdn.pixabay.com/video/2019/12/17/30419-380962372_tiny.mp4' }
  ];

  const OPTIONS_FEATURES = [
    { id: 'cam', icon: 'videocam', label: 'Live Camera', desc: 'Streams camera feed perfectly as background canvas.', instruction: 'Add HTML5 camera feed using navigator.mediaDevices.getUserMedia and render it as the entire game canvas background seamlessly.' },
    { id: 'mic', icon: 'mic', label: 'Microphone Audio Input', desc: 'Captures mic for volume-driven interaction.', instruction: 'Use navigator.mediaDevices.getUserMedia for the microphone, extract the volume/frequency, and use it significantly for a core game mechanic (like shooting or flying).' },
    { id: 'gyro', icon: 'compass', label: 'Tilt / Gyroscope Control', desc: 'Uses phone gyroscope to move in-game.', instruction: 'Capture window.addEventListener("deviceorientation") alpha/beta/gamma and directly bind them to the player/paddle movement instead of touch/cursors.' },
    { id: 'haptic', icon: 'radio', label: 'Haptic Feedback', desc: 'Triggers haptic vibrations on key events.', instruction: 'Sprinkle appropriate navigator.vibrate() calls throughout game logic: short vibrate on jump, medium on score, long burst on collision or game over.' }
  ];
`;
code = code.replace(
  `  const OPTIONS_SOUNDS = [
    { label: 'Add Full Sound Effects', icon: 'musical-notes', desc: 'Jumps, scores, collisions, and game over', instruction: 'Add rich sound effects throughout the game. Use window.playSound("jump") for jumps/taps, window.playSound("coin") for scoring, window.playSound("hit") for collisions, and window.playSound("gameover") for game over.' },
    { label: 'Mute Entire Game', icon: 'volume-mute', desc: 'Remove all audio completely', instruction: 'Remove all calls to window.playSound() from the entire game. Make it completely silent.' },
  ];`,
  CONSTANTS
);

// 3. TOOL BAR
const NEW_TOOL_BAR = `        {/* === BOTTOM TOOL STRIP === */}
        <Animated.View entering={SlideInDown.duration(500)} style={[styles.previewBottomSection, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.previewToolRow, { paddingHorizontal: 20 }]}>
            {[
              { icon: 'options-outline', label: 'Modify', action: handleModify },
              { icon: 'hardware-chip-outline', label: 'Features', action: () => setShowFeaturesModal(true) },
              { icon: 'musical-notes-outline', label: 'Audio', action: () => setShowAudioModal(true) },
              { icon: 'film-outline', label: 'Videos', action: () => setShowVideosModal(true) },
              { icon: 'color-filter-outline', label: 'Colors', action: () => setShowColorsModal(true) },
              { icon: 'image-outline', label: 'Images', action: handleGeneratePhoto },
            ].map((tool, i) => (
              <Pressable key={i} style={styles.previewToolBtn} onPress={tool.action}>
                <View style={[styles.previewToolIconWrap, { width: 44, height: 44, borderRadius: 16 }]}>
                  <Ionicons name={tool.icon as any} size={22} color="#FFF" />
                </View>
                <Text style={styles.previewToolText}>{tool.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>`;

code = code.replace(
  /\{\/\* === BOTTOM TOOL STRIP === \*\/\}[\s\S]*?(?=\{\/\* === MODIFY MODAL === \*\/\})/,
  NEW_TOOL_BAR + '\n\n        '
);

// 4. NEW MODALS
const NEW_MODALS = `
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
                    onPress={() => setActiveFeatures(prev => ({...prev, [opt.id]: !prev[opt.id]})) }
                    style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: activeFeatures[opt.id] ? '#D97736' : 'rgba(255,255,255,0.1)', justifyContent: 'center', paddingHorizontal: 2 }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignSelf: activeFeatures[opt.id] ? 'flex-end' : 'flex-start' }} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
              <Pressable 
                style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}
                onPress={() => setActiveFeatures({})}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Clear all</Text>
              </Pressable>
              <Pressable 
                style={{ flex: 1, paddingVertical: 16, borderRadius: 20, backgroundColor: '#D97736', alignItems: 'center' }}
                onPress={() => {
                  setShowFeaturesModal(false);
                  const activeKeys = Object.keys(activeFeatures).filter(k => activeFeatures[k]);
                  if (activeKeys.length === 0) return;
                  const inst = activeKeys.map(k => OPTIONS_FEATURES.find(o => o.id === k)?.instruction).join(' ');
                  handleEdit(inst);
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Apply</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* === AUDIO MODAL (REPLACES SOUNDS) === */}
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
              <Pressable style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 16, width: 140, flexDirection: 'row', justifyContent: 'center' }}>
                <Ionicons name="push-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Upload</Text>
              </Pressable>

              {audioTab === 'bgm' ? (
                OPTIONS_BGM.map((opt, i) => (
                  <View key={'b'+i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>{opt.label}</Text>
                      <Text style={{ color: '#666', fontSize: 12 }}>{opt.duration}</Text>
                    </View>
                    <Ionicons name="play" size={24} color="#FFF" style={{ marginHorizontal: 16 }} />
                    <Pressable 
                      onPress={() => { setShowAudioModal(false); handleEdit(\`Inject this auto-looping background music audio URL into the game logic smoothly: \${opt.url}\`); }}
                    >
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#777' }} />
                    </Pressable>
                  </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }}>
               <View style={{ flex: 1 }} />
               <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="search" size={18} color="#FFF" />
               </View>
            </View>

            <ScrollView style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, justifyContent: 'space-between' }}>
                <Pressable style={{ width: '32%', aspectRatio: 0.8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Ionicons name="push-outline" size={24} color="#D97736" style={{ marginBottom: 8 }} />
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Upload</Text>
                  <Text style={{ color: '#666', fontSize: 11, marginTop: 4 }}>(Maximum 15s)</Text>
                </Pressable>
                
                {OPTIONS_VIDEOS.map((opt, i) => (
                  <Pressable 
                    key={'i'+i} 
                    style={{ width: '32%', aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', marginBottom: 8, backgroundColor: '#000' }}
                    onPress={() => { setShowVideosModal(false); handleEdit(\`Add a full-screen looping background video using this URL. Ensure it visually sits behind the game canvas and fills the screen, autoplaying and muted: \${opt.url}\`); }}
                  >
                    <Image source={{ uri: opt.thumb }} style={{ width: '100%', height: '100%', opacity: 0.8 }} resizeMode="cover" />
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
`;

code = code.replace(
  /\{\/\* === SOUNDS MODAL === \*\/\}[\s\S]*?(?=\{\/\* === MAKE IMAGE MODAL === \*\/\})/,
  NEW_MODALS + '\n\n      '
);

fs.writeFileSync('/Users/abiolalimitless/gameidea/gametok/src/screens/CreateScreen.tsx', code);
