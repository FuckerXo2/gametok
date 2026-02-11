import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  reward_points: number;
}

interface AchievementsModalProps {
  visible: boolean;
  achievements: Achievement[];
  onClose: () => void;
}

const getAchievementIcon = (iconName: string): { name: string; family: 'ionicons' | 'material' } => {
  const iconMap: Record<string, { name: string; family: 'ionicons' | 'material' }> = {
    '👶': { name: 'footsteps', family: 'ionicons' },
    '🎮': { name: 'game-controller', family: 'ionicons' },
    '🔥': { name: 'flame', family: 'ionicons' },
    '🦋': { name: 'people', family: 'ionicons' },
    '💎': { name: 'diamond', family: 'ionicons' },
    '🏆': { name: 'trophy', family: 'ionicons' },
    '⭐': { name: 'star', family: 'ionicons' },
    '🎯': { name: 'bullseye', family: 'material' },
    '💪': { name: 'fitness', family: 'ionicons' },
    '🚀': { name: 'rocket', family: 'ionicons' },
    '⏱️': { name: 'timer', family: 'ionicons' },
    '❤️': { name: 'heart', family: 'ionicons' },
    '💬': { name: 'chatbubble', family: 'ionicons' },
    '👥': { name: 'people', family: 'ionicons' },
  };
  return iconMap[iconName] || { name: 'ribbon', family: 'ionicons' };
};

const AchievementIcon: React.FC<{ icon: string; size?: number; color?: string }> = ({ 
  icon, size = 28, color = '#fff' 
}) => {
  const iconData = getAchievementIcon(icon);
  if (iconData.family === 'material') {
    return <MaterialCommunityIcons name={iconData.name as any} size={size} color={color} />;
  }
  return <Ionicons name={iconData.name as any} size={size} color={color} />;
};

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  visible,
  achievements,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#1a1a2e', '#0f0f23']}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={styles.headerRight}>
            <Text style={styles.progressText}>{unlockedCount}/{achievements.length}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarWrap}>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={['#a855f7', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { 
                width: `${(unlockedCount / Math.max(achievements.length, 1)) * 100}%` 
              }]}
            />
          </View>
        </View>

        <ScrollView 
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {achievements.map((achievement) => (
            <View 
              key={achievement.id} 
              style={[styles.achievementRow, !achievement.unlocked && styles.achievementLocked]}
            >
              <View style={[
                styles.iconWrap, 
                achievement.unlocked && styles.iconWrapUnlocked
              ]}>
                <AchievementIcon 
                  icon={achievement.icon} 
                  size={28} 
                  color={achievement.unlocked ? '#a855f7' : 'rgba(255,255,255,0.3)'} 
                />
                {achievement.unlocked && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  </View>
                )}
              </View>
              
              <View style={styles.achievementInfo}>
                <Text style={[
                  styles.achievementName,
                  !achievement.unlocked && styles.textLocked
                ]}>
                  {achievement.name}
                </Text>
                <Text style={styles.achievementDesc}>
                  {achievement.description || 'Complete this achievement to earn rewards'}
                </Text>
              </View>
              
              <View style={styles.rewardBadge}>
                <Text style={styles.rewardText}>+{achievement.reward_points}</Text>
                <FontAwesome5 name="coins" size={12} color="#ffd60a" />
              </View>
            </View>
          ))}
          
          {achievements.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={64} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>No achievements yet</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 44,
    alignItems: 'flex-end',
  },
  progressText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarWrap: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  achievementLocked: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconWrapUnlocked: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 2,
    borderColor: '#a855f7',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
  achievementInfo: {
    flex: 1,
    marginRight: 12,
  },
  achievementName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  textLocked: {
    color: 'rgba(255,255,255,0.6)',
  },
  achievementDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 18,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,214,10,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rewardText: {
    color: '#ffd60a',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    marginTop: 16,
  },
});

export default AchievementsModal;
