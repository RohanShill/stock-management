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
  Searchbar,
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
  Product,
  ProductVariant,
  StandardUnit,
  formatPaiseToINR,
  rupeeToPaise,
  paiseToRupee,
  convertLength,
  calculateLineItemTotals,
  calculateInvoiceTotals,
  fromCanonicalBaseQuantity,
  toCanonicalBaseQuantity,
  calculateAggregateCut,
} from '@hardware-store/shared';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { SalesRepository } from '../../src/database/repositories/salesRepository.js';
import { useAppStore } from '../../src/store/useAppStore.js';
import { t } from '../../src/i18n/strings.js';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/theme/tokens.js';

interface CartLine {
  variantId: string;
  productName: string;
  variantName: string;
  measurementType: string;
  quantity: number;
  unit: StandardUnit;
  unitPricePaise: number;
  taxRatePercent: number;
  discountPaise: number;
  pipeCutSummary?: string;
  totalPaise: number;
}

export default function SalesScreen() {
  const { store, deviceId, user, language } = useAppStore();

  const [products, setProducts] = useState<Array<Product & { variants: ProductVariant[] }>>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<(Product & { variants: ProductVariant[] }) | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Line item entry
  const [quantityInput, setQuantityInput] = useState('1');
  const [unitSelection, setUnitSelection] = useState<StandardUnit>('piece');
  const [unitPriceInput, setUnitPriceInput] = useState('');

  // Pipe length calculator helper
  const [pipeCutLengthInput, setPipeCutLengthInput] = useState('3.0');
  const [pipeLengthUnit, setPipeLengthUnit] = useState<'m' | 'ft'>('m');

  // Cart
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [paidAmountRs, setPaidAmountRs] = useState('');
  const [invoiceDiscountRs, setInvoiceDiscountRs] = useState('0');

  // Checkout dialog & receipt
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<any | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const storeId = store?.id || 'default-store';
      const prods = await ProductRepository.getProductsWithVariants(storeId);
      setProducts(prods);
    } catch (e) {
      console.error('Error loading products for billing:', e);
    }
  }, [store]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (selectedVariant) {
      setUnitPriceInput(paiseToRupee(selectedVariant.sellingPricePaise).toString());
      if (selectedProduct?.measurementType === 'length') {
        setUnitSelection('m');
      } else {
        setUnitSelection(selectedProduct?.baseUnit || 'piece');
      }
    }
  }, [selectedVariant, selectedProduct]);

  const handleSelectProduct = (p: Product & { variants: ProductVariant[] }) => {
    setSelectedProduct(p);
    if (p.variants.length > 0) {
      setSelectedVariant(p.variants[0]);
    }
  };

  const handleSelectVariant = (v: ProductVariant) => {
    setSelectedVariant(v);
  };

  // Add Item to Bill Cart
  const handleAddToCart = () => {
    if (!selectedProduct || !selectedVariant) {
      Alert.alert('Required', 'Please select a product and variant to bill');
      return;
    }

    let qty = parseFloat(quantityInput || '1');
    let pipeSummary: string | undefined;

    if (selectedProduct.measurementType === 'length') {
      const cutLen = parseFloat(pipeCutLengthInput || '1');
      if (cutLen <= 0) {
        Alert.alert('Required', 'Please enter a valid cut length');
        return;
      }
      qty = cutLen;
      pipeSummary = `Cut Length: ${cutLen} ${pipeLengthUnit}`;
    }

    if (qty <= 0) {
      Alert.alert('Required', 'Quantity must be greater than 0');
      return;
    }

    const priceRs = parseFloat(unitPriceInput);
    if (isNaN(priceRs) || priceRs < 0) {
      Alert.alert('Required', 'Please enter a valid selling price');
      return;
    }

    const unitPricePaise = rupeeToPaise(priceRs);
    const lineTotal = Math.round(qty * unitPricePaise);

    const existingIdx = cart.findIndex((item) => item.variantId === selectedVariant.id);
    if (existingIdx !== -1 && selectedProduct.measurementType !== 'length') {
      const updated = [...cart];
      const newQty = updated[existingIdx].quantity + qty;
      updated[existingIdx].quantity = newQty;
      updated[existingIdx].totalPaise = Math.round(newQty * unitPricePaise);
      setCart(updated);
    } else {
      const newLine: CartLine = {
        variantId: selectedVariant.id,
        productName: selectedProduct.name,
        variantName: `${selectedVariant.name} ${selectedVariant.size ? `(${selectedVariant.size})` : ''}`,
        measurementType: selectedProduct.measurementType,
        quantity: qty,
        unit: selectedProduct.measurementType === 'length' ? 'm' : selectedProduct.baseUnit,
        unitPricePaise,
        taxRatePercent: selectedVariant.taxRatePercent || 0,
        discountPaise: 0,
        pipeCutSummary: pipeSummary,
        totalPaise: lineTotal,
      };
      setCart([...cart, newLine]);
    }

    // Reset inputs
    setQuantityInput('1');
  };

  const handleIncrementQty = (idx: number) => {
    const updated = [...cart];
    updated[idx].quantity += 1;
    updated[idx].totalPaise = Math.round(updated[idx].quantity * updated[idx].unitPricePaise);
    setCart(updated);
  };

  const handleDecrementQty = (idx: number) => {
    const updated = [...cart];
    if (updated[idx].quantity > 1) {
      updated[idx].quantity -= 1;
      updated[idx].totalPaise = Math.round(updated[idx].quantity * updated[idx].unitPricePaise);
      setCart(updated);
    } else {
      setCart(cart.filter((_, i) => i !== idx));
    }
  };

  const handleRemoveItem = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  // Calculations
  const subtotalPaise = cart.reduce((sum, item) => sum + item.totalPaise, 0);
  const invoiceDiscountPaise = rupeeToPaise(parseFloat(invoiceDiscountRs || '0'));
  const grandTotalPaise = Math.max(0, subtotalPaise - invoiceDiscountPaise);
  const paidPaise = paidAmountRs ? rupeeToPaise(parseFloat(paidAmountRs)) : grandTotalPaise;
  const outstandingPaise = Math.max(0, grandTotalPaise - paidPaise);

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add products before checking out');
      return;
    }
    setPaidAmountRs(paiseToRupee(grandTotalPaise).toString());
    setCheckoutModalVisible(true);
  };

  const handleCompleteSale = async () => {
    try {
      const storeId = store?.id || 'default-store';

      const saleRecord = await SalesRepository.createSale(
        {
          customerId: undefined,
          customerName: customerName.trim() || 'Walk-in Customer',
          customerPhone: customerPhone.trim() || undefined,
          saleDate: new Date().toISOString(),
          paymentMethod,
          paidAmountPaise: paidPaise,
          items: cart.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unit: item.unit,
            unitPricePaise: item.unitPricePaise,
            discountPaise: 0,
            taxRatePercent: item.taxRatePercent,
            pipeCutSummary: item.pipeCutSummary,
          })),
        },
        storeId,
        deviceId,
        user?.id
      );

      setCheckoutModalVisible(false);
      setLastSaleReceipt({
        ...saleRecord,
        itemsCount: cart.length,
      });

      // Clear cart
      setCart([]);
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setInvoiceDiscountRs('0');
      loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sale failed';
      Alert.alert('Checkout Error', msg);
    }
  };

  // Search filtering for products
  const filteredProducts = products.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      p.variants.some((v) => v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      {/* 1. Top Search Bar */}
      <Surface style={styles.searchHeaderCard}>
        <Text style={styles.headerTitle}>New Bill / Sale</Text>
        <Searchbar
          placeholder="Search products or SKU to bill..."
          onChangeText={setProductSearch}
          value={productSearch}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor={colors.textSecondary}
          placeholderTextColor={colors.textMuted}
        />
      </Surface>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* 2. Product & Variant Selector Card */}
        <Surface style={styles.selectorCard}>
          <Text style={styles.sectionHeaderTitle}>Select Item to Bill</Text>

          {/* Horizontal Product Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {filteredProducts.slice(0, 10).map((p) => (
              <Chip
                key={p.id}
                selected={selectedProduct?.id === p.id}
                onPress={() => handleSelectProduct(p)}
                style={[styles.chip, selectedProduct?.id === p.id && styles.chipSelected]}
                textStyle={[styles.chipText, selectedProduct?.id === p.id && styles.chipTextSelected]}
                showSelectedOverlay={false}
              >
                {p.name}
              </Chip>
            ))}
          </ScrollView>

          {/* Variants row if selected */}
          {selectedProduct && selectedProduct.variants.length > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <Text style={styles.fieldLabel}>Choose Variant / Size:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {selectedProduct.variants.map((v) => (
                  <Chip
                    key={v.id}
                    selected={selectedVariant?.id === v.id}
                    onPress={() => handleSelectVariant(v)}
                    style={[styles.chip, selectedVariant?.id === v.id && styles.chipSelected]}
                    textStyle={[styles.chipText, selectedVariant?.id === v.id && styles.chipTextSelected]}
                    showSelectedOverlay={false}
                  >
                    {v.name} {v.size ? `(${v.size})` : ''} • Stock: {v.currentStock}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quantity and Price Entry */}
          {selectedProduct?.measurementType === 'length' ? (
            <View style={styles.pipeHelperCard}>
              <Text style={styles.pipeHelperLabel}>
                Pipe Cutting Sale ({selectedProduct.name})
              </Text>
              <View style={styles.fieldRow}>
                <TextInput
                  label="Cut Length (metres) *"
                  value={pipeCutLengthInput}
                  onChangeText={setPipeCutLengthInput}
                  keyboardType="numeric"
                  mode="outlined"
                  style={[styles.input, { flex: 1, marginRight: spacing.xs }]}
                />
                <TextInput
                  label="Rate / metre (₹) *"
                  value={unitPriceInput}
                  onChangeText={setUnitPriceInput}
                  keyboardType="numeric"
                  mode="outlined"
                  style={[styles.input, { flex: 1, marginLeft: spacing.xs }]}
                />
              </View>
            </View>
          ) : (
            <View style={styles.fieldRow}>
              <TextInput
                label={`Quantity (${selectedProduct?.baseUnit || 'pcs'})`}
                value={quantityInput}
                onChangeText={setQuantityInput}
                keyboardType="numeric"
                mode="outlined"
                style={[styles.input, { flex: 1, marginRight: spacing.xs }]}
              />
              <TextInput
                label="Unit Price (₹)"
                value={unitPriceInput}
                onChangeText={setUnitPriceInput}
                keyboardType="numeric"
                mode="outlined"
                style={[styles.input, { flex: 1, marginLeft: spacing.xs }]}
              />
            </View>
          )}

          <Button
            mode="contained"
            icon="cart-plus"
            onPress={handleAddToCart}
            style={styles.addCartBtn}
            contentStyle={{ height: 44 }}
          >
            Add to Bill Cart
          </Button>
        </Surface>

        {/* 3. Cart Line Items Card */}
        <Surface style={styles.cartCard}>
          <View style={styles.cartHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>
              Bill Items ({cart.length})
            </Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={() => setCart([])}>
                <Text style={styles.clearCartText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {cart.length > 0 ? (
            cart.map((item, idx) => (
              <View key={idx} style={styles.cartItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartItemName}>{item.productName}</Text>
                  <Text style={styles.cartItemMeta}>
                    {item.variantName} • ₹{paiseToRupee(item.unitPricePaise)}/{item.unit}
                  </Text>
                  {item.pipeCutSummary && (
                    <Text style={styles.cartItemCutNote}>{item.pipeCutSummary}</Text>
                  )}
                </View>

                {/* Quantity Controls */}
                <View style={styles.qtyControlsContainer}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => handleDecrementQty(idx)}
                  >
                    <MaterialCommunityIcons name="minus" size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyNumber}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => handleIncrementQty(idx)}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={{ width: 80, alignItems: 'flex-end' }}>
                  <Text style={styles.cartItemTotal}>
                    {formatPaiseToINR(item.totalPaise)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveItem(idx)}
                    style={{ marginTop: 2 }}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCartBox}>
              <MaterialCommunityIcons name="cart-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyCartText}>Cart is empty. Select products above.</Text>
            </View>
          )}
        </Surface>

        {/* 4. Bill Summary Card */}
        {cart.length > 0 && (
          <Surface style={styles.summaryCard}>
            <View style={styles.summaryItemRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>{formatPaiseToINR(subtotalPaise)}</Text>
            </View>

            <View style={styles.summaryItemRow}>
              <Text style={styles.summaryLabel}>Discount (₹):</Text>
              <TextInput
                value={invoiceDiscountRs}
                onChangeText={setInvoiceDiscountRs}
                keyboardType="numeric"
                mode="outlined"
                dense
                style={styles.discountInput}
              />
            </View>

            <View style={[styles.summaryItemRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total:</Text>
              <Text style={styles.grandTotalValue}>
                {formatPaiseToINR(grandTotalPaise)}
              </Text>
            </View>
          </Surface>
        )}
      </ScrollView>

      {/* 5. Sticky Bottom Checkout Bar */}
      {cart.length > 0 && (
        <Surface style={styles.bottomCheckoutBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomBarLabel}>Total Payable</Text>
            <Text style={styles.bottomBarAmount}>
              {formatPaiseToINR(grandTotalPaise)}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={handleOpenCheckout}
            style={styles.checkoutBtn}
            contentStyle={{ height: 46 }}
          >
            Complete Bill
          </Button>
        </Surface>
      )}

      {/* 6. Checkout Modal Dialog */}
      <Portal>
        <Dialog
          visible={checkoutModalVisible}
          onDismiss={() => setCheckoutModalVisible(false)}
          style={styles.checkoutDialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Complete Sale & Invoice</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Customer Name"
              value={customerName}
              onChangeText={setCustomerName}
              mode="outlined"
              style={styles.input}
              placeholder="e.g. Ramesh Plumbing / Walk-in"
            />
            <TextInput
              label="Customer Phone (Optional for SMS / Bill)"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Payment Method:</Text>
            <SegmentedButtons
              value={paymentMethod}
              onValueChange={(val) => setPaymentMethod(val as any)}
              buttons={[
                { value: 'cash', label: 'Cash' },
                { value: 'upi', label: 'UPI' },
                { value: 'card', label: 'Card' },
                { value: 'credit', label: 'Credit / Khata' },
              ]}
              style={{ marginBottom: spacing.sm }}
            />

            <TextInput
              label="Amount Paid (₹)"
              value={paidAmountRs}
              onChangeText={setPaidAmountRs}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />

            {outstandingPaise > 0 && (
              <Text style={styles.creditWarning}>
                Remaining balance of {formatPaiseToINR(outstandingPaise)} will be recorded as customer credit.
              </Text>
            )}
          </Dialog.Content>

          <Dialog.Actions>
            <Button onPress={() => setCheckoutModalVisible(false)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCompleteSale}
              style={{ backgroundColor: colors.primary }}
            >
              Generate Bill
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 7. Receipt Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={lastSaleReceipt !== null}
          onDismiss={() => setLastSaleReceipt(null)}
          style={styles.checkoutDialog}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: colors.success }]}>
            Bill Generated Successfully!
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.receiptInvoice}>
              Invoice: {lastSaleReceipt?.invoiceNumber}
            </Text>
            <Text style={styles.receiptCustomer}>
              Customer: {lastSaleReceipt?.customerName || 'Walk-in'}
            </Text>
            <Text style={styles.receiptAmount}>
              Amount: {lastSaleReceipt ? formatPaiseToINR(lastSaleReceipt.grandTotalPaise) : ''}
            </Text>
            <Text style={styles.receiptStockNote}>
              Stock balances and financial movements have been updated locally in SQLite.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="contained"
              onPress={() => setLastSaleReceipt(null)}
              style={{ backgroundColor: colors.primary }}
            >
              Done / Next Bill
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
    elevation: 2,
  },
  headerTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  searchBar: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    elevation: 0,
    height: 44,
  },
  searchInput: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 90,
  },
  selectorCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sectionHeaderTitle: {
    ...typography.titleSmall,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  chipRow: {
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
  fieldLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  pipeHelperCard: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  pipeHelperLabel: {
    ...typography.labelSmall,
    color: colors.primary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  addCartBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  cartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  clearCartText: {
    ...typography.labelSmall,
    color: colors.danger,
    fontWeight: '600',
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartItemName: {
    ...typography.labelMedium,
    color: colors.textPrimary,
  },
  cartItemMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cartItemCutNote: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '500',
  },
  qtyControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 4,
  },
  qtyBtn: {
    padding: 6,
  },
  qtyNumber: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  cartItemTotal: {
    ...typography.labelLarge,
    color: colors.textPrimary,
  },
  emptyCartBox: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  summaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.labelLarge,
    color: colors.textPrimary,
  },
  discountInput: {
    width: 80,
    height: 36,
    backgroundColor: colors.surfaceSubtle,
    fontSize: 13,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  grandTotalLabel: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  grandTotalValue: {
    ...typography.currencyLarge,
    color: colors.primary,
  },
  bottomCheckoutBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 8,
  },
  bottomBarLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  bottomBarAmount: {
    ...typography.titleMedium,
    color: colors.primary,
  },
  checkoutBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    minWidth: 140,
  },
  checkoutDialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  dialogTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  creditWarning: {
    ...typography.bodySmall,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  receiptInvoice: {
    ...typography.labelLarge,
    color: colors.textPrimary,
  },
  receiptCustomer: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  receiptAmount: {
    ...typography.currencyLarge,
    color: colors.primary,
    marginVertical: spacing.sm,
  },
  receiptStockNote: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
});
