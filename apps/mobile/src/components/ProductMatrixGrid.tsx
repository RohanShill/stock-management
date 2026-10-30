import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatrixCellData, MatrixGridData } from '../database/repositories/matrixRepository.js';
import { useAppStore } from '../store/useAppStore.js';
import { borderRadius, getThemeShadows } from '../theme/tokens.js';

interface ProductMatrixGridProps {
  data: MatrixGridData;
  selectedCellKey: string | null;
  onSelectCell: (cellKey: string, cell: MatrixCellData | null, size: string, brand: string) => void;
  onAddBrand: (brandName: string) => Promise<void>;
  onAddSize: (sizeName: string) => Promise<void>;
  onDeleteBrand?: (brand: string) => Promise<void> | void;
  onRenameBrand?: (oldBrand: string, newBrand: string) => Promise<void> | void;
  onDeleteSize?: (size: string) => Promise<void> | void;
  onRenameSize?: (oldSize: string, newSize: string) => Promise<void> | void;
  onReorderSizes?: (newSizes: string[]) => Promise<void> | void;
  isDarkMode: boolean;
  activeColors: any;
  emptyLabel?: string;
}

const ROW_HEADER_WIDTH = 98;
const COLUMN_WIDTH = 95;
const CELL_HEIGHT = 56;
const HEADER_HEIGHT = 48;

interface MatrixCellProps {
  brand: string;
  size: string;
  cellKey: string;
  cellData?: MatrixCellData;
  isSelected: boolean;
  isDarkMode: boolean;
  activeColors: any;
  onSelect: (cellKey: string, cell: MatrixCellData | null, size: string, brand: string) => void;
}

const MatrixCell = React.memo<MatrixCellProps>(({
  brand,
  size,
  cellKey,
  cellData,
  isSelected,
  isDarkMode,
  activeColors,
  onSelect,
}) => {
  const stock = cellData ? cellData.currentStock : 0;
  const hasStock = stock > 0;
  const isLow = hasStock && stock <= 5;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onSelect(cellKey, cellData || null, size, brand)}
      style={[
        styles.cell,
        {
          backgroundColor: isSelected
            ? isDarkMode
              ? '#312E81'
              : '#EEF2FF'
            : activeColors.surface,
          borderColor: isSelected
            ? activeColors.primary
            : activeColors.border,
          borderWidth: isSelected ? 2 : 1,
        },
      ]}
    >
      {cellData ? (
        <View style={styles.stockBadgeWrap}>
          <Text
            style={[
              styles.stockNumber,
              {
                color: isSelected
                  ? activeColors.primary
                  : isLow
                  ? activeColors.warning || '#D97706'
                  : stock === 0
                  ? activeColors.textMuted
                  : activeColors.textPrimary,
                fontWeight: hasStock ? '700' : '500',
              },
            ]}
          >
            {stock === 0 ? '-' : stock}
          </Text>
          {isLow && (
            <View
              style={[
                styles.lowIndicator,
                { backgroundColor: activeColors.warning || '#D97706' },
              ]}
            />
          )}
        </View>
      ) : (
        <Text style={[styles.stockNumber, { color: activeColors.textMuted }]}>
          -
        </Text>
      )}
    </TouchableOpacity>
  );
}, (prev, next) => {
  return (
    prev.isSelected === next.isSelected &&
    prev.isDarkMode === next.isDarkMode &&
    prev.cellData?.currentStock === next.cellData?.currentStock &&
    prev.cellData?.variantId === next.cellData?.variantId &&
    prev.cellKey === next.cellKey &&
    prev.activeColors === next.activeColors
  );
});

export const ProductMatrixGrid: React.FC<ProductMatrixGridProps> = React.memo(({
  data,
  selectedCellKey,
  onSelectCell,
  onAddBrand,
  onAddSize,
  onDeleteBrand,
  onRenameBrand,
  onDeleteSize,
  onRenameSize,
  onReorderSizes,
  isDarkMode,
  activeColors,
  emptyLabel = 'Pipes',
}) => {
  const { brands, sizes, cells } = data;

  const [currentSizes, setCurrentSizes] = useState<string[]>(sizes);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);

  const { showConfirm, showToast } = useAppStore();

  useEffect(() => {
    setCurrentSizes(sizes);
  }, [sizes]);

  const moveSize = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= currentSizes.length || fromIndex === toIndex) return;
    const next = [...currentSizes];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setCurrentSizes(next);
    if (onReorderSizes) {
      onReorderSizes(next);
    }
  };

  const [addBrandVisible, setAddBrandVisible] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [submittingBrand, setSubmittingBrand] = useState(false);

  const [addSizeVisible, setAddSizeVisible] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [submittingSize, setSubmittingSize] = useState(false);

  // Manage Action Sheet Modal (Brand or Size)
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [manageTarget, setManageTarget] = useState<{
    type: 'brand' | 'size';
    name: string;
  } | null>(null);

  const currentManageSizeIndex = useMemo(() => {
    if (!manageTarget || manageTarget.type !== 'size') return -1;
    return currentSizes.findIndex((s) => s === manageTarget.name);
  }, [manageTarget, currentSizes]);

  // Rename Modal
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [submittingRename, setSubmittingRename] = useState(false);

  const themeShadows = getThemeShadows(isDarkMode);

  const handleOpenManage = (type: 'brand' | 'size', name: string) => {
    setManageTarget({ type, name });
    setManageModalVisible(true);
  };

  const handleTriggerRename = () => {
    if (!manageTarget) return;
    setRenameInput(manageTarget.name);
    setManageModalVisible(false);
    setTimeout(() => {
      setRenameModalVisible(true);
    }, 150);
  };

  const handleTriggerDelete = () => {
    if (!manageTarget) return;
    const { type, name } = manageTarget;
    setManageModalVisible(false);

    showConfirm({
      title: type === 'brand' ? 'Delete Brand Column' : 'Delete Size / Item',
      message: `Are you sure you want to delete ${type === 'brand' ? 'brand' : 'size'} "${name}"? All associated stock entries in this table will be removed.`,
      confirmText: 'Delete',
      isDestructive: true,
      onConfirm: async () => {
        try {
          if (type === 'brand' && onDeleteBrand) {
            await onDeleteBrand(name);
          } else if (type === 'size' && onDeleteSize) {
            await onDeleteSize(name);
          }
        } catch (e: any) {
          showToast(e?.message || 'Failed to delete', 'error');
        }
      },
    });
  };

  const handleConfirmRename = async () => {
    if (!manageTarget || submittingRename) return;
    const clean = renameInput.trim();
    if (!clean) {
      showToast('Name cannot be empty', 'warning');
      return;
    }
    const { type, name: oldName } = manageTarget;
    if (clean === oldName) {
      setRenameModalVisible(false);
      return;
    }

    if (type === 'brand') {
      if (
        brands.some(
          (b) => b.toLowerCase() === clean.toLowerCase() && b.toLowerCase() !== oldName.toLowerCase()
        )
      ) {
        showToast(`Brand "${clean}" already exists`, 'warning');
        return;
      }
      try {
        setSubmittingRename(true);
        if (onRenameBrand) {
          await onRenameBrand(oldName, clean);
        }
        setRenameModalVisible(false);
      } catch (e: any) {
        showToast(e?.message || 'Failed to rename brand', 'error');
      } finally {
        setSubmittingRename(false);
      }
    } else {
      if (
        sizes.some(
          (s) => s.toLowerCase() === clean.toLowerCase() && s.toLowerCase() !== oldName.toLowerCase()
        )
      ) {
        showToast(`Size "${clean}" already exists`, 'warning');
        return;
      }
      try {
        setSubmittingRename(true);
        if (onRenameSize) {
          await onRenameSize(oldName, clean);
        }
        setRenameModalVisible(false);
      } catch (e: any) {
        showToast(e?.message || 'Failed to rename size', 'error');
      } finally {
        setSubmittingRename(false);
      }
    }
  };

  const handleAddBrand = async () => {
    const clean = newBrandName.trim();
    if (!clean || submittingBrand) return;
    if (brands.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      showToast(`Brand "${clean}" is already present in the table.`, 'warning');
      return;
    }
    try {
      setSubmittingBrand(true);
      await onAddBrand(clean);
      setNewBrandName('');
      setAddBrandVisible(false);
    } catch (e) {
      console.error('Error adding brand:', e);
    } finally {
      setSubmittingBrand(false);
    }
  };

  const handleAddSize = async () => {
    const clean = newSizeName.trim();
    if (!clean || submittingSize) return;
    if (brands.length === 0) {
      showToast('Please add at least one brand first using "+ Add Brands"', 'warning');
      return;
    }
    if (sizes.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      showToast(`Size "${clean}" is already present in the table.`, 'warning');
      return;
    }
    try {
      setSubmittingSize(true);
      await onAddSize(clean);
      setNewSizeName('');
      setAddSizeVisible(false);
    } catch (e) {
      console.error('Error adding size:', e);
    } finally {
      setSubmittingSize(false);
    }
  };

  return (
    <View
      style={[
        styles.tableContainer,
        {
          backgroundColor: activeColors.surface,
          borderColor: activeColors.border,
        },
        themeShadows.card,
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
        <View>
          {/* Header Row */}
          <View style={styles.headerRow}>
            {/* Corner Cell (Size / Item) */}
            <View
              style={[
                styles.cornerCell,
                {
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surfaceSubtle,
                  borderColor: activeColors.border,
                },
              ]}
            >
              <View style={styles.cornerCellInner}>
                <Text
                  style={[
                    styles.headerTitle,
                    { color: activeColors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  Size / Item
                </Text>
                {currentSizes.length > 1 && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setReorderModalVisible(true)}
                    style={[
                      styles.reorderToggleBtn,
                      {
                        backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF',
                      },
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons
                      name="swap-vertical"
                      size={15}
                      color={activeColors.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Brand Columns */}
            {brands.map((brand) => (
              <TouchableOpacity
                key={brand}
                activeOpacity={0.8}
                onLongPress={() => handleOpenManage('brand', brand)}
                delayLongPress={350}
                style={[
                  styles.headerCell,
                  {
                    backgroundColor: isDarkMode
                      ? activeColors.surfaceElevated
                      : activeColors.surfaceSubtle,
                    borderColor: activeColors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.brandHeaderText,
                    { color: activeColors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {brand}
                </Text>
              </TouchableOpacity>
            ))}

            {/* "add brands +" Column */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setAddBrandVisible(true)}
              style={[
                styles.addBrandHeaderCell,
                {
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.primaryLight,
                  borderColor: activeColors.primaryBorder || activeColors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.addBrandHeaderText,
                  { color: activeColors.primary },
                ]}
              >
                add brands +
              </Text>
            </TouchableOpacity>
          </View>

          {/* Table Body (Sizes as Rows) */}
          {currentSizes.length === 0 ? (
            <View style={styles.emptyTableBanner}>
              <MaterialCommunityIcons name="table-plus" size={32} color={activeColors.primary} />
              <Text style={[styles.emptyTableTitle, { color: activeColors.textPrimary }]}>
                {brands.length > 0 ? `Brand "${brands.join(', ')}" added!` : 'No items found'}
              </Text>
              <Text style={[styles.emptyTableSubtitle, { color: activeColors.textMuted }]}>
                {brands.length > 0
                  ? 'Tap "+ Add Size / Item" below to add sizes'
                  : 'Tap "add brands +" above or "+ Add Size" below to get started'}
              </Text>
              <TouchableOpacity
                onPress={() => setAddSizeVisible(true)}
                style={[styles.emptyAddBtn, { backgroundColor: activeColors.primary }]}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Add Size / Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }}
            >
              {currentSizes.map((size) => {
                return (
                  <View
                    key={size}
                    style={styles.dataRow}
                  >
                    {/* Left Frozen Column: Size Label */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onLongPress={() => handleOpenManage('size', size)}
                      delayLongPress={350}
                      style={[
                        styles.rowHeaderCell,
                        {
                          backgroundColor: isDarkMode
                            ? activeColors.surfaceElevated
                            : activeColors.surfaceSubtle,
                          borderColor: activeColors.border,
                        },
                      ]}
                    >
                      <View style={styles.rowHeaderContent}>
                        <Text
                          style={[
                            styles.rowHeaderText,
                            {
                              color: activeColors.textPrimary,
                              fontWeight: '700',
                              flex: 1,
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {size}
                        </Text>
                      </View>
                    </TouchableOpacity>

                {/* Brand Cells for this Size */}
                {brands.map((brand) => {
                  const cellKey = `${size}___${brand.toLowerCase()}`;
                  return (
                    <MatrixCell
                      key={cellKey}
                      brand={brand}
                      size={size}
                      cellKey={cellKey}
                      cellData={cells[cellKey]}
                      isSelected={selectedCellKey === cellKey}
                      isDarkMode={isDarkMode}
                      activeColors={activeColors}
                      onSelect={onSelectCell}
                    />
                  );
                })}

                {/* Empty cell under "add brands +" */}
                <View
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isDarkMode
                        ? activeColors.surfaceElevated
                        : activeColors.surfaceSubtle,
                      borderColor: activeColors.border,
                    },
                  ]}
                />
              </View>
            );
          })}

            {/* Bottom Row: "+ Add Size / Item" Button */}
            <View style={styles.dataRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setAddSizeVisible(true)}
                style={[
                  styles.addSizeCell,
                  {
                    backgroundColor: isDarkMode
                      ? activeColors.surfaceElevated
                      : activeColors.primaryLight,
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
                    styles.addSizeText,
                    { color: activeColors.primary },
                  ]}
                >
                  Add Size +
                </Text>
              </TouchableOpacity>

              {/* Blank filler across all brand columns for symmetry */}
              {brands.map((b) => (
                <View
                  key={b}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isDarkMode
                        ? activeColors.surfaceElevated
                        : activeColors.surfaceSubtle,
                      borderColor: activeColors.border,
                    },
                  ]}
                />
              ))}

              <View
                style={[
                  styles.cell,
                  {
                    backgroundColor: isDarkMode
                      ? activeColors.surfaceElevated
                      : activeColors.surfaceSubtle,
                    borderColor: activeColors.border,
                  },
                ]}
              />
            </View>
          </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Modal: Add Brand Column */}
      <Modal
        visible={addBrandVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddBrandVisible(false)}
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
                  name="tag-plus-outline"
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
                  Add New Brand
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  e.g. Supreme, AKG, Finolex, Ashirvad etc.
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
              placeholder="Enter brand name..."
              placeholderTextColor={activeColors.textMuted}
              value={newBrandName}
              onChangeText={setNewBrandName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddBrand}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setNewBrandName('');
                  setAddBrandVisible(false);
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
                onPress={handleAddBrand}
                disabled={!newBrandName.trim() || submittingBrand}
                style={[
                  styles.btnConfirm,
                  {
                    backgroundColor: newBrandName.trim()
                      ? activeColors.primary
                      : activeColors.border,
                  },
                ]}
              >
                <Text style={styles.btnConfirmText}>
                  {submittingBrand ? 'Adding...' : '+ Add Brand'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Size / Item Row */}
      <Modal
        visible={addSizeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddSizeVisible(false)}
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
                  name="ruler"
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
                  Add New Size / Item
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  e.g. 1/2", 3/4", 1", 1 1/4", 2" etc.
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
              placeholder="Enter size or item name..."
              placeholderTextColor={activeColors.textMuted}
              value={newSizeName}
              onChangeText={setNewSizeName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddSize}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setNewSizeName('');
                  setAddSizeVisible(false);
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
                onPress={handleAddSize}
                disabled={!newSizeName.trim() || submittingSize}
                style={[
                  styles.btnConfirm,
                  {
                    backgroundColor: newSizeName.trim()
                      ? activeColors.primary
                      : activeColors.border,
                  },
                ]}
              >
                <Text style={styles.btnConfirmText}>
                  {submittingSize ? 'Adding...' : '+ Add Size'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Reorder Sizes */}
      <Modal
        visible={reorderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReorderModalVisible(false)}
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
                  name="swap-vertical"
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
                  Reorder Sizes / Items
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  Tap arrows to rearrange items in table
                </Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 300, marginBottom: 18 }} showsVerticalScrollIndicator={false}>
              {currentSizes.map((size, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === currentSizes.length - 1;
                return (
                  <View
                    key={size}
                    style={[
                      styles.reorderItemRow,
                      {
                        backgroundColor: isDarkMode ? activeColors.surfaceElevated : activeColors.surfaceSubtle,
                        borderColor: activeColors.border,
                      },
                    ]}
                  >
                    <View style={styles.reorderIdxBadge}>
                      <Text style={[styles.reorderIdxText, { color: activeColors.textMuted }]}>
                        #{idx + 1}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.reorderSizeName,
                        { color: activeColors.textPrimary },
                      ]}
                      numberOfLines={1}
                    >
                      {size}
                    </Text>
                    <View style={styles.reorderBtns}>
                      <TouchableOpacity
                        disabled={isFirst}
                        onPress={() => moveSize(idx, idx - 1)}
                        style={[
                          styles.reorderActionBtn,
                          {
                            backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
                            opacity: isFirst ? 0.3 : 1,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="arrow-up"
                          size={18}
                          color={activeColors.textPrimary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={isLast}
                        onPress={() => moveSize(idx, idx + 1)}
                        style={[
                          styles.reorderActionBtn,
                          {
                            backgroundColor: isDarkMode ? '#334155' : '#E2E8F0',
                            opacity: isLast ? 0.3 : 1,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="arrow-down"
                          size={18}
                          color={activeColors.textPrimary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setReorderModalVisible(false)}
              style={[
                styles.btnDoneReorder,
                { backgroundColor: activeColors.primary },
              ]}
            >
              <Text style={styles.btnConfirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Action Sheet for Brand / Size Management */}
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
            {/* Header */}
            <View style={styles.actionSheetHeader}>
              <View
                style={[
                  styles.sheetIconCircle,
                  { backgroundColor: activeColors.primaryLight },
                ]}
              >
                <MaterialCommunityIcons
                  name={manageTarget?.type === 'brand' ? 'tag-outline' : 'ruler'}
                  size={20}
                  color={activeColors.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                  style={[
                    styles.sheetTypeLabel,
                    { color: activeColors.textMuted },
                  ]}
                >
                  MANAGE {manageTarget?.type === 'brand' ? 'BRAND COLUMN' : 'SIZE / ITEM'}
                </Text>
                <Text
                  style={[
                    styles.sheetTargetTitle,
                    { color: activeColors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {manageTarget?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setManageModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={activeColors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionSheetButtons}>
              {/* Position & Order Box (Only for Size items when more than 1 item exists) */}
              {manageTarget?.type === 'size' && currentSizes.length > 1 && (
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
                        name="swap-vertical"
                        size={18}
                        color={activeColors.primary}
                      />
                      <Text style={[styles.reorderTitle, { color: activeColors.textPrimary }]}>
                        POSITION & ORDER
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.positionBadge,
                        { backgroundColor: activeColors.primaryLight },
                      ]}
                    >
                      <Text style={[styles.positionBadgeText, { color: activeColors.primary }]}>
                        #{currentManageSizeIndex + 1} of {currentSizes.length}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.reorderSubtitle, { color: activeColors.textMuted }]}>
                    Tap arrows to move size up or down in table
                  </Text>

                  <View style={styles.reorderBtnRow}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={currentManageSizeIndex <= 0}
                      onPress={() => {
                        if (currentManageSizeIndex > 0) {
                          moveSize(currentManageSizeIndex, currentManageSizeIndex - 1);
                        }
                      }}
                      style={[
                        styles.reorderBtn,
                        {
                          backgroundColor: currentManageSizeIndex <= 0
                            ? (isDarkMode ? '#1E293B' : '#F1F5F9')
                            : (isDarkMode ? '#334155' : '#FFFFFF'),
                          borderColor: currentManageSizeIndex <= 0
                            ? 'transparent'
                            : activeColors.border,
                          opacity: currentManageSizeIndex <= 0 ? 0.45 : 1,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="arrow-up-bold"
                        size={18}
                        color={currentManageSizeIndex <= 0 ? activeColors.textMuted : activeColors.primary}
                      />
                      <Text
                        style={[
                          styles.reorderBtnText,
                          {
                            color: currentManageSizeIndex <= 0
                              ? activeColors.textMuted
                              : activeColors.textPrimary,
                          },
                        ]}
                      >
                        Move Up
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={currentManageSizeIndex < 0 || currentManageSizeIndex >= currentSizes.length - 1}
                      onPress={() => {
                        if (currentManageSizeIndex >= 0 && currentManageSizeIndex < currentSizes.length - 1) {
                          moveSize(currentManageSizeIndex, currentManageSizeIndex + 1);
                        }
                      }}
                      style={[
                        styles.reorderBtn,
                        {
                          backgroundColor: (currentManageSizeIndex < 0 || currentManageSizeIndex >= currentSizes.length - 1)
                            ? (isDarkMode ? '#1E293B' : '#F1F5F9')
                            : (isDarkMode ? '#334155' : '#FFFFFF'),
                          borderColor: (currentManageSizeIndex < 0 || currentManageSizeIndex >= currentSizes.length - 1)
                            ? 'transparent'
                            : activeColors.border,
                          opacity: (currentManageSizeIndex < 0 || currentManageSizeIndex >= currentSizes.length - 1) ? 0.45 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reorderBtnText,
                          {
                            color: (currentManageSizeIndex < 0 || currentManageSizeIndex >= currentSizes.length - 1)
                              ? activeColors.textMuted
                              : activeColors.textPrimary,
                          },
                        ]}
                      >
                        Move Down
                      </Text>
                      <MaterialCommunityIcons
                        name="arrow-down-bold"
                        size={18}
                        color={(currentManageSizeIndex < 0 || currentManageSizeIndex >= currentSizes.length - 1) ? activeColors.textMuted : activeColors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 1. Rename Option */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleTriggerRename}
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
                    Rename {manageTarget?.type === 'brand' ? 'Brand' : 'Size / Item'}
                  </Text>
                  <Text
                    style={[
                      styles.sheetActionSub,
                      { color: activeColors.textMuted },
                    ]}
                  >
                    Change name without losing any existing stock
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
                activeOpacity={0.7}
                onPress={handleTriggerDelete}
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
                    Delete {manageTarget?.type === 'brand' ? 'Brand Column' : 'Size Row'}
                  </Text>
                  <Text
                    style={[
                      styles.sheetActionSub,
                      { color: isDarkMode ? '#FCA5A5' : '#991B1B' },
                    ]}
                  >
                    Remove from this table and delete stock records
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#DC2626"
                />
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
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
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Rename Brand or Size */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
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
                  Rename {manageTarget?.type === 'brand' ? 'Brand' : 'Size / Item'}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  Current: "{manageTarget?.name}"
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
              placeholder={`Enter new ${manageTarget?.type === 'brand' ? 'brand' : 'size'} name`}
              placeholderTextColor={activeColors.textMuted}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirmRename}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setRenameModalVisible(false)}
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
                onPress={handleConfirmRename}
                disabled={submittingRename || !renameInput.trim()}
                style={[
                  styles.btnConfirm,
                  {
                    backgroundColor:
                      submittingRename || !renameInput.trim()
                        ? activeColors.border
                        : activeColors.primary,
                  },
                ]}
              >
                <Text style={styles.btnConfirmText}>
                  {submittingRename ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  tableContainer: {
    marginHorizontal: 14,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    overflow: 'hidden',
    flex: 1,
  },
  emptyTableBanner: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: 320,
  },
  emptyTableTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyTableSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    height: HEADER_HEIGHT,
  },
  cornerCell: {
    width: ROW_HEADER_WIDTH,
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    paddingHorizontal: 4,
  },
  cornerCellInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  reorderToggleBtn: {
    padding: 4,
    borderRadius: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  headerCell: {
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    paddingHorizontal: 6,
  },
  brandHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  addBrandHeaderCell: {
    width: 110,
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    paddingHorizontal: 8,
  },
  addBrandHeaderText: {
    fontSize: 13,
    fontWeight: '800',
  },
  dataRow: {
    flexDirection: 'row',
    height: CELL_HEIGHT,
  },
  rowHeaderCell: {
    width: ROW_HEADER_WIDTH,
    height: CELL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1.5,
    borderBottomWidth: 1,
    paddingHorizontal: 2,
  },
  rowHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dragHandle: {
    paddingVertical: 6,
    paddingHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  reorderArrowsCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  arrowNudgeBtn: {
    padding: 1,
  },
  draggingRow: {
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  cell: {
    width: COLUMN_WIDTH,
    height: CELL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  stockBadgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockNumber: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  lowIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  addSizeCell: {
    width: ROW_HEADER_WIDTH,
    height: CELL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRightWidth: 1.5,
    borderBottomWidth: 1,
    paddingHorizontal: 2,
  },
  addSizeText: {
    fontSize: 11.5,
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
  reorderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  reorderIdxBadge: {
    width: 28,
  },
  reorderIdxText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reorderSizeName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  reorderBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  reorderActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDoneReorder: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtn: {
    position: 'absolute',
    top: 4,
    right: 2,
    padding: 2,
    borderRadius: 6,
  },
  rowActionBtn: {
    padding: 2,
    marginLeft: 1,
    borderRadius: 4,
  },
  actionSheetCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 25,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  sheetIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTypeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sheetTargetTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 1,
  },
  actionSheetButtons: {
    gap: 10,
    marginBottom: 14,
  },
  sheetActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetActionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sheetActionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  sheetCancelBtn: {
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reorderSection: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
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
});
