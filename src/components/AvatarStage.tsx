// 3D avatar stage: the avatar-core page (games/avatar-editor/app-stage.html) in a WebView.
// The app owns the record and draws all the UI; the page only renders what it's sent.
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, DeviceEventEmitter, ActivityIndicator, ViewStyle, Text, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lookKey, type AvatarRecord, type Focus } from '../avatar/catalog';
import { AVATAR_HOST } from '../avatar/host';

// STAGE_V: bump with every change to the stage files (app-stage.html imports them with the same ?v=), phones cache them.
const STAGE_V = 24;
export const AVATAR_STAGE_URL = `${AVATAR_HOST}/app-stage.html?v=${STAGE_V}`;

// The app has more than one stage (Games, Me) and iOS keeps only the one on screen alive: the other's page reloads
// when it comes back. A picture of each stage (by look, framing and avatar) covers it until the page is drawing again.
// The pictures are kept on the phone too, so the avatar shows at once on the next app start (the 3D page takes a few
// seconds to boot), not a spinner.
const pictures = new Map<string, string>();
const PICTURES_KEY = 'avatarStagePictures2';   // (2: the first ones could be of the look that came next)
let picturesLoaded: Promise<void> | null = null;
const loadPictures = () => (picturesLoaded ??= AsyncStorage.getItem(PICTURES_KEY)
  .then((v) => { for (const [k, jpg] of JSON.parse(v || '[]')) if (!pictures.has(k)) pictures.set(k, jpg); })
  .catch(() => {}));
// the latest picture of this look on a stage (any framing, the full body first), for a saved look's tile
export function stagePicture(r: AvatarRecord): string | null {
  const tail = `|${JSON.stringify(r)}`;
  let any: string | null = null;
  for (const [k, jpg] of pictures) if (k.endsWith(tail)) { if (k.includes('|body|')) return jpg; any = jpg; }
  return any;
}
// the latest full-body picture of each body's own look (no character on): Customize > Avatars shows it on that
// body's tile (male and female each keep their own look)
const bodyPictures: Partial<Record<AvatarRecord['body'], { jpg: string; of: string }>> = {};
const BODY_PICTURES_KEY = 'avatarBodyPictures2';
AsyncStorage.getItem(BODY_PICTURES_KEY).then((v) => {
  // (kept before they said what look they're of: the picture, of no look in particular)
  const kept = Object.fromEntries(Object.entries(JSON.parse(v || '{}')).map(([b, p]: [string, any]) => [b, typeof p === 'string' ? { jpg: p, of: '' } : p]));
  Object.assign(bodyPictures, kept, { ...bodyPictures });
}).catch(() => {});
export const bodyPicture = (body: AvatarRecord['body']) => bodyPictures[body]?.jpg ?? null;
// ... and a picture of exactly this look, if that's the latest one taken
export const bodyPictureOf = (r: AvatarRecord) => (bodyPictures[r.body]?.of === lookKey(r) ? bodyPictures[r.body]!.jpg : null);
function savePicture(key: string, jpg: string) {
  const [, , focus, ...rest] = key.split('|');
  try {
    const r = JSON.parse(rest.join('|')) as AvatarRecord | null;
    if (r && focus === 'body' && !r.character) { bodyPictures[r.body] = { jpg, of: lookKey(r) }; AsyncStorage.setItem(BODY_PICTURES_KEY, JSON.stringify(bodyPictures)).catch(() => {}); }
  } catch {}
  pictures.delete(key); pictures.set(key, jpg);
  // the latest few looks (each picture is a small jpg)
  AsyncStorage.setItem(PICTURES_KEY, JSON.stringify([...pictures].slice(-4))).catch(() => {});
}

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
  look?: 'dark' | 'studio';
  /** Look only: the 3D view takes no touches (behind other controls, e.g. the Games screen). */
  passive?: boolean;
}

export const AvatarStage: React.FC<AvatarStageProps> = ({ avatar, anim, focus = 'body', style, onStats, headshotOf, onHeadshot, look, passive }) => {
  const shotAsked = useRef<string | null>(null);
  const bg = look === 'dark' ? '#0d0a16' : look === 'studio' ? '#dce2e8' : '#dce2e8';
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);   // the page is drawing what it's been sent
  const pictureKey = `${STAGE_V}|${look}|${focus}|${JSON.stringify(avatar)}`;
  const [, setPicturesReady] = useState(false);
  useEffect(() => { loadPictures().then(() => setPicturesReady(true)); }, []);
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
  useEffect(() => { const sub = DeviceEventEmitter.addListener('gametok:stage-reset', () => send({ type: 'RESET' })); return () => sub.remove(); }, []);
  // a new framing of the look on stage (the full body, say): picture that too, once it's settled
  useEffect(() => {
    if (!ready || loading || !avatar || pictures.has(pictureKey)) return;
    const pk = pictureKey, t = setTimeout(() => {
      if (`${STAGE_V}|${look}|${latest.current.focus}|${JSON.stringify(latest.current.avatar)}` === pk) { snapKey.current = pk; send({ type: 'SNAPSHOT' }); }
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, loading, pictureKey]);
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
            const pk = `${STAGE_V}|${look}|${latest.current.focus}|${JSON.stringify(latest.current.avatar)}`;
            timers.current.push(setTimeout(() => setLive(true), 250));
            // (only while that look is still the one on stage: one put on meanwhile would be pictured under this one's name)
            const now = () => `${STAGE_V}|${look}|${latest.current.focus}|${JSON.stringify(latest.current.avatar)}`;
            if (!pictures.has(pk)) timers.current.push(setTimeout(() => { if (now() === pk) { snapKey.current = pk; send({ type: 'SNAPSHOT' }); } }, 1500));
            else savePicture(pk, pictures.get(pk)!);   // (seen before: still the latest of its body)
            // the look asked for is the one on stage: picture it (once per look)
            const { avatar: a, headshotOf: h } = latest.current, key = h && JSON.stringify(h);
            if (key && a && JSON.stringify(a) === key && shotAsked.current !== key) { shotAsked.current = key; send({ type: 'HEADSHOT' }); }
          }
          if (m.type === 'SNAPSHOT' && m.jpg && snapKey.current === `${STAGE_V}|${look}|${latest.current.focus}|${JSON.stringify(latest.current.avatar)}`) savePicture(snapKey.current, m.jpg);
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
