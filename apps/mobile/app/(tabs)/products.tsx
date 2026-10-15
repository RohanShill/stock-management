import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Searchbar,
  Card,
  Chip,
  Portal,
  Dialog,
  TextInput,
  Button,
  SegmentedButtons,
  IconButton,
  Surface,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Product,
  ProductVariant,
  Category,
  Subcategory,
  CustomFieldDefinition,
  Supplier,
  MeasurementType,
  StandardUnit,
  formatPaiseToINR,
  rupeeToPaise,
  paiseToRupee,
  generateSku,
  fromCanonicalBaseQuantity,
} from '@hardware-store/shared';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { CategoryRepository } from '../../src/database/repositories/categoryRepository.js';
import { CustomFieldRepository } from '../../src/database/repositories/customFieldRepository.js';
import { PartiesRepository } from '../../src/database/repositories/partiesRepository.js';
import { useAppStore } from '../../src/store/useAppStore.js';
import { t } from '../../src/i18n/strings.js';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/theme/tokens.js';

interface VariantDraft {
  id?: string;
  name: string;
  sku: string;
  size?: string;
  color?: string;
  purchasePriceRs: string;
  sellingPriceRs: string;
  taxRatePercent: string;
  openingStock: string;
  minStockLevel: string;
  rackLocation?: string;
  customValues?: Record<string, any>;
}

export default function ProductsScreen() {
  const router = useRouter();
  const routerParams = useLocalSearchParams<{ categoryId?: string; filter?: 'all' | 'in' | 'low' | 'out'; action?: string }>();
  const { store, deviceId, user, language } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [products, setProducts] = useState<Array<Product & { variants: ProductVariant[] }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (routerParams.categoryId) {
      setSelectedCategory(routerParams.categoryId);
    }
    if (routerParams.filter && ['all', 'in', 'low', 'out'].includes(routerParams.filter)) {
      setStockFilter(routerParams.filter);
    }
  }, [routerParams.categoryId, routerParams.filter]);

  // Form State
  const [formVisible, setFormVisible] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formSubcategoryId, setFormSubcategoryId] = useState('');
  const [formProdName, setFormProdName] = useState('');
  const [formBrand, setFormBrand] = useState('Astral');
  const [formModelNumber, setFormModelNumber] = useState('');
  const [formMaterial, setFormMaterial] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMeasurementType, setFormMeasurementType] = useState<MeasurementType>('count');
  const [formBaseUnit, setFormBaseUnit] = useState<StandardUnit>('piece');
  const [formPipeDiameterMm, setFormPipeDiameterMm] = useState('25');
  const [formStandardLengthM, setFormStandardLengthM] = useState('3');
  const [formPipeTrackingMethod, setFormPipeTrackingMethod] = useState<'aggregate' | 'segment'>('aggregate');
  const [formPreferredSupplierId, setFormPreferredSupplierId] = useState('');

  // Dynamic Specifications State
  const [availableCustomFields, setAvailableCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Multiple Variants State
  const [variantsDraft, setVariantsDraft] = useState<VariantDraft[]>([
    {
      name: 'Standard',
      sku: '',
      size: 'Standard',
      purchasePriceRs: '100',
      sellingPriceRs: '140',
      taxRatePercent: '18',
      openingStock: '20',
      minStockLevel: '5',
      rackLocation: 'A-1',
    },
  ]);

  // Quick Create Dialogs inside form
  const [quickCreateType, setQuickCreateType] = useState<'category' | 'subcategory' | 'brand' | 'supplier' | null>(null);
  const [quickCreateName, setQuickCreateName] = useState('');
  const [quickCreateExtra, setQuickCreateExtra] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const storeId = store?.id || 'default-store';
      const [prods, cats, subcats, sups] = await Promise.all([
        ProductRepository.getProductsWithVariants(storeId),
        CategoryRepository.getCategories(storeId),
        CategoryRepository.getSubcategories(undefined, storeId),
        PartiesRepository.getSuppliers(storeId),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSubcategories(subcats);
      setSuppliers(sups);
    } catch (e) {
      console.error('Error loading catalogue:', e);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load custom field specifications when category or subcategory changes
  useEffect(() => {
    async function loadCustomSpecs() {
      const storeId = store?.id || 'default-store';
      const fields = await CustomFieldRepository.getCustomFields(storeId, 'subcategory', formSubcategoryId || undefined);
      setAvailableCustomFields(fields);
    }
    if (formSubcategoryId) {
      loadCustomSpecs();
    }
  }, [formSubcategoryId, store]);

  // Generate SKUs for variants automatically if blank
  useEffect(() => {
    if (formProdName && categories.length > 0) {
      const cat = categories.find((c) => c.id === formCategoryId);
      const catName = cat?.name || 'General';
      setVariantsDraft((prev) =>
        prev.map((v) => {
          if (!v.sku || v.sku.startsWith('GEN-') || v.sku.startsWith('ITEM-')) {
            return { ...v, sku: generateSku(catName, formProdName, v.size || v.name) };
          }
          return v;
        })
      );
    }
  }, [formProdName, formCategoryId, categories]);

  const handleOpenAddProduct = useCallback(() => {
    setEditingProductId(null);
    setFormCategoryId(categories[0]?.id || '');
    setFormSubcategoryId(subcategories[0]?.id || '');
    setFormProdName('');
    setFormBrand('Astral');
    setFormModelNumber('');
    setFormMaterial('');
    setFormDescription('');
    setFormMeasurementType('count');
    setFormBaseUnit('piece');
    setCustomFieldValues({});
    setVariantsDraft([
      {
        name: 'Standard',
        sku: generateSku('General', 'Item', 'Std'),
        size: 'Standard',
        purchasePriceRs: '100',
        sellingPriceRs: '140',
        taxRatePercent: '18',
        openingStock: '20',
        minStockLevel: '5',
        rackLocation: 'A-1',
      },
    ]);
    setFormVisible(true);
  }, [categories, subcategories]);

  useEffect(() => {
    if (routerParams.action === 'add' && categories.length > 0) {
      handleOpenAddProduct();
    }
  }, [routerParams.action, categories.length, handleOpenAddProduct]);

  const handleOpenEditProduct = (prod: Product & { variants: ProductVariant[] }) => {
    setEditingProductId(prod.id);
    setFormCategoryId(prod.categoryId);
    setFormSubcategoryId(prod.subcategoryId);
    setFormProdName(prod.name);
    setFormBrand(prod.brand || '');
    setFormModelNumber(prod.modelNumber || '');
    setFormMaterial(prod.material || '');
    setFormDescription(prod.description || '');
    setFormMeasurementType(prod.measurementType);
    setFormBaseUnit(prod.baseUnit);
    setFormPipeDiameterMm(prod.pipeDiameterMm?.toString() || '25');
    setFormStandardLengthM(prod.standardLengthMm ? (prod.standardLengthMm / 1000).toString() : '3');
    setFormPipeTrackingMethod(prod.pipeTrackingMethod || 'aggregate');
    setCustomFieldValues(prod.customValues || {});

    setVariantsDraft(
      prod.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        size: v.size || '',
        color: v.color || '',
        purchasePriceRs: paiseToRupee(v.purchasePricePaise).toString(),
        sellingPriceRs: paiseToRupee(v.sellingPricePaise).toString(),
        taxRatePercent: v.taxRatePercent.toString(),
        openingStock: v.openingStock.toString(),
        minStockLevel: v.minStockLevel.toString(),
        rackLocation: v.rackLocation || '',
        customValues: v.customValues,
      }))
    );
    setFormVisible(true);
  };

  const handleAddVariantRow = () => {
    const nextIdx = variantsDraft.length + 1;
    const cat = categories.find((c) => c.id === formCategoryId);
    const newSku = generateSku(cat?.name || 'General', formProdName || 'Item', `V${nextIdx}`);
    setVariantsDraft([
      ...variantsDraft,
      {
        name: `Size ${nextIdx}`,
        sku: newSku,
        size: '',
        purchasePriceRs: variantsDraft[0]?.purchasePriceRs || '100',
        sellingPriceRs: variantsDraft[0]?.sellingPriceRs || '140',
        taxRatePercent: '18',
        openingStock: '10',
        minStockLevel: '5',
        rackLocation: variantsDraft[0]?.rackLocation || 'A-1',
      },
    ]);
  };

  const handleRemoveVariantRow = (idx: number) => {
    if (variantsDraft.length <= 1) {
      Alert.alert('Required', 'Product must have at least one variant.');
      return;
    }
    setVariantsDraft(variantsDraft.filter((_, i) => i !== idx));
  };

  const handleUpdateVariantDraft = (idx: number, field: keyof VariantDraft, val: any) => {
    setVariantsDraft((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleSaveProduct = async () => {
    if (!formProdName.trim()) {
      Alert.alert('Required', 'Product name is mandatory');
      return;
    }
    if (!formCategoryId) {
      Alert.alert('Required', 'Please select a Category');
      return;
    }
    if (!formSubcategoryId) {
      Alert.alert('Required', 'Please select a Subcategory');
      return;
    }

    try {
      const storeId = store?.id || 'default-store';

      const allowedUnitsMap: Record<MeasurementType, StandardUnit[]> = {
        count: ['piece', 'set', 'box', 'pack'],
        length: ['mm', 'cm', 'm', 'ft', 'inch'],
        weight: ['g', 'kg'],
        volume: ['ml', 'l'],
        pack: ['box', 'pack', 'piece'],
      };

      const productPayload: Partial<Product> = {
        name: formProdName.trim(),
        categoryId: formCategoryId,
        subcategoryId: formSubcategoryId,
        brand: formBrand.trim(),
        modelNumber: formModelNumber.trim(),
        material: formMaterial.trim(),
        description: formDescription.trim(),
        measurementType: formMeasurementType,
        baseUnit: formBaseUnit,
        allowedUnits: allowedUnitsMap[formMeasurementType],
        pipeDiameterMm: formMeasurementType === 'length' ? parseFloat(formPipeDiameterMm || '0') : undefined,
        standardLengthMm: formMeasurementType === 'length' ? parseFloat(formStandardLengthM || '3') * 1000 : undefined,
        pipeTrackingMethod: formMeasurementType === 'length' ? formPipeTrackingMethod : undefined,
        customValues: customFieldValues,
      };

      const variantsPayload: Array<Partial<ProductVariant>> = variantsDraft.map((v) => ({
        id: v.id,
        name: v.name.trim() || formProdName.trim(),
        sku: v.sku.trim() || generateSku(formBrand, formProdName, v.size || 'std'),
        size: v.size?.trim(),
        color: v.color?.trim(),
        purchasePricePaise: rupeeToPaise(parseFloat(v.purchasePriceRs || '0')),
        sellingPricePaise: rupeeToPaise(parseFloat(v.sellingPriceRs || '0')),
        taxRatePercent: parseFloat(v.taxRatePercent || '18'),
        openingStock: parseFloat(v.openingStock || '0'),
        minStockLevel: parseFloat(v.minStockLevel || '5'),
        rackLocation: v.rackLocation?.trim(),
        preferredSupplierId: formPreferredSupplierId || undefined,
        customValues: v.customValues,
      }));

      if (editingProductId) {
        await ProductRepository.updateProduct(editingProductId, productPayload, variantsPayload, storeId, deviceId);
        Alert.alert('Success', 'Product updated successfully.');
      } else {
        await ProductRepository.createProduct(productPayload, variantsPayload, storeId, deviceId, user?.id);
        Alert.alert('Success', 'New product created with variants & opening stock.');
      }

      setFormVisible(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save product';
      Alert.alert('Save Error', msg);
    }
  };

  const handleArchiveProduct = (prod: Product) => {
    Alert.alert(
      'Archive Product',
      `Are you sure you want to archive "${prod.name}"? Historical bills and purchase records will remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              const storeId = store?.id || 'default-store';
              await ProductRepository.archiveProduct(prod.id, storeId, deviceId);
              Alert.alert('Archived', `"${prod.name}" archived safely.`);
              loadData();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Could not archive';
              Alert.alert('Archive Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleSaveQuickCreate = async () => {
    if (!quickCreateName.trim()) {
      Alert.alert('Required', 'Please enter a name');
      return;
    }
    const storeId = store?.id || 'default-store';

    try {
      if (quickCreateType === 'category') {
        const cat = await CategoryRepository.createCategory(
          { name: quickCreateName.trim(), description: quickCreateExtra },
          storeId,
          deviceId
        );
        await loadData();
        setFormCategoryId(cat.id);
        Alert.alert('Category Created', `Selected "${cat.name}" automatically.`);
      } else if (quickCreateType === 'subcategory') {
        const sub = await CategoryRepository.createSubcategory(
          { categoryId: formCategoryId, name: quickCreateName.trim(), description: quickCreateExtra },
          storeId,
          deviceId
        );
        await loadData();
        setFormSubcategoryId(sub.id);
        Alert.alert('Subcategory Created', `Selected "${sub.name}" automatically.`);
      } else if (quickCreateType === 'brand') {
        setFormBrand(quickCreateName.trim());
      } else if (quickCreateType === 'supplier') {
        const sup = await PartiesRepository.createSupplier(
          { name: quickCreateName.trim(), phone: quickCreateExtra || '9800000000' },
          storeId,
          deviceId
        );
        await loadData();
        setFormPreferredSupplierId(sup.id);
      }
      setQuickCreateType(null);
      setQuickCreateName('');
      setQuickCreateExtra('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Creation failed');
    }
  };

  // Responsive, Instant Filtering: Category Chip + Search Query + Stock Status
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Category Filter
      if (selectedCategory !== null && p.categoryId !== selectedCategory) {
        return false;
      }

      // 2. Search Query Filter (name, brand, model, SKU, variant size/name)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const brandMatch = (p.brand || '').toLowerCase().includes(q);
        const modelMatch = (p.modelNumber || '').toLowerCase().includes(q);
        const skuMatch = p.variants.some(
          (v) =>
            v.sku.toLowerCase().includes(q) ||
            v.name.toLowerCase().includes(q) ||
            (v.size || '').toLowerCase().includes(q)
        );
        if (!nameMatch && !brandMatch && !modelMatch && !skuMatch) {
          return false;
        }
      }

      // 3. Stock Status Filter
      if (stockFilter !== 'all') {
        const totalStock = p.variants.reduce((sum, v) => sum + v.currentStock, 0);
        const minStock = p.variants.reduce((sum, v) => sum + v.minStockLevel, 0);
        if (stockFilter === 'out' && totalStock > 0) return false;
        if (stockFilter === 'low' && (totalStock <= 0 || totalStock > minStock)) return false;
        if (stockFilter === 'in' && totalStock <= minStock) return false;
      }

      return true;
    });
  }, [products, selectedCategory, searchQuery, stockFilter]);

  // Category counts map for category chips
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1);
    }
    return counts;
  }, [products]);

  // Overall Stock counts for filter tabs
  const stockCounts = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    for (const p of products) {
      const totalStock = p.variants.reduce((sum, v) => sum + (v.currentStock || 0), 0);
      const minStock = p.variants.reduce((sum, v) => sum + (v.minStockLevel || 0), 0);
      if (totalStock <= 0) {
        outOfStock++;
      } else if (totalStock <= minStock) {
        lowStock++;
      } else {
        inStock++;
      }
    }

    return { total: products.length, inStock, lowStock, outOfStock };
  }, [products]);

  const getCategoryIcon = (categoryName: string, icon?: string) => {
    const name = categoryName.toLowerCase();
    if (icon === 'pipe' || name.includes('plumb') || name.includes('pipe')) return 'pipe';
    if (icon === 'format-paint' || name.includes('paint')) return 'format-paint';
    if (icon === 'wrench' || icon === 'tools' || name.includes('tool') || name.includes('fasten')) return 'wrench';
    if (icon === 'shower' || name.includes('sanit') || name.includes('bath')) return 'shower';
    if (icon === 'wall' || name.includes('build') || name.includes('adhes')) return 'wall';
    return 'shape-outline';
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Bar with Search & Quick Summary */}
      <Surface style={styles.searchHeaderCard}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Stock & Catalogue</Text>
            <Text style={styles.headerSubtitle}>
              {products.length} products • {filteredProducts.length} filtered
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={handleOpenAddProduct}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.headerAddBtnText}>Add Product</Text>
          </TouchableOpacity>
        </View>

        {/* Floating Custom Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} style={{ marginRight: 6 }} />
          <TextInput
            placeholder="Search by product, brand, SKU or rack location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInputCustom}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </Surface>

      {/* 2. Interactive Stock Status Filter Strip */}
      <View style={styles.stockFilterStrip}>
        <TouchableOpacity
          style={[
            styles.stockFilterTab,
            stockFilter === 'all' && styles.stockFilterTabActive,
          ]}
          onPress={() => setStockFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.stockFilterText, stockFilter === 'all' && styles.stockFilterTextActive]}>
            All ({stockCounts.total})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.stockFilterTab,
            stockFilter === 'in' && styles.stockFilterTabActiveIn,
          ]}
          onPress={() => setStockFilter('in')}
          activeOpacity={0.7}
        >
          <View style={[styles.tabDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.stockFilterText, stockFilter === 'in' && styles.stockFilterTextActiveIn]}>
            In Stock ({stockCounts.inStock})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.stockFilterTab,
            stockFilter === 'low' && styles.stockFilterTabActiveLow,
          ]}
          onPress={() => setStockFilter('low')}
          activeOpacity={0.7}
        >
          <View style={[styles.tabDot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.stockFilterText, stockFilter === 'low' && styles.stockFilterTextActiveLow]}>
            Low ({stockCounts.lowStock})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.stockFilterTab,
            stockFilter === 'out' && styles.stockFilterTabActiveOut,
          ]}
          onPress={() => setStockFilter('out')}
          activeOpacity={0.7}
        >
          <View style={[styles.tabDot, { backgroundColor: colors.danger }]} />
          <Text style={[styles.stockFilterText, stockFilter === 'out' && styles.stockFilterTextActiveOut]}>
            Out ({stockCounts.outOfStock})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Horizontal Category Filter Carousel */}
      <View style={styles.categoryChipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChipsScroll}>
          <TouchableOpacity
            style={[
              styles.categoryChipCustom,
              selectedCategory === null && styles.categoryChipSelected,
            ]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="layers-outline"
              size={15}
              color={selectedCategory === null ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                styles.categoryChipTextCustom,
                selectedCategory === null && styles.categoryChipTextSelected,
              ]}
            >
              All Categories ({products.length})
            </Text>
          </TouchableOpacity>

          {categories.map((c) => {
            const count = categoryCounts.get(c.id) || 0;
            const isSelected = selectedCategory === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.categoryChipCustom,
                  isSelected && styles.categoryChipSelected,
                ]}
                onPress={() => setSelectedCategory(isSelected ? null : c.id)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={getCategoryIcon(c.name, c.icon) as any}
                  size={15}
                  color={isSelected ? '#FFFFFF' : colors.primary}
                />
                <Text
                  style={[
                    styles.categoryChipTextCustom,
                    isSelected && styles.categoryChipTextSelected,
                  ]}
                >
                  {c.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Products List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadData}
        renderItem={({ item }) => {
          const category = categories.find((c) => c.id === item.categoryId);
          const categoryName = category?.name || 'General';
          const subcategoryName = subcategories.find((s) => s.id === item.subcategoryId)?.name || '';

          const totalStock = item.variants.reduce((sum, v) => sum + (v.currentStock || 0), 0);
          const minStock = item.variants.reduce((sum, v) => sum + (v.minStockLevel || 0), 0);
          const isOut = totalStock <= 0;
          const isLow = !isOut && totalStock <= minStock;

          return (
            <Surface style={styles.productCard}>
              {/* Card Header: Category & Brand + Stock Health Badge */}
              <View style={styles.productCardHeader}>
                <View style={{ flex: 1, paddingRight: spacing.xs }}>
                  <View style={styles.tagsRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{categoryName}</Text>
                    </View>
                    {item.brand ? (
                      <View style={styles.brandBadge}>
                        <Text style={styles.brandBadgeText}>{item.brand}</Text>
                      </View>
                    ) : null}
                    <View style={styles.measurementBadge}>
                      <Text style={styles.measurementBadgeText}>
                        {item.measurementType.toUpperCase()} • {item.baseUnit}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.productName}>{item.name}</Text>

                  {subcategoryName || item.material || item.modelNumber ? (
                    <Text style={styles.productMeta}>
                      {subcategoryName ? `${subcategoryName}` : ''}
                      {item.material ? ` • ${item.material}` : ''}
                      {item.modelNumber ? ` • ${item.modelNumber}` : ''}
                    </Text>
                  ) : null}
                </View>

                {/* Overall Stock Status Indicator */}
                <View
                  style={[
                    styles.productStockBadge,
                    isOut ? styles.badgeOut : isLow ? styles.badgeLow : styles.badgeHealthy,
                  ]}
                >
                  <Text
                    style={[
                      styles.productStockBadgeText,
                      isOut ? styles.textOut : isLow ? styles.textLow : styles.textHealthy,
                    ]}
                  >
                    {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                  </Text>
                </View>
              </View>

              {/* Variants Section with Individual SKU Cards */}
              <View style={styles.variantsContainer}>
                {item.variants.map((v, vIdx) => {
                  const vOut = (v.currentStock ?? 0) <= 0;
                  const vLow = !vOut && (v.currentStock ?? 0) <= (v.minStockLevel ?? 0);

                  return (
                    <View
                      key={v.id}
                      style={[
                        styles.variantCard,
                        vIdx !== item.variants.length - 1 && styles.variantBorderBottom,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.variantTitle}>
                          {v.name} {v.size ? `(${v.size})` : ''}
                        </Text>

                        <View style={styles.variantDetailsRow}>
                          <Text style={styles.variantSku}>SKU: {v.sku}</Text>
                          {v.rackLocation ? (
                            <View style={styles.rackLocationBadge}>
                              <MaterialCommunityIcons name="map-marker-outline" size={11} color={colors.textSecondary} />
                              <Text style={styles.rackLocationText}>{v.rackLocation}</Text>
                            </View>
                          ) : null}
                        </View>

                        {v.purchasePricePaise ? (
                          <Text style={styles.costPriceText}>
                            Cost: {formatPaiseToINR(v.purchasePricePaise)}
                          </Text>
                        ) : null}
                      </View>

                      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                        <View
                          style={[
                            styles.stockLevelPill,
                            vOut ? styles.pillOut : vLow ? styles.pillLow : styles.pillHealthy,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stockLevelPillText,
                              vOut ? styles.pillTextOut : vLow ? styles.pillTextLow : styles.pillTextHealthy,
                            ]}
                          >
                            {vOut
                              ? `0 ${item.baseUnit}`
                              : vLow
                              ? `${v.currentStock} ${item.baseUnit} (Min: ${v.minStockLevel})`
                              : `${v.currentStock} ${item.baseUnit}`}
                          </Text>
                        </View>
                        <Text style={styles.sellingPriceText}>
                          {formatPaiseToINR(v.sellingPricePaise)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Action Buttons Footer */}
              <View style={styles.productCardFooter}>
                <TouchableOpacity
                  style={styles.cardFooterActionBtn}
                  onPress={() => router.push('/(tabs)/purchases')}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="truck-delivery-outline" size={16} color={colors.primary} />
                  <Text style={styles.cardFooterActionText}>Stock Inward</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.cardFooterEditBtn}
                    onPress={() => handleOpenEditProduct(item)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.cardFooterEditText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cardFooterArchiveBtn}
                    onPress={() => handleArchiveProduct(item)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="archive-arrow-down-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </Surface>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Surface style={styles.emptyContainer}>
              <MaterialCommunityIcons name="package-variant-closed" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No products matching criteria</Text>
              <Text style={styles.emptySubtitle}>
                Try changing category filter or search keywords.
              </Text>
              <Button
                mode="contained"
                onPress={handleOpenAddProduct}
                style={{ marginTop: spacing.md, backgroundColor: colors.primary }}
              >
                + Add New Product
              </Button>
            </Surface>
          ) : null
        }
      />

      {/* Floating Add Product Button */}
      <TouchableOpacity
        style={styles.fabBtn}
        onPress={handleOpenAddProduct}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>

      {/* 5. ADD / EDIT PRODUCT MODAL (Guided Mobile Single-Column Form) */}
      <Portal>
        <Dialog
          visible={formVisible}
          onDismiss={() => setFormVisible(false)}
          style={styles.modalDialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            {editingProductId ? 'Edit Product' : 'Add New Product'}
          </Dialog.Title>

          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {/* Section 1: Basic Information */}
              <Text style={styles.formSectionHeader}>1. Basic Information</Text>

              <TextInput
                label="Product Name *"
                value={formProdName}
                onChangeText={setFormProdName}
                mode="outlined"
                style={styles.formInput}
                placeholder="e.g. Astral CPVC Pro Pipe"
              />

              <View style={styles.fieldRow}>
                <TextInput
                  label="Brand"
                  value={formBrand}
                  onChangeText={setFormBrand}
                  mode="outlined"
                  style={[styles.formInput, { flex: 1, marginRight: spacing.xs }]}
                />
                <TextInput
                  label="Model Number"
                  value={formModelNumber}
                  onChangeText={setFormModelNumber}
                  mode="outlined"
                  style={[styles.formInput, { flex: 1, marginLeft: spacing.xs }]}
                />
              </View>

              <TextInput
                label="Description"
                value={formDescription}
                onChangeText={setFormDescription}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.formInput}
              />

              {/* Section 2: Category & Subcategory */}
              <Text style={styles.formSectionHeader}>2. Category & Subcategory</Text>

              {/* Category Picker Row */}
              <View style={styles.pickerHeaderRow}>
                <Text style={styles.fieldSublabel}>Category:</Text>
                <TouchableOpacity
                  onPress={() => {
                    setQuickCreateType('category');
                    setQuickCreateName('');
                  }}
                >
                  <Text style={styles.inlineActionText}>+ New Category</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    selected={formCategoryId === c.id}
                    onPress={() => setFormCategoryId(c.id)}
                    style={[styles.selectorChip, formCategoryId === c.id && styles.selectorChipSelected]}
                    textStyle={[styles.selectorChipText, formCategoryId === c.id && styles.selectorChipTextSelected]}
                    showSelectedOverlay={false}
                  >
                    {c.name}
                  </Chip>
                ))}
              </ScrollView>

              {/* Subcategory Picker Row */}
              <View style={styles.pickerHeaderRow}>
                <Text style={styles.fieldSublabel}>Subcategory:</Text>
                <TouchableOpacity
                  onPress={() => {
                    setQuickCreateType('subcategory');
                    setQuickCreateName('');
                  }}
                >
                  <Text style={styles.inlineActionText}>+ New Subcategory</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {subcategories
                  .filter((s) => !formCategoryId || s.categoryId === formCategoryId)
                  .map((s) => (
                    <Chip
                      key={s.id}
                      selected={formSubcategoryId === s.id}
                      onPress={() => setFormSubcategoryId(s.id)}
                      style={[styles.selectorChip, formSubcategoryId === s.id && styles.selectorChipSelected]}
                      textStyle={[styles.selectorChipText, formSubcategoryId === s.id && styles.selectorChipTextSelected]}
                      showSelectedOverlay={false}
                    >
                      {s.name}
                    </Chip>
                  ))}
              </ScrollView>

              {/* Section 3: Product Type & Units */}
              <Text style={styles.formSectionHeader}>3. Product Type & Units</Text>

              <SegmentedButtons
                value={formMeasurementType}
                onValueChange={(val) => {
                  setFormMeasurementType(val as any);
                  if (val === 'length') setFormBaseUnit('m');
                  else if (val === 'weight') setFormBaseUnit('kg');
                  else if (val === 'volume') setFormBaseUnit('l');
                  else if (val === 'pack') setFormBaseUnit('box');
                  else setFormBaseUnit('piece');
                }}
                buttons={[
                  { value: 'count', label: 'Piece' },
                  { value: 'length', label: 'Length' },
                  { value: 'weight', label: 'Weight' },
                  { value: 'pack', label: 'Pack' },
                ]}
                style={{ marginBottom: spacing.sm }}
              />

              {formMeasurementType === 'length' && (
                <View style={styles.pipeConfigCard}>
                  <Text style={styles.pipeConfigTitle}>Pipe Configuration</Text>
                  <View style={styles.fieldRow}>
                    <TextInput
                      label="Outer Diameter (mm)"
                      value={formPipeDiameterMm}
                      onChangeText={setFormPipeDiameterMm}
                      keyboardType="numeric"
                      mode="outlined"
                      style={[styles.formInput, { flex: 1, marginRight: spacing.xs }]}
                    />
                    <TextInput
                      label="Standard Length (m)"
                      value={formStandardLengthM}
                      onChangeText={setFormStandardLengthM}
                      keyboardType="numeric"
                      mode="outlined"
                      style={[styles.formInput, { flex: 1, marginLeft: spacing.xs }]}
                    />
                  </View>
                </View>
              )}

              {/* Section 4: Dynamic Custom Specifications */}
              {availableCustomFields.length > 0 && (
                <>
                  <Text style={styles.formSectionHeader}>4. Custom Specifications</Text>
                  {availableCustomFields.map((field) => (
                    <View key={field.id} style={{ marginBottom: spacing.xs }}>
                      <TextInput
                        label={`${field.label} ${field.unit ? `(${field.unit})` : ''}`}
                        value={customFieldValues[field.name] || ''}
                        onChangeText={(txt) => setCustomFieldValues({ ...customFieldValues, [field.name]: txt })}
                        mode="outlined"
                        style={styles.formInput}
                      />
                    </View>
                  ))}
                </>
              )}

              {/* Section 5: Variants & Sizes */}
              <View style={styles.variantsHeaderRow}>
                <Text style={styles.formSectionHeader}>5. Sizes & Variants</Text>
                <TouchableOpacity onPress={handleAddVariantRow}>
                  <Text style={styles.inlineActionText}>+ Add Variant</Text>
                </TouchableOpacity>
              </View>

              {variantsDraft.map((v, idx) => (
                <Surface key={idx} style={styles.variantDraftCard}>
                  <View style={styles.variantDraftHeader}>
                    <Text style={styles.variantDraftTitle}>Variant #{idx + 1}</Text>
                    {variantsDraft.length > 1 && (
                      <TouchableOpacity onPress={() => handleRemoveVariantRow(idx)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.fieldRow}>
                    <TextInput
                      label="Size / Name *"
                      value={v.size}
                      onChangeText={(txt) => handleUpdateVariantDraft(idx, 'size', txt)}
                      mode="outlined"
                      style={[styles.formInput, { flex: 1, marginRight: spacing.xs }]}
                      placeholder="e.g. 20mm"
                    />
                    <TextInput
                      label="SKU Code"
                      value={v.sku}
                      onChangeText={(txt) => handleUpdateVariantDraft(idx, 'sku', txt)}
                      mode="outlined"
                      style={[styles.formInput, { flex: 1, marginLeft: spacing.xs }]}
                    />
                  </View>

                  <View style={styles.fieldRow}>
                    <TextInput
                      label="Purchase Cost (₹)"
                      value={v.purchasePriceRs}
                      onChangeText={(txt) => handleUpdateVariantDraft(idx, 'purchasePriceRs', txt)}
                      keyboardType="numeric"
                      mode="outlined"
                      style={[styles.formInput, { flex: 1, marginRight: spacing.xs }]}
                    />
                    <TextInput
                      label="Selling Price (₹) *"
                      value={v.sellingPriceRs}
                      onChangeText={(txt) => handleUpdateVariantDraft(idx, 'sellingPriceRs', txt)}
                      keyboardType="numeric"
                      mode="outlined"
                      style={[styles.formInput, { flex: 1, marginLeft: spacing.xs }]}
                    />
                  </View>

                  <View style={styles.fieldRow}>
                    <TextInput
                      label="Opening Stock"
                      value={v.openingStock}
                      onChangeText={(txt) => handleUpdateVariantDraft(idx, 'openingStock', txt)}
                      keyboardType="numeric"
                      mode="outlined"
                      style={[styles.formInput, { flex: 1, marginRight: spacing.xs }]}
                    />
                    <TextInput
                      label="Min Stock Threshold"
                      value={v.minStockLevel}
                      onChangeText={(txt) => handleUpdateVariantDraft(idx, 'minStockLevel', txt)}
                      keyboardType="numeric"
                      mode="outlined"
                      style={[styles.formInput, { flex: 1, marginLeft: spacing.xs }]}
                    />
                  </View>

                  <TextInput
                    label="Rack / Shelf Location"
                    value={v.rackLocation}
                    onChangeText={(txt) => handleUpdateVariantDraft(idx, 'rackLocation', txt)}
                    mode="outlined"
                    style={styles.formInput}
                    placeholder="e.g. A-12"
                  />
                </Surface>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>

          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setFormVisible(false)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveProduct}
              style={styles.primarySaveBtn}
            >
              Save Product
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 6. Quick Create Dialog (Categories / Subcategories / Brands / Suppliers) */}
      <Portal>
        <Dialog
          visible={quickCreateType !== null}
          onDismiss={() => setQuickCreateType(null)}
          style={styles.quickDialog}
        >
          <Dialog.Title style={styles.quickDialogTitle}>
            Create New {quickCreateType === 'category' ? 'Category' : quickCreateType === 'subcategory' ? 'Subcategory' : quickCreateType}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name *"
              value={quickCreateName}
              onChangeText={setQuickCreateName}
              mode="outlined"
              style={styles.formInput}
            />
            {quickCreateType === 'category' || quickCreateType === 'subcategory' ? (
              <TextInput
                label="Description"
                value={quickCreateExtra}
                onChangeText={setQuickCreateExtra}
                mode="outlined"
                style={styles.formInput}
              />
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setQuickCreateType(null)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveQuickCreate}
              style={{ backgroundColor: colors.primary }}
            >
              Create & Select
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchHeaderCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.card,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    gap: 6,
    ...shadows.sm,
  },
  headerAddBtnText: {
    ...typography.labelMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  searchInputCustom: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  stockFilterStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stockFilterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  stockFilterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stockFilterTabActiveIn: {
    backgroundColor: '#ECFDF5',
    borderColor: colors.success,
  },
  stockFilterTabActiveLow: {
    backgroundColor: '#FFFBEB',
    borderColor: colors.warning,
  },
  stockFilterTabActiveOut: {
    backgroundColor: '#FEF2F2',
    borderColor: colors.danger,
  },
  stockFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stockFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryChipsContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs + 2,
  },
  categoryChipsScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  categoryChipCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipTextCustom: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 90,
  },
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  brandBadge: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  measurementBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  measurementBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  productName: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  productMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  productStockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  badgeHealthy: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  badgeLow: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
  },
  badgeOut: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
  },
  productStockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textHealthy: {
    color: colors.success,
  },
  textLow: {
    color: colors.warning,
  },
  textOut: {
    color: colors.danger,
  },
  variantsContainer: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    marginVertical: spacing.sm,
  },
  variantCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
  },
  variantBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  variantTitle: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  variantDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  variantSku: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  rackLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  rackLocationText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  costPriceText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  stockLevelPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    marginBottom: 2,
  },
  pillHealthy: {
    backgroundColor: '#DCFCE7',
  },
  pillLow: {
    backgroundColor: '#FEF3C7',
  },
  pillOut: {
    backgroundColor: '#FEE2E2',
  },
  stockLevelPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillTextHealthy: {
    color: '#15803D',
  },
  pillTextLow: {
    color: '#B45309',
  },
  pillTextOut: {
    color: '#B91C1C',
  },
  sellingPriceText: {
    ...typography.currencyMedium,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  productCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 2,
    marginTop: 2,
  },
  cardFooterActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  cardFooterActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  cardFooterEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardFooterEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardFooterArchiveBtn: {
    padding: 6,
    borderRadius: borderRadius.sm,
  },
  fabBtn: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
  emptyContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xl,
  },
  emptyTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalDialog: {
    backgroundColor: colors.surface,
    maxHeight: '90%',
    borderRadius: borderRadius.lg,
  },
  dialogTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    paddingBottom: 4,
  },
  dialogScrollArea: {
    paddingHorizontal: spacing.md,
  },
  modalScrollContent: {
    paddingBottom: spacing.lg,
  },
  formSectionHeader: {
    ...typography.labelLarge,
    color: colors.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  fieldSublabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  inlineActionText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '600',
  },
  selectorScroll: {
    marginBottom: spacing.sm,
  },
  selectorChip: {
    backgroundColor: colors.surfaceSubtle,
    marginRight: 6,
    borderColor: colors.border,
    borderWidth: 1,
    height: 32,
  },
  selectorChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectorChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectorChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pipeConfigCard: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  pipeConfigTitle: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  variantsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  variantDraftCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantDraftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  variantDraftTitle: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  dialogActions: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primarySaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    minWidth: 120,
  },
  quickDialog: {
    backgroundColor: colors.surface,
  },
  quickDialogTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
});
