import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Surface, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import { useAppStore } from '../../src/store/useAppStore.js';
import { lightColors, darkColors, spacing, borderRadius, shadows } from '../../src/theme/tokens.js';
import { StockMovement } from '@hardware-store/shared';

type HistoryItem = StockMovement & {
  productName: string;
  variantName: string;
  size?: string;
  unit: string;
  brand?: string;
};

type TimeFilterMode = 'all' | 'day' | 'month' | 'year';

interface HistoryCardProps {
  item: HistoryItem;
  isDarkMode: boolean;
  activeColors: any;
  formatTimestamp: (iso: string) => string;
}

const HistoryCard = React.memo<HistoryCardProps>(({ item, isDarkMode, activeColors, formatTimestamp }) => {
  const isSale = item.movementType === 'sale' || item.quantityChangeBase < 0;
  const absQty = Math.abs(item.quantityChangeBase);

  return (
    <Surface
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
});

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
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Filters
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'restock'>('all');
  const [timeFilterMode, setTimeFilterMode] = useState<TimeFilterMode>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Filter Modal State & Draft selections
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFilterType, setDraftFilterType] = useState<'all' | 'sale' | 'restock'>('all');
  const [draftTimeFilterMode, setDraftTimeFilterMode] = useState<TimeFilterMode>('all');
  const [draftSelectedDate, setDraftSelectedDate] = useState<Date>(new Date());

  const loadHistory = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) {
        setInitialLoading(true);
      }
      const storeId = store?.id || 'store-1';
      const items = await InventoryRepository.getAllStockHistory(storeId, 250);
      setHistory(items);
    } catch (e) {
      console.error('Error loading stock history:', e);
    } finally {
      setInitialLoading(false);
    }
  }, [store]);

  // Smooth, non-blocking refresh on tab focus
  useFocusEffect(
    useCallback(() => {
      loadHistory(history.length > 0);
    }, [loadHistory, history.length])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory(true);
    setRefreshing(false);
  };

  // Open Filter Dialog
  const handleOpenFilterModal = () => {
    setDraftFilterType(filterType);
    setDraftTimeFilterMode(timeFilterMode);
    setDraftSelectedDate(new Date(selectedDate));
    setFilterModalVisible(true);
  };

  // Commit and apply filters from modal
  const handleApplyFilters = () => {
    setFilterType(draftFilterType);
    setTimeFilterMode(draftTimeFilterMode);
    setSelectedDate(new Date(draftSelectedDate));
    setFilterModalVisible(false);
  };

  // Reset all filters
  const handleResetFiltersInModal = () => {
    setDraftFilterType('all');
    setDraftTimeFilterMode('all');
    setDraftSelectedDate(new Date());
  };

  // Quick Clear from main screen
  const handleClearAllFilters = () => {
    setFilterType('all');
    setTimeFilterMode('all');
    setSelectedDate(new Date());
  };

  // Stepper inside Modal
  const handleDraftPrevDate = () => {
    setDraftSelectedDate((prev) => {
      const d = new Date(prev);
      if (draftTimeFilterMode === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (draftTimeFilterMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else if (draftTimeFilterMode === 'year') {
        d.setFullYear(d.getFullYear() - 1);
      }
      return d;
    });
  };

  const handleDraftNextDate = () => {
    setDraftSelectedDate((prev) => {
      const d = new Date(prev);
      const now = new Date();
      if (draftTimeFilterMode === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (draftTimeFilterMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else if (draftTimeFilterMode === 'year') {
        d.setFullYear(d.getFullYear() + 1);
      }
      return d;
    });
  };

  const isDraftNextDisabled = useMemo(() => {
    const now = new Date();
    if (draftTimeFilterMode === 'day') {
      return (
        draftSelectedDate.getDate() >= now.getDate() &&
        draftSelectedDate.getMonth() >= now.getMonth() &&
        draftSelectedDate.getFullYear() >= now.getFullYear()
      );
    }
    if (draftTimeFilterMode === 'month') {
      return (
        draftSelectedDate.getMonth() >= now.getMonth() &&
        draftSelectedDate.getFullYear() >= now.getFullYear()
      );
    }
    if (draftTimeFilterMode === 'year') {
      return draftSelectedDate.getFullYear() >= now.getFullYear();
    }
    return true;
  }, [draftTimeFilterMode, draftSelectedDate]);

  const getDraftDateLabel = () => {
    const now = new Date();
    if (draftTimeFilterMode === 'day') {
      const isToday =
        draftSelectedDate.getDate() === now.getDate() &&
        draftSelectedDate.getMonth() === now.getMonth() &&
        draftSelectedDate.getFullYear() === now.getFullYear();

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday =
        draftSelectedDate.getDate() === yesterday.getDate() &&
        draftSelectedDate.getMonth() === yesterday.getMonth() &&
        draftSelectedDate.getFullYear() === yesterday.getFullYear();

      if (isToday) return `Today (${draftSelectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
      if (isYesterday) return `Yesterday (${draftSelectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
      return draftSelectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    if (draftTimeFilterMode === 'month') {
      const isCurrentMonth =
        draftSelectedDate.getMonth() === now.getMonth() &&
        draftSelectedDate.getFullYear() === now.getFullYear();
      const monthStr = draftSelectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return isCurrentMonth ? `This Month (${monthStr})` : monthStr;
    }

    if (draftTimeFilterMode === 'year') {
      const isCurrentYear = draftSelectedDate.getFullYear() === now.getFullYear();
      const yearStr = `${draftSelectedDate.getFullYear()}`;
      return isCurrentYear ? `This Year (${yearStr})` : yearStr;
    }

    return 'All Time';
  };

  // Active filter status
  const isAnyFilterActive = timeFilterMode !== 'all' || filterType !== 'all';
  const activeFilterCount = (timeFilterMode !== 'all' ? 1 : 0) + (filterType !== 'all' ? 1 : 0);

  const getActiveFilterSummary = () => {
    const parts: string[] = [];
    if (timeFilterMode === 'day') {
      const now = new Date();
      const isToday =
        selectedDate.getDate() === now.getDate() &&
        selectedDate.getMonth() === now.getMonth() &&
        selectedDate.getFullYear() === now.getFullYear();
      parts.push(isToday ? 'Today' : selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    } else if (timeFilterMode === 'month') {
      parts.push(selectedDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }));
    } else if (timeFilterMode === 'year') {
      parts.push(`${selectedDate.getFullYear()}`);
    }

    if (filterType === 'sale') {
      parts.push('Sales Only');
    } else if (filterType === 'restock') {
      parts.push('Restocks Only');
    }

    return parts.join(' • ');
  };

  // Filtered Items (Time period + Type + Search)
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // 1. Time filter (Day / Month / Year)
      if (timeFilterMode !== 'all' && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        if (isNaN(itemDate.getTime())) return false;

        if (timeFilterMode === 'day') {
          const isSameDay =
            itemDate.getFullYear() === selectedDate.getFullYear() &&
            itemDate.getMonth() === selectedDate.getMonth() &&
            itemDate.getDate() === selectedDate.getDate();
          if (!isSameDay) return false;
        } else if (timeFilterMode === 'month') {
          const isSameMonth =
            itemDate.getFullYear() === selectedDate.getFullYear() &&
            itemDate.getMonth() === selectedDate.getMonth();
          if (!isSameMonth) return false;
        } else if (timeFilterMode === 'year') {
          const isSameYear = itemDate.getFullYear() === selectedDate.getFullYear();
          if (!isSameYear) return false;
        }
      }

      // 2. Type filter (All / Sale / Restock)
      if (filterType === 'sale') {
        if (item.movementType !== 'sale' && item.quantityChangeBase >= 0) return false;
      } else if (filterType === 'restock') {
        if (item.movementType === 'sale' || item.quantityChangeBase < 0) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchProduct = (item.productName || '').toLowerCase().includes(query);
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
  }, [history, timeFilterMode, selectedDate, filterType, searchQuery]);

  // Compute Summary Statistics for the active time period
  const stats = useMemo(() => {
    let totalSalesUnits = 0;
    let totalRestockUnits = 0;
    let salesCount = 0;
    let restockCount = 0;

    const timeScopedItems = timeFilterMode === 'all'
      ? history
      : history.filter((item) => {
          if (!item.createdAt) return false;
          const itemDate = new Date(item.createdAt);
          if (isNaN(itemDate.getTime())) return false;
          if (timeFilterMode === 'day') {
            return (
              itemDate.getFullYear() === selectedDate.getFullYear() &&
              itemDate.getMonth() === selectedDate.getMonth() &&
              itemDate.getDate() === selectedDate.getDate()
            );
          } else if (timeFilterMode === 'month') {
            return (
              itemDate.getFullYear() === selectedDate.getFullYear() &&
              itemDate.getMonth() === selectedDate.getMonth()
            );
          } else if (timeFilterMode === 'year') {
            return itemDate.getFullYear() === selectedDate.getFullYear();
          }
          return true;
        });

    timeScopedItems.forEach((h) => {
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
      totalTransactions: timeScopedItems.length,
    };
  }, [history, timeFilterMode, selectedDate]);

  const formatTimestamp = useCallback((isoDate: string) => {
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
  }, []);

  const renderHistoryItem = useCallback(
    ({ item }: { item: HistoryItem }) => (
      <HistoryCard
        item={item}
        isDarkMode={isDarkMode}
        activeColors={activeColors}
        formatTimestamp={formatTimestamp}
      />
    ),
    [isDarkMode, activeColors, formatTimestamp]
  );

  const renderHeader = useMemo(() => {
    return (
      <View>
        {/* 1. Top Header Card */}
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
              <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>
                {timeFilterMode === 'day' ? "TODAY'S SOLD" : timeFilterMode === 'month' ? "THIS MONTH SOLD" : "TOTAL SOLD"}
              </Text>
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
              <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>
                {timeFilterMode === 'day' ? "TODAY'S RESTOCK" : timeFilterMode === 'month' ? "THIS MONTH RESTOCK" : "RESTOCKED"}
              </Text>
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

        {/* 3. Search Bar + Single Unified Filter Trigger Button */}
        <View style={styles.searchAndFilterSection}>
          <View style={styles.searchAndFilterRow}>
            <Searchbar
              placeholder="Search product, note..."
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

            {/* The Unified Filter Button */}
            <TouchableOpacity
              style={[
                styles.filterTriggerBtn,
                isAnyFilterActive
                  ? {
                      backgroundColor: activeColors.primary,
                      borderColor: activeColors.primary,
                    }
                  : {
                      backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#FFFFFF',
                      borderColor: activeColors.border,
                    },
              ]}
              onPress={handleOpenFilterModal}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name="tune-variant"
                size={18}
                color={isAnyFilterActive ? '#FFFFFF' : activeColors.textPrimary}
              />
              <Text
                style={[
                  styles.filterTriggerText,
                  { color: isAnyFilterActive ? '#FFFFFF' : activeColors.textPrimary },
                ]}
              >
                Filter
              </Text>
              {activeFilterCount > 0 && (
                <View
                  style={[
                    styles.activeBadgeCircle,
                    { backgroundColor: isAnyFilterActive ? '#FFFFFF' : activeColors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.activeBadgeText,
                      { color: isAnyFilterActive ? activeColors.primary : '#FFFFFF' },
                    ]}
                  >
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Active Filter Dismissable Pill if any filter applied */}
          {isAnyFilterActive && (
            <View style={styles.activeFilterRow}>
              <View
                style={[
                  styles.activeFilterChip,
                  {
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
                    borderColor: activeColors.primary,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="filter-check"
                  size={14}
                  color={activeColors.primary}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[styles.activeFilterChipText, { color: activeColors.primary }]}
                  numberOfLines={1}
                >
                  {getActiveFilterSummary()}
                </Text>
                <TouchableOpacity
                  onPress={handleClearAllFilters}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 6 }}
                >
                  <MaterialCommunityIcons name="close-circle" size={16} color={activeColors.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleClearAllFilters}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.clearAllText, { color: activeColors.textMuted }]}>
                  Reset
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }, [
    activeColors,
    topInset,
    isDarkMode,
    refreshing,
    history.length,
    timeFilterMode,
    stats,
    searchQuery,
    isAnyFilterActive,
    activeFilterCount,
  ]);

  const renderEmpty = useMemo(() => {
    if (initialLoading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={activeColors.primary} />
          <Text style={[styles.loadingText, { color: activeColors.textMuted }]}>
            Loading History...
          </Text>
        </View>
      );
    }

    return (
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
          No Movements Found
        </Text>
        <Text style={[styles.emptyDesc, { color: activeColors.textSecondary }]}>
          {searchQuery || isAnyFilterActive
            ? 'No transactions matched your selected filters.'
            : 'Whenever you sell items or add incoming stock, the audit trail will appear here automatically.'}
        </Text>
        {isAnyFilterActive && (
          <TouchableOpacity
            style={[styles.emptyResetBtn, { backgroundColor: activeColors.primary }]}
            onPress={handleClearAllFilters}
          >
            <Text style={styles.emptyResetBtnText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </Surface>
    );
  }, [initialLoading, activeColors, searchQuery, isAnyFilterActive]);

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      <FlatList
        data={filteredHistory}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom || 0, 16) + 85 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={activeColors.primary}
          />
        }
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Unified Filter Dialog / Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: activeColors.surface,
                borderColor: activeColors.border,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="tune-variant" size={20} color={activeColors.primary} />
                <Text style={[styles.modalTitle, { color: activeColors.textPrimary }]}>
                  Filter History
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.modalCloseBtn,
                  { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                ]}
              >
                <MaterialCommunityIcons name="close" size={18} color={activeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 1. Time Period Section */}
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupLabel, { color: activeColors.textSecondary }]}>
                  TIME PERIOD
                </Text>
                <View style={styles.modalPillGrid}>
                  {(['all', 'day', 'month', 'year'] as TimeFilterMode[]).map((mode) => {
                    const isSelected = draftTimeFilterMode === mode;
                    const label =
                      mode === 'all'
                        ? 'All Time'
                        : mode === 'day'
                        ? 'Day'
                        : mode === 'month'
                        ? 'Month'
                        : 'Year';

                    return (
                      <TouchableOpacity
                        key={mode}
                        activeOpacity={0.7}
                        onPress={() => {
                          setDraftTimeFilterMode(mode);
                          setDraftSelectedDate(new Date());
                        }}
                        style={[
                          styles.modalPill,
                          {
                            backgroundColor: isSelected
                              ? activeColors.primary
                              : isDarkMode
                              ? activeColors.surfaceElevated
                              : '#F8FAFC',
                            borderColor: isSelected ? activeColors.primary : activeColors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.modalPillText,
                            {
                              color: isSelected ? '#FFFFFF' : activeColors.textPrimary,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Sub-selector for Day / Month / Year */}
                {draftTimeFilterMode !== 'all' && (
                  <View
                    style={[
                      styles.modalStepperRow,
                      {
                        backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#F1F5F9',
                        borderColor: activeColors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={handleDraftPrevDate}
                      style={[
                        styles.stepperArrow,
                        { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={20} color={activeColors.textPrimary} />
                    </TouchableOpacity>

                    <View style={styles.stepperCenter}>
                      <MaterialCommunityIcons
                        name={
                          draftTimeFilterMode === 'day'
                            ? 'calendar-today'
                            : draftTimeFilterMode === 'month'
                            ? 'calendar-month'
                            : 'calendar'
                        }
                        size={15}
                        color={activeColors.primary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[styles.stepperText, { color: activeColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {getDraftDateLabel()}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {!isDraftNextDisabled && (
                        <TouchableOpacity
                          onPress={() => setDraftSelectedDate(new Date())}
                          style={[
                            styles.stepperResetBtn,
                            { backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF' },
                          ]}
                        >
                          <Text style={[styles.stepperResetText, { color: activeColors.primary }]}>
                            {draftTimeFilterMode === 'day' ? 'Today' : 'Current'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={handleDraftNextDate}
                        disabled={isDraftNextDisabled}
                        style={[
                          styles.stepperArrow,
                          {
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            opacity: isDraftNextDisabled ? 0.35 : 1,
                          },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="chevron-right" size={20} color={activeColors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* 2. Transaction Type Section */}
              <View style={[styles.filterGroup, { marginTop: spacing.md }]}>
                <Text style={[styles.filterGroupLabel, { color: activeColors.textSecondary }]}>
                  TRANSACTION TYPE
                </Text>
                <View style={styles.typeButtonGroup}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      draftFilterType === 'all'
                        ? { backgroundColor: activeColors.primary, borderColor: activeColors.primary }
                        : {
                            backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#F8FAFC',
                            borderColor: activeColors.border,
                          },
                    ]}
                    onPress={() => setDraftFilterType('all')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        {
                          color: draftFilterType === 'all' ? '#FFFFFF' : activeColors.textPrimary,
                          fontWeight: draftFilterType === 'all' ? '700' : '500',
                        },
                      ]}
                    >
                      All Activity
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      draftFilterType === 'sale'
                        ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                        : {
                            backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#F8FAFC',
                            borderColor: activeColors.border,
                          },
                    ]}
                    onPress={() => setDraftFilterType('sale')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        {
                          color: draftFilterType === 'sale' ? '#FFFFFF' : '#DC2626',
                          fontWeight: draftFilterType === 'sale' ? '700' : '500',
                        },
                      ]}
                    >
                      Sales (Out)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      draftFilterType === 'restock'
                        ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                        : {
                            backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#F8FAFC',
                            borderColor: activeColors.border,
                          },
                    ]}
                    onPress={() => setDraftFilterType('restock')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        {
                          color: draftFilterType === 'restock' ? '#FFFFFF' : '#16A34A',
                          fontWeight: draftFilterType === 'restock' ? '700' : '500',
                        },
                      ]}
                    >
                      Restocks (In)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions Footer */}
            <View
              style={[
                styles.modalActionsRow,
                { borderTopColor: isDarkMode ? '#1F2937' : '#F1F5F9' },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.resetModalBtn,
                  { borderColor: activeColors.border },
                ]}
                onPress={handleResetFiltersInModal}
              >
                <Text style={[styles.resetModalBtnText, { color: activeColors.textSecondary }]}>
                  Reset
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.applyModalBtn,
                  { backgroundColor: activeColors.primary },
                ]}
                onPress={handleApplyFilters}
              >
                <Text style={styles.applyModalBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
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
  searchAndFilterSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  searchAndFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchbar: {
    flex: 1,
    elevation: 0,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    height: 44,
  },
  searchbarInput: {
    fontSize: 13,
    minHeight: 44,
  },
  filterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  filterTriggerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeBadgeCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: '82%',
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  listContent: {
    gap: spacing.sm,
  },
  historyCard: {
    borderRadius: 16,
    padding: 14,
    marginHorizontal: spacing.lg,
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
  loadingWrap: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: spacing.sm,
  },
  emptyState: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
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
  emptyResetBtn: {
    marginTop: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyResetBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  /* Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    maxHeight: '80%',
    ...shadows.floating,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterGroup: {
    marginTop: 4,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  modalPillGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  modalPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPillText: {
    fontSize: 12,
  },
  modalStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  stepperArrow: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  stepperText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepperResetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepperResetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  typeButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonText: {
    fontSize: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  resetModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  applyModalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  applyModalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
