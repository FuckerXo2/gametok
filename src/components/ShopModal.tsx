import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { TokBuxIcon } from './TokBuxIcon';
import { useAvatarAccount } from '../avatar/store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OWNED_SKINS_KEY = 'gametok_user_owned_skins';
const ACTIVE_SKIN_KEY = 'gametok_user_active_skin';

export interface SkinItem {
  id: string;
  name: string;
  rarity: 'Epic' | 'Legendary' | 'Mythic';
  price: number;
  tagline: string;
  badgeColor: string;
  accentColor: string;
  bgGradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  modelVariant?: string;
}

export const SKINS_CATALOG: SkinItem[] = [
  {
    id: 'lagos-striker',
    name: 'Lagos Striker',
    rarity: 'Legendary',
    price: 1200,
    tagline: 'Street 5s icon with gold chains & custom turf boots.',
    badgeColor: '#F59E0B',
    accentColor: '#FCD34D',
    bgGradient: ['#3A2400', '#1C1200'],
    icon: 'football-outline',
    modelVariant: 'striker',
  },
  {
    id: 'cyber-viper',
    name: 'Cyber Viper',
    rarity: 'Mythic',
    price: 1800,
    tagline: 'Neon cybernetic rig with reactive pulse lighting.',
    badgeColor: '#EC4899',
    accentColor: '#F472B6',
    bgGradient: ['#380026', '#170010'],
    icon: 'flash-outline',
    modelVariant: 'cyber',
  },
  {
    id: 'shadow-shinobi',
    name: 'Shadow Shinobi',
    rarity: 'Epic',
    price: 950,
    tagline: 'Tactical stealth shinobi tuned for instant high-speed runs.',
    badgeColor: '#8B5CF6',
    accentColor: '#A78BFA',
    bgGradient: ['#1F1138', '#0B0616'],
    icon: 'shield-outline',
    modelVariant: 'stealth',
  },
  {
    id: 'golden-kingpin',
    name: 'Golden Kingpin',
    rarity: 'Mythic',
    price: 2500,
    tagline: 'Solid 24K gold gilded armor with championship particle crown.',
    badgeColor: '#EAB308',
    accentColor: '#FDE047',
    bgGradient: ['#3B2C04', '#161100'],
    icon: 'trophy-outline',
    modelVariant: 'gold',
  },
];

export interface TokBuxPack {
  id: string;
  tokbux: number;
  bonus?: number;
  price: string;
  tag?: string;
  gradient: [string, string];
  icon: string;
}

const TOKBUX_PACKS: TokBuxPack[] = [
  {
    id: 'pack-starter',
    tokbux: 500,
    price: '$4.99',
    gradient: ['#1F192E', '#130E20'],
    icon: '🪙',
  },
  {
    id: 'pack-popular',
    tokbux: 1200,
    bonus: 200,
    price: '$9.99',
    tag: 'MOST POPULAR',
    gradient: ['#2E164D', '#160B29'],
    icon: '💰',
  },
  {
    id: 'pack-best-value',
    tokbux: 3000,
    bonus: 600,
    price: '$19.99',
    tag: 'BEST VALUE',
    gradient: ['#3D1E08', '#211003'],
    icon: '🏆',
  },
  {
    id: 'pack-titan',
    tokbux: 8500,
    bonus: 2000,
    price: '$49.99',
    tag: 'TITAN VAULT',
    gradient: ['#380026', '#1A0012'],
    icon: '👑',
  },
];

interface ShopModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenAvatarPreview?: (skinId?: string) => void;
  onBalanceChange?: (newBalance: number) => void;
}

type ShopTab = 'skins' | 'tokbux' | 'emotes' | 'battlepass';

export const ShopModal: React.FC<ShopModalProps> = ({
  visible,
  onClose,
  onOpenAvatarPreview,
  onBalanceChange,
}) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ShopTab>('skins');
  // TokBux live on the GameTok account (avatar/store.ts). Buying TokBux, skins and emotes needs real payments: not yet.
  const balance = useAvatarAccount()?.tokbux ?? 0;
  const comingSoon = () => Alert.alert('Coming soon', 'This opens once payments are live. Avatar items can already be bought with TokBux in your Profile.');
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['lagos-striker']);
  const [activeSkin, setActiveSkin] = useState<string>('lagos-striker');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadShopState();
  }, [visible]);

  const loadShopState = async () => {
    try {
      const savedOwned = await AsyncStorage.getItem(OWNED_SKINS_KEY);
      if (savedOwned) {
        setOwnedSkins(JSON.parse(savedOwned));
      }

      const savedActive = await AsyncStorage.getItem(ACTIVE_SKIN_KEY);
      if (savedActive) {
        setActiveSkin(savedActive);
      }
    } catch (e) {
      console.log('[ShopModal] load error:', e);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  const handleBuyTokBux = (_pack: TokBuxPack) => comingSoon();

  const handleBuySkin = async (skin: SkinItem) => {
    const isOwned = ownedSkins.includes(skin.id);
    if (isOwned) {
      // Equip skin
      setActiveSkin(skin.id);
      await AsyncStorage.setItem(ACTIVE_SKIN_KEY, skin.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      showToast(`${skin.name} Equipped! 🎮`);
      return;
    }

    comingSoon();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={styles.headerKicker}>GAMETOK STORE</Text>
            <Text style={styles.headerTitle}>Shop<Text style={{ color: '#FFD23F' }}>.</Text></Text>
          </View>

          {/* TokBux Balance Badge */}
          <Pressable
            style={styles.tokbuxBadge}
            onPress={() => setActiveTab('tokbux')}
            hitSlop={6}
          >
            <LinearGradient
              colors={['#2E1A47', '#170E28']}
              style={styles.tokbuxBadgeGradient}
            >
              <TokBuxIcon size={24} />
              <Text style={styles.tokbuxText}>{balance.toLocaleString()}</Text>
              <View style={styles.tokbuxPlus}>
                <Ionicons name="add" size={12} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Toast Alert */}
        {toastMessage && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* Tab Selector */}
        <View style={styles.tabsRow}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'skins' && styles.tabBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('skins');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'skins' && styles.tabTextActive]}>
              🥋 Skins
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === 'tokbux' && styles.tabBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('tokbux');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'tokbux' && styles.tabTextActive]}>
              🪙 TokBux
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === 'emotes' && styles.tabBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('emotes');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'emotes' && styles.tabTextActive]}>
              ⚡ Emotes
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === 'battlepass' && styles.tabBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('battlepass');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'battlepass' && styles.tabTextActive]}>
              🎟️ Pass
            </Text>
          </Pressable>
        </View>

        {/* Scroll Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: SKINS */}
          {activeTab === 'skins' && (
            <View style={{ gap: 16 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>SEASON 1 ROSTER</Text>
                <Text style={styles.sectionTitle}>Full Character Skins</Text>
                <Text style={styles.sectionSubtitle}>
                  100% compatible across Street 5s, Fight Club, GTA Lagos & all platform games.
                </Text>
              </View>

              {SKINS_CATALOG.map((skin) => {
                const isOwned = ownedSkins.includes(skin.id);
                const isActive = activeSkin === skin.id;

                return (
                  <View key={skin.id} style={styles.skinCard}>
                    <LinearGradient
                      colors={skin.bgGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.skinGradient}
                    />

                    {/* Top Row: Rarity Badge & 3D Preview button */}
                    <View style={styles.skinTopRow}>
                      <View style={[styles.rarityBadge, { backgroundColor: skin.badgeColor }]}>
                        <Text style={styles.rarityText}>{skin.rarity.toUpperCase()}</Text>
                      </View>

                      {onOpenAvatarPreview && (
                        <Pressable
                          style={styles.preview3DBtn}
                          onPress={() => onOpenAvatarPreview(skin.id)}
                          hitSlop={8}
                        >
                          <Ionicons name="cube-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
                          <Text style={styles.preview3DText}>3D Inspect</Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Center Icon & Name */}
                    <View style={styles.skinCenter}>
                      <View style={[styles.skinIconBubble, { borderColor: skin.accentColor }]}>
                        <Ionicons name={skin.icon} size={36} color={skin.accentColor} />
                      </View>
                      <Text style={styles.skinName}>{skin.name}</Text>
                      <Text style={styles.skinTagline}>{skin.tagline}</Text>
                    </View>

                    {/* Bottom Action Row */}
                    <View style={styles.skinBottomRow}>
                      <View style={styles.priceContainer}>
                        <TokBuxIcon size={20} />
                        <Text style={styles.priceText}>{skin.price.toLocaleString()}</Text>
                        <Text style={styles.priceCurrency}>TokBux</Text>
                      </View>

                      <Pressable
                        style={[
                          styles.actionBtn,
                          isOwned && !isActive && styles.actionBtnEquip,
                          isActive && styles.actionBtnActive,
                        ]}
                        onPress={() => handleBuySkin(skin)}
                      >
                        <Text
                          style={[
                            styles.actionBtnText,
                            isActive && { color: '#000000' },
                          ]}
                        >
                          {isActive ? '✓ Equipped' : isOwned ? 'Equip' : 'Unlock Skin'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* TAB 2: TOKBUX PACKS */}
          {activeTab === 'tokbux' && (
            <View style={{ gap: 16 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>INSTANT COINS</Text>
                <Text style={styles.sectionTitle}>Get TokBux</Text>
                <Text style={styles.sectionSubtitle}>
                  Spend TokBux on legendary skins, tournament stakes, and victory celebrations.
                </Text>
              </View>

              <View style={styles.packsGrid}>
                {TOKBUX_PACKS.map((pack) => (
                  <View key={pack.id} style={styles.packCard}>
                    <LinearGradient
                      colors={pack.gradient}
                      style={styles.packGradient}
                    />

                    {pack.tag && (
                      <View style={styles.packTagBadge}>
                        <Text style={styles.packTagText}>{pack.tag}</Text>
                      </View>
                    )}

                    <Text style={styles.packIconEmoji}>{pack.icon}</Text>
                    <Text style={styles.packTokbuxNum}>{pack.tokbux.toLocaleString()}</Text>
                    <Text style={styles.packTokbuxLabel}>TokBux</Text>

                    {pack.bonus ? (
                      <View style={styles.packBonusPill}>
                        <Text style={styles.packBonusText}>+{pack.bonus} BONUS</Text>
                      </View>
                    ) : (
                      <View style={{ height: 22 }} />
                    )}

                    <Pressable
                      style={styles.packBuyBtn}
                      onPress={() => handleBuyTokBux(pack)}
                    >
                      <Text style={styles.packBuyPrice}>{pack.price}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 3: EMOTES */}
          {activeTab === 'emotes' && (
            <View style={{ gap: 16 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>FLEX ON VICTORY</Text>
                <Text style={styles.sectionTitle}>Celebrations & Emotes</Text>
                <Text style={styles.sectionSubtitle}>
                  Triggered when you win a PK battle, score in Street 5s, or KO in Fight Club.
                </Text>
              </View>

              {[
                { name: 'Lagos Shuffle', price: 500, icon: 'musical-notes-outline', desc: 'Afrobeats victory celebration.' },
                { name: 'Acrobatic Backflip', price: 450, icon: 'refresh-outline', desc: 'Full high-altitude backflip onto feet.' },
                { name: 'The Griddy', price: 600, icon: 'walk-outline', desc: 'Classic viral sports celebration.' },
                { name: 'Champion Flex', price: 350, icon: 'barbell-outline', desc: 'Double bicep power roar.' },
              ].map((emote, idx) => (
                <View key={idx} style={styles.emoteRow}>
                  <View style={styles.emoteIconWrap}>
                    <Ionicons name={emote.icon as any} size={24} color="#A855F7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emoteName}>{emote.name}</Text>
                    <Text style={styles.emoteDesc}>{emote.desc}</Text>
                  </View>
                  <Pressable
                    style={styles.emoteBuyBtn}
                    onPress={comingSoon}
                  >
                    <Text style={styles.emotePriceText}>🪙 {emote.price}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* TAB 4: BATTLE PASS */}
          {activeTab === 'battlepass' && (
            <View style={{ gap: 16 }}>
              <View style={styles.passBanner}>
                <LinearGradient
                  colors={['#5B21B6', '#1E1B4B']}
                  style={styles.passGradient}
                />
                <View style={styles.passTag}>
                  <Text style={styles.passTagText}>SEASON 1</Text>
                </View>
                <Text style={styles.passTitle}>Cyber Turf Pass</Text>
                <Text style={styles.passDesc}>
                  Play any game on GameTok to earn XP. Unlock 50 tiers of exclusive skins, emotes, and 2,500 TokBux rewards.
                </Text>
                <View style={styles.passProgressWrap}>
                  <View style={styles.passProgressBar}>
                    <View style={[styles.passProgressFill, { width: '42%' }]} />
                  </View>
                  <Text style={styles.passTierLabel}>Tier 21 / 50</Text>
                </View>
                <Pressable
                  style={styles.passUnlockBtn}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    showToast('Battle Pass Activated! 🌟');
                  }}
                >
                  <Text style={styles.passUnlockText}>Upgrade to Premium (950 🪙)</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#09080F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1828',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1B2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    alignItems: 'center',
  },
  headerKicker: {
    color: '#8A86A8',
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.5,
  },
  tokbuxBadge: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  tokbuxBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#4A2875',
    borderRadius: 20,
  },
  tokbuxIcon: {
    fontSize: 14,
  },
  tokbuxText: {
    color: '#FFD23F',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
  },
  tokbuxPlus: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    zIndex: 999,
    backgroundColor: '#A855F7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#A855F7',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#141222',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#242038',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tabText: {
    color: '#9C98B6',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  tabTextActive: {
    color: '#000000',
    fontFamily: 'Inter_800ExtraBold',
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 4,
  },
  sectionEyebrow: {
    color: '#FFD23F',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.5,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 2,
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: '#9490B0',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
    lineHeight: 18,
  },
  skinCard: {
    borderRadius: 22,
    overflow: 'hidden',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
  },
  skinGradient: {
    ...StyleSheet.absoluteFill,
  },
  skinTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rarityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rarityText: {
    color: '#000000',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.8,
  },
  preview3DBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  preview3DText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  skinCenter: {
    alignItems: 'center',
    marginVertical: 18,
  },
  skinIconBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 12,
  },
  skinName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.3,
  },
  skinTagline: {
    color: '#D4D0E8',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  skinBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceCoin: {
    fontSize: 16,
  },
  priceText: {
    color: '#FFD23F',
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
  },
  priceCurrency: {
    color: '#B5B1D0',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 2,
  },
  actionBtn: {
    backgroundColor: '#FFD23F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },
  actionBtnEquip: {
    backgroundColor: '#A855F7',
  },
  actionBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  actionBtnText: {
    color: '#000000',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
  },
  packsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  packCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  packGradient: {
    ...StyleSheet.absoluteFill,
  },
  packTagBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#EC4899',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  packTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Inter_800ExtraBold',
  },
  packIconEmoji: {
    fontSize: 36,
    marginTop: 8,
  },
  packTokbuxNum: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 6,
  },
  packTokbuxLabel: {
    color: '#FFD23F',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  packBonusPill: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  packBonusText: {
    color: '#FBBF24',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
  },
  packBuyBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  packBuyPrice: {
    color: '#000000',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
  },
  emoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151324',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#25213D',
    gap: 14,
  },
  emoteIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#271F42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoteName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
  },
  emoteDesc: {
    color: '#9E9AB8',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  emoteBuyBtn: {
    backgroundColor: '#2A1F45',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A347A',
  },
  emotePriceText: {
    color: '#FFD23F',
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
  },
  passBanner: {
    borderRadius: 24,
    padding: 22,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  passGradient: {
    ...StyleSheet.absoluteFill,
  },
  passTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#EC4899',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  passTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
  },
  passTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 8,
  },
  passDesc: {
    color: '#DDD6FE',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 6,
    lineHeight: 20,
  },
  passProgressWrap: {
    marginVertical: 18,
  },
  passProgressBar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  passProgressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 5,
  },
  passTierLabel: {
    color: '#FDE047',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    marginTop: 6,
    textAlign: 'right',
  },
  passUnlockBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  passUnlockText: {
    color: '#1E1B4B',
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
  },
});
