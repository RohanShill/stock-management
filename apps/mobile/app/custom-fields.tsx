import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList, Platform } from 'react-native';
import {
  Text,
  Button,
  TextInput,
  Portal,
  Dialog,
  IconButton,
  Chip,
  SegmentedButtons,
  Switch,
} from 'react-native-paper';
import {
  CustomFieldDefinition,
  CustomFieldType,
  CustomFieldTargetLevel,
  Category,
  Subcategory,
} from '@hardware-store/shared';
import { CustomFieldRepository } from '../src/database/repositories/customFieldRepository.js';
import { CategoryRepository } from '../src/database/repositories/categoryRepository.js';
import { useAppStore } from '../src/store/useAppStore.js';
import { colors, spacing, borderRadius, typography } from '../src/theme/tokens';

export default function CustomFieldsScreen() {
  const { store, deviceId } = useAppStore();
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<CustomFieldTargetLevel>('subcategory');

  // Dialog State
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [fieldUnit, setFieldUnit] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptionsStr, setFieldOptionsStr] = useState('');
  const [fieldDefault, setFieldDefault] = useState('');
  const [fieldOrder, setFieldOrder] = useState('0');
  const [scopedTargetId, setScopedTargetId] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const storeId = store?.id || 'default-store';
      const [fList, cats, subcats] = await Promise.all([
        CustomFieldRepository.getCustomFields(storeId, selectedLevel),
        CategoryRepository.getCategories(storeId),
        CategoryRepository.getSubcategories(undefined, storeId),
      ]);
      setFields(fList);
      setCategories(cats);
      setSubcategories(subcats);
    } catch (e) {
      console.error(e);
    }
  }, [store, selectedLevel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    setEditingField(null);
    setFieldName('');
    setFieldLabel('');
    setFieldType('text');
    setFieldUnit('');
    setFieldRequired(false);
    setFieldOptionsStr('');
    setFieldDefault('');
    setFieldOrder('0');
    setScopedTargetId('');
    setDialogVisible(true);
  };

  const handleSaveField = async () => {
    if (!fieldName.trim() || !fieldLabel.trim()) {
      Alert.alert('Required', 'Field Name (key) and Field Label are mandatory');
      return;
    }
    const storeId = store?.id || 'default-store';
    const options = fieldOptionsStr.trim()
      ? fieldOptionsStr.split(',').map((o) => o.trim()).filter((o) => o.length > 0)
      : undefined;

    try {
      if (editingField) {
        await CustomFieldRepository.updateCustomField(
          editingField.id,
          {
            label: fieldLabel,
            unit: fieldUnit || undefined,
            required: fieldRequired,
            options,
            defaultValue: fieldDefault || undefined,
            displayOrder: parseInt(fieldOrder || '0', 10),
          },
          storeId,
          deviceId
        );
        Alert.alert('Updated', `Field '${fieldLabel}' updated.`);
      } else {
        await CustomFieldRepository.createCustomField(
          {
            name: fieldName.trim().toLowerCase().replace(/\s+/g, '_'),
            label: fieldLabel.trim(),
            fieldType,
            targetLevel: selectedLevel,
            targetId: scopedTargetId || undefined,
            unit: fieldUnit || undefined,
            required: fieldRequired,
            options,
            defaultValue: fieldDefault || undefined,
            displayOrder: parseInt(fieldOrder || '0', 10),
          },
          storeId,
          deviceId
        );
        Alert.alert('Created', `Field '${fieldLabel}' added.`);
      }
      setDialogVisible(false);
      loadData();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message);
    }
  };

  const handleArchiveField = async (f: CustomFieldDefinition) => {
    const storeId = store?.id || 'default-store';

    const doArchiveField = async () => {
      await CustomFieldRepository.archiveCustomField(f.id, storeId, deviceId);
      if (Platform.OS !== 'web') {
        Alert.alert('Archived', `'${f.label}' specification archived.`);
      }
      loadData();
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Archive '${f.label}'? Existing product specifications will remain preserved in historical records.`)) {
        await doArchiveField();
      }
      return;
    }

    Alert.alert(
      'Archive Specification',
      `Archive '${f.label}'? Existing product specifications will remain preserved in historical records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: doArchiveField,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>Custom Specifications</Text>
          <Text style={styles.screenSubtitle}>Define attributes for categories & items</Text>
        </View>
        <Button
          mode="contained"
          icon="plus"
          onPress={handleOpenAdd}
          style={styles.addButton}
          labelStyle={styles.addButtonLabel}
        >
          Add Field
        </Button>
      </View>

      {/* Target Level Segment */}
      <View style={styles.segmentContainer}>
        <SegmentedButtons
          value={selectedLevel}
          onValueChange={(val) => setSelectedLevel(val as CustomFieldTargetLevel)}
          buttons={[
            { value: 'subcategory', label: 'Subcategory Specs' },
            { value: 'product', label: 'Product Specs' },
          ]}
          theme={{
            colors: {
              secondaryContainer: colors.primaryLight,
              onSecondaryContainer: colors.primary,
            },
          }}
        />
      </View>

      {fields.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Custom Fields Defined</Text>
          <Text style={styles.emptySubtitle}>
            Define custom technical attributes like Pressure Rating, Schedule, Color, or Grade for your inventory items.
          </Text>
        </View>
      ) : (
        <FlatList
          data={fields}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.fieldCard}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.fieldLabel}>{item.label}</Text>
                  {item.required && (
                    <Text style={styles.requiredBadge}>Required</Text>
                  )}
                </View>
                <Text style={styles.fieldMeta}>
                  Key: {item.name} • Type: {item.fieldType.toUpperCase()}
                  {item.unit ? ` (${item.unit})` : ''}
                </Text>
                {item.options && item.options.length > 0 && (
                  <Text style={styles.fieldOptions}>
                    Options: {item.options.join(', ')}
                  </Text>
                )}
                <Text style={styles.fieldOrder}>Order: {item.displayOrder}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton
                  icon="pencil-outline"
                  iconColor={colors.primary}
                  size={20}
                  onPress={() => {
                    setEditingField(item);
                    setFieldName(item.name);
                    setFieldLabel(item.label);
                    setFieldType(item.fieldType);
                    setFieldUnit(item.unit || '');
                    setFieldRequired(item.required);
                    setFieldOptionsStr(item.options ? item.options.join(', ') : '');
                    setFieldDefault(item.defaultValue || '');
                    setFieldOrder(item.displayOrder.toString());
                    setScopedTargetId(item.targetId || '');
                    setDialogVisible(true);
                  }}
                />
                <IconButton
                  icon="archive-outline"
                  iconColor={colors.error}
                  size={20}
                  onPress={() => handleArchiveField(item)}
                />
              </View>
            </View>
          )}
        />
      )}

      {/* Add / Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            {editingField ? 'Edit Specification' : 'New Specification Field'}
          </Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 380, paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}>
              {!editingField && (
                <TextInput
                  label="Internal Field Key (e.g., pressure_rating) *"
                  value={fieldName}
                  onChangeText={setFieldName}
                  mode="outlined"
                  style={styles.input}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                />
              )}
              <TextInput
                label="Display Label (e.g., Pressure Rating) *"
                value={fieldLabel}
                onChangeText={setFieldLabel}
                mode="outlined"
                style={styles.input}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
              />
              {!editingField && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: 4 }}>
                    Field Data Type:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 6 }}>
                    {(['text', 'number', 'select', 'boolean'] as CustomFieldType[]).map((t) => (
                      <Chip
                        key={t}
                        selected={fieldType === t}
                        onPress={() => setFieldType(t)}
                        style={[styles.typeChip, fieldType === t && styles.typeChipSelected]}
                        textStyle={[styles.typeChipText, fieldType === t && styles.typeChipTextSelected]}
                      >
                        {t.toUpperCase()}
                      </Chip>
                    ))}
                  </ScrollView>
                </View>
              )}
              <TextInput
                label="Measurement Unit (e.g., bar, mm, kg, V)"
                value={fieldUnit}
                onChangeText={setFieldUnit}
                mode="outlined"
                style={styles.input}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
              />
              {fieldType === 'dropdown' && (
                <TextInput
                  label="Dropdown Options (comma-separated)"
                  value={fieldOptionsStr}
                  onChangeText={setFieldOptionsStr}
                  mode="outlined"
                  style={styles.input}
                  placeholder="e.g. Schedule 40, Schedule 80, SDR 11"
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary}
                />
              )}
              <TextInput
                label="Default Value (Optional)"
                value={fieldDefault}
                onChangeText={setFieldDefault}
                mode="outlined"
                style={styles.input}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
              />
              <TextInput
                label="Display Order (0, 1, 2...)"
                value={fieldOrder}
                onChangeText={setFieldOrder}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
              />

              {/* Scoped Subcategory Selection */}
              {selectedLevel === 'subcategory' && !editingField && (
                <View style={{ marginTop: 6, marginBottom: 10 }}>
                  <Text style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: 4 }}>
                    Scope to Specific Subcategory:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Chip
                      selected={scopedTargetId === ''}
                      onPress={() => setScopedTargetId('')}
                      style={[styles.typeChip, scopedTargetId === '' && styles.typeChipSelected, { marginRight: 6 }]}
                      textStyle={[styles.typeChipText, scopedTargetId === '' && styles.typeChipTextSelected]}
                    >
                      All Subcategories
                    </Chip>
                    {subcategories.map((s) => (
                      <Chip
                        key={s.id}
                        selected={scopedTargetId === s.id}
                        onPress={() => setScopedTargetId(s.id)}
                        style={[styles.typeChip, scopedTargetId === s.id && styles.typeChipSelected, { marginRight: 6 }]}
                        textStyle={[styles.typeChipText, scopedTargetId === s.id && styles.typeChipTextSelected]}
                      >
                        {s.name}
                      </Chip>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Mandatory Field *</Text>
                <Switch value={fieldRequired} onValueChange={setFieldRequired} color={colors.primary} />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveField} style={{ backgroundColor: colors.primary }}>
              Save
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  addButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.surface,
  },
  segmentContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  fieldCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  requiredBadge: {
    fontSize: 10,
    color: colors.error,
    backgroundColor: colors.errorLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
  fieldMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  fieldOptions: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  fieldOrder: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  dialogTitle: {
    fontSize: typography.fontSize.title,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  input: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  typeChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    marginRight: 6,
  },
  typeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  typeChipTextSelected: {
    color: colors.surface,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
  },
  switchLabel: {
    fontSize: typography.fontSize.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
