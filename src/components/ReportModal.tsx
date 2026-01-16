import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { moderation } from '../services/api';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  contentType?: 'profile' | 'message' | 'comment';
  contentId?: string;
}

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam', icon: 'warning-outline' },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'sad-outline' },
  { id: 'hate', label: 'Hate speech', icon: 'alert-circle-outline' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'eye-off-outline' },
  { id: 'impersonation', label: 'Impersonation', icon: 'person-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  userId,
  username,
  contentType,
  contentId,
}) => {
  const { colors } = useTheme();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBlockOption, setShowBlockOption] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Select a reason', 'Please select a reason for your report.');
      return;
    }

    setLoading(true);
    try {
      await moderation.report(userId, selectedReason, details || undefined, contentType, contentId);
      setShowBlockOption(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    setLoading(true);
    try {
      await moderation.block(userId);
      Alert.alert('Done', `You've blocked @${username}. You won't see their content anymore.`);
      handleClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to block user');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    setShowBlockOption(false);
    onClose();
  };

  const handleSkipBlock = () => {
    Alert.alert('Report Submitted', 'Thanks for letting us know. We\'ll review this within 24 hours.');
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismiss} onPress={handleClose} activeOpacity={1} />
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {showBlockOption ? 'Block User?' : `Report @${username}`}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {showBlockOption ? (
            <View style={styles.blockSection}>
              <Ionicons name="shield-checkmark" size={48} color={colors.primary} style={styles.blockIcon} />
              <Text style={[styles.blockTitle, { color: colors.text }]}>Report Submitted</Text>
              <Text style={[styles.blockText, { color: colors.textSecondary }]}>
                Would you also like to block @{username}? They won't be able to message you or see your profile.
              </Text>
              <TouchableOpacity
                style={[styles.blockBtn, { backgroundColor: '#FF3B30' }]}
                onPress={handleBlock}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.blockBtnText}>Block @{username}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkipBlock}>
                <Text style={[styles.skipBtnText, { color: colors.textSecondary }]}>No thanks</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Why are you reporting this user?
              </Text>

              <View style={styles.reasons}>
                {REPORT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason.id}
                    style={[
                      styles.reasonItem,
                      { borderColor: colors.border },
                      selectedReason === reason.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                    ]}
                    onPress={() => setSelectedReason(reason.id)}
                  >
                    <Ionicons
                      name={reason.icon as any}
                      size={20}
                      color={selectedReason === reason.id ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.reasonText,
                        { color: selectedReason === reason.id ? colors.primary : colors.text },
                      ]}
                    >
                      {reason.label}
                    </Text>
                    {selectedReason === reason.id && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Additional details (optional)"
                placeholderTextColor={colors.textSecondary}
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }, !selectedReason && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!selectedReason || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  reasons: {
    paddingHorizontal: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
  },
  input: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  blockSection: {
    padding: 20,
    alignItems: 'center',
  },
  blockIcon: {
    marginBottom: 16,
  },
  blockTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  blockText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  blockBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  blockBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipBtn: {
    padding: 12,
  },
  skipBtnText: {
    fontSize: 15,
  },
});
