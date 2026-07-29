import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface RemixModalProps {
  visible: boolean;
  gameName?: string;
  gameThumbnail?: string | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Branded confirm sheet for remixing a game — replaces the stock OS Alert so the
 * flow matches the app's dark/neon look. Same copy, GameTOK's clothes.
 */
export const RemixModal: React.FC<RemixModalProps> = ({
  visible, gameName, gameThumbnail, loading = false, onCancel, onConfirm,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {gameThumbnail ? (
            <View style={styles.thumbWrap}>
              <Image source={{ uri: gameThumbnail }} style={styles.thumb} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(13,13,19,0.95)']}
                style={StyleSheet.absoluteFill as any}
              />
            </View>
          ) : null}

          <View style={styles.headerRow}>
            <View style={styles.glyph}>
              <Ionicons name="git-branch" size={18} color="#fff" />
            </View>
            <Text style={styles.title}>Remix this game?</Text>
          </View>

          <Text style={styles.body}>
            Make your own editable copy of{' '}
            <Text style={styles.bodyStrong}>“{gameName || 'this game'}”</Text>
            {' '}to tweak and publish as your own.
          </Text>

          <View style={styles.creditRow}>
            <Ionicons name="ribbon-outline" size={13} color="#0db8f6" />
            <Text style={styles.creditText}>The original creator gets credited.</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.remixBtnWrap} onPress={onConfirm} disabled={loading} activeOpacity={0.85}>
              <LinearGradient
                colors={['#0db8f6', '#ec2c7a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.remixBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="git-branch" size={17} color="#fff" />
                    <Text style={styles.remixText}>Remix</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: '#0d0d13', borderRadius: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', paddingBottom: 18,
  },
  thumbWrap: { width: '100%', height: 132, marginBottom: 4 },
  thumb: { width: '100%', height: '100%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, marginTop: 16 },
  glyph: {
    width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(13,184,246,0.16)', borderWidth: 1, borderColor: 'rgba(13,184,246,0.4)',
  },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', flex: 1 },
  body: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 21, paddingHorizontal: 20, marginTop: 12 },
  bodyStrong: { color: '#fff', fontWeight: '700' },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginTop: 12 },
  creditText: { color: 'rgba(13,184,246,0.95)', fontSize: 12.5, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20 },
  cancelBtn: {
    flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelText: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '700' },
  remixBtnWrap: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  remixBtn: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  remixText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
