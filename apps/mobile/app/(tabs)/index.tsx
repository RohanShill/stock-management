import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar as RNStatusBar,
  TextInput as RNTextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Surface, Portal, Dialog, TextInput, Chip } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/useAppStore.js';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import { lightColors, darkColors, colors, spacing, borderRadius, shadows, getThemeShadows } from '../../src/theme/tokens.js';
import { StockSuccessModal, StockSuccessInfo } from '../../src/components/StockSuccessModal.js';

interface RestockItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  brand?: string;
  imageUrl?: string;
  categoryName?: string;
  currentStock: number;
  minStockLevel: number;
  unit: string;
  isOutOfStock: boolean;
  rackLocation?: string;
  sellingPricePaise?: number;
}

interface StockStats {
  totalProductsCount: number;
  totalVariantsCount: number;
  totalUnitsInStock: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface RestockItemFormProps {
  item: RestockItem;
  mode: 'add' | 'sell';
  onChangeItem: () => void;
  onCancel: () => void;
  onConfirm: (item: RestockItem, mode: 'add' | 'sell', qty: number, note: string) => Promise<void>;
  updatingStock: boolean;
  isDarkMode: boolean;
  activeColors: any;
}

const RestockItemForm: React.FC<RestockItemFormProps> = React.memo(({
  item,
  mode,
  onChangeItem,
  onCancel,
  onConfirm,
  updatingStock,
  isDarkMode,
  activeColors,
}) => {
  const [currentMode, setCurrentMode] = useState<'add' | 'sell'>(mode);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setCurrentMode(mode);
    setQty('');
    setNote('');
  }, [item, mode]);

  const numQty = parseFloat(qty) || 0;
  const isInsufficient = currentMode === 'sell' && numQty > item.currentStock;
  const isConfirmDisabled = updatingStock || qty.trim() === '' || numQty <= 0 || isInsufficient;

  return (
    <View>
      {/* Target Item Header */}
      <View
        style={[
          styles.targetItemCard,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
            borderColor: activeColors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.targetName, { color: activeColors.textPrimary }]}>{item.productName}</Text>
          <Text style={[styles.targetSub, { color: activeColors.textSecondary }]}>
            {item.variantName}{' '}
            {item.brand ? `• ${item.brand}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onChangeItem}
          style={styles.changeBtn}
        >
          <Text style={[styles.changeBtnText, { color: activeColors.primary }]}>Change</Text>
        </TouchableOpacity>
      </View>

      {/* Current Stock */}
      <View style={styles.currentStockRow}>
        <Text style={[styles.currentLabel, { color: activeColors.textSecondary }]}>Available Stock:</Text>
        <Text style={[styles.currentVal, { color: activeColors.textPrimary }]}>
          {item.currentStock} {item.unit}
        </Text>
      </View>

      {/* Custom numeric input */}
      <View style={{ marginTop: spacing.md }}>
        <Text style={[styles.inputLabel, { color: activeColors.textSecondary }]}>
          {currentMode === 'sell' ? 'QUANTITY TO SELL' : 'QUANTITY TO ADD'} ({item.unit.toUpperCase()}) *
        </Text>
        <RNTextInput
          value={qty}
          onChangeText={(val) => {
            const cleaned = val.replace(/[^0-9.]/g, '');
            setQty(cleaned);
          }}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          autoCorrect={false}
          style={[
            styles.smoothNumericInput,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
              borderColor: isInsufficient ? '#DC2626' : (currentMode === 'sell' ? '#DC2626' : activeColors.primary),
              color: activeColors.textPrimary,
            },
          ]}
          placeholderTextColor={activeColors.textMuted}
          placeholder="Enter quantity"
        />
      </View>

      {/* Optional Note / Customer */}
      <View style={{ marginTop: spacing.sm }}>
        <Text style={[styles.inputLabel, { color: activeColors.textSecondary }]}>
          CUSTOMER NAME / NOTE (OPTIONAL)
        </Text>
        <RNTextInput
          value={note}
          onChangeText={setNote}
          autoCorrect={false}
          style={[
            styles.smoothNoteInput,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
              borderColor: activeColors.border,
              color: activeColors.textPrimary,
            },
          ]}
          placeholderTextColor={activeColors.textMuted}
          placeholder="e.g. Sold to Cash Customer"
        />
      </View>

      {/* Live Preview */}
      <View style={styles.previewContainerFixed}>
        {currentMode === 'sell' ? (
          isInsufficient ? (
            <View style={styles.previewBoxError}>
              <Text style={styles.previewTextError}>
                ⚠️ Insufficient stock! Available: {item.currentStock}{' '}
                {item.unit}
              </Text>
            </View>
          ) : (
            <View style={styles.previewBoxSell}>
              <Text style={styles.previewTextSell}>
                Stock after Sale:{' '}
                <Text style={styles.previewHighlightSell}>
                  {Math.max(0, item.currentStock - numQty)}{' '}
                  {item.unit}
                </Text>
              </Text>
            </View>
          )
        ) : (
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>
              New Total Stock will be:{' '}
              <Text style={styles.previewHighlight}>
                {Math.max(0, item.currentStock) + numQty}{' '}
                {item.unit}
              </Text>
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md }}>
        <TouchableOpacity
          onPress={onCancel}
          style={styles.dialogCancelBtn}
          disabled={updatingStock}
        >
          <Text style={[styles.dialogCancelText, { color: activeColors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onConfirm(item, currentMode, numQty, note)}
          disabled={isConfirmDisabled}
          style={[
            currentMode === 'sell'
              ? styles.dialogConfirmBtnSell
              : styles.dialogConfirmBtn,
            isConfirmDisabled && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.dialogConfirmText}>
            {updatingStock
              ? 'Processing...'
              : currentMode === 'sell'
              ? 'Confirm Sale'
              : 'Confirm Stock'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const router = useRouter();
  const { store, deviceId, isDarkMode, showToast } = useAppStore();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web'
    ? 0
    : Math.max(
        insets.top || 0,
        (Platform.OS === 'android' ? RNStatusBar.currentHeight : 0) || 0,
        40
      );
  const activeColors = isDarkMode ? darkColors : lightColors;
  const themeShadows = getThemeShadows(isDarkMode);

  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StockStats>({
    totalProductsCount: 0,
    totalVariantsCount: 0,
    totalUnitsInStock: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  const [lowStockItems, setLowStockItems] = useState<RestockItem[]>([]);
  const [allSelectableItems, setAllSelectableItems] = useState<RestockItem[]>([]);

  // Restock Dialog State
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [restockMode, setRestockMode] = useState<'add' | 'sell'>('add');
  const [selectedRestockItem, setSelectedRestockItem] = useState<RestockItem | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);
  const [stockSuccess, setStockSuccess] = useState<StockSuccessInfo | null>(null);

  const loadData = useCallback(async () => {
    try {
      const storeId = store?.id || 'store-1';
      const [products, categories] = await Promise.all([
        ProductRepository.getProductsWithVariants(storeId),
        ProductRepository.getCategories(storeId),
      ]);

      const catMap = new Map<string, string>();
      categories.forEach((c) => catMap.set(c.id, c.name));

      let totalUnits = 0;
      let totalVariants = 0;
      let lowCount = 0;
      let outCount = 0;

      const lowList: RestockItem[] = [];
      const allList: RestockItem[] = [];

      for (const p of products) {
        for (const v of p.variants) {
          totalVariants += 1;
          const stock = Number(v.currentStock ?? 0);
          const minLevel = Number(v.minStockLevel ?? 5);
          totalUnits += Math.max(0, stock);

          const isOut = stock <= 0;
          const isLow = stock <= minLevel;

          const itemObj: RestockItem = {
            variantId: v.id,
            productId: p.id,
            productName: p.name,
            variantName: v.name || 'Standard',
            brand: p.brand,
            imageUrl: p.imageUrl,
            categoryName: catMap.get(p.categoryId) || 'Hardware',
            currentStock: stock,
            minStockLevel: minLevel,
            unit: p.baseUnit || 'pcs',
            isOutOfStock: isOut,
            rackLocation: v.rackLocation,
            sellingPricePaise: v.sellingPricePaise,
          };

          allList.push(itemObj);

          if (isOut || isLow) {
            if (isOut) outCount += 1;
            else lowCount += 1;
            lowList.push(itemObj);
          }
        }
      }

      // Sort low stock: out of stock first, then lowest quantity
      lowList.sort((a, b) => {
        if (a.isOutOfStock && !b.isOutOfStock) return -1;
        if (!a.isOutOfStock && b.isOutOfStock) return 1;
        return a.currentStock - b.currentStock;
      });

      setStats({
        totalProductsCount: products.filter((p) => p.variants && p.variants.length > 0).length,
        totalVariantsCount: totalVariants,
        totalUnitsInStock: totalUnits,
        lowStockCount: lowCount,
        outOfStockCount: outCount,
      });

      setLowStockItems(lowList);
      setAllSelectableItems(allList);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, [store]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleOpenRestockForItem = (item: RestockItem) => {
    setSelectedRestockItem(item);
    setRestockMode('add');
    setItemSearchQuery('');
    setRestockModalVisible(true);
  };

  const handleOpenGeneralAddStock = () => {
    setSelectedRestockItem(null);
    setRestockMode('add');
    setItemSearchQuery('');
    setRestockModalVisible(true);
  };

  const handleOpenGeneralSellStock = () => {
    setSelectedRestockItem(null);
    setRestockMode('sell');
    setItemSearchQuery('');
    setRestockModalVisible(true);
  };

  const handleConfirmStockOperation = async (
    item: RestockItem,
    mode: 'add' | 'sell',
    qty: number,
    note: string
  ) => {
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid stock quantity (e.g. 10)', 'warning');
      return;
    }

    if (mode === 'sell' && qty > item.currentStock) {
      showToast(`Cannot sell ${qty} ${item.unit}. Available: ${item.currentStock} ${item.unit}.`, 'warning');
      return;
    }

    try {
      setUpdatingStock(true);
      const storeId = store?.id || 'store-1';
      await InventoryRepository.adjustStock(
        item.variantId,
        qty,
        (item.unit as any) || 'piece',
        mode === 'sell' ? 'sale' : 'increase',
        note.trim() ||
          (mode === 'sell'
            ? `Sold ${qty} ${item.unit}`
            : 'Manual stock addition'),
        storeId,
        deviceId
      );

      const previousStock = item.currentStock;
      const newStock = mode === 'sell' ? Math.max(0, item.currentStock - qty) : item.currentStock + qty;
      const successData: StockSuccessInfo = {
        mode,
        qty,
        unit: item.unit,
        productName: item.productName,
        variantName: item.variantName,
        previousStock,
        newStock,
      };

      setRestockModalVisible(false);
      setSelectedRestockItem(null);
      setStockSuccess(successData);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      showToast(msg, 'error');
    } finally {
      setUpdatingStock(false);
    }
  };

  const handleOpenActionForItem = (item: RestockItem, mode: 'add' | 'sell') => {
    setSelectedRestockItem(item);
    setRestockMode(mode);
    setRestockModalVisible(true);
  };

  const homeSearchResults = React.useMemo(() => {
    const query = homeSearchQuery.trim().toLowerCase();
    if (!query) return [];
    const terms = query.split(/\s+/).filter(Boolean);
    return allSelectableItems.filter((item) => {
      const searchTarget = `${item.productName} ${item.variantName} ${item.brand || ''} ${item.categoryName || ''} ${item.rackLocation || ''}`.toLowerCase();
      return terms.every((term) => searchTarget.includes(term));
    });
  }, [allSelectableItems, homeSearchQuery]);

  const filteredItemsForSearch = React.useMemo(() => {
    if (!itemSearchQuery.trim()) return allSelectableItems.slice(0, 15);
    const terms = itemSearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return allSelectableItems.filter((i) => {
      const target = `${i.productName} ${i.variantName} ${i.brand || ''} ${i.categoryName || ''}`.toLowerCase();
      return terms.every((t) => target.includes(t));
    });
  }, [allSelectableItems, itemSearchQuery]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: activeColors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(topInset + 8, spacing.lg) },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeColors.primary} />
      }
    >
      {/* 1. Clean Header with Store Logo & Instant Search Bar */}
      <Surface
        style={[
          styles.headerCard,
          {
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View
            style={[
              styles.logoWrapper,
              {
                backgroundColor: '#FFFFFF',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
              },
            ]}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTextCol}>
            <Text
              style={[styles.storeName, { color: activeColors.textPrimary }]}
              numberOfLines={1}
            >
              MANJU STORES
            </Text>
          </View>
        </View>

        {/* Search Bar directly under Store Name */}
        <View style={styles.headerSearchWrap}>
          <View
            style={[
              styles.headerSearchBox,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                borderColor: isDarkMode ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={activeColors.primary}
              style={styles.searchIcon}
            />
            <RNTextInput
              value={homeSearchQuery}
              onChangeText={setHomeSearchQuery}
              placeholder="Search product, size or brand to stock/sell..."
              placeholderTextColor={activeColors.textMuted}
              style={[styles.headerSearchInput, { color: activeColors.textPrimary }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {homeSearchQuery.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => setHomeSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.searchClearBtn}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={activeColors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Surface>

      {/* When searching, show Instant Search Results with Stock/Sell actions */}
      {homeSearchQuery.trim().length > 0 ? (
        <View style={styles.searchResultsContainer}>
          <View style={styles.searchResultsHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="magnify" size={18} color={activeColors.primary} />
              <Text style={[styles.searchResultsTitle, { color: activeColors.textPrimary }]}>
                Search Results ({homeSearchResults.length})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setHomeSearchQuery('')}
              style={styles.clearSearchBtn}
            >
              <Text style={[styles.clearSearchText, { color: activeColors.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          {homeSearchResults.length === 0 ? (
            <Surface
              style={[
                styles.emptySearchCard,
                {
                  backgroundColor: activeColors.surface,
                  borderColor: activeColors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="cube-off-outline"
                size={44}
                color={activeColors.textMuted}
              />
              <Text style={[styles.emptySearchTitle, { color: activeColors.textPrimary }]}>
                No matching products found
              </Text>
              <Text style={[styles.emptySearchSub, { color: activeColors.textSecondary }]}>
                No items matched "{homeSearchQuery}". Try searching by size (e.g. 1/2) or brand (e.g. AKG).
              </Text>
              <TouchableOpacity
                onPress={() => setHomeSearchQuery('')}
                style={[styles.emptyClearBtn, { backgroundColor: activeColors.primary }]}
              >
                <Text style={styles.emptyClearBtnText}>Clear Search</Text>
              </TouchableOpacity>
            </Surface>
          ) : (
            <View style={styles.searchList}>
              {homeSearchResults.map((item) => (
                <Surface
                  key={item.variantId}
                  style={[
                    styles.searchItemCard,
                    {
                      backgroundColor: activeColors.surface,
                      borderColor: activeColors.border,
                    },
                  ]}
                >
                  <View style={styles.searchItemHeaderRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={[styles.searchItemName, { color: activeColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {item.productName}
                      </Text>
                      <View style={styles.searchItemMetaRow}>
                        <View style={[styles.searchSizeBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                          <Text style={[styles.searchSizeText, { color: activeColors.textPrimary }]}>
                            {item.variantName}
                          </Text>
                        </View>
                        {item.brand ? (
                          <View style={[styles.searchBrandBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                            <Text style={[styles.searchBrandText, { color: activeColors.textSecondary }]}>
                              {item.brand}
                            </Text>
                          </View>
                        ) : null}
                        {item.categoryName ? (
                          <Text style={[styles.searchCategoryText, { color: activeColors.textMuted }]}>
                            • {item.categoryName}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View
                      style={[
                        styles.searchStockPill,
                        item.currentStock <= 0
                          ? styles.stockPillOut
                          : item.currentStock <= item.minStockLevel
                          ? styles.stockPillLow
                          : styles.stockPillOk,
                      ]}
                    >
                      <Text
                        style={[
                          styles.searchStockPillText,
                          item.currentStock <= 0
                            ? styles.stockTextOut
                            : item.currentStock <= item.minStockLevel
                            ? styles.stockTextLow
                            : styles.stockTextOk,
                        ]}
                      >
                        {item.currentStock <= 0 ? 'Out of Stock' : `${item.currentStock} ${item.unit}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.searchActionsRow}>
                    {item.rackLocation ? (
                      <Text style={[styles.searchRackText, { color: activeColors.textMuted }]}>
                        📍 {item.rackLocation}
                      </Text>
                    ) : <View />}

                    <View style={styles.searchButtonsWrap}>
                      <TouchableOpacity
                        style={styles.actionStockInBtn}
                        onPress={() => handleOpenActionForItem(item, 'add')}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="plus" size={15} color="#FFFFFF" />
                        <Text style={styles.actionBtnLabel}>+ Stock</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionSellBtn}
                        onPress={() => handleOpenActionForItem(item, 'sell')}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="cart-outline" size={15} color="#FFFFFF" />
                        <Text style={styles.actionBtnLabel}>Sell</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Surface>
              ))}
            </View>
          )}
        </View>
      ) : (
        <>

      {/* 2. Quick Actions (3 Action Buttons) */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { action: 'add' },
            })
          }
          activeOpacity={0.85}
        >
          <View style={styles.actionIconWrapper}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitlePrimary} numberOfLines={1}>Add Product</Text>
            <Text style={styles.actionSubtitlePrimary} numberOfLines={1}>New item</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonSecondary,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          onPress={handleOpenGeneralAddStock}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.actionIconWrapper,
              { backgroundColor: isDarkMode ? '#052E16' : '#DCFCE7' },
            ]}
          >
            <MaterialCommunityIcons name="arrow-up-bold-box" size={22} color="#16A34A" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={[styles.actionTitleSecondary, { color: activeColors.textPrimary }]} numberOfLines={1}>
              Add Stock
            </Text>
            <Text style={[styles.actionSubtitleSecondary, { color: activeColors.textSecondary }]} numberOfLines={1}>
              Restock
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionButtonSell,
            {
              backgroundColor: activeColors.surface,
              borderColor: isDarkMode ? '#7F1D1D' : '#FECDD3',
            },
          ]}
          onPress={handleOpenGeneralSellStock}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.actionIconWrapper,
              { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2' },
            ]}
          >
            <MaterialCommunityIcons name="arrow-down-bold-box" size={22} color="#DC2626" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitleSell} numberOfLines={1}>Sell Stock</Text>
            <Text style={styles.actionSubtitleSell} numberOfLines={1}>Stock out</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 3. 2x2 Quick Stats Cards */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: activeColors.textPrimary }]}>Stock Overview</Text>
      </View>

      <View style={styles.statsGrid}>
        {/* Total Products */}
        <TouchableOpacity
          style={[
            styles.statCard,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          onPress={() => router.push('/(tabs)/products')}
          activeOpacity={0.8}
        >
          <View style={styles.statCardTop}>
            <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Total Products</Text>
            <MaterialCommunityIcons name="package-variant-closed" size={20} color={activeColors.primary} />
          </View>
          <Text style={[styles.statValue, { color: activeColors.primary }]}>
            {stats.totalProductsCount}
          </Text>
          <Text style={[styles.statSub, { color: activeColors.textMuted }]}>In catalog</Text>
        </TouchableOpacity>

        {/* Total Stock Units */}
        <TouchableOpacity
          style={[
            styles.statCard,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
          onPress={() => router.push('/(tabs)/products')}
          activeOpacity={0.8}
        >
          <View style={styles.statCardTop}>
            <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Stock Units</Text>
            <MaterialCommunityIcons name="layers" size={20} color={activeColors.accent} />
          </View>
          <Text style={[styles.statValue, { color: activeColors.accent }]}>
            {stats.totalUnitsInStock.toLocaleString('en-IN')}
          </Text>
          <Text style={[styles.statSub, { color: activeColors.textMuted }]}>Total inventory</Text>
        </TouchableOpacity>

        {/* Low Stock */}
        <TouchableOpacity
          style={[
            styles.statCard,
            {
              backgroundColor: isDarkMode && stats.lowStockCount > 0 ? '#451A03' : activeColors.surface,
              borderColor: stats.lowStockCount > 0 ? (isDarkMode ? '#D97706' : '#FDE68A') : activeColors.border,
            },
            !isDarkMode && stats.lowStockCount > 0 && styles.statCardWarning,
          ]}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { filter: 'low' },
            })
          }
          activeOpacity={0.8}
        >
          <View style={styles.statCardTop}>
            <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Low Stock</Text>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.warning} />
          </View>
          <Text
            style={[
              styles.statValue,
              { color: stats.lowStockCount > 0 ? colors.warning : activeColors.textPrimary },
            ]}
          >
            {stats.lowStockCount}
          </Text>
          <Text style={[styles.statSub, { color: activeColors.textMuted }]}>Needs reorder</Text>
        </TouchableOpacity>

        {/* Out of Stock */}
        <TouchableOpacity
          style={[
            styles.statCard,
            {
              backgroundColor: isDarkMode && stats.outOfStockCount > 0 ? '#450A0A' : activeColors.surface,
              borderColor: stats.outOfStockCount > 0 ? (isDarkMode ? '#DC2626' : '#FECACA') : activeColors.border,
            },
            !isDarkMode && stats.outOfStockCount > 0 && styles.statCardDanger,
          ]}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { filter: 'out' },
            })
          }
          activeOpacity={0.8}
        >
          <View style={styles.statCardTop}>
            <Text style={[styles.statLabel, { color: activeColors.textSecondary }]}>Out of Stock</Text>
            <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.danger} />
          </View>
          <Text
            style={[
              styles.statValue,
              { color: stats.outOfStockCount > 0 ? colors.danger : activeColors.textPrimary },
            ]}
          >
            {stats.outOfStockCount}
          </Text>
          <Text style={[styles.statSub, { color: activeColors.textMuted }]}>Zero balance</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Low Stock Restock List */}
      <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.sectionTitle, { color: activeColors.textPrimary }]}>Restock Needed</Text>
          {lowStockItems.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{lowStockItems.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { filter: 'low' },
            })
          }
        >
          <Text style={[styles.viewAllText, { color: activeColors.primary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      {lowStockItems.length > 0 ? (
        <View style={styles.listContainer}>
          {lowStockItems.slice(0, 8).map((item) => (
            <Surface
              key={item.variantId}
              style={[
                styles.restockCard,
                {
                  backgroundColor: activeColors.surface,
                  borderColor: activeColors.border,
                },
              ]}
            >
              <View style={styles.restockCardRow}>
                {/* Product Image / Icon */}
                <View
                  style={[
                    styles.imageBox,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                  ]}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.prodThumb} />
                  ) : (
                    <MaterialCommunityIcons
                      name="cube-outline"
                      size={26}
                      color={colors.textSecondary}
                    />
                  )}
                </View>

                {/* Details */}
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemTitle, { color: activeColors.textPrimary }]} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: activeColors.textSecondary }]} numberOfLines={1}>
                    {item.variantName} {item.brand ? `• ${item.brand}` : ''}
                  </Text>

                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.statusPill,
                        item.isOutOfStock ? styles.statusPillOut : styles.statusPillLow,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          item.isOutOfStock ? styles.statusTextOut : styles.statusTextLow,
                        ]}
                      >
                        {item.isOutOfStock
                          ? 'Out of Stock'
                          : `${item.currentStock} ${item.unit} left (Min: ${item.minStockLevel})`}
                      </Text>
                    </View>
                    {item.rackLocation ? (
                      <Text style={[styles.rackText, { color: activeColors.textMuted }]}>📍 {item.rackLocation}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Instant +Stock Button */}
                <TouchableOpacity
                  style={styles.addStockBtn}
                  onPress={() => handleOpenRestockForItem(item)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                  <Text style={styles.addStockBtnText}>Stock</Text>
                </TouchableOpacity>
              </View>
            </Surface>
          ))}
        </View>
      ) : (
        <Surface
          style={[
            styles.emptyStateCard,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
        >
          <MaterialCommunityIcons name="check-circle" size={40} color={colors.success} />
          <Text style={[styles.emptyStateTitle, { color: activeColors.textPrimary }]}>All Stock Healthy</Text>
          <Text style={[styles.emptyStateSub, { color: activeColors.textSecondary }]}>
            No products are below minimum alert levels.
          </Text>
        </Surface>
      )}
      </>
      )}

      {/* Quick Add Stock Dialog */}
      <Portal>
        <Dialog
          visible={restockModalVisible}
          onDismiss={() => {
            setRestockModalVisible(false);
            setSelectedRestockItem(null);
          }}
          style={[styles.dialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            {restockMode === 'sell' ? 'Sell Stock (Stock Out)' : 'Add Stock (Restock)'}
          </Dialog.Title>

          <Dialog.Content>
            {/* Mode Selector Toggle */}
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  restockMode === 'add' && styles.modeBtnActiveAdd,
                ]}
                onPress={() => setRestockMode('add')}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    restockMode === 'add' && styles.modeBtnTextActive,
                  ]}
                >
                  + Add Stock
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  restockMode === 'sell' && styles.modeBtnActiveSell,
                ]}
                onPress={() => setRestockMode('sell')}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    restockMode === 'sell' && styles.modeBtnTextActive,
                  ]}
                >
                  - Sell Stock
                </Text>
              </TouchableOpacity>
            </View>

            {/* If no item selected yet, let user pick */}
            {!selectedRestockItem ? (
              <View>
                <Text style={[styles.dialogLabel, { color: activeColors.textSecondary }]}>
                  {restockMode === 'sell'
                    ? 'Search Product to Sell:'
                    : 'Search Product to Restock:'}
                </Text>
                <TextInput
                  placeholder="Type product or brand name..."
                  value={itemSearchQuery}
                  onChangeText={setItemSearchQuery}
                  mode="outlined"
                  style={[styles.searchInput, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
                  left={<TextInput.Icon icon="magnify" color={activeColors.textSecondary} />}
                />
                <ScrollView style={{ maxHeight: 180, marginTop: spacing.sm }}>
                  {filteredItemsForSearch.map((it) => (
                    <TouchableOpacity
                      key={it.variantId}
                      style={[styles.searchResultRow, { borderBottomColor: isDarkMode ? '#1F2937' : '#F1F5F9' }]}
                      onPress={() => setSelectedRestockItem(it)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultTitle, { color: activeColors.textPrimary }]}>{it.productName}</Text>
                        <Text style={[styles.resultSub, { color: activeColors.textSecondary }]}>
                          {it.variantName} {it.brand ? `• ${it.brand}` : ''} ({it.currentStock}{' '}
                          {it.unit})
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={activeColors.primary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <RestockItemForm
                item={selectedRestockItem}
                mode={restockMode}
                onChangeItem={() => setSelectedRestockItem(null)}
                onCancel={() => {
                  setRestockModalVisible(false);
                  setSelectedRestockItem(null);
                }}
                onConfirm={handleConfirmStockOperation}
                updatingStock={updatingStock}
                isDarkMode={isDarkMode}
                activeColors={activeColors}
              />
            )}
          </Dialog.Content>

          {!selectedRestockItem && (
            <Dialog.Actions>
              <TouchableOpacity
                onPress={() => {
                  setRestockModalVisible(false);
                  setSelectedRestockItem(null);
                }}
                style={styles.dialogCancelBtn}
              >
                <Text style={[styles.dialogCancelText, { color: activeColors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </Dialog.Actions>
          )}
        </Dialog>
      </Portal>

      {/* Stock Success Feedback Modal */}
      <StockSuccessModal
        visible={!!stockSuccess}
        info={stockSuccess}
        onDismiss={() => setStockSuccess(null)}
        onViewHistory={() => {
          setStockSuccess(null);
          router.push('/(tabs)/history');
        }}
        isDarkMode={isDarkMode}
        activeColors={activeColors}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 110,
  },

  // 1. Header Card
  headerCard: {
    borderRadius: borderRadius.xl,
    padding: 16,
    borderWidth: 1,
    ...shadows.card,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    elevation: 2,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  storeName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSearchWrap: {
    marginTop: 12,
  },
  headerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },

  // Search Results
  searchResultsContainer: {
    marginTop: spacing.lg,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  clearSearchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearSearchText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchList: {
    gap: spacing.sm,
  },
  searchItemCard: {
    borderRadius: borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    ...shadows.card,
  },
  searchItemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  searchItemName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  searchItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  searchSizeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  searchSizeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBrandBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  searchBrandText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchCategoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchStockPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  searchStockPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockPillOk: {
    backgroundColor: '#DCFCE7',
  },
  stockTextOk: {
    color: '#16A34A',
  },
  stockPillLow: {
    backgroundColor: '#FEF3C7',
  },
  stockTextLow: {
    color: '#D97706',
  },
  stockPillOut: {
    backgroundColor: '#FEE2E2',
  },
  stockTextOut: {
    color: '#DC2626',
  },
  searchActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  searchRackText: {
    fontSize: 11,
    fontWeight: '500',
  },
  searchButtonsWrap: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 'auto',
  },
  actionStockInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.md,
  },
  actionSellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.md,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySearchCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    ...shadows.card,
    marginTop: spacing.sm,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySearchSub: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyClearBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
  },
  emptyClearBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // 2. Quick Action Buttons (Optimized for Mobile Screens)
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    minHeight: 104,
    ...shadows.card,
  },
  actionButtonPrimary: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  actionButtonSell: {
    borderWidth: 1,
  },
  actionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitlePrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  actionSubtitlePrimary: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textAlign: 'center',
  },
  actionTitleSecondary: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionSubtitleSecondary: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  actionTitleSell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
  },
  actionSubtitleSell: {
    fontSize: 10,
    color: '#E11D48',
    marginTop: 2,
    textAlign: 'center',
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // 3. Stats Grid (2x2)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48.5%',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    ...shadows.card,
  },
  statCardWarning: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  statCardDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  statSub: {
    fontSize: 11,
    marginTop: 2,
  },

  // 4. Low Stock List
  listContainer: {
    gap: spacing.sm,
  },
  restockCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    ...shadows.card,
  },
  restockCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  prodThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  itemDetails: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusPillLow: {
    backgroundColor: '#FEF3C7',
  },
  statusPillOut: {
    backgroundColor: '#FEE2E2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextLow: {
    color: '#B45309',
  },
  statusTextOut: {
    color: '#DC2626',
  },
  rackText: {
    fontSize: 11,
    fontWeight: '500',
  },
  addStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  addStockBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  emptyStateCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    ...shadows.card,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptyStateSub: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },

  // Dialog Styles
  dialog: {
    borderRadius: borderRadius.xl,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dialogLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  searchInput: {
    fontSize: 13,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultSub: {
    fontSize: 12,
  },
  targetItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  targetName: {
    fontSize: 14,
    fontWeight: '700',
  },
  targetSub: {
    fontSize: 12,
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  currentStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 6,
  },
  currentLabel: {
    fontSize: 13,
  },
  currentVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  qtyChip: {
    borderRadius: borderRadius.md,
  },
  qtyChipActive: {
    backgroundColor: '#D1FAE5',
  },
  qtyChipSellActive: {
    backgroundColor: '#FEE2E2',
  },
  qtyChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  qtyChipTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  qtyChipSellTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  modeToggleRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md - 2,
  },
  modeBtnActiveAdd: {
    backgroundColor: '#059669',
  },
  modeBtnActiveSell: {
    backgroundColor: '#DC2626',
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 13,
    color: '#065F46',
  },
  previewHighlight: {
    fontWeight: '800',
    color: '#047857',
  },
  previewBoxSell: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    justifyContent: 'center',
  },
  previewTextSell: {
    fontSize: 13,
    color: '#3730A3',
  },
  previewHighlightSell: {
    fontWeight: '800',
    color: '#4338CA',
  },
  previewBoxError: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
  },
  previewTextError: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  smoothNumericInput: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
  },
  smoothNoteInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  previewContainerFixed: {
    minHeight: 52,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  dialogCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  dialogCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialogConfirmBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  dialogConfirmBtnSell: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  dialogConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

