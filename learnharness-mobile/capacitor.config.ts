import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.learnharness.mobile',
  appName: 'LearnHarness Mobile',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0d0d0d',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
