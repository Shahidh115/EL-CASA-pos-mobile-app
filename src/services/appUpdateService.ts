import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export interface AppInfo {
  packageName: string
  versionName: string
  versionCode: number
}

export interface UpdateManifest {
  versionName: string
  versionCode: number
  apkUrl: string
  changelog?: string
  releaseDate?: string
  forceUpdate?: boolean
  fileSizeMb?: number
}

export interface CheckUpdateResult {
  hasUpdate: boolean
  currentVersion: AppInfo
  remoteManifest?: UpdateManifest
  error?: string
}

export interface DownloadProgress {
  percent: number
  bytesDownloaded: number
  totalBytes: number
}

// Native Plugin definition
interface ApkInstallerPluginInterface {
  getAppInfo(): Promise<AppInfo>
  canRequestPackageInstalls(): Promise<{ canInstall: boolean }>
  openInstallPermissionSettings(): Promise<void>
  installApk(options: { filePath: string }): Promise<{ success: boolean; filePath: string }>
  downloadAndInstall(options: { url: string; fileName?: string }): Promise<{ success: boolean; filePath: string }>
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (progress: DownloadProgress) => void
  ): Promise<{ remove: () => Promise<void> }>
}

const ApkInstaller = registerPlugin<ApkInstallerPluginInterface>('ApkInstaller')

const PREF_KEY_UPDATE_URL = 'elcasa_update_server_url'
// Default placeholder update endpoint - can be pointed to raw GitHub, custom server, or local LAN IP
export const DEFAULT_UPDATE_URL = 'https://raw.githubusercontent.com/shahidh115/elcasa-roms-android/master/version.json'

class AppUpdateService {
  /**
   * Retrieves current application package and version info
   */
  async getAppInfo(): Promise<AppInfo> {
    if (Capacitor.isNativePlatform()) {
      try {
        return await ApkInstaller.getAppInfo()
      } catch (err) {
        console.warn('Failed to get native app info:', err)
      }
    }
    // Web fallback
    return {
      packageName: 'com.elcasa.roms.pos',
      versionName: '1.0.0',
      versionCode: 1,
    }
  }

  /**
   * Gets the saved update manifest URL or default
   */
  async getUpdateUrl(): Promise<string> {
    try {
      const { value } = await Preferences.get({ key: PREF_KEY_UPDATE_URL })
      return value && value.trim().length > 0 ? value.trim() : DEFAULT_UPDATE_URL
    } catch {
      return DEFAULT_UPDATE_URL
    }
  }

  /**
   * Persists a custom update URL (e.g. for local Wi-Fi or custom server)
   */
  async setUpdateUrl(url: string): Promise<void> {
    await Preferences.set({
      key: PREF_KEY_UPDATE_URL,
      value: url.trim(),
    })
  }

  /**
   * Checks if an update is available by querying version.json
   */
  async checkForUpdates(customUrl?: string): Promise<CheckUpdateResult> {
    const current = await this.getAppInfo()
    const targetUrl = customUrl || (await this.getUpdateUrl())

    try {
      // Add cache buster to guarantee fresh check
      const cacheBuster = `${targetUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
      const response = await fetch(`${targetUrl}${cacheBuster}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Server returned status HTTP ${response.status}`)
      }

      const remote: UpdateManifest = await response.json()

      if (!remote || typeof remote.versionCode !== 'number') {
        throw new Error('Invalid version.json format: missing versionCode')
      }

      const hasUpdate = remote.versionCode > current.versionCode

      return {
        hasUpdate,
        currentVersion: current,
        remoteManifest: remote,
      }
    } catch (err: any) {
      return {
        hasUpdate: false,
        currentVersion: current,
        error: err.message || 'Unable to connect to update server',
      }
    }
  }

  /**
   * Checks if Android has granted permission to install packages from unknown sources
   */
  async canRequestPackageInstalls(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true
    try {
      const res = await ApkInstaller.canRequestPackageInstalls()
      return res.canInstall
    } catch {
      return true
    }
  }

  /**
   * Opens Android Settings to let the user toggle 'Install Unknown Apps' for EL CASA ROMS
   */
  async openInstallPermissionSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    await ApkInstaller.openInstallPermissionSettings()
  }

  /**
   * Downloads the remote APK with progress reporting and initiates native installation
   */
  async downloadAndInstall(
    apkUrl: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ success: boolean; filePath?: string }> {
    if (!Capacitor.isNativePlatform()) {
      // In web browser: trigger standard download link
      window.open(apkUrl, '_blank')
      return { success: true }
    }

    let progressListener: { remove: () => Promise<void> } | null = null

    try {
      if (onProgress) {
        progressListener = await ApkInstaller.addListener('downloadProgress', onProgress)
      }

      const result = await ApkInstaller.downloadAndInstall({
        url: apkUrl,
        fileName: 'elcasa_pos_update.apk',
      })

      return result
    } finally {
      if (progressListener) {
        await progressListener.remove()
      }
    }
  }

  /**
   * Installs an APK file from local storage
   */
  async installLocalApk(filePath: string): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      alert('Local APK installation is only supported on Android devices.')
      return false
    }
    const res = await ApkInstaller.installApk({ filePath })
    return res.success
  }
}

export const appUpdateService = new AppUpdateService()