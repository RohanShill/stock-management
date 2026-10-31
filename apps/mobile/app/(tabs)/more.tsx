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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Category, Subcategory } from '@hardware-store/shared';
import { useAppStore } from '../../src/store/useAppStore.js';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { CategoryRepository } from '../../src/database/repositories/categoryRepository.js';
import { MatrixRepository } from '../../src/database/repositories/matrixRepository.js';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
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
  const [exportingPdf, setExportingPdf] = useState(false);

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

  // Export Stock as PDF
  const handleExportPDF = async () => {
    try {
      setExportingPdf(true);
      const storeId = store?.id || 'store-1';
      const prods = await ProductRepository.getProductsWithVariants(storeId);
      const cats = await ProductRepository.getCategories(storeId);
      const catMap = new Map<string, string>();
      cats.forEach((c) => catMap.set(c.id, c.name));

      let totalStockUnits = 0;
      let lowCount = 0;
      let outCount = 0;
      let rowIdx = 1;
      let rowsHtml = '';

      for (const p of prods) {
        const catName = catMap.get(p.categoryId) || 'Hardware';
        for (const v of p.variants) {
          const stock = Number(v.currentStock || 0);
          const minStock = Number(v.minStockLevel || 5);
          totalStockUnits += Math.max(0, stock);

          let statusBadge = '';
          if (stock <= 0) {
            outCount++;
            statusBadge = '<span class="badge badge-out">Out of Stock</span>';
          } else if (stock <= minStock) {
            lowCount++;
            statusBadge = '<span class="badge badge-low">Low Stock</span>';
          } else {
            statusBadge = '<span class="badge badge-in">In Stock</span>';
          }

          rowsHtml += `
            <tr>
              <td>${rowIdx++}</td>
              <td class="font-bold">${p.name || ''}</td>
              <td>${p.brand || '-'}</td>
              <td>${catName}</td>
              <td>${v.size || v.name || 'Standard'}</td>
              <td class="font-bold">${stock} ${p.baseUnit || 'pcs'}</td>
              <td>${statusBadge}</td>
            </tr>
          `;
        }
      }

      const generatedAt = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>MANJU STORES - Stock Inventory Report</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0F172A;
              margin: 0;
              padding: 0;
              background-color: #FFFFFF;
            }
            .header {
              border-bottom: 2px solid #1E3A8A;
              padding-bottom: 12px;
              margin-bottom: 16px;
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
            .store-sub {
              font-size: 13px;
              color: #64748B;
              margin: 4px 0 0 0;
            }
            .report-meta {
              text-align: right;
              font-size: 12px;
              color: #64748B;
            }
            .summary-cards {
              display: flex;
              gap: 12px;
              margin-bottom: 20px;
            }
            .card {
              flex: 1;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              padding: 10px 14px;
              background: #F8FAFC;
            }
            .card-label {
              font-size: 11px;
              text-transform: uppercase;
              color: #64748B;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            .card-val {
              font-size: 22px;
              font-weight: 800;
              color: #0F172A;
              margin-top: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 12px;
            }
            th {
              background: #1E3A8A;
              color: #FFFFFF;
              text-align: left;
              padding: 8px 10px;
              font-weight: 700;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            td {
              padding: 8px 10px;
              border-bottom: 1px solid #E2E8F0;
            }
            tr:nth-child(even) {
              background-color: #F8FAFC;
            }
            .font-bold {
              font-weight: 700;
            }
            .badge {
              display: inline-block;
              padding: 2px 7px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 700;
            }
            .badge-in {
              background: #DCFCE7;
              color: #15803D;
            }
            .badge-low {
              background: #FEF3C7;
              color: #B45309;
            }
            .badge-out {
              background: #FEE2E2;
              color: #DC2626;
            }
            .footer {
              margin-top: 24px;
              text-align: center;
              font-size: 11px;
              color: #94A3B8;
              border-top: 1px solid #E2E8F0;
              padding-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="store-name">MANJU STORES</h1>
              <p class="store-sub">Complete Stock Inventory & Catalogue Report</p>
            </div>
            <div class="report-meta">
              <strong>Generated:</strong> ${generatedAt}<br/>
              <strong>System:</strong> Offline-First SQLite
            </div>
          </div>

          <div class="summary-cards">
            <div class="card">
              <div class="card-label">Total Products</div>
              <div class="card-val">${prods.length}</div>
            </div>
            <div class="card">
              <div class="card-label">Total Stock Units</div>
              <div class="card-val">${totalStockUnits}</div>
            </div>
            <div class="card">
              <div class="card-label">Low Stock Alerts</div>
              <div class="card-val" style="color: #D97706;">${lowCount}</div>
            </div>
            <div class="card">
              <div class="card-label">Out of Stock</div>
              <div class="card-val" style="color: #DC2626;">${outCount}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 25%;">Product Name</th>
                <th style="width: 15%;">Brand</th>
                <th style="width: 15%;">Category</th>
                <th style="width: 15%;">Size / Spec</th>
                <th style="width: 13%;">Available</th>
                <th style="width: 12%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="7" style="text-align:center; padding: 20px;">No products found in catalogue.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            MANJU STORES • Official Stock Record • Offline Database
          </div>
        </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } else {
          showToast(`Exported to ${uri}`, 'success');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not generate PDF.';
      showToast(msg, 'error');
    } finally {
      setExportingPdf(false);
    }
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
          const FileSystem = require('expo-file-system');
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
            <Text style={[styles.menuSub, { color: activeColors.textSecondary }]}>
              {isDarkMode ? 'Comfortable high-contrast dark theme' : 'Crisp clean daylight theme'}
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
        <Text style={[styles.sectionTitle, { color: activeColors.textPrimary }]}>
          Categories ({categories.length})
        </Text>
        <TouchableOpacity style={styles.addCategoryBtn} onPress={handleOpenAddCategory}>
          <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
          <Text style={styles.addCategoryBtnText}>Add Category</Text>
        </TouchableOpacity>
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
        {categories.map((cat, idx) => (
          <View key={cat.id}>
            <View style={styles.catItemRow}>
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
              <Text style={[styles.catItemName, { color: activeColors.textPrimary }]}>
                {cat.name}
              </Text>

              <View style={styles.catItemActions}>
                <TouchableOpacity
                  onPress={() => handleOpenEditCategory(cat)}
                  style={styles.catActionIcon}
                >
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={18}
                    color={activeColors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteCategory(cat)}
                  style={styles.catActionIcon}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sub-tabs / Sections under this Category */}
            {categorySubcategories[cat.id] && categorySubcategories[cat.id].length > 0 && (
              <View style={styles.subcatsContainer}>
                <Text style={[styles.subcatsLabel, { color: activeColors.textMuted }]}>
                  Sections / Tabs:
                </Text>
                <View style={styles.subcatsChipsRow}>
                  {categorySubcategories[cat.id].map((sub) => (
                    <View
                      key={sub.id}
                      style={[
                        styles.subcatChip,
                        {
                          backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#F8FAFC',
                          borderColor: activeColors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.subcatChipText, { color: activeColors.textPrimary }]}>
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
              </View>
            )}

            {idx !== categories.length - 1 && (
              <Divider
                style={[
                  styles.divider,
                  { backgroundColor: isDarkMode ? '#1F2937' : '#F1F5F9' },
                ]}
              />
            )}
          </View>
        ))}
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
        {/* Export PDF */}
        <TouchableOpacity
          style={styles.menuRow}
          onPress={handleExportPDF}
          activeOpacity={0.7}
          disabled={exportingPdf}
        >
          <View
            style={[
              styles.menuIconCircle,
              { backgroundColor: isDarkMode ? '#450A0A' : '#FEE2E2' },
            ]}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={22} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: activeColors.textPrimary }]}>
              {exportingPdf ? 'Preparing PDF...' : 'Export Stock as PDF'}
            </Text>
            <Text style={[styles.menuSub, { color: activeColors.textSecondary }]}>
              Print or save formatted A4 inventory report
            </Text>
          </View>
          <MaterialCommunityIcons name="printer" size={20} color={activeColors.primary} />
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
          MANJU STORES
        </Text>
        <Text style={[styles.aboutVersion, { color: activeColors.textSecondary }]}>
          Version 1.0.0
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
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  catItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  catItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  catActionIcon: {
    padding: 6,
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
    paddingLeft: spacing.lg + 28,
    paddingRight: spacing.md,
    paddingBottom: spacing.sm,
    gap: 6,
  },
  subcatsLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subcatsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subcatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
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
});
