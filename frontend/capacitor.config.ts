import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.jotter.app',
  appName: 'Jotter',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'app',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0c0c10',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0c0c10',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
  },
  android: {
    backgroundColor: '#0c0c10',
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'scrollableAutomatically',
  },
}

export default config
