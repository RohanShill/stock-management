import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { getDatabase } from '../src/database/db.js';
import { SyncEngine } from '../src/sync/SyncEngine.js';
import { useAppStore } from '../src/store/useAppStore.js';
import { colors } from '../src/theme/tokens.js';
import { DemoBanner } from '../src/demo/DemoBanner.js';

const queryClient = new QueryClient();

// Clean, calm, professional light theme for hardware store operations
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    secondary: colors.accent,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceSubtle,
    outline: colors.border,
    error: colors.danger,
  },
};

export default function RootLayout() {
  const setPendingSyncCount = useAppStore((s) => s.setPendingSyncCount);
  const setLastSyncTime = useAppStore((s) => s.setLastSyncTime);

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
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <DemoBanner />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.surface,
            },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
            },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
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
