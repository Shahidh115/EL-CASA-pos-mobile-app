import React, { useState, useEffect } from 'react'
import {
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react'
import { appUpdateService, UpdateManifest, AppInfo, DownloadProgress } from '@/services/appUpdateService'
import { Button } from '@/components/ui/button'

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  currentVersion: AppInfo
  manifest: UpdateManifest
}

export function UpdateModal({ isOpen, onClose, currentVersion, manifest }: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress>({
    percent: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [canInstall, setCanInstall] = useState<boolean>(true)

  useEffect(() => {
    if (isOpen) {
      checkPermissions()
    }
  }, [isOpen])

  const checkPermissions = async () => {
    try {
      const allowed = await appUpdateService.canRequestPackageInstalls()
      setCanInstall(allowed)
    } catch {
      setCanInstall(true)
    }
  }

  if (!isOpen) return null

  const handleStartUpdate = async () => {
    setError(null)
    setDownloading(true)
    setProgress({ percent: 0, bytesDownloaded: 0, totalBytes: 0 })

    try {
      // Re-check install permission
      const allowed = await appUpdateService.canRequestPackageInstalls()
      if (!allowed) {
        setCanInstall(false)
      }

      await appUpdateService.downloadAndInstall(manifest.apkUrl, (prog) => {
        setProgress(prog)
        if (prog.percent >= 100) {
          setDownloading(false)
          setInstalling(true)
        }
      })

      setDownloading(false)
      setInstalling(true)
    } catch (err: any) {
      setDownloading(false)
      setInstalling(false)
      setError(err.message || 'Failed to download or install update')
    }
  }

  const handleOpenSettings = async () => {
    await appUpdateService.openInstallPermissionSettings()
    // Re-check after user returns from system settings
    setTimeout(checkPermissions, 1500)
  }

  const formatMb = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

        {/* Close Button (only if not forced and not downloading) */}
        {!manifest.forceUpdate && !downloading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30">
            <DownloadCloud className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              Update Available
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono font-semibold">
                v{manifest.versionName}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">EL CASA ROMS Offline POS</p>
          </div>
        </div>

        {/* Version Comparison Badge */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-background/60 border border-border/80 text-xs mb-4">
          <div className="text-center">
            <span className="text-[10px] uppercase text-muted-foreground block font-medium">Installed</span>
            <span className="font-mono font-bold text-foreground">v{currentVersion.versionName}</span>
            <span className="text-[10px] text-muted-foreground ml-1">({currentVersion.versionCode})</span>
          </div>

          <ArrowRight className="size-4 text-primary shrink-0" />

          <div className="text-center">
            <span className="text-[10px] uppercase text-primary block font-medium">New Release</span>
            <span className="font-mono font-bold text-primary">v{manifest.versionName}</span>
            <span className="text-[10px] text-muted-foreground ml-1">({manifest.versionCode})</span>
          </div>
        </div>

        {/* Unknown Apps Permission Warning */}
        {!canInstall && (
          <div className="p-3 mb-4 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-4 text-amber-400 shrink-0" />
              <span>Permission Needed for In-App Updates</span>
            </div>
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              Android requires permission to install APK updates downloaded from outside the Play Store.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenSettings}
              className="w-full text-xs border-amber-600/60 hover:bg-amber-600/20 text-amber-100"
            >
              Allow "Install Unknown Apps" in Settings
            </Button>
          </div>
        )}

        {/* Changelog Card */}
        {manifest.changelog && (
          <div className="mb-4">
            <span className="text-xs font-semibold text-muted-foreground block mb-1.5 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-accent" />
              What's New in this update:
            </span>
            <div className="p-3 rounded-xl bg-background/80 border border-border max-h-36 overflow-y-auto text-xs text-foreground/90 leading-relaxed whitespace-pre-line font-sans">
              {manifest.changelog}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Progress Display */}
        {downloading && (
          <div className="space-y-2 mb-4 p-3 rounded-xl bg-background/80 border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Downloading update...
              </span>
              <span className="font-mono font-bold text-primary">{progress.percent}%</span>
            </div>

            {/* Progress Track */}
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, progress.percent))}%` }}
              />
            </div>

            {progress.totalBytes > 0 && (
              <div className="text-[11px] text-muted-foreground text-right font-mono">
                {formatMb(progress.bytesDownloaded)} MB / {formatMb(progress.totalBytes)} MB
              </div>
            )}
          </div>
        )}

        {installing && (
          <div className="p-3 mb-4 rounded-xl bg-primary/10 border border-primary/30 text-xs text-foreground flex items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary shrink-0" />
            <div>
              <p className="font-semibold text-primary">Launching Android Installer...</p>
              <p className="text-[11px] text-muted-foreground">
                Please tap <strong>"Update"</strong> when Android prompts you. Your database is 100% safe.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {!manifest.forceUpdate && !downloading && !installing && (
            <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
              Later
            </Button>
          )}

          {!downloading && !installing && (
            <Button
              type="button"
              onClick={handleStartUpdate}
              className="gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-4"
            >
              <DownloadCloud className="size-4" />
              Download & Install Update
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}