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

interface CategorySubTabsProps {
  categoryName: string;
  subcategories: Subcategory[]; // Root sections (Level 1)
  activeRootSectionId: string;
  activeSubcategoryId: string; // The currently active node (root or child) whose matrix is displayed
  childSubcategories: Subcategory[]; // Children of activeRootSection (Level 2)
  level3Subcategories?: Subcategory[]; // Children of activeSubcategory (Level 3) if activeSubcategory is Level 2
  onSelectRootSection: (sectionId: string) => void;
  onSelectSubcategory: (subcatId: string) => void;
  onAddSubTab: (name: string, parentId?: string | null, isChild?: boolean) => Promise<void>;
  onDeleteSubTab?: (subcatId: string) => Promise<void> | void;
  onLongPressSubcategory?: (subcat: Subcategory) => void;
  isDarkMode: boolean;
  activeColors: any;
}

export const CategorySubTabs: React.FC<CategorySubTabsProps> = ({
  categoryName,
  subcategories,
  activeRootSectionId,
  activeSubcategoryId,
  childSubcategories,
  level3Subcategories = [],
  onSelectRootSection,
  onSelectSubcategory,
  onAddSubTab,
  onLongPressSubcategory,
  isDarkMode,
  activeColors,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [modalParentName, setModalParentName] = useState<string>('');
  const [modalIsChild, setModalIsChild] = useState<boolean>(true);
  const [newTabName, setNewTabName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const themeShadows = getThemeShadows(isDarkMode);
  const { showToast } = useAppStore();

  const activeRootSection = subcategories.find((s) => s.id === activeRootSectionId) || subcategories[0] || null;
  const isViewingChild = Boolean(activeRootSection && activeSubcategoryId !== activeRootSection.id);
  const activeLevel3 = level3Subcategories.find((s) => s.id === activeSubcategoryId);
  const activeChild = childSubcategories.find((s) => s.id === activeSubcategoryId) ||
    (activeLevel3 ? childSubcategories.find((s) => s.id === activeLevel3.parentId) : undefined);

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

    // Check duplicate
    const checkList = modalIsChild
      ? (activeChild && modalParentId === activeChild.id ? level3Subcategories : childSubcategories)
      : subcategories;
    if (checkList.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      showToast(`"${clean}" already exists here.`, 'warning');
      return;
    }

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
      {/* TIER 1: MAIN SECTIONS (Level 1)                          */}
      {/* ========================================================= */}
      <View style={styles.tierSection}>
        <View style={styles.tierHeader}>
          <View style={styles.tierHeaderLeft}>
            <MaterialCommunityIcons
              name="layers-outline"
              size={14}
              color={activeColors.primary}
            />
            <Text
              style={[
                styles.tierTitle,
                { color: activeColors.textPrimary },
              ]}
            >
              1. MAIN SECTIONS IN {categoryName.toUpperCase()}
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
                {subcategories.length}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.depthBadge,
              {
                backgroundColor: !isViewingChild
                  ? activeColors.primaryLight
                  : isDarkMode
                  ? activeColors.surface
                  : activeColors.surfaceSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.depthBadgeText,
                {
                  color: !isViewingChild
                    ? activeColors.primary
                    : activeColors.textMuted,
                },
              ]}
            >
              Level 1
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollRow}
        >
          {subcategories.map((sub) => {
            const isRootActive = sub.id === activeRootSection?.id;
            return (
              <TouchableOpacity
                key={sub.id}
                activeOpacity={0.75}
                onPress={() => onSelectRootSection(sub.id)}
                onLongPress={() => onLongPressSubcategory?.(sub)}
                delayLongPress={350}
                style={[
                  styles.mainPill,
                  {
                    backgroundColor: isRootActive
                      ? activeColors.primary
                      : isDarkMode
                      ? activeColors.surface
                      : activeColors.surfaceSubtle,
                    borderColor: isRootActive
                      ? activeColors.primary
                      : activeColors.border,
                  },
                  isRootActive && themeShadows.card,
                ]}
              >
                {isRootActive && <View style={styles.whiteDot} />}
                <Text
                  style={[
                    styles.mainPillText,
                    {
                      color: isRootActive
                        ? '#FFFFFF'
                        : activeColors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {sub.name}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Add Main Section Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => openAddModal(null, '', false)}
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
              Section
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ========================================================= */}
      {/* TIER 2: SUB-SECTIONS (Level 2 under Active Root Section) */}
      {/* ========================================================= */}
      {activeRootSection && (
        <View
          style={[
            styles.tierSection,
            styles.tierDivider,
            {
              borderTopColor: isDarkMode
                ? activeColors.surface
                : activeColors.border,
            },
          ]}
        >
          <View style={styles.tierHeader}>
            <View style={styles.tierHeaderLeft}>
              <MaterialCommunityIcons
                name="subdirectory-arrow-right"
                size={14}
                color={activeColors.primary}
              />
              <Text
                style={[
                  styles.tierTitle,
                  { color: activeColors.textSecondary },
                ]}
                numberOfLines={1}
              >
                2. SUB-SECTIONS OF{' '}
                <Text style={{ fontWeight: '800', color: activeColors.textPrimary }}>
                  "{activeRootSection.name}"
                </Text>
                :
              </Text>
            </View>

            <View
              style={[
                styles.depthBadge,
                {
                  backgroundColor: isViewingChild && !activeLevel3
                    ? activeColors.primaryLight
                    : isDarkMode
                    ? activeColors.surface
                    : activeColors.surfaceSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.depthBadgeText,
                  {
                    color: isViewingChild && !activeLevel3
                      ? activeColors.primary
                      : activeColors.textMuted,
                  },
                ]}
              >
                Level 2
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollRow}
          >
            {/* Option A: Direct Section Stock */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => onSelectSubcategory(activeRootSection.id)}
              style={[
                styles.subPill,
                !isViewingChild && styles.subPillActiveHighlight,
                {
                  backgroundColor: !isViewingChild
                    ? activeColors.primaryLight
                    : isDarkMode
                    ? activeColors.surface
                    : activeColors.surfaceSubtle,
                  borderColor: !isViewingChild
                    ? activeColors.primary
                    : activeColors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={13}
                color={!isViewingChild ? activeColors.primary : activeColors.textMuted}
              />
              <Text
                style={[
                  styles.subPillText,
                  {
                    color: !isViewingChild
                      ? activeColors.primary
                      : activeColors.textSecondary,
                    fontWeight: !isViewingChild ? '800' : '600',
                  },
                ]}
              >
                {!isViewingChild ? `✓ Main: ${activeRootSection.name}` : `Main: ${activeRootSection.name}`}
              </Text>
            </TouchableOpacity>

            {/* Child Sub-sections (Level 2) */}
            {childSubcategories.map((child) => {
              const isThisChildDirectlyActive = child.id === activeSubcategoryId;
              const isThisChildBranchActive = activeLevel3?.parentId === child.id;
              const isHighlighted = isThisChildDirectlyActive || isThisChildBranchActive;

              return (
                <TouchableOpacity
                  key={child.id}
                  activeOpacity={0.75}
                  onPress={() => onSelectSubcategory(child.id)}
                  onLongPress={() => onLongPressSubcategory?.(child)}
                  delayLongPress={350}
                  style={[
                    styles.subPill,
                    isHighlighted && styles.subPillActiveHighlight,
                    {
                      backgroundColor: isThisChildDirectlyActive
                        ? activeColors.primary
                        : isThisChildBranchActive
                        ? activeColors.primaryLight
                        : isDarkMode
                        ? activeColors.surface
                        : activeColors.surfaceSubtle,
                      borderColor: isHighlighted
                        ? activeColors.primary
                        : activeColors.border,
                    },
                    isThisChildDirectlyActive && themeShadows.card,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isThisChildDirectlyActive ? 'check' : isThisChildBranchActive ? 'folder-open' : 'folder-outline'}
                    size={13}
                    color={
                      isThisChildDirectlyActive
                        ? '#FFFFFF'
                        : isThisChildBranchActive
                        ? activeColors.primary
                        : activeColors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.subPillText,
                      {
                        color: isThisChildDirectlyActive
                          ? '#FFFFFF'
                          : isThisChildBranchActive
                          ? activeColors.primary
                          : activeColors.textPrimary,
                        fontWeight: isHighlighted ? '800' : '600',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {child.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Add Sub-section Button */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() =>
                openAddModal(activeRootSection.id, activeRootSection.name, true)
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
                Sub-section
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* ========================================================= */}
      {/* TIER 3: NESTED SUB-SECTIONS (Level 3 under active Level 2) */}
      {/* ========================================================= */}
      {isViewingChild && activeChild && (
        <View
          style={[
            styles.tierSection,
            styles.tierDivider,
            {
              borderTopColor: isDarkMode
                ? activeColors.surface
                : activeColors.border,
            },
          ]}
        >
          <View style={styles.tierHeader}>
            <View style={styles.tierHeaderLeft}>
              <MaterialCommunityIcons
                name="subdirectory-arrow-right"
                size={14}
                color={activeColors.primary}
              />
              <Text
                style={[
                  styles.tierTitle,
                  { color: activeColors.textSecondary },
                ]}
                numberOfLines={1}
              >
                3. NESTED SUB-SECTIONS OF{' '}
                <Text style={{ fontWeight: '800', color: activeColors.textPrimary }}>
                  "{activeChild.name}"
                </Text>
                :
              </Text>
            </View>

            <View
              style={[
                styles.depthBadge,
                {
                  backgroundColor: activeLevel3
                    ? activeColors.primaryLight
                    : isDarkMode
                    ? activeColors.surface
                    : activeColors.surfaceSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.depthBadgeText,
                  {
                    color: activeLevel3
                      ? activeColors.primary
                      : activeColors.textMuted,
                  },
                ]}
              >
                Level 3
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollRow}
          >
            {level3Subcategories.map((l3) => {
              const isL3Active = l3.id === activeSubcategoryId;
              return (
                <TouchableOpacity
                  key={l3.id}
                  activeOpacity={0.75}
                  onPress={() => onSelectSubcategory(l3.id)}
                  onLongPress={() => onLongPressSubcategory?.(l3)}
                  delayLongPress={350}
                  style={[
                    styles.subPill,
                    {
                      backgroundColor: isL3Active
                        ? activeColors.primary
                        : isDarkMode
                        ? activeColors.surface
                        : activeColors.surfaceSubtle,
                      borderColor: isL3Active
                        ? activeColors.primary
                        : activeColors.border,
                    },
                    isL3Active && themeShadows.card,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isL3Active ? 'check' : 'folder-outline'}
                    size={13}
                    color={isL3Active ? '#FFFFFF' : activeColors.primary}
                  />
                  <Text
                    style={[
                      styles.subPillText,
                      {
                        color: isL3Active
                          ? '#FFFFFF'
                          : activeColors.textPrimary,
                        fontWeight: isL3Active ? '800' : '600',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {l3.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Add Level 3 Button */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => openAddModal(activeChild.id, activeChild.name, true)}
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
                Level 3 Sub
              </Text>
            </TouchableOpacity>
          </ScrollView>
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
                    ? `Add Sub-Section inside "${modalParentName || activeRootSection?.name}"`
                    : `Add New Section in ${categoryName}`}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  {modalIsChild
                    ? 'e.g. UPVC Pipe, Schedule 80, Thickness, etc.'
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tierSection: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tierDivider: {
    borderTopWidth: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
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
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
  depthBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  depthBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  mainPillActive: {
    // shadow handled by token
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 5,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 3,
  },
  addDashedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tier2Wrap: {
    paddingTop: 8,
  },
  tier3Wrap: {
    paddingTop: 8,
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
