import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'ConceptCollision',
  slug: 'conceptcollision',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  android: {
    package: 'com.conceptcollision',
    versionCode: 1,
  },
  ios: {
    bundleIdentifier: 'com.conceptcollision',
    buildNumber: '1',
  },
  extra: {
    eas: {
      projectId: 'c6290a31-c1ee-4de3-81fc-2bf26c09f66b',
    },
  },
};

export default config;
