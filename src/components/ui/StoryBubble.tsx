import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { colors, spacing, type } from '../../theme';

type Status = 'online' | 'inGame' | 'idle' | null;

interface StoryBubbleProps {
  username: string;
  subtitle?: string;
  avatarUri?: string | null;
  userId?: string | null;
  status?: Status;
  isAddNew?: boolean;
  unread?: boolean;
  onPress?: () => void;
  size?: number;
}

const statusColor: Record<NonNullable<Status>, string> = {
  online: colors.online,
  inGame: colors.inGame,
  idle: colors.textDim,
};

export const StoryBubble: React.FC<StoryBubbleProps> = ({
  username,
  subtitle,
  avatarUri,
  userId,
  status = null,
  isAddNew = false,
  unread = false,
  onPress,
  size = 60,
}) => {
  return (
    <Pressable onPress={onPress} style={styles.col}>
      <View
        style={[
          styles.ringWrap,
          {
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            borderColor: unread ? colors.primary : colors.border,
            borderWidth: unread ? 2 : 1,
          },
        ]}
      >
        {isAddNew ? (
          <View
            style={[
              styles.add,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
              },
            ]}
          >
            <Ionicons name="add" size={Math.round(size * 0.45)} color={colors.text} />
          </View>
        ) : (
          <Avatar uri={avatarUri || undefined} userId={userId || undefined} size={size} />
        )}
        {status && !isAddNew && (
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: statusColor[status],
                width: size * 0.22,
                height: size * 0.22,
                borderRadius: (size * 0.22) / 2,
                right: 2,
                bottom: 2,
              },
            ]}
          />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {username}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: status === 'inGame' ? colors.inGame : colors.textDim },
          ]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  col: {
    alignItems: 'center',
    width: 80,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    padding: 2,
  },
  add: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: colors.border,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  name: {
    color: colors.text,
    fontSize: type.size.small,
    fontWeight: '600',
    marginTop: spacing.sm,
    maxWidth: 76,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: type.size.micro,
    marginTop: 2,
    fontWeight: '500',
    maxWidth: 76,
    textAlign: 'center',
  },
});
