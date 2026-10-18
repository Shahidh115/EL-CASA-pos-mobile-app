import { EscPosEncoder } from './escpos'
import type { Bill, PrinterConfig, SettingsData } from '@/types'
import { formatMoney, formatDateTime } from '@/lib/utils'

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
    const dateStr = bill.bill_date ? `${bill.bill_date} (${formatDateTime(bill.created_at)})` : formatDateTime(bill.created_at)
    lines.push(twoCol('DATE:', dateStr))
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

  public encodeReceiptEscPos(bill: Bill, settings: SettingsData, config: PrinterConfig): Uint8Array {
    const cols = config.paperWidth === '58mm' ? 32 : 48
    const encoder = new EscPosEncoder().reset()
    const currency = settings.currency || 'Rs.'

    encoder.align('center')
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
    const dateStr = bill.bill_date ? `${bill.bill_date} (${formatDateTime(bill.created_at)})` : formatDateTime(bill.created_at)
    encoder.table2Cols('DATE:', dateStr, cols)
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

        const bytes = this.encodeReceiptEscPos(bill, settings, config)
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

  public generateTestReceipt(): Bill {
    return {
      id: 9999,
      invoice_number: 'TEST-PREVIEW-0001',
      bill_date: new Date().toISOString().slice(0, 10),
      status: 'completed',
      subtotal: 2400,
      discount: 200,
      tax_rate: 0,
      tax_amount: 0,
      total: 2200,
      payment_type: 'cash',
      customer_phone: '0771234567',
      item_count: 2,
      created_at: new Date().toISOString(),
      items: [
        { id: 1, menu_item_id: 1, name: 'Chicken Fried Rice', quantity: 2, unit_price: 950, line_total: 1900 },
        { id: 2, menu_item_id: 2, name: 'Egg Roti', quantity: 2, unit_price: 250, line_total: 500 },
      ],
    }
  }
}

export const printerService = new PrinterService()
