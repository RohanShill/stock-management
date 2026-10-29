import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  PanResponder,
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
  onReorderSizes?: (newSizes: string[]) => Promise<void> | void;
  isDarkMode: boolean;
  activeColors: any;
  emptyLabel?: string;
}

const ROW_HEADER_WIDTH = 94;
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
  onReorderSizes,
  isDarkMode,
  activeColors,
  emptyLabel = 'Pipes',
}) => {
  const { brands, sizes, cells } = data;

  const [currentSizes, setCurrentSizes] = useState<string[]>(sizes);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const { showConfirm, showToast } = useAppStore();

  const panRespondersRef = useRef<Map<number, any>>(new Map());

  useEffect(() => {
    setCurrentSizes(sizes);
    panRespondersRef.current.clear();
  }, [sizes]);

  const currentSizesRef = useRef(sizes);
  currentSizesRef.current = currentSizes;

  const moveSize = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= currentSizes.length || fromIndex === toIndex) return;
    const next = [...currentSizes];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setCurrentSizes(next);
    panRespondersRef.current.clear();
    if (onReorderSizes) {
      onReorderSizes(next);
    }
  };

  const draggingRef = useRef<{
    index: number;
    accumulatedDy: number;
  }>({ index: -1, accumulatedDy: 0 });

  const createPanResponder = (startIndex: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        setDraggingIndex(startIndex);
        draggingRef.current = { index: startIndex, accumulatedDy: 0 };
      },
      onPanResponderMove: (_, gesture) => {
        const threshold = CELL_HEIGHT * 0.65;
        const curIdx = draggingRef.current.index;
        const relativeDy = gesture.dy - draggingRef.current.accumulatedDy;

        if (relativeDy > threshold && curIdx < currentSizesRef.current.length - 1) {
          const nextIdx = curIdx + 1;
          const updated = [...currentSizesRef.current];
          const [moved] = updated.splice(curIdx, 1);
          updated.splice(nextIdx, 0, moved);
          currentSizesRef.current = updated;
          setCurrentSizes(updated);
          draggingRef.current.index = nextIdx;
          draggingRef.current.accumulatedDy += CELL_HEIGHT;
          setDraggingIndex(nextIdx);
        } else if (relativeDy < -threshold && curIdx > 0) {
          const nextIdx = curIdx - 1;
          const updated = [...currentSizesRef.current];
          const [moved] = updated.splice(curIdx, 1);
          updated.splice(nextIdx, 0, moved);
          currentSizesRef.current = updated;
          setCurrentSizes(updated);
          draggingRef.current.index = nextIdx;
          draggingRef.current.accumulatedDy -= CELL_HEIGHT;
          setDraggingIndex(nextIdx);
        }
      },
      onPanResponderRelease: () => {
        setDraggingIndex(null);
        panRespondersRef.current.clear();
        if (onReorderSizes) {
          onReorderSizes(currentSizesRef.current);
        }
      },
      onPanResponderTerminate: () => {
        setDraggingIndex(null);
        panRespondersRef.current.clear();
      },
    });

  const getPanResponder = (startIndex: number) => {
    let pr = panRespondersRef.current.get(startIndex);
    if (!pr) {
      pr = createPanResponder(startIndex);
      panRespondersRef.current.set(startIndex, pr);
    }
    return pr;
  };

  const [addBrandVisible, setAddBrandVisible] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [submittingBrand, setSubmittingBrand] = useState(false);

  const [addSizeVisible, setAddSizeVisible] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [submittingSize, setSubmittingSize] = useState(false);

  const themeShadows = getThemeShadows(isDarkMode);

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
              <View
                key={brand}
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
                  {brand.toLowerCase()}
                </Text>
                {onDeleteBrand && (
                  <TouchableOpacity
                    onPress={() => {
                      showConfirm({
                        title: 'Remove Brand Column',
                        message: `Are you sure you want to remove the "${brand}" brand column from the table?`,
                        confirmText: 'Remove',
                        isDestructive: true,
                        onConfirm: () => onDeleteBrand(brand),
                      });
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ position: 'absolute', top: 3, right: 3 }}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={12}
                      color={activeColors.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>
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
              scrollEnabled={draggingIndex === null}
              style={{ maxHeight: 380 }}
            >
              {currentSizes.map((size, index) => {
                const isDraggingThis = draggingIndex === index;
                return (
                  <View
                    key={size}
                    style={[
                      styles.dataRow,
                      isDraggingThis && [
                        styles.draggingRow,
                        {
                          backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                          borderColor: activeColors.primary,
                        },
                      ],
                    ]}
                  >
                    {/* Left Frozen Column: Size Label + Drag Handle */}
                    <View
                      style={[
                        styles.rowHeaderCell,
                        {
                          backgroundColor: isDraggingThis
                            ? (isDarkMode ? '#334155' : '#DBEAFE')
                            : isDarkMode
                            ? activeColors.surfaceElevated
                            : activeColors.surfaceSubtle,
                          borderColor: isDraggingThis ? activeColors.primary : activeColors.border,
                        },
                      ]}
                    >
                      <View style={styles.rowHeaderContent}>
                        {/* Drag Handle Icon with PanResponder */}
                        <View
                          {...getPanResponder(index).panHandlers}
                          style={styles.dragHandle}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons
                            name="drag-vertical"
                            size={16}
                            color={isDraggingThis ? activeColors.primary : activeColors.textMuted}
                          />
                        </View>

                        <Text
                          style={[
                            styles.rowHeaderText,
                            {
                              color: isDraggingThis ? activeColors.primary : activeColors.textPrimary,
                              fontWeight: isDraggingThis ? '700' : '600',
                              flex: 1,
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {size}
                        </Text>

                        {/* Quick Reorder Arrow Buttons when Reorder Mode is active */}
                        {reorderMode && (
                          <View style={styles.reorderArrowsCol}>
                            <TouchableOpacity
                              disabled={index === 0}
                              onPress={() => moveSize(index, index - 1)}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                              style={[styles.arrowNudgeBtn, index === 0 && { opacity: 0.25 }]}
                            >
                              <MaterialCommunityIcons
                                name="chevron-up"
                                size={14}
                                color={activeColors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              disabled={index === currentSizes.length - 1}
                              onPress={() => moveSize(index, index + 1)}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                              style={[
                                styles.arrowNudgeBtn,
                                index === currentSizes.length - 1 && { opacity: 0.25 },
                              ]}
                            >
                              <MaterialCommunityIcons
                                name="chevron-down"
                                size={14}
                                color={activeColors.primary}
                              />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>

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
});
