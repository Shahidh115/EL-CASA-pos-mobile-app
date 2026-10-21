import { db } from '@/db/database'
import { todayISO } from '@/lib/utils'
import type { BackupPayload } from '@/types'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'


export class LocalBackupService {
  public async exportBackup(): Promise<string> {
    const settings = await db.query('SELECT * FROM settings;')
    const categories = await db.query('SELECT * FROM categories;')
    const resources = await db.query('SELECT * FROM production_resources;')
    const menuItems = await db.query('SELECT * FROM menu_items;')
    const recipes = await db.query('SELECT * FROM recipes;')
    const recipeItems = await db.query('SELECT * FROM recipe_items;')
    const dailyProd = await db.query('SELECT * FROM daily_production;')
    const prodAdj = await db.query('SELECT * FROM production_adjustments;')
    const bills = await db.query('SELECT * FROM bills;')
    const billItems = await db.query('SELECT * FROM bill_items;')
    const transactions = await db.query('SELECT * FROM resource_transactions;')
    const wastes = await db.query('SELECT * FROM wastes;')

    const restName = settings.find((s: any) => s.key === 'restaurant_name')?.value || 'EL CASA'

    const payload: BackupPayload = {
      version: 1,
      exported_at: new Date().toISOString(),
      restaurant_name: restName,
      categories,
      production_resources: resources,
      menu_items: menuItems,
      recipes,
      recipe_items: recipeItems,
      daily_production: dailyProd,
      production_adjustments: prodAdj,
      bills,
      bill_items: billItems,
      resource_transactions: transactions,
      wastes,
      settings,
    }

    return JSON.stringify(payload, null, 2)
  }


  public async exportAndShareBackup(): Promise<{ filename: string; uri?: string }> {
    const jsonString = await this.exportBackup()
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const filename = `elcasa-pos-backup-${dateStr}-${timeStr}.json`

    if (Capacitor.isNativePlatform()) {
      // Write file to app cache directory (mapped via FileProvider cache-path)
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: jsonString,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      })

      // Open native system Share sheet / Chooser dialog
      try {
        await Share.share({
          title: filename,
          text: `EL CASA POS database backup (${dateStr})`,
          dialogTitle: 'Share Database Backup',
          files: [fileResult.uri],
        })
      } catch (shareErr: any) {
        const msg = String(shareErr?.message || shareErr || '')
        if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) {
          return { filename, uri: fileResult.uri }
        }
        throw shareErr
      }

      return { filename, uri: fileResult.uri }
    } else {
      // Browser fallback: trigger blob download
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      return { filename }
    }
  }

  public async importBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
    let payload: BackupPayload
    try {
      payload = JSON.parse(jsonString)
    } catch {
      throw new Error('Invalid backup file format: JSON parsing failed')
    }

    if (!payload.version || !Array.isArray(payload.settings) || !Array.isArray(payload.categories)) {
      throw new Error('Invalid backup file schema: missing required system tables')
    }

    await db.clearAllData()

    await db.transaction(async (tx) => {
      // 1. Settings
      for (const s of payload.settings) {
        await tx.run('INSERT INTO settings (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?);', [
          s.id, s.key, s.value, s.created_at || todayISO(), s.updated_at || todayISO(),
        ])
      }
      // 2. Resources
      for (const r of payload.production_resources || []) {
        await tx.run('INSERT INTO production_resources (id, name, unit, warning_level, current_balance, is_active, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);', [
          r.id, r.name, r.unit, r.warning_level, r.current_balance, r.is_active, r.archived_at, r.created_at, r.updated_at,
        ])
      }
      // 3. Categories
      for (const c of payload.categories || []) {
        await tx.run('INSERT INTO categories (id, name, slug, description, sort_order, is_active, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);', [
          c.id, c.name, c.slug, c.description, c.sort_order, c.is_active, c.archived_at, c.created_at, c.updated_at,
        ])
      }
      // 4. Menu Items
      for (const m of payload.menu_items || []) {
        await tx.run('INSERT INTO menu_items (id, category_id, name, slug, description, price, image_path, is_active, is_favourite, sort_order, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', [
          m.id, m.category_id, m.name, m.slug, m.description, m.price, m.image_path, m.is_active, m.is_favourite, m.sort_order, m.archived_at, m.created_at, m.updated_at,
        ])
      }
      // 5. Recipes
      for (const r of payload.recipes || []) {
        await tx.run('INSERT INTO recipes (id, menu_item_id, version, name, is_current, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);', [
          r.id, r.menu_item_id, r.version, r.name, r.is_current, r.archived_at, r.created_at, r.updated_at,
        ])
      }
      // 6. Recipe Items
      for (const ri of payload.recipe_items || []) {
        await tx.run('INSERT INTO recipe_items (id, recipe_id, production_resource_id, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);', [
          ri.id, ri.recipe_id, ri.production_resource_id, ri.quantity, ri.created_at, ri.updated_at,
        ])
      }
      // 7. Daily Production
      for (const dp of payload.daily_production || []) {
        await tx.run('INSERT INTO daily_production (id, date, production_resource_id, opening_quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);', [
          dp.id, dp.date, dp.production_resource_id, dp.opening_quantity, dp.created_at, dp.updated_at,
        ])
      }
      // 8. Adjustments
      for (const pa of payload.production_adjustments || []) {
        await tx.run('INSERT INTO production_adjustments (id, date, production_resource_id, quantity, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);', [
          pa.id, pa.date, pa.production_resource_id, pa.quantity, pa.note, pa.created_at, pa.updated_at,
        ])
      }
      // 9. Bills
      for (const b of payload.bills || []) {
        await tx.run('INSERT INTO bills (id, invoice_number, bill_date, status, hold_code, subtotal, discount, tax_rate, tax_amount, total, payment_type, customer_phone, note, completed_at, cancelled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', [
          b.id, b.invoice_number, b.bill_date, b.status, b.hold_code, b.subtotal, b.discount, b.tax_rate, b.tax_amount, b.total, b.payment_type, b.customer_phone, b.note, b.completed_at, b.cancelled_at, b.created_at, b.updated_at,
        ])
      }
      // 10. Bill Items
      for (const bi of payload.bill_items || []) {
        await tx.run('INSERT INTO bill_items (id, bill_id, menu_item_id, recipe_id, item_name, unit_price, quantity, line_total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', [
          bi.id, bi.bill_id, bi.menu_item_id, bi.recipe_id, bi.item_name, bi.unit_price, bi.quantity, bi.line_total, bi.created_at, bi.updated_at,
        ])
      }
      // 11. Transactions
      for (const rt of payload.resource_transactions || []) {
        await tx.run('INSERT INTO resource_transactions (id, production_resource_id, date, type, quantity, balance_after, reference_type, reference_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', [
          rt.id, rt.production_resource_id, rt.date, rt.type, rt.quantity, rt.balance_after, rt.reference_type, rt.reference_id, rt.note, rt.created_at, rt.updated_at,
        ])
      }
      // 12. Wastes
      for (const w of payload.wastes || []) {
        await tx.run('INSERT INTO wastes (id, production_resource_id, type, quantity, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);', [
          w.id, w.production_resource_id, w.type, w.quantity, w.note, w.created_at, w.updated_at,
        ])
      }
    })

    return {
      success: true,
      message: `Backup restored successfully (${payload.bills?.length || 0} bills, ${payload.menu_items?.length || 0} menu items).`,
    }
  }
}

export const localBackupService = new LocalBackupService()
