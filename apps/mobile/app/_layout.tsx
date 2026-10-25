import React, { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { MD3LightTheme, MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
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

  useEffect(() => {
    // Initialize SQLite database
    getDatabase().catch((err) => {
      console.error('Failed to initialize SQLite database:', err);
    });

    // Subscribe to synchronization status
    const unsubscribe = SyncEngine.subscribe((status) => {
      setPendingSyncCount(status.pendingCount);
      setLastSyncTime(status.lastSyncTime);
    });

    return unsubscribe;
  }, []);

  return (
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
      </PaperProvider>
    </QueryClientProvider>
  );
}

