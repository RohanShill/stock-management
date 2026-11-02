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
import { Subcategory } from '@hardware-store/shared';
import { useAppStore } from '../store/useAppStore.js';
import { borderRadius, getThemeShadows } from '../theme/tokens.js';

export interface HierarchyTier {
  depth: number;
  parent: Subcategory | null; // null for Root Level (Level 1)
  items: Subcategory[]; // Siblings at this level
  activeId: string | null; // Currently selected item id in this tier
}

export interface CategorySubTabsProps {
  categoryName: string;
  hierarchyTiers?: HierarchyTier[];
  subcategories?: Subcategory[];
  activeRootSectionId?: string;
  activeSubcategoryId: string;
  breadcrumbPath?: Subcategory[];
  childSubcategories?: Subcategory[];
  level3Subcategories?: Subcategory[];
  onSelectRootSection?: (sectionId: string) => void;
  onSelectSubcategory: (subcatId: string) => void;
  onAddSubTab: (name: string, parentId?: string | null, isChild?: boolean) => Promise<void>;
  onDeleteSubTab?: (subcatId: string) => Promise<void> | void;
  onLongPressSubcategory?: (subcat: Subcategory) => void;
  isDarkMode: boolean;
  activeColors: any;
}

export const CategorySubTabs: React.FC<CategorySubTabsProps> = ({
  categoryName,
  hierarchyTiers,
  subcategories = [],
  activeRootSectionId = '',
  activeSubcategoryId,
  breadcrumbPath = [],
  childSubcategories = [],
  level3Subcategories = [],
  onSelectRootSection,
  onSelectSubcategory,
  onAddSubTab,
  onLongPressSubcategory,
  isDarkMode,
  activeColors,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [modalParentName, setModalParentName] = useState<string>('');
  const [modalIsChild, setModalIsChild] = useState<boolean>(true);
  const [newTabName, setNewTabName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const themeShadows = getThemeShadows(isDarkMode);
  const { showToast } = useAppStore();

  // If hierarchyTiers is provided by parent, use it directly.
  // Otherwise, construct fallback tiers from subcategories, childSubcategories, etc.
  const tiers: HierarchyTier[] = React.useMemo(() => {
    if (hierarchyTiers && hierarchyTiers.length > 0) {
      return hierarchyTiers;
    }

    const fallback: HierarchyTier[] = [];
    fallback.push({
      depth: 1,
      parent: null,
      items: subcategories,
      activeId: activeRootSectionId || (subcategories[0]?.id ?? null),
    });

    const activeRoot = subcategories.find((s) => s.id === activeRootSectionId) || subcategories[0];
    if (activeRoot) {
      fallback.push({
        depth: 2,
        parent: activeRoot,
        items: childSubcategories,
        activeId: activeSubcategoryId,
      });

      const activeChild = childSubcategories.find((s) => s.id === activeSubcategoryId);
      if (activeChild && level3Subcategories.length > 0) {
        fallback.push({
          depth: 3,
          parent: activeChild,
          items: level3Subcategories,
          activeId: activeSubcategoryId,
        });
      }
    }
    return fallback;
  }, [
    hierarchyTiers,
    subcategories,
    activeRootSectionId,
    childSubcategories,
    activeSubcategoryId,
    level3Subcategories,
  ]);

  const openAddModal = (
    parentId: string | null = null,
    parentName: string = '',
    isChild: boolean = true
  ) => {
    setModalParentId(parentId);
    setModalParentName(parentName);
    setModalIsChild(isChild);
    setNewTabName('');
    setModalVisible(true);
  };

  const handleCreate = async () => {
    const clean = newTabName.trim();
    if (!clean || submitting) return;

    try {
      setSubmitting(true);
      await onAddSubTab(clean, modalParentId, modalIsChild);
      setNewTabName('');
      setModalVisible(false);
    } catch (e: any) {
      console.error('Failed to add sub-tab:', e);
      showToast(e?.message || 'Failed to add section', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const crumbs = breadcrumbPath.length > 0
    ? breadcrumbPath
    : subcategories.filter((s) => s.id === activeSubcategoryId || s.id === activeRootSectionId);

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isDarkMode ? activeColors.surfaceElevated : '#FFFFFF',
          borderColor: activeColors.border,
        },
        themeShadows.card,
      ]}
    >
      {/* ========================================================= */}
      {/* MINIMIZED (COLLAPSED) VIEW: Saves max screen on mobile    */}
      {/* ========================================================= */}
      {isMinimized ? (
        <View style={styles.minimizedRow}>
          <View style={styles.minimizedLeft}>
            <MaterialCommunityIcons
              name="layers-outline"
              size={14}
              color={activeColors.primary}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.crumbScroll}
            >
              {crumbs.map((crumb, idx) => {
                const isLast = idx === crumbs.length - 1;
                return (
                  <View key={crumb.id} style={styles.crumbItem}>
                    {idx > 0 && (
                      <Text style={[styles.crumbSeparator, { color: activeColors.textMuted }]}>
                        ›
                      </Text>
                    )}
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => onSelectSubcategory(crumb.id)}
                      onLongPress={() => onLongPressSubcategory?.(crumb)}
                      delayLongPress={350}
                      style={[
                        styles.crumbChip,
                        isLast && {
                          backgroundColor: activeColors.primaryLight,
                          borderColor: activeColors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.crumbText,
                          {
                            color: isLast ? activeColors.primary : activeColors.textSecondary,
                            fontWeight: isLast ? '800' : '600',
                          },
                        ]}
                      >
                        {crumb.name}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsMinimized(false)}
            style={[
              styles.toggleBtn,
              {
                backgroundColor: isDarkMode ? activeColors.surface : activeColors.surfaceSubtle,
                borderColor: activeColors.border,
              },
            ]}
          >
            <MaterialCommunityIcons name="chevron-down" size={15} color={activeColors.primary} />
            <Text style={[styles.toggleBtnText, { color: activeColors.primary }]}>
              Expand
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ========================================================= */
        /* EXPANDED VIEW: Multi-tier, supporting arbitrary depth     */
        /* ========================================================= */
        <View>
          {/* Card Top Header: Category Name + Minimize Toggle */}
          <View style={styles.topHeaderBar}>
            <View style={styles.topHeaderLeft}>
              <MaterialCommunityIcons
                name="layers-outline"
                size={14}
                color={activeColors.primary}
              />
              <Text
                style={[
                  styles.topHeaderTitle,
                  { color: activeColors.textPrimary },
                ]}
              >
                {categoryName.toUpperCase()} SECTIONS
              </Text>
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isDarkMode
                      ? activeColors.surface
                      : activeColors.surfaceSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    { color: activeColors.textSecondary },
                  ]}
                >
                  {tiers[0]?.items?.length || subcategories.length}
                </Text>
              </View>
            </View>

            {/* Minimize / Hide Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsMinimized(true)}
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: isDarkMode ? activeColors.surface : activeColors.surfaceSubtle,
                  borderColor: activeColors.border,
                },
              ]}
            >
              <MaterialCommunityIcons name="chevron-up" size={14} color={activeColors.textSecondary} />
              <Text style={[styles.toggleBtnText, { color: activeColors.textSecondary }]}>
                Hide
              </Text>
            </TouchableOpacity>
          </View>

          {/* Render All Dynamic Hierarchy Tiers */}
          {tiers.map((tier, tierIdx) => {
            const isRootTier = tier.parent === null;
            return (
              <View
                key={tier.parent ? tier.parent.id : 'root-tier'}
                style={[
                  styles.tierSection,
                  tierIdx > 0 && styles.tierDivider,
                  {
                    borderTopColor: isDarkMode
                      ? activeColors.surface
                      : activeColors.border,
                  },
                ]}
              >
                {/* Tier Sub-Header */}
                {!isRootTier && (
                  <View style={styles.tierHeader}>
                    <View style={styles.tierHeaderLeft}>
                      <MaterialCommunityIcons
                        name="subdirectory-arrow-right"
                        size={13}
                        color={activeColors.primary}
                      />
                      <Text
                        style={[
                          styles.tierTitle,
                          { color: activeColors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        Sub-sections of{' '}
                        <Text style={{ fontWeight: '800', color: activeColors.textPrimary }}>
                          "{tier.parent?.name}"
                        </Text>
                        :
                      </Text>
                    </View>
                  </View>
                )}

                {/* Horizontal Scroll of Section / Sub-section Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scrollRow}
                >
                  {/* If not root, render Main Section direct stock pill */}
                  {!isRootTier && tier.parent && (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => onSelectSubcategory(tier.parent!.id)}
                      style={[
                        styles.subPill,
                        activeSubcategoryId === tier.parent.id && styles.subPillActiveHighlight,
                        {
                          backgroundColor: activeSubcategoryId === tier.parent.id
                            ? activeColors.primary
                            : isDarkMode
                            ? activeColors.surface
                            : activeColors.surfaceSubtle,
                          borderColor: activeSubcategoryId === tier.parent.id
                            ? activeColors.primary
                            : activeColors.border,
                        },
                        activeSubcategoryId === tier.parent.id && themeShadows.card,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="package-variant-closed"
                        size={13}
                        color={activeSubcategoryId === tier.parent.id ? '#FFFFFF' : activeColors.textMuted}
                      />
                      <Text
                        style={[
                          styles.subPillText,
                          {
                            color: activeSubcategoryId === tier.parent.id
                              ? '#FFFFFF'
                              : activeColors.textSecondary,
                            fontWeight: activeSubcategoryId === tier.parent.id ? '800' : '600',
                          },
                        ]}
                      >
                        {activeSubcategoryId === tier.parent.id
                          ? `• Main: ${tier.parent.name}`
                          : `Main: ${tier.parent.name}`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Sibling Items at this tier */}
                  {tier.items.map((item) => {
                    const isItemActive = item.id === activeSubcategoryId;
                    const isItemInPath = !isItemActive && tier.activeId === item.id;
                    const isHighlighted = isItemActive || isItemInPath;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.75}
                        onPress={() => onSelectSubcategory(item.id)}
                        onLongPress={() => onLongPressSubcategory?.(item)}
                        delayLongPress={350}
                        style={[
                          isRootTier ? styles.mainPill : styles.subPill,
                          isHighlighted && styles.subPillActiveHighlight,
                          {
                            backgroundColor: isItemActive
                              ? activeColors.primary
                              : isItemInPath
                              ? activeColors.primaryLight
                              : isDarkMode
                              ? activeColors.surface
                              : activeColors.surfaceSubtle,
                            borderColor: isHighlighted
                              ? activeColors.primary
                              : activeColors.border,
                          },
                          isItemActive && themeShadows.card,
                        ]}
                      >
                        {isRootTier && isItemActive && <View style={styles.whiteDot} />}
                        {!isRootTier && (
                          <MaterialCommunityIcons
                            name={isItemActive ? 'check' : isItemInPath ? 'folder-open' : 'folder-outline'}
                            size={13}
                            color={
                              isItemActive
                                ? '#FFFFFF'
                                : isItemInPath
                                ? activeColors.primary
                                : activeColors.textSecondary
                            }
                          />
                        )}
                        <Text
                          style={[
                            isRootTier ? styles.mainPillText : styles.subPillText,
                            {
                              color: isItemActive
                                ? '#FFFFFF'
                                : isItemInPath
                                ? activeColors.primary
                                : activeColors.textPrimary,
                              fontWeight: isHighlighted ? '800' : '600',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Add Button for this tier */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() =>
                      openAddModal(
                        tier.parent ? tier.parent.id : null,
                        tier.parent ? tier.parent.name : '',
                        !isRootTier
                      )
                    }
                    style={[
                      styles.addDashedBtn,
                      {
                        backgroundColor: isDarkMode
                          ? activeColors.surface
                          : activeColors.surfaceSubtle,
                        borderColor: activeColors.primary,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={13}
                      color={activeColors.primary}
                    />
                    <Text
                      style={[
                        styles.addDashedText,
                        { color: activeColors.primary },
                      ]}
                    >
                      {isRootTier ? 'Section' : 'Sub-section'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            );
          })}
        </View>
      )}

      {/* Modal for Adding New Section or Sub-Section */}
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
                  {modalIsChild
                    ? `Add Sub-Section inside "${modalParentName || activeRootSectionId}"`
                    : `Add New Section in ${categoryName}`}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  {modalIsChild
                    ? 'Enter name for this nested sub-section'
                    : 'e.g. Water Supply Pipes, Drainage, Fittings'}
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
                modalIsChild
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
                    : modalIsChild
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
  cardContainer: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  minimizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  minimizedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  crumbScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  crumbSeparator: {
    fontSize: 12,
    fontWeight: '700',
  },
  crumbChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  crumbText: {
    fontSize: 11,
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  topHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginLeft: 6,
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tierSection: {
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  tierDivider: {
    borderTopWidth: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tierHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  tierTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  whiteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  mainPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  subPillActiveHighlight: {
    borderWidth: 1.5,
  },
  subPillText: {
    fontSize: 11,
  },
  addDashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 3,
  },
  addDashedText: {
    fontSize: 11,
    fontWeight: '700',
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
    marginBottom: 20,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  input: {
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 24,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
