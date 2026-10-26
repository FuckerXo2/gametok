// Signing up and in, like Roblox: two short screens, then straight into Games (the avatar, Shop and the rest come
// later, in Me: people want a better look once they've seen other players in a game).
//   Create Account: birthday, username (checked as you type).
//   Your avatar: build, skin, face, hair and clothes, from the free starter items only (the Shop is in Me).
//   Password: "Hi <username>", then you're in.
//   Sign In: username and password.
// No email (Roblox doesn't ask for one either) and no Apple / Google.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ImageBackground, Modal, ScrollView, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, Linking, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText, Rect, G, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { auth as authApi } from '../services/api';
import { AvatarStage } from './AvatarStage';
import { AVATAR_ITEMS, AvatarItem, DEFAULT_AVATAR, Focus, thumbOf } from '../avatar/catalog';
import { saveAvatar, syncAvatar, useAvatar } from '../avatar/store';

const BG = '#0d0a16', FIELD = '#1b1626', LINE = 'rgba(255,255,255,0.14)', DIM = 'rgba(255,255,255,0.55)', ACCENT = '#a855f7', OK = '#22c55e';
const H = Dimensions.get('window').height;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const USERNAME_RULE = /^(?=.{3,20}$)[A-Za-z0-9]+(_[A-Za-z0-9]+)?$/;   // the backend's (src/index.js)

const GameTokLogo: React.FC = () => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
    opacity.value = withDelay(200, withTiming(1, { duration: 600 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.logoWrapper, animStyle]}>
      <Svg width={280} height={120} viewBox="0 0 280 120">
        <Defs>
          <SvgGradient id="gameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FF6B6B" />
            <Stop offset="50%" stopColor="#FF8E53" />
            <Stop offset="100%" stopColor="#FFC107" />
          </SvgGradient>
          <SvgGradient id="tokGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4ECDC4" />
            <Stop offset="50%" stopColor="#44A08D" />
            <Stop offset="100%" stopColor="#093028" />
          </SvgGradient>
          <SvgGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#4ECDC4" stopOpacity="0.8" />
          </SvgGradient>
        </Defs>
        <G transform="translate(10, 35)">
          <Rect x="0" y="15" width="50" height="30" rx="8" fill="url(#gameGrad)" />
          <Rect x="8" y="24" width="12" height="4" rx="1" fill="#fff" opacity="0.9" />
          <Rect x="12" y="20" width="4" height="12" rx="1" fill="#fff" opacity="0.9" />
          <Circle cx="38" cy="26" r="3" fill="#fff" opacity="0.9" />
          <Circle cx="44" cy="32" r="3" fill="#fff" opacity="0.9" />
          <Circle cx="15" cy="38" r="5" fill="#222" />
          <Circle cx="35" cy="38" r="5" fill="#222" />
        </G>
        <SvgText x="70" y="70" fontSize="48" fontWeight="900" fill="url(#gameGrad)" fontFamily="System">GAME</SvgText>
        <SvgText x="195" y="70" fontSize="48" fontWeight="900" fill="url(#tokGrad)" fontFamily="System">TOK</SvgText>
        <Rect x="70" y="80" width="195" height="4" rx="2" fill="url(#glowGrad)" />
      </Svg>
    </Animated.View>
  );
};


type Step = 'welcome' | 'create' | 'avatar' | 'password' | 'signin';

export const OnboardingFlow: React.FC<{ onComplete: () => void; isAuthLoading?: boolean; skipIntro?: boolean; startWithLogin?: boolean }> = ({
  onComplete, startWithLogin = false,
}) => {
  const insets = useSafeAreaInsets();
  const { signup, login } = useAuth();
  const [step, setStep] = useState<Step>(startWithLogin ? 'signin' : 'welcome');
  const [birthday, setBirthday] = useState<{ y: number; m: number; d: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [username, setUsername] = useState('');
  const [free, setFree] = useState<boolean | null>(null);   // username not taken (null: not checked yet)
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const look = useAvatar() ?? DEFAULT_AVATAR;

  // is the username free? (asked as you type, a moment after you stop)
  useEffect(() => {
    setFree(null);
    if (!USERNAME_RULE.test(username)) return;
    const t = setTimeout(() => { authApi.usernameAvailable(username).then((r) => setFree(r.available)).catch(() => {}); }, 350);
    return () => clearTimeout(t);
  }, [username]);

  const go = (s: Step) => { setError(''); setStep(s); };
  const age = birthday ? Math.floor((Date.now() - new Date(birthday.y, birthday.m, birthday.d).getTime()) / 31557600000) : null;
  const rules = [
    { ok: username.length >= 3 && username.length <= 20, text: 'Is between 3 and 20 characters long' },
    { ok: /^[A-Za-z0-9_]*$/.test(username) && USERNAME_RULE.test(username), text: 'Contains only letters, numbers, and one _ in the middle' },
    { ok: free === true, text: 'Is not already in use' },
  ];
  const pwRules = [
    { ok: password.length >= 8, text: 'Is at least 8 characters long' },
    { ok: !!password && !password.toLowerCase().includes(username.toLowerCase()), text: 'Doesn’t contain your username' },
  ];
  const canContinue = !!birthday && rules.every((r) => r.ok);
  const canFinish = pwRules.every((r) => r.ok);

  const finish = async () => {
    if (!canFinish || !birthday || busy) return;
    setBusy(true); setError('');
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      await signup(username, password, `${birthday.y}-${pad(birthday.m + 1)}-${pad(birthday.d)}`);
      await syncAvatar();   // the avatar you made here goes on the new account
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch (e: any) {
      if (e?.code === 'USERNAME_TAKEN') { setFree(false); go('create'); }
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

  const Rules = ({ list, show }: { list: { ok: boolean; text: string }[]; show: boolean }) => show ? (
    <View style={{ marginTop: 8, gap: 3 }}>
      {list.map((r) => (
        <View key={r.text} style={styles.rule}>
          <Ionicons name={r.ok ? 'checkmark' : 'ellipse-outline'} size={r.ok ? 14 : 8} color={r.ok ? OK : DIM} style={{ width: 16 }} />
          <Text style={[styles.ruleText, r.ok && { color: '#fff' }]}>{r.text}</Text>
        </View>
      ))}
    </View>
  ) : null;
  const Header = ({ title, back }: { title: string; back: Step }) => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => go(back)} hitSlop={12} style={styles.headerX}><Ionicons name={back === 'welcome' ? 'close' : 'chevron-back'} size={26} color="#fff" /></Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerX} />
    </View>
  );
  const Button = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} disabled={!on || busy} style={[styles.button, !on && { opacity: 0.4 }]}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
  const Terms = () => (
    <Text style={styles.fine}>
      By clicking Continue, you agree to our{' '}
      <Text style={styles.link} onPress={() => Linking.openURL('https://gametok.co/terms.html')}>Terms of Use</Text> and{' '}
      <Text style={styles.link} onPress={() => Linking.openURL('https://gametok.co/privacy.html')}>Privacy Policy</Text>.
      If you are under 18, you agree that your parent or guardian permits you to create this account.
    </Text>
  );

  if (step === 'welcome') return (
    <View style={styles.root}>
      <ImageBackground source={require('../../assets/gametok_bg.png')} style={StyleSheet.absoluteFill} resizeMode="cover">
        <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.88)', '#000']} locations={[0, 0.3, 0.6, 0.85]} style={StyleSheet.absoluteFill} />
      </ImageBackground>
      <View style={{ position: 'absolute', top: insets.top + 60, left: 0, right: 0, alignItems: 'center' }}><GameTokLogo /></View>
      <View style={[styles.welcomeBottom, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={styles.welcomePrimary} onPress={() => go('create')}><Text style={styles.welcomePrimaryText}>Create Account</Text></Pressable>
        <Pressable style={styles.welcomeSecondary} onPress={() => go('signin')}><Text style={styles.buttonText}>Sign In</Text></Pressable>
        <View style={styles.welcomeLinks}>
          <Text style={styles.link} onPress={() => Linking.openURL('https://gametok.co/terms.html')}>Terms</Text>
          <Text style={styles.link} onPress={() => Linking.openURL('https://gametok.co/privacy.html')}>Privacy</Text>
        </View>
      </View>
    </View>
  );

  if (step === 'signin') return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Sign In" back="welcome" />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
          placeholder="Username" placeholderTextColor={DIM} textContentType="username" autoComplete="username" />
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password"
          placeholderTextColor={DIM} textContentType="password" autoComplete="password" onSubmitEditing={signIn} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Sign In" on={!!username && !!password} onPress={signIn} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (step === 'password') return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Create Account" back="avatar" />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.hi}>Hi {username}</Text>
        <Text style={styles.sub}>Choose a password to secure your account.</Text>
        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoFocus
          placeholder="Password" placeholderTextColor={DIM} textContentType="newPassword" autoComplete="password-new" onSubmitEditing={finish} />
        <Rules list={pwRules} show />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Done" on={canFinish} onPress={finish} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (step === 'avatar') return <AvatarStep look={look} onBack={() => go('create')} onDone={() => go('password')} />;

  // Create Account
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Create Account" back="welcome" />
      <ScrollView contentContainerStyle={[styles.form, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Birthday{age !== null ? ` (${age} years old)` : ''}</Text>
        <Pressable style={[styles.input, styles.dateField]} onPress={() => setPicking(true)}>
          <Text style={{ color: birthday ? '#fff' : DIM, fontSize: 16 }}>{birthday ? `${MONTHS[birthday.m]} ${birthday.d} ${birthday.y}` : 'Date'}</Text>
          <Ionicons name="calendar-outline" size={18} color={DIM} />
        </Pressable>
        <Text style={styles.label}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={(t) => setUsername(t.trim())} autoCapitalize="none" autoCorrect={false}
          placeholder="Don't use your real name" placeholderTextColor={DIM} textContentType="username" maxLength={20} />
        <Rules list={rules} show={!!username} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Continue" on={canContinue} onPress={() => go('avatar')} />
        <Terms />
      </ScrollView>
      <BirthdayPicker visible={picking} value={birthday} onClose={() => setPicking(false)} onPick={(v) => { setBirthday(v); setPicking(false); }} />
    </KeyboardAvoidingView>
  );
};

// The sign-up avatar creator: the avatar big, rows of the free starter items under it (tap one, it's on).
const FREE_ROWS: { title: string; pick: (i: AvatarItem) => boolean }[] = [
  { title: 'Build', pick: (i) => i.sub === 'Build' },
  { title: 'Skin', pick: (i) => i.sub === 'Skin' },
  { title: 'Face', pick: (i) => i.sub === 'Face' },
  { title: 'Hair', pick: (i) => i.sub === 'Hair' },
  { title: 'Top', pick: (i) => i.sub === 'T-Shirts' },
  { title: 'Bottoms', pick: (i) => i.sub === 'Pants' || i.sub === 'Shorts' },
  { title: 'Shoes', pick: (i) => i.sub === 'Shoes' },
];
const AvatarStep = ({ look, onBack, onDone }: { look: typeof DEFAULT_AVATAR; onBack: () => void; onDone: () => void }) => {
  const insets = useSafeAreaInsets();
  const [focus, setFocus] = useState<Focus>('body');
  const wear = (i: AvatarItem) => {
    if (!i.wear) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFocus(i.focus);
    saveAvatar(i.wear(look));
  };
  return (
    <View style={styles.root}>
      <View style={{ height: H * 0.42 }}>
        <AvatarStage style={StyleSheet.absoluteFill} avatar={look} focus={focus} look="dark" />
        <View style={[styles.header, { position: 'absolute', left: 0, right: 0, top: 0, paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.headerX}><Ionicons name="chevron-back" size={26} color="#fff" /></Pressable>
          <Text style={styles.headerTitle}>Make your avatar</Text>
          <View style={styles.headerX} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {FREE_ROWS.map((row) => {
          const items = AVATAR_ITEMS.filter((i) => i.price === 0 && !i.pieces && row.pick(i));
          return (
            <View key={row.title}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
                {items.map((i) => {
                  const on = !!i.isWorn?.(look), pic = thumbOf(i, look.body);
                  return (
                    <Pressable key={i.id} onPress={() => wear(i)} style={[styles.pick, on && styles.pickOn]}>
                      {pic ? <Image source={{ uri: pic }} style={styles.pickPic} resizeMode="contain" />
                        : <View style={[styles.skinDot, { backgroundColor: i.tint }]} />}
                      <Text style={styles.pickName} numberOfLines={1}>{i.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
        <Text style={[styles.fine, { marginHorizontal: 24 }]}>More hair, clothes and outfits are in the Shop, in Me.</Text>
      </ScrollView>
      <View style={[styles.stepBottom, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={[styles.button, { marginTop: 0 }]} onPress={onDone}><Text style={styles.buttonText}>Continue</Text></Pressable>
      </View>
    </View>
  );
};

// Birthday, Roblox-style: a sheet with month / day / year columns and Confirm
const ROW = 40;
const Column = ({ items, index, onChange }: { items: string[]; index: number; onChange: (i: number) => void }) => {
  const ref = useRef<ScrollView>(null);
  useEffect(() => { ref.current?.scrollTo({ y: index * ROW, animated: false }); }, []);
  return (
    <View style={{ flex: 1, height: ROW * 5 }}>
      <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={ROW} decelerationRate="fast"
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
const BirthdayPicker = ({ visible, value, onClose, onPick }: {
  visible: boolean; value: { y: number; m: number; d: number } | null; onClose: () => void; onPick: (v: { y: number; m: number; d: number }) => void;
}) => {
  const insets = useSafeAreaInsets();
  const now = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => now - i).reverse();
  const [m, setM] = useState(value?.m ?? 0);
  const [d, setD] = useState((value?.d ?? 1) - 1);
  const [y, setY] = useState(years.indexOf(value?.y ?? now - 13));
  const days = new Date(years[y], m + 1, 0).getDate();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHead}>
          <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={24} color="#fff" /></Pressable>
          <Text style={styles.headerTitle}>Birthday</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
          <View pointerEvents="none" style={styles.wheelBand} />
          <Column items={MONTHS} index={m} onChange={setM} />
          <Column items={Array.from({ length: 31 }, (_, i) => String(i + 1))} index={Math.min(d, days - 1)} onChange={setD} />
          <Column items={years.map(String)} index={y} onChange={setY} />
        </View>
        <Pressable style={styles.confirm} onPress={() => onPick({ y: years[y], m, d: Math.min(d, days - 1) + 1 })}>
          <Text style={[styles.buttonText, { color: '#111' }]}>Confirm Birthday</Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  logoWrapper: { alignItems: 'center' },
  welcomeBottom: { position: 'absolute', left: 24, right: 24, bottom: 0, gap: 12 },
  welcomePrimary: { backgroundColor: '#fff', borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center' },
  welcomePrimaryText: { color: '#111', fontSize: 16, fontWeight: '800' },
  welcomeSecondary: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center' },
  welcomeLinks: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerX: { width: 32 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  form: { padding: 20, paddingBottom: 60 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 18, marginBottom: 10, marginHorizontal: 18 },
  pick: { width: 84, backgroundColor: FIELD, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', padding: 6, alignItems: 'center' },
  pickOn: { borderColor: ACCENT, backgroundColor: 'rgba(168,85,247,0.15)' },
  pickPic: { width: 68, height: 68 },
  pickName: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
  skinDot: { width: 52, height: 52, borderRadius: 26, margin: 8 },
  stepBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: BG },
  label: { color: DIM, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: FIELD, borderRadius: 10, height: 48, paddingHorizontal: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: LINE },
  dateField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rule: { flexDirection: 'row', alignItems: 'center' },
  ruleText: { color: DIM, fontSize: 12.5 },
  hi: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 8 },
  sub: { color: DIM, fontSize: 14, marginTop: 4 },
  button: { backgroundColor: ACCENT, borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  error: { color: '#f87171', fontSize: 14, marginTop: 12 },
  fine: { color: DIM, fontSize: 12, lineHeight: 17, marginTop: 14, textAlign: 'center' },
  link: { color: '#fff', fontWeight: '700', textDecorationLine: 'underline' },
  sheet: { backgroundColor: '#17121f', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  wheelBand: { position: 'absolute', left: 12, right: 12, top: ROW * 2, height: ROW, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  confirm: { backgroundColor: '#fff', borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', margin: 16 },
});

export default OnboardingFlow;
