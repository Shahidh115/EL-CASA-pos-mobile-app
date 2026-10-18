import { db } from '@/db/database'
import type { SettingsData } from '@/types'

export class LocalSettingsService {
  public async all(): Promise<SettingsData> {
    const rows = await db.query('SELECT key, value FROM settings;')
    const map: Record<string, string> = {}
    for (const r of rows) {
      map[r.key] = r.value
    }

    return {
      restaurant_name: map.restaurant_name ?? 'EL CASA',
      logo_path: map.logo_path ?? null,
      address: map.address ?? '123 Main Street, Colombo',
      phone: map.phone ?? '+94 11 234 5678',
      receipt_header: map.receipt_header ?? 'Welcome to EL CASA',
      receipt_footer: map.receipt_footer ?? 'Thank you! Please come again.',
      currency: map.currency ?? 'Rs.',
      tax_rate: Number(map.tax_rate ?? 0),
      printer_config: map.printer_config ?? null,
      invoice_prefix: map.invoice_prefix ?? 'INV',
    }
  }

  public async update(data: Partial<SettingsData>): Promise<SettingsData> {
    await db.transaction(async (tx) => {
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
          const exists = await tx.queryOne('SELECT id FROM settings WHERE key = ?;', [key])
          if (exists) {
            await tx.run('UPDATE settings SET value = ?, updated_at = datetime("now") WHERE key = ?;', [strVal, key])
          } else {
            await tx.run('INSERT INTO settings (key, value) VALUES (?, ?);', [key, strVal])
          }
        }
      }
    })
    return this.all()
  }

  public async uploadLogo(base64: string): Promise<string> {
    await this.update({ logo_path: base64 })
    return base64
  }
}

export const localSettingsService = new LocalSettingsService()
