import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Surface, Searchbar, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import { useAppStore } from '../../src/store/useAppStore.js';
import { lightColors, darkColors, colors, spacing, borderRadius, shadows } from '../../src/theme/tokens.js';
import { StockMovement } from '@hardware-store/shared';

type HistoryItem = StockMovement & {
  productName: string;
  variantName: string;
  size?: string;
  unit: string;
  brand?: string;
};

export default function HistoryScreen() {
  const { store, isDarkMode } = useAppStore();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web'
    ? 0
    : Math.max(
        insets.top || 0,
        (Platform.OS === 'android' ? RNStatusBar.currentHeight : 0) || 0,
        40
      );
  const activeColors = isDarkMode ? darkColors : lightColors;

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'restock'>('all');

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const storeId = store?.id || 'store-1';
      const items = await InventoryRepository.getAllStockHistory(storeId, 150);
      setHistory(items);
    } catch (e) {
      console.error('Error loading stock history:', e);
    } finally {
      setLoading(false);
    }
  }, [store]);

  // Load on mount and on window focus (for web tab switching)
  useEffect(() => {
    loadHistory();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const handleFocus = () => loadHistory();
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  // Filtered Items
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // 1. Filter by Type
      if (filterType === 'sale') {
        if (item.movementType !== 'sale' && item.quantityChangeBase >= 0) return false;
      } else if (filterType === 'restock') {
        if (item.movementType === 'sale' || item.quantityChangeBase < 0) return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchProduct = item.productName.toLowerCase().includes(query);
        const matchVariant = (item.variantName || '').toLowerCase().includes(query);
        const matchBrand = (item.brand || '').toLowerCase().includes(query);
        const matchReason = (item.reason || '').toLowerCase().includes(query);
        const matchNotes = (item.notes || '').toLowerCase().includes(query);
        if (!matchProduct && !matchVariant && !matchBrand && !matchReason && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [history, filterType, searchQuery]);

  // Compute Summary Statistics
  const stats = useMemo(() => {
    let totalSalesUnits = 0;
    let totalRestockUnits = 0;
    let salesCount = 0;
    let restockCount = 0;

    history.forEach((h) => {
      if (h.movementType === 'sale' || h.quantityChangeBase < 0) {
        totalSalesUnits += Math.abs(h.quantityChangeBase);
        salesCount += 1;
      } else {
        totalRestockUnits += h.quantityChangeBase;
        restockCount += 1;
      }
    });

    return {
      totalSalesUnits,
      totalRestockUnits,
      salesCount,
      restockCount,
      totalTransactions: history.length,
    };
  }, [history]);

  const formatTimestamp = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return isoDate;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* 1. Header Card */}
      <Surface
        style={[
          styles.headerCard,
          {
            backgroundColor: activeColors.surface,
            borderBottomColor: activeColors.border,
            paddingTop: Math.max(topInset + 8, 16),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: activeColors.textPrimary }]}>
            Stock Movement History
          </Text>
          <Text style={[styles.headerSubtitle, { color: activeColors.textSecondary }]}>
            Track all sales, deductions, and incoming stock
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.headerCountPill,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
              borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
            },
          ]}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={refreshing ? 'loading' : 'sync'}
            size={16}
            color={activeColors.primary}
          />
          <Text style={[styles.headerCountText, { color: activeColors.primary }]}>
            {refreshing ? 'Refreshing...' : `${history.length} Logs (Tap to Sync)`}
          </Text>
        </TouchableOpacity>
      </Surface>

      {/* 2. Summary Mini-Cards */}
      <View style={styles.statsRow}>
        <Surface
          style={[
            styles.statCard,
            styles.statCardSales,
            {
              backgroundColor: activeColors.surface,
              borderColor: isDarkMode ? '#7F1D1D' : '#FECDD3',
            },
          ]}
        >
          <View
            style={[
              styles.statIconBoxSales,
              { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2' },
            ]}
          >
            <MaterialCommunityIcons name="arrow-down" size={18} color="#DC2626" />
          </View>
          <View>
            <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Total Sold</Text>
            <Text style={styles.statValueSales}>
              {stats.totalSalesUnits} <Text style={[styles.statUnit, { color: activeColors.textSecondary }]}>units</Text>
            </Text>
            <Text style={[styles.statSub, { color: activeColors.textMuted }]}>{stats.salesCount} sale events</Text>
          </View>
        </Surface>

        <Surface
          style={[
            styles.statCard,
            styles.statCardRestock,
            {
              backgroundColor: activeColors.surface,
              borderColor: isDarkMode ? '#064E3B' : '#BBF7D0',
            },
          ]}
        >
          <View
            style={[
              styles.statIconBoxRestock,
              { backgroundColor: isDarkMode ? '#052E16' : '#DCFCE7' },
            ]}
          >
            <MaterialCommunityIcons name="arrow-up" size={18} color="#16A34A" />
          </View>
          <View>
            <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Total Restocked</Text>
            <Text style={styles.statValueRestock}>
              {stats.totalRestockUnits} <Text style={[styles.statUnit, { color: activeColors.textSecondary }]}>units</Text>
            </Text>
            <Text style={[styles.statSub, { color: activeColors.textMuted }]}>{stats.restockCount} restock events</Text>
          </View>
        </Surface>
      </View>

      {/* 3. Search and Filters */}
      <View style={styles.filterSection}>
        <Searchbar
          placeholder="Search by product, variant, or note..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[
            styles.searchbar,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          inputStyle={[styles.searchbarInput, { color: activeColors.textPrimary }]}
          placeholderTextColor={activeColors.textMuted}
          iconColor={activeColors.textSecondary}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          <Chip
            selected={filterType === 'all'}
            onPress={() => setFilterType('all')}
            style={[
              styles.filterChip,
              {
                backgroundColor: filterType === 'all' ? activeColors.primary : activeColors.surface,
                borderColor: filterType === 'all' ? activeColors.primary : activeColors.border,
              },
            ]}
            textStyle={[
              styles.filterChipText,
              { color: filterType === 'all' ? '#FFFFFF' : activeColors.textSecondary },
              filterType === 'all' && styles.filterChipTextActive,
            ]}
            showSelectedOverlay={false}
          >
            All Activity ({history.length})
          </Chip>
          <Chip
            selected={filterType === 'sale'}
            onPress={() => setFilterType('sale')}
            style={[
              styles.filterChip,
              {
                backgroundColor: filterType === 'sale' ? '#DC2626' : activeColors.surface,
                borderColor: filterType === 'sale' ? '#DC2626' : activeColors.border,
              },
            ]}
            textStyle={[
              styles.filterChipText,
              { color: filterType === 'sale' ? '#FFFFFF' : activeColors.textSecondary },
              filterType === 'sale' && styles.filterChipSaleTextActive,
            ]}
            showSelectedOverlay={false}
          >
            Sales (Out) ({stats.salesCount})
          </Chip>
          <Chip
            selected={filterType === 'restock'}
            onPress={() => setFilterType('restock')}
            style={[
              styles.filterChip,
              {
                backgroundColor: filterType === 'restock' ? '#16A34A' : activeColors.surface,
                borderColor: filterType === 'restock' ? '#16A34A' : activeColors.border,
              },
            ]}
            textStyle={[
              styles.filterChipText,
              { color: filterType === 'restock' ? '#FFFFFF' : activeColors.textSecondary },
              filterType === 'restock' && styles.filterChipRestockTextActive,
            ]}
            showSelectedOverlay={false}
          >
            Restocks (In) ({stats.restockCount})
          </Chip>
        </ScrollView>
      </View>

      {/* 4. History List */}
      <ScrollView
        style={[styles.listContainer, { backgroundColor: activeColors.background }]}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeColors.primary} />
        }
      >
        {filteredHistory.length === 0 ? (
          <Surface
            style={[
              styles.emptyState,
              {
                backgroundColor: activeColors.surface,
                borderColor: activeColors.border,
              },
            ]}
          >
            <MaterialCommunityIcons name="history" size={56} color={activeColors.textMuted} />
            <Text style={[styles.emptyTitle, { color: activeColors.textPrimary }]}>
              No Stock Movements Found
            </Text>
            <Text style={[styles.emptyDesc, { color: activeColors.textSecondary }]}>
              {searchQuery || filterType !== 'all'
                ? 'No transactions matched your current search or filter.'
                : 'Whenever you sell items or add incoming stock, the audit trail will appear here automatically.'}
            </Text>
          </Surface>
        ) : (
          filteredHistory.map((item) => {
            const isSale = item.movementType === 'sale' || item.quantityChangeBase < 0;
            const absQty = Math.abs(item.quantityChangeBase);

            return (
              <Surface
                key={item.id}
                style={[
                  styles.historyCard,
                  {
                    backgroundColor: activeColors.surface,
                    borderColor: activeColors.border,
                  },
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  {/* Left: Icon & Product info */}
                  <View style={styles.cardInfoLeft}>
                    <View
                      style={[
                        styles.iconBadge,
                        isSale
                          ? { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2' }
                          : { backgroundColor: isDarkMode ? '#052E16' : '#DCFCE7' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isSale ? 'arrow-down-bold' : 'arrow-up-bold'}
                        size={20}
                        color={isSale ? '#DC2626' : '#16A34A'}
                      />
                    </View>

                    <View style={styles.productDetails}>
                      <Text style={[styles.prodName, { color: activeColors.textPrimary }]}>
                        {item.productName}
                      </Text>
                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.variantBadge,
                            { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.variantBadgeText,
                              { color: activeColors.textSecondary },
                            ]}
                          >
                            {item.variantName || item.size || 'Standard'}
                          </Text>
                        </View>
                        {item.brand ? (
                          <View
                            style={[
                              styles.brandBadge,
                              { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.brandBadgeText,
                                { color: activeColors.primary },
                              ]}
                            >
                              {item.brand}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Right: Quantity Change */}
                  <View style={styles.cardInfoRight}>
                    <Text
                      style={[
                        styles.quantityText,
                        isSale ? styles.quantityTextSale : styles.quantityTextRestock,
                      ]}
                    >
                      {isSale ? `-${absQty}` : `+${absQty}`} {item.unit}
                    </Text>
                    <View
                      style={[
                        styles.typeBadge,
                        isSale
                          ? { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2' }
                          : { backgroundColor: isDarkMode ? '#052E16' : '#DCFCE7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBadgeText,
                          isSale ? styles.typeBadgeTextSale : styles.typeBadgeTextRestock,
                        ]}
                      >
                        {isSale ? 'SOLD' : 'RESTOCKED'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Transition & Note Footer */}
                <View
                  style={[
                    styles.cardFooter,
                    { borderTopColor: isDarkMode ? '#1F2937' : '#F1F5F9' },
                  ]}
                >
                  <View style={styles.balanceRow}>
                    <Text style={[styles.balanceLabel, { color: activeColors.textSecondary }]}>
                      Stock Balance:
                    </Text>
                    <Text style={[styles.balanceValues, { color: activeColors.textSecondary }]}>
                      {item.balanceBeforeBase} {item.unit} ➔{' '}
                      <Text style={{ fontWeight: '700', color: activeColors.textPrimary }}>
                        {item.balanceAfterBase} {item.unit}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.timeRow}>
                    <MaterialCommunityIcons name="clock-outline" size={13} color={activeColors.textMuted} />
                    <Text style={[styles.timeText, { color: activeColors.textMuted }]}>
                      {formatTimestamp(item.createdAt)}
                    </Text>
                  </View>
                </View>

                {item.reason || item.notes ? (
                  <View
                    style={[
                      styles.notesRow,
                      { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' },
                    ]}
                  >
                    <Text style={[styles.notesText, { color: activeColors.textSecondary }]}>
                      Note: {item.reason || item.notes}
                    </Text>
                  </View>
                ) : null}
              </Surface>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    ...shadows.card,
  },
  statCardSales: {
    borderColor: '#FECDD3',
  },
  statCardRestock: {
    borderColor: '#BBF7D0',
  },
  statIconBoxSales: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statIconBoxRestock: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  statValueSales: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
    marginTop: 1,
  },
  statValueRestock: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16A34A',
    marginTop: 1,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  statSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  searchbar: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: borderRadius.md,
    height: 44,
  },
  searchbarInput: {
    fontSize: 14,
    minHeight: 44,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipSaleActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  filterChipSaleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterChipRestockActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  filterChipRestockTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeSale: {
    backgroundColor: '#FEE2E2',
  },
  iconBadgeRestock: {
    backgroundColor: '#DCFCE7',
  },
  productDetails: {
    flex: 1,
  },
  prodName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  variantBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  variantBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  brandBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  cardInfoRight: {
    alignItems: 'flex-end',
  },
  quantityText: {
    fontSize: 17,
    fontWeight: '800',
  },
  quantityTextSale: {
    color: '#DC2626',
  },
  quantityTextRestock: {
    color: '#16A34A',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 3,
  },
  typeBadgeSale: {
    backgroundColor: '#FEE2E2',
  },
  typeBadgeRestock: {
    backgroundColor: '#DCFCE7',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  typeBadgeTextSale: {
    color: '#DC2626',
  },
  typeBadgeTextRestock: {
    color: '#16A34A',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  balanceValues: {
    fontSize: 12,
    color: '#64748B',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  notesRow: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  notesText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: spacing.md,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
