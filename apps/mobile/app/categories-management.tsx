import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, FlatList, Platform } from 'react-native';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CategoryRepository } from '../src/database/repositories/categoryRepository.js';
import { useAppStore } from '../src/store/useAppStore.js';
import { lightColors, darkColors, colors, spacing, borderRadius, shadows, getThemeShadows, typography } from '../src/theme/tokens';

export default function CategoriesManagementScreen() {
  const { store, deviceId, isDarkMode, showToast, showConfirm } = useAppStore();
  const activeColors = isDarkMode ? darkColors : lightColors;
  const themeShadows = getThemeShadows(isDarkMode);
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
      showToast('Category name is mandatory', 'warning');
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
        showToast(`Category '${catName}' updated.`, 'success');
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
        showToast(`Category '${catName}' added.`, 'success');
      }
      setCatDialogVisible(false);
      setEditingCat(null);
      setCatName('');
      setCatDesc('');
      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  // Safe Archive Category
  const handleArchiveCategory = async (cat: Category) => {
    const storeId = store?.id || 'default-store';
    const counts = await CategoryRepository.getAffectedCounts(cat.id, storeId);

    const doArchive = async () => {
      await CategoryRepository.archiveCategory(cat.id, storeId, deviceId);
      showToast(`'${cat.name}' has been archived.`, 'success');
      loadData();
    };

    showConfirm({
      title: 'Archive Category',
      message: `Are you sure you want to archive '${cat.name}'?\n\nAffected records: ${counts.subcategoriesCount} subcategories, ${counts.productsCount} products.\n\nHistorical transactions will be preserved.`,
      confirmText: 'Archive',
      isDestructive: true,
      onConfirm: doArchive,
    });
  };

  // Save / Update / Move Subcategory
  const handleSaveSubcategory = async () => {
    if (!subcatName.trim() || !targetParentCatId) {
      showToast('Subcategory name and parent category are mandatory', 'warning');
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
        showToast('Subcategory updated.', 'success');
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
        showToast(`Subcategory '${subcatName}' added.`, 'success');
      }
      setSubcatDialogVisible(false);
      setEditingSubcat(null);
      setSubcatName('');
      setSubcatDesc('');
      loadData();
    } catch (err: unknown) {
      showToast((err as Error).message, 'error');
    }
  };

  // Archive Subcategory
  const handleArchiveSubcategory = async (subcat: Subcategory) => {
    const storeId = store?.id || 'default-store';

    const doArchiveSub = async () => {
      const affected = await CategoryRepository.archiveSubcategory(subcat.id, storeId, deviceId);
      showToast(`'${subcat.name}' archived (${affected} affected products preserved).`, 'success');
      loadData();
    };

    showConfirm({
      title: 'Archive Subcategory',
      message: `Are you sure you want to archive '${subcat.name}'? Existing products will preserve historical references.`,
      confirmText: 'Archive',
      isDestructive: true,
      onConfirm: doArchiveSub,
    });
  };

  const filteredSubcategories = subcategories.filter(
    (s) => s.categoryId === selectedCatId && s.active
  );

  const selectedCat = categories.find((c) => c.id === selectedCatId);

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Top action row */}
      <View style={[styles.headerRow, { backgroundColor: activeColors.surface, borderBottomColor: activeColors.border }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="shape-outline" size={24} color={activeColors.primary} />
            <Text style={[styles.screenTitle, { color: activeColors.textPrimary }]}>Categories & Subcategories</Text>
          </View>
          <Text style={[styles.screenSubtitle, { color: activeColors.textSecondary }]}>Organize your hardware catalogue hierarchy</Text>
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
          style={[styles.addButton, { backgroundColor: activeColors.primary }]}
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
                  {
                    backgroundColor: isSelected
                      ? (isDarkMode ? '#1E293B' : '#EFF6FF')
                      : (isDarkMode ? '#111827' : '#F1F5F9'),
                    borderColor: isSelected ? activeColors.primary : activeColors.border,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                  !c.active && { opacity: 0.5 },
                ]}
                textStyle={[
                  styles.catChipText,
                  {
                    color: isSelected ? activeColors.primary : activeColors.textSecondary,
                    fontWeight: isSelected ? '700' : '600',
                  },
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
        <View style={[styles.selectedCatCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border, ...themeShadows.card }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.catCardName, { color: activeColors.textPrimary }]}>{selectedCat.name}</Text>
              {!selectedCat.active && (
                <Text style={styles.archivedBadge}>Archived</Text>
              )}
            </View>
            {selectedCat.description ? (
              <Text style={[styles.catCardDesc, { color: activeColors.textSecondary }]}>{selectedCat.description}</Text>
            ) : null}
            <Text style={[styles.catCardMeta, { color: activeColors.textMuted }]}>
              Sort Order: {selectedCat.displayOrder} • {filteredSubcategories.length} subcategories
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              icon="pencil-outline"
              iconColor={activeColors.primary}
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
              iconColor={activeColors.danger}
              size={22}
              onPress={() => handleArchiveCategory(selectedCat)}
            />
          </View>
        </View>
      )}

      {/* Subcategories section */}
      <View style={styles.subcatHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="format-list-bulleted" size={18} color={activeColors.primary} />
          <Text style={[styles.sectionTitle, { color: activeColors.textPrimary }]}>
            Subcategories ({filteredSubcategories.length})
          </Text>
        </View>
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => {
            if (!selectedCatId) {
              showToast('Please select a parent category first', 'warning');
              return;
            }
            setEditingSubcat(null);
            setSubcatName('');
            setSubcatDesc('');
            setSubcatOrder('0');
            setTargetParentCatId(selectedCatId);
            setSubcatDialogVisible(true);
          }}
          style={[styles.addSubcatButton, { borderColor: activeColors.primary }]}
          labelStyle={[styles.addSubcatButtonLabel, { color: activeColors.primary }]}
        >
          Add Subcategory
        </Button>
      </View>

      {filteredSubcategories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="tag-outline" size={36} color={activeColors.textMuted} />
          <Text style={[styles.emptyTitle, { color: activeColors.textPrimary }]}>No Subcategories Yet</Text>
          <Text style={[styles.emptySubtitle, { color: activeColors.textSecondary }]}>
            Tap 'Add Subcategory' to create specific groups under {selectedCat?.name || 'this category'}.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSubcategories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[styles.subcatCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border, ...themeShadows.card }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subcatName, { color: activeColors.textPrimary }]}>{item.name}</Text>
                {item.description ? (
                  <Text style={[styles.subcatDesc, { color: activeColors.textSecondary }]}>{item.description}</Text>
                ) : null}
                <Text style={[styles.subcatOrder, { color: activeColors.textMuted }]}>Sort Order: {item.displayOrder}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton
                  icon="pencil-outline"
                  iconColor={activeColors.primary}
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
                  iconColor={activeColors.danger}
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
        <Dialog visible={catDialogVisible} onDismiss={() => setCatDialogVisible(false)} style={[styles.dialog, { backgroundColor: activeColors.surface }]}>
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            {editingCat ? 'Edit Category' : 'Create Category'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name *"
              value={catName}
              onChangeText={setCatName}
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
            />
            <TextInput
              label="Description (Optional)"
              value={catDesc}
              onChangeText={setCatDesc}
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
            />
            <TextInput
              label="Display Order (0, 1, 2...)"
              value={catOrder}
              onChangeText={setCatOrder}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCatDialogVisible(false)} textColor={activeColors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveCategory} style={{ backgroundColor: activeColors.primary }}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add / Edit / Move Subcategory Dialog */}
      <Portal>
        <Dialog visible={subcatDialogVisible} onDismiss={() => setSubcatDialogVisible(false)} style={[styles.dialog, { backgroundColor: activeColors.surface }]}>
          <Dialog.Title style={[styles.dialogTitle, { color: activeColors.textPrimary }]}>
            {editingSubcat ? 'Edit Subcategory' : 'Create Subcategory'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Subcategory Name *"
              value={subcatName}
              onChangeText={setSubcatName}
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
            />
            <TextInput
              label="Description (Optional)"
              value={subcatDesc}
              onChangeText={setSubcatDesc}
              mode="outlined"
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
            />
            <Text style={{ fontSize: typography.fontSize.caption, color: activeColors.textSecondary, marginTop: 8, marginBottom: 4 }}>
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
                      {
                        backgroundColor: isSelected
                          ? (isDarkMode ? '#1E293B' : '#EFF6FF')
                          : (isDarkMode ? '#111827' : '#F1F5F9'),
                        borderColor: isSelected ? activeColors.primary : activeColors.border,
                        borderWidth: isSelected ? 1.5 : 1,
                        marginRight: 6,
                      },
                    ]}
                    textStyle={[
                      styles.catChipText,
                      {
                        color: isSelected ? activeColors.primary : activeColors.textSecondary,
                        fontWeight: isSelected ? '700' : '600',
                      },
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
              style={[styles.input, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]}
              textColor={activeColors.textPrimary}
              placeholderTextColor={activeColors.textMuted}
              outlineColor={activeColors.border}
              activeOutlineColor={activeColors.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSubcatDialogVisible(false)} textColor={activeColors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleSaveSubcategory} style={{ backgroundColor: activeColors.primary }}>
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  screenTitle: {
    fontSize: typography.fontSize.title,
    fontWeight: '700',
  },
  screenSubtitle: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  addButton: {
    borderRadius: borderRadius.md,
  },
  addButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chipsContainer: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  catChip: {
    borderRadius: borderRadius.full,
    height: 36,
  },
  catChipSelected: {},
  catChipText: {
    fontSize: 13,
  },
  catChipTextSelected: {
    fontWeight: '700',
  },
  selectedCatCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catCardName: {
    fontSize: typography.fontSize.subtitle,
    fontWeight: '700',
  },
  catCardDesc: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  catCardMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  archivedBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
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
    fontWeight: '700',
  },
  addSubcatButton: {
    borderRadius: borderRadius.md,
  },
  addSubcatButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  subcatCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subcatName: {
    fontSize: typography.fontSize.body,
    fontWeight: '700',
  },
  subcatDesc: {
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  subcatOrder: {
    fontSize: 11,
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
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.body,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  dialog: {
    borderRadius: borderRadius.xl,
    paddingBottom: spacing.xs,
  },
  dialogTitle: {
    fontSize: typography.fontSize.title,
    fontWeight: '700',
  },
  input: {
    marginBottom: spacing.sm,
    fontSize: 14,
  },
});
