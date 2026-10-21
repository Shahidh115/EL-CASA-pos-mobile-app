import React, { useState } from 'react'
import { Printer, Copy, Check, DollarSign, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Bill } from '@/types'
import { useSettings } from '@/hooks/useData'
import { useHardwareStore } from '@/stores/useHardwareStore'
import { printerService } from '@/hardware/printerService'
import { formatMoney, formatDateTime } from '@/lib/utils'
import { DEFAULT_EL_CASA_LOGO } from '@/lib/defaultLogo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

interface ReceiptModalProps {
  bill: Bill | null
  open: boolean
  onClose: () => void
}

export function ReceiptModal({ bill, open, onClose }: ReceiptModalProps) {
  const { data: settings } = useSettings()
  const { printerConfig, setPrinterConfig } = useHardwareStore()
  const [copied, setCopied] = useState(false)
  const [printing, setPrinting] = useState(false)

  if (!bill || !open) return null

  const currency = settings?.currency || 'Rs.'
  const textPreview = printerService.formatReceiptText(bill, settings || ({} as any), printerConfig.paperWidth)
  const activeLogo = (settings?.logo_path && settings.logo_path.trim().length > 0) ? settings.logo_path : DEFAULT_EL_CASA_LOGO
  const showLogo = (printerConfig.printLogo ?? true) && Boolean(activeLogo)

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const res = await printerService.printReceipt(bill, settings || ({} as any), printerConfig)
      if (res.success) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } catch (err: any) {
      toast.error('Print failed: ' + (err.message || 'Unknown error'))
    } finally {
      setPrinting(false)
    }
  }

  const handleCopyText = () => {
    navigator.clipboard.writeText(textPreview)
    setCopied(true)
    toast.success('Receipt text copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDrawerKick = async () => {
    await printerService.openCashDrawer()
    toast.success('Cash drawer trigger pulse sent')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-6 max-h-[92vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Thermal Receipt</DialogTitle>
            <p className="text-xs text-muted-foreground">Invoice #{bill.invoice_number}</p>
          </div>
          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setPrinterConfig({ printLogo: !(printerConfig.printLogo ?? true) })}
              className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${(printerConfig.printLogo ?? true) ? 'bg-[#00447c] text-white shadow-xs font-bold' : 'text-muted-foreground'}`}
              title="Toggle Shop Logo on Receipt"
            >
              Logo: {(printerConfig.printLogo ?? true) ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setPrinterConfig({ paperWidth: '58mm' })}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${printerConfig.paperWidth === '58mm' ? 'bg-[#00447c] text-white shadow-xs font-bold' : 'text-muted-foreground'}`}
            >
              58mm
            </button>
            <button
              onClick={() => setPrinterConfig({ paperWidth: '80mm' })}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${printerConfig.paperWidth === '80mm' ? 'bg-[#00447c] text-white shadow-xs font-bold' : 'text-muted-foreground'}`}
            >
              80mm
            </button>
          </div>
        </DialogHeader>

        {/* Paper Receipt Simulation */}
        <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-[#dddace] border border-[#c6c3b6] font-mono text-xs text-[#0c0c0c] shadow-sm shadow-inner leading-relaxed select-text">
          {showLogo && (
            <div className="flex justify-center pb-3 mb-3 border-b border-[#c6c3b6] border-dashed">
              <img
                src={activeLogo}
                alt="Shop Logo"
                className="max-h-16 max-w-[200px] object-contain filter grayscale contrast-125"
              />
            </div>
          )}
          <div className="whitespace-pre">{textPreview}</div>
        </div>

        {/* Hidden Printable layer for window.print() */}
        <div id="printable-receipt" className="hidden print:block font-mono text-xs">
          {showLogo && (
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <img
                src={activeLogo}
                alt="Shop Logo"
                style={{
                  maxHeight: '65px',
                  maxWidth: printerConfig.paperWidth === '58mm' ? '140px' : '220px',
                  margin: '0 auto',
                  display: 'block',
                  
                }}
              />
            </div>
          )}
          <pre style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre' }}>{textPreview}</pre>
        </div>

        {/* Footer actions */}
        <div className="pt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button onClick={handlePrint} disabled={printing} className="flex-1 gap-2 text-sm font-bold">
              <Printer className="size-4" />
              {printing ? 'Printingâ€¦' : 'Print Receipt'}
            </Button>
            <Button variant="outline" size="icon" onClick={handleDrawerKick} title="Open Cash Drawer">
              <DollarSign className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleCopyText} title="Copy Text">
              {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
