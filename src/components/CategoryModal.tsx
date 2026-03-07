import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SlideRightModal } from './SlideRightModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

interface GameItem {
    id: string;
    name: string;
    thumbnail?: string;
    color?: string;
    category?: string;
    plays?: number;
}

interface CategoryModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    games: GameItem[];
    onPlayGame: (game: GameItem) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
    visible,
    onClose,
    title,
    games,
    onPlayGame,
}) => {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const renderGame = ({ item }: { item: GameItem }) => (
        <TouchableOpacity
            style={[cardStyles.card, { backgroundColor: colors.surface }]}
            onPress={() => onPlayGame(item)}
            activeOpacity={0.8}
        >
            <View style={[cardStyles.imageContainer, { backgroundColor: colors.border }]}>
                {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={cardStyles.image} />
                ) : (
                    <Ionicons name="game-controller" size={28} color={colors.textSecondary} />
                )}
            </View>
            <Text style={[cardStyles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SlideRightModal visible={visible} onClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity style={styles.backBtn} onPress={onClose}>
                        <Ionicons name="chevron-back" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <View style={styles.backBtn} />
                </View>

                <Text style={[styles.count, { color: colors.textSecondary }]}>
                    {games.length} game{games.length !== 1 ? 's' : ''}
                </Text>

                {/* Game Grid */}
                <FlatList
                    data={games}
                    renderItem={renderGame}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </SlideRightModal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingBottom: 12,
        paddingTop: 8,
        borderBottomWidth: 1,
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 17, fontWeight: '700' },
    count: { fontSize: 13, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
    list: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 },
    row: { justifyContent: 'space-between', marginBottom: 16 },
});

const cardStyles = StyleSheet.create({
    card: { width: CARD_WIDTH, borderRadius: 12, overflow: 'hidden' },
    imageContainer: {
        width: CARD_WIDTH,
        height: CARD_WIDTH,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    image: { width: '100%', height: '100%', borderRadius: 12 },
    name: { fontSize: 13, fontWeight: '600', marginTop: 6, paddingHorizontal: 2 },
});

export default CategoryModal;
