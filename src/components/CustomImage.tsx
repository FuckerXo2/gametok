import React from 'react';
import { Image as RNImage, ImageProps as RNImageProps } from 'react-native';

let hasExpoImage = false;
let ExpoImage: any = null;

try {
  // Dynamically check if the ExpoImage native module is compiled into the binary
  const { requireNativeModule } = require('expo-modules-core');
  if (requireNativeModule('ExpoImage')) {
    ExpoImage = require('expo-image').Image;
    hasExpoImage = true;
  }
} catch (e) {
  hasExpoImage = false;
}

export interface CustomImageProps extends RNImageProps {
  // Standard RN ImageProps
}

export const CustomImage: React.FC<CustomImageProps> = (props) => {
  if (hasExpoImage && ExpoImage) {
    const { source, style, resizeMode, ...rest } = props;
    
    // Map standard React Native resizeMode to expo-image contentFit
    let contentFit: 'cover' | 'contain' | 'fill' | 'none' = 'cover';
    if (resizeMode === 'contain') contentFit = 'contain';
    else if (resizeMode === 'stretch') contentFit = 'fill';
    else if (resizeMode === 'center') contentFit = 'none';

    return (
      <ExpoImage
        source={source}
        style={style}
        contentFit={contentFit}
        transition={200}
        {...rest}
      />
    );
  }

  // Fallback to standard react-native Image if native module is not present in binary
  return <RNImage {...props} />;
};
