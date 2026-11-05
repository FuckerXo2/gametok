// GamePlayerModal — the fullscreen player. This IS how a game opens in explore, extracted so
// profile and other-user profiles open games identically instead of each rolling their own shell.
//
// No loading screen of the app's own: the game shows straight away and loads with its own screen (a generic
// thumbnail-and-percent card in front of every game hid each game's look). Until its page has loaded, the game's
// picture covers the blank WebView, and the play is recorded.
//
// A landscape game locks the phone to landscape (natively, either way round) and the game only mounts once the screen
// has turned, so it boots at its real size; leaving locks back to portrait.

import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { View, Modal, StatusBar, StyleSheet, DeviceEventEmitter, Image, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { games as gamesApi, API_URL } from '../services/api';
import { GameSurface, buildGameUrl } from './GameSurface';
import { TokBuxSheet } from './TokBuxSheet';
import { GameActionRail } from './GameActionRail';
import { GameMenu } from './GameMenu';
import { isLandscape, type Orientation } from '../constants/orientation';
import { ALL_ORIENTATIONS, lockToLandscape, lockToPortrait } from '../utils/orientationHelper';

const API_ORIGIN = API_URL.replace(/\/api$/, '');

export interface PlayableGame {
  id: string;
  joinFriend?: string | null;          // opened from a friend's Join: their GameTok user id
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
  const win = useWindowDimensions();
  // a game's "get TokBux" opens the TokBux store over it
  const [tokbuxOpen, setTokbuxOpen] = useState(false);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('gametok:open-tokbux', () => setTokbuxOpen(true));
    return () => sub.remove();
  }, []);

  // your friends see which game you're in (the Games screen's "Join friends")
  const { setMyStatus } = useSocket();
  useEffect(() => {
    if (!game) return;
    setMyStatus('in-game', game.id);
    return () => setMyStatus('online');
  }, [game?.id]);

  // turn the phone for the game, and back when it closes
  const wantsLandscape = !!game && isLandscape(game.orientation);
  const [gaveUp, setGaveUp] = useState(false);   // the phone couldn't be turned: play in whatever shape it is
  useEffect(() => {
    if (!game) return;
    setGaveUp(false);
    let live = true;
    const timer = setTimeout(() => live && setGaveUp(true), 1500);
    (wantsLandscape ? lockToLandscape() : lockToPortrait()).then((ok) => { if (!ok && live) setGaveUp(true); });
    return () => { live = false; clearTimeout(timer); lockToPortrait(); };
  }, [game?.id, wantsLandscape]);
  const turned = !wantsLandscape || win.width > win.height || gaveUp;

  // Keyed on the game id so a second game opened from the same surface starts fresh rather than
  // flashing the previous game's finished state.
  const key = game?.id || 'none';

  const close = () => {
    setLoaded(false);
    onClose();
  };

  return (
    <Modal
      visible={!!game}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={ALL_ORIENTATIONS}
      onRequestClose={close}
      onShow={() => {
        if (game && recordPlay) gamesApi.recordPlay(game.id).catch(() => {});
      }}
    >
      {/* its own safe-area provider: the app's root one doesn't follow the phone turning inside this modal, so the
          menu would sit under the notch / Dynamic Island in landscape */}
      <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: game?.color || '#000' }]}>
        <StatusBar hidden />
        {game && turned ? (
          <GameSurface
            key={key}
            gameId={game.id}
            joinFriend={game.joinFriend}
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
            onLoadEnd={() => setLoaded(true)}
          />
        ) : null}
        {game?.thumbnail && !loaded ? (
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
            <Image source={{ uri: game.thumbnail }} resizeMode="cover" style={StyleSheet.absoluteFill} />
          </View>
        ) : null}

        {/* Action rail — only once the game is up, so it never sits over the loading screen. Not on landscape games:
            it's a portrait column that would cover the game's own controls. */}
        {game && loaded && !isLandscape(game.orientation) ? (
          <GameActionRail
            gameId={game.id}
            gameName={game.name}
            initialLikeCount={game.likes || 0}
            bottomOffset={insets.bottom + 24}
            onRemix={onRemix ? () => onRemix(game) : undefined}
          />
        ) : null}

        {game ? <GameMenu key={`menu-${key}`} gameId={game.id} gameName={game.name} landscape={wantsLandscape} onLeave={close} /> : null}
        <TokBuxSheet visible={tokbuxOpen} onClose={() => setTokbuxOpen(false)} />
      </View>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  root: {
    flex: 1,
  },
});
