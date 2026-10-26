import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore.js';
import { lightColors, darkColors } from '../theme/tokens.js';

export const AppConfirmModal: React.FC = () => {
  const confirmConfig = useAppStore((s) => s.confirmConfig);
  const hideConfirm = useAppStore((s) => s.hideConfirm);
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;

  const [isLoading, setIsLoading] = useState(false);

  if (!confirmConfig) return null;

  const {
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    onConfirm,
    onCancel,
  } = confirmConfig;

  const handleCancel = () => {
    if (isLoading) return;
    if (onCancel) onCancel();
    hideConfirm();
  };

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      await Promise.resolve(onConfirm());
    } finally {
      setIsLoading(false);
      hideConfirm();
    }
  };

  const iconName = isDestructive ? 'trash-can-outline' : 'help-circle-outline';
  const iconColor = isDestructive ? colors.danger : colors.primary;
  const iconBg = isDestructive
    ? isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2'
    : isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF';

  return (
    <Modal
      transparent
      animationType="fade"
      visible={!!confirmConfig}
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                <MaterialCommunityIcons name={iconName} size={28} color={iconColor} />
              </View>

              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {title}
              </Text>

              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.cancelButton,
                    { borderColor: colors.border, backgroundColor: colors.surfaceSubtle },
                  ]}
                  onPress={handleCancel}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelText, { color: colors.textPrimary }]}>
                    {cancelText}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    {
                      backgroundColor: isDestructive ? colors.danger : colors.primary,
                    },
                  ]}
                  onPress={handleConfirm}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmText}>{confirmText}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999998,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 25,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {},
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
