// Polyfill crypto.getRandomValues for React Native Hermes runtime
if (typeof globalThis !== 'undefined') {
  if (typeof (globalThis as any).crypto !== 'object') {
    (globalThis as any).crypto = {};
  }
  if (typeof (globalThis as any).crypto.getRandomValues !== 'function') {
    (globalThis as any).crypto.getRandomValues = function getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (!array) return array;
      const uint8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < uint8.length; i++) {
        uint8[i] = Math.floor(Math.random() * 256);
      }
      return array;
    };
  }
}

import React, { useState, useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';

// Keep the splash screen visible while app resources & database load
SplashScreen.preventAutoHideAsync().catch(() => {});
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToast } from '../src/components/AppToast.js';
import { AppConfirmModal } from '../src/components/AppConfirmModal.js';
import { getDatabase } from '../src/database/db.js';
import { SyncEngine } from '../src/sync/SyncEngine.js';
import { useAppStore } from '../src/store/useAppStore.js';
import { lightColors, darkColors } from '../src/theme/tokens.js';

const queryClient = new QueryClient();

export default function RootLayout() {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const setPendingSyncCount = useAppStore((s) => s.setPendingSyncCount);
  const setLastSyncTime = useAppStore((s) => s.setLastSyncTime);

  const activeColors = isDarkMode ? darkColors : lightColors;

  const paperTheme = useMemo(() => {
    const baseTheme = isDarkMode ? MD3DarkTheme : MD3LightTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: activeColors.primary,
        secondary: activeColors.accent,
        background: activeColors.background,
        surface: activeColors.surface,
        surfaceVariant: activeColors.surfaceSubtle,
        outline: activeColors.border,
        error: activeColors.danger,
      },
    };
  }, [isDarkMode, activeColors]);

  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      try {
        // Initialize SQLite database
        await getDatabase();
      } catch (err) {
        console.error('Failed to initialize SQLite database:', err);
      } finally {
        if (isMounted) {
          setAppIsReady(true);
        }
      }
    }

    initApp();

    // Subscribe to synchronization status
    const unsubscribe = SyncEngine.subscribe((status) => {
      setPendingSyncCount(status.pendingCount);
      setLastSyncTime(status.lastSyncTime);
    });

    // Failsafe timer so splash screen never hangs for more than 2.5 seconds
    const timer = setTimeout(() => {
      if (isMounted) {
        setAppIsReady(true);
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <StatusBar style={isDarkMode ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: activeColors.surface,
              },
              headerTintColor: activeColors.textPrimary,
              headerTitleStyle: {
                fontWeight: '700',
                fontSize: 18,
              },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: activeColors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ title: 'Store Login' }} />
            <Stack.Screen name="(auth)/register-store" options={{ title: 'Setup Hardware Store' }} />
            <Stack.Screen name="categories-management" options={{ title: 'Categories & Subcategories' }} />
            <Stack.Screen name="custom-fields" options={{ title: 'Custom Specifications' }} />
            <Stack.Screen name="catalogue-import" options={{ title: 'Bulk CSV Import' }} />
          </Stack>
          <AppToast />
          <AppConfirmModal />
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

