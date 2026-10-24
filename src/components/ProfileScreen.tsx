// ProfileScreen — 3D Character Studio + Marketplace & Customization Sheet
// Pixel-matched to modern avatar platforms (Roblox reference), tailored with GameTok aesthetic.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  Switch,
  Alert,
  Linking,
  Dimensions,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AvatarStage } from './AvatarStage';
import { EditProfileModal } from './EditProfileModal';
import { MyAvatarModal } from './MyAvatarModal';
import { AVATAR_ITEMS, AvatarItem, AvatarRecord, Category, COLOR_SWATCHES, HAIR_SWATCHES } from '../avatar/catalog';
import { buyItem, needsHeadshot, saveAvatar, syncAvatar, uploadHeadshot, useAvatarAccount } from '../avatar/store';
import { hasHeadshot } from './Avatar';
import { ShopModal } from './ShopModal';
import { AddFriendsScreen } from './AddFriendsScreen';
import { Avatar } from './Avatar';
import { TokBuxIcon } from './TokBuxIcon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');


const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'body', label: 'Body' },
  { id: 'hair', label: 'Hair' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessories', label: 'Accessories' },
];

export const ProfileScreen: React.FC<{ isActive?: boolean }> = () => {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [stageMode, setStageMode] = useState<'marketplace' | 'customize'>('marketplace');
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  // Avatar, owned items and TokBux: on the GameTok account (avatar/store.ts). Free items are everyone's.
  const account = useAvatarAccount();
  const saved = account?.avatar ?? null;
  const tokbux = account?.tokbux ?? 0;
  const priceOf = (item: AvatarItem) => account?.prices[item.id] ?? item.price;
  const [selectedItem, setSelectedItem] = useState<AvatarItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [history, setHistory] = useState<{ undo: AvatarRecord[]; redo: AvatarRecord[] }>({ undo: [], redo: [] });

  const isOwned = (item: AvatarItem) => priceOf(item) === 0 || !!account?.owned.includes(item.id);
  const isWorn = (item: AvatarItem) => !!saved && !!item.isWorn?.(saved);

  // try-on: the stage shows the selected item on the player's own avatar before they buy or equip it
  const shown = useMemo(
    () => (saved && selectedItem?.wear && !isWorn(selectedItem) ? selectedItem.wear(saved) : saved),
    [saved, selectedItem],
  );

  // Modals
  const [showShop, setShowShop] = useState(false);
  const [showMyAvatar, setShowMyAvatar] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // signing in or out switches whose avatar this is
  useEffect(() => { syncAvatar(); }, [user?.id]);

  // the profile picture is a headshot of the saved look: retake it when the look changes
  const [shotOf, setShotOf] = useState<AvatarRecord | null>(null);
  useEffect(() => {
    if (!saved) return;
    let live = true;
    needsHeadshot(saved, hasHeadshot(user?.avatar)).then((n) => { if (live) setShotOf(n ? saved : null); });
    return () => { live = false; };
  }, [saved, user?.avatar, account?.signedIn]);
  const onHeadshot = (png: string, of: AvatarRecord) => {
    uploadHeadshot(png, of).then((url) => { if (url) refreshUser(); });
  };

  const commit = (next: AvatarRecord) => {
    if (!saved) return;
    setHistory((h) => ({ undo: [...h.undo.slice(-30), saved], redo: [] }));
    saveAvatar(next);
  };
  const undo = () => {
    const prev = history.undo[history.undo.length - 1];
    if (!prev || !saved) return;
    setHistory((h) => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, saved] }));
    setSelectedItem(null);
    saveAvatar(prev);
  };
  const redo = () => {
    const next = history.redo[history.redo.length - 1];
    if (!next || !saved) return;
    setHistory((h) => ({ undo: [...h.undo, saved], redo: h.redo.slice(0, -1) }));
    setSelectedItem(null);
    saveAvatar(next);
  };

  const handleSelectItem = (item: AvatarItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(selectedItem?.id === item.id ? null : item);
  };

  const recolor = (color: string) => {
    if (!saved || !selectedItem?.colorKey) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const k = selectedItem.colorKey;
    commit(k === 'hair' ? { ...saved, hairColor: color } : { ...saved, colors: { ...saved.colors, [k]: color } });
  };

  const handlePrimaryAction = async () => {
    if (!selectedItem || !saved) return;

    // on: take it off (owned or not); deselect too, or the stage would keep showing it as a try-on
    if (isWorn(selectedItem)) {
      if (selectedItem.takeOff) { commit(selectedItem.takeOff(saved)); setSelectedItem(null); }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (isOwned(selectedItem)) {
      if (selectedItem.wear) commit(selectedItem.wear(saved));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    // Buy with TokBux (the account decides), then wear it
    if (!account?.signedIn) {
      Alert.alert('Sign in to buy', 'Items you buy are kept on your GameTok account, so they follow you to every game and phone.');
      return;
    }
    if (tokbux < priceOf(selectedItem)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Not enough TokBux', `${selectedItem.name} costs ${priceOf(selectedItem).toLocaleString()} TokBux. You have ${tokbux.toLocaleString()}.`);
      return;
    }
    if (buying) return;
    setBuying(true);
    const item = selectedItem, before = saved;
    const err = await buyItem(item.id);
    setBuying(false);
    if (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Not bought', err);
      return;
    }
    if (item.wear) commit(item.wear(before));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const filteredItems = useMemo(() => {
    let pool = AVATAR_ITEMS;
    if (stageMode === 'customize') pool = pool.filter(isOwned);
    if (activeCategory === 'all') return pool;
    return pool.filter((item) => item.category === activeCategory);
  }, [stageMode, activeCategory, account]);

  const isSelectedOwned = !!selectedItem && isOwned(selectedItem);
  const isSelectedEquipped = !!selectedItem && isWorn(selectedItem);

  return (
    <View style={styles.root}>
      {/* 1. TOP 46% 3D CHARACTER STUDIO STAGE */}
      <View style={styles.stageWrap}>
        <AvatarStage style={StyleSheet.absoluteFill} avatar={shown} focus={selectedItem?.focus || 'body'} headshotOf={shotOf} onHeadshot={onHeadshot} />

        {/* Floating Top Controls Header */}
        <View style={[styles.stageTopBar, { paddingTop: insets.top + 6 }]}>
          {/* Left: Menu & Profile Pill */}
          <View style={styles.leftGroup}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowSettings(true);
              }}
              hitSlop={8}
            >
              <Ionicons name="menu" size={20} color="#FFFFFF" />
              <View style={styles.blueDot} />
            </Pressable>

            <Pressable
              style={styles.profileBadgeCapsule}
              onPress={() => setShowEditProfile(true)}
              hitSlop={8}
            >
              <Avatar uri={user?.avatar} userId={user?.id} size={28} />
              <View style={styles.profileBadgeGear}>
                <Ionicons name="settings" size={9} color="#000000" />
              </View>
            </Pressable>
          </View>

          {/* Center: Segmented Toggle [ Marketplace | Customize ] */}
          <View style={styles.segmentedToggle}>
            <Pressable
              style={[
                styles.segmentBtn,
                stageMode === 'marketplace' && styles.segmentBtnActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStageMode('marketplace');
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  stageMode === 'marketplace' && styles.segmentTextActive,
                ]}
              >
                Marketplace
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.segmentBtn,
                stageMode === 'customize' && styles.segmentBtnActive,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStageMode('customize');
              }}
            >
              <Text
                style={[
                  styles.segmentText,
                  stageMode === 'customize' && styles.segmentTextActive,
                ]}
              >
                Customize
              </Text>
            </Pressable>
          </View>

          {/* Right: Search & TokBux Balance */}
          <View style={styles.rightGroup}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => setShowShop(true)}
              hitSlop={8}
            >
              <Ionicons name="search" size={20} color="#FFFFFF" />
            </Pressable>

            <Pressable
              style={styles.tokbuxCapsule}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowShop(true);
              }}
              hitSlop={8}
            >
              <TokBuxIcon size={22} />
              <Text style={styles.tokbuxAmount}>{tokbux.toLocaleString()}</Text>
            </Pressable>
          </View>
        </View>

        {/* Floating Stage Controls (Bottom-Left: Undo/Redo pill matching Roblox) */}
        <View style={styles.stageFloatingControls}>
          <View style={styles.undoRedoPill}>
            <Pressable
              style={styles.undoBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                undo();
              }}
              hitSlop={6}
            >
              <Ionicons name="arrow-undo" size={16} color={history.undo.length ? '#FFFFFF' : 'rgba(255,255,255,0.35)'} />
            </Pressable>
            <View style={styles.undoDivider} />
            <Pressable
              style={styles.undoBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                redo();
              }}
              hitSlop={6}
            >
              <Ionicons name="arrow-redo" size={16} color={history.redo.length ? '#FFFFFF' : 'rgba(255,255,255,0.35)'} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* 2. BOTTOM 54% MARKETPLACE & CUSTOMIZATION SHEET */}
      <View style={styles.sheetContainer}>
        {/* Grabber Handle */}
        <View style={styles.grabberHandle} />

        {/* Category Underline Tabs (matching Roblox: All, Avatars, Body, Clothing, etc.) */}
        <View style={styles.categoryBarWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveCategory(cat.id);
                  }}
                >
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {cat.label}
                  </Text>
                  {isActive && <View style={styles.categoryTabIndicator} />}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Filter Sliders Button on Right */}
          <Pressable
            style={styles.filterBtn}
            onPress={() => setShowSettings(true)}
            hitSlop={6}
          >
            <Ionicons name="options-outline" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Section Heading: "Recommended For You" */}
        <View style={styles.sectionHeadingWrap}>
          <Text style={styles.sectionHeadingText}>
            {stageMode === 'marketplace' ? 'Recommended For You' : 'My Customizables'}
          </Text>
        </View>

        {/* 3-Column Item Grid */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No items found in this category.</Text>
            </View>
          ) : (
            <View style={styles.itemsGrid}>
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const owned = isOwned(item);
                const isEquipped = isWorn(item);

                return (
                  <Pressable
                    key={item.id}
                    style={styles.gridCard}
                    onPress={() => handleSelectItem(item)}
                  >
                    {/* Square Item Preview Box */}
                    <View
                      style={[
                        styles.cardThumb,
                        isSelected && styles.cardThumbSelected,
                      ]}
                    >
                      <Ionicons name={item.icon} size={42} color={item.tint} />

                      {isEquipped && (
                        <View style={styles.cardEquippedTag}>
                          <Text style={styles.cardEquippedText}>ON</Text>
                        </View>
                      )}

                      {/* Details Badge on Selected Card */}
                      {isSelected && (
                        <View style={styles.detailsBadge}>
                          <Text style={styles.detailsBadgeText}>Details</Text>
                        </View>
                      )}
                    </View>

                    {/* Title */}
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.name}
                    </Text>

                    {/* Brand / Creator */}
                    <Text style={styles.cardCreator} numberOfLines={1}>
                      GameTok
                    </Text>

                    {/* Price Row with TokBux Token */}
                    <View style={styles.cardPriceRow}>
                      {owned ? (
                        <Text style={styles.cardOwnedLabel}>
                          {isEquipped ? '✓ Equipped' : priceOf(item) === 0 ? 'Free' : 'Owned'}
                        </Text>
                      ) : (
                        <>
                          <TokBuxIcon size={16} />
                          <Text style={styles.cardPriceText}>{priceOf(item)}</Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Colour swatches for the selected item, once it's on */}
        {selectedItem?.colorKey && isSelectedEquipped && saved && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.swatchBar, { bottom: (insets.bottom > 0 ? insets.bottom + 4 : 14) + 74 }]} contentContainerStyle={styles.swatchRow}>
            {(selectedItem.colorKey === 'hair' ? HAIR_SWATCHES : COLOR_SWATCHES).map((c) => {
              const k = selectedItem.colorKey!;
              const on = (k === 'hair' ? saved.hairColor : saved.colors[k]) === c;
              return (
                <Pressable key={c} onPress={() => recolor(c)} style={[styles.swatch, { backgroundColor: c }, on && styles.swatchOn]} />
              );
            })}
          </ScrollView>
        )}

        {/* Fixed Bottom Action Bar */}
        <View style={[styles.bottomActionBar, { paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 14 }]}>
          {/* Primary Action Button (Blue button matching Roblox) */}
          <Pressable
            style={[
              styles.primaryBtn,
              isSelectedEquipped && styles.primaryBtnEquipped,
              !!selectedItem && !isSelectedOwned && styles.primaryBtnBuy,
            ]}
            onPress={handlePrimaryAction}
          >
            {!selectedItem ? (
              <Text style={styles.primaryBtnText}>Pick an item to try on</Text>
            ) : isSelectedEquipped ? (
              <Text style={styles.primaryBtnText}>{selectedItem.takeOff ? 'Take Off' : '✓ Wearing'}</Text>
            ) : isSelectedOwned ? (
              <Text style={styles.primaryBtnText}>Wear</Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TokBuxIcon size={22} />
                <Text style={[styles.primaryBtnText, { fontSize: 18 }]}>
                  {selectedItem && priceOf(selectedItem)}
                </Text>
              </View>
            )}
          </Pressable>

          {/* More Options Button [...] */}
          <Pressable
            style={styles.moreBtn}
            onPress={() => setShowMyAvatar(true)}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* MODALS */}
      <ShopModal
        visible={showShop}
        onClose={() => setShowShop(false)}
        onOpenAvatarPreview={() => {
          setShowShop(false);
          setShowMyAvatar(true);
        }}
      />

      <MyAvatarModal
        visible={showMyAvatar}
        onClose={() => setShowMyAvatar(false)}
      />

      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      <AddFriendsScreen
        visible={showAddFriends}
        onClose={() => setShowAddFriends(false)}
      />

      {/* Settings Sheet */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowSettings(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetGrabber} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <SheetItem
                icon="body-outline"
                label="3D Avatar & Skeleton"
                onPress={() => {
                  setShowSettings(false);
                  setShowMyAvatar(true);
                }}
              />
              <SheetItem
                icon="cart-outline"
                label="TokBux & Coin Store"
                onPress={() => {
                  setShowSettings(false);
                  setShowShop(true);
                }}
              />
              <SheetItem
                icon="person-outline"
                label="Edit Profile"
                onPress={() => {
                  setShowSettings(false);
                  setShowEditProfile(true);
                }}
              />
              <SheetItem
                icon="person-add-outline"
                label="Find Friends"
                onPress={() => {
                  setShowSettings(false);
                  setShowAddFriends(true);
                }}
              />
              <View style={styles.sheetDivider} />
              <View style={styles.sheetSwitchRow}>
                <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color="#FFFFFF" />
                <Text style={styles.sheetItemLabel}>Dark Mode</Text>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#ccc', true: '#7C3AED' }}
                  thumbColor="#fff"
                  style={{ marginLeft: 'auto' }}
                />
              </View>
              <View style={styles.sheetDivider} />
              <SheetItem
                icon="mail-outline"
                label="Contact Us"
                onPress={() => Linking.openURL('mailto:info@gametok.com')}
              />
              <SheetItem
                icon="shield-outline"
                label="Privacy Policy"
                onPress={() => Linking.openURL('https://gametok.co/privacy.html')}
              />
              <View style={styles.sheetDivider} />
              <SheetItem
                icon="log-out-outline"
                label="Log Out"
                danger
                onPress={() => {
                  setShowSettings(false);
                  logout();
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const SheetItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}> = ({ icon, label, danger, onPress }) => (
  <Pressable style={styles.sheetItem} onPress={onPress}>
    <Ionicons name={icon} size={20} color={danger ? '#ef4444' : '#FFFFFF'} style={{ width: 28 }} />
    <Text style={[styles.sheetItemLabel, danger && { color: '#ef4444' }]}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color="#6B6B78" style={{ marginLeft: 'auto' }} />
  </Pressable>
);

const styles = StyleSheet.create({
  swatchBar: { flexGrow: 0, position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(18,17,29,0.9)' },
  swatchRow: { paddingHorizontal: 14, gap: 10, paddingVertical: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  swatchOn: { borderColor: '#FFFFFF', borderWidth: 3 },
  root: {
    flex: 1,
    backgroundColor: '#16151f',
  },
  stageWrap: {
    height: SCREEN_HEIGHT * 0.46,
    width: '100%',
    position: 'relative',
    backgroundColor: '#16151f',
  },
  stageTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  blueDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3B82F6',
  },
  profileBadgeCapsule: {
    position: 'relative',
  },
  profileBadgeGear: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#FFD23F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#D4D0E8',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  segmentTextActive: {
    color: '#000000',
    fontFamily: 'Inter_800ExtraBold',
  },
  tokbuxCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
    gap: 6,
  },
  tokbuxAmount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
  },
  stageFloatingControls: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    zIndex: 10,
  },
  undoRedoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  undoBtn: {
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 4,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#12111D',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: '#25233A',
    overflow: 'hidden',
  },
  grabberHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3E3B5A',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  categoryBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1C2E',
  },
  categoryScroll: {
    gap: 16,
    paddingRight: 10,
  },
  categoryTab: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    position: 'relative',
  },
  categoryTabActive: {},
  categoryTabText: {
    color: '#8E8AAB',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },
  categoryTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
  },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sectionHeadingWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionHeadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.3,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 44) / 3,
    marginBottom: 12,
  },
  cardThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#1E1D2D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  cardThumbSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#24223A',
  },
  cardEquippedTag: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardEquippedText: {
    color: '#000000',
    fontSize: 8,
    fontFamily: 'Inter_800ExtraBold',
  },
  detailsBadge: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    backgroundColor: '#1E1D2D',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  detailsBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    marginTop: 6,
  },
  cardCreator: {
    color: '#8A86A8',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    marginTop: 1,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardPriceText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
  },
  cardOwnedLabel: {
    color: '#A855F7',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(18,17,29,0.96)',
    borderTopWidth: 1,
    borderTopColor: '#26243A',
  },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnBuy: {
    backgroundColor: '#2563EB',
  },
  primaryBtnEquipped: {
    backgroundColor: '#26243A',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
  },
  moreBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1E1D2D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#34304E',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8AAB',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#17142A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  sheetGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#383256',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  sheetItemLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#272242',
    marginVertical: 6,
  },
  sheetSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
});
