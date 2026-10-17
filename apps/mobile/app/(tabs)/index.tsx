import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Surface, Button, Portal, Dialog, TextInput, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../src/store/useAppStore.js';
import { formatPaiseToINR } from '@hardware-store/shared';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import { SyncEngine } from '../../src/sync/SyncEngine.js';
import { t } from '../../src/i18n/strings.js';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/theme/tokens.js';

interface CategoryStockSummary {
  id: string;
  name: string;
  icon?: string;
  productCount: number;
  totalStockUnits: number;
}

interface RestockItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  brand?: string;
  categoryName?: string;
  currentStock: number;
  minStockLevel: number;
  unit: string;
  isOutOfStock: boolean;
  rackLocation?: string;
}

interface StockStats {
  totalProductsCount: number;
  totalVariantsCount: number;
  totalUnitsInStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  inventoryValuePaise: number;
  categoriesCount: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const {
    store,
    token,
    apiUrl,
    deviceId,
    pendingSyncCount,
    language,
  } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<StockStats>({
    totalProductsCount: 0,
    totalVariantsCount: 0,
    totalUnitsInStock: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    inventoryValuePaise: 0,
    categoriesCount: 0,
  });

  const [categorySummaries, setCategorySummaries] = useState<CategoryStockSummary[]>([]);
  const [restockWatchlist, setRestockWatchlist] = useState<RestockItem[]>([]);

  // Quick Add Stock Dialog State
  const [quickStockTarget, setQuickStockTarget] = useState<RestockItem | null>(null);
  const [quickStockQty, setQuickStockQty] = useState('10');
  const [stockUpdating, setStockUpdating] = useState(false);

  const handleConfirmQuickStock = async () => {
    if (!quickStockTarget) return;
    const qty = parseFloat(quickStockQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid stock quantity (e.g. 10)');
      return;
    }
    try {
      setStockUpdating(true);
      const storeId = store?.id || 'store-1';
      await InventoryRepository.adjustStock(
        quickStockTarget.variantId,
        qty,
        (quickStockTarget.unit as any) || 'piece',
        'increase',
        'Quick Stock Add from Dashboard',
        storeId,
        deviceId,
        undefined
      );
      Alert.alert(
        'Stock Added!',
        `Successfully added +${qty} ${quickStockTarget.unit} to "${quickStockTarget.productName}".`
      );
      setQuickStockTarget(null);
      setQuickStockQty('10');
      await loadLocalStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not add stock';
      Alert.alert('Stock Update Error', msg);
    } finally {
      setStockUpdating(false);
    }
  };

  const loadLocalStats = useCallback(async () => {
    try {
      const storeId = store?.id || 'store-1';
      const [products, categories] = await Promise.all([
        ProductRepository.getProductsWithVariants(storeId),
        ProductRepository.getCategories(storeId),
      ]);

      let lowStock = 0;
      let outOfStock = 0;
      let invVal = 0;
      let totalUnits = 0;
      let totalVariants = 0;

      const categoryMap = new Map<string, CategoryStockSummary>();
      for (const cat of categories) {
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          productCount: 0,
          totalStockUnits: 0,
        });
      }

      const watchlist: RestockItem[] = [];

      for (const prod of products) {
        const catSummary = categoryMap.get(prod.categoryId);
        if (catSummary) {
          catSummary.productCount += 1;
        }

        for (const v of prod.variants) {
          totalVariants += 1;
          const stock = Number(v.currentStock ?? 0);
          const minLevel = Number(v.minStockLevel ?? 0);
          const purchasePaise = Number(v.purchasePricePaise ?? 0);

          totalUnits += Math.max(0, stock);
          invVal += Math.max(0, stock * purchasePaise);

          if (catSummary) {
            catSummary.totalStockUnits += Math.max(0, stock);
          }

          if (stock <= 0) {
            outOfStock += 1;
            watchlist.push({
              variantId: v.id,
              productId: prod.id,
              productName: prod.name,
              variantName: v.name,
              brand: prod.brand,
              categoryName: catSummary?.name,
              currentStock: stock,
              minStockLevel: minLevel,
              unit: prod.baseUnit || 'pcs',
              isOutOfStock: true,
              rackLocation: v.rackLocation,
            });
          } else if (stock <= minLevel) {
            lowStock += 1;
            watchlist.push({
              variantId: v.id,
              productId: prod.id,
              productName: prod.name,
              variantName: v.name,
              brand: prod.brand,
              categoryName: catSummary?.name,
              currentStock: stock,
              minStockLevel: minLevel,
              unit: prod.baseUnit || 'pcs',
              isOutOfStock: false,
              rackLocation: v.rackLocation,
            });
          }
        }
      }

      // Sort watchlist: out of stock first, then ascending stock
      watchlist.sort((a, b) => {
        if (a.isOutOfStock && !b.isOutOfStock) return -1;
        if (!a.isOutOfStock && b.isOutOfStock) return 1;
        return a.currentStock - b.currentStock;
      });

      setStats({
        totalProductsCount: products.length,
        totalVariantsCount: totalVariants,
        totalUnitsInStock: totalUnits,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
        inventoryValuePaise: invVal,
        categoriesCount: categories.length,
      });

      setCategorySummaries(Array.from(categoryMap.values()));
      setRestockWatchlist(watchlist.slice(0, 6)); // Top 6 items needing restock
    } catch (e) {
      console.error('Error loading stock dashboard stats:', e);
    }
  }, [store]);

  useEffect(() => {
    loadLocalStats();
  }, [loadLocalStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLocalStats();
    setRefreshing(false);
  };

  const handleSyncNow = async () => {
    if (!token) {
      Alert.alert(
        'Offline Local Mode',
        'Your store data is safely stored in local database. Connect to server in More > Settings to sync with cloud.'
      );
      return;
    }
    setSyncing(true);
    try {
      const res = await SyncEngine.synchronize(apiUrl, token, store?.id || 'store-1', deviceId);
      if (res.success) {
        Alert.alert('Sync Complete', `Pushed ${res.pushed} changes, pulled ${res.pulled} updates.`);
      } else {
        Alert.alert('Sync Info', res.error || 'Server offline. All changes preserved locally.');
      }
      await loadLocalStats();
    } finally {
      setSyncing(false);
    }
  };

  const formattedDate = new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const totalAttentionNeeded = stats.lowStockCount + stats.outOfStockCount;

  // Icon mapping helper for categories
  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'pipe':
        return 'pipe';
      case 'format-paint':
        return 'format-paint';
      case 'tools':
      case 'wrench':
        return 'wrench';
      case 'shower':
        return 'shower';
      case 'wall':
        return 'wall';
      default:
        return 'package-variant-closed';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* 1. Header Card */}
      <Surface style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.storeTitle} numberOfLines={1}>
                {store?.name || 'Manju Store Management'}
              </Text>
              <View style={styles.betaBadge}>
                <Text style={styles.betaBadgeText}>Beta v1.0</Text>
              </View>
            </View>
            <Text style={styles.dateSubtitle}>
              {language === 'hi' ? 'लाइव स्टॉक डैशबोर्ड' : 'Live Stock Dashboard'} • {formattedDate}
            </Text>
          </View>

          {/* Sync Pill */}
          <TouchableOpacity
            style={[
              styles.syncPill,
              pendingSyncCount > 0 ? styles.syncPillPending : styles.syncPillSuccess,
            ]}
            onPress={handleSyncNow}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={pendingSyncCount > 0 ? 'cloud-upload' : 'check-circle'}
              size={14}
              color={pendingSyncCount > 0 ? colors.warning : colors.success}
            />
            <Text
              style={[
                styles.syncPillText,
                { color: pendingSyncCount > 0 ? colors.warning : colors.success },
              ]}
            >
              {pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'Synced'}
            </Text>
          </TouchableOpacity>
        </View>
      </Surface>

      {/* 2. Stock Health Banner */}
      {totalAttentionNeeded > 0 ? (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { filter: stats.outOfStockCount > 0 ? 'out' : 'low' },
            })
          }
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="alert-circle"
            size={24}
            color={stats.outOfStockCount > 0 ? colors.danger : colors.warning}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.alertBannerTitle}>
              {stats.outOfStockCount > 0
                ? `${stats.outOfStockCount} Out of Stock • ${stats.lowStockCount} Low Stock`
                : `${stats.lowStockCount} products need restocking`}
            </Text>
            <Text style={styles.alertBannerSubtitle}>
              Tap to view and replenish items in catalogue
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <Surface style={styles.healthyBanner}>
          <MaterialCommunityIcons name="check-decagram" size={24} color={colors.success} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.healthyBannerTitle}>All Stock Healthy</Text>
            <Text style={styles.healthyBannerSubtitle}>
              All SKU variants are above minimum safety thresholds
            </Text>
          </View>
        </Surface>
      )}

      {/* 3. Primary Stock Tasks */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Stock Actions</Text>
      </View>

      <View style={styles.quickActionsContainer}>
        {/* Check Stock / Full Catalogue - Highlighted Primary */}
        <TouchableOpacity
          style={[styles.quickActionCard, styles.quickActionPrimary]}
          onPress={() => router.push('/(tabs)/products')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#FFFFFF' }]}>
            <MaterialCommunityIcons name="package-variant" size={24} color={colors.primary} />
          </View>
          <Text style={styles.quickActionPrimaryText}>Check Stock</Text>
          <Text style={styles.quickActionSubtextPrimary}>Full Catalogue</Text>
        </TouchableOpacity>

        {/* Add Product */}
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { action: 'add' },
            })
          }
          activeOpacity={0.8}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <MaterialCommunityIcons name="plus-box-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.quickActionText}>Add Product</Text>
          <Text style={styles.quickActionSubtext}>New SKU / Size</Text>
        </TouchableOpacity>

        {/* Quick Add Stock */}
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { action: 'addStock' },
            })
          }
          activeOpacity={0.8}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <MaterialCommunityIcons name="plus-circle" size={24} color="#16A34A" />
          </View>
          <Text style={styles.quickActionText}>Add Stock</Text>
          <Text style={styles.quickActionSubtext}>स्टॉक जोड़ें</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Live Stock Overview Metrics (2x2 Grid) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Live Stock Status</Text>
      </View>

      <View style={styles.metricsGrid}>
        {/* Total Products */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => router.push('/(tabs)/products')}
          activeOpacity={0.8}
        >
          <View style={styles.metricCardHeader}>
            <Text style={styles.metricLabel}>Total Products</Text>
            <MaterialCommunityIcons name="cube-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.metricValue, { color: colors.primary }]}>
            {stats.totalProductsCount}
          </Text>
          <Text style={styles.metricSubtext}>Active catalog items</Text>
        </TouchableOpacity>

        {/* Total Variants */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => router.push('/(tabs)/products')}
          activeOpacity={0.8}
        >
          <View style={styles.metricCardHeader}>
            <Text style={styles.metricLabel}>SKU Variants</Text>
            <MaterialCommunityIcons name="layers-outline" size={18} color={colors.accent} />
          </View>
          <Text style={[styles.metricValue, { color: colors.accent }]}>
            {stats.totalVariantsCount}
          </Text>
          <Text style={styles.metricSubtext}>Sizes & specifications</Text>
        </TouchableOpacity>

        {/* Low Stock Items */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { filter: 'low' },
            })
          }
          activeOpacity={0.8}
        >
          <View style={styles.metricCardHeader}>
            <Text style={styles.metricLabel}>{t('lowStock', language)}</Text>
            <MaterialCommunityIcons name="alert-outline" size={18} color={colors.warning} />
          </View>
          <Text
            style={[
              styles.metricValue,
              { color: stats.lowStockCount > 0 ? colors.warning : colors.textPrimary },
            ]}
          >
            {stats.lowStockCount}
          </Text>
          <Text style={styles.metricSubtext}>Under min threshold</Text>
        </TouchableOpacity>

        {/* Out of Stock */}
        <TouchableOpacity
          style={styles.metricCard}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { filter: 'out' },
            })
          }
          activeOpacity={0.8}
        >
          <View style={styles.metricCardHeader}>
            <Text style={styles.metricLabel}>{t('outOfStock', language)}</Text>
            <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.danger} />
          </View>
          <Text
            style={[
              styles.metricValue,
              { color: stats.outOfStockCount > 0 ? colors.danger : colors.textPrimary },
            ]}
          >
            {stats.outOfStockCount}
          </Text>
          <Text style={styles.metricSubtext}>Zero inventory</Text>
        </TouchableOpacity>
      </View>

      {/* 5. Inventory Valuation Card */}
      <Surface style={styles.valuationCard}>
        <View style={styles.valuationRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.valuationLabel}>Total Inventory Valuation</Text>
            <Text style={styles.valuationAmount}>
              {formatPaiseToINR(stats.inventoryValuePaise)}
            </Text>
            <Text style={styles.valuationSubtext}>Calculated from purchase cost</Text>
          </View>
          <View style={styles.valuationBadgesColumn}>
            <View style={styles.valuationBadge}>
              <MaterialCommunityIcons name="package-variant-closed" size={14} color={colors.primary} />
              <Text style={styles.valuationBadgeText}>
                {stats.totalUnitsInStock} units
              </Text>
            </View>
            <View style={[styles.valuationBadge, { backgroundColor: colors.accentLight }]}>
              <MaterialCommunityIcons name="shape-outline" size={14} color={colors.accent} />
              <Text style={[styles.valuationBadgeText, { color: colors.accent }]}>
                {stats.categoriesCount} categories
              </Text>
            </View>
          </View>
        </View>
      </Surface>

      {/* 6. Stock by Category Breakdown */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Stock by Category</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/products')}>
          <Text style={styles.sectionActionText}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScrollContainer}
      >
        {categorySummaries.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.categoryCard}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/products',
                params: { categoryId: cat.id },
              })
            }
            activeOpacity={0.8}
          >
            <View style={styles.categoryIconCircle}>
              <MaterialCommunityIcons
                name={getCategoryIcon(cat.icon) as any}
                size={22}
                color={colors.primary}
              />
            </View>
            <Text style={styles.categoryCardName} numberOfLines={1}>
              {cat.name}
            </Text>
            <Text style={styles.categoryCardCount}>
              {cat.productCount} product{cat.productCount === 1 ? '' : 's'}
            </Text>
            <View style={styles.categoryStockPill}>
              <Text style={styles.categoryStockPillText}>{cat.totalStockUnits} in stock</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 7. Restock Watchlist (Direct on Home) */}
      <View style={[styles.sectionHeader, { marginTop: spacing.md }]}>
        <Text style={styles.sectionTitle}>Restock Watchlist</Text>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/(tabs)/products',
              params: { filter: 'low' },
            })
          }
        >
          <Text style={styles.sectionActionText}>View All</Text>
        </TouchableOpacity>
      </View>

      {restockWatchlist.length > 0 ? (
        <Surface style={styles.watchlistCard}>
          {restockWatchlist.map((item, idx) => (
            <View
              key={item.variantId}
              style={[
                styles.watchlistItemRow,
                idx !== restockWatchlist.length - 1 && styles.watchlistBorder,
              ]}
            >
              <View style={styles.watchlistItemLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.watchlistItemTitle} numberOfLines={1}>
                    {item.productName}
                  </Text>
                </View>
                <Text style={styles.watchlistItemSubtitle} numberOfLines={1}>
                  {item.variantName} {item.brand ? `• ${item.brand}` : ''}
                </Text>
                <View style={styles.watchlistItemMeta}>
                  {item.categoryName && (
                    <Text style={styles.watchlistItemCategory}>{item.categoryName}</Text>
                  )}
                  {item.rackLocation && (
                    <Text style={styles.watchlistItemRack}>Rack: {item.rackLocation}</Text>
                  )}
                </View>
              </View>

              <View style={styles.watchlistItemRight}>
                <View
                  style={[
                    styles.stockStatusBadge,
                    item.isOutOfStock ? styles.stockStatusOut : styles.stockStatusLow,
                  ]}
                >
                  <Text
                    style={[
                      styles.stockStatusBadgeText,
                      item.isOutOfStock ? styles.stockStatusTextOut : styles.stockStatusTextLow,
                    ]}
                  >
                    {item.isOutOfStock
                      ? `0 ${item.unit} (OUT)`
                      : `${item.currentStock} ${item.unit} (Min: ${item.minStockLevel})`}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.addStockQuickBtn}
                  onPress={() => {
                    setQuickStockTarget(item);
                    setQuickStockQty('10');
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.addStockQuickBtnText}>+ Stock</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Surface>
      ) : (
        <Surface style={styles.emptyWatchlistCard}>
          <MaterialCommunityIcons name="shield-check" size={32} color={colors.success} />
          <Text style={styles.emptyWatchlistTitle}>All inventory levels optimal!</Text>
          <Text style={styles.emptyWatchlistSubtext}>
            No products are currently out of stock or below minimum levels.
          </Text>
        </Surface>
      )}

      {/* Direct Quick Add Stock Dialog */}
      <Portal>
        <Dialog
          visible={quickStockTarget !== null}
          onDismiss={() => setQuickStockTarget(null)}
          style={styles.quickStockDialog}
        >
          <Dialog.Title style={styles.quickStockDialogTitle}>
            Add Stock / स्टॉक जोड़ें
          </Dialog.Title>
          <Dialog.Content>
            {quickStockTarget && (
              <View>
                <Text style={styles.quickStockProdName}>{quickStockTarget.productName}</Text>
                <Text style={styles.quickStockVariantName}>
                  {quickStockTarget.variantName} {quickStockTarget.brand ? `• ${quickStockTarget.brand}` : ''}
                </Text>

                <View style={styles.currentStockPillRow}>
                  <Text style={styles.currentStockLabel}>Current Stock:</Text>
                  <View style={styles.currentStockBadge}>
                    <Text style={styles.currentStockBadgeText}>
                      {quickStockTarget.currentStock} {quickStockTarget.unit}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.currentStockLabel, { marginTop: spacing.md, marginBottom: 6 }]}>
                  Quick Quantity to Add:
                </Text>
                <View style={styles.quickQtyChipsRow}>
                  {['5', '10', '20', '50', '100'].map((preset) => (
                    <Chip
                      key={preset}
                      selected={quickStockQty === preset}
                      onPress={() => setQuickStockQty(preset)}
                      style={[
                        styles.qtyChip,
                        quickStockQty === preset && styles.qtyChipSelected,
                      ]}
                      textStyle={[
                        styles.qtyChipText,
                        quickStockQty === preset && styles.qtyChipTextSelected,
                      ]}
                      showSelectedOverlay={false}
                    >
                      +{preset}
                    </Chip>
                  ))}
                </View>

                <TextInput
                  label={`Quantity to Add (${quickStockTarget.unit}) *`}
                  value={quickStockQty}
                  onChangeText={setQuickStockQty}
                  keyboardType="numeric"
                  mode="outlined"
                  style={{ marginTop: spacing.sm, backgroundColor: '#FFFFFF' }}
                  placeholder="e.g. 10"
                />

                {/* Live Preview */}
                <View style={styles.livePreviewCard}>
                  <Text style={styles.livePreviewText}>
                    New Stock will be:{' '}
                    <Text style={{ fontWeight: '800', color: '#16A34A' }}>
                      {Math.max(0, quickStockTarget.currentStock) + (parseFloat(quickStockQty) || 0)}{' '}
                      {quickStockTarget.unit}
                    </Text>
                  </Text>
                </View>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQuickStockTarget(null)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button
              mode="contained"
              loading={stockUpdating}
              disabled={stockUpdating}
              onPress={handleConfirmQuickStock}
              style={styles.confirmStockBtn}
            >
              Add to Stock
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  betaBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
  },
  betaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  dateSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  syncPillSuccess: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  syncPillPending: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  syncPillText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertBannerTitle: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  alertBannerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  healthyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  healthyBannerTitle: {
    ...typography.labelMedium,
    color: colors.success,
    fontWeight: '700',
  },
  healthyBannerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  sectionActionText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 104,
    justifyContent: 'center',
    ...shadows.card,
  },
  quickActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionText: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  quickActionSubtext: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  quickActionPrimaryText: {
    ...typography.labelMedium,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  quickActionSubtextPrimary: {
    ...typography.labelSmall,
    color: '#E0E7FF',
    marginTop: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  metricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  metricValue: {
    ...typography.currencyMedium,
    marginVertical: 2,
    fontWeight: '800',
  },
  metricSubtext: {
    ...typography.labelSmall,
    color: colors.textMuted,
  },
  valuationCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  valuationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valuationLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  valuationAmount: {
    ...typography.currencyLarge,
    color: colors.primary,
    marginTop: 2,
  },
  valuationSubtext: {
    ...typography.labelSmall,
    color: colors.textMuted,
    marginTop: 2,
  },
  valuationBadgesColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  valuationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  valuationBadgeText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '600',
  },
  categoryScrollContainer: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
    paddingBottom: spacing.xs,
  },
  categoryCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  categoryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  categoryCardName: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  categoryCardCount: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  categoryStockPill: {
    marginTop: spacing.xs,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    alignSelf: 'flex-start',
  },
  categoryStockPillText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  watchlistCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  watchlistItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  watchlistBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  watchlistItemLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  watchlistItemTitle: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  watchlistItemSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  watchlistItemMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  watchlistItemCategory: {
    fontSize: 11,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: '600',
  },
  watchlistItemRack: {
    fontSize: 11,
    color: colors.textMuted,
  },
  watchlistItemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  stockStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
  },
  stockStatusOut: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  stockStatusLow: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  stockStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockStatusTextOut: {
    color: colors.danger,
  },
  stockStatusTextLow: {
    color: colors.warning,
  },
  addStockQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  addStockQuickBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickStockDialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  quickStockDialogTitle: {
    ...typography.titleMedium,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  quickStockProdName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quickStockVariantName: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  currentStockPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  currentStockLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  currentStockBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentStockBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quickQtyChipsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  qtyChip: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyChipSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  qtyChipText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  qtyChipTextSelected: {
    color: '#16A34A',
    fontWeight: '700',
  },
  livePreviewCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  livePreviewText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '600',
  },
  confirmStockBtn: {
    backgroundColor: '#16A34A',
    borderRadius: borderRadius.md,
  },
  emptyWatchlistCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  emptyWatchlistTitle: {
    ...typography.labelMedium,
    color: colors.success,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  emptyWatchlistSubtext: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
});
