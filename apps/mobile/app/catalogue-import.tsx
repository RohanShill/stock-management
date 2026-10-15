import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  TextInput,
  Chip,
  Divider,
} from 'react-native-paper';
import {
  parseAndValidateProductCsv,
  SAMPLE_CSV_TEMPLATE,
  BulkImportProductRow,
  CsvValidationRowError,
} from '@hardware-store/shared';
import { ProductRepository } from '../src/database/repositories/productRepository.js';
import { useAppStore } from '../src/store/useAppStore.js';
import { colors, spacing, borderRadius, typography } from '../src/theme/tokens';

export default function CatalogueImportScreen() {
  const { store, deviceId, user } = useAppStore();
  const [csvText, setCsvText] = useState(SAMPLE_CSV_TEMPLATE);
  const [validRows, setValidRows] = useState<BulkImportProductRow[]>([]);
  const [rowErrors, setRowErrors] = useState<CsvValidationRowError[]>([]);
  const [duplicateSkus, setDuplicateSkus] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleValidateCsv = () => {
    if (!csvText.trim()) {
      Alert.alert('Empty Input', 'Please paste CSV content');
      return;
    }

    const result = parseAndValidateProductCsv(csvText);
    setValidRows(result.validRows);
    setRowErrors(result.errors);
    setDuplicateSkus(result.duplicateSkus);
    setValidated(true);

    if (result.errors.length > 0) {
      Alert.alert(
        'Validation Issues Detected',
        `Found ${result.validRows.length} valid rows and ${result.errors.length} validation errors (including ${result.duplicateSkus.length} duplicate SKUs). Review row details below before importing.`
      );
    } else {
      Alert.alert(
        'Validation Passed!',
        `All ${result.validRows.length} rows are valid and ready to be imported into local inventory.`
      );
    }
  };

  const handleExecuteImport = async () => {
    if (validRows.length === 0) {
      Alert.alert('No Valid Rows', 'Please validate CSV rows before importing');
      return;
    }

    setImporting(true);
    try {
      const storeId = store?.id || 'default-store';
      const result = await ProductRepository.bulkImportProducts(
        validRows,
        storeId,
        deviceId,
        user?.id
      );

      Alert.alert(
        'Import Completed!',
        `Successfully imported ${result.importedProducts} new products and ${result.importedVariants} variants.\nSkipped: ${result.skippedCount}.\n\nAll changes saved in local SQLite database and queued for cloud sync.`
      );

      setValidated(false);
      setValidRows([]);
      setRowErrors([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      Alert.alert('Import Failed', msg);
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>
        Bulk Catalogue Import
      </Text>
      <Text style={styles.screenSubtitle}>
        Import products, categories, variants, and opening stocks safely via CSV.
      </Text>

      {/* CSV Input Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            CSV Content / Template:
          </Text>
          <Button
            mode="text"
            icon="content-copy"
            onPress={() => setCsvText(SAMPLE_CSV_TEMPLATE)}
            textColor={colors.primary}
            labelStyle={{ fontSize: 12 }}
          >
            Load Sample
          </Button>
        </View>

        <TextInput
          value={csvText}
          onChangeText={setCsvText}
          multiline
          numberOfLines={8}
          mode="outlined"
          style={styles.csvInput}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          placeholder="categoryName,subcategoryName,productName,brand,measurementType,baseUnit,variantName,sku,size,purchasePriceRs,sellingPriceRs,taxRatePercent,openingStock,minStockLevel,rackLocation,barcode"
        />

        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            icon="check-circle-outline"
            onPress={handleValidateCsv}
            style={[styles.actionBtn, { borderColor: colors.primary }]}
            textColor={colors.primary}
          >
            Validate CSV
          </Button>
          <Button
            mode="contained"
            icon="database-import"
            onPress={handleExecuteImport}
            loading={importing}
            disabled={validRows.length === 0}
            style={[styles.actionBtn, { backgroundColor: validRows.length > 0 ? colors.success : colors.border }]}
            textColor={colors.surface}
          >
            Import ({validRows.length})
          </Button>
        </View>
      </View>

      {/* Validation Summary */}
      {validated && (
        <View style={{ marginTop: spacing.md }}>
          <View style={styles.chipRow}>
            <Chip
              icon="check-circle"
              style={{ backgroundColor: colors.successLight }}
              textStyle={{ color: colors.success, fontWeight: '600' }}
            >
              Valid: {validRows.length}
            </Chip>
            {rowErrors.length > 0 && (
              <Chip
                icon="alert-circle"
                style={{ backgroundColor: colors.errorLight }}
                textStyle={{ color: colors.error, fontWeight: '600' }}
              >
                Errors: {rowErrors.length}
              </Chip>
            )}
            {duplicateSkus.length > 0 && (
              <Chip
                icon="content-duplicate"
                style={{ backgroundColor: colors.warningLight }}
                textStyle={{ color: colors.warning, fontWeight: '600' }}
              >
                Duplicates: {duplicateSkus.length}
              </Chip>
            )}
          </View>

          {/* Errors list */}
          {rowErrors.length > 0 && (
            <View style={[styles.card, { borderColor: colors.error, borderWidth: 1 }]}>
              <Text style={[styles.sectionTitle, { color: colors.error }]}>
                Validation Errors ({rowErrors.length}):
              </Text>
              {rowErrors.map((err, idx) => (
                <Text key={idx} style={styles.errorText}>
                  • Line {err.rowNumber} {err.sku ? `[${err.sku}]` : ''}: {err.message}
                </Text>
              ))}
            </View>
          )}

          {/* Valid rows preview */}
          {validRows.length > 0 && (
            <View style={styles.card}>
              <Text style={[styles.sectionTitle, { color: colors.success }]}>
                Ready for Import ({validRows.length}):
              </Text>
              {validRows.map((row, idx) => (
                <View key={idx} style={{ marginBottom: 6 }}>
                  <Text style={styles.previewTitle}>
                    {idx + 1}. {row.categoryName} → {row.productName} ({row.variantName})
                  </Text>
                  <Text style={styles.previewMeta}>
                    SKU: {row.sku} • Cost: ₹{row.purchasePriceRs} • Sell: ₹{row.sellingPriceRs} • Opening: {row.openingStock} {row.baseUnit}
                  </Text>
                  {idx < validRows.length - 1 && <Divider style={{ marginVertical: 6, backgroundColor: colors.border }} />}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
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
  screenTitle: {
    fontSize: typography.fontSize.title,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  csvInput: {
    backgroundColor: colors.surface,
    fontSize: 12,
    minHeight: 120,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    borderRadius: borderRadius.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  previewMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
