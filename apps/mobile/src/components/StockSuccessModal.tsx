import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatUnitLabel } from '../utils/formatters.js';

export interface StockSuccessInfo {
  mode: 'sell' | 'add';
  qty: number;
  unit: string;
  productName: string;
  variantName?: string;
  previousStock?: number;
  newStock?: number;
}

interface StockSuccessModalProps {
  visible: boolean;
  info: StockSuccessInfo | null;
  onDismiss: () => void;
  onViewHistory: () => void;
  isDarkMode: boolean;
  activeColors: any;
}

export const StockSuccessModal: React.FC<StockSuccessModalProps> = React.memo(({
  visible,
  info,
  onDismiss,
  onViewHistory,
  isDarkMode,
  activeColors,
}) => {
  if (!info) return null;

  const isSell = info.mode === 'sell';
  const unitLabel = formatUnitLabel(info.unit);

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          {
            backgroundColor: activeColors.surface,
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <Dialog.Content style={styles.dialogContent}>
          {/* 1. Glowing Status Badge Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isSell
                  ? (isDarkMode ? '#064E3B' : '#DCFCE7')
                  : (isDarkMode ? '#1E3A8A' : '#EFF6FF'),
                borderColor: isSell
                  ? (isDarkMode ? '#059669' : '#86EFAC')
                  : (isDarkMode ? '#3B82F6' : '#BFDBFE'),
              },
            ]}
          >
            <MaterialCommunityIcons
              name={isSell ? 'check-decagram' : 'plus-circle'}
              size={36}
              color={isSell ? '#10B981' : activeColors.primary}
            />
          </View>

          {/* 2. Title & Subtitle */}
          <Text style={[styles.title, { color: activeColors.textPrimary }]}>
            {isSell ? 'Sale Recorded Successfully' : 'Stock Added Successfully'}
          </Text>
          <Text style={[styles.subtitle, { color: activeColors.textSecondary }]}>
            {isSell
              ? 'Stock has been deducted and logged in transaction history.'
              : 'Inventory balance has been increased and saved locally.'}
          </Text>

          {/* 3. Transaction Summary Card */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            {/* Quantity Row */}
            <View style={styles.qtyRow}>
              <Text style={[styles.qtyLabel, { color: activeColors.textSecondary }]}>
                {isSell ? 'QUANTITY SOLD' : 'QUANTITY ADDED'}
              </Text>
              <View
                style={[
                  styles.qtyBadge,
                  {
                    backgroundColor: isSell
                      ? (isDarkMode ? '#052E16' : '#DCFCE7')
                      : (isDarkMode ? '#1E3A8A' : '#DBEAFE'),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.qtyValue,
                    { color: isSell ? '#15803D' : activeColors.primary },
                  ]}
                >
                  {isSell ? '' : '+'}{info.qty} {unitLabel}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

            {/* Product & Variant Name */}
            <View style={styles.productInfoBox}>
              <Text style={[styles.productName, { color: activeColors.textPrimary }]} numberOfLines={2}>
                {info.productName}
              </Text>
              {info.variantName ? (
                <View style={styles.variantTag}>
                  <Text style={[styles.variantName, { color: activeColors.textSecondary }]}>
                    Size: {info.variantName}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Updated Stock Row if available */}
            {info.newStock !== undefined && (
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceLabel, { color: activeColors.textMuted }]}>
                  Updated Available Stock:
                </Text>
                <Text style={[styles.balanceValue, { color: activeColors.textPrimary }]}>
                  {info.newStock} {unitLabel}
                </Text>
              </View>
            )}
          </View>
        </Dialog.Content>

        {/* 4. Action Buttons */}
        <Dialog.Actions style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.historyButton,
              {
                borderColor: activeColors.border,
                backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
              },
            ]}
            onPress={onViewHistory}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="history"
              size={18}
              color={activeColors.textPrimary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.historyButtonText, { color: activeColors.textPrimary }]}>
              View History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.doneButton,
              {
                backgroundColor: isSell ? '#10B981' : activeColors.primary,
              },
            ]}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 16,
    paddingBottom: 8,
    marginHorizontal: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  dialogContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  summaryCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  qtyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  productInfoBox: {
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  variantTag: {
    marginTop: 4,
  },
  variantName: {
    fontSize: 13,
    fontWeight: '500',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    gap: 12,
  },
  historyButton: {
    flex: 1,
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
