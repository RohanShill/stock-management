import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatrixCellData } from '../database/repositories/matrixRepository.js';
import { borderRadius, getThemeShadows } from '../theme/tokens.js';

interface MatrixActionBarProps {
  selectedCell: MatrixCellData | null;
  selectedSize: string;
  selectedBrand: string;
  onStockIn: () => void;
  onSell: () => void;
  onPricePress?: () => void;
  isDarkMode: boolean;
  activeColors: any;
}

export const MatrixActionBar: React.FC<MatrixActionBarProps> = React.memo(({
  selectedCell,
  selectedSize,
  selectedBrand,
  onStockIn,
  onSell,
  onPricePress,
  isDarkMode,
  activeColors,
}) => {
  const themeShadows = getThemeShadows(isDarkMode);
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;

  const isSelected = Boolean(selectedCell || (selectedSize && selectedBrand));
  const currentStock = selectedCell ? selectedCell.currentStock : 0;
  const sellingPricePaise = selectedCell ? (selectedCell.sellingPricePaise || 0) : 0;
  const priceRupees = sellingPricePaise > 0 ? (sellingPricePaise / 100) : 0;
  const customDisplay = selectedCell?.priceDisplay ? selectedCell.priceDisplay.trim() : '';

  let formattedPrice = '';
  if (customDisplay) {
    formattedPrice = customDisplay.startsWith('₹') || customDisplay.toLowerCase().startsWith('rs')
      ? customDisplay
      : `₹${customDisplay}`;
  } else if (priceRupees > 0) {
    formattedPrice = `₹${Number.isInteger(priceRupees) ? priceRupees : priceRupees.toFixed(2)}`;
  }
  const hasPrice = Boolean(formattedPrice);

  return (
    <View
      style={[
        styles.container,
        {
          width: isTablet ? Math.min(width - 40, 780) : undefined,
          alignSelf: isTablet ? 'center' : 'stretch',
          marginHorizontal: isTablet ? 0 : 14,
          padding: isTablet ? 15 : 12,
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
                  {
                    fontSize: isTablet ? 17 : 15,
                    color: activeColors.textPrimary,
                  },
                ]}
                numberOfLines={1}
              >
                {selectedSize} • {selectedBrand}
              </Text>
            </View>
            <View style={styles.pillsRow}>
              {(() => {
                const hasHistory = Boolean(selectedCell?.hasStockHistory);
                const isOutOfStock = hasHistory && currentStock === 0;

                const bg = currentStock > 0
                  ? (isDarkMode ? '#064E3B' : '#ECFDF5')
                  : isOutOfStock
                  ? (isDarkMode ? '#7F1D1D' : '#FEF2F2')
                  : (isDarkMode ? '#1E293B' : '#F1F5F9');

                const textColor = currentStock > 0
                  ? (isDarkMode ? '#34D399' : '#059669')
                  : isOutOfStock
                  ? (isDarkMode ? '#F87171' : '#DC2626')
                  : activeColors.textSecondary;

                const label = currentStock > 0
                  ? `Stock: ${currentStock}`
                  : isOutOfStock
                  ? 'Stock: 0'
                  : 'Stock: -';

                return (
                  <View
                    style={[
                      styles.stockPill,
                      {
                        paddingHorizontal: isTablet ? 12 : 10,
                        paddingVertical: isTablet ? 5 : 4,
                        backgroundColor: bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stockPillText,
                        {
                          fontSize: isTablet ? 13.5 : 12.5,
                          color: textColor,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })()}

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onPricePress || onStockIn}
                style={[
                  styles.pricePill,
                  {
                    paddingHorizontal: isTablet ? 12 : 10,
                    paddingVertical: isTablet ? 5 : 4,
                    backgroundColor: hasPrice
                      ? isDarkMode
                        ? '#1E1B4B'
                        : '#EEF2FF'
                      : isDarkMode
                      ? activeColors.surfaceSubtle
                      : '#F8FAFC',
                    borderColor: hasPrice
                      ? isDarkMode
                        ? '#4338CA'
                        : '#C7D2FE'
                      : activeColors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pricePillText,
                    {
                      fontSize: isTablet ? 13.5 : 12.5,
                      color: hasPrice
                        ? isDarkMode
                          ? '#A5B4FC'
                          : '#4338CA'
                        : activeColors.textMuted,
                    },
                  ]}
                >
                  {hasPrice ? formattedPrice : '+ Price'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.promptWrap}>
            <MaterialCommunityIcons
              name="gesture-tap"
              size={isTablet ? 20 : 18}
              color={activeColors.textMuted}
            />
            <Text
              style={[
                styles.promptText,
                {
                  fontSize: isTablet ? 14.5 : 13,
                  color: activeColors.textMuted,
                },
              ]}
            >
              Tap any cell in the table to manage stock
            </Text>
          </View>
        )}
      </View>

      {/* Buttons: [ + Stock ] (Green) & [ Sell Out ] (Red) */}
      <View style={styles.buttonsRow}>
        {/* [ + Stock ] button */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={!isSelected}
          onPress={onStockIn}
          style={[
            styles.actionButton,
            {
              paddingVertical: isTablet ? 14 : 12,
              backgroundColor: isSelected
                ? isDarkMode
                  ? '#059669'
                  : '#10B981'
                : isDarkMode
                ? activeColors.surfaceElevated
                : activeColors.surfaceSubtle,
              borderColor: isSelected
                ? isDarkMode
                  ? '#10B981'
                  : '#059669'
                : activeColors.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={isTablet ? 22 : 20}
            color={isSelected ? '#FFFFFF' : activeColors.textMuted}
          />
          <Text
            style={[
              styles.actionButtonText,
              {
                fontSize: isTablet ? 17 : 16,
                color: isSelected ? '#FFFFFF' : activeColors.textMuted,
                fontWeight: '800',
              },
            ]}
          >
            + Stock
          </Text>
        </TouchableOpacity>

        {/* [ Sell Out ] button */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={!isSelected}
          onPress={onSell}
          style={[
            styles.actionButton,
            {
              paddingVertical: isTablet ? 14 : 12,
              backgroundColor: isSelected
                ? isDarkMode
                  ? '#DC2626'
                  : '#EF4444'
                : isDarkMode
                ? activeColors.surfaceElevated
                : activeColors.surfaceSubtle,
              borderColor: isSelected
                ? isDarkMode
                  ? '#F87171'
                  : '#DC2626'
                : activeColors.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="cart-arrow-down"
            size={isTablet ? 22 : 20}
            color={isSelected ? '#FFFFFF' : activeColors.textMuted}
          />
          <Text
            style={[
              styles.actionButtonText,
              {
                fontSize: isTablet ? 17 : 16,
                color: isSelected ? '#FFFFFF' : activeColors.textMuted,
                fontWeight: '800',
              },
            ]}
          >
            Sell Out
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

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
    marginBottom: 8,
  },
  selectedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  badgeLabel: {
    flex: 1,
    marginRight: 6,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  stockPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  stockPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  pricePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  pricePillText: {
    fontSize: 12.5,
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
    gap: 10,
    width: '100%',
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
