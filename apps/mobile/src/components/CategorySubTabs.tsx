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
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Subcategory } from '@hardware-store/shared';
import { borderRadius, spacing, getThemeShadows } from '../theme/tokens.js';

interface CategorySubTabsProps {
  subcategories: Subcategory[];
  activeSubcategoryId: string;
  onSelectSubcategory: (subcatId: string) => void;
  onAddSubTab: (name: string) => Promise<void>;
  onDeleteSubTab?: (subcatId: string) => Promise<void> | void;
  isDarkMode: boolean;
  activeColors: any;
}

export const CategorySubTabs: React.FC<CategorySubTabsProps> = ({
  subcategories,
  activeSubcategoryId,
  onSelectSubcategory,
  onAddSubTab,
  onDeleteSubTab,
  isDarkMode,
  activeColors,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const themeShadows = getThemeShadows(isDarkMode);

  const handleCreate = async () => {
    const clean = newTabName.trim();
    if (!clean || submitting) return;
    if (subcategories.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      Alert.alert('Section Exists', `Section "${clean}" pehle se maujood hai.`);
      return;
    }
    try {
      setSubmitting(true);
      await onAddSubTab(clean);
      setNewTabName('');
      setModalVisible(false);
    } catch (e) {
      console.error('Failed to add sub-tab:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
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
              {isActive && (
                <View style={styles.activeDot} />
              )}
              <Text
                style={[
                  styles.tabText,
                  {
                    color: isActive
                      ? '#FFFFFF'
                      : activeColors.textSecondary,
                    fontWeight: isActive ? '700' : '600',
                  },
                ]}
              >
                {sub.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* The '+' button for adding custom sub-tab */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setModalVisible(true)}
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
            size={18}
            color={activeColors.primary}
          />
          <Text
            style={[
              styles.addTabText,
              { color: activeColors.primary },
            ]}
          >
            Add Section
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal for adding new sub-tab */}
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
                  Naya Section Add Karein
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: activeColors.textMuted },
                  ]}
                >
                  Jaise: PVC Valves, Solvent Cement, Teflon etc.
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
              placeholder="Section Name likhein..."
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
                  {submitting ? 'Creating...' : '+ Create Section'}
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
    paddingVertical: 6,
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
    paddingVertical: 8,
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
    fontSize: 13,
    letterSpacing: 0.1,
  },
  addTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 4,
  },
  addTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.xl,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 1.4,
    paddingVertical: 11,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
