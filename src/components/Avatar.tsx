import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AvatarProps {
  uri?: string | null;
  size?: number;
  style?: any;
}

export const Avatar: React.FC<AvatarProps> = ({ uri, size = 48, style }) => {
  const hasImage = uri && uri.startsWith('http');
  
  return (
    <View style={[
      styles.container, 
      { width: size, height: size, borderRadius: size / 2 },
      style
    ]}>
      {hasImage ? (
        <Image 
          source={{ uri }} 
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <LinearGradient
          colors={['#c7c7cc', '#8e8e93']}
          style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Ionicons name="person" size={size * 0.55} color="#fff" />
        </LinearGradient>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
