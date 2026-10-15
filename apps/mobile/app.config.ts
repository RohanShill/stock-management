import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const isDemo =
    process.env.APP_ENV === 'demo' ||
    process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

  const appName = isDemo
    ? 'Hardware Store (Demo)'
    : 'Manju Store Management Beta v1.0';

  const appSlug = isDemo
    ? 'hardware-store-demo'
    : 'manju-store-management';

  const appId = isDemo
    ? 'com.hardwarestore.manager.demo'
    : 'com.hardwarestore.manager';

  const appScheme = isDemo
    ? 'hardwarestore-demo'
    : 'hardwarestore';

  return {
    ...config,
    name: appName,
    slug: appSlug,
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: appScheme,
    newArchEnabled: true,
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1E293B',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: appId,
    },
    android: {
      package: appId,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1E293B',
      },
      permissions: [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      'expo-secure-store',
    ],
    owner: 'rohanshill',
    extra: {
      isDemo,
      demoLabel: 'DEMO VERSION — SAMPLE DATA',
      eas: {
        projectId: 'ab7f1827-dcd3-4af4-8992-24636fb90ffc',
      },
    },
  };
};
