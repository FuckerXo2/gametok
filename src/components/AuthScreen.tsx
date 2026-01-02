import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText, Rect, G, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'signup';

// GameTok SVG Logo Component
const GameTokLogo = ({ scale = 1 }: { scale?: number }) => (
  <Svg width={240 * scale} height={100 * scale} viewBox="0 0 280 120">
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
    <SvgText x="70" y="70" fontSize="48" fontWeight="900" fill="url(#gameGrad)" fontFamily="System">
      GAME
    </SvgText>
    <SvgText x="195" y="70" fontSize="48" fontWeight="900" fill="url(#tokGrad)" fontFamily="System">
      TOK
    </SvgText>
    <Rect x="70" y="80" width="195" height="4" rx="2" fill="url(#glowGrad)" />
  </Svg>
);

export const AuthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { login, signup, loginWithGoogle, loginWithApple } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (mode === 'signup' && !displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await signup(username.trim(), password, displayName.trim());
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    try {
      await loginWithGoogle?.();
    } catch (error: any) {
      if (error.message !== 'Sign in cancelled') {
        Alert.alert('Error', error.message || 'Google sign in failed');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    try {
      await loginWithApple?.();
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', error.message || 'Apple sign in failed');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* SVG Logo */}
        <View style={styles.logoContainer}>
          <GameTokLogo scale={0.9} />
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {mode === 'signup' && (
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Display Name"
              placeholderTextColor={colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
            />
          )}

          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'login' ? 'Log In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or continue with</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Social Sign In - Side by side */}
        <View style={styles.socialButtons}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleAppleSignIn}
              disabled={socialLoading !== null}
            >
              {socialLoading === 'apple' ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Ionicons name="logo-apple" size={24} color={colors.text} />
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleGoogleSignIn}
            disabled={socialLoading !== null}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Image 
                source={{ uri: 'https://www.google.com/favicon.ico' }} 
                style={styles.googleIcon}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Switch mode */}
        <View style={styles.switchContainer}>
          <Text style={[styles.switchText, { color: colors.textSecondary }]}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.switchLink}>
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={[styles.terms, { color: colors.textSecondary }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  form: {
    gap: 14,
  },
  input: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    borderWidth: 1,
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#FF6B6B',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 14,
    fontSize: 13,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 60,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  googleIcon: {
    width: 22,
    height: 22,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    gap: 6,
  },
  switchText: {
    fontSize: 14,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4ECDC4',
  },
  terms: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});
