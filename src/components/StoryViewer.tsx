import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Avatar } from './Avatar';
import { stories as storiesApi } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

interface Story {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  views: number;
  viewed: boolean;
  createdAt: string;
  expiresAt: string;
}

interface StoryUser {
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  stories: Story[];
  hasUnviewed: boolean;
}

interface StoryViewerProps {
  visible: boolean;
  onClose: () => void;
  storyUsers: StoryUser[];
  initialUserIndex: number;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  visible,
  onClose,
  storyUsers,
  initialUserIndex,
}) => {
  const insets = useSafeAreaInsets();
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const currentUser = storyUsers[currentUserIndex];
  const currentStory = currentUser?.stories[currentStoryIndex];

  // Reset when opening
  useEffect(() => {
    if (visible) {
      setCurrentUserIndex(initialUserIndex);
      setCurrentStoryIndex(0);
    }
  }, [visible, initialUserIndex]);

  // Progress animation
  useEffect(() => {
    if (!visible || !currentStory) return;

    progressAnim.setValue(0);
    
    // Mark as viewed
    storiesApi.view(currentStory.id).catch(() => {});

    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        goToNext();
      }
    });

    return () => {
      animationRef.current?.stop();
    };
  }, [visible, currentUserIndex, currentStoryIndex]);

  const goToNext = () => {
    if (!currentUser) return;

    if (currentStoryIndex < currentUser.stories.length - 1) {
      // Next story from same user
      setCurrentStoryIndex(prev => prev + 1);
    } else if (currentUserIndex < storyUsers.length - 1) {
      // Next user
      setCurrentUserIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      // End of all stories
      onClose();
    }
  };

  const goToPrev = () => {
    if (currentStoryIndex > 0) {
      // Previous story from same user
      setCurrentStoryIndex(prev => prev - 1);
    } else if (currentUserIndex > 0) {
      // Previous user (go to their last story)
      const prevUser = storyUsers[currentUserIndex - 1];
      setCurrentUserIndex(prev => prev - 1);
      setCurrentStoryIndex(prevUser.stories.length - 1);
    }
  };

  const handleTap = (side: 'left' | 'right') => {
    if (side === 'left') {
      goToPrev();
    } else {
      goToNext();
    }
  };

  // Swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 20 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
        }
      },
    })
  ).current;

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (!visible || !currentUser || !currentStory) return null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.container} {...panResponder.panHandlers}>
        {/* Story Image */}
        <Image
          source={{ uri: currentStory.mediaUrl }}
          style={styles.storyImage}
          resizeMode="cover"
        />

        {/* Gradient overlays */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={styles.topGradient}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)']}
          style={styles.bottomGradient}
        />

        {/* Progress bars */}
        <View style={[styles.progressContainer, { top: insets.top + 8 }]}>
          {currentUser.stories.map((_, index) => (
            <View key={index} style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width:
                      index < currentStoryIndex
                        ? '100%'
                        : index === currentStoryIndex
                        ? progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={[styles.header, { top: insets.top + 24 }]}>
          <Avatar uri={currentUser.user.avatar} size={36} />
          <View style={styles.headerInfo}>
            <Text style={styles.username}>
              {currentUser.user.displayName || currentUser.user.username}
            </Text>
            <Text style={styles.timestamp}>{formatTime(currentStory.createdAt)}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Caption */}
        {currentStory.caption && (
          <View style={[styles.captionContainer, { bottom: insets.bottom + 20 }]}>
            <Text style={styles.caption}>{currentStory.caption}</Text>
          </View>
        )}

        {/* Tap zones */}
        <TouchableOpacity
          style={styles.leftTapZone}
          onPress={() => handleTap('left')}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={styles.rightTapZone}
          onPress={() => handleTap('right')}
          activeOpacity={1}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyImage: {
    ...StyleSheet.absoluteFillObject,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  progressContainer: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  username: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  captionContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  caption: {
    color: '#fff',
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  leftTapZone: {
    position: 'absolute',
    left: 0,
    top: 100,
    bottom: 100,
    width: SCREEN_WIDTH * 0.3,
  },
  rightTapZone: {
    position: 'absolute',
    right: 0,
    top: 100,
    bottom: 100,
    width: SCREEN_WIDTH * 0.7,
  },
});

export default StoryViewer;
