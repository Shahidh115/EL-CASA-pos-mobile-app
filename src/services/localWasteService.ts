import { db } from '@/db/database'
import type { Waste } from '@/types'
import { todayISO } from '@/lib/utils'

export class LocalWasteService {
  public async list(filters: { from?: string; to?: string; resource_id?: number; type?: string } = {}): Promise<Waste[]> {
    const conditions: string[] = []
    const params: any[] = []

    if (filters.from && filters.to) {
      conditions.push('w.created_at >= ? AND w.created_at <= ?')
      params.push(filters.from + ' 00:00:00', filters.to + ' 23:59:59')
    }
    if (filters.resource_id) {
      conditions.push('w.production_resource_id = ?')
      params.push(filters.resource_id)
    }
    if (filters.type) {
      conditions.push('w.type = ?')
      params.push(filters.type)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `
      SELECT w.*, r.name as resource_name, r.unit
      FROM wastes w
      JOIN production_resources r ON r.id = w.production_resource_id
      ${where}
      ORDER BY w.id DESC;
    `
    const rows = await db.query(sql, params)
    return rows.map((r: any) => ({
      id: r.id,
      resource_id: r.production_resource_id,
      resource: r.resource_name,
      unit: r.unit,
      type: r.type,
      quantity: Number(r.quantity),
      note: r.note,
      created_at: r.created_at,
    }))
  }

  public async record(payload: { production_resource_id: number; type: string; quantity: number; note?: string }): Promise<Waste> {
    const qty = Number(payload.quantity)
    if (qty <= 0) throw new Error('Quantity must be greater than zero.')

    return db.transaction(async (tx) => {
      const res = await tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [payload.production_resource_id])
      if (!res) throw new Error(`Resource #${payload.production_resource_id} not found`)

      const currentBalance = Number(res.current_balance)
      if (qty > currentBalance) {
        throw new Error(`Only ${currentBalance} ${res.unit} of ${res.name} is available.`)
      }

      const ins = await tx.run(
        'INSERT INTO wastes (production_resource_id, type, quantity, note) VALUES (?, ?, ?, ?);',
        [payload.production_resource_id, payload.type, qty, payload.note || null]
      )
      const wasteId = ins.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id

      const balanceAfter = currentBalance - qty
      const today = todayISO()

      await tx.run(
        `INSERT INTO resource_transactions
         (production_resource_id, date, type, quantity, balance_after, reference_type, reference_id, note)
         VALUES (?, ?, 'WASTE', ?, ?, 'waste', ?, ?);`,
        [res.id, today, -qty, balanceAfter, wasteId, `${payload.type} waste`]
      )

      await tx.run('UPDATE production_resources SET current_balance = ?, updated_at = datetime("now") WHERE id = ?;', [
        balanceAfter,
        res.id,
      ])

      const saved = await tx.queryOne(`
        SELECT w.*, r.name as resource_name, r.unit
        FROM wastes w
        JOIN production_resources r ON r.id = w.production_resource_id
        WHERE w.id = ?;
      `, [wasteId])

      return {
        id: saved.id,
        resource_id: saved.production_resource_id,
        resource: saved.resource_name,
        unit: saved.unit,
        type: saved.type,
        quantity: Number(saved.quantity),
        note: saved.note,
        created_at: saved.created_at,
      }
    })
  }

  public async recordMenuItem(payload: { menu_item_id: number; type: string; quantity: number; note?: string }): Promise<Waste[]> {
    const itemQty = Number(payload.quantity)
    if (itemQty <= 0) throw new Error('Quantity must be greater than zero.')

    return db.transaction(async (tx) => {
      const menuItem = await tx.queryOne('SELECT * FROM menu_items WHERE id = ?;', [payload.menu_item_id])
      if (!menuItem) throw new Error(`Menu item #${payload.menu_item_id} not found`)

      const recipe = await tx.queryOne('SELECT * FROM recipes WHERE menu_item_id = ? AND is_current = 1;', [payload.menu_item_id])
      if (!recipe) throw new Error(`Menu item '${menuItem.name}' has no active recipe configured.`)

      const recipeItems = await tx.query(`
        SELECT ri.*, r.name as resource_name, r.unit, r.current_balance
        FROM recipe_items ri
        JOIN production_resources r ON r.id = ri.production_resource_id
        WHERE ri.recipe_id = ?;
      `, [recipe.id])

      if (recipeItems.length === 0) {
        throw new Error(`Menu item '${menuItem.name}' recipe has no resources configured.`)
      }

      // Check stock for all recipe items
      for (const ri of recipeItems) {
        const needed = Number(ri.quantity) * itemQty
        if (needed > Number(ri.current_balance)) {
          throw new Error(
            `Insufficient stock for ${ri.resource_name}. Needed: ${needed} ${ri.unit}, Available: ${ri.current_balance} ${ri.unit}.`
          )
        }
      }

      const noteText = `${itemQty}x ${menuItem.name}` + (payload.note ? ` (${payload.note})` : '')
      const results: Waste[] = []
      const today = todayISO()

      for (const ri of recipeItems) {
        const needed = Number(ri.quantity) * itemQty
        const balanceAfter = Number(ri.current_balance) - needed

        const ins = await tx.run(
          'INSERT INTO wastes (production_resource_id, type, quantity, note) VALUES (?, ?, ?, ?);',
          [ri.production_resource_id, payload.type, needed, noteText]
        )
        const wasteId = ins.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id

        await tx.run(
          `INSERT INTO resource_transactions
           (production_resource_id, date, type, quantity, balance_after, reference_type, reference_id, note)
           VALUES (?, ?, 'WASTE', ?, ?, 'waste', ?, ?);`,
          [ri.production_resource_id, today, -needed, balanceAfter, wasteId, `${payload.type} - ${noteText}`]
        )

        await tx.run('UPDATE production_resources SET current_balance = ?, updated_at = datetime("now") WHERE id = ?;', [
          balanceAfter,
          ri.production_resource_id,
        ])

        results.push({
          id: wasteId,
          resource_id: ri.production_resource_id,
          resource: ri.resource_name,
          unit: ri.unit,
          type: payload.type,
          quantity: needed,
          note: noteText,
          created_at: new Date().toISOString(),
        })
      }

      return results
    })
  }
}

export const localWasteService = new LocalWasteService()
