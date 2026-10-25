import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Text, Surface, Portal, Dialog, TextInput, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/useAppStore.js';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import { lightColors, darkColors, colors, spacing, borderRadius, shadows, getThemeShadows } from '../../src/theme/tokens.js';

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

export default function HomeScreen() {
  const router = useRouter();
  const { store, deviceId, isDarkMode } = useAppStore();
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
  const [restockQty, setRestockQty] = useState('10');
  const [restockNote, setRestockNote] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);

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
        totalProductsCount: products.length,
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleOpenRestockForItem = (item: RestockItem) => {
    setSelectedRestockItem(item);
    setRestockMode('add');
    setRestockQty('10');
    setRestockNote('');
    setItemSearchQuery('');
    setRestockModalVisible(true);
  };

  const handleOpenGeneralAddStock = () => {
    setSelectedRestockItem(null);
    setRestockMode('add');
    setRestockQty('10');
    setRestockNote('');
    setItemSearchQuery('');
    setRestockModalVisible(true);
  };

  const handleOpenGeneralSellStock = () => {
    setSelectedRestockItem(null);
    setRestockMode('sell');
    setRestockQty('10');
    setRestockNote('');
    setItemSearchQuery('');
    setRestockModalVisible(true);
  };

  const handleConfirmStockOperation = async () => {
    if (!selectedRestockItem) {
      Alert.alert(
        'Select Product',
        `Please choose a product to ${restockMode === 'sell' ? 'sell' : 'add stock to'}.`
      );
      return;
    }
    const qty = parseFloat(restockQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid stock quantity (e.g. 10)');
      return;
    }

    if (restockMode === 'sell' && qty > selectedRestockItem.currentStock) {
      Alert.alert(
        'Insufficient Stock',
        `Cannot sell ${qty} ${selectedRestockItem.unit}. Available stock is ${selectedRestockItem.currentStock} ${selectedRestockItem.unit}.`
      );
      return;
    }

    try {
      setUpdatingStock(true);
      const storeId = store?.id || 'store-1';
      await InventoryRepository.adjustStock(
        selectedRestockItem.variantId,
        qty,
        (selectedRestockItem.unit as any) || 'piece',
        restockMode === 'sell' ? 'sale' : 'increase',
        restockNote.trim() ||
          (restockMode === 'sell'
            ? `Sold ${qty} ${selectedRestockItem.unit}`
            : 'Manual stock addition'),
        storeId,
        deviceId
      );

      Alert.alert(
        restockMode === 'sell' ? 'Sale Recorded' : 'Stock Updated',
        restockMode === 'sell'
          ? `Sold -${qty} ${selectedRestockItem.unit} of "${selectedRestockItem.productName}"`
          : `Added +${qty} ${selectedRestockItem.unit} to "${selectedRestockItem.productName}"`,
        [
          { text: 'Done' },
          {
            text: 'View History',
            onPress: () => router.push('/(tabs)/history'),
          },
        ]
      );
      setRestockModalVisible(false);
      setSelectedRestockItem(null);
      setRestockNote('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      Alert.alert('Error', msg);
    } finally {
      setUpdatingStock(false);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const filteredItemsForSearch = itemSearchQuery.trim()
    ? allSelectableItems.filter(
        (i) =>
          i.productName.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
          (i.brand && i.brand.toLowerCase().includes(itemSearchQuery.toLowerCase())) ||
          i.variantName.toLowerCase().includes(itemSearchQuery.toLowerCase())
      )
    : allSelectableItems.slice(0, 10);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: activeColors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeColors.primary} />
      }
    >
      {/* 1. Clean Welcome Header (Hardcoded Store Identity) */}
      <Surface
        style={[
          styles.headerCard,
          {
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.storeName, { color: activeColors.textPrimary }]}>
            Manju Hardware Store
          </Text>
          <Text style={[styles.headerDate, { color: activeColors.textSecondary }]}>
            {formattedDate}
          </Text>
        </View>
        <View
          style={[
            styles.productCountPill,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
              borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
            },
          ]}
        >
          <MaterialCommunityIcons name="tag-outline" size={14} color={activeColors.primary} />
          <Text style={[styles.productCountText, { color: activeColors.primary }]}>
            {stats.totalProductsCount} Products
          </Text>
        </View>
      </Surface>

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
            <Text style={styles.actionTitlePrimary}>Add Product</Text>
            <Text style={styles.actionSubtitlePrimary}>New item</Text>
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
            <Text style={[styles.actionTitleSecondary, { color: activeColors.textPrimary }]}>
              Add Stock
            </Text>
            <Text style={[styles.actionSubtitleSecondary, { color: activeColors.textSecondary }]}>
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
            <Text style={styles.actionTitleSell}>Sell Stock</Text>
            <Text style={styles.actionSubtitleSell}>Stock out</Text>
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
                    <Text style={[styles.targetName, { color: activeColors.textPrimary }]}>{selectedRestockItem.productName}</Text>
                    <Text style={[styles.targetSub, { color: activeColors.textSecondary }]}>
                      {selectedRestockItem.variantName}{' '}
                      {selectedRestockItem.brand ? `• ${selectedRestockItem.brand}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedRestockItem(null)}
                    style={styles.changeBtn}
                  >
                    <Text style={[styles.changeBtnText, { color: activeColors.primary }]}>Change</Text>
                  </TouchableOpacity>
                </View>

                {/* Current Stock */}
                <View style={styles.currentStockRow}>
                  <Text style={[styles.currentLabel, { color: activeColors.textSecondary }]}>Available Stock:</Text>
                  <Text style={[styles.currentVal, { color: activeColors.textPrimary }]}>
                    {selectedRestockItem.currentStock} {selectedRestockItem.unit}
                  </Text>
                </View>

                {/* Presets Chips */}
                <Text style={[styles.dialogLabel, { color: activeColors.textSecondary, marginTop: spacing.md }]}>
                  {restockMode === 'sell' ? 'Quantity Sold:' : 'Select Quantity to Add:'}
                </Text>
                <View style={styles.chipsContainer}>
                  {['5', '10', '20', '50', '100'].map((preset) => (
                    <Chip
                      key={preset}
                      selected={restockQty === preset}
                      onPress={() => setRestockQty(preset)}
                      style={[
                        styles.qtyChip,
                        restockQty === preset &&
                          (restockMode === 'sell' ? styles.qtyChipSellActive : styles.qtyChipActive),
                      ]}
                      textStyle={[
                        styles.qtyChipText,
                        restockQty === preset &&
                          (restockMode === 'sell'
                            ? styles.qtyChipSellTextActive
                            : styles.qtyChipTextActive),
                      ]}
                      showSelectedOverlay={false}
                    >
                      {restockMode === 'sell' ? `-${preset}` : `+${preset}`}
                    </Chip>
                  ))}
                </View>

                {/* Custom numeric input */}
                <TextInput
                  label={`Quantity (${selectedRestockItem.unit}) *`}
                  value={restockQty}
                  onChangeText={setRestockQty}
                  keyboardType="numeric"
                  mode="outlined"
                  style={{ marginTop: spacing.sm, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
                  placeholder="e.g. 15"
                />

                {/* Optional Note / Customer */}
                <TextInput
                  label="Customer Name / Note (Optional)"
                  value={restockNote}
                  onChangeText={setRestockNote}
                  mode="outlined"
                  style={{ marginTop: spacing.sm, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
                  placeholder="e.g. Sold to Cash Customer"
                />

                {/* Live Preview */}
                {restockMode === 'sell' ? (
                  (parseFloat(restockQty) || 0) > selectedRestockItem.currentStock ? (
                    <View style={styles.previewBoxError}>
                      <Text style={styles.previewTextError}>
                        ⚠️ Insufficient stock! Available: {selectedRestockItem.currentStock}{' '}
                        {selectedRestockItem.unit}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.previewBoxSell}>
                      <Text style={styles.previewTextSell}>
                        Stock after Sale:{' '}
                        <Text style={styles.previewHighlightSell}>
                          {selectedRestockItem.currentStock - (parseFloat(restockQty) || 0)}{' '}
                          {selectedRestockItem.unit}
                        </Text>
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewText}>
                      New Total Stock will be:{' '}
                      <Text style={styles.previewHighlight}>
                        {Math.max(0, selectedRestockItem.currentStock) +
                          (parseFloat(restockQty) || 0)}{' '}
                        {selectedRestockItem.unit}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Dialog.Content>

          <Dialog.Actions>
            <TouchableOpacity
              onPress={() => {
                setRestockModalVisible(false);
                setSelectedRestockItem(null);
              }}
              style={styles.dialogCancelBtn}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>

            {selectedRestockItem && (
              <TouchableOpacity
                onPress={handleConfirmStockOperation}
                disabled={
                  updatingStock ||
                  (restockMode === 'sell' &&
                    (parseFloat(restockQty) || 0) > selectedRestockItem.currentStock)
                }
                style={[
                  restockMode === 'sell'
                    ? styles.dialogConfirmBtnSell
                    : styles.dialogConfirmBtn,
                  (updatingStock ||
                    (restockMode === 'sell' &&
                      (parseFloat(restockQty) || 0) > selectedRestockItem.currentStock)) && {
                    opacity: 0.5,
                  },
                ]}
              >
                <Text style={styles.dialogConfirmText}>
                  {updatingStock
                    ? 'Processing...'
                    : restockMode === 'sell'
                    ? 'Confirm Sale'
                    : 'Confirm Stock'}
                </Text>
              </TouchableOpacity>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 48,
  },

  // 1. Header Card
  headerCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    ...shadows.card,
  },
  headerLeft: {
    flex: 1,
  },
  storeName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerDate: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  productCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  productCountText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // 2. Quick Action Buttons
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
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
    width: 42,
    height: 42,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitlePrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionSubtitlePrimary: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  actionTitleSecondary: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionSubtitleSecondary: {
    fontSize: 11,
    marginTop: 2,
  },
  actionTitleSell: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  actionSubtitleSell: {
    fontSize: 11,
    color: '#E11D48',
    marginTop: 2,
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
    marginTop: spacing.md,
    backgroundColor: '#ECFDF5',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
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
    marginTop: spacing.md,
    backgroundColor: '#EEF2FF',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#C7D2FE',
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
    marginTop: spacing.md,
    backgroundColor: '#FEF2F2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  previewTextError: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700',
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

