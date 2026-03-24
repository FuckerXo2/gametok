import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, Text, Dimensions, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ai } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CreateScreenProps {
  isActive: boolean;
  onClose: () => void;
}

// Custom Glassmorphism Badge Component
const GlassPill = ({ icon, label, onPress, primary }: any) => {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.glassPill, primary && { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}40` }]} onPress={onPress}>
      <View style={[styles.pillIconWrapper, primary && { backgroundColor: `${colors.primary}30` }]}>
        <Ionicons name={icon} size={15} color={primary ? colors.primary : '#FFF'} />
      </View>
      <Text style={[styles.glassPillText, primary && { color: '#FFF' }]}>{label}</Text>
    </Pressable>
  );
};

export const CreateScreen: React.FC<CreateScreenProps> = ({ isActive, onClose }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeHtml, setActiveHtml] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 100 });
      // Throb the ambient background glow continuously
      pulse.value = withRepeat(
        withSequence(withTiming(1.05, {duration: 2000}), withTiming(0.95, {duration: 2000})),
        -1, true
      );
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
      setPrompt(''); // Clear form on hide
    }
  }, [isActive]);

  const animatedModalStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const animatedGlowStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const handleClose = () => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
    setTimeout(onClose, 200); 
  };

  const handleSurpriseMe = () => {
    setPrompt("Make a physics puzzle with bouncy emojis that act like pachinko balls...");
  };

  const handleDream = async () => {
    if(!prompt || isGenerating) return;
    setIsGenerating(true);
    
    // Throb background faster to indicate intense AI processing
    pulse.value = withRepeat(withSequence(withTiming(1.2, {duration: 600}), withTiming(0.8, {duration: 600})), -1, true);

    try {
      console.log("Igniting engine with prompt:", prompt);
      const res = await ai.dream(prompt);
      
      if(res.success && res.htmlPreview) {
         setActiveHtml(res.htmlPreview);
         setActiveDraftId(res.draftId);
      }
    } catch(error) {
      console.error("AI Generation Error", error);
    } finally {
      setIsGenerating(false);
      // Return pulse to normal breathing mode
      pulse.value = withRepeat(withSequence(withTiming(1.05, {duration: 2000}), withTiming(0.95, {duration: 2000})), -1, true);
    }
  };

  const handlePublish = async () => {
    if(!activeDraftId) return;
    try {
      const res = await ai.publish(activeDraftId);
      if(res.success) {
        console.log("✅ LIVE! Game pushed to Feed:", res.gameId);
        setActiveHtml(null);
        setPrompt('');
        handleClose();
      }
    } catch(e) {
      console.error(e);
    }
  };

  const pointerEvents = isActive ? 'auto' : 'none';

  return (
    <Animated.View style={[styles.container, animatedModalStyle, { paddingTop: insets.top }]} pointerEvents={pointerEvents}>
      <View style={styles.modal}>
        
        {/* Abstract Ambient Glow in the cosmic background */}
        <Animated.View style={[styles.ambientGlow, { backgroundColor: colors.primary }, animatedGlowStyle]} pointerEvents="none" />

        {/* Floating Top Navigation */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable style={styles.headerBadge}>
              <Ionicons name="layers" size={14} color="#FFF" style={{marginRight: 6}}/>
              <Text style={styles.headerBadgeText}>Drafts</Text>
            </Pressable>
          </View>
        </View>

        {activeHtml ? (
          <View style={{ flex: 1 }}>
            <WebView 
              source={{ html: activeHtml, baseUrl: 'https://gametok.app' }}
              style={{ flex: 1, backgroundColor: '#000' }}
              originWhitelist={['*']}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              bounces={false}
              scrollEnabled={false}
            />
            
            {/* Native Overlays for RAM preview interaction */}
            <View style={[styles.previewHUD, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <Pressable style={styles.rejectBtn} onPress={() => setActiveHtml(null)}>
                <Ionicons name="refresh" size={24} color="#FFF" />
              </Pressable>
              <Pressable style={[styles.publishBtn, { backgroundColor: colors.primary }]} onPress={handlePublish}>
                <Ionicons name="flash" size={18} color="#FFF" style={{marginRight: 6}} />
                <Text style={styles.publishBtnText}>Publish to Feed</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
          <ScrollView contentContainerStyle={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            
            {/* Friendly, accessible Hero Typography */}
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Dream it.</Text>
              <Text style={[styles.heroTitle, { color: colors.primary }]}>Play it.</Text>
              <Text style={styles.heroSub}>Just type an idea, and the AI will build the entire game instantly.</Text>
            </View>

            {/* The Input Core */}
            <View style={[styles.engineCore, { borderColor: prompt ? colors.primary : 'rgba(255,255,255,0.1)' }]}>
              
              <TextInput
                style={styles.engineInput}
                placeholder="So... What game are we cooking?"
                placeholderTextColor="#888"
                multiline
                value={prompt}
                onChangeText={setPrompt}
                autoFocus={true}
              />
              
              {/* Internal Actions: Locked inside the text area */}
              <View style={styles.engineActions}>
                
                {/* Embedded Prompt Assist Tool */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <GlassPill icon="sparkles" label="Surprise" primary onPress={handleSurpriseMe} />
                </View>

                {/* Consumer-friendly Send Button */}
                <Pressable 
                  style={[
                    styles.ignitionBtn, 
                    { backgroundColor: prompt ? colors.primary : '#222', shadowColor: colors.primary, elevation: prompt ? 20 : 0, shadowOpacity: prompt ? 0.7 : 0 }
                  ]}
                  onPress={handleDream}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="arrow-up" size={26} color={prompt ? '#FFF' : '#666'} />
                  )}
                </Pressable>

              </View>
            </View>

            {/* External Tool Rack: Rendered seamlessly underneath the text box */}
            <View style={styles.externalToolsRack}>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{alignItems: 'center', paddingRight: 20}}>
                 <GlassPill icon="image" label="Photos" />
                 <GlassPill icon="musical-notes" label="Sounds" />
                 <GlassPill icon="videocam" label="Videos" />
                 <GlassPill icon="settings" label="Physics Settings" />
               </ScrollView>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
        )}

      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0C',
    zIndex: 99999,
  },
  modal: {
    flex: 1,
    backgroundColor: '#0A0A0C', 
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    opacity: 0.15, // Creates a stunning cosmic blur bleeding over the dark interface
    transform: [{ scale: 1.5 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 10,
    zIndex: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
  },
  headerBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
    flexGrow: 1,
  },
  heroTextContainer: {
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 46,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1.5,
    lineHeight: 56, 
  },
  heroSub: {
    fontSize: 16,
    color: '#8A8A93',
    marginTop: 14,
    fontWeight: '500',
    lineHeight: 24,
    maxWidth: '90%',
  },
  engineCore: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 36,
    borderWidth: 1.5,
    padding: 24,
    minHeight: 320,
    justifyContent: 'space-between',
  },
  engineInput: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 34,
    minHeight: 180,
    textAlignVertical: 'top',
  },
  engineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 6,
    paddingVertical: 6,
    paddingRight: 16,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  pillIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  glassPillText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '700',
  },
  externalToolsRack: {
    marginTop: 16,
    flexDirection: 'row',
  },
  ignitionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
  },
  previewHUD: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  rejectBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 16,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  publishBtn: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  publishBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  }
});
