import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Platform,
} from 'react-native';
import {
  Text,
  Searchbar,
  Portal,
  Dialog,
  TextInput,
  Chip,
  IconButton,
  Surface,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  Product,
  ProductVariant,
  Category,
  Subcategory,
  MeasurementType,
  StandardUnit,
  formatPaiseToINR,
  rupeeToPaise,
  paiseToRupee,
  generateSku,
} from '@hardware-store/shared';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import { CategoryRepository } from '../../src/database/repositories/categoryRepository.js';
import { useAppStore } from '../../src/store/useAppStore.js';
import { lightColors, darkColors, colors, spacing, borderRadius, shadows, getThemeShadows } from '../../src/theme/tokens.js';

interface VariantFormItem {
  id?: string;
  name: string;
  size: string;
  sellingPriceRs?: string;
  costPriceRs?: string;
  openingStock: string;
  currentStock?: number;
  minStockLevel: string;
  rackLocation: string;
}

const UNIT_OPTIONS: Array<{ value: StandardUnit; label: string }> = [
  { value: 'piece', label: 'Piece' },
  { value: 'm', label: 'Meter' },
  { value: 'box', label: 'Box' },
  { value: 'kg', label: 'Kg' },
  { value: 'l', label: 'Liter' },
  { value: 'set', label: 'Set' },
];

function mapUnitToMeasurementType(unit: StandardUnit): MeasurementType {
  if (unit === 'm' || unit === 'mm' || unit === 'cm' || unit === 'ft' || unit === 'inch') return 'length';
  if (unit === 'kg' || unit === 'g') return 'weight';
  if (unit === 'l' || unit === 'ml') return 'volume';
  return 'count';
}

export default function ProductsScreen() {
  const router = useRouter();
  const routerParams = useLocalSearchParams<{
    categoryId?: string;
    filter?: 'all' | 'in' | 'low' | 'out';
    action?: string;
  }>();

  const { store, deviceId, isDarkMode } = useAppStore();
  const activeColors = isDarkMode ? darkColors : lightColors;
  const themeShadows = getThemeShadows(isDarkMode);

  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  const [products, setProducts] = useState<Array<Product & { variants: ProductVariant[] }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [loading, setLoading] = useState(false);

  // Form Modal State (Add / Edit)
  const [formVisible, setFormVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<(Product & { variants: ProductVariant[] }) | null>(null);
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formSubcategoryId, setFormSubcategoryId] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBaseUnit, setFormBaseUnit] = useState<StandardUnit>('piece');
  const [formVariants, setFormVariants] = useState<VariantFormItem[]>([
    {
      name: 'Standard',
      size: 'Standard',
      openingStock: '10',
      minStockLevel: '5',
      rackLocation: '',
    },
  ]);
  const [savingProduct, setSavingProduct] = useState(false);

  // Quick Restock Dialog State
  const [quickStockTarget, setQuickStockTarget] = useState<{
    productId: string;
    productName: string;
    variant: ProductVariant;
    unit: string;
  } | null>(null);
  const [quickStockMode, setQuickStockMode] = useState<'add' | 'sell'>('add');
  const [quickStockQty, setQuickStockQty] = useState('10');
  const [quickStockNote, setQuickStockNote] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);

  // New Category Dialog
  const [newCatDialogVisible, setNewCatDialogVisible] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // New Subcategory Dialog
  const [newSubcatDialogVisible, setNewSubcatDialogVisible] = useState(false);
  const [newSubcatName, setNewSubcatName] = useState('');
  const [creatingSubcat, setCreatingSubcat] = useState(false);

  // Delete Product Confirmation Dialog
  const [deleteConfirmProd, setDeleteConfirmProd] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const storeId = store?.id || 'store-1';
      const [prods, cats, subcats] = await Promise.all([
        ProductRepository.getProductsWithVariants(storeId),
        ProductRepository.getCategories(storeId),
        CategoryRepository.getSubcategories(undefined, storeId),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSubcategories(subcats);

      if (cats.length > 0 && !formCategoryId) {
        setFormCategoryId(cats[0].id);
        const firstCatSubcats = subcats.filter((s) => s.categoryId === cats[0].id && s.active);
        setFormSubcategoryId(firstCatSubcats[0]?.id || '');
      }
    } catch (e) {
      console.error('Error loading products & categories:', e);
    } finally {
      setLoading(false);
    }
  }, [store, formCategoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle URL search params
  useEffect(() => {
    if (routerParams.categoryId) {
      setSelectedCategory(routerParams.categoryId);
    }
    if (routerParams.filter && ['all', 'in', 'low', 'out'].includes(routerParams.filter)) {
      setStockFilter(routerParams.filter);
    }
    if (routerParams.action === 'add') {
      openAddProductForm();
    }
  }, [routerParams.categoryId, routerParams.filter, routerParams.action]);

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Subcategory map for quick lookup
  const subcategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    subcategories.forEach((sc) => map.set(sc.id, sc.name));
    return map;
  }, [subcategories]);

  // Active subcategories under currently filtered category
  const activeSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    return subcategories.filter((s) => s.categoryId === selectedCategory && s.active);
  }, [subcategories, selectedCategory]);

  // Subcategories available for the current modal form category
  const formAvailableSubcategories = useMemo(() => {
    if (!formCategoryId) return [];
    return subcategories.filter((s) => s.categoryId === formCategoryId && s.active);
  }, [subcategories, formCategoryId]);

  // Filtering products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = prod.name.toLowerCase().includes(query);
        const matchBrand = (prod.brand || '').toLowerCase().includes(query);
        const matchCategory = (categoryMap.get(prod.categoryId) || '').toLowerCase().includes(query);
        const matchSubcategory = (subcategoryMap.get(prod.subcategoryId) || '').toLowerCase().includes(query);
        const matchVariant = prod.variants.some(
          (v) =>
            v.name.toLowerCase().includes(query) ||
            (v.size && v.size.toLowerCase().includes(query)) ||
            (v.sku && v.sku.toLowerCase().includes(query))
        );
        if (!matchName && !matchBrand && !matchCategory && !matchSubcategory && !matchVariant) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCategory && prod.categoryId !== selectedCategory) {
        return false;
      }

      // 2b. Subcategory Filter
      if (selectedSubcategory && prod.subcategoryId !== selectedSubcategory) {
        return false;
      }

      // 3. Stock Level Filter
      if (stockFilter !== 'all') {
        const totalStock = prod.variants.reduce((sum, v) => sum + (v.currentStock || 0), 0);
        const hasLowVariant = prod.variants.some(
          (v) => (v.currentStock || 0) <= (v.minStockLevel || 5) && (v.currentStock || 0) > 0
        );
        const hasOutVariant = prod.variants.some((v) => (v.currentStock || 0) <= 0);

        if (stockFilter === 'out' && !hasOutVariant) return false;
        if (stockFilter === 'low' && !hasLowVariant) return false;
        if (stockFilter === 'in' && totalStock <= 0) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedSubcategory, stockFilter, categoryMap, subcategoryMap]);

  // Selected Category helpers for dynamic Units & Presets
  const selectedCatObj = useMemo(
    () => categories.find((c) => c.id === formCategoryId),
    [categories, formCategoryId]
  );
  const catNameLower = (selectedCatObj?.name || '').toLowerCase();
  const isPaintCategory = catNameLower.includes('paint');
  const isPipeCategory = catNameLower.includes('pipe') || catNameLower.includes('plumb');

  const availableUnits = useMemo(() => {
    if (isPaintCategory) {
      return [
        { value: 'l' as StandardUnit, label: 'Liter (L)' },
        { value: 'kg' as StandardUnit, label: 'Kg (Putty/Powder)' },
        { value: 'box' as StandardUnit, label: 'Box / Carton' },
        { value: 'piece' as StandardUnit, label: 'Piece' },
      ];
    }
    if (isPipeCategory) {
      return [
        { value: 'piece' as StandardUnit, label: 'Piece (Pipe/Fitting)' },
        { value: 'm' as StandardUnit, label: 'Meter (Length)' },
        { value: 'box' as StandardUnit, label: 'Box / Bundle' },
      ];
    }
    return UNIT_OPTIONS;
  }, [isPaintCategory, isPipeCategory]);

  const quickPresets = useMemo(() => {
    if (isPaintCategory) {
      if (formBaseUnit === 'kg') {
        return ['1 kg', '5 kg', '10 kg', '20 kg', '40 kg (Bag)'];
      }
      return ['200 ml', '500 ml', '1 Liter', '4 Liter', '10 Liter', '20 Liter (Bucket)'];
    }
    if (isPipeCategory) {
      return ['1/2" (15mm)', '3/4" (20mm)', '1" (25mm)', '1.25" (32mm)', '1.5" (40mm)', '2" (50mm)', '4" (110mm)'];
    }
    return [];
  }, [isPaintCategory, isPipeCategory, formBaseUnit]);

  // Open Form for Adding New Product
  const openAddProductForm = () => {
    setEditingProduct(null);
    setFormName('');
    setFormBrand('');
    const defaultCat = selectedCategory || categories[0]?.id || '';
    setFormCategoryId(defaultCat);
    const catSubcats = subcategories.filter((s) => s.categoryId === defaultCat && s.active);
    setFormSubcategoryId(catSubcats[0]?.id || '');
    setFormImageUrl('');
    setFormDescription('');

    const cat = categories.find((c) => c.id === defaultCat);
    const isPaint = cat?.name.toLowerCase().includes('paint');

    setFormBaseUnit(isPaint ? 'l' : 'piece');
    setFormVariants([
      {
        name: isPaint ? '1 Liter' : 'Standard',
        size: isPaint ? '1 Liter' : 'Standard',
        openingStock: '10',
        minStockLevel: '5',
        rackLocation: '',
      },
    ]);
    setFormVisible(true);
  };

  // Open Form for Editing Existing Product
  const openEditProductForm = (prod: Product & { variants: ProductVariant[] }) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormBrand(prod.brand || '');
    setFormCategoryId(prod.categoryId);
    setFormSubcategoryId(prod.subcategoryId || '');
    setFormImageUrl(prod.imageUrl || '');
    setFormDescription(prod.description || '');
    setFormBaseUnit((prod.baseUnit as StandardUnit) || 'piece');

    if (prod.variants && prod.variants.length > 0) {
      setFormVariants(
        prod.variants.map((v) => ({
          id: v.id,
          name: v.name || v.size || 'Standard',
          size: v.size || v.name || 'Standard',
          sellingPriceRs: v.sellingPricePaise ? (v.sellingPricePaise / 100).toString() : '',
          costPriceRs: v.purchasePricePaise ? (v.purchasePricePaise / 100).toString() : '',
          openingStock: (v.openingStock || 0).toString(),
          currentStock: v.currentStock,
          minStockLevel: (v.minStockLevel || 5).toString(),
          rackLocation: v.rackLocation || '',
        }))
      );
    } else {
      setFormVariants([
        {
          name: 'Standard',
          size: 'Standard',
          openingStock: '10',
          minStockLevel: '5',
          rackLocation: '',
        },
      ]);
    }

    setFormVisible(true);
  };

  // Image Picking
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setFormImageUrl(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick image from gallery');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setFormImageUrl(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open camera');
    }
  };

  // Variant Management inside Form
  const addVariantRow = () => {
    setFormVariants((prev) => [
      ...prev,
      {
        name: isPaintCategory
          ? `Pack ${prev.length + 1}`
          : isPipeCategory
          ? `Diameter ${prev.length + 1}`
          : `Size ${prev.length + 1}`,
        size: '',
        openingStock: '10',
        minStockLevel: '5',
        rackLocation: '',
      },
    ]);
  };

  const removeVariantRow = (index: number) => {
    if (formVariants.length <= 1) {
      Alert.alert('Cannot Remove', 'Each product must have at least one size/variant.');
      return;
    }
    setFormVariants((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateVariantRow = (index: number, field: keyof VariantFormItem, value: string) => {
    setFormVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSelectCategory = (catId: string) => {
    setFormCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const n = cat.name.toLowerCase();
    const isPaint = n.includes('paint');
    const isPipe = n.includes('pipe') || n.includes('plumb');

    if (isPaint) {
      if (formBaseUnit !== 'l' && formBaseUnit !== 'kg' && formBaseUnit !== 'box') {
        setFormBaseUnit('l');
      }
      if (formVariants.length === 1 && (formVariants[0].size === 'Standard' || !formVariants[0].size)) {
        updateVariantRow(0, 'size', '1 Liter');
        updateVariantRow(0, 'name', '1 Liter');
      }
    } else if (isPipe) {
      if (formBaseUnit === 'l' || formBaseUnit === 'kg') {
        setFormBaseUnit('piece');
      }
      if (formVariants.length === 1 && formVariants[0].size === '1 Liter') {
        updateVariantRow(0, 'size', 'Standard');
        updateVariantRow(0, 'name', 'Standard');
      }
    }
  };

  const handleApplyPresetSize = (presetLabel: string) => {
    // If only 1 variant and it has default 'Standard' or empty, replace it
    if (
      formVariants.length === 1 &&
      (!formVariants[0].size ||
        formVariants[0].size === 'Standard' ||
        formVariants[0].size === '1 Liter')
    ) {
      updateVariantRow(0, 'size', presetLabel);
      updateVariantRow(0, 'name', presetLabel);
      return;
    }

    // Check if this preset already exists
    const exists = formVariants.some(
      (v) => v.size.trim().toLowerCase() === presetLabel.trim().toLowerCase()
    );
    if (exists) {
      Alert.alert('Already Added', `"${presetLabel}" is already in your size list.`);
      return;
    }

    // Otherwise append a new variant
    setFormVariants((prev) => [
      ...prev,
      {
        name: presetLabel,
        size: presetLabel,
        openingStock: '10',
        minStockLevel: '5',
        rackLocation: '',
      },
    ]);
  };

  // Create Category Handler
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Required', 'Please enter a category name');
      return;
    }
    try {
      setCreatingCat(true);
      const storeId = store?.id || 'store-1';
      const created = await ProductRepository.createCategory(
        { name: newCatName.trim(), displayOrder: categories.length },
        storeId,
        deviceId
      );
      setCategories((prev) => [...prev, created]);
      setFormCategoryId(created.id);
      setNewCatName('');
      setNewCatDialogVisible(false);
      Alert.alert('Success', `Category "${created.name}" created!`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create category';
      Alert.alert('Error', msg);
    } finally {
      setCreatingCat(false);
    }
  };

  // Save Product (Create or Update)
  const handleSaveProduct = async () => {
    if (!formName.trim()) {
      Alert.alert('Required', 'Product Name is mandatory.');
      return;
    }
    if (!formCategoryId) {
      Alert.alert('Required', 'Please select a Category.');
      return;
    }

    // Validate Variants
    for (let i = 0; i < formVariants.length; i++) {
      const v = formVariants[i];
      if (!v.size.trim() && !v.name.trim()) {
        Alert.alert('Required', `Please enter a Size/Name for variant #${i + 1}`);
        return;
      }
    }

    try {
      setSavingProduct(true);
      const storeId = store?.id || 'store-1';

      // Ensure a valid subcategory exists for SQLite constraint
      let subcatId = formSubcategoryId;
      if (!subcatId) {
        const existingSubcats = await ProductRepository.getSubcategories(formCategoryId, storeId);
        subcatId = existingSubcats[0]?.id;
        if (!subcatId) {
          const autoSubcat = await ProductRepository.createSubcategory(
            { categoryId: formCategoryId, name: 'General' },
            storeId,
            deviceId
          );
          subcatId = autoSubcat.id;
        }
      }

      const measurementType = mapUnitToMeasurementType(formBaseUnit);

      if (editingProduct) {
        // UPDATE PRODUCT
        const productUpdates: Partial<Product> = {
          name: formName.trim(),
          brand: formBrand.trim() || undefined,
          categoryId: formCategoryId,
          subcategoryId: subcatId,
          imageUrl: formImageUrl.trim() || undefined,
          description: formDescription.trim() || undefined,
          baseUnit: formBaseUnit,
          measurementType: measurementType,
        };

        const variantsData: Array<Partial<ProductVariant>> = formVariants.map((v) => ({
          id: v.id,
          name: v.name.trim() || v.size.trim() || 'Standard',
          size: v.size.trim() || v.name.trim() || 'Standard',
          sku: generateSku(formName, formBrand, v.size || v.name),
          sellingPricePaise: v.sellingPriceRs ? Math.round((parseFloat(v.sellingPriceRs) || 0) * 100) : 0,
          purchasePricePaise: v.costPriceRs ? Math.round((parseFloat(v.costPriceRs) || 0) * 100) : 0,
          minStockLevel: parseFloat(v.minStockLevel) || 5,
          rackLocation: v.rackLocation.trim() || undefined,
        }));

        await ProductRepository.updateProduct(
          editingProduct.id,
          productUpdates,
          variantsData,
          storeId,
          deviceId
        );

        Alert.alert('Product Updated', `"${formName}" has been successfully updated.`);
      } else {
        // CREATE NEW PRODUCT
        const productData: Partial<Product> = {
          name: formName.trim(),
          brand: formBrand.trim() || undefined,
          categoryId: formCategoryId,
          subcategoryId: subcatId,
          imageUrl: formImageUrl.trim() || undefined,
          description: formDescription.trim() || undefined,
          baseUnit: formBaseUnit,
          measurementType: measurementType,
          allowedUnits: [formBaseUnit],
        };

        const variantsData: Array<Partial<ProductVariant>> = formVariants.map((v) => {
          const openingStock = parseFloat(v.openingStock) || 0;
          return {
            name: v.name.trim() || v.size.trim() || 'Standard',
            size: v.size.trim() || v.name.trim() || 'Standard',
            sku: generateSku(formName, formBrand, v.size || v.name),
            sellingPricePaise: v.sellingPriceRs ? Math.round((parseFloat(v.sellingPriceRs) || 0) * 100) : 0,
            purchasePricePaise: v.costPriceRs ? Math.round((parseFloat(v.costPriceRs) || 0) * 100) : 0,
            openingStock: openingStock,
            currentStock: openingStock,
            minStockLevel: parseFloat(v.minStockLevel) || 5,
            rackLocation: v.rackLocation.trim() || undefined,
          };
        });

        await ProductRepository.createProduct(productData, variantsData, storeId, deviceId);

        Alert.alert('Product Added', `"${formName}" added with ${variantsData.length} size variant(s).`);
      }

      setFormVisible(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save product';
      Alert.alert('Error', msg);
    } finally {
      setSavingProduct(false);
    }
  };

  // Delete / Archive Product
  const handleArchiveProduct = (prod: Product) => {
    setDeleteConfirmProd(prod);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deleteConfirmProd) return;
    try {
      setDeletingProduct(true);
      const storeId = store?.id || deleteConfirmProd.storeId || 'store-1';
      await ProductRepository.archiveProduct(deleteConfirmProd.id, storeId, deviceId);
      setDeleteConfirmProd(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not delete product';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${msg}`);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setDeletingProduct(false);
    }
  };

  // Quick Stock Variant (Add or Sell)
  const handleConfirmQuickStock = async () => {
    if (!quickStockTarget) return;
    const qty = parseFloat(quickStockQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid stock quantity (e.g. 10)');
      return;
    }

    const currentStock = quickStockTarget.variant.currentStock || 0;
    if (quickStockMode === 'sell' && qty > currentStock) {
      Alert.alert(
        'Insufficient Stock',
        `Cannot sell ${qty} ${quickStockTarget.unit}. Current available stock is ${currentStock} ${quickStockTarget.unit}.`
      );
      return;
    }

    try {
      setUpdatingStock(true);
      const storeId = store?.id || 'store-1';
      await InventoryRepository.adjustStock(
        quickStockTarget.variant.id,
        qty,
        (quickStockTarget.unit as any) || 'piece',
        quickStockMode === 'sell' ? 'sale' : 'increase',
        quickStockNote.trim() ||
          (quickStockMode === 'sell'
            ? `Sold ${qty} ${quickStockTarget.unit}`
            : 'Restock from Catalogue'),
        storeId,
        deviceId
      );

      Alert.alert(
        quickStockMode === 'sell' ? 'Sale Recorded' : 'Stock Updated',
        quickStockMode === 'sell'
          ? `Sold -${qty} ${quickStockTarget.unit} of "${quickStockTarget.productName} (${quickStockTarget.variant.name})"`
          : `Added +${qty} ${quickStockTarget.unit} to "${quickStockTarget.productName} (${quickStockTarget.variant.name})"`,
        [
          { text: 'Done' },
          {
            text: 'View History',
            onPress: () => router.push('/(tabs)/history'),
          },
        ]
      );
      setQuickStockTarget(null);
      setQuickStockNote('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update stock';
      Alert.alert('Error', msg);
    } finally {
      setUpdatingStock(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* 1. Top Search Bar */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: activeColors.surface,
            borderBottomColor: activeColors.border,
          },
        ]}
      >
        <Searchbar
          placeholder="Search by name, brand, or size..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[
            styles.searchbar,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
            },
          ]}
          inputStyle={[styles.searchbarInput, { color: activeColors.textPrimary }]}
          placeholderTextColor={activeColors.textMuted}
          iconColor={activeColors.textSecondary}
        />

        {/* Stock Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {[
            { id: 'all', label: 'All Items' },
            { id: 'in', label: 'In Stock' },
            { id: 'low', label: 'Low Stock' },
            { id: 'out', label: 'Out of Stock' },
          ].map((item) => (
            <Chip
              key={item.id}
              selected={stockFilter === item.id}
              onPress={() => setStockFilter(item.id as any)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: stockFilter === item.id ? (isDarkMode ? '#1E293B' : '#EFF6FF') : (isDarkMode ? '#111827' : '#F1F5F9'),
                  borderColor: stockFilter === item.id ? activeColors.primary : activeColors.border,
                  borderWidth: stockFilter === item.id ? 1 : 0,
                },
              ]}
              textStyle={[
                styles.filterChipText,
                { color: stockFilter === item.id ? activeColors.primary : activeColors.textSecondary },
                stockFilter === item.id && styles.filterChipTextActive,
              ]}
              showSelectedOverlay={false}
            >
              {item.label}
            </Chip>
          ))}
        </ScrollView>

        {/* Category Filter Chips with + Category */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <TouchableOpacity
            style={[
              styles.catTab,
              {
                backgroundColor: selectedCategory === null ? activeColors.primary : (isDarkMode ? '#1E293B' : '#F1F5F9'),
              },
            ]}
            onPress={() => {
              setSelectedCategory(null);
              setSelectedSubcategory(null);
            }}
          >
            <Text
              style={[
                styles.catTabText,
                {
                  color: selectedCategory === null ? '#FFFFFF' : activeColors.textSecondary,
                  fontWeight: selectedCategory === null ? '700' : '600',
                },
              ]}
            >
              All Categories
            </Text>
          </TouchableOpacity>

          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.catTab,
                {
                  backgroundColor: selectedCategory === c.id ? activeColors.primary : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                },
              ]}
              onPress={() => {
                setSelectedCategory(c.id);
                setSelectedSubcategory(null);
              }}
            >
              <Text
                style={[
                  styles.catTabText,
                  {
                    color: selectedCategory === c.id ? '#FFFFFF' : activeColors.textSecondary,
                    fontWeight: selectedCategory === c.id ? '700' : '600',
                  },
                ]}
              >
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Quick Add Category Button */}
          <TouchableOpacity
            style={[
              styles.addCatTab,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
              },
            ]}
            onPress={() => setNewCatDialogVisible(true)}
          >
            <MaterialCommunityIcons name="plus" size={14} color={activeColors.primary} />
            <Text style={[styles.addCatTabText, { color: activeColors.primary }]}>New</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Subcategories Filter Row */}
        {selectedCategory && activeSubcategories.length > 0 && (
          <View
            style={[
              styles.subcatBar,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderTopColor: isDarkMode ? '#1E293B' : '#E2E8F0',
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subcatScroll}
            >
              <TouchableOpacity
                style={[
                  styles.subcatTab,
                  {
                    backgroundColor:
                      selectedSubcategory === null
                        ? activeColors.primary
                        : (isDarkMode ? '#1E293B' : '#FFFFFF'),
                    borderColor:
                      selectedSubcategory === null
                        ? activeColors.primary
                        : (isDarkMode ? '#334155' : '#CBD5E1'),
                  },
                ]}
                onPress={() => setSelectedSubcategory(null)}
              >
                <Text
                  style={[
                    styles.subcatTabText,
                    {
                      color:
                        selectedSubcategory === null
                          ? '#FFFFFF'
                          : activeColors.textSecondary,
                      fontWeight: selectedSubcategory === null ? '700' : '600',
                    },
                  ]}
                >
                  All {categoryMap.get(selectedCategory) || 'Items'}
                </Text>
              </TouchableOpacity>

              {activeSubcategories.map((sc) => (
                <TouchableOpacity
                  key={sc.id}
                  style={[
                    styles.subcatTab,
                    {
                      backgroundColor:
                        selectedSubcategory === sc.id
                          ? activeColors.primary
                          : (isDarkMode ? '#1E293B' : '#FFFFFF'),
                      borderColor:
                        selectedSubcategory === sc.id
                          ? activeColors.primary
                          : (isDarkMode ? '#334155' : '#CBD5E1'),
                    },
                  ]}
                  onPress={() => setSelectedSubcategory(sc.id)}
                >
                  <Text
                    style={[
                      styles.subcatTabText,
                      {
                        color:
                          selectedSubcategory === sc.id
                            ? '#FFFFFF'
                            : activeColors.textSecondary,
                        fontWeight: selectedSubcategory === sc.id ? '700' : '600',
                      },
                    ]}
                  >
                    {sc.name}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Quick Add Subcategory Button */}
              <TouchableOpacity
                style={[
                  styles.addSubcatTab,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                    borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
                  },
                ]}
                onPress={() => {
                  setNewSubcatName('');
                  setNewSubcatDialogVisible(true);
                }}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={14}
                  color={activeColors.primary}
                />
                <Text style={[styles.addSubcatTabText, { color: activeColors.primary }]}>
                  Subcategory
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>

      {/* 2. Product Catalogue List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { backgroundColor: activeColors.background }]}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <Surface
            style={[
              styles.emptyContainer,
              {
                backgroundColor: activeColors.surface,
                borderColor: activeColors.border,
              },
            ]}
          >
            <MaterialCommunityIcons name="package-variant" size={48} color={activeColors.textMuted} />
            <Text style={[styles.emptyTitle, { color: activeColors.textPrimary }]}>No Products Found</Text>
            <Text style={[styles.emptySubtitle, { color: activeColors.textSecondary }]}>
              {searchQuery.trim()
                ? 'Try a different search keyword or filter.'
                : 'Tap the "+" button below to add your first product!'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: activeColors.primary }]}
              onPress={openAddProductForm}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Add Product</Text>
            </TouchableOpacity>
          </Surface>
        }
        renderItem={({ item }) => {
          const totalStock = item.variants.reduce((s, v) => s + (v.currentStock || 0), 0);
          const categoryName = categoryMap.get(item.categoryId) || 'General';

          return (
            <Surface
              style={[
                styles.productCard,
                {
                  backgroundColor: activeColors.surface,
                  borderColor: activeColors.border,
                  ...themeShadows.card,
                },
              ]}
            >
              {/* Product Header */}
              <View style={styles.cardHeader}>
                {/* Product Image / Thumbnail */}
                <View
                  style={[
                    styles.thumbWrapper,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                  ]}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
                  ) : (
                    <MaterialCommunityIcons
                      name="cube-outline"
                      size={28}
                      color={activeColors.textSecondary}
                    />
                  )}
                </View>

                {/* Name & Brand */}
                <View style={styles.cardHeaderInfo}>
                  <Text style={[styles.productName, { color: activeColors.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.tagRow}>
                    {item.brand ? (
                      <View
                        style={[
                          styles.brandTag,
                          { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' },
                        ]}
                      >
                        <Text style={[styles.brandTagText, { color: activeColors.primary }]}>{item.brand}</Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.categoryTag,
                        { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                      ]}
                    >
                      <Text style={[styles.categoryTagText, { color: activeColors.textSecondary }]}>{categoryName}</Text>
                    </View>
                    {subcategoryMap.get(item.subcategoryId) ? (
                      <View
                        style={[
                          styles.subcatTag,
                          {
                            backgroundColor: isDarkMode ? '#1E3A8A' : '#EEF2FF',
                            borderColor: isDarkMode ? '#2563EB' : '#C7D2FE',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.subcatTagText,
                            { color: isDarkMode ? '#93C5FD' : '#4338CA' },
                          ]}
                        >
                          {subcategoryMap.get(item.subcategoryId)}
                        </Text>
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.unitTag,
                        {
                          backgroundColor: isDarkMode ? '#111827' : '#F8FAFC',
                          borderColor: activeColors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.unitTagText, { color: activeColors.textMuted }]}>{item.baseUnit || 'pcs'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Description if present */}
              {item.description ? (
                <Text style={[styles.productDesc, { color: activeColors.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* Variants / Sizes Section */}
              <View
                style={[
                  styles.variantsBox,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                    borderColor: isDarkMode ? '#1F2937' : '#F1F5F9',
                  },
                ]}
              >
                <View style={styles.variantSectionHeader}>
                  <Text style={[styles.variantHeaderTitle, { color: activeColors.textPrimary }]}>
                    Sizes & Inventory:
                  </Text>
                  <Text style={[styles.totalStockLabel, { color: activeColors.textSecondary }]}>
                    Total: <Text style={{ fontWeight: '700', color: activeColors.textPrimary }}>{totalStock} {item.baseUnit}</Text>
                  </Text>
                </View>

                {item.variants.map((v) => {
                  const stock = v.currentStock || 0;
                  const min = v.minStockLevel || 5;
                  const isOut = stock <= 0;
                  const isLow = stock <= min;

                  return (
                    <View
                      key={v.id}
                      style={[
                        styles.variantRow,
                        {
                          backgroundColor: activeColors.surface,
                          borderColor: activeColors.border,
                        },
                      ]}
                    >
                      <View style={styles.variantLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.variantSizeName, { color: activeColors.textPrimary }]}>
                            {v.name || v.size || 'Standard'}
                          </Text>
                          {v.rackLocation ? (
                            <Text style={[styles.variantRack, { color: activeColors.textMuted }]}>
                              📍 {v.rackLocation}
                            </Text>
                          ) : null}
                        </View>
                        {(v.sellingPricePaise || 0) > 0 ? (
                          <View style={styles.variantPriceRow}>
                            <Text style={styles.sellingPriceText}>
                              ₹{(v.sellingPricePaise || 0) / 100}
                            </Text>
                            {v.purchasePricePaise ? (
                              <Text style={styles.costPriceText}>
                                (Cost: ₹{v.purchasePricePaise / 100})
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>

                      {/* Stock Pill & Action */}
                      <View style={styles.variantRight}>
                        <View
                          style={[
                            styles.stockStatusBadge,
                            isOut
                              ? styles.badgeOut
                              : isLow
                              ? styles.badgeLow
                              : styles.badgeIn,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stockStatusBadgeText,
                              isOut
                                ? styles.badgeTextOut
                                : isLow
                                ? styles.badgeTextLow
                                : styles.badgeTextIn,
                            ]}
                          >
                            {stock} {item.baseUnit || 'pcs'}
                          </Text>
                        </View>

                        {/* Quick Stock Action Buttons: +Stock and -Sell */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.quickAddChip}
                            onPress={() => {
                              setQuickStockMode('add');
                              setQuickStockTarget({
                                productId: item.id,
                                productName: item.name,
                                variant: v,
                                unit: item.baseUnit || 'pcs',
                              });
                              setQuickStockQty('10');
                              setQuickStockNote('');
                            }}
                          >
                            <MaterialCommunityIcons name="plus" size={14} color="#16A34A" />
                            <Text style={styles.quickAddChipText}>Stock</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.quickSellChip}
                            onPress={() => {
                              setQuickStockMode('sell');
                              setQuickStockTarget({
                                productId: item.id,
                                productName: item.name,
                                variant: v,
                                unit: item.baseUnit || 'pcs',
                              });
                              setQuickStockQty('10');
                              setQuickStockNote('');
                            }}
                          >
                            <MaterialCommunityIcons name="minus" size={14} color="#DC2626" />
                            <Text style={styles.quickSellChipText}>Sell</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Bottom Card Actions */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => openEditProductForm(item)}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={activeColors.primary} />
                  <Text style={[styles.editBtnText, { color: activeColors.primary }]}>Edit Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.archiveBtn}
                  onPress={() => handleArchiveProduct(item)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#DC2626" />
                  <Text style={styles.archiveBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Surface>
          );
        }}
      />

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: activeColors.primary,
            ...themeShadows.floating,
          },
        ]}
        onPress={openAddProductForm}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 3. Add / Edit Product Modal */}
      <Modal
        visible={formVisible}
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: activeColors.background }]}>
          {/* Modal Header */}
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: activeColors.surface,
                borderBottomColor: activeColors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: activeColors.textPrimary }]}>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </Text>
            <TouchableOpacity
              onPress={() => setFormVisible(false)}
              style={styles.modalCloseBtn}
            >
              <MaterialCommunityIcons name="close" size={24} color={activeColors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 60 }}>
            {/* Product Name */}
            <TextInput
              label="Product Name *"
              value={formName}
              onChangeText={setFormName}
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
              placeholder="e.g. Astral CPVC Pipe, Asian Paint Royale"
            />

            {/* Brand Name */}
            <TextInput
              label="Brand Name (Optional)"
              value={formBrand}
              onChangeText={setFormBrand}
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
              placeholder="e.g. Astral, Berger, Havells, Godrej"
            />

            {/* Category Selector */}
            <Text style={[styles.fieldLabel, { color: activeColors.textSecondary, marginTop: spacing.xs }]}>
              Category *
            </Text>
            <View style={styles.catChipsWrapper}>
              {categories.map((c) => {
                const isCatSelected = formCategoryId === c.id;
                return (
                  <Chip
                    key={c.id}
                    selected={isCatSelected}
                    onPress={() => handleSelectCategory(c.id)}
                    style={[
                      styles.formCatChip,
                      {
                        backgroundColor: isCatSelected
                          ? (isDarkMode ? '#1E293B' : '#EFF6FF')
                          : (isDarkMode ? '#111827' : '#F1F5F9'),
                        borderColor: isCatSelected ? activeColors.primary : activeColors.border,
                        borderWidth: 1,
                      },
                    ]}
                    textStyle={[
                      styles.formCatChipText,
                      {
                        color: isCatSelected ? activeColors.primary : activeColors.textSecondary,
                        fontWeight: isCatSelected ? '700' : '600',
                      },
                    ]}
                    showSelectedOverlay={false}
                  >
                    {c.name}
                  </Chip>
                );
              })}
              <TouchableOpacity
                style={[
                  styles.formNewCatBtn,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                    borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
                  },
                ]}
                onPress={() => setNewCatDialogVisible(true)}
              >
                <MaterialCommunityIcons name="plus" size={14} color={activeColors.primary} />
                <Text style={[styles.formNewCatText, { color: activeColors.primary }]}>
                  + New Category
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sub-category Selector */}
            <View style={styles.fieldHeaderRow}>
              <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>
                Sub-category *
              </Text>
              <Text style={styles.unitHintText}>
                💡 E.g. CPVC Pipes, PVC Pipes, Angles & Elbows
              </Text>
            </View>
            <View style={styles.catChipsWrapper}>
              {formAvailableSubcategories.map((sc) => {
                const isSubSelected = formSubcategoryId === sc.id;
                return (
                  <Chip
                    key={sc.id}
                    selected={isSubSelected}
                    onPress={() => setFormSubcategoryId(sc.id)}
                    style={[
                      styles.formCatChip,
                      {
                        backgroundColor: isSubSelected
                          ? (isDarkMode ? '#1E3A8A' : '#DBEAFE')
                          : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                        borderColor: isSubSelected
                          ? activeColors.primary
                          : (isDarkMode ? '#334155' : '#E2E8F0'),
                        borderWidth: 1,
                      },
                    ]}
                    textStyle={[
                      styles.formCatChipText,
                      {
                        color: isSubSelected ? activeColors.primary : activeColors.textSecondary,
                        fontWeight: isSubSelected ? '700' : '600',
                      },
                    ]}
                    showSelectedOverlay={false}
                  >
                    {sc.name}
                  </Chip>
                );
              })}
              <TouchableOpacity
                style={[
                  styles.formNewCatBtn,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                    borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
                  },
                ]}
                onPress={() => {
                  setNewSubcatName('');
                  setNewSubcatDialogVisible(true);
                }}
              >
                <MaterialCommunityIcons name="plus" size={14} color={activeColors.primary} />
                <Text style={[styles.formNewCatText, { color: activeColors.primary }]}>
                  + Subcategory
                </Text>
              </TouchableOpacity>
            </View>

            {/* Measurement Unit */}
            <View style={styles.fieldHeaderRow}>
              <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>
                Measurement Unit *
              </Text>
              {isPaintCategory && (
                <Text style={styles.unitHintText}>💡 Liquid paints in Liters, Putty in Kg</Text>
              )}
              {isPipeCategory && (
                <Text style={styles.unitHintText}>💡 Pipes sold in Pieces or Meters</Text>
              )}
            </View>
            <View style={styles.unitChipsRow}>
              {availableUnits.map((u) => {
                const isUnitSelected = formBaseUnit === u.value;
                return (
                  <Chip
                    key={u.value}
                    selected={isUnitSelected}
                    onPress={() => setFormBaseUnit(u.value)}
                    style={[
                      styles.unitChip,
                      {
                        backgroundColor: isUnitSelected
                          ? activeColors.primary
                          : (isDarkMode ? '#111827' : '#F1F5F9'),
                        borderColor: isUnitSelected ? activeColors.primary : activeColors.border,
                        borderWidth: 1,
                      },
                    ]}
                    textStyle={[
                      styles.unitChipText,
                      {
                        color: isUnitSelected ? '#FFFFFF' : activeColors.textSecondary,
                        fontWeight: isUnitSelected ? '700' : '600',
                      },
                    ]}
                    showSelectedOverlay={false}
                  >
                    {u.label}
                  </Chip>
                );
              })}
            </View>

            {/* Product Photo */}
            <Text style={[styles.fieldLabel, { color: activeColors.textSecondary, marginTop: spacing.md }]}>
              Photo (Optional)
            </Text>
            <View style={styles.photoPickerRow}>
              <View
                style={[
                  styles.photoPreviewBox,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                    borderColor: activeColors.border,
                  },
                ]}
              >
                {formImageUrl ? (
                  <Image source={{ uri: formImageUrl }} style={styles.photoPreviewImage} />
                ) : (
                  <MaterialCommunityIcons name="camera-plus" size={28} color={activeColors.textMuted} />
                )}
              </View>
              <View style={styles.photoButtonsCol}>
                <TouchableOpacity
                  style={[
                    styles.photoBtn,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                      borderColor: isDarkMode ? '#374151' : '#BFDBFE',
                      borderWidth: 1,
                    },
                  ]}
                  onPress={handlePickImage}
                >
                  <MaterialCommunityIcons name="image" size={16} color={activeColors.primary} />
                  <Text style={[styles.photoBtnText, { color: activeColors.primary }]}>
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.photoBtn,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                      borderColor: isDarkMode ? '#374151' : '#BFDBFE',
                      borderWidth: 1,
                    },
                  ]}
                  onPress={handleTakePhoto}
                >
                  <MaterialCommunityIcons name="camera" size={16} color={activeColors.primary} />
                  <Text style={[styles.photoBtnText, { color: activeColors.primary }]}>
                    Take Photo
                  </Text>
                </TouchableOpacity>
                {formImageUrl ? (
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => setFormImageUrl('')}
                  >
                    <Text style={styles.removePhotoText}>Remove Photo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Sizes & Stock Section */}
            <View style={styles.variantsHeaderRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.formSectionTitle, { color: activeColors.textPrimary }]}>
                  {isPaintCategory
                    ? 'Pack Sizes & Cans in Stock'
                    : isPipeCategory
                    ? 'Pipe Diameters & Stock'
                    : 'Sizes & Stock'}
                </Text>
                <Text style={[styles.formSectionSub, { color: activeColors.textSecondary }]}>
                  {isPaintCategory
                    ? 'Choose can/bucket sizes below or enter custom size.'
                    : isPipeCategory
                    ? 'Choose pipe diameter below or enter custom size.'
                    : 'Add sizes or keep Standard.'}
                </Text>
              </View>
              <TouchableOpacity style={styles.addSizeBtn} onPress={addVariantRow}>
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.addSizeBtnText}>
                  {isPaintCategory
                    ? '+ Add Pack Size'
                    : isPipeCategory
                    ? '+ Add Diameter'
                    : '+ Add Size'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick 1-Tap Presets Bar */}
            {quickPresets.length > 0 && (
              <View
                style={[
                  styles.presetsContainer,
                  {
                    backgroundColor: isDarkMode ? '#111827' : '#F8FAFC',
                    borderColor: activeColors.border,
                  },
                ]}
              >
                <View style={styles.presetsTitleRow}>
                  <MaterialCommunityIcons name="lightning-bolt" size={14} color="#D97706" />
                  <Text style={[styles.presetsTitleText, { color: activeColors.textPrimary }]}>
                    {isPaintCategory ? 'Quick 1-Tap Pack Sizes:' : 'Quick 1-Tap Pipe Diameters:'}
                  </Text>
                </View>
                <View style={styles.presetChipsRow}>
                  {quickPresets.map((preset) => {
                    const isAlreadySelected = formVariants.some(
                      (v) => v.size.trim().toLowerCase() === preset.trim().toLowerCase()
                    );
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: isAlreadySelected
                              ? (isDarkMode ? '#064E3B' : '#DCFCE7')
                              : (isDarkMode ? '#1E293B' : '#FFFFFF'),
                            borderColor: isAlreadySelected
                              ? (isDarkMode ? '#059669' : '#86EFAC')
                              : (isDarkMode ? '#374151' : '#CBD5E1'),
                          },
                        ]}
                        onPress={() => handleApplyPresetSize(preset)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons
                          name={isAlreadySelected ? 'check' : 'plus'}
                          size={12}
                          color={isAlreadySelected ? (isDarkMode ? '#34D399' : '#16A34A') : activeColors.primary}
                        />
                        <Text
                          style={[
                            styles.presetChipText,
                            {
                              color: isAlreadySelected
                                ? (isDarkMode ? '#34D399' : '#16A34A')
                                : activeColors.textPrimary,
                              fontWeight: isAlreadySelected ? '700' : '600',
                            },
                          ]}
                        >
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {formVariants.map((v, idx) => (
              <Surface
                key={idx}
                style={[
                  styles.variantFormCard,
                  {
                    backgroundColor: isDarkMode ? '#111827' : '#F8FAFC',
                    borderColor: activeColors.border,
                  },
                ]}
              >
                <View style={styles.variantCardHeader}>
                  <Text style={[styles.variantCardIndex, { color: activeColors.textPrimary }]}>
                    {isPaintCategory
                      ? `Pack Size #${idx + 1}`
                      : isPipeCategory
                      ? `Pipe Size #${idx + 1}`
                      : `Size / Variant #${idx + 1}`}
                  </Text>
                  {formVariants.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeVariantRow(idx)}
                      style={styles.deleteVariantBtn}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Size / Name input */}
                <TextInput
                  label={
                    isPaintCategory
                      ? 'Pack / Can Size *'
                      : isPipeCategory
                      ? 'Pipe Diameter / Size *'
                      : 'Size / Name *'
                  }
                  value={v.size}
                  onChangeText={(val) => {
                    updateVariantRow(idx, 'size', val);
                    updateVariantRow(idx, 'name', val);
                  }}
                  mode="outlined"
                  style={[styles.smallInput, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
                  placeholder={
                    isPaintCategory
                      ? 'e.g. 1 Liter, 4 Liter, 20L Bucket, 500ml'
                      : isPipeCategory
                      ? 'e.g. 1/2 inch, 20mm, 25mm, 110mm'
                      : 'e.g. 20mm, 1 Litre, Standard'
                  }
                />

                {/* Stock & Min Level */}
                <View style={styles.rowInputs}>
                  <TextInput
                    label={
                      isPaintCategory
                        ? formBaseUnit === 'kg'
                          ? 'Bags / Tins in Stock *'
                          : 'Cans / Buckets in Stock *'
                        : isPipeCategory
                        ? 'Pipes / Pcs in Stock *'
                        : `Stock Units (${formBaseUnit}) *`
                    }
                    value={v.openingStock}
                    onChangeText={(val) => updateVariantRow(idx, 'openingStock', val)}
                    keyboardType="numeric"
                    mode="outlined"
                    style={[styles.smallInput, { flex: 1, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                    textColor={activeColors.textPrimary}
                    placeholderTextColor={activeColors.textMuted}
                    outlineColor={activeColors.border}
                    activeOutlineColor={activeColors.primary}
                    placeholder={
                      isPaintCategory
                        ? 'e.g. 10 cans'
                        : isPipeCategory
                        ? 'e.g. 20 pipes'
                        : '10'
                    }
                  />
                  <TextInput
                    label="Min Alert Level"
                    value={v.minStockLevel}
                    onChangeText={(val) => updateVariantRow(idx, 'minStockLevel', val)}
                    keyboardType="numeric"
                    mode="outlined"
                    style={[styles.smallInput, { flex: 1, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                    textColor={activeColors.textPrimary}
                    placeholderTextColor={activeColors.textMuted}
                    outlineColor={activeColors.border}
                    activeOutlineColor={activeColors.primary}
                    placeholder="5"
                  />
                </View>

                {/* Shelf Location */}
                <TextInput
                  label="Rack / Shelf Location (Optional)"
                  value={v.rackLocation}
                  onChangeText={(val) => updateVariantRow(idx, 'rackLocation', val)}
                  mode="outlined"
                  style={[styles.smallInput, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
                  placeholder={
                    isPaintCategory
                      ? 'e.g. Paint Rack B-1, Shelf 2'
                      : isPipeCategory
                      ? 'e.g. Pipe Rack A-1'
                      : 'e.g. Rack A-3, Shelf 2'
                  }
                />
              </Surface>
            ))}

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveProductBtn,
                { backgroundColor: activeColors.primary },
                savingProduct && { opacity: 0.7 },
              ]}
              onPress={handleSaveProduct}
              disabled={savingProduct}
            >
              <Text style={styles.saveProductBtnText}>
                {savingProduct ? 'Saving Product...' : 'Save Product'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* 4. Quick Restock Dialog */}
      <Portal>
        <Dialog
          visible={quickStockTarget !== null}
          onDismiss={() => setQuickStockTarget(null)}
          style={[styles.dialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            {quickStockMode === 'sell' ? 'Sell Stock (Stock Out)' : 'Add Stock (Restock)'}
          </Dialog.Title>
          <Dialog.Content>
            {quickStockTarget && (
              <View>
                {/* Mode Selector Toggle */}
                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      quickStockMode === 'add' && styles.modeBtnActiveAdd,
                    ]}
                    onPress={() => setQuickStockMode('add')}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        quickStockMode === 'add' && styles.modeBtnTextActive,
                      ]}
                    >
                      + Add Stock
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      quickStockMode === 'sell' && styles.modeBtnActiveSell,
                    ]}
                    onPress={() => setQuickStockMode('sell')}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        quickStockMode === 'sell' && styles.modeBtnTextActive,
                      ]}
                    >
                      - Sell Stock
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.dialogProdName, { color: activeColors.textPrimary }]}>
                  {quickStockTarget.productName}
                </Text>
                <Text style={[styles.dialogVariantName, { color: activeColors.textSecondary }]}>
                  Size: {quickStockTarget.variant.name || quickStockTarget.variant.size || 'Standard'}
                </Text>

                <View style={styles.dialogStockRow}>
                  <Text style={[styles.dialogStockLabel, { color: activeColors.textSecondary }]}>Current Available Stock:</Text>
                  <Text style={[styles.dialogStockVal, { color: activeColors.textPrimary }]}>
                    {quickStockTarget.variant.currentStock || 0} {quickStockTarget.unit}
                  </Text>
                </View>

                {/* Presets */}
                <Text style={[styles.fieldLabel, { color: activeColors.textSecondary, marginTop: spacing.md }]}>
                  {quickStockMode === 'sell' ? 'Quantity Sold:' : 'Select Quantity to Add:'}
                </Text>
                <View style={styles.quickChipsRow}>
                  {['5', '10', '20', '50', '100'].map((preset) => (
                    <Chip
                      key={preset}
                      selected={quickStockQty === preset}
                      onPress={() => setQuickStockQty(preset)}
                      style={[
                        styles.qtyChip,
                        quickStockQty === preset &&
                          (quickStockMode === 'sell' ? styles.qtyChipSellActive : styles.qtyChipActive),
                      ]}
                      textStyle={[
                        styles.qtyChipText,
                        quickStockQty === preset &&
                          (quickStockMode === 'sell' ? styles.qtyChipSellTextActive : styles.qtyChipTextActive),
                      ]}
                      showSelectedOverlay={false}
                    >
                      {quickStockMode === 'sell' ? `-${preset}` : `+${preset}`}
                    </Chip>
                  ))}
                </View>

                {/* Custom numeric input */}
                <TextInput
                  label={`Quantity (${quickStockTarget.unit}) *`}
                  value={quickStockQty}
                  onChangeText={setQuickStockQty}
                  keyboardType="numeric"
                  mode="outlined"
                  style={{ marginTop: spacing.sm, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
                  placeholder="e.g. 10"
                />

                {/* Optional Note / Customer */}
                <TextInput
                  label="Note / Customer Name (Optional)"
                  value={quickStockNote}
                  onChangeText={setQuickStockNote}
                  mode="outlined"
                  style={{ marginTop: spacing.sm, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
                  placeholder="e.g. Sold to Rahul, Cash sale"
                />

                {/* Live Preview */}
                {quickStockMode === 'sell' ? (
                  (parseFloat(quickStockQty) || 0) > (quickStockTarget.variant.currentStock || 0) ? (
                    <View style={styles.previewBoxError}>
                      <Text style={styles.previewTextError}>
                        ⚠️ Insufficient stock! Available: {quickStockTarget.variant.currentStock || 0}{' '}
                        {quickStockTarget.unit}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.previewBoxSell}>
                      <Text style={styles.previewTextSell}>
                        Stock after Sale:{' '}
                        <Text style={styles.previewHighlightSell}>
                          {(quickStockTarget.variant.currentStock || 0) -
                            (parseFloat(quickStockQty) || 0)}{' '}
                          {quickStockTarget.unit}
                        </Text>
                      </Text>
                    </View>
                  )
                ) : (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewText}>
                      New Stock will be:{' '}
                      <Text style={styles.previewHighlight}>
                        {Math.max(0, quickStockTarget.variant.currentStock || 0) +
                          (parseFloat(quickStockQty) || 0)}{' '}
                        {quickStockTarget.unit}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Dialog.Content>

          <Dialog.Actions>
            <TouchableOpacity
              onPress={() => setQuickStockTarget(null)}
              style={styles.dialogCancelBtn}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirmQuickStock}
              disabled={
                updatingStock ||
                (quickStockMode === 'sell' &&
                  (parseFloat(quickStockQty) || 0) >
                    (quickStockTarget?.variant.currentStock || 0))
              }
              style={[
                quickStockMode === 'sell'
                  ? styles.dialogConfirmBtnSell
                  : styles.dialogConfirmBtn,
                (updatingStock ||
                  (quickStockMode === 'sell' &&
                    (parseFloat(quickStockQty) || 0) >
                      (quickStockTarget?.variant.currentStock || 0))) && {
                  opacity: 0.5,
                },
              ]}
            >
              <Text style={styles.dialogConfirmText}>
                {updatingStock
                  ? 'Processing...'
                  : quickStockMode === 'sell'
                  ? 'Confirm Sale'
                  : 'Confirm Stock'}
              </Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 5. New Category Dialog */}
      <Portal>
        <Dialog
          visible={newCatDialogVisible}
          onDismiss={() => setNewCatDialogVisible(false)}
          style={[styles.dialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            Add New Category
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name *"
              value={newCatName}
              onChangeText={setNewCatName}
              mode="outlined"
              style={{ backgroundColor: activeColors.surface }}
              textColor={activeColors.textPrimary}
              placeholder="e.g. Pipes, Paints, Tools, Sanitary"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <TouchableOpacity
              onPress={() => setNewCatDialogVisible(false)}
              style={styles.dialogCancelBtn}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCreateCategory}
              disabled={creatingCat}
              style={[styles.dialogConfirmBtn, creatingCat && { opacity: 0.7 }]}
            >
              <Text style={styles.dialogConfirmText}>
                {creatingCat ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>

        {/* 6. Delete Product Confirmation Dialog */}
        <Dialog
          visible={!!deleteConfirmProd}
          onDismiss={() => {
            if (!deletingProduct) setDeleteConfirmProd(null);
          }}
          style={[styles.dialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: '#EF4444' }]}>
            Delete Product
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: activeColors.textPrimary, fontSize: 15, marginBottom: 8, fontWeight: '600' }}>
              Are you sure you want to delete "{deleteConfirmProd?.name}"?
            </Text>
            <Text style={{ color: activeColors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              This will remove the product and its sizes from your active catalogue. Historical transactions and sales will remain preserved.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
            <TouchableOpacity
              style={styles.dialogCancelBtn}
              onPress={() => setDeleteConfirmProd(null)}
              disabled={deletingProduct}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dialogConfirmBtnSell,
                { backgroundColor: '#DC2626' },
                deletingProduct && { opacity: 0.7 },
              ]}
              onPress={handleConfirmDeleteProduct}
              disabled={deletingProduct}
            >
              <Text style={styles.dialogConfirmText}>
                {deletingProduct ? 'Deleting...' : 'Delete Product'}
              </Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>

        {/* 7. New Subcategory Dialog */}
        <Dialog
          visible={newSubcatDialogVisible}
          onDismiss={() => setNewSubcatDialogVisible(false)}
          style={[styles.dialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            New Subcategory
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: activeColors.textSecondary, fontSize: 13, marginBottom: 12 }}>
              Add a subcategory under{' '}
              <Text style={{ fontWeight: '700', color: activeColors.primary }}>
                {categoryMap.get(formVisible ? formCategoryId : (selectedCategory || categories[0]?.id || '')) || 'Pipes'}
              </Text>
            </Text>
            <TextInput
              label="Subcategory Name (e.g. Angles & Elbows, CPVC Pipes)"
              value={newSubcatName}
              onChangeText={setNewSubcatName}
              mode="outlined"
              style={{ backgroundColor: activeColors.surface }}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <TouchableOpacity
              onPress={() => setNewSubcatDialogVisible(false)}
              style={styles.dialogCancelBtn}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                if (!newSubcatName.trim()) return;
                try {
                  setCreatingSubcat(true);
                  const storeId = store?.id || 'store-1';
                  const targetCatId = formVisible
                    ? formCategoryId
                    : (selectedCategory || categories[0]?.id || '');
                  const created = await CategoryRepository.createSubcategory(
                    { categoryId: targetCatId, name: newSubcatName.trim() },
                    storeId,
                    deviceId
                  );
                  setNewSubcatDialogVisible(false);
                  setNewSubcatName('');
                  await loadData();
                  if (formVisible) {
                    setFormSubcategoryId(created.id);
                  } else {
                    setSelectedSubcategory(created.id);
                  }
                } catch (e) {
                  Alert.alert('Error', 'Failed to create subcategory');
                } finally {
                  setCreatingSubcat(false);
                }
              }}
              style={[styles.dialogConfirmBtn, creatingSubcat && { opacity: 0.7 }]}
              disabled={creatingSubcat}
            >
              <Text style={styles.dialogConfirmText}>
                {creatingSubcat ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  searchbar: {
    marginHorizontal: spacing.md,
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    elevation: 0,
    height: 44,
  },
  searchbarInput: {
    fontSize: 14,
    minHeight: 44,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 6,
  },
  filterChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.sm,
    height: 32,
  },
  filterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  categoryScroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 2,
    gap: 8,
    alignItems: 'center',
  },
  catTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  catTabActive: {
    backgroundColor: colors.primary,
  },
  catTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  catTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addCatTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  addCatTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  subcatBar: {
    borderTopWidth: 1,
    paddingVertical: 8,
    marginTop: 4,
  },
  subcatScroll: {
    paddingHorizontal: spacing.md,
    gap: 6,
    alignItems: 'center',
  },
  subcatTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  subcatTabText: {
    fontSize: 11,
  },
  addSubcatTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  addSubcatTabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subcatTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  subcatTagText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Catalogue List
  listContent: {
    padding: spacing.md,
    paddingBottom: 90,
    gap: spacing.md,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbWrapper: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  brandTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  brandTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  categoryTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  unitTag: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.xs,
  },
  unitTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  productDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: spacing.sm,
    lineHeight: 16,
  },

  // Variants Box inside Card
  variantsBox: {
    marginTop: spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 6,
  },
  variantSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  variantHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  totalStockLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  variantLeft: {
    flex: 1,
  },
  variantSizeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  variantRack: {
    fontSize: 11,
    color: '#64748B',
  },
  variantPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  sellingPriceText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  costPriceText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  variantRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stockStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
  },
  badgeIn: {
    backgroundColor: '#DCFCE7',
  },
  badgeLow: {
    backgroundColor: '#FEF3C7',
  },
  badgeOut: {
    backgroundColor: '#FEE2E2',
  },
  stockStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextIn: {
    color: '#15803D',
  },
  badgeTextLow: {
    color: '#B45309',
  },
  badgeTextOut: {
    color: '#DC2626',
  },
  quickAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  quickAddChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  quickSellChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  quickSellChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Card bottom actions
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  archiveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },

  // Empty State
  emptyContainer: {
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
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },

  // Full Screen Modal (Add / Edit)
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: spacing.lg,
  },
  formSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: spacing.sm,
  },
  formSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  smallInput: {
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    marginBottom: 6,
  },
  catChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  formCatChip: {
    backgroundColor: '#F1F5F9',
  },
  formCatChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  formCatChipText: {
    fontSize: 12,
    color: '#475569',
  },
  formCatChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  formNewCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  formNewCatText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  photoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  photoPreviewBox: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoButtonsCol: {
    flex: 1,
    gap: 6,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#EFF6FF',
    borderRadius: borderRadius.sm,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  removePhotoBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  removePhotoText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  unitChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitChip: {
    backgroundColor: '#F1F5F9',
  },
  unitChipActive: {
    backgroundColor: colors.primary,
  },
  unitChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  unitHintText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
  },
  presetsContainer: {
    marginBottom: spacing.md,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  presetsTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  presetChipSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  presetChipTextSelected: {
    color: '#16A34A',
    fontWeight: '700',
  },
  variantsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  addSizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  addSizeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  variantFormCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.md,
  },
  variantCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  variantCardIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  deleteVariantBtn: {
    padding: 4,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveProductBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.card,
  },
  saveProductBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Dialogs
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  dialogProdName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  dialogVariantName: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  dialogStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dialogStockLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  dialogStockVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  qtyChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.sm,
  },
  qtyChipActive: {
    backgroundColor: '#DCFCE7',
  },
  qtyChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  qtyChipTextActive: {
    color: '#16A34A',
    fontWeight: '700',
  },
  qtyChipSellActive: {
    backgroundColor: '#FEE2E2',
  },
  qtyChipSellTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.sm,
    padding: 3,
    marginBottom: spacing.md,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: borderRadius.sm - 2,
  },
  modeBtnActiveAdd: {
    backgroundColor: '#16A34A',
  },
  modeBtnActiveSell: {
    backgroundColor: '#DC2626',
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  previewBox: {
    marginTop: spacing.md,
    backgroundColor: '#F0FDF4',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  previewText: {
    fontSize: 13,
    color: '#166534',
  },
  previewHighlight: {
    fontWeight: '800',
    color: '#15803D',
  },
  previewBoxSell: {
    marginTop: spacing.md,
    backgroundColor: '#EFF6FF',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  previewTextSell: {
    fontSize: 13,
    color: '#1E40AF',
  },
  previewHighlightSell: {
    fontWeight: '800',
    color: '#1D4ED8',
  },
  previewBoxError: {
    marginTop: spacing.md,
    backgroundColor: '#FEF2F2',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  previewTextError: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700',
  },
  dialogCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  dialogCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dialogConfirmBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  dialogConfirmBtnSell: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  dialogConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
