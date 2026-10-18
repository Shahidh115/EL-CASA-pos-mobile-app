import { db } from '@/db/database'
import type { ProductionResource } from '@/types'
import { todayISO } from '@/lib/utils'

export class LocalResourceService {
  public async list(includeArchived = false): Promise<ProductionResource[]> {
    const where = includeArchived ? '' : 'WHERE is_active = 1 AND archived_at IS NULL'
    const sql = `
      SELECT r.*,
        (SELECT count(DISTINCT recipe_id) FROM recipe_items ri WHERE ri.production_resource_id = r.id) as recipe_count
      FROM production_resources r
      ${where}
      ORDER BY name ASC;
    `
    const rows = await db.query(sql)
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      warning_level: Number(r.warning_level),
      current_balance: Number(r.current_balance),
      is_active: Boolean(r.is_active),
      archived_at: r.archived_at,
      recipe_count: Number(r.recipe_count || 0),
      is_low: Number(r.current_balance) <= Number(r.warning_level),
    }))
  }

  public async get(id: number): Promise<ProductionResource | null> {
    const row = await db.queryOne('SELECT * FROM production_resources WHERE id = ?;', [id])
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      warning_level: Number(row.warning_level),
      current_balance: Number(row.current_balance),
      is_active: Boolean(row.is_active),
      archived_at: row.archived_at,
      is_low: Number(row.current_balance) <= Number(row.warning_level),
    }
  }

  public async create(data: { name: string; unit?: string; warning_level?: number }): Promise<ProductionResource> {
    const unit = data.unit || 'Portion'
    const warning = data.warning_level ?? 0
    const res = await db.run(
      'INSERT INTO production_resources (name, unit, warning_level, current_balance, is_active) VALUES (?, ?, ?, 0, 1);',
      [data.name.trim(), unit, warning]
    )
    const id = res.lastId || (await db.queryOne('SELECT last_insert_rowid() as id')).id
    return (await this.get(id))!
  }

  public async update(id: number, data: { name?: string; unit?: string; warning_level?: number }): Promise<ProductionResource> {
    const current = await this.get(id)
    if (!current) throw new Error(`Resource #${id} not found`)
    const name = data.name !== undefined ? data.name.trim() : current.name
    const unit = data.unit !== undefined ? data.unit : current.unit
    const warning = data.warning_level !== undefined ? data.warning_level : current.warning_level

    await db.run(
      'UPDATE production_resources SET name = ?, unit = ?, warning_level = ?, updated_at = datetime("now") WHERE id = ?;',
      [name, unit, warning, id]
    )
    return (await this.get(id))!
  }

  public async archive(id: number): Promise<ProductionResource> {
    await db.run(
      'UPDATE production_resources SET is_active = 0, archived_at = datetime("now"), updated_at = datetime("now") WHERE id = ?;',
      [id]
    )
    return (await this.get(id))!
  }

  public async restore(id: number): Promise<ProductionResource> {
    await db.run(
      'UPDATE production_resources SET is_active = 1, archived_at = NULL, updated_at = datetime("now") WHERE id = ?;',
      [id]
    )
    return (await this.get(id))!
  }

  public async manualAdjust(id: number, quantity: number, note?: string | null): Promise<ProductionResource> {
    return db.transaction(async (tx) => {
      const res = await tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [id])
      if (!res) throw new Error(`Resource #${id} not found`)

      const currentBalance = Number(res.current_balance)
      const balanceAfter = Math.max(0, currentBalance + quantity)
      const today = todayISO()

      await tx.run(
        `INSERT INTO resource_transactions
         (production_resource_id, date, type, quantity, balance_after, reference_type, note)
         VALUES (?, ?, 'MANUAL_ADJUSTMENT', ?, ?, 'manual', ?);`,
        [id, today, quantity, balanceAfter, note || 'Manual adjustment']
      )

      await tx.run('UPDATE production_resources SET current_balance = ?, updated_at = datetime("now") WHERE id = ?;', [
        balanceAfter,
        id,
      ])

      const updated = await tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [id])
      return {
        id: updated.id,
        name: updated.name,
        unit: updated.unit,
        warning_level: Number(updated.warning_level),
        current_balance: Number(updated.current_balance),
        is_active: Boolean(updated.is_active),
        archived_at: updated.archived_at,
        is_low: Number(updated.current_balance) <= Number(updated.warning_level),
      }
    })
  }

  public async cartRequirements(cart: { menu_item_id: number; quantity: number }[]) {
    const requirements: Record<number, {
      resource_id: number
      resource: string
      unit: string
      available: number
      required: number
      line: any
    }> = {}

    for (const line of cart) {
      const rows = await db.query(`
        SELECT ri.production_resource_id, ri.quantity as recipe_qty, r.name as resource_name, r.unit, r.current_balance
        FROM recipes rec
        JOIN recipe_items ri ON ri.recipe_id = rec.id
        JOIN production_resources r ON r.id = ri.production_resource_id
        WHERE rec.menu_item_id = ? AND rec.is_current = 1;
      `, [line.menu_item_id])

      const qty = Number(line.quantity) || 0
      for (const row of rows) {
        const resId = Number(row.production_resource_id)
        if (!requirements[resId]) {
          requirements[resId] = {
            resource_id: resId,
            resource: row.resource_name,
            unit: row.unit,
            available: Number(row.current_balance),
            required: 0,
            line,
          }
        }
        requirements[resId].required += Number(row.recipe_qty) * qty
      }
    }
    return requirements
  }

  public async cartShortages(cart: { menu_item_id: number; quantity: number }[]) {
    const reqs = await this.cartRequirements(cart)
    const shortages = []
    for (const item of Object.values(reqs)) {
      if (item.required > item.available) {
        shortages.push(item)
      }
    }
    return shortages
  }

  public async assertCartAvailable(cart: { menu_item_id: number; quantity: number }[]) {
    const shortages = await this.cartShortages(cart)
    if (shortages.length === 0) return

    const first = shortages[0]
    const maxQty = await this.itemMaxQuantity(first.line.menu_item_id)
    const err: any = new Error(
      `Insufficient stock for ${first.resource}. Needed: ${first.required.toFixed(2)} ${first.unit}, Available: ${first.available.toFixed(2)} ${first.unit}`
    )
    err.data = { max_quantity: maxQty, shortages }
    throw err
  }

  public async itemMaxQuantity(menuItemId: number, otherCartLines: { menu_item_id: number; quantity: number }[] = []): Promise<number> {
    const rows = await db.query(`
      SELECT ri.production_resource_id, ri.quantity as recipe_qty, r.current_balance
      FROM recipes rec
      JOIN recipe_items ri ON ri.recipe_id = rec.id
      JOIN production_resources r ON r.id = ri.production_resource_id
      WHERE rec.menu_item_id = ? AND rec.is_current = 1;
    `, [menuItemId])

    if (!rows || rows.length === 0) return 0

    const consumed: Record<number, number> = {}
    for (const line of otherCartLines) {
      const rRows = await db.query(`
        SELECT ri.production_resource_id, ri.quantity as recipe_qty
        FROM recipes rec
        JOIN recipe_items ri ON ri.recipe_id = rec.id
        WHERE rec.menu_item_id = ? AND rec.is_current = 1;
      `, [line.menu_item_id])

      for (const r of rRows) {
        const rId = Number(r.production_resource_id)
        consumed[rId] = (consumed[rId] || 0) + Number(r.recipe_qty) * Number(line.quantity)
      }
    }

    let max = Number.MAX_SAFE_INTEGER
    for (const item of rows) {
      const perDish = Number(item.recipe_qty)
      if (perDish <= 0) continue
      const resId = Number(item.production_resource_id)
      const remaining = Number(item.current_balance) - (consumed[resId] || 0)
      max = Math.min(max, Math.floor(remaining / perDish))
    }

    return max === Number.MAX_SAFE_INTEGER ? 0 : Math.max(0, max)
  }
}

export const localResourceService = new LocalResourceService()
