// GameSurface — the one place a game is sized and rotated for playback.
//
// Landscape games are played by rotating the WebView's CONTENT 90 degrees inside a portrait box.
// The device stays portrait-locked; the player turns the phone. The game is laid out at the
// transposed size from its very first layout, so it boots straight into a landscape viewport with
// no resize, no orientationchange, and no flash of portrait — game code needs no orientation
// awareness of its own.
//
// Every surface that plays a game should go through this. Before it existed the feed had the
// rotation and explore did not, so the same landscape game played correctly in one place and
// squashed into a column in the other.

import React, { forwardRef, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';
import { isLandscape, DEFAULT_ORIENTATION, type Orientation } from '../constants/orientation';

export const GAMES_HOST = 'https://games.gametok.co';

/** Build the play URL for a game. Shared so every surface points at the same place. */
export const buildGameUrl = (
  game: { id: string; embedUrl?: string | null },
  apiOrigin: string,
): string => {
  const rawUrl = game.embedUrl
    ? (game.embedUrl.startsWith('/') ? `${apiOrigin}${game.embedUrl}` : game.embedUrl)
    : `${GAMES_HOST}/${game.id}/`;
  const separator = rawUrl.includes('?') ? '&' : '?';
  return `${rawUrl}${separator}gd_sdk_referrer_url=${encodeURIComponent(GAMES_HOST)}`;
};

// An intersection, not `interface extends`: WebViewProps is itself an intersection of the
// per-platform prop sets, and extending it via interface drops the platform-specific members
// callers pass (iOS `opaque`, Android `overScrollMode`).
type Props = WebViewProps & {
  /**
   * Real props that react-native-webview never typed. `<WebView>` accepts them only because the
   * class is generic (`WebView<P = {}>`) and infers P from whatever is passed; wrapping it in
   * forwardRef loses that escape hatch, so they have to be declared here.
   * `opaque` is iOS, `backgroundColor` is Android — together they make the WebView transparent.
   */
  opaque?: boolean;
  backgroundColor?: string;
  orientation?: Orientation | string | null;
  /** Style for the box the game fills. The rotation is measured against this. */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Pre-measured box, when the caller already knows it (the feed knows its card size). Skips the
   * onLayout round trip so the first paint is already correct.
   */
  box?: { width: number; height: number } | null;
};

export const GameSurface = forwardRef<WebView, Props>(function GameSurface(
  { orientation = DEFAULT_ORIENTATION, containerStyle, box: boxProp = null, style, ...webViewProps },
  ref,
) {
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const box = boxProp || measured;
  const wantsLandscape = isLandscape(orientation);

  // Only rotate when the box is actually portrait. On a tablet already held in landscape the box
  // is the right shape, and rotating would turn the game back into a portrait letterbox.
  const rotate = wantsLandscape && !!box && box.height >= box.width;

  // RN rotates about the element's centre, so the margins first move the pre-rotation centre to
  // (W/2, H/2); after the rotation the element covers exactly the W x H box at the origin.
  // position:'absolute' + flex:0 matter — a flex child would be stretched back to the parent's
  // cross size by Yoga, undoing the explicit width.
  //
  // Direction is one constant: '90deg' asks the player to turn the phone counter-clockwise. If
  // that reads wrong on a device, flip to '-90deg' and negate both margins.
  const rotatedStyle = rotate
    ? {
        position: 'absolute' as const,
        flex: 0,
        width: box!.height,
        height: box!.width,
        marginLeft: (box!.width - box!.height) / 2,
        marginTop: (box!.height - box!.width) / 2,
        transform: [{ rotate: '90deg' }],
      }
    : null;

  // A landscape game must not paint before it has been measured, or it flashes portrait first.
  const waitingForMeasure = wantsLandscape && !box;

  return (
    <View
      style={[styles.container, containerStyle]}
      collapsable={false}
      onLayout={
        boxProp
          ? undefined
          : (e) => {
              const { width, height } = e.nativeEvent.layout;
              setMeasured((prev) =>
                prev && prev.width === width && prev.height === height ? prev : { width, height },
              );
            }
      }
    >
      {!waitingForMeasure && (
        <WebView
          // Transparent by DEFAULT (callers can still override). Without these the WebView paints
          // its own opaque white until the document arrives — that is the white flash before a
          // game appears, and it sits on top of whatever loading UI the host is showing. `opaque`
          // is the iOS lever, `backgroundColor` the Android one; both are needed.
          opaque={false}
          backgroundColor="transparent"
          ref={ref}
          {...webViewProps}
          style={[rotatedStyle ?? styles.webview, style]}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Belt-and-braces for Android: the rotation math already lands the WebView exactly on the box,
    // but a hardware-layer child under a transform is not reliably clipped without this.
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
