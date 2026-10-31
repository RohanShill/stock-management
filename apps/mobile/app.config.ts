import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'MANJU STORES',
    slug: 'manju-store-management',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'manjuhardware',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.manjuhardware.store',
    },
    android: {
      package: 'com.manjuhardware.store',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
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
      [
        'expo-build-properties',
        {
          android: {
            // Target real physical Android phones & tablets (64-bit ARM).
            // Completely excludes bloated x86 and x86_64 emulator binaries.
            buildArchs: process.env.REACT_NATIVE_ARCHITECTURES
              ? process.env.REACT_NATIVE_ARCHITECTURES.split(',').map((s: string) => s.trim())
              : ['arm64-v8a'],
            enablePngCrunchInReleaseBuilds: true,
          },
        },
      ],
    ],
    owner: 'rohanshill',
    extra: {
      eas: {
        projectId: 'ab7f1827-dcd3-4af4-8992-24636fb90ffc',
      },
    },
  };
};
