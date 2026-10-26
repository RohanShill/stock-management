import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatUnitBadge } from '../utils/formatters.js';

export interface ProductSuccessInfo {
  mode: 'create' | 'update';
  productName: string;
  brand?: string;
  categoryName?: string;
  unit?: string;
  variantCount: number;
}

interface ProductSuccessModalProps {
  visible: boolean;
  info: ProductSuccessInfo | null;
  onDismiss: () => void;
  isDarkMode: boolean;
  activeColors: any;
}

export const ProductSuccessModal: React.FC<ProductSuccessModalProps> = React.memo(({
  visible,
  info,
  onDismiss,
  isDarkMode,
  activeColors,
}) => {
  if (!info) return null;

  const isCreate = info.mode === 'create';

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
          {/* 1. Glowing Emerald Status Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDarkMode ? '#064E3B' : '#DCFCE7',
                borderColor: isDarkMode ? '#059669' : '#86EFAC',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="check-decagram"
              size={36}
              color="#10B981"
            />
          </View>

          {/* 2. Title & Subtitle */}
          <Text style={[styles.title, { color: activeColors.textPrimary }]}>
            {isCreate ? 'Product Added Successfully' : 'Product Updated Successfully'}
          </Text>
          <Text style={[styles.subtitle, { color: activeColors.textSecondary }]}>
            {isCreate
              ? 'Added to your catalogue and ready for stock billing & tracking.'
              : 'Product details and variant configuration updated.'}
          </Text>

          {/* 3. Product Summary Box */}
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.productName, { color: activeColors.textPrimary }]} numberOfLines={2}>
              "{info.productName}"
            </Text>

            {/* Badges: Brand, Category, Unit */}
            <View style={styles.badgesRow}>
              {info.brand ? (
                <View
                  style={[
                    styles.tagBadge,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF', borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE' },
                  ]}
                >
                  <Text style={[styles.tagText, { color: activeColors.primary }]}>
                    {info.brand}
                  </Text>
                </View>
              ) : null}

              {info.categoryName ? (
                <View
                  style={[
                    styles.tagBadge,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: activeColors.border },
                  ]}
                >
                  <Text style={[styles.tagText, { color: activeColors.textSecondary }]}>
                    {info.categoryName}
                  </Text>
                </View>
              ) : null}

              {info.unit ? (
                <View
                  style={[
                    styles.tagBadge,
                    { backgroundColor: isDarkMode ? '#111827' : '#F8FAFC', borderColor: activeColors.border },
                  ]}
                >
                  <Text style={[styles.tagText, { color: activeColors.textMuted }]}>
                    {formatUnitBadge(info.unit)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

            {/* Variant count & status */}
            <View style={styles.infoRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="layers-outline" size={16} color={activeColors.textSecondary} />
                <Text style={[styles.infoLabel, { color: activeColors.textSecondary }]}>
                  Variants:
                </Text>
              </View>
              <Text style={[styles.infoValue, { color: activeColors.textPrimary }]}>
                {info.variantCount} size variant{info.variantCount > 1 ? 's' : ''}
              </Text>
            </View>

            <View style={[styles.infoRow, { marginTop: 6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.statusDot} />
                <Text style={[styles.infoLabel, { color: activeColors.textSecondary }]}>
                  Status:
                </Text>
              </View>
              <Text style={[styles.infoValue, { color: '#10B981', fontWeight: '700' }]}>
                Active in Store
              </Text>
            </View>
          </View>
        </Dialog.Content>

        {/* 4. Action Button */}
        <Dialog.Actions style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: '#10B981' }]}
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
  productName: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 4,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  actionsRow: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  doneButton: {
    width: '100%',
    height: 48,
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
