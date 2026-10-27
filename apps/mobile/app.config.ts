import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'Manju Hardware Store',
    slug: 'manju-store-management',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'manjuhardware',
    newArchEnabled: true,
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1E293B',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.manjuhardware.store',
    },
    android: {
      package: 'com.manjuhardware.store',
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
      'expo-font',
    ],
    owner: 'rohanshill',
    extra: {
      eas: {
        projectId: 'ab7f1827-dcd3-4af4-8992-24636fb90ffc',
      },
    },
  };
};
