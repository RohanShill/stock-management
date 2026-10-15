import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  TextInput,
  Button,
  Chip,
  SegmentedButtons,
  Surface,
  IconButton,
  Portal,
  Dialog,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Purchase,
  Product,
  ProductVariant,
  Supplier,
  StandardUnit,
  formatPaiseToINR,
  rupeeToPaise,
  paiseToRupee,
  convertLength,
} from '@hardware-store/shared';
import { PurchaseRepository } from '../../src/database/repositories/purchaseRepository.js';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { PartiesRepository } from '../../src/database/repositories/partiesRepository.js';
import { useAppStore } from '../../src/store/useAppStore.js';
import { t } from '../../src/i18n/strings.js';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/theme/tokens.js';

interface PurchaseLineItem {
  id: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unit: StandardUnit;
  unitCostRs: number;
  totalCostRs: number;
  pipeLengthPerPieceMm?: number;
  numberOfPieces?: number;
}

export default function PurchasesScreen() {
  const { store, deviceId, user, language } = useAppStore();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Array<Product & { variants: ProductVariant[] }>>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Step 1: Supplier & Reference
  const [supplierBillNo, setSupplierBillNo] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Step 2: Product Addition Form
  const [selectedProduct, setSelectedProduct] = useState<(Product & { variants: ProductVariant[] }) | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantityInput, setQuantityInput] = useState('10');
  const [unitCostInput, setUnitCostInput] = useState('100');

  // Pipe purchase helper fields
  const [numPipesInput, setNumPipesInput] = useState('10');
  const [lengthPerPipeMInput, setLengthPerPipeMInput] = useState('3');

  // Multi-item Cart for the Purchase
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([]);

  // Step 4: Payment Details
  const [paidAmountRs, setPaidAmountRs] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'credit' | 'cheque'>('bank_transfer');

  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Quick Add Supplier Dialog
  const [addSupplierVisible, setAddSupplierVisible] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const storeId = store?.id || 'default-store';
      const [purchList, prodList, supList] = await Promise.all([
        PurchaseRepository.getPurchases(storeId),
        ProductRepository.getProductsWithVariants(storeId),
        PartiesRepository.getSuppliers(storeId),
      ]);
      setPurchases(purchList);
      setProducts(prodList);
      setSuppliers(supList);

      if (supList.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(supList[0].id);
      }

      if (prodList.length > 0 && !selectedProduct) {
        setSelectedProduct(prodList[0]);
        if (prodList[0].variants.length > 0) {
          setSelectedVariant(prodList[0].variants[0]);
          setUnitCostInput(paiseToRupee(prodList[0].variants[0].purchasePricePaise || 10000).toString());
        }
      }
    } catch (e) {
      console.error('Error loading purchase data:', e);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProductSelect = (p: Product & { variants: ProductVariant[] }) => {
    setSelectedProduct(p);
    if (p.variants.length > 0) {
      setSelectedVariant(p.variants[0]);
      setUnitCostInput(paiseToRupee(p.variants[0].purchasePricePaise || 10000).toString());
    }
  };

  const handleVariantSelect = (v: ProductVariant) => {
    setSelectedVariant(v);
    setUnitCostInput(paiseToRupee(v.purchasePricePaise || 10000).toString());
  };

  // Add Item to Purchase Lines
  const handleAddLineItem = () => {
    if (!selectedProduct || !selectedVariant) {
      Alert.alert('Required', 'Please select a product and variant');
      return;
    }

    const costPerUnit = parseFloat(unitCostInput || '0');
    if (costPerUnit <= 0) {
      Alert.alert('Required', 'Please enter a valid purchase cost');
      return;
    }

    let qty = parseFloat(quantityInput || '1');
    let pipeLengthPerPieceMm: number | undefined;
    let numberOfPieces: number | undefined;

    if (selectedProduct.measurementType === 'length') {
      const numPipes = parseFloat(numPipesInput || '1');
      const lengthPerPipeM = parseFloat(lengthPerPipeMInput || '3');
      pipeLengthPerPieceMm = convertLength(lengthPerPipeM, 'm', 'mm');
      numberOfPieces = numPipes;
      qty = numPipes * lengthPerPipeM; // total length in metres
    }

    if (qty <= 0) {
      Alert.alert('Required', 'Quantity must be greater than 0');
      return;
    }

    const totalCostRs = qty * costPerUnit;

    const newItem: PurchaseLineItem = {
      id: Math.random().toString(36).substring(7),
      variantId: selectedVariant.id,
      productName: selectedProduct.name,
      variantName: `${selectedVariant.name} ${selectedVariant.size ? `(${selectedVariant.size})` : ''}`,
      quantity: qty,
      unit: selectedProduct.measurementType === 'length' ? 'm' : selectedProduct.baseUnit,
      unitCostRs: costPerUnit,
      totalCostRs,
      pipeLengthPerPieceMm,
      numberOfPieces,
    };

    setLineItems([...lineItems, newItem]);

    // Auto-update total paid amount suggestion
    const newGrandTotal = [...lineItems, newItem].reduce((sum, item) => sum + item.totalCostRs, 0);
    setPaidAmountRs(newGrandTotal.toString());
  };

  const handleRemoveLineItem = (id: string) => {
    const updated = lineItems.filter((item) => item.id !== id);
    setLineItems(updated);
    const newGrandTotal = updated.reduce((sum, item) => sum + item.totalCostRs, 0);
    setPaidAmountRs(newGrandTotal.toString());
  };

  const grandTotalRs = lineItems.reduce((sum, item) => sum + item.totalCostRs, 0);
  const paidRs = parseFloat(paidAmountRs || '0');
  const outstandingRs = Math.max(0, grandTotalRs - paidRs);

  const handleConfirmPurchase = async () => {
    if (!supplierBillNo.trim()) {
      Alert.alert('Required', 'Please enter supplier invoice / bill reference number');
      return;
    }
    if (lineItems.length === 0) {
      Alert.alert('Required', 'Please add at least one product line item to this purchase');
      return;
    }

    try {
      const storeId = store?.id || 'default-store';
      const paidPaise = rupeeToPaise(paidRs);

      await PurchaseRepository.createPurchase(
        {
          invoiceNumber: supplierBillNo.trim(),
          supplierId: selectedSupplierId || undefined,
          purchaseDate: new Date().toISOString(),
          status: 'received',
          paymentMethod,
          paidAmountPaise: paidPaise,
          items: lineItems.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unit: item.unit,
            unitCostPaise: rupeeToPaise(item.unitCostRs),
            pipeLengthPerPieceMm: item.pipeLengthPerPieceMm,
            numberOfPieces: item.numberOfPieces,
          })),
        },
        storeId,
        deviceId,
        user?.id
      );

      setConfirmDialogVisible(false);
      Alert.alert(
        'Goods Received & Stock Updated!',
        `Purchase bill ${supplierBillNo} confirmed. Inventory balances and stock movement ledger updated.`
      );

      // Reset form
      setSupplierBillNo('');
      setLineItems([]);
      setPaidAmountRs('');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purchase error';
      Alert.alert('Purchase Error', msg);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupName.trim() || !newSupPhone.trim()) {
      Alert.alert('Required', 'Supplier name and phone are required');
      return;
    }
    try {
      const storeId = store?.id || 'default-store';
      const sup = await PartiesRepository.createSupplier(
        { name: newSupName.trim(), phone: newSupPhone.trim() },
        storeId,
        deviceId
      );
      await loadData();
      setSelectedSupplierId(sup.id);
      setAddSupplierVisible(false);
      setNewSupName('');
      setNewSupPhone('');
      Alert.alert('Supplier Added', `Selected "${sup.name}"`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add supplier');
    }
  };

  const selectedSupplierObj = suppliers.find((s) => s.id === selectedSupplierId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Header Card */}
      <Surface style={styles.headerCard}>
        <Text style={styles.headerTitle}>Record Goods Inward</Text>
        <Text style={styles.headerSubtitle}>
          Receive products from vendors, update stock levels & record supplier bills.
        </Text>
      </Surface>

      {/* Step 1: Supplier & Bill Reference */}
      <Surface style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>Step 1: Supplier Details</Text>
          <TouchableOpacity onPress={() => setAddSupplierVisible(true)}>
            <Text style={styles.actionText}>+ Add Supplier</Text>
          </TouchableOpacity>
        </View>

        {/* Supplier Horizontal Scroll */}
        <Text style={styles.fieldLabel}>Select Supplier:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {suppliers.map((s) => (
            <Chip
              key={s.id}
              selected={selectedSupplierId === s.id}
              onPress={() => setSelectedSupplierId(s.id)}
              style={[styles.chip, selectedSupplierId === s.id && styles.chipSelected]}
              textStyle={[styles.chipText, selectedSupplierId === s.id && styles.chipTextSelected]}
              showSelectedOverlay={false}
            >
              {s.name}
            </Chip>
          ))}
        </ScrollView>

        <TextInput
          label="Supplier Invoice / Bill No. *"
          value={supplierBillNo}
          onChangeText={setSupplierBillNo}
          mode="outlined"
          style={styles.input}
          placeholder="e.g. INV-2026-904"
        />
      </Surface>

      {/* Step 2: Add Products Received */}
      <Surface style={styles.sectionCard}>
        <Text style={styles.sectionHeading}>Step 2: Add Products</Text>

        <Text style={styles.fieldLabel}>1. Select Product:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {products.map((p) => (
            <Chip
              key={p.id}
              selected={selectedProduct?.id === p.id}
              onPress={() => handleProductSelect(p)}
              style={[styles.chip, selectedProduct?.id === p.id && styles.chipSelected]}
              textStyle={[styles.chipText, selectedProduct?.id === p.id && styles.chipTextSelected]}
              showSelectedOverlay={false}
            >
              {p.name}
            </Chip>
          ))}
        </ScrollView>

        {selectedProduct && selectedProduct.variants.length > 0 && (
          <>
            <Text style={styles.fieldLabel}>2. Select Variant / Size:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {selectedProduct.variants.map((v) => (
                <Chip
                  key={v.id}
                  selected={selectedVariant?.id === v.id}
                  onPress={() => handleVariantSelect(v)}
                  style={[styles.chip, selectedVariant?.id === v.id && styles.chipSelected]}
                  textStyle={[styles.chipText, selectedVariant?.id === v.id && styles.chipTextSelected]}
                  showSelectedOverlay={false}
                >
                  {v.name} {v.size ? `(${v.size})` : ''}
                </Chip>
              ))}
            </ScrollView>
          </>
        )}

        {/* Pipe Specific Helper or Standard Quantity */}
        {selectedProduct?.measurementType === 'length' ? (
          <View style={styles.pipeHelperCard}>
            <Text style={styles.pipeHelperTitle}>
              Pipe Inward Helper ({selectedProduct.name})
            </Text>
            <View style={styles.rowFields}>
              <TextInput
                label="No. of Pipes"
                value={numPipesInput}
                onChangeText={setNumPipesInput}
                keyboardType="numeric"
                mode="outlined"
                style={[styles.input, { flex: 1, marginRight: spacing.xs }]}
              />
              <TextInput
                label="Length per Pipe (m)"
                value={lengthPerPipeMInput}
                onChangeText={setLengthPerPipeMInput}
                keyboardType="numeric"
                mode="outlined"
                style={[styles.input, { flex: 1, marginLeft: spacing.xs }]}
              />
            </View>
            <Text style={styles.pipeCalculatedText}>
              Total Received Length = {(parseFloat(numPipesInput || '0') * parseFloat(lengthPerPipeMInput || '0')).toFixed(1)} metres
            </Text>
          </View>
        ) : (
          <View style={styles.rowFields}>
            <TextInput
              label={`Quantity (${selectedProduct?.baseUnit || 'pcs'})`}
              value={quantityInput}
              onChangeText={setQuantityInput}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, { flex: 1, marginRight: spacing.xs }]}
            />
          </View>
        )}

        <TextInput
          label="Purchase Cost per Unit (₹)"
          value={unitCostInput}
          onChangeText={setUnitCostInput}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
        />

        <Button
          mode="contained-tonal"
          icon="plus-circle-outline"
          onPress={handleAddLineItem}
          style={styles.addLineBtn}
          textColor={colors.primary}
        >
          Add Item to Bill
        </Button>
      </Surface>

      {/* Step 3: Purchase Line Items Cart */}
      {lineItems.length > 0 && (
        <Surface style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>
            Step 3: Items in Bill ({lineItems.length})
          </Text>

          {lineItems.map((item) => (
            <View key={item.id} style={styles.lineItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineItemTitle}>{item.productName}</Text>
                <Text style={styles.lineItemSubtitle}>
                  {item.variantName} • {item.quantity} {item.unit} @ ₹{item.unitCostRs}/{item.unit}
                </Text>
                {item.numberOfPieces && (
                  <Text style={styles.lineItemPipeNote}>
                    {item.numberOfPieces} pipes of {(item.pipeLengthPerPieceMm! / 1000).toFixed(1)}m each
                  </Text>
                )}
              </View>

              <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6 }}>
                <Text style={styles.lineItemTotal}>₹{item.totalCostRs.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => handleRemoveLineItem(item.id)}>
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Surface>
      )}

      {/* Step 4: Payment Details & Summary */}
      <Surface style={styles.sectionCard}>
        <Text style={styles.sectionHeading}>Step 4: Bill Summary & Payment</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Purchase Value:</Text>
          <Text style={styles.summaryValueBig}>₹{grandTotalRs.toFixed(2)}</Text>
        </View>

        <View style={styles.rowFields}>
          <TextInput
            label="Amount Paid (₹)"
            value={paidAmountRs}
            onChangeText={setPaidAmountRs}
            keyboardType="numeric"
            mode="outlined"
            style={[styles.input, { flex: 1, marginRight: spacing.xs }]}
          />
          <View style={{ flex: 1, marginLeft: spacing.xs, justifyContent: 'center' }}>
            <Text style={styles.outstandingLabel}>Outstanding Balance:</Text>
            <Text style={[styles.outstandingValue, outstandingRs > 0 && { color: colors.danger }]}>
              ₹{outstandingRs.toFixed(2)}
            </Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Payment Method:</Text>
        <SegmentedButtons
          value={paymentMethod}
          onValueChange={(val) => setPaymentMethod(val as any)}
          buttons={[
            { value: 'bank_transfer', label: 'Bank' },
            { value: 'cash', label: 'Cash' },
            { value: 'credit', label: 'Credit' },
            { value: 'cheque', label: 'Cheque' },
          ]}
          style={{ marginVertical: spacing.xs }}
        />

        {/* Primary Confirmation Button */}
        <Button
          mode="contained"
          icon="check-circle-outline"
          onPress={() => setConfirmDialogVisible(true)}
          disabled={lineItems.length === 0 || !supplierBillNo.trim()}
          style={styles.confirmBtn}
          contentStyle={{ height: 48 }}
        >
          Confirm Goods Received
        </Button>
      </Surface>

      {/* Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={confirmDialogVisible}
          onDismiss={() => setConfirmDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Confirm Purchase Receipt</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Are you sure you want to confirm this purchase?
            </Text>
            <View style={styles.dialogSummaryBox}>
              <Text style={styles.dialogSummaryItem}>
                • Bill No: <Text style={{ fontWeight: '700' }}>{supplierBillNo}</Text>
              </Text>
              <Text style={styles.dialogSummaryItem}>
                • Supplier: {selectedSupplierObj?.name || 'Unassigned'}
              </Text>
              <Text style={styles.dialogSummaryItem}>
                • Items Count: {lineItems.length} products
              </Text>
              <Text style={styles.dialogSummaryItem}>
                • Total Bill: ₹{grandTotalRs.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.dialogHelpText}>
              This will immediately increment variant stock balances and record the movement in the audit ledger.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDialogVisible(false)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleConfirmPurchase} style={{ backgroundColor: colors.primary }}>
              Confirm & Inward
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Supplier Dialog */}
      <Portal>
        <Dialog visible={addSupplierVisible} onDismiss={() => setAddSupplierVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Add New Supplier</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Supplier / Business Name *"
              value={newSupName}
              onChangeText={setNewSupName}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Phone Number *"
              value={newSupPhone}
              onChangeText={setNewSupPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddSupplierVisible(false)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleCreateSupplier} style={{ backgroundColor: colors.primary }}>
              Save Supplier
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 50,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  headerTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    ...typography.titleSmall,
    color: colors.primary,
    fontWeight: '700',
  },
  actionText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '600',
  },
  fieldLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  chipScroll: {
    marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceSubtle,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
    height: 32,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  rowFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pipeHelperCard: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  pipeHelperTitle: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  pipeCalculatedText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  addLineBtn: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineItemTitle: {
    ...typography.labelLarge,
    color: colors.textPrimary,
  },
  lineItemSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lineItemPipeNote: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '500',
  },
  lineItemTotal: {
    ...typography.labelLarge,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
  },
  summaryValueBig: {
    ...typography.currencyLarge,
    color: colors.primary,
  },
  outstandingLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  outstandingValue: {
    ...typography.labelLarge,
    color: colors.textPrimary,
    marginTop: 2,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  dialogTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  dialogText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  dialogSummaryBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  dialogSummaryItem: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginVertical: 2,
  },
  dialogHelpText: {
    ...typography.labelSmall,
    color: colors.textMuted,
  },
});
