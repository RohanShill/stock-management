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
import { CategoryRepository } from '../../src/database/repositories/categoryRepository.js';
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

interface ManageItemTarget {
  type: 'category' | 'section';
  item: Category | Subcategory;
}

export default function ProductsScreen() {
  const router = useRouter();
  const routerParams = useLocalSearchParams<{
    categoryId?: string;
    action?: string;
    filter?: string;
  }>();

  const { store, deviceId, isDarkMode, showToast, showConfirm } = useAppStore();
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

  // Hold to Manage Modal State (for Category & Section)
  const [manageTarget, setManageTarget] = useState<ManageItemTarget | null>(null);
  const [manageModalVisible, setManageModalVisible] = useState(false);

  // Dedicated Rename Modal State for Category / Section
  const [manageRenameModalVisible, setManageRenameModalVisible] = useState(false);
  const [manageRenameInput, setManageRenameInput] = useState('');
  const [submittingManageRename, setSubmittingManageRename] = useState(false);

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
    subcatId?: string,
    keepSize?: string,
    keepBrand?: string,
    silent?: boolean
  ) => {
    if (!catId) {
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const storeId = store?.id || 'store-1';
      const data = await MatrixRepository.getMatrixData(storeId, catId, subcatId || undefined);
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
      if (!silent) showToast('Could not load inventory grid', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [store?.id, selectedSize, selectedBrand, showToast]);

  /**
   * Loads sub-tabs (sections) and matrix data for a category
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
      const catName = cat?.name || '';

      // Queries active sub-tabs strictly belonging to this category (no default sections injected)
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
      await loadMatrix(catId, activeSub);
    } catch (e: any) {
      console.error('Error switching category:', e);
      setLoading(false);
      showToast(e?.message || 'Error switching category', 'error');
    }
  }, [store?.id, categories, deviceId, loadMatrix, showToast]);

  /**
   * Initial Data Load: Run once on mount
   * Clean slate: Never auto-creates categories or sections on fresh install.
   */
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        setLoading(true);
        const storeId = store?.id || 'store-1';
        const cats = await ProductRepository.getCategories(storeId);

        if (!isMounted) return;
        setCategories(cats || []);

        if (cats && cats.length > 0) {
          const targetCat = routerParams?.categoryId
            ? cats.find((c) => c.id === routerParams.categoryId) || cats[0]
            : cats.find((c) => c.name.toLowerCase().includes('pipe')) || cats[0];
          await switchCategory(targetCat.id, cats);
        } else {
          setLoading(false);
          if (routerParams?.action === 'add') {
            setNewCatModalVisible(true);
          }
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
   * Keep screen in sync when switching tabs (e.g. if a restock happened on Home or section changed)
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

          if (freshCats && freshCats.length > 0) {
            const currentCatId = selectedCategoryId && freshCats.some((c) => c.id === selectedCategoryId)
              ? selectedCategoryId
              : freshCats[0].id;

            if (currentCatId !== selectedCategoryId) {
              setSelectedCategoryId(currentCatId);
            }

            const cat = freshCats.find((c) => c.id === currentCatId);
            const currentSubtabs = await MatrixRepository.ensureDefaultSubTabs(
              storeId,
              currentCatId,
              cat?.name || '',
              deviceId
            );
            if (!isMounted) return;
            setSubcategories(currentSubtabs);

            let targetSubId = activeSubcategoryId;
            if (!targetSubId || !currentSubtabs.some((s) => s.id === targetSubId)) {
              targetSubId = currentSubtabs[0]?.id || '';
              setActiveSubcategoryId(targetSubId);
            }

            if (targetSubId) {
              // Smooth, silent refresh of the matrix table to display real-time stock
              await loadMatrix(currentCatId, targetSubId, undefined, undefined, true);
            } else {
              setMatrixData({ brands: [], sizes: [], cells: {} });
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
  const handleAddBrand = useCallback(async (brandName: string) => {
    if (!activeSubcategoryId) {
      showToast('Please add a section first using "+ SECTION"', 'warning');
      return;
    }
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
  }, [activeSubcategoryId, store, selectedCategoryId, activeSubcategoryId, matrixData.sizes, deviceId, loadMatrix, showToast]);

  /**
   * Delete a Brand Column
   */
  const handleDeleteBrand = useCallback(async (brandName: string) => {
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
  }, [store, selectedCategoryId, activeSubcategoryId, deviceId, loadMatrix, showToast]);

  /**
   * Rename a Brand Column
   */
  const handleRenameBrand = useCallback(async (oldBrand: string, newBrand: string) => {
    try {
      const storeId = store?.id || 'store-1';
      await MatrixRepository.renameBrand(
        storeId,
        selectedCategoryId,
        activeSubcategoryId,
        oldBrand,
        newBrand,
        deviceId
      );
      await loadMatrix(selectedCategoryId, activeSubcategoryId);
      showToast(`Brand "${oldBrand}" renamed to "${newBrand}"`, 'success');
    } catch (e) {
      console.error('Error renaming brand:', e);
      showToast('Could not rename brand', 'error');
    }
  }, [store, selectedCategoryId, activeSubcategoryId, deviceId, loadMatrix, showToast]);

  /**
   * Delete a Size Row
   */
  const handleDeleteSize = useCallback(async (sizeName: string) => {
    try {
      const storeId = store?.id || 'store-1';
      await MatrixRepository.deleteSize(
        storeId,
        selectedCategoryId,
        activeSubcategoryId,
        sizeName,
        deviceId
      );
      await loadMatrix(selectedCategoryId, activeSubcategoryId);
      showToast(`Size "${sizeName}" removed`, 'info');
    } catch (e) {
      console.error('Error removing size:', e);
      showToast('Could not remove size', 'error');
    }
  }, [store, selectedCategoryId, activeSubcategoryId, deviceId, loadMatrix, showToast]);

  /**
   * Rename a Size Row
   */
  const handleRenameSize = useCallback(async (oldSize: string, newSize: string) => {
    try {
      const storeId = store?.id || 'store-1';
      await MatrixRepository.renameSize(
        storeId,
        selectedCategoryId,
        activeSubcategoryId,
        oldSize,
        newSize,
        deviceId
      );
      await loadMatrix(selectedCategoryId, activeSubcategoryId);
      showToast(`Size "${oldSize}" renamed to "${newSize}"`, 'success');
    } catch (e) {
      console.error('Error renaming size:', e);
      showToast('Could not rename size', 'error');
    }
  }, [store, selectedCategoryId, activeSubcategoryId, deviceId, loadMatrix, showToast]);

  /**
   * Add a Size Row
   */
  const handleAddSize = useCallback(async (sizeName: string) => {
    if (!activeSubcategoryId) {
      showToast('Please add a section first using "+ SECTION"', 'warning');
      return;
    }
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
  }, [activeSubcategoryId, store, selectedCategoryId, activeSubcategoryId, matrixData.brands, deviceId, loadMatrix, showToast]);

  /**
   * Reorder sizes/items via drag or nudge
   */
  const handleReorderSizes = useCallback(async (newSizes: string[]) => {
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
  }, [store, selectedCategoryId, activeSubcategoryId, showToast]);

  /**
   * Reorder brands left or right
   */
  const handleReorderBrands = useCallback(async (newBrands: string[]) => {
    try {
      setMatrixData((prev) => ({
        ...prev,
        brands: newBrands,
      }));

      const storeId = store?.id || 'store-1';
      if (selectedCategoryId && activeSubcategoryId) {
        await MatrixRepository.saveBrandOrder(
          storeId,
          selectedCategoryId,
          activeSubcategoryId,
          newBrands
        );
      }
    } catch (e) {
      console.error('Error saving brand order:', e);
      showToast('Could not save brand order', 'error');
    }
  }, [store, selectedCategoryId, activeSubcategoryId, showToast]);

  /**
   * Handle Cell Selection
   */
  const handleSelectCell = useCallback((
    cellKey: string,
    cell: MatrixCellData | null,
    size: string,
    brand: string
  ) => {
    setSelectedCellKey(cellKey);
    setSelectedCell(cell);
    setSelectedSize(size);
    setSelectedBrand(brand);
  }, []);

  /**
   * Open Stock In Modal
   */
  const handleOpenStockIn = useCallback(() => {
    if (!selectedSize || !selectedBrand) return;
    setActionModalMode('add');
    setActionQty('');
    setActionNote('');
    setActionPriceRs(
      selectedCell?.purchasePricePaise
        ? (selectedCell.purchasePricePaise / 100).toString()
        : ''
    );
  }, [selectedSize, selectedBrand, selectedCell]);

  /**
   * Open Sell Modal
   */
  const handleOpenSell = useCallback(() => {
    if (!selectedSize || !selectedBrand) return;
    setActionModalMode('sell');
    setActionQty('');
    setActionNote('');
    setActionPriceRs(
      selectedCell?.sellingPricePaise
        ? (selectedCell.sellingPricePaise / 100).toString()
        : ''
    );
  }, [selectedSize, selectedBrand, selectedCell]);

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
        await MatrixRepository.updateVariantPrice(
          variantId,
          actionModalMode === 'sell' ? 'sell' : 'purchase',
          paise
        );
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
      const updatedCats = [...categories, created];
      setCategories(updatedCats);
      setNewCatName('');
      setNewCatModalVisible(false);
      await switchCategory(created.id, updatedCats);
      showToast(`Category "${created.name}" created!`, 'success');
    } catch (e) {
      console.error('Error creating category:', e);
      showToast('Could not create category', 'error');
    } finally {
      setSubmittingCat(false);
    }
  };

  /**
   * Hold to Manage helpers & handlers (Category & Section)
   */
  const currentManageIndex = useMemo(() => {
    if (!manageTarget) return -1;
    if (manageTarget.type === 'category') {
      return categories.findIndex((c) => c.id === manageTarget.item.id);
    } else {
      return subcategories.findIndex((s) => s.id === manageTarget.item.id);
    }
  }, [manageTarget, categories, subcategories]);

  const currentManageTotal = useMemo(() => {
    if (!manageTarget) return 0;
    return manageTarget.type === 'category' ? categories.length : subcategories.length;
  }, [manageTarget, categories, subcategories]);

  const currentManageItemName = useMemo(() => {
    if (!manageTarget) return '';
    if (manageTarget.type === 'category') {
      const found = categories.find((c) => c.id === manageTarget.item.id);
      return found?.name || manageTarget.item.name;
    } else {
      const found = subcategories.find((s) => s.id === manageTarget.item.id);
      return found?.name || manageTarget.item.name;
    }
  }, [manageTarget, categories, subcategories]);

  const handleOpenManageModal = (type: 'category' | 'section', item: Category | Subcategory) => {
    setManageTarget({ type, item });
    setManageModalVisible(true);
  };

  const handleMoveLeft = async () => {
    if (!manageTarget || currentManageIndex <= 0) return;
    const idx = currentManageIndex;
    const storeId = store?.id || 'store-1';

    if (manageTarget.type === 'category') {
      const nextList = [...categories];
      const temp = nextList[idx];
      nextList[idx] = nextList[idx - 1];
      nextList[idx - 1] = temp;

      const ordered = nextList.map((c, i) => ({ ...c, displayOrder: i }));
      setCategories(ordered);

      try {
        await CategoryRepository.reorderCategories(
          ordered.map((c) => ({ id: c.id, displayOrder: c.displayOrder })),
          storeId,
          deviceId
        );
      } catch (e) {
        console.error('Failed to reorder categories:', e);
        showToast('Could not save category order', 'error');
      }
    } else {
      const nextList = [...subcategories];
      const temp = nextList[idx];
      nextList[idx] = nextList[idx - 1];
      nextList[idx - 1] = temp;

      const ordered = nextList.map((s, i) => ({ ...s, displayOrder: i }));
      setSubcategories(ordered);

      try {
        await CategoryRepository.reorderSubcategories(
          ordered.map((s) => ({ id: s.id, displayOrder: s.displayOrder })),
          storeId,
          deviceId
        );
      } catch (e) {
        console.error('Failed to reorder sections:', e);
        showToast('Could not save section order', 'error');
      }
    }
  };

  const handleMoveRight = async () => {
    if (!manageTarget || currentManageIndex < 0 || currentManageIndex >= currentManageTotal - 1) return;
    const idx = currentManageIndex;
    const storeId = store?.id || 'store-1';

    if (manageTarget.type === 'category') {
      const nextList = [...categories];
      const temp = nextList[idx];
      nextList[idx] = nextList[idx + 1];
      nextList[idx + 1] = temp;

      const ordered = nextList.map((c, i) => ({ ...c, displayOrder: i }));
      setCategories(ordered);

      try {
        await CategoryRepository.reorderCategories(
          ordered.map((c) => ({ id: c.id, displayOrder: c.displayOrder })),
          storeId,
          deviceId
        );
      } catch (e) {
        console.error('Failed to reorder categories:', e);
        showToast('Could not save category order', 'error');
      }
    } else {
      const nextList = [...subcategories];
      const temp = nextList[idx];
      nextList[idx] = nextList[idx + 1];
      nextList[idx + 1] = temp;

      const ordered = nextList.map((s, i) => ({ ...s, displayOrder: i }));
      setSubcategories(ordered);

      try {
        await CategoryRepository.reorderSubcategories(
          ordered.map((s) => ({ id: s.id, displayOrder: s.displayOrder })),
          storeId,
          deviceId
        );
      } catch (e) {
        console.error('Failed to reorder sections:', e);
        showToast('Could not save section order', 'error');
      }
    }
  };

  const handleTriggerManageRename = () => {
    if (!manageTarget) return;
    setManageRenameInput(currentManageItemName);
    setManageModalVisible(false);
    setTimeout(() => {
      setManageRenameModalVisible(true);
    }, 150);
  };

  const handleConfirmManageRename = async () => {
    if (!manageTarget || submittingManageRename) return;
    const clean = manageRenameInput.trim();
    if (!clean) {
      showToast('Name cannot be empty', 'warning');
      return;
    }
    const { type, item } = manageTarget;
    if (clean.toLowerCase() === item.name.toLowerCase() && clean === item.name) {
      setManageRenameModalVisible(false);
      return;
    }

    const storeId = store?.id || 'store-1';
    try {
      setSubmittingManageRename(true);
      if (type === 'category') {
        if (
          categories.some(
            (c) => c.name.toLowerCase() === clean.toLowerCase() && c.id !== item.id
          )
        ) {
          showToast(`Category "${clean}" already exists.`, 'warning');
          return;
        }

        await CategoryRepository.updateCategory(item.id, { name: clean }, storeId, deviceId);
        setCategories((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, name: clean } : c))
        );
        setManageRenameModalVisible(false);
        showToast(`Category renamed to "${clean}"`, 'success');
      } else {
        if (
          subcategories.some(
            (s) => s.name.toLowerCase() === clean.toLowerCase() && s.id !== item.id
          )
        ) {
          showToast(`Section "${clean}" already exists.`, 'warning');
          return;
        }

        await CategoryRepository.updateSubcategory(item.id, { name: clean }, storeId, deviceId);
        setSubcategories((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, name: clean } : s))
        );
        setManageRenameModalVisible(false);
        showToast(`Section renamed to "${clean}"`, 'success');
      }
    } catch (e) {
      console.error('Failed to rename:', e);
      showToast(`Could not rename ${type}`, 'error');
    } finally {
      setSubmittingManageRename(false);
    }
  };

  const handleTriggerManageDelete = () => {
    if (!manageTarget) return;
    const { type, item } = manageTarget;
    setManageModalVisible(false);

    showConfirm({
      title: type === 'category' ? 'Delete Category' : 'Delete Section',
      message:
        type === 'category'
          ? `Are you sure you want to delete category "${item.name}"? All sections, products and stock entries inside this category will be removed.`
          : `Are you sure you want to delete section "${item.name}"? All products and stock entries inside this section will be removed.`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        const storeId = store?.id || 'store-1';
        try {
          if (type === 'category') {
            await CategoryRepository.archiveCategory(item.id, storeId, deviceId);
            const remaining = categories.filter((c) => c.id !== item.id);
            setCategories(remaining);

            if (selectedCategoryId === item.id) {
              if (remaining.length > 0) {
                await switchCategory(remaining[0].id, remaining);
              } else {
                setSelectedCategoryId('');
                setSubcategories([]);
                setMatrixData({ brands: [], sizes: [], cells: {} });
              }
            }
            showToast(`Category "${item.name}" deleted`, 'info');
          } else {
            await MatrixRepository.deleteSubTab(storeId, item.id, deviceId);
            const remaining = subcategories.filter((s) => s.id !== item.id);
            setSubcategories(remaining);

            if (activeSubcategoryId === item.id) {
              const nextSub = remaining[0]?.id || '';
              setActiveSubcategoryId(nextSub);
              if (nextSub) {
                await loadMatrix(selectedCategoryId, nextSub);
              } else {
                setMatrixData({ brands: [], sizes: [], cells: {} });
              }
            }
            showToast(`Section "${item.name}" deleted`, 'info');
          }
        } catch (e: any) {
          console.error('Failed to delete item:', e);
          showToast(e?.message || `Failed to delete ${type}`, 'error');
        }
      },
    });
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
            source={require('../../assets/logo.png')}
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
              MANJU STORES
            </Text>
          </View>

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
                onLongPress={() => handleOpenManageModal('category', c)}
                delayLongPress={350}
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
                    },
                  ]}
                >
                  {c.name.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* "+ Category" button placed right after the categories */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setNewCatModalVisible(true)}
            style={[
              styles.addCategoryPill,
              {
                backgroundColor: isDarkMode
                  ? activeColors.surfaceElevated
                  : activeColors.surface,
                borderColor: activeColors.primaryBorder || activeColors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="plus"
              size={16}
              color={activeColors.primary}
            />
            <Text
              style={[
                styles.addCategoryPillText,
                { color: activeColors.primary },
              ]}
            >
              CATEGORY
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {categories.length === 0 ? (
        <View style={styles.emptyCategoriesWrap}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2FF' },
            ]}
          >
            <MaterialCommunityIcons
              name="shape-plus"
              size={44}
              color={activeColors.primary}
            />
          </View>
          <Text style={[styles.emptyCatTitle, { color: activeColors.textPrimary }]}>
            No Categories Yet
          </Text>
          <Text style={[styles.emptyCatSub, { color: activeColors.textSecondary }]}>
            First when you install the app, there are no pre-set categories. Tap "+ Category" above to add your first category.
          </Text>
          <TouchableOpacity
            style={[styles.emptyCatBtn, { backgroundColor: activeColors.primary }]}
            onPress={() => setNewCatModalVisible(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.emptyCatBtnText}>Add First Category</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* 2. Sub-Tabs Bar: [ + Add Section ] */}
          <CategorySubTabs
            subcategories={subcategories}
            activeSubcategoryId={activeSubcategoryId}
            onSelectSubcategory={handleSelectSubTab}
            onAddSubTab={handleAddSubTab}
            onLongPressSubcategory={(sub) => handleOpenManageModal('section', sub)}
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
            ) : subcategories.length === 0 ? (
              <View style={styles.emptyCategoriesWrap}>
                <View
                  style={[
                    styles.emptyIconCircle,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#EEF2FF' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="view-grid-plus-outline"
                    size={40}
                    color={activeColors.primary}
                  />
                </View>
                <Text style={[styles.emptyCatTitle, { color: activeColors.textPrimary }]}>
                  No Sections Yet
                </Text>
                <Text style={[styles.emptyCatSub, { color: activeColors.textSecondary }]}>
                  Tap "+ SECTION" above to create your first section under {activeCategory?.name || 'this category'}.
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
                onRenameBrand={handleRenameBrand}
                onDeleteSize={handleDeleteSize}
                onRenameSize={handleRenameSize}
                onReorderSizes={handleReorderSizes}
                onReorderBrands={handleReorderBrands}
                isDarkMode={isDarkMode}
                activeColors={activeColors}
                emptyLabel={activeCategory?.name || 'Items'}
              />
            )}
          </View>

          {/* 5. Bottom Action Bar: [ stock ] (Green) & [ sell ] (Red) */}
          {subcategories.length > 0 && (
            <MatrixActionBar
              selectedCell={selectedCell}
              selectedSize={selectedSize}
              selectedBrand={selectedBrand}
              onStockIn={handleOpenStockIn}
              onSell={handleOpenSell}
              isDarkMode={isDarkMode}
              activeColors={activeColors}
            />
          )}
        </>
      )}

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

      {/* Modal: Action Sheet for Category / Section Management ("Hold to Manage") */}
      <Modal
        visible={manageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManageModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setManageModalVisible(false)}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.actionSheetCard,
              {
                backgroundColor: activeColors.surface,
                borderColor: activeColors.border,
              },
              themeShadows.card,
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View
                style={[
                  styles.sheetIconCircle,
                  { backgroundColor: activeColors.primaryLight },
                ]}
              >
                <MaterialCommunityIcons
                  name={manageTarget?.type === 'category' ? 'shape-outline' : 'folder-outline'}
                  size={22}
                  color={activeColors.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    styles.sheetTypeLabel,
                    { color: activeColors.primary },
                  ]}
                >
                  MANAGE {manageTarget?.type === 'category' ? 'CATEGORY' : 'SECTION'}
                </Text>
                <Text
                  style={[
                    styles.sheetTargetTitle,
                    { color: activeColors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {currentManageItemName.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setManageModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={activeColors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Position & Order Box */}
            <View
              style={[
                styles.reorderSection,
                {
                  backgroundColor: isDarkMode ? activeColors.surfaceElevated : activeColors.surfaceSubtle,
                  borderColor: activeColors.border,
                },
              ]}
            >
              <View style={styles.reorderHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons
                    name="swap-horizontal"
                    size={18}
                    color={activeColors.primary}
                  />
                  <Text style={[styles.reorderTitle, { color: activeColors.textPrimary }]}>
                    POSITION & ORDER
                  </Text>
                </View>
                {currentManageTotal > 0 && (
                  <View
                    style={[
                      styles.positionBadge,
                      { backgroundColor: activeColors.primaryLight },
                    ]}
                  >
                    <Text style={[styles.positionBadgeText, { color: activeColors.primary }]}>
                      #{currentManageIndex + 1} of {currentManageTotal}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.reorderSubtitle, { color: activeColors.textMuted }]}>
                Tap arrows to move {manageTarget?.type === 'category' ? 'category' : 'section'} left or right
              </Text>

              <View style={styles.reorderBtnRow}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  disabled={currentManageIndex <= 0}
                  onPress={handleMoveLeft}
                  style={[
                    styles.reorderBtn,
                    {
                      backgroundColor: currentManageIndex <= 0
                        ? (isDarkMode ? '#1E293B' : '#F1F5F9')
                        : (isDarkMode ? '#334155' : '#FFFFFF'),
                      borderColor: currentManageIndex <= 0
                        ? 'transparent'
                        : activeColors.border,
                      opacity: currentManageIndex <= 0 ? 0.45 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="arrow-left-bold"
                    size={18}
                    color={currentManageIndex <= 0 ? activeColors.textMuted : activeColors.primary}
                  />
                  <Text
                    style={[
                      styles.reorderBtnText,
                      {
                        color: currentManageIndex <= 0
                          ? activeColors.textMuted
                          : activeColors.textPrimary,
                      },
                    ]}
                  >
                    Move Left
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  disabled={currentManageIndex < 0 || currentManageIndex >= currentManageTotal - 1}
                  onPress={handleMoveRight}
                  style={[
                    styles.reorderBtn,
                    {
                      backgroundColor: (currentManageIndex < 0 || currentManageIndex >= currentManageTotal - 1)
                        ? (isDarkMode ? '#1E293B' : '#F1F5F9')
                        : (isDarkMode ? '#334155' : '#FFFFFF'),
                      borderColor: (currentManageIndex < 0 || currentManageIndex >= currentManageTotal - 1)
                        ? 'transparent'
                        : activeColors.border,
                      opacity: (currentManageIndex < 0 || currentManageIndex >= currentManageTotal - 1) ? 0.45 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reorderBtnText,
                      {
                        color: (currentManageIndex < 0 || currentManageIndex >= currentManageTotal - 1)
                          ? activeColors.textMuted
                          : activeColors.textPrimary,
                      },
                    ]}
                  >
                    Move Right
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right-bold"
                    size={18}
                    color={(currentManageIndex < 0 || currentManageIndex >= currentManageTotal - 1) ? activeColors.textMuted : activeColors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Items */}
            <View style={{ gap: 10, marginBottom: 14 }}>
              {/* 1. Rename Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleTriggerManageRename}
                style={[
                  styles.sheetActionItem,
                  {
                    backgroundColor: isDarkMode
                      ? activeColors.surfaceElevated
                      : activeColors.surfaceSubtle,
                    borderColor: activeColors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: activeColors.primaryLight },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={20}
                    color={activeColors.primary}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[
                      styles.sheetActionTitle,
                      { color: activeColors.textPrimary },
                    ]}
                  >
                    Rename {manageTarget?.type === 'category' ? 'Category' : 'Section'}
                  </Text>
                  <Text
                    style={[
                      styles.sheetActionSub,
                      { color: activeColors.textMuted },
                    ]}
                  >
                    Change display name safely
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={activeColors.textMuted}
                />
              </TouchableOpacity>

              {/* 2. Delete Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleTriggerManageDelete}
                style={[
                  styles.sheetActionItem,
                  {
                    backgroundColor: isDarkMode ? '#450A0A33' : '#FEF2F2',
                    borderColor: isDarkMode ? '#7F1D1D' : '#FEE2E2',
                  },
                ]}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: isDarkMode ? '#7F1D1D' : '#FEE2E2' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={20}
                    color="#DC2626"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.sheetActionTitle, { color: '#DC2626' }]}>
                    Delete {manageTarget?.type === 'category' ? 'Category' : 'Section'}
                  </Text>
                  <Text
                    style={[
                      styles.sheetActionSub,
                      { color: isDarkMode ? '#FCA5A5' : '#991B1B' },
                    ]}
                  >
                    Remove and delete all contained items
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#DC2626"
                />
              </TouchableOpacity>
            </View>

            {/* Done / Close Button */}
            <TouchableOpacity
              onPress={() => setManageModalVisible(false)}
              style={[
                styles.sheetCancelBtn,
                {
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surfaceSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.sheetCancelText,
                  { color: activeColors.textSecondary },
                ]}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Rename Category or Section */}
      <Modal
        visible={manageRenameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManageRenameModalVisible(false)}
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
                  name="pencil-outline"
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
                  Rename {manageTarget?.type === 'category' ? 'Category' : 'Section'}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  Current: "{currentManageItemName}"
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
                  borderColor: activeColors.border,
                  color: activeColors.textPrimary,
                },
              ]}
              placeholder={`Enter new ${manageTarget?.type === 'category' ? 'category' : 'section'} name`}
              placeholderTextColor={activeColors.textMuted}
              value={manageRenameInput}
              onChangeText={setManageRenameInput}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirmManageRename}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setManageRenameModalVisible(false)}
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
                onPress={handleConfirmManageRename}
                disabled={!manageRenameInput.trim() || submittingManageRename}
                style={[
                  styles.btnConfirm,
                  {
                    backgroundColor: manageRenameInput.trim()
                      ? activeColors.primary
                      : activeColors.border,
                  },
                ]}
              >
                <Text style={styles.btnConfirmText}>
                  {submittingManageRename ? 'Saving...' : 'Save Name'}
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
    backgroundColor: '#000000',
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
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  addCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 4,
  },
  addCategoryPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
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
  emptyCategoriesWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCatTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyCatSub: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  emptyCatBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionSheetCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTypeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sheetTargetTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  reorderSection: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  reorderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reorderTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  positionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  reorderSubtitle: {
    fontSize: 11,
    marginBottom: 12,
  },
  reorderBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reorderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  reorderBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetActionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  sheetCancelBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
