import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  StatusBar as RNStatusBar,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal, Dialog, Searchbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Category, Subcategory } from '@hardware-store/shared';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import {
  MatrixRepository,
  MatrixGridData,
  MatrixCellData,
} from '../../src/database/repositories/matrixRepository.js';
import { CategorySubTabs } from '../../src/components/CategorySubTabs.js';
import { ProductMatrixGrid } from '../../src/components/ProductMatrixGrid.js';
import { MatrixActionBar } from '../../src/components/MatrixActionBar.js';
import { useAppStore } from '../../src/store/useAppStore.js';
import { lightColors, darkColors, borderRadius, getThemeShadows } from '../../src/theme/tokens.js';

export default function ProductsScreen() {
  const router = useRouter();
  const routerParams = useLocalSearchParams<{
    categoryId?: string;
  }>();

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

  // Categories & Subcategories State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string>('');

  // Matrix Grid State
  const [matrixData, setMatrixData] = useState<MatrixGridData>({
    brands: [],
    sizes: [],
    cells: {},
  });
  const [loading, setLoading] = useState(true);

  // Cell Selection
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<MatrixCellData | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  // Quick Stock / Sell Modal State
  const [actionModalMode, setActionModalMode] = useState<'add' | 'sell' | null>(null);
  const [actionQty, setActionQty] = useState('');
  const [actionPriceRs, setActionPriceRs] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // New Category Modal
  const [newCatModalVisible, setNewCatModalVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [submittingCat, setSubmittingCat] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || categories[0] || null;
  }, [categories, selectedCategoryId]);

  /**
   * Loads matrix data for the active category & subcategory
   */
  const loadMatrix = useCallback(async (
    catId: string,
    subcatId: string,
    keepSize?: string,
    keepBrand?: string
  ) => {
    if (!catId || !subcatId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const storeId = store?.id || 'store-1';
      const data = await MatrixRepository.getMatrixData(storeId, catId, subcatId);
      setMatrixData(data);

      const targetSize = keepSize || selectedSize;
      const targetBrand = keepBrand || selectedBrand;
      const currentKey = targetSize && targetBrand
        ? `${targetSize}___${targetBrand.toLowerCase()}`
        : null;

      // Preserve active cell selection if it exists in the data
      if (currentKey && data.cells[currentKey] !== undefined) {
        setSelectedCellKey(currentKey);
        setSelectedSize(targetSize);
        setSelectedBrand(targetBrand);
        setSelectedCell(data.cells[currentKey] || null);
      } else if (data.sizes.length > 0 && data.brands.length > 0) {
        const firstSize = data.sizes[0];
        const firstBrand = data.brands[0];
        const key = `${firstSize}___${firstBrand.toLowerCase()}`;
        setSelectedCellKey(key);
        setSelectedSize(firstSize);
        setSelectedBrand(firstBrand);
        setSelectedCell(data.cells[key] || null);
      } else {
        setSelectedCellKey(null);
        setSelectedCell(null);
        setSelectedSize('');
        setSelectedBrand('');
      }
    } catch (e) {
      console.error('Error loading matrix data:', e);
      showToast('Could not load inventory grid', 'error');
    } finally {
      setLoading(false);
    }
  }, [store?.id, selectedSize, selectedBrand, showToast]);

  /**
   * Loads sub-tabs (Pipes, Pipe Fittings, Others) and matrix data for a category
   */
  const switchCategory = useCallback(async (
    catId: string,
    catList?: Category[],
    preferredSubcatId?: string
  ) => {
    try {
      setLoading(true);
      setSelectedCategoryId(catId);
      // Immediately reset subcategories and matrixData so previous category data never leaks into new category
      setSubcategories([]);
      setActiveSubcategoryId('');
      setMatrixData({ brands: [], sizes: [], cells: {} });
      setSelectedCell(null);
      setSelectedCellKey(null);
      setSelectedSize('');
      setSelectedBrand('');

      const storeId = store?.id || 'store-1';
      const list = catList || categories;
      const cat = list.find((c) => c.id === catId);
      const catName = cat?.name || 'Pipes';

      // Ensures default sub-tabs exist specifically for this category
      const subtabs = await MatrixRepository.ensureDefaultSubTabs(
        storeId,
        catId,
        catName,
        deviceId
      );
      setSubcategories(subtabs);

      const activeSub = preferredSubcatId && subtabs.some((s) => s.id === preferredSubcatId)
        ? preferredSubcatId
        : subtabs[0]?.id || '';

      setActiveSubcategoryId(activeSub);

      if (activeSub) {
        await loadMatrix(catId, activeSub);
      } else {
        setMatrixData({ brands: [], sizes: [], cells: {} });
        setLoading(false);
      }
    } catch (e: any) {
      console.error('Error switching category:', e);
      setLoading(false);
      showToast(e?.message || 'Error switching category', 'error');
    }
  }, [store?.id, categories, deviceId, loadMatrix, showToast]);

  /**
   * Initial Data Load: Run once on mount
   */
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        setLoading(true);
        const storeId = store?.id || 'store-1';
        let cats = await ProductRepository.getCategories(storeId);

        // If no categories exist, create default "Pipes" category
        if (!cats || cats.length === 0) {
          const newCat = await ProductRepository.createCategory(
            { name: 'Pipes', description: 'Pipes, fittings and accessories' },
            storeId,
            deviceId
          );
          cats = [newCat];
        }

        if (!isMounted) return;
        setCategories(cats);

        // Prioritize "Pipes" category on launch
        const pipesCat = cats.find((c) => c.name.toLowerCase().includes('pipe'));
        const targetCat = pipesCat || cats[0];

        if (targetCat) {
          await switchCategory(targetCat.id, cats);
        }
      } catch (e) {
        console.error('Error initializing products screen:', e);
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Keep screen in sync when switching tabs (e.g. if a section or category was deleted in Settings)
   */
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const syncOnFocus = async () => {
        try {
          const storeId = store?.id || 'store-1';
          const freshCats = await ProductRepository.getCategories(storeId);
          if (!isMounted) return;
          setCategories(freshCats);

          if (selectedCategoryId) {
            const cat = freshCats.find((c) => c.id === selectedCategoryId);
            const currentSubtabs = await MatrixRepository.ensureDefaultSubTabs(
              storeId,
              selectedCategoryId,
              cat?.name || 'Pipes',
              deviceId
            );
            if (!isMounted) return;
            setSubcategories(currentSubtabs);

            // If active section was deleted in settings, switch to first remaining
            if (activeSubcategoryId && !currentSubtabs.some((s) => s.id === activeSubcategoryId)) {
              const nextSub = currentSubtabs[0]?.id || '';
              setActiveSubcategoryId(nextSub);
              if (nextSub) {
                await loadMatrix(selectedCategoryId, nextSub);
              } else {
                setMatrixData({ brands: [], sizes: [], cells: {} });
              }
            }
          }
        } catch (e) {
          console.error('Focus sync error in products screen:', e);
        }
      };

      syncOnFocus();
      return () => {
        isMounted = false;
      };
    }, [store?.id, selectedCategoryId, activeSubcategoryId, deviceId, loadMatrix])
  );

  /**
   * Handle sub-tab selection (e.g. switching between Pipes, Pipe Fittings, Others)
   */
  const handleSelectSubTab = async (subcatId: string) => {
    setActiveSubcategoryId(subcatId);
    await loadMatrix(selectedCategoryId, subcatId);
  };

  /**
   * Add a custom sub-tab dynamically via the '+' button
   */
  const handleAddSubTab = async (tabName: string) => {
    try {
      const storeId = store?.id || 'store-1';
      const created = await MatrixRepository.addSubTab(
        storeId,
        selectedCategoryId,
        tabName,
        deviceId
      );

      setSubcategories((prev) => [...prev, created]);
      setActiveSubcategoryId(created.id);
      await loadMatrix(selectedCategoryId, created.id);
      showToast(`Section "${tabName}" added!`, 'success');
    } catch (e) {
      console.error('Error adding sub-tab:', e);
      showToast('Could not add section', 'error');
    }
  };

  /**
   * Delete a Sub-Tab dynamically via the 'x' button
   */
  const handleDeleteSubTab = async (subcatId: string) => {
    try {
      const storeId = store?.id || 'store-1';
      await MatrixRepository.deleteSubTab(storeId, subcatId, deviceId);
      const remaining = subcategories.filter((s) => s.id !== subcatId);
      setSubcategories(remaining);

      if (activeSubcategoryId === subcatId) {
        const nextSub = remaining[0]?.id || '';
        setActiveSubcategoryId(nextSub);
        if (nextSub) {
          await loadMatrix(selectedCategoryId, nextSub);
        } else {
          setMatrixData({ brands: [], sizes: [], cells: {} });
        }
      }
      showToast('Section removed', 'info');
    } catch (e) {
      console.error('Error removing section:', e);
      showToast('Could not remove section', 'error');
    }
  };

  /**
   * Add a Brand Column
   */
  const handleAddBrand = async (brandName: string) => {
    try {
      const storeId = store?.id || 'store-1';
      await MatrixRepository.addBrand(
        storeId,
        selectedCategoryId,
        activeSubcategoryId,
        brandName,
        matrixData.sizes,
        deviceId
      );
      await loadMatrix(selectedCategoryId, activeSubcategoryId);
      showToast(`Brand "${brandName}" added!`, 'success');
    } catch (e) {
      console.error('Error adding brand:', e);
      showToast('Could not add brand', 'error');
    }
  };

  /**
   * Delete a Brand Column
   */
  const handleDeleteBrand = async (brandName: string) => {
    try {
      const storeId = store?.id || 'store-1';
      await MatrixRepository.deleteBrand(
        storeId,
        selectedCategoryId,
        activeSubcategoryId,
        brandName,
        deviceId
      );
      await loadMatrix(selectedCategoryId, activeSubcategoryId);
      showToast(`Brand "${brandName}" removed`, 'info');
    } catch (e) {
      console.error('Error removing brand:', e);
      showToast('Could not remove brand', 'error');
    }
  };

  /**
   * Add a Size Row
   */
  const handleAddSize = async (sizeName: string) => {
    try {
      const storeId = store?.id || 'store-1';
      await MatrixRepository.addSize(
        storeId,
        selectedCategoryId,
        activeSubcategoryId,
        sizeName,
        matrixData.brands,
        deviceId
      );
      await loadMatrix(selectedCategoryId, activeSubcategoryId);
      showToast(`Size "${sizeName}" added!`, 'success');
    } catch (e) {
      console.error('Error adding size:', e);
      showToast('Could not add size', 'error');
    }
  };

  /**
   * Reorder sizes/items via drag or nudge
   */
  const handleReorderSizes = async (newSizes: string[]) => {
    try {
      setMatrixData((prev) => ({
        ...prev,
        sizes: newSizes,
      }));

      const storeId = store?.id || 'store-1';
      if (selectedCategoryId && activeSubcategoryId) {
        await MatrixRepository.saveSizeOrder(
          storeId,
          selectedCategoryId,
          activeSubcategoryId,
          newSizes
        );
      }
    } catch (e) {
      console.error('Error saving size order:', e);
      showToast('Could not save size order', 'error');
    }
  };

  /**
   * Handle Cell Selection
   */
  const handleSelectCell = (
    cellKey: string,
    cell: MatrixCellData | null,
    size: string,
    brand: string
  ) => {
    setSelectedCellKey(cellKey);
    setSelectedCell(cell);
    setSelectedSize(size);
    setSelectedBrand(brand);
  };

  /**
   * Open Stock In Modal
   */
  const handleOpenStockIn = () => {
    if (!selectedSize || !selectedBrand) return;
    setActionModalMode('add');
    setActionQty('');
    setActionNote('');
    setActionPriceRs(
      selectedCell?.purchasePricePaise
        ? (selectedCell.purchasePricePaise / 100).toString()
        : ''
    );
  };

  /**
   * Open Sell Modal
   */
  const handleOpenSell = () => {
    if (!selectedSize || !selectedBrand) return;
    setActionModalMode('sell');
    setActionQty('');
    setActionNote('');
    setActionPriceRs(
      selectedCell?.sellingPricePaise
        ? (selectedCell.sellingPricePaise / 100).toString()
        : ''
    );
  };

  /**
   * Confirm Stock Adjustment (Stock In or Sell)
   */
  const handleConfirmStockAction = async () => {
    if (!actionModalMode || submittingAction) return;
    const numQty = parseFloat(actionQty);
    if (isNaN(numQty) || numQty <= 0) {
      showToast('Please enter a valid quantity', 'warning');
      return;
    }

    const currentStock = selectedCell ? selectedCell.currentStock : 0;
    if (actionModalMode === 'sell' && numQty > currentStock) {
      showToast(`Not enough stock. Available: ${currentStock}`, 'warning');
      return;
    }

    try {
      setSubmittingAction(true);
      const storeId = store?.id || 'store-1';

      // Ensure variant exists in database
      let variantId = selectedCell?.variantId;
      if (!variantId) {
        // If cell had no record, create variant on the fly
        await MatrixRepository.addSize(
          storeId,
          selectedCategoryId,
          activeSubcategoryId,
          selectedSize,
          [selectedBrand],
          deviceId
        );
        const refreshed = await MatrixRepository.getMatrixData(
          storeId,
          selectedCategoryId,
          activeSubcategoryId
        );
        const cell = refreshed.cells[`${selectedSize}___${selectedBrand.toLowerCase()}`];
        variantId = cell?.variantId;
      }

      if (!variantId) {
        throw new Error('Could not resolve item variant');
      }

      const reason = actionModalMode === 'sell'
        ? (actionNote.trim() || `Sold ${numQty} pc of ${selectedSize} ${selectedBrand}`)
        : (actionNote.trim() || `Restocked ${numQty} pc of ${selectedSize} ${selectedBrand}`);

      await InventoryRepository.adjustStock(
        variantId,
        numQty,
        'piece',
        actionModalMode === 'sell' ? 'sale' : 'increase',
        reason,
        storeId,
        deviceId
      );

      // Save custom price if updated by user
      if (actionPriceRs && !isNaN(parseFloat(actionPriceRs)) && parseFloat(actionPriceRs) > 0) {
        const paise = Math.round(parseFloat(actionPriceRs) * 100);
        const { getDatabase } = await import('../../src/database/db.js');
        const db = await getDatabase();
        const now = new Date().toISOString();
        if (actionModalMode === 'sell') {
          await db.runAsync(
            `UPDATE product_variants SET sellingPricePaise = ?, updatedAt = ? WHERE id = ?;`,
            [paise, now, variantId]
          );
        } else {
          await db.runAsync(
            `UPDATE product_variants SET purchasePricePaise = ?, updatedAt = ? WHERE id = ?;`,
            [paise, now, variantId]
          );
        }
      }

      setActionModalMode(null);
      await loadMatrix(selectedCategoryId, activeSubcategoryId, selectedSize, selectedBrand);
      showToast(
        actionModalMode === 'sell'
          ? `Sold ${numQty} pc successfully!`
          : `Added +${numQty} pc to stock!`,
        'success'
      );
    } catch (e: any) {
      console.error('Error confirming stock action:', e);
      showToast(e?.message || 'Failed to update stock', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  /**
   * Create New Category
   */
  const handleCreateCategory = async () => {
    if (!newCatName.trim() || submittingCat) return;
    try {
      setSubmittingCat(true);
      const storeId = store?.id || 'store-1';
      const created = await ProductRepository.createCategory(
        { name: newCatName.trim() },
        storeId,
        deviceId
      );
      setCategories((prev) => [...prev, created]);
      setNewCatName('');
      setNewCatModalVisible(false);
      await switchCategory(created.id);
      showToast(`Category "${created.name}" created!`, 'success');
    } catch (e) {
      console.error('Error creating category:', e);
      showToast('Could not create category', 'error');
    } finally {
      setSubmittingCat(false);
    }
  };

  // Filtered matrix based on search query
  const filteredMatrix = useMemo(() => {
    if (!searchQuery.trim()) return matrixData;
    const query = searchQuery.trim().toLowerCase();

    // Filter matching brands or sizes
    const matchedSizes = matrixData.sizes.filter((s) => s.toLowerCase().includes(query));
    const matchedBrands = matrixData.brands.filter((b) => b.toLowerCase().includes(query));

    if (matchedSizes.length === 0 && matchedBrands.length === 0) {
      return {
        brands: matrixData.brands,
        sizes: [],
        cells: matrixData.cells,
      };
    }

    return {
      brands: matchedBrands.length > 0 ? matchedBrands : matrixData.brands,
      sizes: matchedSizes.length > 0 ? matchedSizes : matrixData.sizes,
      cells: matrixData.cells,
    };
  }, [matrixData, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* 1. Header Bar: Logo + Store Name + Active Category Header */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: activeColors.surface,
            borderBottomColor: activeColors.border,
            paddingTop: topInset + 4,
          },
          themeShadows.card,
        ]}
      >
        <View style={styles.storeHeaderRow}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={{ flex: 1, marginLeft: 10, justifyContent: 'center' }}>
            <Text
              style={[
                styles.storeTitle,
                { color: activeColors.textPrimary },
              ]}
              numberOfLines={1}
            >
              Manju Hardware Store
            </Text>
          </View>

          {/* Quick Search Toggle / Input */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setNewCatModalVisible(true)}
            style={[
              styles.addCatBtn,
              {
                backgroundColor: activeColors.primaryLight,
                borderColor: activeColors.primaryBorder || activeColors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="shape-plus"
              size={16}
              color={activeColors.primary}
            />
            <Text
              style={[
                styles.addCatBtnText,
                { color: activeColors.primary },
              ]}
            >
              + Category
            </Text>
          </TouchableOpacity>
        </View>

        {/* Categories Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((c) => {
            const isSelected = c.id === selectedCategoryId;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.7}
                onPress={() => switchCategory(c.id)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected
                      ? activeColors.primary
                      : isDarkMode
                      ? activeColors.surfaceElevated
                      : activeColors.surfaceSubtle,
                    borderColor: isSelected
                      ? activeColors.primary
                      : activeColors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    {
                      color: isSelected ? '#FFFFFF' : activeColors.textSecondary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. Sub-Tabs Bar: [ Pipes ] [ Pipe Fittings ] [ Others ] [ + Add Section ] */}
      <CategorySubTabs
        subcategories={subcategories}
        activeSubcategoryId={activeSubcategoryId}
        onSelectSubcategory={handleSelectSubTab}
        onAddSubTab={handleAddSubTab}
        isDarkMode={isDarkMode}
        activeColors={activeColors}
      />

      {/* 3. Search Filter Bar (Optional quick lookup) */}
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder={`Search ${activeCategory?.name || 'items'} by size or brand...`}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[
            styles.searchbar,
            {
              backgroundColor: isDarkMode
                ? activeColors.surfaceElevated
                : activeColors.surfaceSubtle,
            },
          ]}
          inputStyle={{
            fontSize: 13,
            color: activeColors.textPrimary,
            minHeight: 36,
          }}
          placeholderTextColor={activeColors.textMuted}
          iconColor={activeColors.textSecondary}
        />
      </View>

      {/* 4. Main Matrix Table View */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={activeColors.primary} />
            <Text style={[styles.loadingText, { color: activeColors.textMuted }]}>
              Loading Table...
            </Text>
          </View>
        ) : (
          <ProductMatrixGrid
            data={filteredMatrix}
            selectedCellKey={selectedCellKey}
            onSelectCell={handleSelectCell}
            onAddBrand={handleAddBrand}
            onAddSize={handleAddSize}
            onDeleteBrand={handleDeleteBrand}
            onReorderSizes={handleReorderSizes}
            isDarkMode={isDarkMode}
            activeColors={activeColors}
            emptyLabel={activeCategory?.name || 'Items'}
          />
        )}
      </View>

      {/* 5. Bottom Action Bar: [ stock ] (Green) & [ sell ] (Red) */}
      <MatrixActionBar
        selectedCell={selectedCell}
        selectedSize={selectedSize}
        selectedBrand={selectedBrand}
        onStockIn={handleOpenStockIn}
        onSell={handleOpenSell}
        isDarkMode={isDarkMode}
        activeColors={activeColors}
      />

      {/* Quick Stock / Sell Modal */}
      <Modal
        visible={actionModalMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionModalMode(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: activeColors.surface,
                borderColor: activeColors.border,
              },
              themeShadows.card,
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconWrap,
                  {
                    backgroundColor:
                      actionModalMode === 'sell'
                        ? isDarkMode
                          ? '#450A0A'
                          : '#FEE2E2'
                        : isDarkMode
                        ? '#064E3B'
                        : '#DCFCE7',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={actionModalMode === 'sell' ? 'arrow-up-bold' : 'arrow-down-bold'}
                  size={24}
                  color={actionModalMode === 'sell' ? '#DC2626' : '#059669'}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: actionModalMode === 'sell' ? '#DC2626' : '#059669',
                    },
                  ]}
                >
                  {actionModalMode === 'sell' ? 'Sell Item (Stock Out)' : 'Stock In (Add Inventory)'}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  {actionModalMode === 'sell' ? 'Deduct stock on sale' : 'Add inventory to stock'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.actionItemBanner,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              <Text
                style={[
                  styles.actionItemTitle,
                  { color: activeColors.textPrimary },
                ]}
              >
                {selectedSize} • {selectedBrand}
              </Text>
              <Text
                style={[
                  styles.actionItemStock,
                  { color: activeColors.textSecondary },
                ]}
              >
                Available Stock:{' '}
                <Text
                  style={{
                    fontWeight: '800',
                    color: (selectedCell?.currentStock || 0) > 0 ? activeColors.textPrimary : '#DC2626',
                  }}
                >
                  {selectedCell ? selectedCell.currentStock : 0} pcs
                </Text>
              </Text>
            </View>

            <Text
              style={[
                styles.inputLabel,
                { color: activeColors.textPrimary },
              ]}
            >
              {actionModalMode === 'sell' ? 'Quantity to Sell (pcs):' : 'Quantity to Add (pcs):'}
            </Text>
            <TextInput
              style={[
                styles.actionInput,
                {
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surfaceSubtle,
                  color: activeColors.textPrimary,
                  borderColor:
                    actionModalMode === 'sell' &&
                    parseInt(actionQty || '0', 10) > (selectedCell?.currentStock || 0)
                      ? '#DC2626'
                      : activeColors.border,
                },
              ]}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={activeColors.textMuted}
              value={actionQty}
              onChangeText={setActionQty}
              autoFocus
            />

            {actionModalMode === 'sell' &&
              parseInt(actionQty || '0', 10) > (selectedCell?.currentStock || 0) && (
                <Text style={styles.stockWarningText}>
                  ⚠️ Quantity exceeds available stock ({selectedCell?.currentStock || 0} pcs)
                </Text>
              )}

            <Text
              style={[
                styles.inputLabel,
                { color: activeColors.textPrimary, marginTop: 10 },
              ]}
            >
              Note (Optional):
            </Text>
            <TextInput
              style={[
                styles.noteInput,
                {
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surfaceSubtle,
                  color: activeColors.textPrimary,
                  borderColor: activeColors.border,
                },
              ]}
              placeholder="e.g. Counter Cash, Wholesale Bill etc."
              placeholderTextColor={activeColors.textMuted}
              value={actionNote}
              onChangeText={setActionNote}
            />

            <View style={[styles.modalActions, { marginTop: 18 }]}>
              <TouchableOpacity
                onPress={() => setActionModalMode(null)}
                style={[
                  styles.btnCancel,
                  { borderColor: activeColors.border },
                ]}
              >
                <Text
                  style={[
                    styles.btnCancelText,
                    { color: activeColors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmStockAction}
                disabled={
                  submittingAction ||
                  !actionQty.trim() ||
                  parseFloat(actionQty) <= 0 ||
                  (actionModalMode === 'sell' && parseFloat(actionQty) > (selectedCell?.currentStock || 0))
                }
                style={[
                  styles.btnConfirm,
                  {
                    backgroundColor:
                      !actionQty.trim() ||
                      parseFloat(actionQty) <= 0 ||
                      (actionModalMode === 'sell' && parseFloat(actionQty) > (selectedCell?.currentStock || 0))
                        ? activeColors.border
                        : actionModalMode === 'sell'
                        ? '#DC2626'
                        : '#059669',
                  },
                ]}
              >
                <Text style={styles.btnConfirmText}>
                  {submittingAction
                    ? 'Processing...'
                    : actionModalMode === 'sell'
                    ? 'Confirm Sell'
                    : 'Confirm Stock In'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Category */}
      <Modal
        visible={newCatModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewCatModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: activeColors.surface,
                borderColor: activeColors.border,
              },
              themeShadows.card,
            ]}
          >
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconWrap,
                  { backgroundColor: activeColors.primaryLight },
                ]}
              >
                <MaterialCommunityIcons
                  name="shape-plus"
                  size={24}
                  color={activeColors.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: activeColors.textPrimary },
                  ]}
                >
                  Create New Category
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  e.g. Pipes, Sanitary, Electrical, Paints etc.
                </Text>
              </View>
            </View>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surfaceSubtle,
                  color: activeColors.textPrimary,
                  borderColor: activeColors.border,
                },
              ]}
              placeholder="Enter category name..."
              placeholderTextColor={activeColors.textMuted}
              value={newCatName}
              onChangeText={setNewCatName}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setNewCatName('');
                  setNewCatModalVisible(false);
                }}
                style={[
                  styles.btnCancel,
                  { borderColor: activeColors.border },
                ]}
              >
                <Text
                  style={[
                    styles.btnCancelText,
                    { color: activeColors.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCreateCategory}
                disabled={!newCatName.trim() || submittingCat}
                style={[
                  styles.btnConfirm,
                  {
                    backgroundColor: newCatName.trim()
                      ? activeColors.primary
                      : activeColors.border,
                  },
                ]}
              >
                <Text style={styles.btnConfirmText}>
                  {submittingCat ? 'Creating...' : '+ Create'}
                </Text>
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
  headerBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  storeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  storeTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  addCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  addCatBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
  },
  searchWrap: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  searchbar: {
    height: 38,
    borderRadius: borderRadius.lg,
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  actionDialog: {
    borderRadius: borderRadius.xl,
  },
  actionDialogTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  actionItemBanner: {
    padding: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: 14,
  },
  actionItemTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionItemStock: {
    fontSize: 13,
    marginTop: 3,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  actionInput: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  stockWarningText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  dialogCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dialogCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dialogConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    marginLeft: 8,
  },
  dialogConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999999,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 1.3,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
