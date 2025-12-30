import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Modal,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STORIES = [
  { id: 'add', user: 'Your story', avatar: '➕', isAdd: true, hasStory: false },
  { id: '1', user: 'gamer_pro', avatar: '😎', hasStory: true, game: 'Stack Ball', score: 2450 },
  { id: '2', user: 'ninja_master', avatar: '🥷', hasStory: true, game: 'Fruit Slicer', score: 1890 },
  { id: '3', user: 'speedrunner', avatar: '⚡', hasStory: true, game: 'Stack Ball', score: 3200 },
  { id: '4', user: 'casual_gamer', avatar: '🎮', hasStory: true, game: 'Fruit Slicer', score: 980 },
  { id: '5', user: 'champion99', avatar: '👑', hasStory: true, game: 'Stack Ball', score: 4100 },
  { id: '6', user: 'newbie_2024', avatar: '🐣', hasStory: true, game: 'Fruit Slicer', score: 450 },
];

interface StoriesProps {
  onStoryPress?: (story: typeof STORIES[0]) => void;
}

export const Stories: React.FC<StoriesProps> = ({ onStoryPress }) => {
  const insets = useSafeAreaInsets();
  const [viewingStory, setViewingStory] = useState<typeof STORIES[0] | null>(null);
  const [progress, setProgress] = useState(0);

  const handleStoryPress = (story: typeof STORIES[0]) => {
    if (story.isAdd) {
      // Handle add story
      return;
    }
    setViewingStory(story);
    setProgress(0);
    
    // Auto progress
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setViewingStory(null);
          return 0;
        }
        return p + 2;
      });
    }, 100);
  };

  return (
    <>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {STORIES.map((story) => (
          <TouchableOpacity 
            key={story.id} 
            style={styles.storyItem}
            onPress={() => handleStoryPress(story)}
            activeOpacity={0.8}
          >
            <View style={[
              styles.avatarRing,
              story.hasStory && styles.avatarRingActive,
              story.isAdd && styles.avatarRingAdd,
            ]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{story.avatar}</Text>
              </View>
              {story.isAdd && (
                <View style={styles.addBadge}>
                  <Ionicons name="add" size={14} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.username} numberOfLines={1}>{story.user}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Story Viewer Modal */}
      <Modal
        visible={viewingStory !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setViewingStory(null)}
      >
        {viewingStory && (
          <View style={[styles.storyViewer, { paddingTop: insets.top }]}>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>

            {/* Header */}
            <View style={styles.storyHeader}>
              <View style={styles.storyHeaderLeft}>
                <View style={styles.storyHeaderAvatar}>
                  <Text style={styles.storyHeaderAvatarText}>{viewingStory.avatar}</Text>
                </View>
                <Text style={styles.storyHeaderUser}>{viewingStory.user}</Text>
                <Text style={styles.storyHeaderTime}>2h ago</Text>
              </View>
              <TouchableOpacity onPress={() => setViewingStory(null)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Story Content */}
            <View style={styles.storyContent}>
              <View style={styles.storyGameCard}>
                <Text style={styles.storyGameIcon}>
                  {viewingStory.game === 'Stack Ball' ? '🎱' : '🍉'}
                </Text>
                <Text style={styles.storyGameName}>{viewingStory.game}</Text>
                <View style={styles.storyScoreBox}>
                  <Text style={styles.storyScoreLabel}>HIGH SCORE</Text>
                  <Text style={styles.storyScoreValue}>{viewingStory.score?.toLocaleString()}</Text>
                </View>
                <TouchableOpacity style={styles.storyPlayBtn}>
                  <Text style={styles.storyPlayText}>Play Now</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={[styles.storyFooter, { paddingBottom: insets.bottom || 20 }]}>
              <TouchableOpacity style={styles.storyReplyBtn}>
                <Text style={styles.storyReplyText}>Send message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.storyShareBtn}>
                <Ionicons name="paper-plane-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 68,
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    backgroundColor: '#333',
    marginBottom: 6,
  },
  avatarRingActive: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FE2C55',
  },
  avatarRingAdd: {
    backgroundColor: '#1a1a1a',
    borderWidth: 0,
  },
  avatar: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#25F4EE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  username: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
  storyViewer: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  storyHeaderAvatarText: {
    fontSize: 18,
  },
  storyHeaderUser: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  storyHeaderTime: {
    color: '#888',
    fontSize: 13,
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  storyGameCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  storyGameIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  storyGameName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  storyScoreBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  storyScoreLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  storyScoreValue: {
    color: '#FE2C55',
    fontSize: 48,
    fontWeight: '800',
  },
  storyPlayBtn: {
    backgroundColor: '#FE2C55',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  storyPlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  storyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  storyReplyBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  storyReplyText: {
    color: '#888',
    fontSize: 14,
  },
  storyShareBtn: {
    padding: 8,
  },
});
