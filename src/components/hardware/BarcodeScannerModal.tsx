import React, { useState, useEffect } from 'react'
import { Camera, Flashlight, X, Barcode, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { barcodeService } from '@/hardware/barcodeScanner'

interface BarcodeScannerModalProps {
  open: boolean
  onClose: () => void
  onDetected: (code: string) => void
}

export function BarcodeScannerModal({ open, onClose, onDetected }: BarcodeScannerModalProps) {
  const [torch, setTorch] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      barcodeService.startScan((res) => {
        setScannedFeedback(res.code)
        onDetected(res.code)
        setTimeout(() => {
          setScannedFeedback(null)
          onClose()
        }, 600)
      })
    } else {
      barcodeService.stopScan()
    }
    return () => {
      barcodeService.stopScan()
    }
  }, [open, onDetected, onClose])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    barcodeService.playBeep()
    barcodeService.vibrate()
    onDetected(manualCode.trim())
    setManualCode('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background">
        <div className="relative bg-black h-72 flex flex-col items-center justify-center overflow-hidden">
          {/* Animated targeting reticle */}
          <div className="relative size-52 border-2 border-primary/70 rounded-2xl flex items-center justify-center p-4">
            <div className="absolute inset-x-2 top-0 h-0.5 bg-emerald-400 animate-pulse shadow-[0_0_12px_#34d399]" />
            <div className="absolute top-2 left-2 size-4 border-t-2 border-l-2 border-emerald-400" />
            <div className="absolute top-2 right-2 size-4 border-t-2 border-r-2 border-emerald-400" />
            <div className="absolute bottom-2 left-2 size-4 border-b-2 border-l-2 border-emerald-400" />
            <div className="absolute bottom-2 right-2 size-4 border-b-2 border-r-2 border-emerald-400" />
            <Camera className="size-12 text-white/30" />
          </div>

          {scannedFeedback && (
            <div className="absolute inset-0 bg-emerald-600/80 flex flex-col items-center justify-center text-white backdrop-blur-xs animate-in fade-in">
              <CheckCircle2 className="size-16 animate-bounce" />
              <div className="mt-2 text-lg font-bold">Scanned: {scannedFeedback}</div>
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-4 right-4 size-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Scan Barcode / QR</h3>
              <p className="text-xs text-muted-foreground">Align barcode inside the camera reticle</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTorch(!torch)}
              className="gap-1.5"
            >
              <Flashlight className="size-4" />
              {torch ? 'Flash On' : 'Flash Off'}
            </Button>
          </div>

          <form onSubmit={handleManualSubmit} className="pt-2 border-t flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Or enter barcode manually…"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Button type="submit" size="default">Add</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
