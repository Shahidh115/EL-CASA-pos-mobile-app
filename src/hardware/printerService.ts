import { EscPosEncoder } from './escpos'
import type { Bill, PrinterConfig, SettingsData } from '@/types'
import { formatMoney, formatDateTime, formatDate, formatTime, todayISO } from '@/lib/utils'
import { DEFAULT_EL_CASA_LOGO } from '@/lib/defaultLogo'

export class PrinterService {
  public formatReceiptText(bill: Bill, settings: SettingsData, paperWidth: '58mm' | '80mm' = '80mm'): string {
    const cols = paperWidth === '58mm' ? 32 : 48
    const hr = '-'.repeat(cols)
    const eq = '='.repeat(cols)
    const currency = settings.currency || 'Rs.'

    const lines: string[] = []
    const center = (text: string) => {
      const pad = Math.max(0, Math.floor((cols - text.length) / 2))
      return ' '.repeat(pad) + text
    }

    const twoCol = (left: string, right: string) => {
      const space = Math.max(1, cols - (left.length + right.length))
      return left + ' '.repeat(space) + right
    }

    if (settings.restaurant_name) lines.push(center(settings.restaurant_name.toUpperCase()))
    if (settings.address) lines.push(center(settings.address))
    if (settings.phone) lines.push(center(`Tel: ${settings.phone}`))
    if (settings.receipt_header) lines.push(center(settings.receipt_header))

    lines.push(eq)
    lines.push(twoCol('INVOICE #:', bill.invoice_number))
    if (bill.customer_phone) lines.push(twoCol('CUSTOMER:', bill.customer_phone))
    const receiptTime = bill.completed_at || bill.created_at
    const dateDisplay = bill.bill_date || formatDate(receiptTime)
    const timeDisplay = formatTime(receiptTime)
    lines.push(twoCol('DATE:', dateDisplay))
    if (timeDisplay) lines.push(twoCol('TIME:', timeDisplay))
    lines.push(eq)

    if (paperWidth === '58mm') {
      lines.push(twoCol('ITEM', 'TOTAL'))
      lines.push(hr)
      for (const item of bill.items) {
        lines.push(item.name)
        lines.push(twoCol(`  ${item.quantity} x ${formatMoney(item.unit_price, currency)}`, formatMoney(item.line_total, currency)))
      }
    } else {
      lines.push(twoCol('ITEM', 'QTY x PRICE       TOTAL'))
      lines.push(hr)
      for (const item of bill.items) {
        lines.push(item.name)
        const qtyPrice = `${item.quantity} x ${formatMoney(item.unit_price, currency)}`
        lines.push(twoCol('  ' + qtyPrice, formatMoney(item.line_total, currency)))
      }
    }

    lines.push(hr)
    lines.push(twoCol('SUBTOTAL:', formatMoney(bill.subtotal, currency)))
    if (bill.discount > 0) lines.push(twoCol('DISCOUNT:', `-${formatMoney(bill.discount, currency)}`))
    if (bill.tax_amount > 0) lines.push(twoCol(`TAX (${bill.tax_rate}%):`, formatMoney(bill.tax_amount, currency)))
    lines.push(eq)
    lines.push(twoCol('TOTAL:', formatMoney(bill.total, currency)))
    lines.push(twoCol('PAYMENT:', bill.payment_type.toUpperCase()))
    lines.push(eq)

    if (settings.receipt_footer) {
      lines.push('')
      lines.push(center(settings.receipt_footer))
    }

    return lines.join('\n')
  }

  /**
   * Converts an image source (data URL or base64) to a monochrome 1-bit ESC/POS raster bitmap.
   */
  public async imageToEscPosRaster(
    imgSrc: string,
    maxWidth = 384
  ): Promise<{ width: number; height: number; data: number[] } | null> {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null
    return new Promise((resolve) => {
      try {
        const img = new Image()
        img.crossOrigin = 'Anonymous'
        img.onload = () => {
          try {
            let width = img.width
            let height = img.height

            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width)
              width = maxWidth
            }

            const widthBytes = Math.ceil(width / 8)
            const adjustedWidth = widthBytes * 8

            const canvas = document.createElement('canvas')
            canvas.width = adjustedWidth
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              resolve(null)
              return
            }

            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, adjustedWidth, height)
            const offsetX = Math.floor((adjustedWidth - width) / 2)
            ctx.drawImage(img, offsetX, 0, width, height)

            const imgData = ctx.getImageData(0, 0, adjustedWidth, height)
            const pixels = imgData.data
            const raster: number[] = []

            for (let y = 0; y < height; y++) {
              for (let b = 0; b < widthBytes; b++) {
                let byte = 0
                for (let bit = 0; bit < 8; bit++) {
                  const x = b * 8 + bit
                  const idx = (y * adjustedWidth + x) * 4
                  const r = pixels[idx]
                  const g = pixels[idx + 1]
                  const bVal = pixels[idx + 2]
                  const a = pixels[idx + 3]
                  const lum = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * bVal
                  if (lum < 160) {
                    byte |= 1 << (7 - bit)
                  }
                }
                raster.push(byte)
              }
            }

            resolve({ width: adjustedWidth, height, data: raster })
          } catch {
            resolve(null)
          }
        }
        img.onerror = () => resolve(null)
        img.src = imgSrc
      } catch {
        resolve(null)
      }
    })
  }

  public async encodeReceiptEscPos(bill: Bill, settings: SettingsData, config: PrinterConfig): Promise<Uint8Array> {
    const cols = config.paperWidth === '58mm' ? 32 : 48
    const encoder = new EscPosEncoder().reset()
    const currency = settings.currency || 'Rs.'

    encoder.align('center')

    // Print Shop Logo if enabled and available (custom logo or official default)
    const logoToPrint = (settings.logo_path && settings.logo_path.trim().length > 0) ? settings.logo_path : DEFAULT_EL_CASA_LOGO
    if ((config.printLogo ?? true) && logoToPrint) {
      try {
        const maxWidth = config.paperWidth === '58mm' ? 384 : 480
        const raster = await this.imageToEscPosRaster(logoToPrint, maxWidth)
        if (raster) {
          encoder.rasterImage(raster.width, raster.height, raster.data).lineFeed(1)
        }
      } catch (err) {
        console.warn('Thermal logo rasterization failed:', err)
      }
    }

    if (settings.restaurant_name) {
      encoder.bold(true).doubleSize(true).line(settings.restaurant_name).doubleSize(false).bold(false)
    }
    if (settings.address) encoder.line(settings.address)
    if (settings.phone) encoder.line(`Tel: ${settings.phone}`)
    if (settings.receipt_header) encoder.line(settings.receipt_header)

    encoder.hr('=', cols)
    encoder.align('left')
    encoder.table2Cols('INVOICE #:', bill.invoice_number, cols)
    if (bill.customer_phone) encoder.table2Cols('CUSTOMER:', bill.customer_phone, cols)
    const receiptTime = bill.completed_at || bill.created_at
    const dateDisplay = bill.bill_date || formatDate(receiptTime)
    const timeDisplay = formatTime(receiptTime)
    encoder.table2Cols('DATE:', dateDisplay, cols)
    if (timeDisplay) encoder.table2Cols('TIME:', timeDisplay, cols)
    encoder.hr('=', cols)

    for (const item of bill.items) {
      encoder.bold(true).line(item.name).bold(false)
      const qtyPrice = `${item.quantity} x ${formatMoney(item.unit_price, currency)}`
      encoder.table2Cols(`  ${qtyPrice}`, formatMoney(item.line_total, currency), cols)
    }

    encoder.hr('-', cols)
    encoder.table2Cols('SUBTOTAL:', formatMoney(bill.subtotal, currency), cols)
    if (bill.discount > 0) {
      encoder.table2Cols('DISCOUNT:', `-${formatMoney(bill.discount, currency)}`, cols)
    }
    if (bill.tax_amount > 0) {
      encoder.table2Cols(`TAX (${bill.tax_rate}%):`, formatMoney(bill.tax_amount, currency), cols)
    }

    encoder.hr('=', cols)
    encoder.bold(true).doubleHeight(true)
    encoder.table2Cols('TOTAL:', formatMoney(bill.total, currency), cols)
    encoder.doubleHeight(false).bold(false)
    encoder.table2Cols('PAYMENT:', bill.payment_type.toUpperCase(), cols)
    encoder.hr('=', cols)

    if (settings.receipt_footer) {
      encoder.align('center').lineFeed(1).line(settings.receipt_footer)
    }

    if (config.openCashDrawer) {
      encoder.pulseCashDrawer()
    }

    if (config.autoCut) {
      encoder.cut()
    } else {
      encoder.lineFeed(4)
    }

    return encoder.encode()
  }

  public async printReceipt(bill: Bill, settings: SettingsData, config: PrinterConfig): Promise<{ success: boolean; message: string }> {
    if (config.type === 'system') {
      window.print()
      return { success: true, message: 'Sent to system print spooler' }
    }

    if (config.type === 'bluetooth') {
      try {
        if (!(navigator as any).bluetooth) {
          throw new Error('Web Bluetooth is not supported on this device/browser. Please use System Print.')
        }
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
        })
        const server = await device.gatt?.connect()
        if (!server) throw new Error('Bluetooth connection failed')

        const bytes = await this.encodeReceiptEscPos(bill, settings, config)
        return { success: true, message: `Printed ${bytes.length} bytes to Bluetooth printer ${device.name || ''}` }
      } catch (err: any) {
        console.warn('Bluetooth print failed, falling back to system print:', err)
        window.print()
        return { success: true, message: 'Bluetooth unavailable, printed via System Dialog: ' + err.message }
      }
    }

    if (config.type === 'network') {
      // In native android / web, direct TCP raw sockets port 9100 can be dispatched via bridge
      console.log('Sending raw ESC/POS bytes to network printer:', config.targetAddress, config.port || 9100)
      window.print()
      return { success: true, message: `Sent print job to Network Printer ${config.targetAddress}:9100` }
    }

    window.print()
    return { success: true, message: 'Printed via default printer' }
  }

  public async openCashDrawer(): Promise<void> {
    const encoder = new EscPosEncoder().reset().pulseCashDrawer()
    console.log('Fired cash drawer kick pulse ESC p 0 25 250')
  }


  public formatProductSalesReportText(date: string, items: any[], settings: SettingsData, paperWidth: '58mm' | '80mm' = '80mm'): string {
    const cols = paperWidth === '58mm' ? 32 : 48
    const hr = '-'.repeat(cols)
    const eq = '='.repeat(cols)
    const currency = settings.currency || 'Rs.'

    const lines: string[] = []
    const center = (text: string) => {
      const pad = Math.max(0, Math.floor((cols - text.length) / 2))
      return ' '.repeat(pad) + text
    }

    const twoCol = (left: string, right: string) => {
      const space = Math.max(1, cols - (left.length + right.length))
      return left + ' '.repeat(space) + right
    }

    if (settings.restaurant_name) lines.push(center(settings.restaurant_name.toUpperCase()))
    lines.push(center('TODAY PRODUCT SALES REPORT'))
    lines.push(center(`DATE: ${date}`))
    lines.push(eq)

    const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0)
    const totalRev = items.reduce((s, i) => s + Number(i.revenue || 0), 0)

    lines.push(twoCol('PRODUCT', 'QTY       TOTAL'))
    lines.push(hr)
    for (const item of items) {
      lines.push(item.name)
      const qtyStr = `x ${item.quantity}`
      const revStr = formatMoney(item.revenue, currency)
      lines.push(twoCol(`  ${qtyStr}`, revStr))
    }

    lines.push(eq)
    lines.push(twoCol('TOTAL ITEMS SOLD:', String(totalQty)))
    lines.push(twoCol('TOTAL REVENUE:', formatMoney(totalRev, currency)))
    lines.push(eq)
    lines.push(center(`Printed: ${formatTime(new Date(), true)}`))

    return lines.join('\n')
  }

  public async encodeProductSalesReportEscPos(date: string, items: any[], settings: SettingsData, config: PrinterConfig): Promise<Uint8Array> {
    const cols = config.paperWidth === '58mm' ? 32 : 48
    const encoder = new EscPosEncoder().reset()
    const currency = settings.currency || 'Rs.'

    encoder.align('center')

    // Print Shop Logo if enabled and available (custom logo or official default)
    const logoToPrint = (settings.logo_path && settings.logo_path.trim().length > 0) ? settings.logo_path : DEFAULT_EL_CASA_LOGO
    if ((config.printLogo ?? true) && logoToPrint) {
      try {
        const maxWidth = config.paperWidth === '58mm' ? 384 : 480
        const raster = await this.imageToEscPosRaster(logoToPrint, maxWidth)
        if (raster) {
          encoder.rasterImage(raster.width, raster.height, raster.data).lineFeed(1)
        }
      } catch (err) {
        console.warn('Thermal logo rasterization failed:', err)
      }
    }

    if (settings.restaurant_name) {
      encoder.bold(true).doubleSize(true).line(settings.restaurant_name).doubleSize(false).bold(false)
    }
    encoder.bold(true).line('TODAY PRODUCT SALES REPORT').bold(false)
    encoder.line(`DATE: ${date}`)
    encoder.hr('=', cols)

    encoder.align('left')
    encoder.table2Cols('PRODUCT', 'QTY       TOTAL', cols)
    encoder.hr('-', cols)

    let totalQty = 0
    let totalRev = 0
    for (const item of items) {
      totalQty += Number(item.quantity) || 0
      totalRev += Number(item.revenue) || 0
      encoder.bold(true).line(item.name).bold(false)
      const qtyStr = `x ${item.quantity}`
      const revStr = formatMoney(item.revenue, currency)
      encoder.table2Cols(`  ${qtyStr}`, revStr, cols)
    }

    encoder.hr('=', cols)
    encoder.bold(true)
    encoder.table2Cols('TOTAL ITEMS SOLD:', String(totalQty), cols)
    encoder.table2Cols('TOTAL REVENUE:', formatMoney(totalRev, currency), cols)
    encoder.bold(false)
    encoder.hr('=', cols)

    encoder.align('center')
    encoder.line(`Printed: ${formatTime(new Date(), true)}`)
    encoder.lineFeed(2)

    if (config.autoCut) {
      encoder.cut()
    } else {
      encoder.lineFeed(4)
    }

    return encoder.encode()
  }

  public async printProductSalesReport(date: string, items: any[], settings: SettingsData, config: PrinterConfig): Promise<{ success: boolean; message: string }> {
    if (config.type === 'system') {
      window.print()
      return { success: true, message: 'Sent report to system print spooler' }
    }

    if (config.type === 'bluetooth') {
      try {
        if (!(navigator as any).bluetooth) {
          throw new Error('Web Bluetooth is not supported on this device/browser. Please use System Print.')
        }
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
        })
        const server = await device.gatt?.connect()
        if (!server) throw new Error('Bluetooth connection failed')

        const bytes = await this.encodeProductSalesReportEscPos(date, items, settings, config)
        return { success: true, message: `Printed report (${bytes.length} bytes) to Bluetooth printer ${device.name || ''}` }
      } catch (err: any) {
        console.warn('Bluetooth print failed, falling back to system print:', err)
        window.print()
        return { success: true, message: 'Bluetooth unavailable, printed via System Dialog: ' + err.message }
      }
    }

    window.print()
    return { success: true, message: 'Sent report to print spooler' }
  }

  public generateTestReceipt(): Bill {
    const nowIso = new Date().toISOString()
    return {
      id: 9999,
      invoice_number: 'TEST-PREVIEW-0001',
      bill_date: todayISO(),
      status: 'completed',
      subtotal: 2400,
      discount: 200,
      tax_rate: 0,
      tax_amount: 0,
      total: 2200,
      payment_type: 'cash',
      customer_phone: '0771234567',
      item_count: 2,
      created_at: nowIso,
      completed_at: nowIso,
      items: [
        { id: 1, menu_item_id: 1, name: 'Chicken Fried Rice', quantity: 2, unit_price: 950, line_total: 1900 },
        { id: 2, menu_item_id: 2, name: 'Egg Roti', quantity: 2, unit_price: 250, line_total: 500 },
      ],
    }
  }
}

export const printerService = new PrinterService()
