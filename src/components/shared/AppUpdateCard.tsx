import React, { useState, useEffect } from 'react'
import {
  DownloadCloud,
  CheckCircle2,
  RefreshCw,
  Globe,
  HardDriveDownload,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  appUpdateService,
  AppInfo,
  UpdateManifest,
  DEFAULT_UPDATE_URL,
} from '@/services/appUpdateService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { UpdateModal } from './UpdateModal'

export function AppUpdateCard() {
  const [appInfo, setAppInfo] = useState<AppInfo>({
    packageName: 'com.elcasa.roms.pos',
    versionName: '1.0.0',
    versionCode: 1,
  })
  const [updateUrl, setUpdateUrl] = useState<string>(DEFAULT_UPDATE_URL)
  const [isChecking, setIsChecking] = useState<boolean>(false)
  const [isSavingUrl, setIsSavingUrl] = useState<boolean>(false)
  const [activeManifest, setActiveManifest] = useState<UpdateManifest | null>(null)
  const [showModal, setShowModal] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    loadInfo()
  }, [])

  const loadInfo = async () => {
    try {
      const [info, url] = await Promise.all([
        appUpdateService.getAppInfo(),
        appUpdateService.getUpdateUrl(),
      ])
      setAppInfo(info)
      setUpdateUrl(url)
    } catch (e: any) {
      console.warn('Error loading update card info:', e)
    }
  }

  const handleSaveUrl = async () => {
    if (!updateUrl.trim()) {
      toast.error('Update URL cannot be empty')
      return
    }
    setIsSavingUrl(true)
    try {
      await appUpdateService.setUpdateUrl(updateUrl.trim())
      toast.success('Update server URL saved')
    } catch (e: any) {
      toast.error('Failed to save update URL: ' + e.message)
    } finally {
      setIsSavingUrl(false)
    }
  }

  const handleResetUrl = async () => {
    setUpdateUrl(DEFAULT_UPDATE_URL)
    await appUpdateService.setUpdateUrl(DEFAULT_UPDATE_URL)
    toast.info('Reset update URL to default')
  }

  const handleCheckUpdate = async () => {
    setIsChecking(true)
    setStatusMessage(null)
    try {
      const res = await appUpdateService.checkForUpdates(updateUrl.trim())
      if (res.error) {
        toast.error(`Update check failed: ${res.error}`)
        setStatusMessage(`Check failed: ${res.error}`)
        return
      }

      if (res.hasUpdate && res.remoteManifest) {
        setActiveManifest(res.remoteManifest)
        setShowModal(true)
        setStatusMessage(`New version v${res.remoteManifest.versionName} is available!`)
      } else {
        toast.success(`You are running the latest version (v${appInfo.versionName})`)
        setStatusMessage('Your app is up to date.')
      }
    } catch (e: any) {
      toast.error('Error checking updates: ' + e.message)
      setStatusMessage('Error checking updates')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DownloadCloud className="size-5 text-primary" />
              <span>App Updates & In-App Auto-Updater</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono font-semibold">
              v{appInfo.versionName} (Build {appInfo.versionCode})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            EL CASA ROMS supports seamless offline and non-Play Store APK updates. When you release a new version,
            tap <strong>Check for Updates</strong> below to download and install with zero data loss to your local SQLite database.
          </p>

          {/* Quick Status and Check Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-background/60 border border-border">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Smartphone className="size-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Installed Build:</span>
                  <span className="font-mono text-primary font-bold">
                    v{appInfo.versionName} (Build {appInfo.versionCode})
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {statusMessage || 'Connect to Wi-Fi to scan for newer APK builds.'}
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleCheckUpdate}
              disabled={isChecking}
              className="gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90 text-xs shrink-0"
            >
              <RefreshCw className={`size-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Checking...' : 'Check for Updates'}
            </Button>
          </div>

          {/* Update Server Configuration */}
          <div className="pt-2 border-t border-border/60 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3.5 text-accent" />
                  Update Manifest URL (version.json)
                </span>
                <button
                  type="button"
                  onClick={handleResetUrl}
                  className="text-[10px] text-primary hover:underline"
                >
                  Reset Default
                </button>
              </label>
              <div className="flex gap-2">
                <Input
                  value={updateUrl}
                  onChange={(e) => setUpdateUrl(e.target.value)}
                  placeholder="https://.../version.json or http://192.168.1.100:8080/version.json"
                  className="text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveUrl}
                  disabled={isSavingUrl}
                  className="text-xs shrink-0"
                >
                  Save URL
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-background/40 border border-border/80 text-[11px] text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                <span>100% Offline SQLite Protection Guarantee</span>
              </div>
              <p>
                When an update is installed over this app, Android preserves all sales, bills, resources, and settings in your SQLite database. Just ensure new APK builds increment <code>versionCode</code> in <code>android/app/build.gradle</code>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Render Update Modal when active */}
      {activeManifest && (
        <UpdateModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          currentVersion={appInfo}
          manifest={activeManifest}
        />
      )}
    </>
  )
}