// 3D avatar stage: the avatar-core page (games/avatar-editor/app-stage.html) in a WebView.
// The app owns the record and draws all the UI; the page only renders what it's sent.
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ViewStyle, Text, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import type { AvatarRecord, Focus } from '../avatar/catalog';
import { AVATAR_HOST } from '../avatar/host';

// STAGE_V: bump with every change to the stage files (app-stage.html imports them with the same ?v=), phones cache them.
const STAGE_V = 11;
export const AVATAR_STAGE_URL = `${AVATAR_HOST}/app-stage.html?v=${STAGE_V}`;

// The app has more than one stage (Games, Me) and iOS keeps only the one on screen alive: the other's page reloads
// when it comes back. A picture of each stage (by look, framing and avatar) covers it until the page is drawing again.
const pictures = new Map<string, string>();

interface AvatarStageProps {
  avatar: AvatarRecord | null;
  anim?: string;
  focus?: Focus;
  style?: ViewStyle;
  onStats?: (s: { tris: number; meshes: number }) => void;
  /** Take a headshot once this look is on the stage (the profile picture). */
  headshotOf?: AvatarRecord | null;
  onHeadshot?: (png: string, of: AvatarRecord) => void;
  /** 'dark': a purple glow, no room (the Me screen) */
  look?: 'dark';
  /** Look only: the 3D view takes no touches (behind other controls, e.g. the Games screen). */
  passive?: boolean;
}

export const AvatarStage: React.FC<AvatarStageProps> = ({ avatar, anim, focus = 'body', style, onStats, headshotOf, onHeadshot, look, passive }) => {
  const shotAsked = useRef<string | null>(null);
  const bg = look === 'dark' ? '#0d0a16' : '#dce2e8';
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);   // the page is drawing what it's been sent
  const pictureKey = `${look}|${focus}|${JSON.stringify(avatar)}`;
  const picture = pictures.get(pictureKey);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const snapKey = useRef<string | null>(null);
  const latest = useRef({ avatar, anim, focus, headshotOf });
  latest.current = { avatar, anim, focus, headshotOf };

  const send = (m: object) => ref.current?.postMessage(JSON.stringify(m));
  // the page says READY on every (re)load: hand it everything it should be showing
  const sync = () => {
    const l = latest.current;
    if (l.avatar) send({ type: 'SET', avatar: l.avatar });
    if (l.anim) send({ type: 'ANIM', name: l.anim });
    send({ type: 'FOCUS', part: l.focus });
  };

  useEffect(() => { if (ready && avatar) send({ type: 'SET', avatar }); }, [ready, avatar]);
  useEffect(() => { if (ready && anim) send({ type: 'ANIM', name: anim }); }, [ready, anim]);
  useEffect(() => { if (ready) send({ type: 'FOCUS', part: focus }); }, [ready, focus]);
  // asked for a headshot of the look already on stage
  useEffect(() => {
    const key = headshotOf && JSON.stringify(headshotOf);
    if (ready && !loading && key && avatar && JSON.stringify(avatar) === key && shotAsked.current !== key) { shotAsked.current = key; send({ type: 'HEADSHOT' }); }
  }, [ready, loading, headshotOf, avatar]);

  return (
    <View style={[styles.container, { backgroundColor: bg }, style]} pointerEvents={passive ? 'none' : 'auto'}>
      <WebView
        ref={ref}
        source={{ uri: AVATAR_STAGE_URL + (look ? `&look=${look}` : '') }}
        style={[styles.webView, { backgroundColor: bg }]}
        scrollEnabled={false}
        bounces={false}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        onMessage={(e) => {
          let m: any;
          try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
          if (m.type === 'READY') { setReady(true); sync(); }
          if (m.type === 'LOADED') {
            setLoading(false); setError(null); onStats?.(m.stats);
            // a few frames to draw before the picture goes; once settled, picture it for the next reload
            const pk = `${look}|${latest.current.focus}|${JSON.stringify(latest.current.avatar)}`;
            timers.current.push(setTimeout(() => setLive(true), 250));
            if (!pictures.has(pk)) timers.current.push(setTimeout(() => { snapKey.current = pk; send({ type: 'SNAPSHOT' }); }, 1500));
            // the look asked for is the one on stage: picture it (once per look)
            const { avatar: a, headshotOf: h } = latest.current, key = h && JSON.stringify(h);
            if (key && a && JSON.stringify(a) === key && shotAsked.current !== key) { shotAsked.current = key; send({ type: 'HEADSHOT' }); }
          }
          if (m.type === 'SNAPSHOT' && m.jpg && snapKey.current) pictures.set(snapKey.current, m.jpg);
          if (m.type === 'HEADSHOT' && m.png && latest.current.headshotOf) onHeadshot?.(m.png, latest.current.headshotOf);
          if (m.type === 'ERROR') { console.warn('[AvatarStage]', m.msg); setError(m.msg); }
        }}
        onError={(e) => setError(e.nativeEvent.description)}
        onLoadStart={() => setLive(false)}
        // iOS drops a backgrounded WebView's page to save memory: bring it back (it says READY again, sync() refills it)
        onContentProcessDidTerminate={() => { setReady(false); setLive(false); ref.current?.reload(); }}
      />
      {!live && picture ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none"><Image source={{ uri: picture }} style={StyleSheet.absoluteFill} resizeMode="cover" /></View>
      ) : loading && (
        <View style={[styles.overlay, { backgroundColor: bg }]} pointerEvents="none">
          {error ? <Text style={styles.errorText}>Avatar couldn't load</Text> : <ActivityIndicator size="small" color="#A855F7" />}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#dce2e8', overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: '#dce2e8' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dce2e8' },
  errorText: { color: '#475569', fontSize: 13, fontWeight: '600' },
});
