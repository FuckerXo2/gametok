// Signing up and in (mockup: logo/mocks-onboarding-a2.html). One question per screen, the avatar on screen throughout:
//   Welcome (our real games behind the Pixil star) -> Male or female -> Pick your look -> Name -> Birthday -> Password
//   -> You're in (Let's go: into the app).  Sign In: username and password.
// The looks offered are the ones every new account owns: the two starter outfits (the backend gifts both on sign-up:
// gametok-backend avatar-router.js STARTER_GIFT) and the free summer set; anything else would be refused on save.
// No email (Roblox doesn't ask for one either) and no Apple / Google.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ImageBackground, Image, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { auth as authApi } from '../services/api';
import { randomStarter, type AvatarRecord } from '../avatar/catalog';
import { AVATAR_V2 } from '../avatar/v2';
import { saveAvatar } from '../avatar/store';
import { PixilStar } from './PixilStar';
import Svg, { Ellipse, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

const BG = '#000', FIELD = '#181a1c', LINE = 'rgba(255,255,255,0.14)', DIM = 'rgba(255,255,255,0.55)', OK = '#22c55e';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const USERNAME_RULE = /^(?=.{3,20}$)[A-Za-z0-9]+(_[A-Za-z0-9]+)?$/;   // the backend's (src/index.js)
const STAR_COLS = ['#ff2e3f', '#ff8a1a', '#ffd60a', '#12c95a', '#1f7bff', '#a133ff'];
// Spectrum (logo/mocks-theme-identity.png, C with B's buttons): each step lights the next colour of the star.
// c: the colour; hi: the button's lit top; lip: its dark underside; ink: the label on it
type Hue = { c: string; hi: string; lip: string; ink: string };
const HUES: Hue[] = [
  { c: '#ff2e3f', hi: '#ff6a24', lip: '#9c1222', ink: '#fff' },
  { c: '#ff8a1a', hi: '#ffb021', lip: '#a4400a', ink: '#fff' },
  { c: '#ffd60a', hi: '#fff04a', lip: '#a07f00', ink: '#1a1400' },
  { c: '#12c95a', hi: '#6ee03a', lip: '#0a7a36', ink: '#fff' },
  { c: '#1f7bff', hi: '#2fb0ff', lip: '#0f45a0', ink: '#fff' },
  { c: '#a133ff', hi: '#d24dff', lip: '#5e1a9e', ink: '#fff' },
];

type Body = 'Male' | 'Female';
type LookId = 'bomber' | 'puffer' | 'summer';
// what each look wears (Synty catalog ids, games/avatar-editor/assets/sidekick/catalog.json)
const LOOKS: Record<LookId, { name: string; wear: { top: string; bottom: string; shoes: string } }> = {
  bomber: { name: 'Bomber', wear: { top: 'bomber', bottom: 'cargos', shoes: 'boots' } },
  puffer: { name: 'Puffer', wear: { top: 'puffer', bottom: 'joggers', shoes: 'boots' } },
  summer: { name: 'Summer', wear: { top: 'summer-tank', bottom: 'summer-shorts', shoes: 'summer-slides' } },
};
const STARTER: Record<Body, LookId> = { Male: 'bomber', Female: 'puffer' };
// the avatar in each look, pre-rendered from the real Synty avatar (logo/render_looks.mjs)
const AV: Record<Body, Record<LookId, any>> = {
  Male: { bomber: require('../../assets/onboarding/av_m_bomber.png'), puffer: require('../../assets/onboarding/av_m_puffer.png'), summer: require('../../assets/onboarding/av_m_summer.png') },
  Female: { bomber: require('../../assets/onboarding/av_f_bomber.png'), puffer: require('../../assets/onboarding/av_f_puffer.png'), summer: require('../../assets/onboarding/av_f_summer.png') },
};
const AV_RATIO = 0.43;   // the pictures' width / height

type Step = 'welcome' | 'body' | 'look' | 'name' | 'birthday' | 'password' | 'done' | 'signin';
const STEPS: Step[] = ['body', 'look', 'name', 'birthday', 'password'];   // the ones with the progress bar

const Logo: React.FC = () => {
  const scale = useSharedValue(0.9), opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(150, withSpring(1, { damping: 12, stiffness: 100 }));
    opacity.value = withDelay(150, withTiming(1, { duration: 500 }));
  }, []);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <Animated.View style={[{ alignItems: 'center' }, anim]}>
      <PixilStar size={84} />
      <Text style={styles.word}>PIXIL</Text>
      <Text style={styles.tagline}>Games you play with your friends</Text>
    </Animated.View>
  );
};

export const OnboardingFlow: React.FC<{ onComplete: () => void; isAuthLoading?: boolean; skipIntro?: boolean; startWithLogin?: boolean }> = ({
  onComplete, startWithLogin = false,
}) => {
  const insets = useSafeAreaInsets();
  const { signup, login } = useAuth();
  const [step, setStep] = useState<Step>(startWithLogin ? 'signin' : 'welcome');
  const [body, setBody] = useState<Body | null>(null);
  const [look, setLook] = useState<LookId>('bomber');
  const now = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => now - i).reverse();
  const [bm, setBm] = useState(0), [bd, setBd] = useState(0), [by, setBy] = useState(years.indexOf(now - 13));
  const [username, setUsername] = useState('');
  const [free, setFree] = useState<boolean | null>(null);   // username not taken (null: not checked yet)
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // is the username free? (asked as you type, a moment after you stop)
  useEffect(() => {
    setFree(null);
    if (!USERNAME_RULE.test(username)) return;
    const t = setTimeout(() => { authApi.usernameAvailable(username).then((r) => setFree(r.available)).catch(() => {}); }, 350);
    return () => clearTimeout(t);
  }, [username]);

  const go = (s: Step) => { setError(''); setStep(s); };
  const pickBody = (b: Body) => { setBody(b); setLook(STARTER[b]); Haptics.selectionAsync(); };
  const days = new Date(years[by], bm + 1, 0).getDate();
  const nameOk = USERNAME_RULE.test(username) && free === true;
  const pwOk = password.length >= 8 && !password.toLowerCase().includes(username.toLowerCase());

  const finish = async () => {
    if (!pwOk || !body || busy) return;
    setBusy(true); setError('');
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      // the avatar they picked: on this phone now, uploaded to the new account when it syncs
      const rec = randomStarter(body) as AvatarRecord & { sk?: any };
      if (AVATAR_V2 && rec.sk) rec.sk = { ...rec.sk, wear: { ...rec.sk.wear, ...LOOKS[look].wear, hands: null, full: null } };
      saveAvatar(rec);
      await signup(username, password, `${years[by]}-${pad(bm + 1)}-${pad(Math.min(bd, days - 1) + 1)}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      go('done');
    } catch (e: any) {
      if (e?.code === 'USERNAME_TAKEN') { setFree(false); go('name'); }
      setError(e?.message || 'Could not create your account');
    } finally { setBusy(false); }
  };
  const signIn = async () => {
    if (!username || !password || busy) return;
    setBusy(true); setError('');
    try { await login(username.trim(), password); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onComplete(); }
    catch (e: any) { setError(e?.message || 'Could not sign in'); }
    finally { setBusy(false); }
  };

  const hue = HUES[STEP_HUE[step] ?? 0];
  const Button = ({ label, on = true, onPress }: { label: string; on?: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} disabled={!on || busy} style={({ pressed }) => [styles.button, { backgroundColor: hue.lip, shadowColor: hue.c },
      pressed && { paddingBottom: 2, marginTop: 3 }, !on && { opacity: 0.4 }]}>
      <LinearGradient colors={[hue.hi, hue.c]} style={styles.buttonFace}>
        {busy ? <ActivityIndicator color={hue.ink} /> : <Text style={[styles.buttonText, { color: hue.ink }, hue.ink === '#fff' && styles.buttonShade]}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
  const Avatar = ({ h, tag }: { h: number; tag?: string }) => body ? (
    <View style={{ alignItems: 'center', marginTop: 14 }}>
      {tag ? <View style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View> : null}
      <Ring />
      <Image source={AV[body][look]} style={{ height: h, width: h * AV_RATIO }} resizeMode="contain" />
    </View>
  ) : null;

  if (step === 'welcome') return (
    <View style={styles.root}>
      <ImageBackground source={require('../../assets/onboarding/welcome_bg.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover">
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)', '#000']} locations={[0, 0.3, 0.58, 0.75]} style={StyleSheet.absoluteFill} />
      </ImageBackground>
      <View style={[styles.welcomeLogo, { bottom: insets.bottom + 170 }]}><Logo /></View>
      <View style={[styles.welcomeBottom, { paddingBottom: insets.bottom + 18 }]}>
        <Button label="Get started" onPress={() => go('body')} />
        <Pressable onPress={() => go('signin')} hitSlop={8} style={{ paddingVertical: 10 }}>
          <Text style={styles.secondary}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );

  if (step === 'signin') return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => go('welcome')} hitSlop={12}><Ionicons name="close" size={26} color="#fff" /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.q}>Welcome back</Text>
        <Text style={styles.label}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
          placeholder="Username" placeholderTextColor={DIM} textContentType="username" autoComplete="username" />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password"
          placeholderTextColor={DIM} textContentType="password" autoComplete="password" onSubmitEditing={signIn} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ marginTop: 24 }}><Button label="Sign In" on={!!username && !!password} onPress={signIn} /></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (step === 'body') return (
    <Screen step={step} topInset={insets.top} bottomInset={insets.bottom} error={error} onBack={go} title="Male or female?" sub="Your avatar's body. You can change it later in Me."
      button={<Button label="Next" on={!!body} onPress={() => go('look')} />}>
      <View style={styles.cards}>
        {(['Male', 'Female'] as const).map((b) => (
          <Pressable key={b} onPress={() => pickBody(b)} style={styles.card}>
            {body === b ? <LinearGradient colors={RAINBOW} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
            <View style={styles.cardIn}>
              {body === b ? <View style={[styles.tick, { backgroundColor: hue.c }]}><Ionicons name="checkmark" size={14} color={hue.ink} /></View> : null}
              <Image source={AV[b][STARTER[b]]} style={{ height: 250, width: 250 * AV_RATIO, marginTop: 8 }} resizeMode="contain" />
              <Text style={styles.cardText}>{b}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );

  if (step === 'look' && body) return (
    <Screen step={step} topInset={insets.top} bottomInset={insets.bottom} error={error} onBack={go} title="Pick your look" sub="More in the Shop later" button={<Button label="This is me" onPress={() => go('name')} />}>
      <Avatar h={330} />
      <View style={styles.looks}>
        {(Object.keys(LOOKS) as LookId[]).map((l) => (
          <Pressable key={l} onPress={() => { setLook(l); Haptics.selectionAsync(); }} style={[styles.lookChip, look === l && { borderColor: hue.c }]}>
            <Image source={AV[body][l]} style={{ height: 120, width: 120 * AV_RATIO, marginTop: 4 }} resizeMode="contain" />
            <Text style={styles.lookName}>{LOOKS[l].name}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );

  if (step === 'name') return (
    <Screen step={step} topInset={insets.top} bottomInset={insets.bottom} error={error} onBack={go} title="Name your player" sub="Don't use your real name" button={<Button label="Next" on={nameOk} onPress={() => go('birthday')} />}>
      <Avatar h={200} tag={username || 'your_name'} />
      <View style={[styles.field, username ? { borderColor: nameOk ? hue.c : free === false ? '#f87171' : LINE } : null]}>
        <TextInput style={styles.fieldInput} value={username} onChangeText={(t) => setUsername(t.trim())} autoCapitalize="none" autoCorrect={false}
          placeholder="Username" placeholderTextColor={DIM} textContentType="username" maxLength={20} autoFocus />
        {nameOk ? <Text style={styles.free}>✓ Free</Text> : free === false ? <Text style={styles.taken}>Taken</Text> : null}
      </View>
      <Text style={styles.hint}>3–20 letters or numbers, one _ allowed</Text>
    </Screen>
  );

  if (step === 'birthday') return (
    <Screen step={step} topInset={insets.top} bottomInset={insets.bottom} error={error} onBack={go} title="When's your birthday?" sub="Keeps Pixil safe for younger players. Never shown to anyone."
      button={<Button label="Next" onPress={() => go('password')} />}>
      <View style={styles.wheels}>
        <View pointerEvents="none" style={styles.wheelBand} />
        <Column items={MONTHS} index={bm} onChange={setBm} />
        <Column items={Array.from({ length: 31 }, (_, i) => String(i + 1))} index={Math.min(bd, days - 1)} onChange={setBd} />
        <Column items={years.map(String)} index={by} onChange={setBy} />
      </View>
    </Screen>
  );

  if (step === 'password') return (
    <Screen step={step} topInset={insets.top} bottomInset={insets.bottom} error={error} onBack={go} title={`Lock it in, ${username}`} sub="Pick a password for your account"
      button={<>
        <Button label="Create my account" on={pwOk} onPress={finish} />
        <Text style={styles.fine}>
          By continuing you agree to the{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://gametok.co/terms.html')}>Terms of Use</Text> and{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('https://gametok.co/privacy.html')}>Privacy Policy</Text>.
          If you are under 18, your parent or guardian permits you to create this account.
        </Text>
      </>}>
      <View style={[styles.field, { marginTop: 28 }, password ? { borderColor: pwOk ? hue.c : LINE } : null]}>
        <TextInput style={styles.fieldInput} value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoFocus
          placeholder="Password" placeholderTextColor={DIM} textContentType="newPassword" autoComplete="password-new" onSubmitEditing={finish} />
        <Pressable onPress={() => setShowPw(!showPw)} hitSlop={8}><Text style={styles.show}>{showPw ? 'Hide' : 'Show'}</Text></Pressable>
      </View>
      <Text style={[styles.hint, { color: password.length >= 8 ? OK : DIM }]}>
        {password.length >= 8 ? '✓' : '•'} 8+ characters   {password && !password.toLowerCase().includes(username.toLowerCase()) ? '✓' : '•'} Not your username
      </Text>
    </Screen>
  );

  // You're in
  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <Confetti />
      <Text style={[styles.q, { textAlign: 'center' }]}>You're in!</Text>
      <Text style={[styles.qSub, { textAlign: 'center' }]}>Welcome to Pixil, {username}</Text>
      <Avatar h={330} tag={username} />
      <View style={[styles.bottom, { position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 16 }]}>
        <Button label="Let's go" onPress={onComplete} />
      </View>
    </View>
  );
};

// a question screen: back + progress, the question, its content, and the button pinned at the bottom (outside the
// flow, so typing doesn't rebuild it and drop the keyboard)
const Screen = ({ step, topInset, bottomInset, error, onBack, title, sub, children, button }: {
  step: Step; topInset: number; bottomInset: number; error: string; onBack: (s: Step) => void;
  title: string; sub?: string; children?: React.ReactNode; button: React.ReactNode;
}) => {
  const i = STEPS.indexOf(step);
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: topInset + 10 }]}>
        <Pressable onPress={() => onBack(i <= 0 ? 'welcome' : STEPS[i - 1])} hitSlop={12} style={{ width: 28 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <View style={styles.bar}>
          <LinearGradient colors={BAR_COLS} locations={BAR_AT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.barRest, { left: `${((i + 1) / STEPS.length) * 100}%` }]} />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" bounces={false}>
        <Text style={styles.q}>{title}</Text>
        {sub ? <Text style={styles.qSub}>{sub}</Text> : null}
        {children}
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: bottomInset + 16 }]}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {button}
      </View>
    </KeyboardAvoidingView>
  );
};

// which colour each screen wears (the progress bar shows the question steps' colours in order)
const STEP_HUE: Partial<Record<Step, number>> = { welcome: 0, body: 1, look: 2, name: 3, birthday: 4, password: 5, done: 0, signin: 4 };
const BAR_COLS = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5].map((h) => HUES[h].c) as unknown as Grad;
type Grad = readonly [string, string, ...string[]];
const RAINBOW = STAR_COLS as unknown as Grad;
const BAR_AT: [number, number, ...number[]] = [0, 0.2, 0.2, 0.4, 0.4, 0.6, 0.6, 0.8, 0.8, 1];
// the rainbow ring the avatar stands on
const Ring = () => (
  <Svg width={180} height={40} style={{ position: 'absolute', bottom: -10 }}>
    <Defs>
      <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="0">
        {STAR_COLS.map((c, i) => <Stop key={c} offset={i / (STAR_COLS.length - 1)} stopColor={c} />)}
      </SvgGradient>
    </Defs>
    <Ellipse cx={90} cy={20} rx={84} ry={15} fill="none" stroke="url(#ring)" strokeWidth={5} />
  </Svg>
);

// small stars in the logo's colours, popping in round the new avatar
const Confetti = () => {
  const spots: [number, number, number][] = [[8, 22, 22], [84, 14, 16], [4, 52, 14], [88, 44, 24], [14, 74, 12], [82, 70, 14], [48, 4, 12], [94, 28, 10], [2, 34, 10]];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {spots.map(([x, y, s], i) => <Pop key={i} x={x} y={y} s={s} delay={i * 70} color={STAR_COLS[i % STAR_COLS.length]} />)}
    </View>
  );
};
const Pop = ({ x, y, s, delay, color }: { x: number; y: number; s: number; delay: number; color: string }) => {
  const v = useSharedValue(0);
  useEffect(() => { v.value = withDelay(delay, withSpring(1, { damping: 8, stiffness: 120 })); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: v.value }], opacity: v.value }));
  return (
    <Animated.View style={[{ position: 'absolute', left: `${x}%`, top: `${y}%` }, a]}>
      <Ionicons name="star" size={s} color={color} />
    </Animated.View>
  );
};

// a wheel column: month / day / year
const ROW = 40;
const Column = ({ items, index, onChange }: { items: string[]; index: number; onChange: (i: number) => void }) => {
  const ref = useRef<ScrollView>(null);
  useEffect(() => { ref.current?.scrollTo({ y: index * ROW, animated: false }); }, []);
  return (
    <View style={{ flex: 1, height: ROW * 5 }}>
      <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={ROW} decelerationRate="fast" nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ROW * 2 }}
        onMomentumScrollEnd={(e) => onChange(Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ROW))))}>
        {items.map((t, i) => (
          <View key={t + i} style={{ height: ROW, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: i === index ? '#fff' : DIM, fontSize: i === index ? 19 : 16, fontWeight: i === index ? '800' : '500' }}>{t}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  word: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 1.5, marginTop: 6 },
  tagline: { color: '#c9ccd2', fontSize: 15, marginTop: 4 },
  welcomeLogo: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  welcomeBottom: { position: 'absolute', left: 20, right: 20, bottom: 0, alignItems: 'stretch' },
  secondary: { color: '#c9ccd2', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  bar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barRest: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: '#1e1e24' },
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  q: { color: '#fff', fontSize: 27, fontWeight: '800' },
  qSub: { color: DIM, fontSize: 14, marginTop: 6 },
  bottom: { paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  button: { borderRadius: 18, paddingBottom: 5, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  buttonFace: { borderRadius: 18, height: 54, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 17, fontWeight: '800' },
  buttonShade: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  cards: { flexDirection: 'row', gap: 10, marginTop: 22 },
  card: { flex: 1, height: 300, borderRadius: 20, backgroundColor: '#1f1f26', overflow: 'hidden' },
  cardIn: { position: 'absolute', top: 2.5, left: 2.5, right: 2.5, bottom: 2.5, borderRadius: 18, backgroundColor: '#101014', alignItems: 'center', overflow: 'hidden' },
  cardText: { color: '#fff', fontSize: 17, fontWeight: '800', position: 'absolute', bottom: 12 },
  tick: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  tag: { backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginBottom: 8 },
  tagText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  looks: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 22 },
  lookChip: { width: 88, height: 152, borderRadius: 14, backgroundColor: '#121216', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  lookName: { color: '#c9ccd2', fontSize: 12, fontWeight: '700', position: 'absolute', bottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: FIELD, borderRadius: 14, borderWidth: 2, borderColor: LINE, paddingHorizontal: 14, marginTop: 22 },
  fieldInput: { flex: 1, height: 52, color: '#fff', fontSize: 18 },
  free: { color: OK, fontWeight: '800', fontSize: 15 },
  taken: { color: '#f87171', fontWeight: '800', fontSize: 15 },
  show: { color: DIM, fontWeight: '700', fontSize: 14 },
  hint: { color: DIM, fontSize: 13, marginTop: 8 },
  wheels: { flexDirection: 'row', marginTop: 40 },
  wheelBand: { position: 'absolute', left: 0, right: 0, top: ROW * 2, height: ROW, borderRadius: 12, backgroundColor: '#1d2024' },
  label: { color: DIM, fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  input: { backgroundColor: FIELD, borderRadius: 10, height: 48, paddingHorizontal: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: LINE },
  error: { color: '#f87171', fontSize: 14 },
  fine: { color: '#7a7f88', fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  link: { color: '#c9ccd2', fontWeight: '700', textDecorationLine: 'underline' },
});

export default OnboardingFlow;
