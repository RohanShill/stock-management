import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { lightColors, darkColors, colors, spacing, borderRadius, shadows, getThemeShadows, typography } from '../../src/theme/tokens.js';

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
  const { store, deviceId, user, language, isDarkMode } = useAppStore();
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
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* 1. Top Header & Search Bar */}
      <Surface
        style={[
          styles.searchHeaderCard,
          {
            backgroundColor: activeColors.surface,
            borderBottomColor: activeColors.border,
            paddingTop: Math.max(topInset + 8, 16),
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <MaterialCommunityIcons name="point-of-sale" size={24} color={activeColors.primary} />
          <Text style={[styles.headerTitle, { color: activeColors.textPrimary }]}>New Bill / Sale</Text>
        </View>
        <Searchbar
          placeholder="Search products or SKU to bill..."
          onChangeText={setProductSearch}
          value={productSearch}
          style={[styles.searchBar, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}
          inputStyle={[styles.searchInput, { color: activeColors.textPrimary }]}
          iconColor={activeColors.textSecondary}
          placeholderTextColor={activeColors.textMuted}
        />
      </Surface>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* 2. Product & Variant Selector Card */}
        <Surface style={[styles.selectorCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border, ...themeShadows.card }]}>
          <View style={styles.cardHeaderTitleRow}>
            <MaterialCommunityIcons name="package-variant" size={18} color={activeColors.primary} />
            <Text style={[styles.sectionHeaderTitle, { color: activeColors.primary }]}>Select Item to Bill</Text>
          </View>

          {/* Horizontal Product Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {filteredProducts.slice(0, 15).map((p) => {
              const isSelected = selectedProduct?.id === p.id;
              return (
                <Chip
                  key={p.id}
                  selected={isSelected}
                  onPress={() => handleSelectProduct(p)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? (isDarkMode ? '#1E293B' : '#EFF6FF')
                        : (isDarkMode ? '#111827' : '#F1F5F9'),
                      borderColor: isSelected ? activeColors.primary : activeColors.border,
                      borderWidth: isSelected ? 1.5 : 1,
                    },
                  ]}
                  textStyle={[
                    styles.chipText,
                    {
                      color: isSelected ? activeColors.primary : activeColors.textSecondary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                  showSelectedOverlay={false}
                >
                  {p.name}
                </Chip>
              );
            })}
          </ScrollView>

          {/* Variants row if selected */}
          {selectedProduct && selectedProduct.variants.length > 0 && (
            <View style={{ marginTop: spacing.xs }}>
              <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>Choose Variant / Size:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {selectedProduct.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <Chip
                      key={v.id}
                      selected={isSelected}
                      onPress={() => handleSelectVariant(v)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected
                            ? (isDarkMode ? '#1E293B' : '#EFF6FF')
                            : (isDarkMode ? '#111827' : '#F1F5F9'),
                          borderColor: isSelected ? activeColors.primary : activeColors.border,
                          borderWidth: isSelected ? 1.5 : 1,
                        },
                      ]}
                      textStyle={[
                        styles.chipText,
                        {
                          color: isSelected ? activeColors.primary : activeColors.textSecondary,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                      showSelectedOverlay={false}
                    >
                      {v.name} {v.size ? `(${v.size})` : ''} • Stock: {v.currentStock}
                    </Chip>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Quantity and Price Entry */}
          {selectedProduct?.measurementType === 'length' ? (
            <View style={[styles.pipeHelperCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
              <Text style={[styles.pipeHelperLabel, { color: activeColors.primary }]}>
                ✂️ Pipe Cutting Sale ({selectedProduct.name})
              </Text>
              <View style={styles.fieldRow}>
                <TextInput
                  label="Cut Length (metres) *"
                  value={pipeCutLengthInput}
                  onChangeText={setPipeCutLengthInput}
                  keyboardType="numeric"
                  mode="outlined"
                  style={[styles.input, { flex: 1, marginRight: spacing.xs, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
                />
                <TextInput
                  label="Rate / metre (₹) *"
                  value={unitPriceInput}
                  onChangeText={setUnitPriceInput}
                  keyboardType="numeric"
                  mode="outlined"
                  style={[styles.input, { flex: 1, marginLeft: spacing.xs, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                  textColor={activeColors.textPrimary}
                  placeholderTextColor={activeColors.textMuted}
                  outlineColor={activeColors.border}
                  activeOutlineColor={activeColors.primary}
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
                style={[styles.input, { flex: 1, marginRight: spacing.xs, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                textColor={activeColors.textPrimary}
                placeholderTextColor={activeColors.textMuted}
                outlineColor={activeColors.border}
                activeOutlineColor={activeColors.primary}
              />
              <TextInput
                label="Unit Price (₹)"
                value={unitPriceInput}
                onChangeText={setUnitPriceInput}
                keyboardType="numeric"
                mode="outlined"
                style={[styles.input, { flex: 1, marginLeft: spacing.xs, backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                textColor={activeColors.textPrimary}
                placeholderTextColor={activeColors.textMuted}
                outlineColor={activeColors.border}
                activeOutlineColor={activeColors.primary}
              />
            </View>
          )}

          <Button
            mode="contained"
            icon="cart-plus"
            onPress={handleAddToCart}
            style={[styles.addCartBtn, { backgroundColor: activeColors.primary }]}
            contentStyle={{ height: 46 }}
          >
            Add to Bill Cart
          </Button>
        </Surface>

        {/* 3. Cart Line Items Card */}
        <Surface style={[styles.cartCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border, ...themeShadows.card }]}>
          <View style={styles.cartHeaderRow}>
            <View style={styles.cardHeaderTitleRow}>
              <MaterialCommunityIcons name="cart-outline" size={18} color={activeColors.primary} />
              <Text style={[styles.sectionHeaderTitle, { color: activeColors.textPrimary, marginBottom: 0 }]}>
                Bill Items ({cart.length})
              </Text>
            </View>
            {cart.length > 0 && (
              <TouchableOpacity onPress={() => setCart([])}>
                <Text style={[styles.clearCartText, { color: activeColors.danger }]}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {cart.length > 0 ? (
            cart.map((item, idx) => (
              <View key={idx} style={[styles.cartItemRow, { borderBottomColor: activeColors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cartItemName, { color: activeColors.textPrimary }]}>{item.productName}</Text>
                  <Text style={[styles.cartItemMeta, { color: activeColors.textSecondary }]}>
                    {item.variantName} • ₹{paiseToRupee(item.unitPricePaise)}/{item.unit}
                  </Text>
                  {item.pipeCutSummary && (
                    <Text style={[styles.cartItemCutNote, { color: activeColors.accent }]}>{item.pipeCutSummary}</Text>
                  )}
                </View>

                {/* Quantity Controls */}
                <View style={[styles.qtyControlsContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => handleDecrementQty(idx)}
                  >
                    <MaterialCommunityIcons name="minus" size={16} color={activeColors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={[styles.qtyNumber, { color: activeColors.textPrimary }]}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => handleIncrementQty(idx)}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color={activeColors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={{ width: 85, alignItems: 'flex-end' }}>
                  <Text style={[styles.cartItemTotal, { color: activeColors.textPrimary }]}>
                    {formatPaiseToINR(item.totalPaise)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveItem(idx)}
                    style={{ marginTop: 4 }}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={18} color={activeColors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCartBox}>
              <MaterialCommunityIcons name="cart-outline" size={36} color={activeColors.textMuted} />
              <Text style={[styles.emptyCartText, { color: activeColors.textMuted }]}>Cart is empty. Select products above.</Text>
            </View>
          )}
        </Surface>

        {/* 4. Bill Summary Card */}
        {cart.length > 0 && (
          <Surface style={[styles.summaryCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border, ...themeShadows.card }]}>
            <View style={styles.summaryItemRow}>
              <Text style={[styles.summaryLabel, { color: activeColors.textSecondary }]}>Subtotal:</Text>
              <Text style={[styles.summaryValue, { color: activeColors.textPrimary }]}>{formatPaiseToINR(subtotalPaise)}</Text>
            </View>

            <View style={styles.summaryItemRow}>
              <Text style={[styles.summaryLabel, { color: activeColors.textSecondary }]}>Discount (₹):</Text>
              <TextInput
                value={invoiceDiscountRs}
                onChangeText={setInvoiceDiscountRs}
                keyboardType="numeric"
                mode="outlined"
                dense
                style={[styles.discountInput, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
                textColor={activeColors.textPrimary}
                outlineColor={activeColors.border}
                activeOutlineColor={activeColors.primary}
              />
            </View>

            <View style={[styles.summaryItemRow, styles.grandTotalRow, { borderTopColor: activeColors.border }]}>
              <Text style={[styles.grandTotalLabel, { color: activeColors.textPrimary }]}>Grand Total:</Text>
              <Text style={[styles.grandTotalValue, { color: activeColors.primary }]}>
                {formatPaiseToINR(grandTotalPaise)}
              </Text>
            </View>
          </Surface>
        )}
      </ScrollView>

      {/* 5. Sticky Bottom Checkout Bar */}
      {cart.length > 0 && (
        <Surface style={[styles.bottomCheckoutBar, { backgroundColor: activeColors.surface, borderTopColor: activeColors.border, ...themeShadows.floating }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bottomBarLabel, { color: activeColors.textSecondary }]}>Total Payable</Text>
            <Text style={[styles.bottomBarAmount, { color: activeColors.primary }]}>
              {formatPaiseToINR(grandTotalPaise)}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={handleOpenCheckout}
            style={[styles.checkoutBtn, { backgroundColor: activeColors.primary }]}
            contentStyle={{ height: 46 }}
            icon="check-circle-outline"
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
          style={[styles.checkoutDialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>Complete Sale & Invoice</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Customer Name"
              value={customerName}
              onChangeText={setCustomerName}
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
              placeholder="e.g. Ramesh Plumbing / Walk-in"
            />
            <TextInput
              label="Customer Phone (Optional for SMS / Bill)"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
            />

            <Text style={[styles.fieldLabel, { color: activeColors.textSecondary, marginTop: 4 }]}>Payment Method:</Text>
            <SegmentedButtons
              value={paymentMethod}
              onValueChange={(val) => setPaymentMethod(val as any)}
              buttons={[
                { value: 'cash', label: 'Cash', icon: 'cash' },
                { value: 'upi', label: 'UPI', icon: 'qrcode' },
                { value: 'card', label: 'Card', icon: 'credit-card' },
                { value: 'credit', label: 'Khata', icon: 'book-open' },
              ]}
              theme={{
                colors: {
                  secondaryContainer: isDarkMode ? '#1E3A8A' : '#DBEAFE',
                  onSecondaryContainer: activeColors.primary,
                  outline: activeColors.border,
                },
              }}
              style={{ marginBottom: spacing.sm }}
            />

            <TextInput
              label="Amount Paid (₹)"
              value={paidAmountRs}
              onChangeText={setPaidAmountRs}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
            />

            {outstandingPaise > 0 && (
              <Text style={[styles.creditWarning, { color: activeColors.warning }]}>
                Remaining balance of {formatPaiseToINR(outstandingPaise)} will be recorded as customer credit.
              </Text>
            )}
          </Dialog.Content>

          <Dialog.Actions>
            <Button onPress={() => setCheckoutModalVisible(false)} textColor={activeColors.textSecondary}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCompleteSale}
              style={{ backgroundColor: activeColors.primary }}
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
          style={[styles.checkoutDialog, { backgroundColor: activeColors.surface }]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.success }]}>
            Bill Generated Successfully!
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.receiptInvoice, { color: activeColors.textPrimary }]}>
              Invoice: {lastSaleReceipt?.invoiceNumber}
            </Text>
            <Text style={[styles.receiptCustomer, { color: activeColors.textSecondary }]}>
              Customer: {lastSaleReceipt?.customerName || 'Walk-in'}
            </Text>
            <Text style={[styles.receiptAmount, { color: activeColors.primary }]}>
              Amount: {lastSaleReceipt ? formatPaiseToINR(lastSaleReceipt.grandTotalPaise) : ''}
            </Text>
            <Text style={[styles.receiptStockNote, { color: activeColors.textMuted }]}>
              Stock balances and financial movements have been updated locally in SQLite.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              mode="contained"
              onPress={() => setLastSaleReceipt(null)}
              style={{ backgroundColor: activeColors.primary }}
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
  },
  searchHeaderCard: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    elevation: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.titleMedium,
    fontWeight: '700',
  },
  searchBar: {
    borderRadius: borderRadius.lg,
    elevation: 0,
    height: 44,
  },
  searchInput: {
    fontSize: 14,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 110,
  },
  selectorCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  cardHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  sectionHeaderTitle: {
    ...typography.titleSmall,
    fontWeight: '700',
  },
  chipRow: {
    marginBottom: spacing.sm,
  },
  chip: {
    marginRight: 6,
    height: 34,
    borderRadius: borderRadius.full,
  },
  chipSelected: {},
  chipText: {
    fontSize: 12,
  },
  chipTextSelected: {
    fontWeight: '700',
  },
  fieldLabel: {
    ...typography.labelSmall,
    marginBottom: 4,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  pipeHelperCard: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  pipeHelperLabel: {
    ...typography.labelSmall,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  addCartBtn: {
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  cartCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clearCartText: {
    ...typography.labelSmall,
    fontWeight: '700',
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  cartItemName: {
    ...typography.labelMedium,
    fontWeight: '700',
  },
  cartItemMeta: {
    ...typography.bodySmall,
    marginTop: 1,
  },
  cartItemCutNote: {
    fontSize: 11,
    fontWeight: '600',
  },
  qtyControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 4,
  },
  qtyBtn: {
    padding: 6,
  },
  qtyNumber: {
    ...typography.labelMedium,
    minWidth: 24,
    textAlign: 'center',
    fontWeight: '700',
  },
  cartItemTotal: {
    ...typography.labelLarge,
    fontWeight: '700',
  },
  emptyCartBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartText: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  summaryCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
  },
  summaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    ...typography.bodyMedium,
  },
  summaryValue: {
    ...typography.labelLarge,
    fontWeight: '700',
  },
  discountInput: {
    width: 90,
    height: 38,
    fontSize: 13,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  grandTotalLabel: {
    ...typography.titleSmall,
    fontWeight: '700',
  },
  grandTotalValue: {
    ...typography.currencyLarge,
    fontWeight: '800',
  },
  bottomCheckoutBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    elevation: 8,
  },
  bottomBarLabel: {
    ...typography.labelSmall,
  },
  bottomBarAmount: {
    ...typography.titleMedium,
    fontWeight: '800',
  },
  checkoutBtn: {
    borderRadius: borderRadius.lg,
    minWidth: 150,
  },
  checkoutDialog: {
    borderRadius: borderRadius.xl,
    paddingBottom: spacing.xs,
  },
  dialogTitle: {
    ...typography.titleMedium,
    fontWeight: '700',
  },
  creditWarning: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  receiptInvoice: {
    ...typography.labelLarge,
    fontWeight: '700',
  },
  receiptCustomer: {
    ...typography.bodyMedium,
    marginTop: 2,
  },
  receiptAmount: {
    ...typography.currencyLarge,
    marginVertical: spacing.sm,
    fontWeight: '800',
  },
  receiptStockNote: {
    ...typography.bodySmall,
  },
});
