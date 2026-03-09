import React, { useRef } from 'react';
import { TouchableOpacity, Animated, TouchableOpacityProps, StyleProp, ViewStyle } from 'react-native';

interface AnimatedButtonProps extends TouchableOpacityProps {
  children: React.ReactNode;
  activeScale?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({ 
  children, 
  activeScale = 0.85, 
  containerStyle, 
  style, 
  onPress,
  ...props 
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: activeScale,
      useNativeDriver: true,
      bounciness: 0,
      speed: 25
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 15,
      speed: 25
    }).start();
  };

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={style}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={0.9}
        {...props}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};
