// 3D avatar stage: the avatar-core page (games/avatar-editor/app-stage.html) in a WebView.
// The app owns the record and draws all the UI; the page only renders what it's sent.
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ViewStyle, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import type { AvatarRecord, Focus } from '../avatar/catalog';

// The stage on R2 (games/avatar-editor/tools/publish_stage.mjs). LOCAL_STAGE: while editing the stage itself, load it
// from the avatar-editor server on the Mac (launch config "avatar-editor") instead.
// STAGE_V: bump with every change to the stage files (app-stage.html imports them with the same ?v=), phones cache them.
const STAGE_V = 5;
const LOCAL_STAGE = false;
const DEV_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:8980' : 'http://localhost:8980';
export const AVATAR_STAGE_URL = (__DEV__ && LOCAL_STAGE
  ? `${DEV_HOST}/app-stage.html`
  : 'https://pub-b7694276c8f54290854b276638a93b62.r2.dev/web-games/avatar/app-stage.html') + `?v=${STAGE_V}`;

interface AvatarStageProps {
  avatar: AvatarRecord | null;
  anim?: string;
  focus?: Focus;
  style?: ViewStyle;
  onStats?: (s: { tris: number; meshes: number }) => void;
  /** Take a headshot once this look is on the stage (the profile picture). */
  headshotOf?: AvatarRecord | null;
  onHeadshot?: (png: string, of: AvatarRecord) => void;
}

export const AvatarStage: React.FC<AvatarStageProps> = ({ avatar, anim, focus = 'body', style, onStats, headshotOf, onHeadshot }) => {
  const shotAsked = useRef<string | null>(null);
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <View style={[styles.container, style]}>
      <WebView
        ref={ref}
        source={{ uri: AVATAR_STAGE_URL }}
        style={styles.webView}
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
            // the look asked for is the one on stage: picture it (once per look)
            const { avatar: a, headshotOf: h } = latest.current, key = h && JSON.stringify(h);
            if (key && a && JSON.stringify(a) === key && shotAsked.current !== key) { shotAsked.current = key; send({ type: 'HEADSHOT' }); }
          }
          if (m.type === 'HEADSHOT' && m.png && latest.current.headshotOf) onHeadshot?.(m.png, latest.current.headshotOf);
          if (m.type === 'ERROR') { console.warn('[AvatarStage]', m.msg); setError(m.msg); }
        }}
        onError={(e) => setError(e.nativeEvent.description)}
      />
      {loading && (
        <View style={styles.overlay} pointerEvents="none">
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
