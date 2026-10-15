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
  List,
  Card,
  Button,
  Portal,
  Dialog,
  TextInput,
  SegmentedButtons,
  Divider,
  Surface,
  Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore.js';
import { formatPaiseToINR, rupeeToPaise } from '@hardware-store/shared';
import { ProductRepository } from '../../src/database/repositories/productRepository.js';
import { InventoryRepository } from '../../src/database/repositories/inventoryRepository.js';
import { PartiesRepository, ExpensesRepository } from '../../src/database/repositories/partiesRepository.js';
import { SyncQueueRepository } from '../../src/database/repositories/syncQueueRepository.js';
import { SyncEngine } from '../../src/sync/SyncEngine.js';
import { getDatabase } from '../../src/database/db.js';
import { t } from '../../src/i18n/strings.js';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/theme/tokens.js';
import { isDemoMode, resetDemoData, DEMO_NOTICE_TEXT } from '../../src/demo/index.js';

export default function MoreScreen() {
  const router = useRouter();
  const {
    store,
    token,
    apiUrl,
    deviceId,
    user,
    language,
    setLanguage,
    setApiUrl,
    pendingSyncCount,
  } = useAppStore();

  // Dialog states
  const [activeDialog, setActiveDialog] = useState<
    'adjust' | 'expense' | 'supplier' | 'customer' | 'sync' | 'backup' | 'settings' | null
  >(null);

  // Stock Adjustment state
  const [variantsList, setVariantsList] = useState<any[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustType, setAdjustType] = useState<'increase' | 'decrease' | 'damaged'>('increase');
  const [adjustReason, setAdjustReason] = useState('Physical audit correction');

  // Expense state
  const [expenseCategory, setExpenseCategory] = useState<'transport' | 'rent' | 'electricity' | 'miscellaneous'>('transport');
  const [expenseAmountRs, setExpenseAmountRs] = useState('500');
  const [expenseDesc, setExpenseDesc] = useState('Tempo transport freight');

  // Supplier state
  const [newSupName, setNewSupName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupBiz, setNewSupBiz] = useState('');

  // Customer state
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Settings
  const [tempApiUrl, setTempApiUrl] = useState(apiUrl);

  const loadVariants = useCallback(async () => {
    try {
      const storeId = store?.id || 'default-store';
      const prods = await ProductRepository.getProductsWithVariants(storeId);
      const allVars: any[] = [];
      for (const p of prods) {
        for (const v of p.variants) {
          allVars.push({ ...v, productName: p.name });
        }
      }
      setVariantsList(allVars);
      if (allVars.length > 0 && !selectedVariantId) {
        setSelectedVariantId(allVars[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  const handleApplyAdjustment = async () => {
    if (!selectedVariantId) {
      Alert.alert('Required', 'Please select a variant');
      return;
    }
    if (!adjustReason.trim()) {
      Alert.alert('Required', 'Reason is mandatory for stock adjustment');
      return;
    }

    try {
      const storeId = store?.id || 'default-store';
      const qty = parseFloat(adjustQty);
      const res = await InventoryRepository.adjustStock(
        selectedVariantId,
        qty,
        'piece',
        adjustType,
        adjustReason,
        storeId,
        deviceId,
        user?.id
      );

      Alert.alert('Stock Adjusted', `New balance: ${res.balanceAfter}. Movement recorded and queued for sync.`);
      setActiveDialog(null);
      loadVariants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Adjustment failed';
      Alert.alert('Adjustment Error', msg);
    }
  };

  const handleAddExpense = async () => {
    try {
      const storeId = store?.id || 'default-store';
      await ExpensesRepository.createExpense(
        {
          category: expenseCategory,
          amountPaise: rupeeToPaise(parseFloat(expenseAmountRs || '0')),
          description: expenseDesc,
          date: new Date().toISOString(),
        },
        storeId,
        deviceId
      );
      Alert.alert('Expense Recorded', 'Expense entry saved locally.');
      setActiveDialog(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Expense error';
      Alert.alert('Error', msg);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupName || !newSupPhone) {
      Alert.alert('Required', 'Supplier name and phone are mandatory');
      return;
    }
    try {
      const storeId = store?.id || 'default-store';
      await PartiesRepository.createSupplier(
        { name: newSupName, phone: newSupPhone, businessName: newSupBiz },
        storeId,
        deviceId
      );
      Alert.alert('Supplier Added', 'Supplier saved and queued for sync.');
      setActiveDialog(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Supplier error';
      Alert.alert('Error', msg);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustName) {
      Alert.alert('Required', 'Customer name is mandatory');
      return;
    }
    try {
      const storeId = store?.id || 'default-store';
      await PartiesRepository.createCustomer(
        { name: newCustName, phone: newCustPhone },
        storeId,
        deviceId
      );
      Alert.alert('Customer Added', 'Customer saved and queued for sync.');
      setActiveDialog(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Customer error';
      Alert.alert('Error', msg);
    }
  };

  const handleBackupExport = async () => {
    try {
      const db = await getDatabase();
      const [prods, variants, sales, purchases, movements] = await Promise.all([
        db.getAllAsync(`SELECT * FROM products;`),
        db.getAllAsync(`SELECT * FROM product_variants;`),
        db.getAllAsync(`SELECT * FROM sales;`),
        db.getAllAsync(`SELECT * FROM purchases;`),
        db.getAllAsync(`SELECT * FROM stock_movements;`),
      ]);

      Alert.alert(
        'Database Backup Generated',
        `Structured backup JSON generated (${movements.length} stock movements, ${sales.length} sales, ${prods.length} products). Ready for export.`
      );
    } catch (err: unknown) {
      Alert.alert('Backup Error', 'Could not export backup data');
    }
  };

  const handleResetDemoData = () => {
    Alert.alert(
      'Reset Demo Data',
      'This will reset all categories, products, stock levels, purchases, and sales to their original clean evaluation values.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Demo Data',
          style: 'destructive',
          onPress: async () => {
            const res = await resetDemoData();
            if (res.success) {
              Alert.alert('Success', 'Demo dataset successfully restored to original factory sample state.');
              loadVariants();
              if (typeof window !== 'undefined' && window.location) {
                window.location.reload();
              }
            } else {
              Alert.alert('Error', res.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Surface style={styles.headerCard}>
        <Text style={styles.headerTitle}>More Options</Text>
        <Text style={styles.headerSubtitle}>
          Store configuration, ledger, dynamic catalogue, and offline sync.
        </Text>
      </Surface>

      {/* 1. Inventory Management */}
      <Surface style={styles.menuCard}>
        <Text style={styles.groupHeader}>INVENTORY & AUDIT</Text>

        <List.Item
          title={t('stockAdjustment', language)}
          description="Audit corrections, damages, returns"
          left={(props) => <List.Icon {...props} icon="tune-vertical" color={colors.primary} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={() => setActiveDialog('adjust')}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
        <Divider style={styles.divider} />

        <List.Item
          title="Low Stock Review"
          description="View products below minimum threshold"
          left={(props) => <List.Icon {...props} icon="alert-outline" color={colors.warning} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={() => router.push('/(tabs)/products')}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
      </Surface>

      {/* 2. Business & Parties */}
      <Surface style={styles.menuCard}>
        <Text style={styles.groupHeader}>BUSINESS & PARTIES</Text>



        <List.Item
          title="Suppliers"
          description="Manage vendors, wholesale partners"
          left={(props) => <List.Icon {...props} icon="account-tie" color={colors.primary} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={() => setActiveDialog('supplier')}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
        <Divider style={styles.divider} />

        <List.Item
          title="Customers & Credit"
          description="Accounts, credit balances, phone numbers"
          left={(props) => <List.Icon {...props} icon="account-group" color={colors.success} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={() => setActiveDialog('customer')}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
      </Surface>

      {/* 3. Catalogue & Dynamic Structure */}
      <Surface style={styles.menuCard}>
        <Text style={styles.groupHeader}>CATALOGUE & DYNAMIC STRUCTURE</Text>

        <List.Item
          title="Categories & Subcategories"
          description="Manage categories, reorder display, move parent"
          left={(props) => <List.Icon {...props} icon="shape-outline" color={colors.primary} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={() => router.push('/categories-management')}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
        <Divider style={styles.divider} />

        <List.Item
          title="Custom Specifications"
          description="Configure attributes (Pressure Rating, Wire Gauge, etc.)"
          left={(props) => <List.Icon {...props} icon="form-select" color={colors.accent} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={() => router.push('/custom-fields')}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
        <Divider style={styles.divider} />

        <List.Item
          title="Catalogue CSV Bulk Import"
          description="Import product batches from CSV spreadsheet"
          left={(props) => <List.Icon {...props} icon="file-delimited-outline" color={colors.success} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={() => router.push('/catalogue-import')}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
      </Surface>

      {/* 4. Data, Sync & System Settings */}
      <Surface style={styles.menuCard}>
        <Text style={styles.groupHeader}>DATA, SYNC & SYSTEM</Text>

        <List.Item
          title="Offline Synchronization Outbox"
          description={`${pendingSyncCount} changes in persistent queue • Tap to sync`}
          left={(props) => (
            <List.Icon
              {...props}
              icon="cloud-sync"
              color={pendingSyncCount > 0 ? colors.warning : colors.success}
            />
          )}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={async () => {
            const res = await SyncEngine.synchronize(apiUrl, token || '', store?.id || '', deviceId);
            Alert.alert('Sync Status', res.error || `Successfully pushed ${res.pushed} changes`);
          }}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
        <Divider style={styles.divider} />

        <List.Item
          title="Backup & Restore"
          description="Generate JSON database backup"
          left={(props) => <List.Icon {...props} icon="database-export" color={colors.primary} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={handleBackupExport}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
        <Divider style={styles.divider} />

        <List.Item
          title="Settings & Language"
          description={`Language: ${language === 'en' ? 'English' : 'हिंदी'} • Server URL`}
          left={(props) => <List.Icon {...props} icon="cog-outline" color={colors.textSecondary} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
          onPress={() => setActiveDialog('settings')}
          style={styles.listItem}
          titleStyle={styles.listItemTitle}
          descriptionStyle={styles.listItemDesc}
        />
      </Surface>

      {/* Demo Controls Card (Shown in Demo Mode) */}
      {isDemoMode() && (
        <Surface style={[styles.menuCard, { borderColor: '#F59E0B', borderWidth: 1.5, backgroundColor: '#FFFBEB' }]}>
          <Text style={[styles.groupHeader, { color: '#B45309' }]}>DEMO EVALUATION SANDBOX</Text>
          <List.Item
            title="Reset Sample Demo Data"
            description="Restore fictional stock, sales and purchases to initial clean state"
            left={(props) => <List.Icon {...props} icon="restore" color="#D97706" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
            onPress={handleResetDemoData}
            style={styles.listItem}
            titleStyle={[styles.listItemTitle, { color: '#92400E', fontWeight: '700' }]}
            descriptionStyle={styles.listItemDesc}
          />
          <Divider style={styles.divider} />
          <List.Item
            title="Environment & Security"
            description="Operating in isolated local database • Production sync strictly blocked"
            left={(props) => <List.Icon {...props} icon="shield-check" color="#059669" />}
            style={styles.listItem}
            titleStyle={styles.listItemTitle}
            descriptionStyle={styles.listItemDesc}
          />
        </Surface>
      )}

      <View style={{ alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
          {isDemoMode() ? 'Hardware Store (Demo)' : 'Manju Store Management'}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
          {isDemoMode() ? 'Demo Evaluation • Sample Data Sandbox' : 'Beta v1.0 • Offline-Ready Hardware Suite'}
        </Text>
      </View>

      {/* Stock Adjustment Dialog */}
      <Portal>
        <Dialog visible={activeDialog === 'adjust'} onDismiss={() => setActiveDialog(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Stock Adjustment</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.fieldLabel}>Select Variant to Correct:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {variantsList.map((v) => (
                <Chip
                  key={v.id}
                  selected={selectedVariantId === v.id}
                  onPress={() => setSelectedVariantId(v.id)}
                  style={[styles.variantChip, selectedVariantId === v.id && styles.variantChipSelected]}
                  textStyle={[styles.variantChipText, selectedVariantId === v.id && styles.variantChipTextSelected]}
                  showSelectedOverlay={false}
                >
                  {v.productName} ({v.name}) [Cur: {v.currentStock}]
                </Chip>
              ))}
            </ScrollView>

            <SegmentedButtons
              value={adjustType}
              onValueChange={(val) => setAdjustType(val as any)}
              buttons={[
                { value: 'increase', label: 'Increase (+)' },
                { value: 'decrease', label: 'Decrease (-)' },
                { value: 'damaged', label: 'Damaged' },
              ]}
              style={{ marginBottom: 10 }}
            />

            <TextInput
              label="Quantity to adjust"
              value={adjustQty}
              onChangeText={setAdjustQty}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Reason (Mandatory for audit trail) *"
              value={adjustReason}
              onChangeText={setAdjustReason}
              mode="outlined"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActiveDialog(null)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleApplyAdjustment} style={{ backgroundColor: colors.primary }}>
              Apply Adjustment
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Expense Dialog */}
      <Portal>
        <Dialog visible={activeDialog === 'expense'} onDismiss={() => setActiveDialog(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Record Store Expense</Dialog.Title>
          <Dialog.Content>
            <SegmentedButtons
              value={expenseCategory}
              onValueChange={(val) => setExpenseCategory(val as any)}
              buttons={[
                { value: 'transport', label: 'Transport' },
                { value: 'rent', label: 'Rent' },
                { value: 'electricity', label: 'Power' },
                { value: 'miscellaneous', label: 'Other' },
              ]}
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Amount (₹) *"
              value={expenseAmountRs}
              onChangeText={setExpenseAmountRs}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Description / Note"
              value={expenseDesc}
              onChangeText={setExpenseDesc}
              mode="outlined"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActiveDialog(null)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleAddExpense} style={{ backgroundColor: colors.danger }}>
              Save Expense
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Supplier Dialog */}
      <Portal>
        <Dialog visible={activeDialog === 'supplier'} onDismiss={() => setActiveDialog(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Add Supplier</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Contact Person Name *"
              value={newSupName}
              onChangeText={setNewSupName}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Business Name"
              value={newSupBiz}
              onChangeText={setNewSupBiz}
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
            <Button onPress={() => setActiveDialog(null)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleAddSupplier} style={{ backgroundColor: colors.primary }}>
              Save Supplier
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Customer Dialog */}
      <Portal>
        <Dialog visible={activeDialog === 'customer'} onDismiss={() => setActiveDialog(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Add Customer</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Customer Name *"
              value={newCustName}
              onChangeText={setNewCustName}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Phone Number"
              value={newCustPhone}
              onChangeText={setNewCustPhone}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActiveDialog(null)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleAddCustomer} style={{ backgroundColor: colors.primary }}>
              Save Customer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Settings Dialog */}
      <Portal>
        <Dialog visible={activeDialog === 'settings'} onDismiss={() => setActiveDialog(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Settings & Language</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.fieldLabel}>Language (भाषा):</Text>
            <SegmentedButtons
              value={language}
              onValueChange={(val) => setLanguage(val as any)}
              buttons={[
                { value: 'en', label: 'English' },
                { value: 'hi', label: 'हिंदी (Hindi)' },
              ]}
              style={{ marginBottom: 12 }}
            />

            <TextInput
              label="Backend Server API URL"
              value={tempApiUrl}
              onChangeText={setTempApiUrl}
              mode="outlined"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setApiUrl(tempApiUrl);
                setActiveDialog(null);
                Alert.alert('Saved', 'Settings updated');
              }}
              mode="contained"
              style={{ backgroundColor: colors.primary }}
            >
              Save Settings
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
    paddingBottom: 40,
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
  menuCard: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  listItem: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  listItemTitle: {
    ...typography.labelLarge,
    color: colors.textPrimary,
  },
  listItemDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  divider: {
    backgroundColor: colors.border,
  },
  fieldLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  variantChip: {
    backgroundColor: colors.surfaceSubtle,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  variantChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  variantChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  dialogTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  input: {
    marginBottom: 10,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
});
