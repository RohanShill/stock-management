import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Subcategory } from '@hardware-store/shared';
import { useAppStore } from '../store/useAppStore.js';
import { borderRadius, spacing, getThemeShadows } from '../theme/tokens.js';

interface CategorySubTabsProps {
  categoryName: string;
  subcategories: Subcategory[];
  activeSubcategoryId: string;
  breadcrumbPath: Subcategory[];
  childSubcategories: Subcategory[];
  onSelectSubcategory: (subcatId: string) => void;
  onEnterChildSubcategory: (child: Subcategory) => void;
  onSelectBreadcrumb: (index: number) => void;
  onGoBack: () => void;
  onAddSubTab: (name: string, parentId?: string | null) => Promise<void>;
  onDeleteSubTab?: (subcatId: string) => Promise<void> | void;
  onLongPressSubcategory?: (subcat: Subcategory) => void;
  isDarkMode: boolean;
  activeColors: any;
}

export const CategorySubTabs: React.FC<CategorySubTabsProps> = ({
  categoryName,
  subcategories,
  activeSubcategoryId,
  breadcrumbPath,
  childSubcategories,
  onSelectSubcategory,
  onEnterChildSubcategory,
  onSelectBreadcrumb,
  onGoBack,
  onAddSubTab,
  onDeleteSubTab,
  onLongPressSubcategory,
  isDarkMode,
  activeColors,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [modalParentName, setModalParentName] = useState<string>('');
  const [newTabName, setNewTabName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const themeShadows = getThemeShadows(isDarkMode);
  const { showToast } = useAppStore();

  const activeSubcategory = subcategories.find((s) => s.id === activeSubcategoryId);
  const currentDepth: number = activeSubcategory?.depth ?? (breadcrumbPath.length > 0 ? (breadcrumbPath[breadcrumbPath.length - 1].depth ?? 1) : 1);

  const openAddModal = (parentId: string | null = null, parentName: string = '') => {
    setModalParentId(parentId);
    setModalParentName(parentName);
    setNewTabName('');
    setModalVisible(true);
  };

  const handleCreate = async () => {
    const clean = newTabName.trim();
    if (!clean || submitting) return;

    // Check sibling duplicate
    const checkList = modalParentId ? childSubcategories : subcategories;
    if (checkList.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      showToast(`Section "${clean}" already exists here.`, 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await onAddSubTab(clean, modalParentId);
      setNewTabName('');
      setModalVisible(false);
    } catch (e: any) {
      console.error('Failed to add sub-tab:', e);
      showToast(e?.message || 'Failed to add section', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Breadcrumb Path Bar (Shown when user has drilled down into subsections) */}
      {breadcrumbPath.length > 0 && (
        <View style={styles.breadcrumbContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.breadcrumbContent}
          >
            {/* Back button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onGoBack}
              style={[
                styles.backBtn,
                {
                  backgroundColor: isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surfaceSubtle,
                  borderColor: activeColors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={14}
                color={activeColors.primary}
              />
              <Text style={[styles.backBtnText, { color: activeColors.primary }]}>
                Back
              </Text>
            </TouchableOpacity>

            {/* Root Category */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onSelectBreadcrumb(-1)}
              style={styles.breadcrumbItem}
            >
              <MaterialCommunityIcons
                name="folder-outline"
                size={14}
                color={activeColors.textMuted}
              />
              <Text style={[styles.breadcrumbText, { color: activeColors.textMuted }]}>
                {categoryName}
              </Text>
            </TouchableOpacity>

            {/* Parent Trail */}
            {breadcrumbPath.map((node, idx) => {
              const isLast = idx === breadcrumbPath.length - 1;
              return (
                <React.Fragment key={node.id}>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={14}
                    color={activeColors.textMuted}
                    style={{ marginHorizontal: 2 }}
                  />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onSelectBreadcrumb(idx)}
                    style={[
                      styles.breadcrumbItem,
                      isLast && {
                        backgroundColor: activeColors.primaryLight,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.breadcrumbText,
                        {
                          color: isLast
                            ? activeColors.primary
                            : activeColors.textSecondary,
                          fontWeight: isLast ? '700' : '500',
                        },
                      ]}
                    >
                      {node.name}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 2. Sibling Sub-Tabs Row at Current Level */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {subcategories.map((sub) => {
          const isActive = sub.id === activeSubcategoryId;
          return (
            <TouchableOpacity
              key={sub.id}
              activeOpacity={0.75}
              onPress={() => onSelectSubcategory(sub.id)}
              onLongPress={() => onLongPressSubcategory?.(sub)}
              delayLongPress={350}
              style={[
                styles.tabChip,
                {
                  backgroundColor: isActive
                    ? activeColors.primary
                    : isDarkMode
                    ? activeColors.surfaceElevated
                    : activeColors.surface,
                  borderColor: isActive
                    ? activeColors.primary
                    : activeColors.border,
                },
                isActive && themeShadows.card,
              ]}
            >
              {isActive && <View style={styles.activeDot} />}
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isActive ? '#FFFFFF' : activeColors.textSecondary,
                  },
                ]}
              >
                {sub.name.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Add Sibling Tab Button */}
        {breadcrumbPath.length === 0 ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => openAddModal(null, '')}
            style={[
              styles.addTabChip,
              {
                backgroundColor: isDarkMode
                  ? activeColors.surfaceElevated
                  : activeColors.surface,
                borderColor: activeColors.primaryBorder || activeColors.border,
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
                styles.addTabText,
                { color: activeColors.primary },
              ]}
            >
              SECTION
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* 3. Child Sub-Sections Row (Shown for the active section if depth < 5) */}
      {activeSubcategory && (
        <View style={styles.childSectionStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.childScrollContent}
          >
            <View style={styles.childPrefix}>
              <MaterialCommunityIcons
                name="subdirectory-arrow-right"
                size={14}
                color={activeColors.primary}
              />
              <Text
                style={[
                  styles.childPrefixText,
                  { color: activeColors.textMuted },
                ]}
              >
                Sub-Sections:
              </Text>
            </View>

            {/* Existing Child Subcategories */}
            {childSubcategories.map((child) => (
              <TouchableOpacity
                key={child.id}
                activeOpacity={0.75}
                onPress={() => onEnterChildSubcategory(child)}
                onLongPress={() => onLongPressSubcategory?.(child)}
                delayLongPress={350}
                style={[
                  styles.childChip,
                  {
                    backgroundColor: isDarkMode
                      ? activeColors.surfaceElevated
                      : activeColors.surfaceSubtle,
                    borderColor: activeColors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="folder-outline"
                  size={12}
                  color={activeColors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.childChipText,
                    { color: activeColors.textPrimary },
                  ]}
                >
                  {child.name}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={14}
                  color={activeColors.textMuted}
                />
              </TouchableOpacity>
            ))}

            {/* Add Child Sub-Section Button (Allowed up to depth 4 under section = level 5 total) */}
            {currentDepth < 5 ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => openAddModal(activeSubcategory.id, activeSubcategory.name)}
                style={[
                  styles.addChildBtn,
                  {
                    backgroundColor: isDarkMode
                      ? activeColors.surfaceElevated
                      : activeColors.surface,
                    borderColor: activeColors.primary,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={14}
                  color={activeColors.primary}
                />
                <Text
                  style={[
                    styles.addChildBtnText,
                    { color: activeColors.primary },
                  ]}
                >
                  SUB-SECTION
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  styles.maxDepthBadge,
                  { backgroundColor: activeColors.surfaceSubtle },
                ]}
              >
                <Text
                  style={[
                    styles.maxDepthText,
                    { color: activeColors.textMuted },
                  ]}
                >
                  (Max Level Reached)
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Modal for adding new section or child sub-section */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
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
                  name="folder-plus-outline"
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
                  {modalParentName
                    ? `Add Sub-Section inside "${modalParentName}"`
                    : `Add New Section in ${categoryName}`}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  {modalParentName
                    ? 'Create a nested subsection (e.g. Schedule 80, UPVC, etc.)'
                    : 'e.g. PVC Valves, Solvent Cement, Teflon etc.'}
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
              placeholder={
                modalParentName
                  ? 'Enter sub-section name...'
                  : 'Enter section name...'
              }
              placeholderTextColor={activeColors.textMuted}
              value={newTabName}
              onChangeText={setNewTabName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setNewTabName('');
                  setModalVisible(false);
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
                onPress={handleCreate}
                disabled={!newTabName.trim() || submitting}
                style={[
                  styles.btnConfirm,
                  {
                    backgroundColor: newTabName.trim()
                      ? activeColors.primary
                      : activeColors.border,
                  },
                ]}
              >
                <Text style={styles.btnConfirmText}>
                  {submitting
                    ? 'Creating...'
                    : modalParentName
                    ? '+ Add Sub-Section'
                    : '+ Create Section'}
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
  container: {
    paddingVertical: 4,
  },
  breadcrumbContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  breadcrumbContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 4,
    marginRight: 6,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 3,
  },
  breadcrumbText: {
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  addTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 4,
  },
  addTabText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  childSectionStrip: {
    marginTop: 6,
    paddingHorizontal: 16,
  },
  childScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  childPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 2,
  },
  childPrefixText: {
    fontSize: 11,
    fontWeight: '600',
  },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  childChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 2,
  },
  addChildBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  maxDepthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  maxDepthText: {
    fontSize: 10,
    fontStyle: 'italic',
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
    fontSize: 16,
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
});
