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
import { Surface, Searchbar } from 'react-native-paper';
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
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        d.getDate() === yesterday.getDate() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getFullYear() === yesterday.getFullYear();

      const timeStr = d.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      if (isToday) {
        return `Today, ${timeStr}`;
      }
      if (isYesterday) {
        return `Yesterday, ${timeStr}`;
      }

      const isCurrentYear = d.getFullYear() === now.getFullYear();
      const dateStr = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        ...(isCurrentYear ? {} : { year: 'numeric' }),
      });

      return `${dateStr}, ${timeStr}`;
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
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleCol}>
            <Text style={[styles.headerTitle, { color: activeColors.textPrimary }]}>
              Stock Movement
            </Text>
            <Text style={[styles.headerSubtitle, { color: activeColors.textSecondary }]}>
              Audit trail of sales, restocks & adjustments
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.syncPill,
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
              size={15}
              color={activeColors.primary}
            />
            <Text style={[styles.syncPillText, { color: activeColors.primary }]}>
              {refreshing ? 'Syncing...' : 'Sync'}
            </Text>
            <View
              style={[
                styles.syncCountBadge,
                { backgroundColor: activeColors.primary },
              ]}
            >
              <Text style={styles.syncCountBadgeText}>{history.length}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Surface>

      {/* 2. Summary Mini-Cards */}
      <View style={styles.statsRow}>
        <Surface
          style={[
            styles.statCard,
            styles.statCardSales,
            {
              backgroundColor: activeColors.surface,
              borderColor: isDarkMode ? 'rgba(220, 38, 38, 0.25)' : '#FECDD3',
            },
          ]}
        >
          <View style={styles.statCardHeader}>
            <View
              style={[
                styles.statIconBox,
                { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2' },
              ]}
            >
              <MaterialCommunityIcons name="arrow-down-bold" size={15} color="#DC2626" />
            </View>
            <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>TOTAL SOLD</Text>
          </View>
          <View style={styles.statValueContainer}>
            <Text style={styles.statValueSales}>
              {stats.totalSalesUnits}{' '}
              <Text style={[styles.statUnit, { color: activeColors.textSecondary }]}>units</Text>
            </Text>
          </View>
          <Text style={[styles.statSub, { color: activeColors.textMuted }]}>
            {stats.salesCount} {stats.salesCount === 1 ? 'sale event' : 'sale events'}
          </Text>
        </Surface>

        <Surface
          style={[
            styles.statCard,
            styles.statCardRestock,
            {
              backgroundColor: activeColors.surface,
              borderColor: isDarkMode ? 'rgba(22, 163, 74, 0.25)' : '#BBF7D0',
            },
          ]}
        >
          <View style={styles.statCardHeader}>
            <View
              style={[
                styles.statIconBox,
                { backgroundColor: isDarkMode ? '#052E16' : '#DCFCE7' },
              ]}
            >
              <MaterialCommunityIcons name="arrow-up-bold" size={15} color="#16A34A" />
            </View>
            <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>RESTOCKED</Text>
          </View>
          <View style={styles.statValueContainer}>
            <Text style={styles.statValueRestock}>
              {stats.totalRestockUnits}{' '}
              <Text style={[styles.statUnit, { color: activeColors.textSecondary }]}>units</Text>
            </Text>
          </View>
          <Text style={[styles.statSub, { color: activeColors.textMuted }]}>
            {stats.restockCount} {stats.restockCount === 1 ? 'restock event' : 'restock events'}
          </Text>
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
          style={styles.filterScroll}
          contentContainerStyle={styles.filterChipsRow}
        >
          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === 'all'
                ? { backgroundColor: activeColors.primary, borderColor: activeColors.primary }
                : { backgroundColor: activeColors.surface, borderColor: activeColors.border },
            ]}
            onPress={() => setFilterType('all')}
            activeOpacity={0.75}
          >
            {filterType === 'all' && (
              <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.filterPillText,
                { color: filterType === 'all' ? '#FFFFFF' : activeColors.textSecondary },
                filterType === 'all' && styles.filterPillTextActive,
              ]}
            >
              All Activity ({history.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === 'sale'
                ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                : { backgroundColor: activeColors.surface, borderColor: activeColors.border },
            ]}
            onPress={() => setFilterType('sale')}
            activeOpacity={0.75}
          >
            {filterType === 'sale' && (
              <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.filterPillText,
                { color: filterType === 'sale' ? '#FFFFFF' : activeColors.textSecondary },
                filterType === 'sale' && styles.filterPillTextActive,
              ]}
            >
              Sales (Out) ({stats.salesCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filterType === 'restock'
                ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                : { backgroundColor: activeColors.surface, borderColor: activeColors.border },
            ]}
            onPress={() => setFilterType('restock')}
            activeOpacity={0.75}
          >
            {filterType === 'restock' && (
              <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.filterPillText,
                { color: filterType === 'restock' ? '#FFFFFF' : activeColors.textSecondary },
                filterType === 'restock' && styles.filterPillTextActive,
              ]}
            >
              Restocks (In) ({stats.restockCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 4. History List */}
      <ScrollView
        style={[styles.listContainer, { backgroundColor: activeColors.background }]}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom || 0, 16) + 85 },
        ]}
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
                      <Text
                        style={[styles.prodName, { color: activeColors.textPrimary }]}
                        numberOfLines={1}
                      >
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
                    <Text style={[styles.balanceLabel, { color: activeColors.textMuted }]}>
                      Balance:
                    </Text>
                    <Text
                      style={[styles.balanceValues, { color: activeColors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.balanceBeforeBase} {item.unit} ➔{' '}
                      <Text style={{ fontWeight: '700', color: activeColors.textPrimary }}>
                        {item.balanceAfterBase} {item.unit}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.timeRow}>
                    <MaterialCommunityIcons name="clock-outline" size={12} color={activeColors.textMuted} />
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
                    <MaterialCommunityIcons
                      name="note-text-outline"
                      size={12}
                      color={activeColors.textMuted}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[styles.notesText, { color: activeColors.textSecondary }]}
                      numberOfLines={2}
                    >
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
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleCol: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  syncPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  syncCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 2,
  },
  syncCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    ...shadows.card,
  },
  statCardSales: {},
  statCardRestock: {},
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValueContainer: {
    marginBottom: 2,
  },
  statValueSales: {
    fontSize: 20,
    fontWeight: '800',
    color: '#DC2626',
  },
  statValueRestock: {
    fontSize: 20,
    fontWeight: '800',
    color: '#16A34A',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  statSub: {
    fontSize: 11,
    fontWeight: '500',
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
  filterScroll: {
    marginHorizontal: -spacing.lg,
  },
  filterChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: 8,
    paddingVertical: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  historyCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
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
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetails: {
    flex: 1,
  },
  prodName: {
    fontSize: 15,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  variantBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  variantBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  brandBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardInfoRight: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  quantityText: {
    fontSize: 16,
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
    borderRadius: 6,
    marginTop: 4,
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
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  balanceValues: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  notesText: {
    fontSize: 11,
    flex: 1,
  },
  emptyState: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});
