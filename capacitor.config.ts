import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.elcasa.roms.pos',
  appName: 'EL CASA POS',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      iosKeychainPrefix: 'elcasa-roms',
      iosBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric login'
      },
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric login'
      }
    }
  },
  server: {
    androidScheme: 'https'
  }
}

export default config
