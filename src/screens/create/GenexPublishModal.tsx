import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { genexColors, genexRadii, genexSpacing } from './genexTheme';

interface GenexPublishModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  onChangeTitle: (title: string) => void;
  onPublish: () => void;
  isPublishing: boolean;
}

export const GenexPublishModal: React.FC<GenexPublishModalProps> = ({
  visible,
  onClose,
  title,
  onChangeTitle,
  onPublish,
  isPublishing,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Publish Game</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={genexColors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Title Field */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>GAME TITLE</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={onChangeTitle}
              placeholder="Name your game..."
              placeholderTextColor={genexColors.dimForeground}
            />
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="sparkles" size={18} color={genexColors.accentHover} />
            <Text style={styles.infoCardText}>
              Publishing bundles your Three.js game files and makes it playable instantly for everyone on the global GameTok feed.
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isPublishing}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.publishBtn, (!title.trim() || isPublishing) && styles.publishBtnDisabled]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onPublish();
              }}
              disabled={!title.trim() || isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="globe-outline" size={16} color="#ffffff" />
                  <Text style={styles.publishBtnText}>Publish Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: genexSpacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: genexColors.popover,
    borderRadius: genexRadii.card,
    borderWidth: 1,
    borderColor: genexColors.borderStrong,
    padding: genexSpacing.lg,
    gap: genexSpacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: genexColors.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: genexRadii.pill,
    backgroundColor: genexColors.controlQuiet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: genexColors.dimForeground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.md,
    borderWidth: 1,
    borderColor: genexColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: genexColors.foreground,
    fontSize: 15,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: genexColors.card,
    borderRadius: genexRadii.md,
    padding: genexSpacing.md,
    borderWidth: 1,
    borderColor: genexColors.border,
  },
  infoCardText: {
    flex: 1,
    color: genexColors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.controlQuiet,
  },
  cancelBtnText: {
    color: genexColors.mutedForeground,
    fontSize: 13,
    fontWeight: '600',
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: genexRadii.button,
    backgroundColor: genexColors.accentFill,
  },
  publishBtnDisabled: {
    opacity: 0.4,
  },
  publishBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
