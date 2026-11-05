import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  StatusBar as RNStatusBar,
  TextInput as RNTextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  Surface,
  Portal,
  Dialog,
  TextInput,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import { Category, Subcategory } from '@hardware-store/shared';
import { useAppStore } from '../../src/store/useAppStore.js';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { CategoryRepository } from '../../src/database/repositories/categoryRepository.js';
import { MatrixRepository } from '../../src/database/repositories/matrixRepository.js';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import { BackupService, StoreBackupPackage, LocalBackupInfo } from '../../src/services/BackupService.js';
import { lightColors, darkColors, spacing, borderRadius, shadows } from '../../src/theme/tokens.js';

export default function SettingsScreen() {
  const { store, deviceId, isDarkMode, toggleTheme, showToast, showConfirm } = useAppStore();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web'
    ? 0
    : Math.max(
        insets.top || 0,
        (Platform.OS === 'android' ? RNStatusBar.currentHeight : 0) || 0,
        40
      );
  const activeColors = isDarkMode ? darkColors : lightColors;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySubcategories, setCategorySubcategories] = useState<Record<string, Subcategory[]>>({});
  const [loading, setLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorePreviewPkg, setRestorePreviewPkg] = useState<StoreBackupPackage | null>(null);
  const [restoreDialogVisible, setRestoreDialogVisible] = useState(false);
  const [localBackupsModalVisible, setLocalBackupsModalVisible] = useState(false);
  const [localBackups, setLocalBackups] = useState<LocalBackupInfo[]>([]);
  const [expandedCatIds, setExpandedCatIds] = useState<Set<string>>(new Set());
  const [catSearchQuery, setCatSearchQuery] = useState('');

  const toggleExpandCategory = (catId: string) => {
    setExpandedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const allExpanded =
    categories.length > 0 && categories.every((c) => expandedCatIds.has(c.id));

  const handleToggleExpandAll = () => {
    if (allExpanded) {
      setExpandedCatIds(new Set());
    } else {
      setExpandedCatIds(new Set(categories.map((c) => c.id)));
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearchQuery.trim().toLowerCase())
  );

  // Add / Edit Category Dialog
  const [catDialogVisible, setCatDialogVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catNameInput, setCatNameInput] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const storeId = store?.id || 'store-1';
      const cats = await ProductRepository.getCategories(storeId);
      setCategories(cats);

      const subcatMap: Record<string, Subcategory[]> = {};
      await Promise.all(
        cats.map(async (cat) => {
          const subs = await ProductRepository.getSubcategories(cat.id, storeId);
          subcatMap[cat.id] = (subs || []).filter(
            (s) => !s.name.toLowerCase().includes('angle')
          );
        })
      );
      setCategorySubcategories(subcatMap);
    } catch (err) {
      console.error('Error loading settings categories:', err);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Category Actions
  const handleOpenAddCategory = () => {
    setEditingCat(null);
    setCatNameInput('');
    setCatDialogVisible(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setCatNameInput(cat.name);
    setCatDialogVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!catNameInput.trim()) {
      showToast('Please enter a category name.', 'warning');
      return;
    }

    try {
      const storeId = store?.id || 'store-1';
      if (editingCat) {
        await CategoryRepository.updateCategory(
          editingCat.id,
          { name: catNameInput.trim() },
          storeId,
          deviceId
        );
        showToast(`Category "${catNameInput.trim()}" updated.`, 'success');
      } else {
        await ProductRepository.createCategory(
          { name: catNameInput.trim(), displayOrder: categories.length },
          storeId,
          deviceId
        );
        showToast(`Category "${catNameInput.trim()}" created.`, 'success');
      }

      setCatDialogVisible(false);
      setEditingCat(null);
      setCatNameInput('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save category';
      showToast(msg, 'error');
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    showConfirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete category "${cat.name}"? Products in this category will remain intact.`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const storeId = store?.id || 'store-1';
          await CategoryRepository.archiveCategory(cat.id, storeId, deviceId);
          showToast(`Category "${cat.name}" deleted.`, 'success');
          await loadData();
        } catch (err) {
          showToast('Could not delete category.', 'error');
        }
      },
    });
  };

  const handleDeleteSubcategory = (sub: Subcategory) => {
    showConfirm({
      title: 'Delete Section',
      message: `Are you sure you want to delete section "${sub.name}"? Items in this section will be removed from the table.`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const storeId = store?.id || 'store-1';
          // Optimistically update UI so the chip disappears instantly
          setCategorySubcategories((prev) => ({
            ...prev,
            [sub.categoryId]: (prev[sub.categoryId] || []).filter((s) => s.id !== sub.id),
          }));
          await MatrixRepository.deleteSubTab(storeId, sub.id, deviceId);
          showToast(`Section "${sub.name}" deleted.`, 'success');
          await loadData();
        } catch (err: any) {
          console.error('Error deleting section:', err);
          showToast(err?.message || 'Could not delete section.', 'error');
          await loadData();
        }
      },
    });
  };

  // Export Stock CSV
  const handleExportCSV = async () => {
    try {
      const storeId = store?.id || 'store-1';
      const prods = await ProductRepository.getProductsWithVariants(storeId);
      const cats = await ProductRepository.getCategories(storeId);
      const catMap = new Map<string, string>();
      cats.forEach((c) => catMap.set(c.id, c.name));

      let csv = 'Product Name,Brand,Category,Size/Variant,Selling Price (Rs),Cost Price (Rs),Stock Units,Unit,Min Alert,Rack Location\n';

      for (const p of prods) {
        const cat = catMap.get(p.categoryId) || 'General';
        for (const v of p.variants) {
          const row = [
            `"${(p.name || '').replace(/"/g, '""')}"`,
            `"${(p.brand || '').replace(/"/g, '""')}"`,
            `"${cat.replace(/"/g, '""')}"`,
            `"${(v.name || v.size || 'Standard').replace(/"/g, '""')}"`,
            ((v.sellingPricePaise || 0) / 100).toFixed(2),
            ((v.purchasePricePaise || 0) / 100).toFixed(2),
            v.currentStock || 0,
            `"${p.baseUnit || 'pcs'}"`,
            v.minStockLevel || 5,
            `"${(v.rackLocation || '').replace(/"/g, '""')}"`,
          ].join(',');
          csv += row + '\n';
        }
      }

      // Web Download
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Stock_Export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Stock catalogue downloaded as CSV spreadsheet.', 'success');
      } else {
        // Native Mobile
        try {
          const FileSystem = require('expo-file-system/legacy');
          const fileUri = `${FileSystem.documentDirectory}stock_catalogue.csv`;
          await FileSystem.writeAsStringAsync(fileUri, csv, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
          } else {
            showToast(`CSV saved to ${fileUri}`, 'success');
          }
        } catch {
          showToast(`CSV file generated with ${prods.length} products.`, 'success');
        }
      }
    } catch (e) {
      showToast('Could not export catalogue.', 'error');
    }
  };

  const handleClearHistory = () => {
    showConfirm({
      title: 'Clear Movement History',
      message:
        'Are you sure you want to permanently delete all stock transaction and sales audit history? Current stock numbers in the table will not be changed.',
      confirmText: 'Clear History',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const storeId = store?.id || 'store-1';
          await InventoryRepository.clearStockHistory(storeId);
          showToast('Stock movement history cleared successfully!', 'success');
        } catch (err: any) {
          console.error('Error clearing history:', err);
          showToast(err?.message || 'Could not clear history', 'error');
        }
      },
    });
  };

  // Full Store Backup
  const handleCreateBackup = async () => {
    try {
      setIsBackingUp(true);
      const storeId = store?.id || 'store-1';
      const result = await BackupService.exportBackupToFile(storeId);
      if (result.success) {
        showToast('Store backup created & ready to save/share.', 'success');
      } else {
        showToast(result.error || 'Could not export backup.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error creating backup.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Pick Backup File to Restore
  const handlePickAndRestoreBackup = async () => {
    try {
      const pickRes = await BackupService.pickBackupFile();
      if (pickRes.canceled || !pickRes.fileContent) {
        return;
      }
      const validation = BackupService.validateBackupString(pickRes.fileContent);
      if (!validation.valid || !validation.pkg) {
        showToast(validation.error || 'Selected file is not a valid Manju Stores backup.', 'error');
        return;
      }
      setRestorePreviewPkg(validation.pkg);
      setRestoreDialogVisible(true);
    } catch (err: any) {
      showToast(err?.message || 'Failed to read backup file.', 'error');
    }
  };

  // Confirm Restore
  const handleConfirmRestore = async () => {
    if (!restorePreviewPkg) return;
    try {
      setIsRestoring(true);
      setRestoreDialogVisible(false);
      const storeId = store?.id || 'store-1';
      const res = await BackupService.restoreBackup(restorePreviewPkg, storeId);
      if (res.success) {
        if (restorePreviewPkg.data?.stores && restorePreviewPkg.data.stores.length > 0) {
          useAppStore.getState().setStore(restorePreviewPkg.data.stores[0]);
        }
        showToast('Store data successfully restored!', 'success');
        await loadData();
      } else {
        showToast(res.error || 'Restore failed. Data safely preserved.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error restoring backup.', 'error');
    } finally {
      setIsRestoring(false);
      setRestorePreviewPkg(null);
    }
  };

  // Local Backups Modal
  const handleOpenLocalBackups = async () => {
    try {
      const list = await BackupService.getLocalBackups();
      setLocalBackups(list);
      setLocalBackupsModalVisible(true);
    } catch (e) {
      showToast('Could not load local backups.', 'warning');
    }
  };

  const handleRestoreFromLocalFile = async (item: LocalBackupInfo) => {
    try {
      const content = await BackupService.readUriContent(item.uri);
      const validation = BackupService.validateBackupString(content);
      if (!validation.valid || !validation.pkg) {
        showToast('Local backup is invalid or corrupted.', 'error');
        return;
      }
      setLocalBackupsModalVisible(false);
      setRestorePreviewPkg(validation.pkg);
      setRestoreDialogVisible(true);
    } catch (err: any) {
      showToast('Error reading local backup.', 'error');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: activeColors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(topInset + 8, spacing.lg) },
      ]}
    >
      {/* 1. Header */}
      {/* 1. Header with Store Logo */}
      <Surface
        style={[
          styles.headerCard,
          {
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
          },
        ]}
      >
        <View
          style={[
            styles.headerLogoWrapper,
            {
              backgroundColor: '#000000',
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogoImage}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: activeColors.textPrimary }]}>
            MANJU STORES
          </Text>
          <Text style={[styles.headerSub, { color: activeColors.textSecondary }]}>
            Store Settings & Operations
          </Text>
        </View>
      </Surface>

      {/* 2. Appearance / Dark Mode Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: activeColors.textPrimary }]}>
          Appearance
        </Text>
      </View>

      <Surface
        style={[
          styles.card,
          {
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
          },
        ]}
      >
        <View style={styles.themeRow}>
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: isDarkMode ? '#1E293B' : '#FEF3C7' },
            ]}
          >
            <MaterialCommunityIcons
              name={isDarkMode ? 'weather-night' : 'white-balance-sunny'}
              size={20}
              color={isDarkMode ? '#60A5FA' : '#D97706'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: activeColors.textPrimary }]}>
              {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.themeToggleBtn,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isDarkMode ? 'weather-night' : 'white-balance-sunny'}
              size={16}
              color={isDarkMode ? '#60A5FA' : '#1E3A8A'}
            />
            <Text
              style={[
                styles.themeToggleText,
                { color: isDarkMode ? '#60A5FA' : '#1E3A8A' },
              ]}
            >
              {isDarkMode ? 'Dark' : 'Light'}
            </Text>
          </TouchableOpacity>
        </View>
      </Surface>

      {/* 4. Categories Management */}
      <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
        <View style={styles.catHeaderLeft}>
          <Text style={[styles.sectionTitle, { color: activeColors.textPrimary }]}>
            Categories ({categories.length})
          </Text>
          {categories.length > 1 && (
            <TouchableOpacity
              onPress={handleToggleExpandAll}
              style={[
                styles.expandAllBtn,
                {
                  backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#EEF2FF',
                },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.expandAllText, { color: activeColors.primary }]}>
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.addCategoryBtn} onPress={handleOpenAddCategory}>
          <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
          <Text style={styles.addCategoryBtnText}>Add Category</Text>
        </TouchableOpacity>
      </View>

      {/* Category Search Input (for stores with many categories) */}
      {categories.length >= 3 && (
        <View
          style={[
            styles.catSearchContainer,
            {
              backgroundColor: activeColors.surface,
              borderColor: activeColors.border,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={18}
            color={activeColors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <RNTextInput
            value={catSearchQuery}
            onChangeText={setCatSearchQuery}
            placeholder="Search categories..."
            placeholderTextColor={activeColors.textMuted}
            style={[
              styles.catSearchInput,
              {
                color: activeColors.textPrimary,
              },
            ]}
          />
          {catSearchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setCatSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={16}
                color={activeColors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Surface
        style={[
          styles.card,
          {
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
          },
        ]}
      >
        {categories.length === 0 ? (
          <View style={styles.catEmptyState}>
            <MaterialCommunityIcons
              name="shape-outline"
              size={32}
              color={activeColors.textMuted}
            />
            <Text style={[styles.catEmptyText, { color: activeColors.textMuted }]}>
              No categories added yet. Tap '+ Add Category' to get started.
            </Text>
          </View>
        ) : filteredCategories.length === 0 ? (
          <View style={styles.catEmptyState}>
            <MaterialCommunityIcons
              name="magnify-close"
              size={28}
              color={activeColors.textMuted}
            />
            <Text style={[styles.catEmptyText, { color: activeColors.textMuted }]}>
              No categories found matching "{catSearchQuery.trim()}"
            </Text>
            <TouchableOpacity
              style={styles.catClearSearchBtn}
              onPress={() => setCatSearchQuery('')}
            >
              <Text style={[styles.catClearSearchText, { color: activeColors.primary }]}>
                Clear Search
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredCategories.map((cat, idx) => {
            const isExpanded = expandedCatIds.has(cat.id);
            const subs = categorySubcategories[cat.id] || [];
            const subCount = subs.length;

            return (
              <View key={cat.id}>
                <TouchableOpacity
                  style={styles.catItemRow}
                  activeOpacity={0.7}
                  onPress={() => toggleExpandCategory(cat.id)}
                >
                  <View
                    style={[
                      styles.catIconCircle,
                      { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="shape-outline"
                      size={18}
                      color={activeColors.primary}
                    />
                  </View>

                  <View style={styles.catInfoCol}>
                    <View style={styles.catTitleRow}>
                      <Text
                        style={[styles.catItemName, { color: activeColors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                      <View
                        style={[
                          styles.catCountBadge,
                          {
                            backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#F1F5F9',
                            borderColor: activeColors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.catCountBadgeText, { color: activeColors.textSecondary }]}
                        >
                          {subCount} {subCount === 1 ? 'section' : 'sections'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.catItemSubtitle, { color: activeColors.textMuted }]}>
                      {isExpanded ? 'Tap to collapse' : 'Tap to manage sections'}
                    </Text>
                  </View>

                  <View style={styles.catItemActions}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleOpenEditCategory(cat);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      style={styles.catActionIcon}
                    >
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={18}
                        color={activeColors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleDeleteCategory(cat);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      style={styles.catActionIcon}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                    <View style={styles.catChevron}>
                      <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={activeColors.textSecondary}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Sub-tabs / Sections under this Category (Collapsible & Scroll-limited) */}
                {isExpanded && (
                  <View
                    style={[
                      styles.subcatsContainer,
                      {
                        backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                        borderColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.subcatsHeaderRow}>
                      <View style={styles.subcatsTitleGroup}>
                        <MaterialCommunityIcons
                          name="view-grid-outline"
                          size={13}
                          color={activeColors.primary}
                        />
                        <Text style={[styles.subcatsLabel, { color: activeColors.textSecondary }]}>
                          Sections / Tabs ({subCount})
                        </Text>
                      </View>
                      {subCount > 0 && (
                        <Text style={[styles.subcatsHint, { color: activeColors.textMuted }]}>
                          Tap 🗑 to remove tab
                        </Text>
                      )}
                    </View>

                    {subCount > 0 ? (
                      <ScrollView
                        style={styles.subcatsScrollView}
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                      >
                        <View style={styles.subcatsChipsRow}>
                          {subs.map((sub) => (
                            <View
                              key={sub.id}
                              style={[
                                styles.subcatChip,
                                {
                                  backgroundColor: isDarkMode ? activeColors.surface : '#FFFFFF',
                                  borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                                },
                              ]}
                            >
                              <Text
                                style={[styles.subcatChipText, { color: activeColors.textPrimary }]}
                                numberOfLines={1}
                              >
                                {sub.name}
                              </Text>
                              <TouchableOpacity
                                onPress={() => handleDeleteSubcategory(sub)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.subcatDeleteBtn}
                              >
                                <MaterialCommunityIcons
                                  name="trash-can-outline"
                                  size={14}
                                  color="#EF4444"
                                />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    ) : (
                      <View style={styles.subcatEmptyNotice}>
                        <Text
                          style={[styles.subcatEmptyNoticeText, { color: activeColors.textMuted }]}
                        >
                          No sections created yet for this category.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {idx !== filteredCategories.length - 1 && (
                  <Divider
                    style={[
                      styles.divider,
                      { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' },
                    ]}
                  />
                )}
              </View>
            );
          })
        )}
      </Surface>

      {/* 5. Data & Export */}
      <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
        <Text style={[styles.sectionTitle, { color: activeColors.textPrimary }]}>
          Data & Backup
        </Text>
      </View>

      <Surface
        style={[
          styles.card,
          {
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
          },
        ]}
      >
        {/* Full Store Backup (WhatsApp / Drive / Storage) */}
        <TouchableOpacity
          style={styles.menuRow}
          onPress={handleCreateBackup}
          activeOpacity={0.7}
          disabled={isBackingUp}
        >
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5' },
            ]}
          >
            <MaterialCommunityIcons name="cloud-upload" size={22} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: activeColors.textPrimary }]}>
              {isBackingUp ? 'Creating Backup Package...' : 'Create Full Store Backup'}
            </Text>
            <Text style={[styles.menuSub, { color: activeColors.textSecondary }]}>
              Save full inventory & bills to WhatsApp, Google Drive, or Storage
            </Text>
          </View>
          <MaterialCommunityIcons name="share-variant-outline" size={20} color={activeColors.primary} />
        </TouchableOpacity>

        <Divider
          style={[
            styles.divider,
            { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' },
          ]}
        />

        {/* Restore Store from Backup */}
        <TouchableOpacity
          style={styles.menuRow}
          onPress={handlePickAndRestoreBackup}
          activeOpacity={0.7}
          disabled={isRestoring}
        >
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE' },
            ]}
          >
            <MaterialCommunityIcons name="cloud-download" size={22} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: activeColors.textPrimary }]}>
              {isRestoring ? 'Restoring Store Data...' : 'Restore Store from Backup'}
            </Text>
            <Text style={[styles.menuSub, { color: activeColors.textSecondary }]}>
              Restore products, categories & transactions from a backup file
            </Text>
          </View>
          <MaterialCommunityIcons name="folder-open-outline" size={20} color={activeColors.primary} />
        </TouchableOpacity>

        <Divider
          style={[
            styles.divider,
            { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' },
          ]}
        />

        {/* Automatic Daily Backups */}
        <TouchableOpacity
          style={styles.menuRow}
          onPress={handleOpenLocalBackups}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: isDarkMode ? '#312E81' : '#EDE9FE' },
            ]}
          >
            <MaterialCommunityIcons name="history" size={22} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: activeColors.textPrimary }]}>
              Automatic Daily Backups
            </Text>
            <Text style={[styles.menuSub, { color: activeColors.textSecondary }]}>
              View & restore rolling 7-day automatic device snapshots
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={activeColors.textMuted} />
        </TouchableOpacity>

        <Divider
          style={[
            styles.divider,
            { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' },
          ]}
        />

        {/* Export CSV */}
        <TouchableOpacity style={styles.menuRow} onPress={handleExportCSV} activeOpacity={0.7}>
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: isDarkMode ? '#052E16' : '#DCFCE7' },
            ]}
          >
            <MaterialCommunityIcons name="file-excel-box" size={22} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: activeColors.textPrimary }]}>
              Export Stock as CSV
            </Text>
            <Text style={[styles.menuSub, { color: activeColors.textSecondary }]}>
              Download Excel-compatible inventory spreadsheet
            </Text>
          </View>
          <MaterialCommunityIcons name="download" size={20} color={activeColors.primary} />
        </TouchableOpacity>

        <Divider
          style={[
            styles.divider,
            { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' },
          ]}
        />

        {/* Clear Movement History */}
        <TouchableOpacity style={styles.menuRow} onPress={handleClearHistory} activeOpacity={0.7}>
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2' },
            ]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={22} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: '#DC2626' }]}>
              Clear Movement History
            </Text>
            <Text style={[styles.menuSub, { color: activeColors.textSecondary }]}>
              Permanently delete stock transaction and sales audit log
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={activeColors.textMuted} />
        </TouchableOpacity>
      </Surface>

      {/* 6. About */}
      <Surface
        style={[
          styles.aboutCard,
          {
            backgroundColor: activeColors.surface,
            borderColor: activeColors.border,
          },
        ]}
      >
        <Text style={[styles.aboutTitle, { color: activeColors.textPrimary }]}>
          {store?.name || 'MANJU STORES'}
        </Text>
        <Text style={[styles.aboutVersion, { color: activeColors.textSecondary }]}>
          Version {Constants.expoConfig?.version || '1.0.2'} (Build {Constants.expoConfig?.android?.versionCode || 3})
        </Text>
        <Text style={[styles.aboutCopyright, { color: activeColors.textMuted }]}>
          © {new Date().getFullYear()} {store?.name || 'MANJU STORES'}. All Rights Reserved.
        </Text>
      </Surface>

      {/* Category Dialog */}
      <Portal>
        <Dialog
          visible={catDialogVisible}
          onDismiss={() => setCatDialogVisible(false)}
          style={[styles.dialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            {editingCat ? 'Edit Category' : 'Add Category'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name *"
              value={catNameInput}
              onChangeText={setCatNameInput}
              mode="outlined"
              style={{ backgroundColor: activeColors.surface }}
              textColor={activeColors.textPrimary}
              placeholder="e.g. Pipes, Paints, Tools"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <TouchableOpacity
              onPress={() => setCatDialogVisible(false)}
              style={styles.dialogCancelBtn}
            >
              <Text
                style={[
                  styles.dialogCancelText,
                  { color: activeColors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveCategory}
              style={[
                styles.dialogConfirmBtn,
                { backgroundColor: activeColors.primary },
              ]}
            >
              <Text style={styles.dialogConfirmText}>Save</Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>

        {/* Restore Confirmation Dialog */}
        <Dialog
          visible={restoreDialogVisible}
          onDismiss={() => {
            if (!isRestoring) setRestoreDialogVisible(false);
          }}
          style={[styles.dialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            Restore Store Data
          </Dialog.Title>
          <Dialog.Content>
            {restorePreviewPkg ? (
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 13, color: activeColors.textSecondary }}>
                  Backup Date:{' '}
                  <Text style={{ fontWeight: '700', color: activeColors.textPrimary }}>
                    {new Date(restorePreviewPkg.metadata.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </Text>
                <Text style={{ fontSize: 13, color: activeColors.textSecondary }}>
                  Store:{' '}
                  <Text style={{ fontWeight: '700', color: activeColors.textPrimary }}>
                    {restorePreviewPkg.metadata.storeName}
                  </Text>
                </Text>

                <View
                  style={{
                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                    padding: 10,
                    borderRadius: borderRadius.sm,
                    borderWidth: 1,
                    borderColor: activeColors.border,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 12, color: activeColors.textPrimary }}>
                    • Categories: <Text style={{ fontWeight: '700' }}>{restorePreviewPkg.metadata.totalCategories}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: activeColors.textPrimary }}>
                    • Products: <Text style={{ fontWeight: '700' }}>{restorePreviewPkg.metadata.totalProducts}</Text> ({restorePreviewPkg.metadata.totalVariants} variants)
                  </Text>
                  <Text style={{ fontSize: 12, color: activeColors.textPrimary }}>
                    • Sales Bills: <Text style={{ fontWeight: '700' }}>{restorePreviewPkg.metadata.totalSales}</Text>
                  </Text>
                  <Text style={{ fontSize: 12, color: activeColors.textPrimary }}>
                    • Stock Movements: <Text style={{ fontWeight: '700' }}>{restorePreviewPkg.metadata.totalMovements}</Text>
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: isDarkMode ? '#451A03' : '#FEF3C7',
                    padding: 10,
                    borderRadius: borderRadius.sm,
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#B45309' : '#F59E0B',
                  }}
                >
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#FCD34D' : '#92400E', fontWeight: '600' }}>
                    ⚠️ Warning: Restoring will overwrite existing data on this phone. A safety snapshot will be created automatically before restore.
                  </Text>
                </View>
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <TouchableOpacity
              onPress={() => setRestoreDialogVisible(false)}
              style={styles.dialogCancelBtn}
              disabled={isRestoring}
            >
              <Text style={[styles.dialogCancelText, { color: activeColors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirmRestore}
              style={[styles.dialogConfirmBtn, { backgroundColor: '#2563EB' }]}
              disabled={isRestoring}
            >
              <Text style={styles.dialogConfirmText}>
                {isRestoring ? 'Restoring...' : 'Confirm & Restore'}
              </Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>

        {/* Local Auto-Backups Modal */}
        <Dialog
          visible={localBackupsModalVisible}
          onDismiss={() => setLocalBackupsModalVisible(false)}
          style={[styles.dialog, { backgroundColor: activeColors.surface, maxHeight: 520 }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            Device Automatic Backups
          </Dialog.Title>
          <Dialog.Content>
            {localBackups.length === 0 ? (
              <Text style={{ fontSize: 13, color: activeColors.textSecondary, fontStyle: 'italic', paddingVertical: 12 }}>
                No local automatic snapshots found yet. Daily snapshots are created automatically every day the app is opened.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {localBackups.map((bk, i) => (
                  <View
                    key={bk.filename}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 10,
                      borderBottomWidth: i < localBackups.length - 1 ? 1 : 0,
                      borderBottomColor: activeColors.border,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: activeColors.textPrimary }}>
                        {bk.formattedDate}
                      </Text>
                      <Text style={{ fontSize: 11, color: activeColors.textMuted, marginTop: 2 }}>
                        {bk.filename.startsWith('pre_restore') ? 'Emergency Pre-Restore' : 'Daily Auto-Backup'} • {(bk.sizeBytes / 1024).toFixed(1)} KB
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRestoreFromLocalFile(bk)}
                      style={{
                        backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: borderRadius.sm,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#3B82F6' : '#BFDBFE',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#93C5FD' : '#2563EB' }}>
                        Restore
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <TouchableOpacity
              onPress={() => setLocalBackupsModalVisible(false)}
              style={styles.dialogCancelBtn}
            >
              <Text style={[styles.dialogCancelText, { color: activeColors.textSecondary }]}>
                Close
              </Text>
            </TouchableOpacity>
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
    padding: spacing.md,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },

  // Header Card
  headerCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    ...shadows.card,
  },
  headerLogoWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  catHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  expandAllText: {
    fontSize: 11,
    fontWeight: '700',
  },
  catSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: spacing.sm,
  },
  catSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  addCategoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Surface Card
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.card,
  },

  // Theme Row
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  themeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Category Rows
  catItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  catIconCircle: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  catInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  catTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  catItemName: {
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 160,
  },
  catCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  catCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  catItemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  catItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
  },
  catActionIcon: {
    padding: 6,
  },
  catChevron: {
    padding: 4,
    marginLeft: 2,
  },

  // Menu Rows (Data & Export)
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSub: {
    fontSize: 12,
    marginTop: 1,
  },
  divider: {
    height: 1,
  },

  // About Card
  aboutCard: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    borderWidth: 1,
    ...shadows.card,
  },
  aboutTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  aboutVersion: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  aboutCopyright: {
    fontSize: 11,
    marginTop: 5,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // Dialogs
  dialog: {
    borderRadius: borderRadius.lg,
  },
  dialogTitle: {
    fontSize: 17,
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
  },
  dialogConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  dialogConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subcatsContainer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 8,
  },
  subcatsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subcatsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subcatsLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subcatsHint: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  subcatsScrollView: {
    maxHeight: 160,
  },
  subcatsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  subcatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 6,
  },
  subcatChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subcatDeleteBtn: {
    padding: 2,
  },
  subcatEmptyNotice: {
    paddingVertical: 6,
  },
  subcatEmptyNoticeText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  catEmptyState: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  catEmptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  catClearSearchBtn: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  catClearSearchText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
