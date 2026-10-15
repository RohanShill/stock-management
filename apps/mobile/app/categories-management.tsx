import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, FlatList } from 'react-native';
import {
  Text,
  Card,
  Button,
  TextInput,
  Portal,
  Dialog,
  IconButton,
  Chip,
  Divider,
} from 'react-native-paper';
import { Category, Subcategory } from '@hardware-store/shared';
import { CategoryRepository } from '../src/database/repositories/categoryRepository.js';
import { useAppStore } from '../src/store/useAppStore.js';
import { colors, spacing, borderRadius, typography } from '../src/theme/tokens';

export default function CategoriesManagementScreen() {
  const { store, deviceId } = useAppStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Dialog states
  const [catDialogVisible, setCatDialogVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catIcon, setCatIcon] = useState('pipe');
  const [catOrder, setCatOrder] = useState('0');

  const [subcatDialogVisible, setSubcatDialogVisible] = useState(false);
  const [editingSubcat, setEditingSubcat] = useState<Subcategory | null>(null);
  const [subcatName, setSubcatName] = useState('');
  const [subcatDesc, setSubcatDesc] = useState('');
  const [subcatOrder, setSubcatOrder] = useState('0');
  const [targetParentCatId, setTargetParentCatId] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const storeId = store?.id || 'default-store';
      const [cats, subcats] = await Promise.all([
        CategoryRepository.getCategories(storeId, true),
        CategoryRepository.getSubcategories(undefined, storeId, true),
      ]);
      setCategories(cats);
      setSubcategories(subcats);
      if (cats.length > 0 && !selectedCatId) {
        setSelectedCatId(cats[0].id);
      }
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  }, [store, selectedCatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save / Update Category
  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      Alert.alert('Required', 'Category name is mandatory');
      return;
    }
    const storeId = store?.id || 'default-store';
    try {
      if (editingCat) {
        await CategoryRepository.updateCategory(
          editingCat.id,
          {
            name: catName,
            description: catDesc,
            icon: catIcon,
            displayOrder: parseInt(catOrder || '0', 10),
          },
          storeId,
          deviceId
        );
        Alert.alert('Updated', `Category '${catName}' updated.`);
      } else {
        await CategoryRepository.createCategory(
          {
            name: catName,
            description: catDesc,
            icon: catIcon,
            displayOrder: parseInt(catOrder || '0', 10),
          },
          storeId,
          deviceId
        );
        Alert.alert('Created', `Category '${catName}' added.`);
      }
      setCatDialogVisible(false);
      setEditingCat(null);
      setCatName('');
      setCatDesc('');
      loadData();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message);
    }
  };

  // Safe Archive Category
  const handleArchiveCategory = async (cat: Category) => {
    const storeId = store?.id || 'default-store';
    const counts = await CategoryRepository.getAffectedCounts(cat.id, storeId);

    Alert.alert(
      'Archive Category',
      `Are you sure you want to archive '${cat.name}'?\n\nAffected records: ${counts.subcategoriesCount} subcategories, ${counts.productsCount} products.\n\nHistorical transactions will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            await CategoryRepository.archiveCategory(cat.id, storeId, deviceId);
            Alert.alert('Archived', `'${cat.name}' has been archived.`);
            loadData();
          },
        },
      ]
    );
  };

  // Save / Update / Move Subcategory
  const handleSaveSubcategory = async () => {
    if (!subcatName.trim() || !targetParentCatId) {
      Alert.alert('Required', 'Subcategory name and parent category are mandatory');
      return;
    }
    const storeId = store?.id || 'default-store';
    try {
      if (editingSubcat) {
        await CategoryRepository.updateSubcategory(
          editingSubcat.id,
          {
            categoryId: targetParentCatId,
            name: subcatName,
            description: subcatDesc,
            displayOrder: parseInt(subcatOrder || '0', 10),
          },
          storeId,
          deviceId
        );
        Alert.alert('Updated', `Subcategory updated.`);
      } else {
        await CategoryRepository.createSubcategory(
          {
            categoryId: targetParentCatId,
            name: subcatName,
            description: subcatDesc,
            displayOrder: parseInt(subcatOrder || '0', 10),
          },
          storeId,
          deviceId
        );
        Alert.alert('Created', `Subcategory '${subcatName}' added.`);
      }
      setSubcatDialogVisible(false);
      setEditingSubcat(null);
      setSubcatName('');
      setSubcatDesc('');
      loadData();
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message);
    }
  };

  // Archive Subcategory
  const handleArchiveSubcategory = async (subcat: Subcategory) => {
    const storeId = store?.id || 'default-store';
    Alert.alert(
      'Archive Subcategory',
      `Are you sure you want to archive '${subcat.name}'? Existing products will preserve historical references.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            const affected = await CategoryRepository.archiveSubcategory(subcat.id, storeId, deviceId);
            Alert.alert('Archived', `'${subcat.name}' archived (${affected} affected products preserved).`);
            loadData();
          },
        },
      ]
    );
  };

  const filteredSubcategories = subcategories.filter(
    (s) => s.categoryId === selectedCatId && s.active
  );

  const selectedCat = categories.find((c) => c.id === selectedCatId);

  return (
    <View style={styles.container}>
      {/* Top action row */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>Categories & Structure</Text>
          <Text style={styles.screenSubtitle}>Organize your hardware catalogue</Text>
        </View>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => {
            setEditingCat(null);
            setCatName('');
            setCatDesc('');
            setCatOrder('0');
            setCatDialogVisible(true);
          }}
          style={styles.addButton}
          labelStyle={styles.addButtonLabel}
        >
          Add
        </Button>
      </View>

      {/* Categories horizontal picker */}
      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}>
          {categories.map((c) => {
            const isSelected = selectedCatId === c.id;
            return (
              <Chip
                key={c.id}
                selected={isSelected}
                onPress={() => setSelectedCatId(c.id)}
                style={[
                  styles.catChip,
                  isSelected && styles.catChipSelected,
                  !c.active && { opacity: 0.5 },
                ]}
                textStyle={[
                  styles.catChipText,
                  isSelected && styles.catChipTextSelected,
                ]}
              >
                {c.name} {!c.active ? '(Archived)' : ''}
              </Chip>
            );
          })}
        </ScrollView>
      </View>

      {/* Selected Category Details Card */}
      {selectedCat && (
        <View style={styles.selectedCatCard}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.catCardName}>{selectedCat.name}</Text>
              {!selectedCat.active && (
                <Text style={styles.archivedBadge}>Archived</Text>
              )}
            </View>
            {selectedCat.description ? (
              <Text style={styles.catCardDesc}>{selectedCat.description}</Text>
            ) : null}
            <Text style={styles.catCardMeta}>
              Sort Order: {selectedCat.displayOrder} • {filteredSubcategories.length} subcategories
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              icon="pencil-outline"
              iconColor={colors.primary}
              size={22}
              onPress={() => {
                setEditingCat(selectedCat);
                setCatName(selectedCat.name);
                setCatDesc(selectedCat.description || '');
                setCatIcon(selectedCat.icon || 'pipe');
                setCatOrder(selectedCat.displayOrder.toString());
                setCatDialogVisible(true);
              }}
            />
            <IconButton
              icon="archive-outline"
              iconColor={colors.error}
              size={22}
              onPress={() => handleArchiveCategory(selectedCat)}
            />
          </View>
        </View>
      )}

      {/* Subcategories section */}
      <View style={styles.subcatHeaderRow}>
        <Text style={styles.sectionTitle}>
          Subcategories ({filteredSubcategories.length})
        </Text>
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => {
            if (!selectedCatId) {
              Alert.alert('Select Category', 'Please select a parent category first');
              return;
            }
            setEditingSubcat(null);
            setSubcatName('');
            setSubcatDesc('');
            setSubcatOrder('0');
            setTargetParentCatId(selectedCatId);
            setSubcatDialogVisible(true);
          }}
          style={styles.addSubcatButton}
          labelStyle={styles.addSubcatButtonLabel}
        >
          Add Subcategory
        </Button>
      </View>

      {filteredSubcategories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Subcategories Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap 'Add Subcategory' to create specific groups under {selectedCat?.name || 'this category'}.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSubcategories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.subcatCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subcatName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.subcatDesc}>{item.description}</Text>
                ) : null}
                <Text style={styles.subcatOrder}>Sort Order: {item.displayOrder}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton
                  icon="pencil-outline"
                  iconColor={colors.primary}
                  size={20}
                  onPress={() => {
                    setEditingSubcat(item);
                    setSubcatName(item.name);
                    setSubcatDesc(item.description || '');
                    setSubcatOrder(item.displayOrder.toString());
                    setTargetParentCatId(item.categoryId);
                    setSubcatDialogVisible(true);
                  }}
                />
                <IconButton
                  icon="archive-outline"
                  iconColor={colors.error}
                  size={20}
                  onPress={() => handleArchiveSubcategory(item)}
                />
              </View>
            </View>
          )}
        />
      )}

      {/* Add / Edit Category Dialog */}
      <Portal>
        <Dialog visible={catDialogVisible} onDismiss={() => setCatDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            {editingCat ? 'Edit Category' : 'Create Category'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name *"
              value={catName}
              onChangeText={setCatName}
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <TextInput
              label="Description (Optional)"
              value={catDesc}
              onChangeText={setCatDesc}
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <TextInput
              label="Display Order (0, 1, 2...)"
              value={catOrder}
              onChangeText={setCatOrder}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCatDialogVisible(false)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveCategory} style={{ backgroundColor: colors.primary }}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add / Edit / Move Subcategory Dialog */}
      <Portal>
        <Dialog visible={subcatDialogVisible} onDismiss={() => setSubcatDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            {editingSubcat ? 'Edit Subcategory' : 'Create Subcategory'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Subcategory Name *"
              value={subcatName}
              onChangeText={setSubcatName}
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <TextInput
              label="Description (Optional)"
              value={subcatDesc}
              onChangeText={setSubcatDesc}
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
            <Text style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginTop: 8, marginBottom: 4 }}>
              Parent Category:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {categories.filter((c) => c.active).map((c) => {
                const isSelected = targetParentCatId === c.id;
                return (
                  <Chip
                    key={c.id}
                    selected={isSelected}
                    onPress={() => setTargetParentCatId(c.id)}
                    style={[
                      styles.catChip,
                      isSelected && styles.catChipSelected,
                      { marginRight: 6 },
                    ]}
                    textStyle={[
                      styles.catChipText,
                      isSelected && styles.catChipTextSelected,
                    ]}
                  >
                    {c.name}
                  </Chip>
                );
              })}
            </ScrollView>
            <TextInput
              label="Display Order"
              value={subcatOrder}
              onChangeText={setSubcatOrder}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSubcatDialogVisible(false)} textColor={colors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveSubcategory} style={{ backgroundColor: colors.primary }}>
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
  chipsContainer: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  catChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.full,
  },
  catChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  catChipTextSelected: {
    color: colors.surface,
    fontWeight: '600',
  },
  selectedCatCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catCardName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  catCardDesc: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  catCardMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  archivedBadge: {
    fontSize: 10,
    color: colors.error,
    backgroundColor: colors.errorLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subcatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  addSubcatButton: {
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  addSubcatButtonLabel: {
    fontSize: 12,
    color: colors.primary,
  },
  subcatCard: {
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
  subcatName: {
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  subcatDesc: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subcatOrder: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
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
});
