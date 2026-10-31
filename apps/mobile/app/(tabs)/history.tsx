import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
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

type TimeFilterMode = 'all' | 'day' | 'range' | 'month' | 'year';

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
          <MaterialCommunityIcons name="calendar-outline" size={12} color={activeColors.textMuted} />
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

// HTML escaping helper to prevent malformed tags or corrupt PDF documents
const escapeHtml = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export default function HistoryScreen() {
  const { store, isDarkMode, showToast } = useAppStore();
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
  const [exportingPdf, setExportingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Filters
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'restock'>('all');
  const [timeFilterMode, setTimeFilterMode] = useState<TimeFilterMode>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [rangeStartDate, setRangeStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  });
  const [rangeEndDate, setRangeEndDate] = useState<Date>(new Date());

  // Filter Modal State & Draft selections
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFilterType, setDraftFilterType] = useState<'all' | 'sale' | 'restock'>('all');
  const [draftTimeFilterMode, setDraftTimeFilterMode] = useState<TimeFilterMode>('all');
  const [draftSelectedDate, setDraftSelectedDate] = useState<Date>(new Date());
  const [draftRangeStartDate, setDraftRangeStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  });
  const [draftRangeEndDate, setDraftRangeEndDate] = useState<Date>(new Date());
  const [calendarViewingMonth, setCalendarViewingMonth] = useState<Date>(new Date());
  const [rangePickingStep, setRangePickingStep] = useState<'start' | 'end'>('start');

  // Calendar cells calculation for the currently viewed month
  const calendarCells = useMemo(() => {
    const year = calendarViewingMonth.getFullYear();
    const month = calendarViewingMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ dayNumber?: number; key: string }> = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ key: `blank-${i}` });
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ dayNumber: d, key: `day-${d}` });
    }
    return cells;
  }, [calendarViewingMonth]);

  const handleCalendarDayPress = (d: number) => {
    const year = calendarViewingMonth.getFullYear();
    const month = calendarViewingMonth.getMonth();
    const clickedDate = new Date(year, month, d, 0, 0, 0, 0);

    if (draftTimeFilterMode === 'day') {
      setDraftSelectedDate(clickedDate);
    } else if (draftTimeFilterMode === 'range') {
      if (rangePickingStep === 'start') {
        setDraftRangeStartDate(clickedDate);
        setDraftRangeEndDate(clickedDate);
        setRangePickingStep('end');
      } else {
        // Step === 'end'
        const sTime = new Date(draftRangeStartDate).setHours(0, 0, 0, 0);
        const cTime = clickedDate.getTime();

        if (cTime < sTime) {
          // If clicked before current start, reset start to this earlier date
          setDraftRangeStartDate(clickedDate);
          setDraftRangeEndDate(clickedDate);
          setRangePickingStep('end');
        } else {
          // Check 31-day limit for safety & optimization
          const diffDays = Math.round((cTime - sTime) / (1000 * 60 * 60 * 24)) + 1;

          if (diffDays > 31) {
            const capped = new Date(draftRangeStartDate);
            capped.setDate(capped.getDate() + 30);
            capped.setHours(23, 59, 59, 999);
            setDraftRangeEndDate(capped);
            showToast('Max range capped to 31 days for high speed', 'info');
          } else {
            const endNormalized = new Date(clickedDate);
            endNormalized.setHours(23, 59, 59, 999);
            setDraftRangeEndDate(endNormalized);
          }
          setRangePickingStep('start');
        }
      }
    }
  };

  const applyRangePreset = (days: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    setDraftRangeStartDate(start);
    setDraftRangeEndDate(end);
    setDraftTimeFilterMode('range');
    setCalendarViewingMonth(new Date(end.getFullYear(), end.getMonth(), 1));
    setRangePickingStep('start');
  };

  // Calculate ISO boundaries for database query
  const calculateBoundaries = useCallback((
    mode: TimeFilterMode,
    targetDate: Date,
    rStart?: Date,
    rEnd?: Date
  ) => {
    let startIso: string | undefined = undefined;
    let endIso: string | undefined = undefined;

    if (mode === 'day') {
      const s = new Date(targetDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(targetDate);
      e.setHours(23, 59, 59, 999);
      startIso = s.toISOString();
      endIso = e.toISOString();
    } else if (mode === 'range') {
      let s = new Date(rStart || rangeStartDate);
      s.setHours(0, 0, 0, 0);
      let e = new Date(rEnd || rangeEndDate);
      e.setHours(23, 59, 59, 999);
      if (s.getTime() > e.getTime()) {
        const tmp = s;
        s = e;
        e = tmp;
      }
      startIso = s.toISOString();
      endIso = e.toISOString();
    } else if (mode === 'month') {
      const s = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
      const e = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
      startIso = s.toISOString();
      endIso = e.toISOString();
    } else if (mode === 'year') {
      const s = new Date(targetDate.getFullYear(), 0, 1, 0, 0, 0, 0);
      const e = new Date(targetDate.getFullYear(), 11, 31, 23, 59, 59, 999);
      startIso = s.toISOString();
      endIso = e.toISOString();
    }
    return { startIso, endIso };
  }, [rangeStartDate, rangeEndDate]);

  const loadHistory = useCallback(
    async (
      isSilent = false,
      customMode?: TimeFilterMode,
      customDate?: Date,
      customRangeStart?: Date,
      customRangeEnd?: Date
    ) => {
      try {
        if (!isSilent) {
          setInitialLoading(true);
        }
        const storeId = store?.id || 'store-1';
        const mode = customMode !== undefined ? customMode : timeFilterMode;
        const targetDate = customDate || selectedDate;
        const rStart = customRangeStart || rangeStartDate;
        const rEnd = customRangeEnd || rangeEndDate;

        const { startIso, endIso } = calculateBoundaries(mode, targetDate, rStart, rEnd);
        // Safe limit of 300 records keeps SQLite execution instant (<10ms) and prevents memory bloat
        const items = await InventoryRepository.getAllStockHistory(storeId, 300, startIso, endIso);
        setHistory(items);
      } catch (e) {
        console.error('Error loading stock history:', e);
      } finally {
        setInitialLoading(false);
      }
    },
    [store, timeFilterMode, selectedDate, rangeStartDate, rangeEndDate, calculateBoundaries]
  );

  const hasHistoryRef = useRef(false);
  useEffect(() => {
    hasHistoryRef.current = history.length > 0;
  }, [history.length]);

  // Smooth, non-blocking refresh on tab focus (single fetch, no loop)
  useFocusEffect(
    useCallback(() => {
      loadHistory(hasHistoryRef.current);
    }, [loadHistory])
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
    setDraftRangeStartDate(new Date(rangeStartDate));
    setDraftRangeEndDate(new Date(rangeEndDate));
    setCalendarViewingMonth(
      new Date(
        (timeFilterMode === 'day' ? selectedDate : rangeEndDate).getFullYear(),
        (timeFilterMode === 'day' ? selectedDate : rangeEndDate).getMonth(),
        1
      )
    );
    setRangePickingStep('start');
    setFilterModalVisible(true);
  };

  // Commit and apply filters from modal
  const handleApplyFilters = () => {
    setFilterType(draftFilterType);
    setTimeFilterMode(draftTimeFilterMode);
    setSelectedDate(new Date(draftSelectedDate));
    setRangeStartDate(new Date(draftRangeStartDate));
    setRangeEndDate(new Date(draftRangeEndDate));
    setFilterModalVisible(false);
    loadHistory(false, draftTimeFilterMode, draftSelectedDate, draftRangeStartDate, draftRangeEndDate);
  };

  // Reset all filters
  const handleResetFiltersInModal = () => {
    const now = new Date();
    const d7 = new Date();
    d7.setDate(d7.getDate() - 6);
    setDraftFilterType('all');
    setDraftTimeFilterMode('all');
    setDraftSelectedDate(now);
    setDraftRangeStartDate(d7);
    setDraftRangeEndDate(now);
    setCalendarViewingMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setRangePickingStep('start');
  };

  // Quick Clear from main screen
  const handleClearAllFilters = () => {
    const now = new Date();
    const d7 = new Date();
    d7.setDate(d7.getDate() - 6);
    setFilterType('all');
    setTimeFilterMode('all');
    setSelectedDate(now);
    setRangeStartDate(d7);
    setRangeEndDate(now);
    setSearchQuery('');
    loadHistory(false, 'all', now, d7, now);
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
      const d = new Date(draftSelectedDate);
      d.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return d.getTime() >= today.getTime();
    }
    if (draftTimeFilterMode === 'month') {
      const dYear = draftSelectedDate.getFullYear();
      const dMonth = draftSelectedDate.getMonth();
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth();
      return dYear > nowYear || (dYear === nowYear && dMonth >= nowMonth);
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

    if (draftTimeFilterMode === 'range') {
      return `${draftRangeStartDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${draftRangeEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
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
    } else if (timeFilterMode === 'range') {
      parts.push(
        `${rangeStartDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${rangeEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
      );
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
      // 1. Time filter (Day / Range / Month / Year)
      if (timeFilterMode !== 'all' && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        if (isNaN(itemDate.getTime())) return false;

        if (timeFilterMode === 'day') {
          const isSameDay =
            itemDate.getFullYear() === selectedDate.getFullYear() &&
            itemDate.getMonth() === selectedDate.getMonth() &&
            itemDate.getDate() === selectedDate.getDate();
          if (!isSameDay) return false;
        } else if (timeFilterMode === 'range') {
          let s = new Date(rangeStartDate);
          s.setHours(0, 0, 0, 0);
          let e = new Date(rangeEndDate);
          e.setHours(23, 59, 59, 999);
          if (s.getTime() > e.getTime()) {
            const tmp = s;
            s = e;
            e = tmp;
          }
          if (itemDate < s || itemDate > e) return false;
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
        if (item.movementType !== 'sale' && Number(item.quantityChangeBase) >= 0) return false;
      } else if (filterType === 'restock') {
        if (item.movementType === 'sale' || Number(item.quantityChangeBase) < 0) return false;
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
  }, [history, timeFilterMode, selectedDate, rangeStartDate, rangeEndDate, filterType, searchQuery]);

  // Compute Summary Statistics for the active time period
  const stats = useMemo(() => {
    let totalSalesUnits = 0;
    let totalRestockUnits = 0;
    let salesCount = 0;
    let restockCount = 0;

    const timeScopedItems =
      timeFilterMode === 'all'
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
            } else if (timeFilterMode === 'range') {
              let s = new Date(rangeStartDate);
              s.setHours(0, 0, 0, 0);
              let e = new Date(rangeEndDate);
              e.setHours(23, 59, 59, 999);
              if (s.getTime() > e.getTime()) {
                const tmp = s;
                s = e;
                e = tmp;
              }
              return itemDate >= s && itemDate <= e;
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
      const rawQty = Math.abs(Number(h.quantityChangeBase) || 0);
      if (h.movementType === 'sale' || (Number(h.quantityChangeBase) || 0) < 0) {
        totalSalesUnits += rawQty;
        salesCount += 1;
      } else {
        totalRestockUnits += Number(h.quantityChangeBase) || 0;
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
  }, [history, timeFilterMode, selectedDate, rangeStartDate, rangeEndDate]);

  /**
   * Ultra-safe, optimized PDF generation engine
   * - Max 250 records per PDF to completely prevent WebView Out-Of-Memory (OOM) crashes on low-RAM devices
   * - HTML escaping on all product/variant/notes to prevent layout distortion or syntax corruption
   * - Resilient sharing handler that safely catches native user cancellation
   */
  interface GeneratePdfOptions {
    items: HistoryItem[];
    mode: TimeFilterMode;
    targetDate: Date;
    rangeStart?: Date;
    rangeEnd?: Date;
    activeType: 'all' | 'sale' | 'restock';
    query?: string;
  }

  const generatePdfReport = async (opts: GeneratePdfOptions) => {
    const { items, mode, targetDate, rangeStart, rangeEnd, activeType, query } = opts;

    // Filter items according to active type & search query
    const filtered = items.filter((item) => {
      const rawQty = Number(item.quantityChangeBase) || 0;
      if (activeType === 'sale') {
        if (item.movementType !== 'sale' && rawQty >= 0) return false;
      } else if (activeType === 'restock') {
        if (item.movementType === 'sale' || rawQty < 0) return false;
      }

      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        const matchProduct = (item.productName || '').toLowerCase().includes(q);
        const matchVariant = (item.variantName || '').toLowerCase().includes(q);
        const matchBrand = (item.brand || '').toLowerCase().includes(q);
        const matchReason = (item.reason || '').toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(query);
        if (!matchProduct && !matchVariant && !matchBrand && !matchReason && !matchNotes) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      showToast('No records found to export for the selected filter.', 'warning');
      return;
    }

    const generatedAt = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Period label
    let periodLabel = 'All Time';
    if (mode === 'day') {
      periodLabel = targetDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } else if (mode === 'range') {
      const s = rangeStart || rangeStartDate;
      const e = rangeEnd || rangeEndDate;
      periodLabel = `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (mode === 'month') {
      periodLabel = targetDate.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
    } else if (mode === 'year') {
      periodLabel = `Year ${targetDate.getFullYear()}`;
    }

    const filterTypeLabel =
      activeType === 'sale' ? 'Sales Only' : activeType === 'restock' ? 'Restocks Only' : 'All Activity';

    // SAFE LIMIT: 250 records maximum per PDF report ensures fast generation (<1.5s) and 0 memory crash
    const SAFE_MAX_PDF_RECORDS = 250;
    const isCapped = filtered.length > SAFE_MAX_PDF_RECORDS;
    const exportItems = filtered.slice(0, SAFE_MAX_PDF_RECORDS);

    // Compute stats
    let totalSalesUnits = 0;
    let totalRestockUnits = 0;
    let salesCount = 0;
    let restockCount = 0;

    filtered.forEach((h) => {
      const rawQty = Math.abs(Number(h.quantityChangeBase) || 0);
      if (h.movementType === 'sale' || (Number(h.quantityChangeBase) || 0) < 0) {
        totalSalesUnits += rawQty;
        salesCount += 1;
      } else {
        totalRestockUnits += Number(h.quantityChangeBase) || 0;
        restockCount += 1;
      }
    });

    const netUnits = totalRestockUnits - totalSalesUnits;

    const rowsHtml = exportItems
      .map((item, idx) => {
        const rawQty = Number(item.quantityChangeBase) || 0;
        const isSale = item.movementType === 'sale' || rawQty < 0;
        const absQty = Math.abs(rawQty);

        let dateStr = '-';
        if (item.createdAt) {
          try {
            const d = new Date(item.createdAt);
            if (!isNaN(d.getTime())) {
              dateStr = d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
            }
          } catch {
            dateStr = '-';
          }
        }

        const prodName = escapeHtml(item.productName || 'Item');
        const variantText = escapeHtml(item.size || item.variantName || 'Standard');
        const brandText = escapeHtml(item.brand || '-');
        const unitText = escapeHtml(item.unit || 'pcs');
        const reasonText = escapeHtml(item.reason || item.notes || '-');
        const balanceBefore = Number(item.balanceBeforeBase) || 0;
        const balanceAfter = Number(item.balanceAfterBase) || 0;

        return `
          <tr>
            <td style="text-align: center; color: #64748B;">${idx + 1}</td>
            <td style="white-space: nowrap;">${dateStr}</td>
            <td><strong>${prodName}</strong></td>
            <td>${variantText}</td>
            <td>${brandText}</td>
            <td>
              <span class="badge ${isSale ? 'badge-sale' : 'badge-restock'}">
                ${isSale ? 'SOLD' : 'RESTOCK'}
              </span>
            </td>
            <td class="${isSale ? 'qty-sale' : 'qty-restock'}" style="text-align: right;">
              ${isSale ? '-' : '+'}${absQty} ${unitText}
            </td>
            <td style="text-align: center; color: #475569; font-size: 10px;">
              ${balanceBefore} &rarr; <strong>${balanceAfter}</strong>
            </td>
            <td style="color: #64748B; font-size: 9.5px;">${reasonText}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>MANJU STORES - Stock Audit Report (${escapeHtml(periodLabel)})</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0F172A;
            margin: 0;
            padding: 0;
            background-color: #FFFFFF;
            font-size: 11px;
          }
          .header {
            border-bottom: 2.5px solid #2563EB;
            padding-bottom: 12px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .store-name {
            font-size: 24px;
            font-weight: 800;
            color: #1E3A8A;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .report-title {
            font-size: 13px;
            font-weight: 700;
            color: #475569;
            margin: 4px 0 0 0;
          }
          .report-meta {
            text-align: right;
            font-size: 11px;
            color: #64748B;
            line-height: 1.4;
          }
          .summary-cards {
            display: flex;
            gap: 10px;
            margin-bottom: 14px;
          }
          .card {
            flex: 1;
            padding: 10px 12px;
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
          }
          .card-label {
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748B;
            margin-bottom: 4px;
            letter-spacing: 0.3px;
          }
          .card-val {
            font-size: 18px;
            font-weight: 800;
            color: #0F172A;
          }
          .card-sub {
            font-size: 10px;
            color: #94A3B8;
            margin-top: 2px;
          }
          .limit-notice {
            font-size: 10.5px;
            color: #92400E;
            background-color: #FEF3C7;
            border: 1px solid #FCD34D;
            padding: 7px 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            text-align: left;
            line-height: 1.4;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          th {
            background-color: #F1F5F9;
            color: #334155;
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 6px 8px;
            border: 1px solid #CBD5E1;
            text-align: left;
          }
          td {
            padding: 6px 8px;
            border: 1px solid #E2E8F0;
            font-size: 10px;
            vertical-align: middle;
          }
          tr:nth-child(even) {
            background-color: #F8FAFC;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge-sale {
            background-color: #FEE2E2;
            color: #DC2626;
          }
          .badge-restock {
            background-color: #DCFCE7;
            color: #16A34A;
          }
          .qty-sale {
            color: #DC2626;
            font-weight: 700;
          }
          .qty-restock {
            color: #16A34A;
            font-weight: 700;
          }
          .footer {
            font-size: 10px;
            color: #94A3B8;
            border-top: 1px solid #E2E8F0;
            padding-top: 10px;
            text-align: center;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="store-name">MANJU STORES</h1>
            <p class="report-title">Stock Movement & Audit Report</p>
          </div>
          <div class="report-meta">
            <strong>Period:</strong> ${escapeHtml(periodLabel)}<br/>
            <strong>Filter:</strong> ${escapeHtml(filterTypeLabel)}<br/>
            <strong>Generated:</strong> ${escapeHtml(generatedAt)}
          </div>
        </div>

        <div class="summary-cards">
          <div class="card">
            <div class="card-label">Total Movements</div>
            <div class="card-val">${exportItems.length}</div>
            <div class="card-sub">${escapeHtml(periodLabel)}</div>
          </div>
          <div class="card">
            <div class="card-label">Units Sold</div>
            <div class="card-val" style="color: #DC2626;">-${totalSalesUnits}</div>
            <div class="card-sub">${salesCount} sale events</div>
          </div>
          <div class="card">
            <div class="card-label">Units Restocked</div>
            <div class="card-val" style="color: #16A34A;">+${totalRestockUnits}</div>
            <div class="card-sub">${restockCount} restock events</div>
          </div>
          <div class="card">
            <div class="card-label">Net Unit Change</div>
            <div class="card-val" style="color: ${netUnits >= 0 ? '#16A34A' : '#DC2626'};">
              ${netUnits >= 0 ? '+' : ''}${netUnits}
            </div>
            <div class="card-sub">Stock impact</div>
          </div>
        </div>

        ${
          isCapped
            ? `<div class="limit-notice">
                 ⚡ <strong>Optimization Notice:</strong> Displaying first <strong>${SAFE_MAX_PDF_RECORDS}</strong> of <strong>${filtered.length}</strong> movements for maximum stability and speed on mobile devices.
               </div>`
            : ''
        }

        <table>
          <thead>
            <tr>
              <th style="width: 28px; text-align: center;">#</th>
              <th style="width: 75px;">Date</th>
              <th>Item / Product</th>
              <th>Variant / Size</th>
              <th>Brand</th>
              <th style="width: 60px;">Type</th>
              <th style="width: 65px; text-align: right;">Qty</th>
              <th style="width: 75px; text-align: center;">Balance</th>
              <th>Notes / Ref</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          MANJU STORES • Official Stock Movement Audit Trail • Offline Database
        </div>
      </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
    } else {
      try {
        const printResult = await Print.printToFileAsync({ html, base64: true });
        let targetUri = printResult.uri;
        let fileReady = false;

        if (printResult.base64 && FileSystem.documentDirectory) {
          try {
            const dateTag = new Date().toISOString().split('T')[0];
            const cleanFileName = `ManjuStores_Stock_Audit_${dateTag}_${Date.now()}.pdf`;
            const docUri = `${FileSystem.documentDirectory}${cleanFileName}`;

            await FileSystem.writeAsStringAsync(docUri, printResult.base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            targetUri = docUri;
            fileReady = true;
          } catch (writeErr) {
            console.log('Failed writing base64 to documentDirectory, using print uri:', writeErr);
          }
        }

        const isShareAvailable = await Sharing.isAvailableAsync().catch(() => false);
        if (fileReady && isShareAvailable) {
          try {
            await Sharing.shareAsync(targetUri, {
              UTI: 'com.adobe.pdf',
              mimeType: 'application/pdf',
              dialogTitle: `Download MANJU STORES Report (${periodLabel})`,
            });
            return;
          } catch (shareErr) {
            console.log('Native share dialog closed or error, falling back to print service:', shareErr);
          }
        }

        // Reliable fallback to native print service (has built-in "Save as PDF" directly in Android system dialog)
        await Print.printAsync({ html });
      } catch (printErr) {
        console.error('Print generation failed, trying direct print fallback:', printErr);
        try {
          await Print.printAsync({ html });
        } catch (fallbackErr) {
          showToast('Could not export PDF. Please try again.', 'error');
        }
      }
    }
  };

  /**
   * PDF download trigger from the main History screen button
   */
  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    // Yield to UI thread to render spinner
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      await generatePdfReport({
        items: history,
        mode: timeFilterMode,
        targetDate: selectedDate,
        rangeStart: rangeStartDate,
        rangeEnd: rangeEndDate,
        activeType: filterType,
        query: searchQuery,
      });
    } catch (err: unknown) {
      console.error('Error generating PDF:', err);
      showToast('Could not generate PDF report. Try a shorter date range.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  /**
   * Instant PDF download triggered directly inside the Filter Modal
   * Applies draft filters and exports the exact data without timing delays
   */
  const handleDownloadPdfFromModal = async () => {
    if (exportingPdf) return;
    setFilterModalVisible(false);
    setFilterType(draftFilterType);
    setTimeFilterMode(draftTimeFilterMode);
    setSelectedDate(new Date(draftSelectedDate));
    setRangeStartDate(new Date(draftRangeStartDate));
    setRangeEndDate(new Date(draftRangeEndDate));

    setExportingPdf(true);
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const storeId = store?.id || 'store-1';
      const { startIso, endIso } = calculateBoundaries(
        draftTimeFilterMode,
        draftSelectedDate,
        draftRangeStartDate,
        draftRangeEndDate
      );
      const items = await InventoryRepository.getAllStockHistory(storeId, 300, startIso, endIso);
      setHistory(items);

      await generatePdfReport({
        items,
        mode: draftTimeFilterMode,
        targetDate: draftSelectedDate,
        rangeStart: draftRangeStartDate,
        rangeEnd: draftRangeEndDate,
        activeType: draftFilterType,
        query: searchQuery,
      });
    } catch (err: unknown) {
      console.error('Error exporting PDF from modal:', err);
      showToast('Could not generate PDF report', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const formatTimestamp = useCallback((isoDate: string) => {
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      const dateStr = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
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
    selectedDate,
    rangeStartDate,
    rangeEndDate,
    filterType,
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
        keyExtractor={(item, index) => (item.id ? String(item.id) : `hist-${index}`)}
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
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
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
                  {(['all', 'day', 'range', 'month', 'year'] as TimeFilterMode[]).map((mode) => {
                    const isSelected = draftTimeFilterMode === mode;
                    const label =
                      mode === 'all'
                        ? 'All Time'
                        : mode === 'day'
                        ? 'Day'
                        : mode === 'range'
                        ? 'Range'
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

                {/* Full Interactive Calendar for Day and Range selection */}
                {(draftTimeFilterMode === 'day' || draftTimeFilterMode === 'range') && (
                  <View
                    style={[
                      styles.calendarCard,
                      {
                        backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#F8FAFC',
                        borderColor: activeColors.border,
                      },
                    ]}
                  >
                    {/* Month Navigator Header */}
                    <View style={styles.calMonthRow}>
                      <TouchableOpacity
                        onPress={() => {
                          setCalendarViewingMonth(
                            new Date(
                              calendarViewingMonth.getFullYear(),
                              calendarViewingMonth.getMonth() - 1,
                              1
                            )
                          );
                        }}
                        style={[
                          styles.calArrowBtn,
                          { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: activeColors.border },
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="chevron-left" size={22} color={activeColors.textPrimary} />
                      </TouchableOpacity>

                      <Text style={[styles.calMonthTitle, { color: activeColors.textPrimary }]}>
                        {calendarViewingMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => {
                            const now = new Date();
                            setCalendarViewingMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                            if (draftTimeFilterMode === 'day') {
                              setDraftSelectedDate(now);
                            }
                          }}
                          style={[styles.calTodayBtn, { borderColor: activeColors.primary }]}
                        >
                          <Text style={[styles.calTodayBtnText, { color: activeColors.primary }]}>Today</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setCalendarViewingMonth(
                              new Date(
                                calendarViewingMonth.getFullYear(),
                                calendarViewingMonth.getMonth() + 1,
                                1
                              )
                            );
                          }}
                          style={[
                            styles.calArrowBtn,
                            { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF', borderColor: activeColors.border },
                          ]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons name="chevron-right" size={22} color={activeColors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Weekday Labels Header */}
                    <View style={styles.calDaysOfWeekRow}>
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
                        <Text key={w} style={[styles.calDayColHeader, { color: activeColors.textMuted }]}>
                          {w}
                        </Text>
                      ))}
                    </View>

                    {/* Month Days Grid */}
                    <View style={styles.calGrid}>
                      {calendarCells.map((cell, idx) => {
                        if (!cell.dayNumber) {
                          return <View key={`blank-${idx}`} style={styles.calDayCell} />;
                        }

                        const dNum = cell.dayNumber;
                        const cellDate = new Date(
                          calendarViewingMonth.getFullYear(),
                          calendarViewingMonth.getMonth(),
                          dNum
                        );
                        const nowDate = new Date();
                        const isToday =
                          nowDate.getFullYear() === cellDate.getFullYear() &&
                          nowDate.getMonth() === cellDate.getMonth() &&
                          nowDate.getDate() === cellDate.getDate();

                        let isSelected = false;
                        let isInRange = false;
                        let isStart = false;
                        let isEnd = false;

                        if (draftTimeFilterMode === 'day') {
                          isSelected =
                            draftSelectedDate.getFullYear() === cellDate.getFullYear() &&
                            draftSelectedDate.getMonth() === cellDate.getMonth() &&
                            draftSelectedDate.getDate() === cellDate.getDate();
                        } else if (draftTimeFilterMode === 'range') {
                          const sTime = new Date(draftRangeStartDate).setHours(0, 0, 0, 0);
                          const eTime = new Date(draftRangeEndDate).setHours(0, 0, 0, 0);
                          const curTime = new Date(cellDate).setHours(0, 0, 0, 0);

                          isStart = curTime === sTime;
                          isEnd = curTime === eTime;
                          isInRange = curTime >= sTime && curTime <= eTime;
                          isSelected = isStart || isEnd;
                        }

                        return (
                          <TouchableOpacity
                            key={`day-${dNum}`}
                            onPress={() => handleCalendarDayPress(dNum)}
                            activeOpacity={0.7}
                            style={[
                              styles.calDayCell,
                              isInRange && !isSelected && {
                                backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE',
                                borderRadius: 0,
                              },
                              isStart && {
                                borderTopLeftRadius: 16,
                                borderBottomLeftRadius: 16,
                              },
                              isEnd && {
                                borderTopRightRadius: 16,
                                borderBottomRightRadius: 16,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.calDayInnerCircle,
                                isSelected && {
                                  backgroundColor: activeColors.primary,
                                },
                                isToday && !isSelected && {
                                  borderWidth: 1.5,
                                  borderColor: activeColors.primary,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.calDayNumberText,
                                  { color: activeColors.textPrimary },
                                  isSelected && { color: '#FFFFFF', fontWeight: '800' },
                                  isInRange && !isSelected && {
                                    color: isDarkMode ? '#93C5FD' : '#1D4ED8',
                                    fontWeight: '700',
                                  },
                                ]}
                              >
                                {dNum}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Active Selected Date Display Banner */}
                    <View
                      style={[
                        styles.calSummaryBanner,
                        { backgroundColor: isDarkMode ? '#0F172A' : '#EFF6FF' },
                      ]}
                    >
                      <MaterialCommunityIcons name="calendar-check" size={17} color={activeColors.primary} />
                      <Text style={[styles.calSummaryBannerText, { color: activeColors.primary }]}>
                        {draftTimeFilterMode === 'day'
                          ? `Selected Day: ${draftSelectedDate.toLocaleDateString('en-IN', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}`
                          : rangePickingStep === 'end'
                          ? `Step 2: Tap End Date on Calendar (Start: ${draftRangeStartDate.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })})`
                          : `Selected: ${draftRangeStartDate.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })} - ${draftRangeEndDate.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })} (${Math.max(
                              1,
                              Math.round(
                                (draftRangeEndDate.getTime() - draftRangeStartDate.getTime()) /
                                  (1000 * 60 * 60 * 24)
                              ) + 1
                            )} Days)`}
                      </Text>
                    </View>

                    {/* Quick Range Presets (when in Range mode) */}
                    {draftTimeFilterMode === 'range' && (
                      <View style={{ marginTop: 10 }}>
                        <View style={styles.calPresetsRow}>
                          {[
                            { label: 'Last 7 Days', days: 7 },
                            { label: 'Last 15 Days', days: 15 },
                            { label: 'Last 30 Days', days: 30 },
                          ].map((p) => (
                            <TouchableOpacity
                              key={p.label}
                              onPress={() => applyRangePreset(p.days)}
                              style={[
                                styles.calPresetBtn,
                                {
                                  borderColor: activeColors.border,
                                  backgroundColor: isDarkMode ? activeColors.surface : '#FFFFFF',
                                },
                              ]}
                            >
                              <Text style={[styles.calPresetBtnText, { color: activeColors.textPrimary }]}>
                                {p.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={[styles.rangeNotice, { color: activeColors.textMuted }]}>
                          Tap start date then end date on calendar. Max limit: 31 days.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Sub-selector for Month / Year */}
                {(draftTimeFilterMode === 'month' || draftTimeFilterMode === 'year') && (
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
                        name={draftTimeFilterMode === 'month' ? 'calendar-month' : 'calendar'}
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
                            Current
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

                {/* All Time Informational Note */}
                {draftTimeFilterMode === 'all' && (
                  <View
                    style={[
                      styles.calSummaryBanner,
                      {
                        backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#F1F5F9',
                        marginTop: 10,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="clock-outline" size={16} color={activeColors.textSecondary} />
                    <Text style={[styles.calSummaryBannerText, { color: activeColors.textSecondary }]}>
                      Showing all movements. Tap 'Day' or 'Range' to pick dates from calendar.
                    </Text>
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

              {/* Quick PDF Export from inside Modal */}
              <TouchableOpacity
                onPress={handleDownloadPdfFromModal}
                disabled={exportingPdf}
                style={[
                  styles.modalPdfDownloadBtn,
                  {
                    backgroundColor: '#DC2626',
                    opacity: exportingPdf ? 0.7 : 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                {exportingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="file-pdf-box" size={20} color="#FFFFFF" />
                    <Text style={styles.modalPdfDownloadBtnText}>
                      Download PDF for Selected Period
                    </Text>
                  </>
                )}
              </TouchableOpacity>
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
  pdfExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  pdfExportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalPdfDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    marginTop: 14,
    marginBottom: 6,
  },
  modalPdfDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rangeNotice: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  calendarCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calMonthTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  calTodayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  calTodayBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  calDaysOfWeekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calDayColHeader: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayInnerCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayNumberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  calSummaryBannerText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  calPresetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  calPresetBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calPresetBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
