import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/useAppStore.js';
import { t } from '../../src/i18n/strings.js';
import { lightColors, darkColors, getThemeShadows } from '../../src/theme/tokens.js';

export default function TabLayout() {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const language = useAppStore((s) => s.language);
  const insets = useSafeAreaInsets();

  const activeColors = isDarkMode ? darkColors : lightColors;
  const themeShadows = getThemeShadows(isDarkMode);

  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;
  const tabHeight = 56 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: activeColors.surface,
          borderTopColor: activeColors.border,
          borderTopWidth: 0.5,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          ...themeShadows.floating,
        },
        tabBarActiveTintColor: activeColors.primary,
        tabBarInactiveTintColor: activeColors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: activeColors.surface,
          ...themeShadows.card,
        },
        headerTintColor: activeColors.textPrimary,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          letterSpacing: -0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'home' : 'home-outline'}
              size={focused ? 26 : 24}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'package-variant' : 'package-variant-closed'}
              size={focused ? 26 : 24}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          href: null,
          title: 'Sales',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="purchases"
        options={{
          href: null,
          title: 'Purchases',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'history' : 'history'}
              size={focused ? 26 : 24}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'cog' : 'cog-outline'}
              size={focused ? 26 : 24}
              color={typeof color === 'string' ? color : undefined}
            />
          ),
        }}
      />
    </Tabs>
  );
}
