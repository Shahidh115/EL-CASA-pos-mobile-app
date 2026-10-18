import { create } from 'zustand'
import type { PrinterConfig } from '@/types'

interface HardwareState {
  printerConfig: PrinterConfig
  setPrinterConfig: (config: Partial<PrinterConfig>) => void
}

const DEFAULT_CONFIG: PrinterConfig = {
  type: 'system',
  paperWidth: '80mm',
  targetAddress: '',
  port: 9100,
  autoCut: true,
  openCashDrawer: false,
  printLogo: false,
  copies: 1,
}

export const useHardwareStore = create<HardwareState>((set) => ({
  printerConfig: (() => {
    try {
      const saved = localStorage.getItem('elcasa_printer_cfg')
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  })(),
  setPrinterConfig: (newCfg) =>
    set((state) => {
      const updated = { ...state.printerConfig, ...newCfg }
      localStorage.setItem('elcasa_printer_cfg', JSON.stringify(updated))
      return { printerConfig: updated }
    }),
}))
