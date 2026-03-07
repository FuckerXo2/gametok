import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Image,
    ScrollView,
    Dimensions,
    Animated,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { AvatarConfig, SkinTone } from './types';
import {
    AVATAR_OPTIONS,
    SKIN_TONES,
    CATEGORIES,
    getAvatarsByTone,
    getAvatarById,
    getAvailableSkinTones,
} from './avatarData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_PREVIEW_SIZE = SCREEN_WIDTH * 0.5;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 64 - 24) / 4; // 4 columns with padding
const SKIN_DOT_SIZE = 36;

interface AvatarCreatorModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (config: AvatarConfig, imageSource: any) => void;
    initialConfig?: AvatarConfig;
}

export const AvatarCreatorModal: React.FC<AvatarCreatorModalProps> = ({
    visible,
    onClose,
    onSave,
    initialConfig,
}) => {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();

    // State
    const availableTones = getAvailableSkinTones();
    const defaultTone = availableTones[0] || 'light';
    const defaultAvatars = getAvatarsByTone(defaultTone);
    const defaultAvatar = defaultAvatars[0];

    const [selectedSkinTone, setSelectedSkinTone] = useState<SkinTone>(
        initialConfig ? (getAvatarById(initialConfig.avatarId)?.skinTone || defaultTone) : defaultTone
    );
    const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
        initialConfig?.avatarId || defaultAvatar?.id || ''
    );
    const [activeCategory, setActiveCategory] = useState<string>('skin');

    // Animations
    const previewScale = useRef(new Animated.Value(1)).current;
    const slideAnim = useRef(new Animated.Value(0)).current;

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            if (initialConfig) {
                const avatar = getAvatarById(initialConfig.avatarId);
                if (avatar) {
                    setSelectedSkinTone(avatar.skinTone);
                    setSelectedAvatarId(initialConfig.avatarId);
                }
            }
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            }).start();
        } else {
            slideAnim.setValue(0);
        }
    }, [visible]);

    // Bounce preview on selection change
    const bouncePreview = useCallback(() => {
        Animated.sequence([
            Animated.timing(previewScale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
            Animated.spring(previewScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }),
        ]).start();
    }, []);

    // Handlers
    const handleSkinToneSelect = (tone: SkinTone) => {
        setSelectedSkinTone(tone);
        const avatarsForTone = getAvatarsByTone(tone);
        if (avatarsForTone.length > 0) {
            setSelectedAvatarId(avatarsForTone[0].id);
        }
        bouncePreview();
    };

    const handleAvatarSelect = (avatarId: string) => {
        setSelectedAvatarId(avatarId);
        bouncePreview();
    };



    const handleSave = () => {
        const config: AvatarConfig = {
            avatarId: selectedAvatarId,
            backgroundColor: '#F5D558',
        };
        const avatar = getAvatarById(selectedAvatarId);
        onSave(config, avatar?.image);
    };

    const selectedAvatar = getAvatarById(selectedAvatarId);
    const filteredAvatars = getAvatarsByTone(selectedSkinTone);

    // ─── Render Sections ──────────────────────────────────────────────────────────

    const renderSkinToneSelector = () => (
        <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose Your Skin Tone</Text>
            <View style={styles.skinToneRow}>
                {SKIN_TONES.map((tone) => {
                    const isAvailable = availableTones.includes(tone.id);
                    const isSelected = selectedSkinTone === tone.id;
                    return (
                        <TouchableOpacity
                            key={tone.id}
                            onPress={() => isAvailable && handleSkinToneSelect(tone.id)}
                            style={[
                                styles.skinToneDot,
                                { backgroundColor: tone.color },
                                isSelected && styles.skinToneDotSelected,
                                isSelected && { borderColor: colors.primary },
                                !isAvailable && styles.skinToneDotDisabled,
                            ]}
                            disabled={!isAvailable}
                        >
                            {isSelected && (
                                <Ionicons name="checkmark" size={18} color="#fff" />
                            )}
                            {!isAvailable && (
                                <View style={styles.comingSoonBadge}>
                                    <Ionicons name="time-outline" size={10} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Avatar grid for selected skin tone */}
            <Text style={[styles.subsectionTitle, { color: colors.textSecondary }]}>
                Pick Your Look
            </Text>
            <View style={styles.avatarGrid}>
                {filteredAvatars.map((avatar) => {
                    const isSelected = selectedAvatarId === avatar.id;
                    return (
                        <TouchableOpacity
                            key={avatar.id}
                            onPress={() => handleAvatarSelect(avatar.id)}
                            style={[
                                styles.avatarGridItem,
                                { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' },
                                isSelected && styles.avatarGridItemSelected,
                                isSelected && { borderColor: colors.primary },
                            ]}
                            activeOpacity={0.7}
                        >
                            <Image source={avatar.image} style={styles.avatarGridImage} />
                            {isSelected && (
                                <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
                {filteredAvatars.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="hourglass-outline" size={32} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            More avatars coming soon for this skin tone!
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );

    const renderStyleSelector = () => (
        <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>All Styles</Text>
            <View style={styles.avatarGrid}>
                {AVATAR_OPTIONS.map((avatar) => {
                    const isSelected = selectedAvatarId === avatar.id;
                    return (
                        <TouchableOpacity
                            key={avatar.id}
                            onPress={() => {
                                handleAvatarSelect(avatar.id);
                                setSelectedSkinTone(avatar.skinTone);
                            }}
                            style={[
                                styles.avatarGridItem,
                                { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' },
                                isSelected && styles.avatarGridItemSelected,
                                isSelected && { borderColor: colors.primary },
                            ]}
                            activeOpacity={0.7}
                        >
                            <Image source={avatar.image} style={styles.avatarGridImage} />
                            <Text style={[styles.avatarLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                                {avatar.label}
                            </Text>
                            {isSelected && (
                                <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderActiveSection = () => {
        switch (activeCategory) {
            case 'skin': return renderSkinToneSelector();
            case 'style': return renderStyleSelector();
            default: return renderSkinToneSelector();
        }
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Create Avatar</Text>
                    <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                        <Text style={[styles.saveText, { color: colors.primary }]}>Done</Text>
                    </TouchableOpacity>
                </View>

                {/* Preview Area */}
                <View style={[styles.previewArea, { backgroundColor: isDark ? '#111' : '#f8f8f8' }]}>
                    <Animated.View
                        style={[
                            styles.previewContainer,
                            { transform: [{ scale: previewScale }] },
                        ]}
                    >
                        {selectedAvatar ? (
                            <Image source={selectedAvatar.image} style={styles.previewImage} />
                        ) : (
                            <View style={styles.previewPlaceholder}>
                                <Ionicons name="person-outline" size={64} color="rgba(255,255,255,0.5)" />
                            </View>
                        )}
                    </Animated.View>
                    <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
                        {selectedAvatar ? selectedAvatar.label : 'Pick a style'}
                    </Text>
                </View>

                {/* Category Tabs */}
                <View style={[styles.categoryBar, { backgroundColor: isDark ? '#111' : '#f8f8f8', borderBottomColor: colors.border }]}>
                    {CATEGORIES.map((cat) => {
                        const isActive = activeCategory === cat.id;
                        return (
                            <TouchableOpacity
                                key={cat.id}
                                onPress={() => setActiveCategory(cat.id)}
                                style={[
                                    styles.categoryTab,
                                    isActive && styles.categoryTabActive,
                                    isActive && { borderBottomColor: colors.primary },
                                ]}
                            >
                                <Ionicons
                                    name={cat.icon as any}
                                    size={20}
                                    color={isActive ? colors.primary : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.categoryLabel,
                                        { color: isActive ? colors.primary : colors.textSecondary },
                                        isActive && styles.categoryLabelActive,
                                    ]}
                                >
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Options Area */}
                <ScrollView
                    style={styles.optionsArea}
                    contentContainerStyle={styles.optionsContent}
                    showsVerticalScrollIndicator={false}
                >
                    {renderActiveSection()}
                    <View style={{ height: insets.bottom + 20 }} />
                </ScrollView>
            </View>
        </Modal>
    );
};

// ─── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 0.5,
    },
    headerBtn: {
        minWidth: 50,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    saveText: {
        fontSize: 16,
        fontWeight: '700',
    },

    // Preview
    previewArea: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    previewContainer: {
        width: AVATAR_PREVIEW_SIZE,
        height: AVATAR_PREVIEW_SIZE,
        borderRadius: AVATAR_PREVIEW_SIZE / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    previewPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    // Category Bar
    categoryBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 0.5,
    },
    categoryTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    categoryTabActive: {
        borderBottomWidth: 2,
    },
    categoryLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    categoryLabelActive: {
        fontWeight: '700',
    },

    // Options
    optionsArea: {
        flex: 1,
    },
    optionsContent: {
        padding: 20,
    },
    sectionContainer: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    subsectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },

    // Skin Tone Dots
    skinToneRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    skinToneDot: {
        width: SKIN_DOT_SIZE,
        height: SKIN_DOT_SIZE,
        borderRadius: SKIN_DOT_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    skinToneDotSelected: {
        borderWidth: 3,
        transform: [{ scale: 1.15 }],
    },
    skinToneDotDisabled: {
        opacity: 0.4,
    },
    comingSoonBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#888',
        borderRadius: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Avatar Grid
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    avatarGridItem: {
        width: GRID_ITEM_SIZE,
        height: GRID_ITEM_SIZE + 8,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        borderWidth: 2.5,
        borderColor: 'transparent',
    },
    avatarGridItemSelected: {
        borderWidth: 2.5,
    },
    avatarGridImage: {
        width: GRID_ITEM_SIZE - 6,
        height: GRID_ITEM_SIZE - 6,
        borderRadius: 12,
        resizeMode: 'cover',
    },
    avatarLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    selectedBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },

});
