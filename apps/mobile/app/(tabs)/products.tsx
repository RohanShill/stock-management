import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  useWindowDimensions,
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
  CrossSectionMatch,
} from '../../src/database/repositories/matrixRepository.js';
import { CategorySubTabs, HierarchyTier } from '../../src/components/CategorySubTabs.js';
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
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;

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
  const [activeRootSectionId, setActiveRootSectionId] = useState<string>('');
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string>('');
  const [breadcrumbPath, setBreadcrumbPath] = useState<Subcategory[]>([]);
  const [childSubcategories, setChildSubcategories] = useState<Subcategory[]>([]);
  const [level3Subcategories, setLevel3Subcategories] = useState<Subcategory[]>([]);
  const [hierarchyTiers, setHierarchyTiers] = useState<HierarchyTier[]>([]);

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

  // Category and Subcategory references to prevent race conditions and unnecessary re-triggers
  const isInitializedRef = useRef(false);
  const selectedCategoryIdRef = useRef(selectedCategoryId);
  selectedCategoryIdRef.current = selectedCategoryId;
  const activeSubcategoryIdRef = useRef(activeSubcategoryId);
  activeSubcategoryIdRef.current = activeSubcategoryId;

  // Quick Stock / Sell Modal State
  const [actionModalMode, setActionModalMode] = useState<'add' | 'sell' | null>(null);
  const [actionInitialFocus, setActionInitialFocus] = useState<'qty' | 'price'>('qty');
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

  // Direct Nested Subsection Add Modal (from Long Press or Action sheet)
  const [nestedAddTarget, setNestedAddTarget] = useState<{ id: string; name: string } | null>(null);
  const [nestedAddModalVisible, setNestedAddModalVisible] = useState(false);
  const [nestedAddName, setNestedAddName] = useState('');
  const [submittingNestedAdd, setSubmittingNestedAdd] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [crossSectionMatches, setCrossSectionMatches] = useState<CrossSectionMatch[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const runCrossSearch = async () => {
      const q = searchQuery.trim();
      if (!q || q.length < 2) {
        setCrossSectionMatches([]);
        return;
      }
      try {
        const storeId = store?.id || 'store-1';
        const matches = await MatrixRepository.searchCrossSections(
          storeId,
          q,
          activeSubcategoryId || undefined,
          selectedCategoryId || undefined
        );
        if (!isCancelled) {
          setCrossSectionMatches(matches);
        }
      } catch (err) {
        console.error('Error in cross-section search:', err);
      }
    };

    const timer = setTimeout(runCrossSearch, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, activeSubcategoryId, selectedCategoryId, store?.id]);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || categories[0] || null;
  }, [categories, selectedCategoryId]);

  const activeRootSection = useMemo(() => {
    return subcategories.find((s) => s.id === activeRootSectionId) || subcategories[0] || null;
  }, [subcategories, activeRootSectionId]);

  const activeSubcategory = useMemo(() => {
    if (breadcrumbPath.length > 0) {
      const leaf = breadcrumbPath[breadcrumbPath.length - 1];
      if (leaf.id === activeSubcategoryId) return leaf;
      const matchedInPath = breadcrumbPath.find((p) => p.id === activeSubcategoryId);
      if (matchedInPath) return matchedInPath;
    }
    if (activeSubcategoryId === activeRootSection?.id) {
      return activeRootSection;
    }
    return childSubcategories.find((s) => s.id === activeSubcategoryId) ||
           level3Subcategories.find((s) => s.id === activeSubcategoryId) ||
           activeRootSection;
  }, [breadcrumbPath, childSubcategories, level3Subcategories, activeSubcategoryId, activeRootSection]);

  const isViewingChildSubcategory = Boolean(
    activeSubcategory && activeRootSection && activeSubcategory.id !== activeRootSection.id
  );

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
   * Refreshes the full multi-tier hierarchy for any depth (Level 1, 2, 3, 4, 5+).
   * Automatically resolves breadcrumb path, fetches siblings at every depth,
   * and builds HierarchyTier[] so no section or nested sub-section ever vanishes.
   */
  const refreshHierarchy = useCallback(async (
    catId: string,
    targetSubId?: string
  ): Promise<{ tiers: HierarchyTier[]; path: Subcategory[]; effectiveSubId: string }> => {
    const storeId = store?.id || 'store-1';
    if (!catId) {
      setSubcategories([]);
      setActiveRootSectionId('');
      setActiveSubcategoryId('');
      setBreadcrumbPath([]);
      setChildSubcategories([]);
      setLevel3Subcategories([]);
      setHierarchyTiers([]);
      return { tiers: [], path: [], effectiveSubId: '' };
    }

    // 1. Fetch root sections for this category (parentId IS NULL)
    const roots = await MatrixRepository.ensureDefaultSubTabs(storeId, catId, '', deviceId, null);
    setSubcategories(roots);

    if (roots.length === 0) {
      setActiveRootSectionId('');
      setActiveSubcategoryId('');
      setBreadcrumbPath([]);
      setChildSubcategories([]);
      setLevel3Subcategories([]);
      setHierarchyTiers([]);
      return { tiers: [], path: [], effectiveSubId: '' };
    }

    // 2. Resolve breadcrumb path for targetSubId
    let path: Subcategory[] = [];
    if (targetSubId) {
      path = await MatrixRepository.getBreadcrumbPath(storeId, targetSubId);
      // Validate that this path belongs to the active category
      if (path.length > 0 && path[0].categoryId !== catId) {
        path = [];
      }
    }

    // Fallback if no valid path was found
    if (path.length === 0) {
      const defaultRoot = (targetSubId && roots.find((r) => r.id === targetSubId)) || roots[0];
      path = [defaultRoot];
    }

    const effectiveSubId = targetSubId && path.some((p) => p.id === targetSubId)
      ? targetSubId
      : path[path.length - 1].id;

    setActiveRootSectionId(path[0].id);
    setActiveSubcategoryId(effectiveSubId);
    setBreadcrumbPath(path);

    // 3. Build dynamic HierarchyTiers
    const tiers: HierarchyTier[] = [];

    // Tier 1: Root sections
    tiers.push({
      depth: 1,
      parent: null,
      items: roots,
      activeId: path[0]?.id || roots[0].id,
    });

    // Subsequent tiers along path (maximum 4 subsection levels: Depth 1 Root + Depths 2, 3, 4, 5)
    for (let i = 0; i < path.length; i++) {
      const parentNode = path[i];
      const tierDepth = i + 2;
      // Do not allow creating or showing tiers beyond Depth 5 (Level 1 Root + 4 Subsection levels)
      if (tierDepth > 5) break;

      const children = await MatrixRepository.ensureDefaultSubTabs(
        storeId,
        catId,
        '',
        deviceId,
        parentNode.id
      );
      const nextNodeInPath = path[i + 1];
      const tierActiveId = nextNodeInPath
        ? nextNodeInPath.id
        : (effectiveSubId === parentNode.id ? null : effectiveSubId);

      // Only show tier if it has children OR if this parentNode is active AND can have children (depth < 5)
      const canParentHaveChildren = (parentNode.depth ?? 1) < 5;
      if (children.length > 0 || (parentNode.id === effectiveSubId && canParentHaveChildren)) {
        tiers.push({
          depth: tierDepth,
          parent: parentNode,
          items: children,
          activeId: tierActiveId,
        });
      }
    }

    // Backwards-compatible state updates
    if (tiers[1]) setChildSubcategories(tiers[1].items);
    else setChildSubcategories([]);
    if (tiers[2]) setLevel3Subcategories(tiers[2].items);
    else setLevel3Subcategories([]);

    setHierarchyTiers(tiers);
    return { tiers, path, effectiveSubId };
  }, [store?.id, deviceId]);

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
      setHierarchyTiers([]);
      setMatrixData({ brands: [], sizes: [], cells: {} });
      setSelectedCell(null);
      setSelectedCellKey(null);
      setSelectedSize('');
      setSelectedBrand('');

      const { effectiveSubId } = await refreshHierarchy(catId, preferredSubcatId);
      if (effectiveSubId) {
        await loadMatrix(catId, effectiveSubId);
      } else {
        setLoading(false);
      }
    } catch (e: any) {
      console.error('Error switching category:', e);
      setLoading(false);
      showToast(e?.message || 'Error switching category', 'error');
    }
  }, [loadMatrix, refreshHierarchy, showToast]);

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
          if (routerParams?.action === 'add') {
            setNewCatModalVisible(true);
          }
        } else {
          setLoading(false);
          if (routerParams?.action === 'add') {
            setNewCatModalVisible(true);
          }
        }
      } catch (e) {
        console.error('Error initializing products screen:', e);
        if (isMounted) setLoading(false);
      } finally {
        isInitializedRef.current = true;
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Keep screen in sync when returning from other tabs (e.g. if restocked on Home or sale in History)
   * Prevents race conditions and double-triggers on category clicks.
   */
  useFocusEffect(
    useCallback(() => {
      // If it's the initial screen mount, init() handles it cleanly
      if (!isInitializedRef.current) {
        return;
      }

      let isMounted = true;
      const syncOnFocus = async () => {
        try {
          const storeId = store?.id || 'store-1';
          const freshCats = await ProductRepository.getCategories(storeId);
          if (!isMounted) return;
          setCategories(freshCats);

          if (freshCats && freshCats.length > 0) {
            const currentCatId = selectedCategoryIdRef.current && freshCats.some((c) => c.id === selectedCategoryIdRef.current)
              ? selectedCategoryIdRef.current
              : freshCats[0].id;

            if (currentCatId !== selectedCategoryIdRef.current) {
              setSelectedCategoryId(currentCatId);
            }

            const { effectiveSubId } = await refreshHierarchy(currentCatId, activeSubcategoryIdRef.current);
            if (effectiveSubId && isMounted) {
              await loadMatrix(currentCatId, effectiveSubId, undefined, undefined, true);
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
    }, [store?.id, refreshHierarchy, loadMatrix])
  );

  /**
   * Handle selecting a Root Section (Level 1)
   */
  const handleSelectRootSection = async (sectionId: string) => {
    try {
      setLoading(true);
      const { effectiveSubId } = await refreshHierarchy(selectedCategoryId, sectionId);
      await loadMatrix(selectedCategoryId, effectiveSubId || sectionId);
    } catch (e: any) {
      console.error('Error selecting root section:', e);
      showToast('Could not open section', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle selecting a Sub-section (Level 2, 3, 4, etc.)
   */
  const handleSelectSubcategory = async (subcatId: string) => {
    try {
      setLoading(true);
      const { effectiveSubId } = await refreshHierarchy(selectedCategoryId, subcatId);
      await loadMatrix(selectedCategoryId, effectiveSubId || subcatId);
    } catch (e: any) {
      console.error('Error switching subcategory:', e);
      showToast('Could not switch subsection', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Quick jump to an item found in another section via search
   */
  const handleSelectCrossSectionMatch = useCallback(async (match: CrossSectionMatch) => {
    try {
      setLoading(true);
      setSearchQuery('');
      if (match.categoryId && match.categoryId !== selectedCategoryId) {
        setSelectedCategoryId(match.categoryId);
        const { effectiveSubId } = await refreshHierarchy(match.categoryId, match.subcategoryId);
        await loadMatrix(match.categoryId, effectiveSubId || match.subcategoryId, match.size, match.brand);
      } else {
        const { effectiveSubId } = await refreshHierarchy(selectedCategoryId, match.subcategoryId);
        await loadMatrix(selectedCategoryId, effectiveSubId || match.subcategoryId, match.size, match.brand);
      }
    } catch (e: any) {
      console.error('Error selecting cross-section match:', e);
      showToast('Could not open section', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId, refreshHierarchy, loadMatrix, showToast]);

  /**
   * Add a custom sub-tab / sub-section dynamically at any arbitrary depth
   */
  const handleAddSubTab = async (
    tabName: string,
    parentId?: string | null,
    isChild: boolean = true
  ) => {
    try {
      setLoading(true);
      const storeId = store?.id || 'store-1';
      const cleanTabName = tabName.trim().toUpperCase();
      const effectiveParentId = isChild && parentId ? parentId.trim() : null;

      const created = await MatrixRepository.addSubTab(
        storeId,
        selectedCategoryId,
        cleanTabName,
        deviceId,
        effectiveParentId
      );

      const { effectiveSubId } = await refreshHierarchy(selectedCategoryId, created.id);
      await loadMatrix(selectedCategoryId, effectiveSubId || created.id);
      showToast(
        effectiveParentId ? `Sub-section "${cleanTabName}" created!` : `Section "${cleanTabName}" added!`,
        'success'
      );
    } catch (e: any) {
      console.error('Error adding sub-tab:', e);
      showToast(e?.message || 'Could not add section', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a Sub-Tab dynamically
   */
  const handleDeleteSubTab = async (subcatId: string) => {
    try {
      setLoading(true);
      const storeId = store?.id || 'store-1';
      await MatrixRepository.deleteSubTab(storeId, subcatId, deviceId);
      const fallbackTarget = activeSubcategoryId === subcatId ? undefined : activeSubcategoryId;
      const { effectiveSubId } = await refreshHierarchy(selectedCategoryId, fallbackTarget);
      if (effectiveSubId) {
        await loadMatrix(selectedCategoryId, effectiveSubId);
      } else {
        setMatrixData({ brands: [], sizes: [], cells: {} });
      }
      showToast('Section removed', 'info');
    } catch (e) {
      console.error('Error removing section:', e);
      showToast('Could not remove section', 'error');
    } finally {
      setLoading(false);
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
    setActionInitialFocus('qty');
    setActionQty('');
    setActionNote('');
    const customDisplay = selectedCell?.priceDisplay ? selectedCell.priceDisplay.trim() : '';
    if (customDisplay) {
      setActionPriceRs(customDisplay);
    } else if (selectedCell?.sellingPricePaise) {
      setActionPriceRs((selectedCell.sellingPricePaise / 100).toString());
    } else if (selectedCell?.purchasePricePaise) {
      setActionPriceRs((selectedCell.purchasePricePaise / 100).toString());
    } else {
      setActionPriceRs('');
    }
  }, [selectedSize, selectedBrand, selectedCell]);

  /**
   * Open Price Setup Modal directly (e.g. from "+ Price" / price pill click)
   */
  const handleOpenPrice = useCallback(() => {
    if (!selectedSize || !selectedBrand) return;
    setActionModalMode('add');
    setActionInitialFocus('price');
    setActionQty('');
    setActionNote('');
    const customDisplay = selectedCell?.priceDisplay ? selectedCell.priceDisplay.trim() : '';
    if (customDisplay) {
      setActionPriceRs(customDisplay);
    } else if (selectedCell?.sellingPricePaise) {
      setActionPriceRs((selectedCell.sellingPricePaise / 100).toString());
    } else if (selectedCell?.purchasePricePaise) {
      setActionPriceRs((selectedCell.purchasePricePaise / 100).toString());
    } else {
      setActionPriceRs('');
    }
  }, [selectedSize, selectedBrand, selectedCell]);

  /**
   * Open Sell Modal
   */
  const handleOpenSell = useCallback(() => {
    if (!selectedSize || !selectedBrand) return;
    setActionModalMode('sell');
    setActionInitialFocus('qty');
    setActionQty('');
    setActionNote('');
    const customDisplay = selectedCell?.priceDisplay ? selectedCell.priceDisplay.trim() : '';
    if (customDisplay) {
      setActionPriceRs(customDisplay);
    } else if (selectedCell?.sellingPricePaise) {
      setActionPriceRs((selectedCell.sellingPricePaise / 100).toString());
    } else {
      setActionPriceRs('');
    }
  }, [selectedSize, selectedBrand, selectedCell]);

  /**
   * Confirm Stock Adjustment (Stock In or Sell)
   */
  const handleConfirmStockAction = async () => {
    if (!actionModalMode || submittingAction) return;
    const numQty = parseFloat(actionQty);
    const hasValidQty = !isNaN(numQty) && numQty > 0;
    const rawPriceStr = actionPriceRs.trim();
    const hasPrice = Boolean(rawPriceStr);

    if (actionModalMode === 'sell') {
      if (!hasValidQty) {
        showToast('Please enter quantity to sell', 'warning');
        return;
      }
      const currentStock = selectedCell ? selectedCell.currentStock : 0;
      if (numQty > currentStock) {
        showToast(`Not enough stock. Available: ${currentStock}`, 'warning');
        return;
      }
    } else {
      // In Stock In / Add mode, allow updating quantity, price, or both
      if (!hasValidQty && !hasPrice) {
        showToast('Please enter quantity or price', 'warning');
        return;
      }
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

      // 1. Adjust stock only if a valid quantity (> 0) was entered
      if (hasValidQty) {
        const reason = actionModalMode === 'sell'
          ? (actionNote.trim() || 'Sale')
          : (actionNote.trim() || 'Stock In');

        const cellUnit = (selectedCell?.unit as any) || 'piece';
        await InventoryRepository.adjustStock(
          variantId,
          numQty,
          cellUnit,
          actionModalMode === 'sell' ? 'sale' : 'increase',
          reason,
          storeId,
          deviceId
        );
      }

      // 2. Save custom price if updated by user (supports custom text like "50 per pics", "50 per litter")
      if (hasPrice) {
        let paise = 0;
        const numMatch = rawPriceStr.match(/(\d+(?:\.\d+)?)/);
        if (numMatch) {
          paise = Math.round(parseFloat(numMatch[1]) * 100);
        }
        await MatrixRepository.updateVariantPrice(
          variantId,
          'sell',
          paise,
          storeId,
          deviceId,
          rawPriceStr
        );
      }

      setActionModalMode(null);
      await loadMatrix(selectedCategoryId, activeSubcategoryId, selectedSize, selectedBrand);

      // Feedback Toast
      const displayUnit = selectedCell?.unit || 'pc';
      if (hasValidQty && hasPrice) {
        showToast(
          actionModalMode === 'sell'
            ? `Sold ${numQty} ${displayUnit} & updated price!`
            : `Added +${numQty} ${displayUnit} & updated price!`,
          'success'
        );
      } else if (hasValidQty) {
        showToast(
          actionModalMode === 'sell'
            ? `Sold ${numQty} ${displayUnit} successfully!`
            : `Added +${numQty} ${displayUnit} to stock!`,
          'success'
        );
      } else {
        showToast(`Updated price to "${rawPriceStr}"!`, 'success');
      }
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
      const idx = subcategories.findIndex((s) => s.id === manageTarget.item.id);
      if (idx !== -1) return idx;
      return childSubcategories.findIndex((s) => s.id === manageTarget.item.id);
    }
  }, [manageTarget, categories, subcategories, childSubcategories]);

  const currentManageTotal = useMemo(() => {
    if (!manageTarget) return 0;
    if (manageTarget.type === 'category') {
      return categories.length;
    } else {
      const inSubs = subcategories.some((s) => s.id === manageTarget.item.id);
      return inSubs ? subcategories.length : childSubcategories.length;
    }
  }, [manageTarget, categories, subcategories, childSubcategories]);

  const currentManageItemName = useMemo(() => {
    if (!manageTarget) return '';
    if (manageTarget.type === 'category') {
      const found = categories.find((c) => c.id === manageTarget.item.id);
      return found?.name || manageTarget.item.name;
    } else {
      const found = subcategories.find((s) => s.id === manageTarget.item.id) ||
                    childSubcategories.find((s) => s.id === manageTarget.item.id);
      return found?.name || manageTarget.item.name;
    }
  }, [manageTarget, categories, subcategories, childSubcategories]);

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
      const isRootSub = subcategories.some((s) => s.id === manageTarget.item.id);
      if (isRootSub) {
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
      } else {
        const nextList = [...childSubcategories];
        const temp = nextList[idx];
        nextList[idx] = nextList[idx - 1];
        nextList[idx - 1] = temp;

        const ordered = nextList.map((s, i) => ({ ...s, displayOrder: i }));
        setChildSubcategories(ordered);

        try {
          await CategoryRepository.reorderSubcategories(
            ordered.map((s) => ({ id: s.id, displayOrder: s.displayOrder })),
            storeId,
            deviceId
          );
        } catch (e) {
          console.error('Failed to reorder sub-sections:', e);
          showToast('Could not save sub-section order', 'error');
        }
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
      const isRootSub = subcategories.some((s) => s.id === manageTarget.item.id);
      if (isRootSub) {
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
      } else {
        const nextList = [...childSubcategories];
        const temp = nextList[idx];
        nextList[idx] = nextList[idx + 1];
        nextList[idx + 1] = temp;

        const ordered = nextList.map((s, i) => ({ ...s, displayOrder: i }));
        setChildSubcategories(ordered);

        try {
          await CategoryRepository.reorderSubcategories(
            ordered.map((s) => ({ id: s.id, displayOrder: s.displayOrder })),
            storeId,
            deviceId
          );
        } catch (e) {
          console.error('Failed to reorder sub-sections:', e);
          showToast('Could not save sub-section order', 'error');
        }
      }
    }
  };

  const handleTriggerManageRename = () => {
    if (!manageTarget) return;
    setManageRenameInput(
      manageTarget.type === 'section'
        ? currentManageItemName.toUpperCase()
        : currentManageItemName
    );
    setManageModalVisible(false);
    setTimeout(() => {
      setManageRenameModalVisible(true);
    }, 150);
  };

  const handleConfirmManageRename = async () => {
    if (!manageTarget || submittingManageRename) return;
    const rawClean = manageRenameInput.trim();
    if (!rawClean) {
      showToast('Name cannot be empty', 'warning');
      return;
    }
    const { type, item } = manageTarget;
    const clean = type === 'section' ? rawClean.toUpperCase() : rawClean;
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
        await refreshHierarchy(selectedCategoryId, activeSubcategoryId);
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
                setSelectedCell(null);
                setSelectedCellKey(null);
                setSelectedSize('');
                setSelectedBrand('');
              }
            }
            showToast(`Category "${item.name}" deleted`, 'info');
          } else {
            await MatrixRepository.deleteSubTab(storeId, item.id, deviceId);
            const fallbackTarget = activeSubcategoryId === item.id ? undefined : activeSubcategoryId;
            const { effectiveSubId } = await refreshHierarchy(selectedCategoryId, fallbackTarget);
            if (effectiveSubId) {
              await loadMatrix(selectedCategoryId, effectiveSubId);
            } else {
              setMatrixData({ brands: [], sizes: [], cells: {} });
              setSelectedCell(null);
              setSelectedCellKey(null);
              setSelectedSize('');
              setSelectedBrand('');
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

  // Filtered matrix based on intelligent multi-word token search
  const filteredMatrix = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();
    if (!rawQuery) return matrixData;

    const tokens = rawQuery.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return matrixData;

    const catName = (activeCategory?.name || '').trim().toLowerCase();
    const subName = (activeSubcategory?.name || '').trim().toLowerCase();
    const catSubText = `${catName} ${subName}`.trim();

    // Check if query is entirely part of the category or subcategory name (e.g. "paint" or "wall")
    const allTokensInCatSub = tokens.every((token) => catSubText.includes(token));

    const matchingSizes = new Set<string>();
    const matchingBrands = new Set<string>();

    // 1. If brands exist, check cell-level and brand/size combinations
    if (matrixData.brands.length > 0) {
      for (const size of matrixData.sizes) {
        for (const brand of matrixData.brands) {
          const cleanSize = size.trim();
          const cleanBrand = brand.trim();
          const cellKey = `${cleanSize}___${cleanBrand.toLowerCase()}`;
          const cell = matrixData.cells[cellKey];

          let priceTokens = '';
          if (cell?.priceDisplay) {
            priceTokens += ` ${cell.priceDisplay}`;
          }
          if (cell?.sellingPricePaise && cell.sellingPricePaise > 0) {
            const rupees = cell.sellingPricePaise / 100;
            priceTokens += ` ₹${rupees} ${rupees}`;
          }
          const stockStr = cell ? ` ${cell.currentStock}` : '';

          // Include category name and subcategory name so searching "paint" or "wall paint 10L" works seamlessly!
          const combinedText = `${catName} ${subName} ${cleanSize} ${cleanBrand}${priceTokens}${stockStr}`.toLowerCase();

          // Cell matches if EVERY token appears somewhere in the combined size/brand/price/stock
          if (tokens.every((token) => combinedText.includes(token))) {
            matchingSizes.add(size);
            matchingBrands.add(brand);
          }
        }
      }
    } else {
      // 2. Unbranded categories (only sizes)
      for (const size of matrixData.sizes) {
        const cleanSize = size.trim().toLowerCase();
        const combinedText = `${catName} ${subName} ${cleanSize}`.toLowerCase();
        if (tokens.every((token) => combinedText.includes(token))) {
          matchingSizes.add(size);
        }
      }
    }

    // 3. Fallback: check sizes and brands individually if no direct cell combination matched
    if (matchingSizes.size === 0 && matchingBrands.size === 0) {
      if (allTokensInCatSub) {
        // If the query was the category or subcategory name itself (e.g. "paint"), show all items in the matrix!
        return matrixData;
      }

      const sizeMatches = matrixData.sizes.filter((s) =>
        tokens.every((token) => `${catName} ${subName} ${s.toLowerCase()}`.includes(token))
      );
      const brandMatches = matrixData.brands.filter((b) =>
        tokens.every((token) => `${catName} ${subName} ${b.toLowerCase()}`.includes(token))
      );

      if (sizeMatches.length > 0 || brandMatches.length > 0) {
        return {
          brands: brandMatches.length > 0 ? brandMatches : matrixData.brands,
          sizes: sizeMatches.length > 0 ? sizeMatches : matrixData.sizes,
          cells: matrixData.cells,
        };
      }

      // No matches at all for this query
      return {
        brands: [],
        sizes: [],
        cells: matrixData.cells,
      };
    }

    return {
      brands: matrixData.brands.filter((b) => matchingBrands.has(b)),
      sizes: matrixData.sizes.filter((s) => matchingSizes.has(s)),
      cells: matrixData.cells,
    };
  }, [matrixData, searchQuery, activeCategory?.name, activeSubcategory?.name]);

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
            paddingHorizontal: isTablet ? 20 : 16,
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
                {
                  fontSize: isTablet ? 18 : 16,
                  color: activeColors.textPrimary,
                },
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
                    paddingHorizontal: isTablet ? 18 : 14,
                    paddingVertical: isTablet ? 9 : 7,
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
                      fontSize: isTablet ? 14 : 13,
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
                paddingHorizontal: isTablet ? 16 : 12,
                paddingVertical: isTablet ? 9 : 7,
                backgroundColor: isDarkMode
                  ? activeColors.surfaceElevated
                  : activeColors.surface,
                borderColor: activeColors.primaryBorder || activeColors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="plus"
              size={isTablet ? 18 : 16}
              color={activeColors.primary}
            />
            <Text
              style={[
                styles.addCategoryPillText,
                {
                  fontSize: isTablet ? 13 : 12,
                  color: activeColors.primary,
                },
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
          {/* 2. Sub-Tabs Bar: Multi-Tier Navigator (Root Sections & Sub-sections) */}
          <CategorySubTabs
            categoryName={activeCategory?.name || 'Category'}
            hierarchyTiers={hierarchyTiers}
            subcategories={subcategories}
            activeRootSectionId={activeRootSectionId}
            activeSubcategoryId={activeSubcategoryId}
            breadcrumbPath={breadcrumbPath}
            childSubcategories={childSubcategories}
            level3Subcategories={level3Subcategories}
            onSelectRootSection={handleSelectRootSection}
            onSelectSubcategory={handleSelectSubcategory}
            onAddSubTab={handleAddSubTab}
            onLongPressSubcategory={(sub) => handleOpenManageModal('section', sub)}
            isDarkMode={isDarkMode}
            activeColors={activeColors}
          />

          {/* 3. Search Filter Bar (Optional quick lookup) */}
          <View style={[styles.searchWrap, { paddingHorizontal: isTablet ? 20 : 16 }]}>
            <Searchbar
              placeholder={`Search ${activeCategory?.name || 'items'} by size, brand, price...`}
              onChangeText={setSearchQuery}
              value={searchQuery}
              onClearIconPress={() => setSearchQuery('')}
              style={[
                styles.searchbar,
                {
                  height: isTablet ? 42 : 36,
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surfaceSubtle,
                },
              ]}
              inputStyle={{
                fontSize: isTablet ? 14 : 13,
                color: activeColors.textPrimary,
                minHeight: isTablet ? 40 : 36,
              }}
              placeholderTextColor={activeColors.textMuted}
              iconColor={activeColors.textSecondary}
            />
          </View>

          {/* 3.1 Compact Scope Indicator (Zero wasted screen space) */}
          {activeSubcategory && (
            <View style={[styles.scopeWrap, { paddingHorizontal: isTablet ? 20 : 16 }]}>
              <View style={styles.scopeLeft}>
                <MaterialCommunityIcons
                  name={breadcrumbPath.length > 1 ? 'folder-outline' : 'table-large'}
                  size={isTablet ? 16 : 14}
                  color={activeColors.primary}
                />
                <Text style={[styles.scopeLabel, { fontSize: isTablet ? 12.5 : 11, color: activeColors.textSecondary }]}>
                  Matrix:{' '}
                  <Text style={[styles.scopeTarget, { color: activeColors.primary }]}>
                    {activeSubcategory.name}
                  </Text>
                </Text>
                {breadcrumbPath.length > 1 && (
                  <View
                    style={[
                      styles.subBadgeCompact,
                      {
                        backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF',
                        borderColor: isDarkMode ? '#4338CA' : '#C7D2FE',
                      },
                    ]}
                  >
                    <Text style={[styles.subBadgeTextCompact, { fontSize: isTablet ? 11 : 10, color: activeColors.primary }]}>
                      Level {breadcrumbPath.length}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.scopeCounts, { fontSize: isTablet ? 12.5 : 11, color: activeColors.textMuted }]}>
                {matrixData.brands.length} Brands • {matrixData.sizes.length} Sizes
              </Text>
            </View>
          )}

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
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
                crossSectionMatches={crossSectionMatches}
                onSelectCrossSectionMatch={handleSelectCrossSectionMatch}
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
              onPricePress={handleOpenPrice}
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
                        : actionInitialFocus === 'price'
                        ? isDarkMode
                          ? '#1E1B4B'
                          : '#EEF2FF'
                        : isDarkMode
                        ? '#064E3B'
                        : '#DCFCE7',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    actionModalMode === 'sell'
                      ? 'arrow-up-bold'
                      : actionInitialFocus === 'price'
                      ? 'tag-outline'
                      : 'arrow-down-bold'
                  }
                  size={24}
                  color={
                    actionModalMode === 'sell'
                      ? '#DC2626'
                      : actionInitialFocus === 'price'
                      ? '#4F46E5'
                      : '#059669'
                  }
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color:
                        actionModalMode === 'sell'
                          ? '#DC2626'
                          : actionInitialFocus === 'price'
                          ? '#4F46E5'
                          : '#059669',
                    },
                  ]}
                >
                  {actionModalMode === 'sell'
                    ? 'Sell Item (Stock Out)'
                    : actionInitialFocus === 'price'
                    ? 'Update Price / Rate'
                    : 'Stock In (Add Inventory)'}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  {actionModalMode === 'sell'
                    ? 'Deduct stock on sale'
                    : actionInitialFocus === 'price'
                    ? 'Set selling price or rate for this item'
                    : 'Add inventory to stock'}
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
                  {selectedCell ? selectedCell.currentStock : 0} {selectedCell?.unit || 'pcs'}
                </Text>
              </Text>
            </View>

            <Text
              style={[
                styles.inputLabel,
                { color: activeColors.textPrimary },
              ]}
            >
              {actionModalMode === 'sell'
                ? `Quantity to Sell (${selectedCell?.unit || 'pcs'}):`
                : `Quantity to Add (${selectedCell?.unit || 'pcs'}):`}
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
                    parseFloat(actionQty || '0') > (selectedCell?.currentStock || 0)
                      ? '#DC2626'
                      : activeColors.border,
                },
              ]}
              keyboardType="numeric"
              placeholder={actionModalMode === 'sell' ? '0' : '0 (optional if only setting price)'}
              placeholderTextColor={activeColors.textMuted}
              value={actionQty}
              onChangeText={setActionQty}
              autoFocus={actionInitialFocus === 'qty'}
            />

            {actionModalMode === 'sell' &&
              parseFloat(actionQty || '0') > (selectedCell?.currentStock || 0) && (
                <Text style={styles.stockWarningText}>
                  ⚠️ Quantity exceeds available stock ({selectedCell?.currentStock || 0} {selectedCell?.unit || 'pcs'})
                </Text>
              )}

            {/* Price / Rate Input (Placed directly between Quantity and Note as requested) */}
            <Text
              style={[
                styles.inputLabel,
                { color: activeColors.textPrimary, marginTop: 10 },
              ]}
            >
              {actionModalMode === 'sell' ? 'Selling Price (₹):' : 'Price / Rate (₹):'}
            </Text>
            <TextInput
              style={[
                styles.actionInput,
                {
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surfaceSubtle,
                  color: activeColors.textPrimary,
                  borderColor: activeColors.border,
                },
              ]}
              keyboardType="default"
              placeholder="e.g. 50 per pics, 120 per litter"
              placeholderTextColor={activeColors.textMuted}
              value={actionPriceRs}
              onChangeText={setActionPriceRs}
              autoFocus={actionInitialFocus === 'price'}
            />

            {actionModalMode === 'sell' &&
              parseFloat(actionQty || '0') > 0 &&
              parseFloat(actionPriceRs.match(/(\d+(?:\.\d+)?)/)?.[1] || '0') > 0 && (
              <View
                style={[
                  styles.totalAmountBanner,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                    borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                  },
                ]}
              >
                <Text style={[styles.totalAmountLabel, { color: activeColors.textSecondary }]}>
                  Total Sale Amount:
                </Text>
                <Text style={[styles.totalAmountValue, { color: activeColors.primary }]}>
                  ₹{(
                    parseFloat(actionQty || '0') *
                    parseFloat(actionPriceRs.match(/(\d+(?:\.\d+)?)/)?.[1] || '0')
                  ).toFixed(2)}
                </Text>
              </View>
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

            <View style={[styles.modalActions, { marginTop: 20 }]}>
              <TouchableOpacity
                onPress={() => setActionModalMode(null)}
                activeOpacity={0.7}
                style={[
                  styles.btnCancel,
                  {
                    borderColor: activeColors.border,
                    backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#FFFFFF',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.btnCancelText,
                    { color: activeColors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              {(() => {
                const numQty = parseFloat(actionQty);
                const hasValidQty = !isNaN(numQty) && numQty > 0;
                const hasPrice = Boolean(actionPriceRs.trim());
                const isSell = actionModalMode === 'sell';
                const currentStock = selectedCell?.currentStock || 0;

                const isExceedingStock = isSell && hasValidQty && numQty > currentStock;
                const isFormValid = isSell ? (hasValidQty && !isExceedingStock) : (hasValidQty || hasPrice);
                const isDisabled = submittingAction || !isFormValid;

                let btnLabel = isSell ? 'Confirm Sell' : 'Confirm Stock';
                if (submittingAction) {
                  btnLabel = 'Saving...';
                } else if (!hasValidQty && hasPrice) {
                  btnLabel = 'Save Price';
                } else if (isSell) {
                  btnLabel = 'Confirm Sell';
                } else {
                  btnLabel = 'Confirm Stock';
                }

                return (
                  <TouchableOpacity
                    onPress={handleConfirmStockAction}
                    disabled={isDisabled}
                    activeOpacity={0.8}
                    style={[
                      styles.btnConfirm,
                      {
                        backgroundColor: isDisabled
                          ? (isDarkMode ? '#334155' : '#E2E8F0')
                          : isSell
                          ? '#DC2626'
                          : !hasValidQty && hasPrice
                          ? '#4F46E5'
                          : '#059669',
                      },
                    ]}
                  >
                    <View style={styles.btnConfirmInner}>
                      {!submittingAction && (
                        <MaterialCommunityIcons
                          name={isSell ? 'cart-arrow-right' : (!hasValidQty && hasPrice ? 'tag-check' : 'check-circle')}
                          size={18}
                          color={isDisabled ? activeColors.textMuted : '#FFFFFF'}
                        />
                      )}
                      <Text
                        style={[
                          styles.btnConfirmText,
                          isDisabled && { color: activeColors.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {btnLabel}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })()}
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

              {/* 1.5 Add Sub-section Option (Available if less than max 4 subsections: depth < 5) */}
              {manageTarget?.type === 'section' && ((manageTarget.item as Subcategory).depth ?? 1) < 5 && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    const targetItem = manageTarget.item as Subcategory;
                    setManageModalVisible(false);
                    setTimeout(() => {
                      setNestedAddTarget({ id: targetItem.id, name: targetItem.name });
                      setNestedAddName('');
                      setNestedAddModalVisible(true);
                    }, 150);
                  }}
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
                      { backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="folder-plus-outline"
                      size={20}
                      color={activeColors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[
                        styles.sheetActionTitle,
                        { color: activeColors.primary },
                      ]}
                    >
                      + Add Sub-section inside "{currentManageItemName}"
                    </Text>
                    <Text
                      style={[
                        styles.sheetActionSub,
                        { color: activeColors.textMuted },
                      ]}
                    >
                      Create a nested subsection under this item
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={activeColors.primary}
                  />
                </TouchableOpacity>
              )}

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
              autoCapitalize={manageTarget?.type === 'section' ? 'characters' : 'words'}
              onChangeText={(text) =>
                setManageRenameInput(manageTarget?.type === 'section' ? text.toUpperCase() : text)
              }
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

      {/* Modal: Add Sub-section inside specific parent */}
      <Modal
        visible={nestedAddModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNestedAddModalVisible(false)}
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
                  name="folder-plus-outline"
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
                  Add Sub-section inside "{nestedAddTarget?.name}"
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  Enter name for this new nested subsection
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
              placeholder="Enter sub-section name..."
              placeholderTextColor={activeColors.textMuted}
              value={nestedAddName}
              autoCapitalize="characters"
              onChangeText={(text) => setNestedAddName(text.toUpperCase())}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={async () => {
                const clean = nestedAddName.trim().toUpperCase();
                if (!clean || !nestedAddTarget || submittingNestedAdd) return;
                try {
                  setSubmittingNestedAdd(true);
                  await handleAddSubTab(clean, nestedAddTarget.id, true);
                  setNestedAddModalVisible(false);
                  setNestedAddName('');
                } finally {
                  setSubmittingNestedAdd(false);
                }
              }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setNestedAddModalVisible(false)}
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
                onPress={async () => {
                  const clean = nestedAddName.trim().toUpperCase();
                  if (!clean || !nestedAddTarget || submittingNestedAdd) return;
                  try {
                    setSubmittingNestedAdd(true);
                    await handleAddSubTab(clean, nestedAddTarget.id, true);
                    setNestedAddModalVisible(false);
                    setNestedAddName('');
                  } finally {
                    setSubmittingNestedAdd(false);
                  }
                }}
                disabled={!nestedAddName.trim() || submittingNestedAdd}
                style={[
                  styles.btnConfirm,
                  {
                    backgroundColor: nestedAddName.trim()
                      ? activeColors.primary
                      : activeColors.border,
                  },
                ]}
              >
                <Text style={styles.btnConfirmText}>
                  {submittingNestedAdd ? 'Creating...' : '+ Create'}
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
    paddingHorizontal: 16,
    paddingTop: 3,
    paddingBottom: 2,
  },
  searchbar: {
    height: 36,
    borderRadius: borderRadius.md,
  },
  scopeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 3,
  },
  scopeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scopeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  scopeTarget: {
    fontWeight: '800',
  },
  subBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 4,
  },
  subBadgeTextCompact: {
    fontSize: 10,
    fontWeight: '700',
  },
  scopeCounts: {
    fontSize: 11,
    fontWeight: '500',
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
  totalAmountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  totalAmountLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  totalAmountValue: {
    fontSize: 16,
    fontWeight: '800',
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
    maxWidth: 460,
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
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnConfirm: {
    flex: 1.4,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  btnConfirmInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
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
    maxWidth: 500,
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
