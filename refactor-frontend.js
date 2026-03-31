const fs = require('fs');

let code = fs.readFileSync('/Users/abiolalimitless/gameidea/gametok/src/screens/CreateScreen.tsx', 'utf8');

// 1. Add Imports
code = code.replace(
  "import { ai } from '../services/api';",
  `import { ai, API_URL, getToken } from '../services/api';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';`
);

// 2. Add State & Handlers
// Find a good place to insert state. `const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>({});`
const STATE_REPLACEMENT = `const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>({});

  const [communityVideos, setCommunityVideos] = useState<any[]>([]);
  const [communityAudios, setCommunityAudios] = useState<any[]>([]);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);

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

  const handleAssetUpload = async (type: 'video' | 'bgm' | 'sfx' | 'image') => {
    try {
      let result;
      if (type === 'video' || type === 'image') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({
          type: 'audio/*',
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setIsUploadingAsset(true);
      const asset = result.assets[0];
      const formData = new FormData();
      
      const fileUri = asset.uri;
      const fileName = fileUri.split('/').pop() || \`upload.\${type === 'video' ? 'mp4' : 'mp3'}\`;
      const match = /\\.(\\w+)$/.exec(fileName);
      const fileType = match ? \`\${type === 'video' ? 'video' : type === 'image' ? 'image' : 'audio'}/\${match[1]}\` : 'multipart/form-data';

      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: fileType,
      } as any);

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
           handleEdit(\`Add a full-screen looping background video using this URL. Ensure it visually sits behind the game canvas and fills the screen, autoplaying and muted: \${uploadData.url}\`);
        } else if (type === 'bgm' || type === 'sfx') {
           setShowAudioModal(false);
           handleEdit(\`Inject this audio URL into the game logic smoothly: \${uploadData.url}\`);
        }
      } else {
        Alert.alert("Upload Failed", uploadData.error || "Failed to upload asset");
      }
    } catch (e) {
      console.log(e);
      setIsUploadingAsset(false);
      Alert.alert("Error", "Asset upload failed");
    }
  };`;

code = code.replace(
  'const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>({});',
  STATE_REPLACEMENT
);

// 3. Update Modals mapping logic to default to API data OR static data
// We'll replace OPTIONS_VIDEOS.map with (communityVideos.length > 0 ? communityVideos : OPTIONS_VIDEOS).map
// Same for BGM/SFX

code = code.replace(
  '{OPTIONS_VIDEOS.map((opt, i) => (',
  '{(communityVideos.length > 0 ? communityVideos : OPTIONS_VIDEOS).map((opt, i) => ('
);

code = code.replace(
  '{audioTab === \'bgm\' ? (\n                OPTIONS_BGM.map((opt, i) => (',
  `{audioTab === 'bgm' ? (
                (communityAudios.length > 0 ? communityAudios : OPTIONS_BGM).map((opt, i) => (`
);

code = code.replace(
  'OPTIONS_SOUNDS.map((opt, i) => (',
  '(communityAudios.length > 0 && audioTab === \'sfx\' ? communityAudios : OPTIONS_SOUNDS).map((opt, i) => ('
);


// 4. Update the Upload buttons
code = code.replace(
  /<Pressable style=\{\{ backgroundColor: 'rgba\(255,255,255,0\.1\)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 16, width: 140, flexDirection: 'row', justifyContent: 'center' \}\}>/,
  `<Pressable 
                onPress={() => handleAssetUpload(audioTab)}
                disabled={isUploadingAsset}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 16, width: 140, flexDirection: 'row', justifyContent: 'center' }}
              >`
);

code = code.replace(
  /<Pressable style=\{\{ width: '32%', aspectRatio: 0\.8, backgroundColor: 'rgba\(255,255,255,0\.05\)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 \}\}>/,
  `<Pressable 
                  onPress={() => handleAssetUpload('video')}
                  disabled={isUploadingAsset}
                  style={{ width: '32%', aspectRatio: 0.8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}
                >
                  {isUploadingAsset ? <ActivityIndicator size="small" color="#D97736" style={{marginBottom: 8}} /> : `
);
// We added `{isUploadingAsset` at the end of the previous replace, we should add `}` before `<Ionicons name="push-outline"`
code = code.replace(
  /\{isUploadingAsset \? <ActivityIndicator size="small" color="#D97736" style=\{\{marginBottom: 8\}\} \/> : /,
  `{isUploadingAsset ? <ActivityIndicator size="small" color="#D97736" style={{marginBottom: 8}} /> : <Ionicons name="push-outline" size={24} color="#D97736" style={{ marginBottom: 8 }} />}`
);

// We need to also remove the explicit `<Ionicons name="push-outline"` since we dynamically toggle it. Let's do a smarter replacement.
code = code.replace(
  `<Pressable 
                  onPress={() => handleAssetUpload('video')}
                  disabled={isUploadingAsset}
                  style={{ width: '32%', aspectRatio: 0.8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}
                >
                  {isUploadingAsset ? <ActivityIndicator size="small" color="#D97736" style={{marginBottom: 8}} /> : <Ionicons name="push-outline" size={24} color="#D97736" style={{ marginBottom: 8 }} />}<Ionicons name="push-outline" size={24} color="#D97736" style={{ marginBottom: 8 }} />`,
  `<Pressable 
                  onPress={() => handleAssetUpload('video')}
                  disabled={isUploadingAsset}
                  style={{ width: '32%', aspectRatio: 0.8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}
                >
                  {isUploadingAsset ? <ActivityIndicator size="small" color="#D97736" style={{marginBottom: 8}} /> : <Ionicons name="push-outline" size={24} color="#D97736" style={{ marginBottom: 8 }} />}`
);



fs.writeFileSync('/Users/abiolalimitless/gameidea/gametok/src/screens/CreateScreen.tsx', code);
