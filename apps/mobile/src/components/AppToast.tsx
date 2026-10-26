import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore, ToastType } from '../store/useAppStore.js';

export const AppToast: React.FC = () => {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const topInset = Platform.OS === 'web'
    ? 16
    : Math.max(
        insets.top || 0,
        (Platform.OS === 'android' ? RNStatusBar.currentHeight : 0) || 0,
        40
      ) + 10;

  useEffect(() => {
    if (toast) {
      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 6,
          speed: 14,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 2.8 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 2800);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);
    }
  }, [toast?.id]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      hideToast();
    });
  };

  if (!toast) return null;

  const getStyleForType = (type: ToastType) => {
    switch (type) {
      case 'error':
        return {
          bg: isDarkMode ? '#450A0A' : '#FEF2F2',
          border: isDarkMode ? '#DC2626' : '#FECACA',
          text: isDarkMode ? '#FCA5A5' : '#991B1B',
          iconColor: '#EF4444',
          iconName: 'close-circle-outline' as const,
        };
      case 'warning':
        return {
          bg: isDarkMode ? '#451A03' : '#FFFBEB',
          border: isDarkMode ? '#D97706' : '#FDE68A',
          text: isDarkMode ? '#FCD34D' : '#92400E',
          iconColor: '#F59E0B',
          iconName: 'alert-circle-outline' as const,
        };
      case 'info':
        return {
          bg: isDarkMode ? '#1E3A8A' : '#EFF6FF',
          border: isDarkMode ? '#2563EB' : '#BFDBFE',
          text: isDarkMode ? '#93C5FD' : '#1E40AF',
          iconColor: '#3B82F6',
          iconName: 'information-outline' as const,
        };
      case 'success':
      default:
        return {
          bg: isDarkMode ? '#064E3B' : '#ECFDF5',
          border: isDarkMode ? '#059669' : '#A7F3D0',
          text: isDarkMode ? '#A7F3D0' : '#065F46',
          iconColor: '#10B981',
          iconName: 'check-circle' as const,
        };
    }
  };

  const currentStyle = getStyleForType(toast.type);

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          top: topInset,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[
          styles.toastCard,
          {
            backgroundColor: currentStyle.bg,
            borderColor: currentStyle.border,
          },
        ]}
        onPress={handleDismiss}
        activeOpacity={0.9}
      >
        <MaterialCommunityIcons
          name={currentStyle.iconName}
          size={22}
          color={currentStyle.iconColor}
        />
        <Text
          style={[styles.toastText, { color: currentStyle.text }]}
          numberOfLines={2}
        >
          {toast.message}
        </Text>
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name="close"
            size={16}
            color={currentStyle.text}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999999,
    elevation: 30,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 500,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 30,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
    marginRight: 8,
  },
  closeBtn: {
    padding: 2,
    opacity: 0.7,
  },
});
