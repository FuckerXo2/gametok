// GamePlayerModal — the fullscreen player. This IS how a game opens in explore, extracted so
// profile and other-user profiles open games identically instead of each rolling their own shell.
//
// "Opens like explore" is more than a WebView in a Modal — it's the branded loading screen with
// the game's thumbnail, creator and real load progress, the game's own colour behind it, the play
// being recorded, and the deliberate 1200ms hold after load so the game isn't revealed mid-boot.
// Every one of those was missing from the ad-hoc players elsewhere in the app.

import React, { useState } from 'react';
import { View, Modal, Pressable, StatusBar, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { games as gamesApi, API_URL } from '../services/api';
import { resolveGameThumbnail } from '../utils/thumbnails';
import { GameLoadingScreen } from './GameLoadingScreen';
import { GameSurface, buildGameUrl } from './GameSurface';
import { GameActionRail } from './GameActionRail';
import { isLandscape, type Orientation } from '../constants/orientation';

const API_ORIGIN = API_URL.replace(/\/api$/, '');

/** How long to keep the loading screen up after onLoadEnd, so the game isn't shown mid-boot. */
const REVEAL_DELAY_MS = 1200;

export interface PlayableGame {
  id: string;
  name: string;
  thumbnail?: string | null;
  embedUrl?: string | null;
  color?: string | null;
  orientation?: Orientation | string | null;
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
  likes?: number | null;
}

interface Props {
  game: PlayableGame | null;
  onClose: () => void;
  /**
   * Record a play when the game opens. Explore does this; leave it on unless the caller already
   * recorded the play itself, or double counting will inflate the number.
   */
  recordPlay?: boolean;
  /**
   * Provide to show Remix on the action rail. Needs the host to be able to route into the create
   * tab with the new draft, so hosts that can't are simply not given the button.
   */
  onRemix?: (game: PlayableGame) => void;
}

export const GamePlayerModal = ({ game, onClose, recordPlay = true, onRemix }: Props) => {
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  // Keyed on the game id so a second game opened from the same surface starts from the loading
  // screen again rather than flashing the previous game's finished state.
  const key = game?.id || 'none';

  const close = () => {
    setLoaded(false);
    setProgress(0);
    onClose();
  };

  return (
    <Modal
      visible={!!game}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={close}
      onShow={() => {
        if (game && recordPlay) gamesApi.recordPlay(game.id).catch(() => {});
      }}
    >
      <View style={[styles.root, { backgroundColor: game?.color || '#000' }]}>
        <StatusBar hidden />
        {game ? (
          <GameSurface
            key={key}
            orientation={game.orientation}
            source={{ uri: buildGameUrl(game, API_ORIGIN) }}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsAirPlayForMediaPlayback={false}
            onLoadProgress={({ nativeEvent }) => {
              setProgress(Math.round((nativeEvent.progress || 0) * 100));
            }}
            onLoadEnd={() => {
              setProgress(100);
              setTimeout(() => setLoaded(true), REVEAL_DELAY_MS);
            }}
          />
        ) : null}

        {!loaded && game ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <GameLoadingScreen
              gameName={game.name}
              gameThumbnail={resolveGameThumbnail(game.thumbnail, game.id, game)}
              creatorName={game.creatorDisplayName || game.creatorUsername}
              progress={progress}
            />
          </View>
        ) : null}

        {/* Action rail — only once the game is up, so it never sits over the loading screen.
            Skipped for landscape games for the same reason HomeScreen skips it: the rail is
            positioned against portrait-relative insets, and the game's content is rotated 90deg
            inside the portrait frame, so an un-rotated rail would print sideways across the game. */}
        {game && loaded && !isLandscape(game.orientation) ? (
          <GameActionRail
            gameId={game.id}
            gameName={game.name}
            initialLikeCount={game.likes || 0}
            bottomOffset={insets.bottom + 24}
            onRemix={onRemix ? () => onRemix(game) : undefined}
          />
        ) : null}

        <Pressable
          style={[styles.closeBtn, { top: insets.top + 10 }]}
          onPress={close}
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
