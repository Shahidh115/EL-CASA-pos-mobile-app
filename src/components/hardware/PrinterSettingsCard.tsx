import React from 'react'
import { Printer, CheckCircle, Wifi, Bluetooth, Monitor } from 'lucide-react'
import { toast } from 'sonner'
import { useHardwareStore } from '@/stores/useHardwareStore'
import { printerService } from '@/hardware/printerService'
import { useSettings } from '@/hooks/useData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function PrinterSettingsCard() {
  const { data: settings } = useSettings()
  const { printerConfig, setPrinterConfig } = useHardwareStore()

  const handleTestPrint = async () => {
    const testBill = printerService.generateTestReceipt()
    try {
      const res = await printerService.printReceipt(testBill, settings || ({} as any), printerConfig)
      if (res.success) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } catch (e: any) {
      toast.error('Test print failed: ' + e.message)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="size-5 text-primary" />
          Hardware & Thermal Printer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Connection Protocol</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPrinterConfig({ type: 'system' })}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${printerConfig.type === 'system' ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-accent text-muted-foreground'}`}
            >
              <Monitor className="size-5" />
              System Print
            </button>
            <button
              type="button"
              onClick={() => setPrinterConfig({ type: 'bluetooth' })}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${printerConfig.type === 'bluetooth' ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-accent text-muted-foreground'}`}
            >
              <Bluetooth className="size-5" />
              Bluetooth
            </button>
            <button
              type="button"
              onClick={() => setPrinterConfig({ type: 'network' })}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${printerConfig.type === 'network' ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-accent text-muted-foreground'}`}
            >
              <Wifi className="size-5" />
              Network (TCP)
            </button>
          </div>
        </div>

        {printerConfig.type === 'network' && (
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Printer IP Address</label>
              <Input
                placeholder="e.g. 192.168.1.100"
                value={printerConfig.targetAddress || ''}
                onChange={(e) => setPrinterConfig({ targetAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Port</label>
              <Input
                placeholder="9100"
                value={printerConfig.port || 9100}
                onChange={(e) => setPrinterConfig({ port: Number(e.target.value) || 9100 })}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Paper Size</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPrinterConfig({ paperWidth: '58mm' })}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border ${printerConfig.paperWidth === '58mm' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
              >
                58mm (2 Inch)
              </button>
              <button
                type="button"
                onClick={() => setPrinterConfig({ paperWidth: '80mm' })}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border ${printerConfig.paperWidth === '80mm' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
              >
                80mm (3 Inch)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Automations</label>
            <div className="space-y-1.5 text-xs">
                            <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printerConfig.printLogo ?? true}
                  onChange={(e) => setPrinterConfig({ printLogo: e.target.checked })}
                  className="rounded border"
                />
                Print Shop Logo on Receipts
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printerConfig.autoCut}
                  onChange={(e) => setPrinterConfig({ autoCut: e.target.checked })}
                  className="rounded border"
                />
                Auto Cut Paper
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printerConfig.openCashDrawer}
                  onChange={(e) => setPrinterConfig({ openCashDrawer: e.target.checked })}
                  className="rounded border"
                />
                Kick Cash Drawer on Checkout
              </label>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button type="button" variant="outline" onClick={handleTestPrint} className="gap-2">
            <Printer className="size-4" />
            Send Test Print
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
