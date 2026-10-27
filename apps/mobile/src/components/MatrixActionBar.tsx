import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatrixCellData } from '../database/repositories/matrixRepository.js';
import { borderRadius, getThemeShadows } from '../theme/tokens.js';

interface MatrixActionBarProps {
  selectedCell: MatrixCellData | null;
  selectedSize: string;
  selectedBrand: string;
  onStockIn: () => void;
  onSell: () => void;
  isDarkMode: boolean;
  activeColors: any;
}

export const MatrixActionBar: React.FC<MatrixActionBarProps> = ({
  selectedCell,
  selectedSize,
  selectedBrand,
  onStockIn,
  onSell,
  isDarkMode,
  activeColors,
}) => {
  const themeShadows = getThemeShadows(isDarkMode);
  const isSelected = Boolean(selectedCell || (selectedSize && selectedBrand));
  const currentStock = selectedCell ? selectedCell.currentStock : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: activeColors.surface,
          borderColor: activeColors.border,
        },
        themeShadows.floating,
      ]}
    >
      {/* Selected Item Info Banner */}
      <View style={styles.infoRow}>
        {isSelected ? (
          <View style={styles.selectedWrap}>
            <View style={styles.badgeLabel}>
              <Text
                style={[
                  styles.itemTitle,
                  { color: activeColors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {selectedSize} • {selectedBrand}
              </Text>
            </View>
            <View
              style={[
                styles.stockPill,
                {
                  backgroundColor: currentStock > 0
                    ? isDarkMode
                      ? '#064E3B'
                      : '#ECFDF5'
                    : isDarkMode
                    ? '#7F1D1D'
                    : '#FEF2F2',
                },
              ]}
            >
              <Text
                style={[
                  styles.stockPillText,
                  {
                    color: currentStock > 0
                      ? isDarkMode
                        ? '#34D399'
                        : '#059669'
                      : isDarkMode
                      ? '#F87171'
                      : '#DC2626',
                  },
                ]}
              >
                Stock: {currentStock}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.promptWrap}>
            <MaterialCommunityIcons
              name="gesture-tap"
              size={18}
              color={activeColors.textMuted}
            />
            <Text
              style={[
                styles.promptText,
                { color: activeColors.textMuted },
              ]}
            >
              Table me se koi v cell tap karein
            </Text>
          </View>
        )}
      </View>

      {/* Buttons Matching Client's Sketch: [ stock ] (Green) & [ sell ] (Red) */}
      <View style={styles.buttonsRow}>
        {/* [ stock ] button */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={!isSelected}
          onPress={onStockIn}
          style={[
            styles.actionButton,
            {
              backgroundColor: isSelected
                ? isDarkMode
                  ? '#064E3B'
                  : '#ECFDF5'
                : isDarkMode
                ? activeColors.surfaceElevated
                : activeColors.surfaceSubtle,
              borderColor: isSelected
                ? '#059669'
                : activeColors.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={20}
            color={isSelected ? '#059669' : activeColors.textMuted}
          />
          <Text
            style={[
              styles.actionButtonText,
              {
                color: isSelected ? '#059669' : activeColors.textMuted,
                fontWeight: '800',
              },
            ]}
          >
            stock
          </Text>
        </TouchableOpacity>

        {/* [ sell ] button */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={!isSelected}
          onPress={onSell}
          style={[
            styles.actionButton,
            {
              backgroundColor: isSelected
                ? isDarkMode
                  ? '#7F1D1D'
                  : '#FEF2F2'
                : isDarkMode
                ? activeColors.surfaceElevated
                : activeColors.surfaceSubtle,
              borderColor: isSelected
                ? '#DC2626'
                : activeColors.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="cart-arrow-down"
            size={20}
            color={isSelected ? '#DC2626' : activeColors.textMuted}
          />
          <Text
            style={[
              styles.actionButtonText,
              {
                color: isSelected ? '#DC2626' : activeColors.textMuted,
                fontWeight: '800',
              },
            ]}
          >
            sell
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
    borderRadius: borderRadius.xl,
    padding: 12,
    borderWidth: 1.5,
  },
  infoRow: {
    marginBottom: 10,
  },
  selectedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeLabel: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  stockPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  stockPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  promptWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  promptText: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
