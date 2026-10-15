import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import { Text, Surface, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isDemoMode, DEMO_NOTICE_TEXT } from './demoConfig.js';
import { resetDemoData } from './demoManager.js';
import { colors, spacing, borderRadius } from '../theme/tokens.js';

interface DemoBannerProps {
  onResetComplete?: () => void;
}

export function DemoBanner({ onResetComplete }: DemoBannerProps) {
  if (!isDemoMode()) {
    return null;
  }

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      const res = await resetDemoData();
      setResetting(false);
      setConfirmVisible(false);

      if (res.success) {
        Alert.alert(
          'Demo Reset Complete',
          'All sample products, categories, stock levels, purchases and sales have been restored to factory evaluation state.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (typeof window !== 'undefined' && window.location) {
                  window.location.reload();
                }
                onResetComplete?.();
              },
            },
          ]
        );
      } else {
        Alert.alert('Reset Failed', res.message);
      }
    } catch (e: unknown) {
      setResetting(false);
      setConfirmVisible(false);
      const msg = e instanceof Error ? e.message : 'Reset failed';
      Alert.alert('Reset Error', msg);
    }
  };

  return (
    <>
      <Surface style={styles.bannerContainer} elevation={2}>
        <View style={styles.leftCol}>
          <View style={styles.pillBadge}>
            <MaterialCommunityIcons name="shield-alert-outline" size={14} color="#B45309" />
            <Text style={styles.bannerBadgeText}>{DEMO_NOTICE_TEXT}</Text>
          </View>
          <Text style={styles.subText}>Isolated Sandbox • Offline Local Storage</Text>
        </View>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => setConfirmVisible(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="restore" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.resetButtonText}>Reset Data</Text>
        </TouchableOpacity>
      </Surface>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !resetting && setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Surface style={styles.modalContent} elevation={5}>
            <View style={styles.modalIconCircle}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#D97706" />
            </View>

            <Text style={styles.modalTitle}>Reset Demo Data?</Text>
            <Text style={styles.modalBody}>
              This will safely restore all sample hardware items, stock counts, suppliers,
              purchases, and sales to their original clean demo state.
            </Text>

            <View style={styles.modalSecurityNote}>
              <MaterialCommunityIcons name="lock-check" size={14} color="#059669" />
              <Text style={styles.modalSecurityNoteText}>
                Safe Action: No production or client data will be affected.
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <Button
                mode="outlined"
                disabled={resetting}
                onPress={() => setConfirmVisible(false)}
                style={styles.cancelBtn}
                textColor={colors.textSecondary}
              >
                Cancel
              </Button>

              <Button
                mode="contained"
                loading={resetting}
                disabled={resetting}
                onPress={handleConfirmReset}
                style={styles.confirmBtn}
                buttonColor="#D97706"
              >
                Reset Now
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 999,
  },
  leftCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  subText: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 1,
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  modalSecurityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
    width: '100%',
  },
  modalSecurityNoteText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    borderColor: colors.border,
  },
  confirmBtn: {
    flex: 1,
  },
});
