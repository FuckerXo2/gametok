import React from 'react';
import { View, StyleSheet, Platform, ViewProps, requireNativeComponent } from 'react-native';

export interface GameTokEngineProps extends ViewProps {
  gameScript?: string;
  cameraMode?: '3D' | '2D';
  gravity?: [number, number, number];
  onScoreUpdate?: (score: number) => void;
  onGameOver?: (won: boolean) => void;
}

// Native view registered in Expo/React Native native manager
const NativeView: any = Platform.OS !== 'web' 
  ? requireNativeComponent('GameTokEngine') 
  : null;

export const GameTokEngineView: React.FC<GameTokEngineProps> = ({
  gameScript,
  cameraMode = '3D',
  gravity = [0, -9.81, 0],
  onScoreUpdate,
  onGameOver,
  style,
  children,
  ...rest
}) => {
  if (Platform.OS === 'web' || !NativeView) {
    return (
      <View style={[styles.container, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <NativeView
      style={[styles.container, style]}
      gameScript={gameScript}
      cameraMode={cameraMode}
      gravity={gravity}
      {...rest}
    >
      {children}
    </NativeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
