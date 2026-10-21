import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, Save, Download, Upload, RotateCcw, ShieldCheck, Database } from 'lucide-react'
import { toast } from 'sonner'
import { api, unwrap } from '@/lib/api'
import { useSettings } from '@/hooks/useData'
import { localBackupService } from '@/services/localBackupService'
import { db } from '@/db/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingBlock, AppUpdateCard } from '@/components/shared'
import { PrinterSettingsCard } from '@/components/hardware/PrinterSettingsCard'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useSettings()

  // Form states
  const [name, setName] = useState(settings?.restaurant_name || 'EL CASA')
  const [address, setAddress] = useState(settings?.address || '')
  const [phone, setPhone] = useState(settings?.phone || '')
  const [header, setHeader] = useState(settings?.receipt_header || '')
  const [footer, setFooter] = useState(settings?.receipt_footer || '')
  const [currency, setCurrency] = useState(settings?.currency || 'Rs.')
  const [taxRate, setTaxRate] = useState(String(settings?.tax_rate || '0'))
  const [prefix, setPrefix] = useState(settings?.invoice_prefix || 'INV')

  // Logo upload
  const [logoBase64, setLogoBase64] = useState<string | null>(null)

  React.useEffect(() => {
    if (settings) {
      if (settings.restaurant_name) setName(settings.restaurant_name)
      if (settings.address) setAddress(settings.address)
      if (settings.phone) setPhone(settings.phone)
      if (settings.receipt_header) setHeader(settings.receipt_header)
      if (settings.receipt_footer) setFooter(settings.receipt_footer)
      if (settings.currency) setCurrency(settings.currency)
      if (settings.tax_rate !== undefined) setTaxRate(String(settings.tax_rate))
      if (settings.invoice_prefix) setPrefix(settings.invoice_prefix)
      if (settings.logo_path) setLogoBase64(settings.logo_path)
    }
  }, [settings])

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        restaurant_name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        receipt_header: header.trim(),
        receipt_footer: footer.trim(),
        currency: currency.trim(),
        tax_rate: parseFloat(taxRate) || 0,
        invoice_prefix: prefix.trim(),
        logo_path: logoBase64 !== null ? logoBase64 : (settings?.logo_path || ''),
      }
      return unwrap(api.put('/settings', payload))
    },
    onSuccess: () => {
      toast.success('Restaurant settings saved successfully')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Export JSON Backup
  const handleExportBackup = async () => {
    try {
      const json = await localBackupService.exportBackup()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `elcasa-roms-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup file exported successfully')
    } catch (e: any) {
      toast.error('Export failed: ' + e.message)
    }
  }

  // Import JSON Backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string
        if (confirm('Restore backup? This will replace all current database records with the backup file data.')) {
          const res = await localBackupService.importBackup(text)
          toast.success(res.message)
          queryClient.invalidateQueries()
        }
      } catch (err: any) {
        toast.error('Restore failed: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  // Handle Logo file select with instant auto-save
  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string
      setLogoBase64(base64)
      try {
        await unwrap(api.put('/settings', { logo_path: base64 }))
        queryClient.invalidateQueries({ queryKey: ['settings'] })
        queryClient.invalidateQueries({ queryKey: ['pos-data'] })
        toast.success('Shop logo uploaded and saved to database!')
      } catch (err: any) {
        toast.error('Failed to save logo: ' + err.message)
      }
    }
    reader.readAsDataURL(file)
  }

  // Handle Logo removal with instant auto-save
  const handleRemoveLogo = async () => {
    setLogoBase64('')
    try {
      await unwrap(api.put('/settings', { logo_path: '' }))
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
      toast.info('Custom logo removed. Default logo will be used.')
    } catch (err: any) {
      toast.error('Failed to remove logo: ' + err.message)
    }
  }

  // Clear All Data handler
  const handleClearData = async () => {
    if (confirm('WARNING: This will permanently delete all local database records (bills, menu items, categories, resources, etc.). Are you sure?')) {
      try {
        await db.clearAllData()
        toast.success('All local database records cleared successfully')
        queryClient.invalidateQueries()
      } catch (e: any) {
        toast.error('Failed to clear data: ' + e.message)
      }
    }
  }

  if (isLoading) return <LoadingBlock label="Loading settingsâ€¦" />

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Restaurant Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-primary" />
            Restaurant Profile & Receipt Layout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveSettingsMutation.mutate()
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Restaurant Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Phone / Hotline</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Address</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Currency Symbol</label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tax Rate (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Invoice Prefix</label>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} required />
              </div>

              <div className="sm:col-span-2 p-3 rounded-xl bg-background/50 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground block">Shop / Restaurant Logo (Printed on Bills)</label>
                  {logoBase64 && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-xs text-destructive hover:underline font-medium"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                {logoBase64 ? (
                  <div className="flex items-center gap-4 p-2 bg-white rounded-lg border border-border/80 w-fit">
                    <img
                      src={logoBase64}
                      alt="Current Shop Logo"
                      className="max-h-14 max-w-[160px] object-contain"
                    />
                    <div className="text-[11px] text-zinc-600 font-medium">
                      Logo active & will be printed on receipts.
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    No logo currently uploaded. Upload a black & white or transparent PNG/JPEG to print on customer receipts.
                  </p>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFile}
                  className="w-full text-xs text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Receipt Header Greeting</label>
                <Input value={header} onChange={(e) => setHeader(e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Receipt Footer Message</label>
                <Input value={footer} onChange={(e) => setFooter(e.target.value)} />
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t">
              <Button type="submit" disabled={saveSettingsMutation.isPending} className="gap-2 font-bold">
                <Save className="size-4" /> Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Hardware Printer Settings */}
      <PrinterSettingsCard />

      {/* In-App Auto-Updater */}
      <AppUpdateCard />

      {/* Local SQLite Database & Backup/Restore Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5 text-primary" />
            Local SQLite Database & Offline Backups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            All business data is stored locally in SQLite on your Android device. Export encrypted or JSON backups
            to safeguard against hardware loss or transfer to another device.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleExportBackup} className="gap-2">
              <Download className="size-4" /> Export Backup (.JSON)
            </Button>

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                <Upload className="size-4" /> Restore Backup (.JSON)
              </span>
            </label>
          </div>

          <div className="pt-4 border-t border-destructive/20 mt-4">
            <h3 className="text-xs font-bold text-destructive uppercase tracking-wider mb-2">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Clear all operational data, bills, menu items, and inventory records from the local SQLite database.
            </p>
            <Button type="button" variant="destructive" onClick={handleClearData} className="gap-2">
              <RotateCcw className="size-4" /> Clear All Database Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
