import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatrixCellData, MatrixGridData } from '../database/repositories/matrixRepository.js';
import { borderRadius, getThemeShadows } from '../theme/tokens.js';

interface ProductMatrixGridProps {
  data: MatrixGridData;
  selectedCellKey: string | null;
  onSelectCell: (cellKey: string, cell: MatrixCellData | null, size: string, brand: string) => void;
  onAddBrand: (brandName: string) => Promise<void>;
  onAddSize: (sizeName: string) => Promise<void>;
  isDarkMode: boolean;
  activeColors: any;
  emptyLabel?: string;
}

const ROW_HEADER_WIDTH = 110;
const COLUMN_WIDTH = 95;
const CELL_HEIGHT = 56;
const HEADER_HEIGHT = 48;

export const ProductMatrixGrid: React.FC<ProductMatrixGridProps> = ({
  data,
  selectedCellKey,
  onSelectCell,
  onAddBrand,
  onAddSize,
  isDarkMode,
  activeColors,
  emptyLabel = 'Pipes',
}) => {
  const { brands, sizes, cells } = data;

  const [addBrandVisible, setAddBrandVisible] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [submittingBrand, setSubmittingBrand] = useState(false);

  const [addSizeVisible, setAddSizeVisible] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [submittingSize, setSubmittingSize] = useState(false);

  const themeShadows = getThemeShadows(isDarkMode);

  const handleAddBrand = async () => {
    if (!newBrandName.trim() || submittingBrand) return;
    try {
      setSubmittingBrand(true);
      await onAddBrand(newBrandName.trim());
      setNewBrandName('');
      setAddBrandVisible(false);
    } catch (e) {
      console.error('Error adding brand:', e);
    } finally {
      setSubmittingBrand(false);
    }
  };

  const handleAddSize = async () => {
    if (!newSizeName.trim() || submittingSize) return;
    try {
      setSubmittingSize(true);
      await onAddSize(newSizeName.trim());
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
              <Text
                style={[
                  styles.headerTitle,
                  { color: activeColors.textPrimary },
                ]}
              >
                Size / Item
              </Text>
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
          {sizes.length === 0 ? (
            <View style={styles.emptyTableBanner}>
              <MaterialCommunityIcons name="table-plus" size={32} color={activeColors.primary} />
              <Text style={[styles.emptyTableTitle, { color: activeColors.textPrimary }]}>
                Koi item nahi mila
              </Text>
              <Text style={[styles.emptyTableSubtitle, { color: activeColors.textMuted }]}>
                Upar "add brands +" ya niche "Add Size +" daba kar start karein
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
              {sizes.map((size) => (
                <View key={size} style={styles.dataRow}>
                {/* Left Frozen Column: Size Label */}
                <View
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
                  <Text
                    style={[
                      styles.rowHeaderText,
                      { color: activeColors.textPrimary },
                    ]}
                    numberOfLines={2}
                  >
                    {size}
                  </Text>
                </View>

                {/* Brand Cells for this Size */}
                {brands.map((brand) => {
                  const cellKey = `${size}___${brand.toLowerCase()}`;
                  const cellData = cells[cellKey];
                  const isSelected = selectedCellKey === cellKey;
                  const stock = cellData ? cellData.currentStock : 0;
                  const hasStock = stock > 0;
                  const isLow = hasStock && stock <= 5;

                  return (
                    <TouchableOpacity
                      key={brand}
                      activeOpacity={0.7}
                      onPress={() => onSelectCell(cellKey, cellData || null, size, brand)}
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
            ))}

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
                  Naya Brand Add Karein
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  Jaise: Supreme, AKG, Finolex, Ashirvad etc.
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
              placeholder="Brand Name likhein..."
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
                  Naya Size / Item Add Karein
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  Jaise: 2 1/2", 3", Elbow 1", Tee 3/4" etc.
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
              placeholder="Size ya Item Name likhein..."
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
    </View>
  );
};

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
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
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
    paddingHorizontal: 8,
  },
  rowHeaderText: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
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
    gap: 4,
    borderRightWidth: 1.5,
    borderBottomWidth: 1,
  },
  addSizeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.xl,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 1.4,
    paddingVertical: 11,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
