/**
 * Demo Configuration & Isolation Boundary
 *
 * Enforces strict environment separation between production and client-evaluation demo builds.
 * Under Demo mode:
 * - App operates with fictional sample dataset
 * - Separate isolated SQLite database is used (hardware_store_demo.db)
 * - Cloud synchronization with production server/database is strictly blocked
 * - Top banner indicates "DEMO VERSION — SAMPLE DATA"
 */

export const DEMO_NOTICE_TEXT = 'DEMO VERSION — SAMPLE DATA';
export const DEMO_APP_NAME = 'Hardware Store (Demo)';
export const DEMO_APPLICATION_ID = 'com.hardwarestore.manager.demo';
export const DEMO_DB_NAME = 'hardware_store_demo.db';
export const DEMO_WEB_STORAGE_KEY = 'hw_store_demo_db_v1';

export function isDemoMode(): boolean {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
    return true;
  }
  if (process.env.APP_ENV === 'demo') {
    return true;
  }
  try {
    // Dynamic import to prevent crash in headless testing environments without expo globals
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants');
    const extra = Constants?.default?.expoConfig?.extra || Constants?.expoConfig?.extra;
    if (extra?.isDemo === true) {
      return true;
    }
  } catch {
    // Ignore if running outside Expo runtime
  }
  return false;
}
