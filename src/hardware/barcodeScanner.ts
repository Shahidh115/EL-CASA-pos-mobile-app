import { Capacitor } from '@capacitor/core'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export interface BarcodeResult {
  code: string
  format?: string
}

class BarcodeScannerService {
  private isScanning = false

  public async checkPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true
    try {
      const { camera } = await BarcodeScanner.checkPermissions()
      if (camera === 'granted') return true
      const req = await BarcodeScanner.requestPermissions()
      return req.camera === 'granted'
    } catch {
      return true
    }
  }

  public async startScan(onDetected: (result: BarcodeResult) => void): Promise<void> {
    if (this.isScanning) return
    this.isScanning = true

    if (Capacitor.isNativePlatform()) {
      try {
        await BarcodeScanner.addListener('barcodesScanned', async (res: any) => {
          const barcode = res.barcodes?.[0]
          if (barcode) {
            this.playBeep()
            await this.vibrate()
            onDetected({ code: barcode.displayValue, format: barcode.format })
          }
        })
        await BarcodeScanner.startScan()
      } catch (err) {
        console.error('Native scan failed:', err)
        this.isScanning = false
      }
    }
  }

  public async stopScan(): Promise<void> {
    this.isScanning = false
    if (Capacitor.isNativePlatform()) {
      try {
        await BarcodeScanner.removeAllListeners()
        await BarcodeScanner.stopScan()
      } catch (e) {
        // Ignored
      }
    }
  }

  public async vibrate(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium })
    } catch {
      if (navigator.vibrate) navigator.vibrate(50)
    }
  }

  public playBeep(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1200, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch {
      // Audio not permitted without interaction
    }
  }
}

export const barcodeService = new BarcodeScannerService()
