// My Avatar: the player's saved avatar on the 3D stage, with its phone-budget numbers.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvatarStage } from './AvatarStage';
import { useAvatar } from '../avatar/store';

interface MyAvatarModalProps {
  visible: boolean;
  onClose: () => void;
}

const TRI_BUDGET = 25000;

export function MyAvatarModal({ visible, onClose }: MyAvatarModalProps) {
  const avatar = useAvatar();
  const [stats, setStats] = useState<{ tris: number; meshes: number } | null>(null);
  const overBudget = !!stats && stats.tris > TRI_BUDGET;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.headerTitle}>MY AVATAR</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.viewport}>
          {visible && <AvatarStage style={styles.webView} avatar={avatar} onStats={setStats} />}
          <View style={styles.dragHint} pointerEvents="none">
            <Ionicons name="sync-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.dragHintText}>DRAG TO ROTATE</Text>
          </View>
        </View>

        <View style={styles.specsCard}>
          <View style={styles.specHeader}>
            <Text style={styles.specTitle}>PHONE BUDGET</Text>
            {stats && (
              <Text style={[styles.specPassTag, overBudget && { color: '#fbbf24' }]}>
                {overBudget ? 'OVER BUDGET' : 'WITHIN BUDGET'}
              </Text>
            )}
          </View>
          <View style={styles.specGrid}>
            <View style={styles.specBox}>
              <Text style={styles.specVal}>{stats ? stats.tris.toLocaleString() : '…'}</Text>
              <Text style={styles.specLabel}>Triangles (≤ 25k)</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specVal}>{stats ? stats.meshes : '…'}</Text>
              <Text style={styles.specLabel}>Meshes (before merge)</Text>
            </View>
          </View>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c081e',
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47,211,138,0.15)',
    borderWidth: 1,
    borderColor: '#2fd38a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    gap: 4,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#2fd38a',
  },
  badgeText: {
    color: '#2fd38a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  viewport: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0c081e',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0c081e',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0c081e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#a49dd1',
    fontSize: 13,
    fontWeight: '600',
  },
  dragHint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18,13,44,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dragHintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  specsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
  },
  specHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  specTitle: {
    color: '#a49dd1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  specPassTag: {
    color: '#2fd38a',
    fontSize: 10,
    fontWeight: '800',
  },
  specGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  specBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  specVal: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  specLabel: {
    color: '#8b83ba',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  animSection: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  animSectionTitle: {
    color: '#a49dd1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  animRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  animBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  animBtnActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  animBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  animBtnTextActive: {
    color: '#0c081e',
  },
});
