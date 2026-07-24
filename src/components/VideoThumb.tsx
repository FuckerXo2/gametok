// VideoThumb — a still poster frame for a video URL, so pickers can show a
// preview without mounting a live <Video> per tile (many autoplaying remote
// players just render black and hammer the decoder).
//
// Frames are generated once with expo-video-thumbnails and cached module-wide,
// so scrolling / reopening the picker never regenerates them.

import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// expo-video-thumbnails is a native module — it may not be compiled into the
// running dev binary yet (needs a rebuild). Guard the require like the rest of
// the app does (see CustomImage) so a missing module degrades to a placeholder
// instead of crashing the whole screen.
let VideoThumbnails: any = null;
try {
  const { requireNativeModule } = require('expo-modules-core');
  if (requireNativeModule('ExpoVideoThumbnails')) {
    VideoThumbnails = require('expo-video-thumbnails');
  }
} catch {
  VideoThumbnails = null;
}

const thumbCache = new Map<string, string>();

interface Props {
  uri: string;
  /** A ready-made poster image URL (e.g. the re-hosted R2 cover). When present
   *  it's shown directly — instant, and no native frame generation needed. */
  poster?: string | null;
  style?: StyleProp<ViewStyle>;
  /** Dim the frame (e.g. when its tile is selected). */
  dimmed?: boolean;
  /** Where in the clip to grab the frame, ms. */
  atMs?: number;
}

export const VideoThumb = ({ uri, poster, style, dimmed, atMs = 800 }: Props) => {
  const [thumb, setThumb] = useState<string | null>(() => (uri ? thumbCache.get(uri) ?? null : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // A supplied poster wins — no need to generate a frame at all.
    if (!uri || thumb || poster) return;
    // Native module not in this build yet → show the film-icon placeholder.
    if (!VideoThumbnails) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { uri: frame } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: atMs,
          quality: 0.5,
        });
        if (cancelled) return;
        thumbCache.set(uri, frame);
        setThumb(frame);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri, thumb, poster, atMs]);

  const shown = poster || thumb;
  if (shown) {
    return (
      <Image
        source={{ uri: shown }}
        style={[StyleSheet.absoluteFill, dimmed && styles.dimmed]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[style, styles.placeholder]}>
      {failed ? (
        <Ionicons name="film-outline" size={26} color="#777" />
      ) : (
        <ActivityIndicator size="small" color="#777" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  dimmed: { opacity: 0.65 },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
