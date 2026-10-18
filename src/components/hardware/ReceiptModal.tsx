import React, { useState } from 'react'
import { Printer, Copy, Check, DollarSign, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Bill } from '@/types'
import { useSettings } from '@/hooks/useData'
import { useHardwareStore } from '@/stores/useHardwareStore'
import { printerService } from '@/hardware/printerService'
import { formatMoney, formatDateTime } from '@/lib/utils'
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
              onClick={() => setPrinterConfig({ paperWidth: '58mm' })}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${printerConfig.paperWidth === '58mm' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
            >
              58mm
            </button>
            <button
              onClick={() => setPrinterConfig({ paperWidth: '80mm' })}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${printerConfig.paperWidth === '80mm' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
            >
              80mm
            </button>
          </div>
        </DialogHeader>

        {/* Paper Receipt Simulation */}
        <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-amber-50 dark:bg-zinc-900 border font-mono text-xs text-zinc-800 dark:text-zinc-200 shadow-inner whitespace-pre leading-relaxed select-text">
          {textPreview}
        </div>

        {/* Hidden Printable layer for window.print() */}
        <div id="printable-receipt" className="hidden print:block font-mono text-xs">
          {textPreview}
        </div>

        {/* Footer actions */}
        <div className="pt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button onClick={handlePrint} disabled={printing} className="flex-1 gap-2 text-sm font-bold">
              <Printer className="size-4" />
              {printing ? 'Printing…' : 'Print Receipt'}
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
