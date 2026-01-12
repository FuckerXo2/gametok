import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  Image,
  ImageBackground,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText, Rect, G, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { users, auth as authApi } from '../services/api';
import { uploadImage } from '../services/cloudinary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingStep = 'welcome' | 'birthday' | 'credentials' | 'username' | 'profile' | 'interests';

const GAME_CATEGORIES = [
  { id: 'arcade', name: 'Arcade', icon: '👾', color: '#FF6B6B' },
  { id: 'puzzle', name: 'Puzzle', icon: '🧩', color: '#4ECDC4' },
  { id: 'action', name: 'Action', icon: '⚡', color: '#FFE66D' },
  { id: 'casual', name: 'Casual', icon: '🎯', color: '#95E1D3' },
  { id: 'strategy', name: 'Strategy', icon: '♟️', color: '#A66CFF' },
  { id: 'sports', name: 'Sports', icon: '⚽', color: '#FF9F43' },
  { id: 'racing', name: 'Racing', icon: '🏎️', color: '#EE5A24' },
  { id: 'retro', name: 'Retro', icon: '🕹️', color: '#B33771' },
];

// Animated GameTok Logo
const GameTokLogo = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.logoWrapper, { transform: [{ scale: pulseAnim }] }]}>
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
      <Text style={styles.tagline}>SWIPE • PLAY • COMPETE</Text>
    </Animated.View>
  );
};

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const { signup, login, loginWithOAuth, user, refreshUser } = useAuth();
  const { colors } = useTheme();
  
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  
  // Birthday
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  
  // Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Username
  const [username, setUsername] = useState('');
  
  // Profile
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  
  // Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Check Apple Sign-In availability and configure Google
  useEffect(() => {
    const checkApple = async () => {
      const available = await AppleAuthentication.isAvailableAsync();
      setIsAppleAvailable(available);
    };
    checkApple();
    
    // Configure Google Sign-In
    GoogleSignin.configure({
      iosClientId: '690098564284-704g6n4d0ur6audbsgqnd2tnkfranatc.apps.googleusercontent.com',
    });
  }, []);

  // Handle Apple Sign-In
  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      // Send to backend
      await loginWithOAuth('apple', {
        identityToken: credential.identityToken,
        email: credential.email,
        fullName: credential.fullName,
        user: credential.user,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled
      } else {
        setError('Apple Sign-In failed. Please try again.');
        console.error('Apple Sign-In error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      
      if (response.type === 'success' && response.data) {
        const { idToken, user: googleUser } = response.data;
        
        await loginWithOAuth('google', {
          idToken,
          email: googleUser.email,
          name: googleUser.name,
          photo: googleUser.photo,
          id: googleUser.id,
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete();
      }
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled
      } else if (e.code === statusCodes.IN_PROGRESS) {
        setError('Sign-in already in progress');
      } else {
        setError('Google Sign-In failed. Please try again.');
        console.error('Google Sign-In error:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const animateTransition = (nextStep: OnboardingStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(nextStep), 150);
  };

  const validateBirthday = () => {
    const month = parseInt(birthMonth);
    const day = parseInt(birthDay);
    const year = parseInt(birthYear);
    
    if (!month || !day || !year || month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2020) {
      setError('Please enter a valid birthday');
      return false;
    }
    
    const age = new Date().getFullYear() - year;
    if (age < 13) {
      setError('You must be at least 13 years old');
      return false;
    }
    return true;
  };

  const handleBirthdayContinue = () => {
    if (validateBirthday()) {
      setError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animateTransition('credentials');
    }
  };

  const handleCredentialsContinue = async () => {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (isLogin) {
      setLoading(true);
      try {
        await login(email.trim(), password);
        onComplete();
      } catch (e: any) {
        setError(e.message || 'Login failed');
      } finally {
        setLoading(false);
      }
    } else {
      setError('');
      animateTransition('username');
    }
  };

  const handleUsernameContinue = async () => {
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await signup(username.trim(), password, username.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateTransition('profile');
    } catch (e: any) {
      setError(e.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      // Upload to Cloudinary
      setIsUploadingAvatar(true);
      try {
        const imageUrl = await uploadImage(result.assets[0].uri);
        setAvatar(imageUrl);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.log('Upload failed:', error);
        Alert.alert('Upload failed', 'Could not upload image. Please try again.');
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  const handleProfileContinue = async () => {
    // Save profile if user has entered anything
    if (user && (displayName || bio || avatar)) {
      try {
        await users.update(user.id, {
          displayName: displayName || undefined,
          bio: bio || undefined,
          avatar: avatar || undefined,
        });
        await refreshUser();
      } catch (e) {
        console.error('Failed to update profile:', e);
      }
    }
    animateTransition('interests');
  };


  // WELCOME SCREEN - TikTok style with all options
  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <ImageBackground
        source={require('../../assets/gametok_bg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)', '#000']}
          locations={[0, 0.3, 0.6, 0.85]}
          style={styles.overlay}
        />
      </ImageBackground>

      <View style={[styles.logoContainer, { top: insets.top + 40 }]}>
        <GameTokLogo />
      </View>

      <View style={[styles.welcomeBottom, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.signupTitle}>Sign up for GameTOK</Text>
        
        {/* Apple Sign-In - Required for iOS */}
        {isAppleAvailable && (
          <TouchableOpacity 
            style={[styles.authOption, styles.appleButton]}
            onPress={handleAppleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-apple" size={22} color="#fff" />
            <Text style={styles.authOptionText}>Continue with Apple</Text>
          </TouchableOpacity>
        )}

        {/* Google Sign-In */}
        <TouchableOpacity 
          style={[styles.authOption, styles.googleButton]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Ionicons name="logo-google" size={20} color="#fff" />
          <Text style={styles.authOptionText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Email/Phone option */}
        <TouchableOpacity 
          style={styles.authOption}
          onPress={() => { setIsLogin(false); animateTransition('birthday'); }}
          disabled={loading}
        >
          <Ionicons name="mail-outline" size={22} color="#fff" />
          <Text style={styles.authOptionText}>Use phone or email</Text>
        </TouchableOpacity>

        {loading && (
          <ActivityIndicator size="small" color="#FF8E53" style={{ marginTop: 12 }} />
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.termsRow}>
          <Text style={styles.termsText}>By continuing, you agree to our </Text>
          <TouchableOpacity><Text style={styles.termsLink}>Terms</Text></TouchableOpacity>
          <Text style={styles.termsText}> and </Text>
          <TouchableOpacity><Text style={styles.termsLink}>Privacy Policy</Text></TouchableOpacity>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => { setIsLogin(true); animateTransition('credentials'); }}>
            <Text style={styles.loginLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // BIRTHDAY SCREEN
  const renderBirthday = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.stepContainer, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => animateTransition('welcome')}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.formContainer}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>When's your birthday?</Text>
          <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Your birthday won't be shown publicly.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.birthdayRow}>
            <View style={[styles.birthdayInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.birthdayField, { color: colors.text }]}
                placeholder="MM"
                placeholderTextColor={colors.textSecondary}
                value={birthMonth}
                onChangeText={(t) => setBirthMonth(t.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={[styles.birthdayInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.birthdayField, { color: colors.text }]}
                placeholder="DD"
                placeholderTextColor={colors.textSecondary}
                value={birthDay}
                onChangeText={(t) => setBirthDay(t.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={[styles.birthdayInput, { flex: 1.5, backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.birthdayField, { color: colors.text }]}
                placeholder="YYYY"
                placeholderTextColor={colors.textSecondary}
                value={birthYear}
                onChangeText={(t) => setBirthYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
        </View>

        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity 
            style={[styles.primaryButton, (!birthMonth || !birthDay || !birthYear) && styles.buttonDisabled]}
            onPress={handleBirthdayContinue}
            disabled={!birthMonth || !birthDay || !birthYear}
          >
            <LinearGradient
              colors={birthMonth && birthDay && birthYear ? ['#FF6B6B', '#FF8E53'] : [colors.surface, colors.border]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );

  // CREDENTIALS SCREEN (email + password)
  const renderCredentials = () => (
    <KeyboardAvoidingView style={[styles.stepContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => animateTransition(isLogin ? 'welcome' : 'birthday')}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <Text style={[styles.stepTitle, { color: colors.text }]}>{isLogin ? 'Log in' : 'Enter email & password'}</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {isLogin ? 'Enter your email and password' : 'You can always change this later.'}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {isLogin && (
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={[styles.forgotPasswordText, { color: colors.textSecondary }]}>Forgot password?</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity 
          style={[styles.primaryButton, (!email || !password) && styles.buttonDisabled]}
          onPress={handleCredentialsContinue}
          disabled={!email || !password || loading}
        >
          <LinearGradient
            colors={email && password ? ['#FF6B6B', '#FF8E53'] : [colors.surface, colors.border]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : 'Next'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // USERNAME SCREEN
  const renderUsername = () => (
    <KeyboardAvoidingView style={[styles.stepContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity style={styles.backButton} onPress={() => animateTransition('credentials')}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <Text style={[styles.stepTitle, { color: colors.text }]}>Create username</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>You can always change this later.</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="at" size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={[styles.usernameHint, { color: colors.textSecondary }]}>
          Usernames can only contain letters, numbers, and underscores.
        </Text>
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity 
          style={[styles.primaryButton, username.length < 3 && styles.buttonDisabled]}
          onPress={handleUsernameContinue}
          disabled={username.length < 3 || loading}
        >
          <LinearGradient
            colors={username.length >= 3 ? ['#FF6B6B', '#FF8E53'] : [colors.surface, colors.border]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Creating account...' : 'Sign up'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // PROFILE SCREEN
  const renderProfile = () => (
    <KeyboardAvoidingView style={[styles.stepContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.profileScroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.stepTitle, { color: colors.text, textAlign: 'center' }]}>Set up your profile</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary, textAlign: 'center' }]}>Add a photo and tell us about yourself</Text>

        <TouchableOpacity style={styles.avatarPicker} onPress={pickImage} disabled={isUploadingAvatar}>
          {isUploadingAvatar ? (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="large" color="#FF8E53" />
            </View>
          ) : avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="camera" size={32} color={colors.textSecondary} />
            </View>
          )}
          <View style={[styles.avatarBadge, { backgroundColor: '#FF8E53' }]}>
            <Ionicons name="add" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Display Name"
            placeholderTextColor={colors.textSecondary}
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        <View style={[styles.inputContainer, styles.bioContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, styles.bioInput, { color: colors.text }]}
            placeholder="Bio (optional)"
            placeholderTextColor={colors.textSecondary}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={150}
          />
        </View>
        <Text style={[styles.charCount, { color: colors.textSecondary }]}>{bio.length}/150</Text>
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={handleProfileContinue}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => animateTransition('interests')}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );


  // INTERESTS SCREEN
  const renderInterests = () => (
    <View style={[styles.stepContainer, { backgroundColor: colors.background }]}>
      <View style={styles.interestsHeader}>
        <Text style={styles.interestsEmoji}>🎮</Text>
        <Text style={[styles.interestsTitle, { color: colors.text }]}>What games do you vibe with?</Text>
        <Text style={[styles.interestsSubtitle, { color: colors.textSecondary }]}>Pick at least 3 to personalize your feed</Text>
      </View>

      <View style={styles.interestsGrid}>
        {GAME_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.interestCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedInterests.includes(cat.id) && { backgroundColor: cat.color, borderColor: cat.color, transform: [{ scale: 1.02 }] }
            ]}
            onPress={() => toggleInterest(cat.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.interestCardIcon}>{cat.icon}</Text>
            <Text style={[styles.interestCardText, { color: selectedInterests.includes(cat.id) ? '#fff' : colors.text }]}>
              {cat.name}
            </Text>
            {selectedInterests.includes(cat.id) && (
              <View style={styles.interestCheckBadge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity 
          style={[styles.primaryButton, selectedInterests.length < 3 && styles.buttonDisabled]}
          onPress={onComplete}
          disabled={selectedInterests.length < 3}
        >
          <LinearGradient
            colors={selectedInterests.length >= 3 ? ['#FF6B6B', '#FF8E53'] : [colors.surface, colors.border]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.primaryButtonText}>
              {selectedInterests.length >= 3 ? "Let's go! 🚀" : `Pick ${3 - selectedInterests.length} more`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={onComplete}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: step === 'welcome' ? 0 : insets.top }]}>
      <Animated.View style={[styles.animatedContainer, { opacity: fadeAnim }]}>
        {step === 'welcome' && renderWelcome()}
        {step === 'birthday' && renderBirthday()}
        {step === 'credentials' && renderCredentials()}
        {step === 'username' && renderUsername()}
        {step === 'profile' && renderProfile()}
        {step === 'interests' && renderInterests()}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  animatedContainer: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  
  // Welcome
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 4,
    marginTop: 12,
  },
  welcomeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  signupTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  authOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    height: 48,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#333',
  },
  googleButton: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  authOptionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
  socialIcon: {
    width: 20,
    height: 20,
  },
  termsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
    marginBottom: 16,
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  termsLink: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  loginText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
  loginLink: {
    fontSize: 15,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  
  // Form screens
  backButton: {
    position: 'absolute',
    left: 16,
    top: 10,
    zIndex: 10,
    padding: 8,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 16,
  },
  
  // Birthday
  birthdayRow: {
    flexDirection: 'row',
    gap: 12,
  },
  birthdayInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  birthdayField: {
    height: 56,
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
  },
  
  // Inputs
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#333',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  usernameHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -8,
  },
  
  // Profile
  profileScroll: {
    flexGrow: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  avatarPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 32,
    marginTop: 24,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
  },
  bioContainer: {
    height: 100,
    alignItems: 'flex-start',
    paddingTop: 12,
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
  },
  
  // Bottom actions
  bottomActions: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    marginBottom: 16,
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  skipText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  
  // Interests
  interestsHeader: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  interestsEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  interestsTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  interestsSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  interestCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
  },
  interestCardIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  interestCardText: {
    fontSize: 15,
    fontWeight: '700',
  },
  interestCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OnboardingFlow;
