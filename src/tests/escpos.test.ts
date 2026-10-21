import { describe, it, expect } from 'vitest'
import { EscPosEncoder } from '../hardware/escpos'
import { printerService } from '../hardware/printerService'
import { parseDate, formatDate, formatTime, formatDateTime } from '../lib/utils'
import type { Bill, SettingsData } from '../types'

describe('ESC/POS Command Encoder & Receipt Formatter', () => {
  it('generates initialization and text bytes correctly', () => {
    const encoder = new EscPosEncoder()
    const bytes = encoder.reset().line('TEST').encode()

    // ESC @ is [0x1b, 0x40], 'TEST' + LF is [84, 69, 83, 84, 10]
    expect(Array.from(bytes)).toEqual([0x1b, 0x40, 84, 69, 83, 84, 10])
  })

  it('encodes alignment and bold commands', () => {
    const encoder = new EscPosEncoder()
    const bytes = encoder.align('center').bold(true).line('TITLE').encode()
    // ESC a 1 (center), ESC E 1 (bold)
    expect(Array.from(bytes.slice(0, 6))).toEqual([0x1b, 0x61, 1, 0x1b, 0x45, 1])
  })

  it('encodes paper cut and cash drawer commands', () => {
    const encoder = new EscPosEncoder()
    const bytes = encoder.pulseCashDrawer().cut().encode()
    // ESC p 0 25 250 (cash drawer), GS V 1 (cut)
    expect(bytes.length).toBeGreaterThan(5)
  })

  it('formats receipt with distinct DATE and TIME lines without line-wrapping', () => {
    const bill: Bill = {
      id: 1,
      invoice_number: 'INV-20261021-0001',
      bill_date: '2026-10-21',
      status: 'completed',
      subtotal: 1000,
      discount: 0,
      tax_rate: 0,
      tax_amount: 0,
      total: 1000,
      payment_type: 'cash',
      customer_phone: '0771234567',
      item_count: 1,
      created_at: '2026-10-21T04:30:00.000Z',
      completed_at: '2026-10-21T09:30:00.000Z',
      items: [
        { id: 1, menu_item_id: 1, name: 'Chicken Fried Rice', quantity: 1, unit_price: 1000, line_total: 1000 }
      ]
    }
    const settings: SettingsData = {
      restaurant_name: 'EL CASA',
      currency: 'Rs.',
      tax_rate: 0,
      invoice_prefix: 'INV',
    }

    // 58mm test (32 columns max)
    const receipt58 = printerService.formatReceiptText(bill, settings, '58mm')
    expect(receipt58).toContain('DATE:')
    expect(receipt58).toContain('TIME:')
    expect(receipt58).toContain('2026-10-21')

    const lines = receipt58.split('\n')
    const dateLine = lines.find((l) => l.startsWith('DATE:'))
    const timeLine = lines.find((l) => l.startsWith('TIME:'))
    expect(dateLine).toBeDefined()
    expect(timeLine).toBeDefined()
    // Check no line in 58mm exceeds 32 chars
    expect(dateLine!.length).toBeLessThanOrEqual(32)
    expect(timeLine!.length).toBeLessThanOrEqual(32)

    // Check that completed_at is preferred over created_at for completed bill
    const completedTime = formatTime(bill.completed_at)
    expect(timeLine).toContain(completedTime)
  })

  it('parses SQLite naive UTC dates, ISO dates, and offsets properly', () => {
    // Naive SQLite UTC datetime
    const parsedSqlite = parseDate('2026-10-21 09:30:00')
    expect(parsedSqlite).not.toBeNull()
    expect(parsedSqlite!.toISOString()).toBe('2026-10-21T09:30:00.000Z')

    // ISO with Z
    const parsedIso = parseDate('2026-10-21T09:30:00.000Z')
    expect(parsedIso).not.toBeNull()
    expect(parsedIso!.toISOString()).toBe('2026-10-21T09:30:00.000Z')

    // Formatted time should match between SQLite UTC string and ISO string
    expect(formatTime('2026-10-21 09:30:00')).toEqual(formatTime('2026-10-21T09:30:00.000Z'))

    // Date-only string preserves the exact date
    expect(formatDate('2026-10-21')).toBe('2026-10-21')
  })
})
