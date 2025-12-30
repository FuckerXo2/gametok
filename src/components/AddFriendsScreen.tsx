import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { users } from '../services/api';
import { Avatar } from './Avatar';

interface UserResult {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  followers: number;
}

interface AddFriendsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const AddFriendsScreen: React.FC<AddFriendsScreenProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addedUsers, setAddedUsers] = useState<Set<string>>(new Set());

  // Search when query changes
  useEffect(() => {
    const search = async () => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const data = await users.search(searchQuery.trim());
        setResults(data.users || []);
      } catch (error) {
        console.log('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleAdd = async (userId: string) => {
    try {
      await users.follow(userId);
      setAddedUsers(prev => new Set([...prev, userId]));
    } catch (error) {
      console.log('Follow error:', error);
    }
  };

  const renderUser = ({ item }: { item: UserResult }) => {
    const isAdded = addedUsers.has(item.id);
    
    return (
      <View style={[styles.userItem, { borderBottomColor: colors.border }]}>
        <Avatar uri={item.avatar} size={50} style={styles.userAvatar} />
        
        <View style={styles.userInfo}>
          <Text style={[styles.displayName, { color: colors.text }]}>
            {item.displayName || item.username}
          </Text>
          <Text style={[styles.username, { color: colors.textSecondary }]}>
            @{item.username}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.addBtn,
            isAdded 
              ? { backgroundColor: colors.surface } 
              : { backgroundColor: colors.primary }
          ]}
          onPress={() => !isAdded && handleAdd(item.id)}
          disabled={isAdded}
        >
          {isAdded ? (
            <Ionicons name="checkmark" size={18} color={colors.textSecondary} />
          ) : (
            <Text style={styles.addBtnText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="arrow-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Friends</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by username"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : searchQuery.length < 2 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Search for friends by username
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>😕</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No users found for "{searchQuery}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Quick Add Section */}
        <View style={[styles.quickAddSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.quickAddTitle, { color: colors.text }]}>Quick Add</Text>
          
          <TouchableOpacity style={[styles.quickAddOption, { backgroundColor: colors.surface }]}>
            <View style={[styles.quickAddIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="qr-code" size={24} color="#fff" />
            </View>
            <View style={styles.quickAddInfo}>
              <Text style={[styles.quickAddLabel, { color: colors.text }]}>Scan QR Code</Text>
              <Text style={[styles.quickAddDesc, { color: colors.textSecondary }]}>
                Add friends instantly
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickAddOption, { backgroundColor: colors.surface }]}>
            <View style={[styles.quickAddIcon, { backgroundColor: '#4CD964' }]}>
              <Ionicons name="people" size={24} color="#fff" />
            </View>
            <View style={styles.quickAddInfo}>
              <Text style={[styles.quickAddLabel, { color: colors.text }]}>Contacts</Text>
              <Text style={[styles.quickAddDesc, { color: colors.textSecondary }]}>
                Find friends from contacts
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickAddOption, { backgroundColor: colors.surface }]}>
            <View style={[styles.quickAddIcon, { backgroundColor: '#5856D6' }]}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </View>
            <View style={styles.quickAddInfo}>
              <Text style={[styles.quickAddLabel, { color: colors.text }]}>Share Username</Text>
              <Text style={[styles.quickAddDesc, { color: colors.textSecondary }]}>
                Let friends find you
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    fontSize: 13,
    marginTop: 1,
  },
  addBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickAddSection: {
    borderTopWidth: 0.5,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  quickAddTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  quickAddOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  quickAddIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  quickAddInfo: {
    flex: 1,
  },
  quickAddLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  quickAddDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
