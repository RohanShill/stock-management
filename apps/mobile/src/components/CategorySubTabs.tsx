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
  onAddSubTab: (name: string, parentId?: string | null, isChild?: boolean) => Promise<void>;
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

  const activeSubcategory = subcategories.find((s) => s.id === activeSubcategoryId);
  const currentDepth: number = activeSubcategory?.depth ?? (breadcrumbPath.length > 0 ? (breadcrumbPath[breadcrumbPath.length - 1].depth ?? 1) : 1);
  const isNested = breadcrumbPath.length > 1;

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
    const checkList = modalIsChild ? childSubcategories : subcategories;
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
      {/* 1. Header Bar: Breadcrumb + Back OR Section Title */}
      {isNested ? (
        <View style={styles.navBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onGoBack}
            style={[
              styles.backBtn,
              {
                backgroundColor: isDarkMode ? activeColors.surface : activeColors.surfaceSubtle,
                borderColor: activeColors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={13}
              color={activeColors.primary}
            />
            <Text style={[styles.backBtnText, { color: activeColors.primary }]}>
              Back
            </Text>
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.breadcrumbScroll}
          >
            {/* Category root */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onSelectBreadcrumb(-1)}
              style={styles.crumbChip}
            >
              <MaterialCommunityIcons
                name="folder-outline"
                size={12}
                color={activeColors.textMuted}
              />
              <Text style={[styles.crumbText, { color: activeColors.textMuted }]}>
                {categoryName}
              </Text>
            </TouchableOpacity>

            {breadcrumbPath.map((node, idx) => {
              const isLast = idx === breadcrumbPath.length - 1;
              return (
                <React.Fragment key={node.id}>
                  <Text style={[styles.crumbSeparator, { color: activeColors.textMuted }]}>
                    ›
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onSelectBreadcrumb(idx)}
                    style={[
                      styles.crumbChip,
                      isLast && {
                        backgroundColor: activeColors.primaryLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.crumbText,
                        {
                          color: isLast ? activeColors.primary : activeColors.textSecondary,
                          fontWeight: isLast ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {node.name}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </ScrollView>

          <View
            style={[
              styles.levelBadge,
              { backgroundColor: activeColors.primaryLight },
            ]}
          >
            <Text style={[styles.levelBadgeText, { color: activeColors.primary }]}>
              Lvl {currentDepth}/5
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.topHeaderRow}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons
              name="layers-outline"
              size={15}
              color={activeColors.primary}
            />
            <Text
              style={[
                styles.headerTitle,
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
                {subcategories.length}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.levelBadge,
              {
                backgroundColor: isDarkMode
                  ? activeColors.surface
                  : activeColors.surfaceSubtle,
              },
            ]}
          >
            <Text style={[styles.levelBadgeText, { color: activeColors.textMuted }]}>
              Level 1
            </Text>
          </View>
        </View>
      )}

      {/* 2. Sibling Tabs Row (Current Level) */}
      <View style={styles.tabsRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
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
                  styles.tabPill,
                  {
                    backgroundColor: isActive
                      ? activeColors.primary
                      : isDarkMode
                      ? activeColors.surface
                      : activeColors.surfaceSubtle,
                    borderColor: isActive
                      ? activeColors.primary
                      : activeColors.border,
                  },
                  isActive && themeShadows.card,
                ]}
              >
                {isActive && <View style={styles.tabActiveDot} />}
                <Text
                  style={[
                    styles.tabPillText,
                    {
                      color: isActive ? '#FFFFFF' : activeColors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {sub.name}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Add Sibling Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() =>
              openAddModal(
                isNested
                  ? (breadcrumbPath[breadcrumbPath.length - 1]?.parentId || null)
                  : null,
                isNested
                  ? (breadcrumbPath[breadcrumbPath.length - 2]?.name || '')
                  : '',
                false
              )
            }
            style={[
              styles.addPillBtn,
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
              size={14}
              color={activeColors.primary}
            />
            <Text
              style={[
                styles.addPillText,
                { color: activeColors.primary },
              ]}
            >
              {isNested ? 'Sibling' : 'Section'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 3. Sub-Sections Explorer (Next Level) */}
      {activeSubcategory && (
        <View
          style={[
            styles.childContainer,
            {
              borderTopColor: isDarkMode
                ? activeColors.surface
                : activeColors.border,
            },
          ]}
        >
          <View style={styles.childHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
              <MaterialCommunityIcons
                name="subdirectory-arrow-right"
                size={14}
                color={activeColors.primary}
              />
              <Text
                style={[
                  styles.childHeading,
                  { color: activeColors.textSecondary },
                ]}
                numberOfLines={1}
              >
                Sub-sections of{' '}
                <Text style={{ fontWeight: '700', color: activeColors.textPrimary }}>
                  "{activeSubcategory.name}"
                </Text>
                :
              </Text>
            </View>
            {childSubcategories.length > 0 && currentDepth < 5 && (
              <Text style={[styles.childHint, { color: activeColors.textMuted }]}>
                Tap to enter
              </Text>
            )}
          </View>

          {childSubcategories.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.childScrollContent}
            >
              {childSubcategories.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  activeOpacity={0.75}
                  onPress={() => onEnterChildSubcategory(child)}
                  onLongPress={() => onLongPressSubcategory?.(child)}
                  delayLongPress={350}
                  style={[
                    styles.childCard,
                    {
                      backgroundColor: isDarkMode
                        ? activeColors.surface
                        : '#FFFFFF',
                      borderColor: activeColors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="folder-outline"
                    size={12}
                    color={activeColors.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.childCardName,
                      { color: activeColors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {child.name}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={13}
                    color={activeColors.textMuted}
                    style={{ marginLeft: 2 }}
                  />
                </TouchableOpacity>
              ))}

              {currentDepth < 5 && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    openAddModal(activeSubcategory.id, activeSubcategory.name, true)
                  }
                  style={[
                    styles.addChildCardBtn,
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
                      styles.addChildCardText,
                      { color: activeColors.primary },
                    ]}
                  >
                    Sub-section
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          ) : (
            /* Clean, informative card when no child subsections exist */
            <View style={styles.emptyChildWrap}>
              {currentDepth < 5 ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    openAddModal(activeSubcategory.id, activeSubcategory.name, true)
                  }
                  style={[
                    styles.emptyAddBtn,
                    {
                      backgroundColor: isDarkMode
                        ? activeColors.surface
                        : activeColors.surfaceSubtle,
                      borderColor: activeColors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.emptyIconCircle,
                      { backgroundColor: activeColors.primaryLight },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={14}
                      color={activeColors.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={[
                        styles.emptyAddTitle,
                        { color: activeColors.primary },
                      ]}
                    >
                      + Add Sub-section inside "{activeSubcategory.name}"
                    </Text>
                    <Text
                      style={[
                        styles.emptyAddSub,
                        { color: activeColors.textMuted },
                      ]}
                    >
                      e.g. UPVC, Schedule 80, Thickness (Or enter stock in matrix below)
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.maxLevelPill,
                    { backgroundColor: activeColors.surfaceSubtle },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={14}
                    color={activeColors.textMuted}
                  />
                  <Text
                    style={[
                      styles.maxLevelText,
                      { color: activeColors.textMuted },
                    ]}
                  >
                    Max nesting level 5 reached — Manage stock in matrix below
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Modal for Adding New Section or Nested Sub-Section */}
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
                    ? `Add Sub-Section inside "${modalParentName || activeSubcategory?.name}"`
                    : isNested
                    ? `Add Sibling Sub-Section`
                    : `Add New Section in ${categoryName}`}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  {modalIsChild
                    ? 'e.g. UPVC Pipe, Schedule 80, 4-Metre, etc.'
                    : 'e.g. Water Supply Pipes, Drainage Pipes, Fittings'}
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
                    : isNested
                    ? '+ Add Sibling'
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
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  breadcrumbScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexGrow: 1,
  },
  crumbChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    gap: 3,
  },
  crumbText: {
    fontSize: 12,
  },
  crumbSeparator: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 1,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  tabsRowWrap: {
    paddingBottom: 8,
  },
  tabsScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  tabActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 3,
  },
  addPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  childContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  childHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  childHeading: {
    fontSize: 11,
    fontWeight: '500',
  },
  childHint: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  childScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  childCardName: {
    fontSize: 11,
    fontWeight: '600',
  },
  addChildCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 3,
  },
  addChildCardText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyChildWrap: {
    marginTop: 2,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAddTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyAddSub: {
    fontSize: 10,
    marginTop: 1,
  },
  maxLevelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 5,
    alignSelf: 'flex-start',
  },
  maxLevelText: {
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
