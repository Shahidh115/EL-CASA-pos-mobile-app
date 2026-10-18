import { db } from '@/db/database'
import { todayISO } from '@/lib/utils'

export class LocalProductionService {
  public async openingFor(date?: string | null) {
    const d = date || todayISO()
    const sql = `
      SELECT r.id as resource_id, r.name as resource, r.unit, r.current_balance,
             COALESCE(dp.opening_quantity, 0) as opening_quantity, ? as date
      FROM production_resources r
      LEFT JOIN daily_production dp ON dp.production_resource_id = r.id AND dp.date = ?
      WHERE r.is_active = 1
      ORDER BY r.name ASC;
    `
    const rows = await db.query(sql, [d, d])
    return rows.map((r: any) => ({
      resource_id: r.resource_id,
      resource: r.resource,
      unit: r.unit,
      opening_quantity: Number(r.opening_quantity),
      current_balance: Number(r.current_balance),
      date: d,
    }))
  }

  public async setOpening(resourceId: number, quantity: number, date?: string | null) {
    const d = date || todayISO()
    return db.transaction(async (tx) => {
      const res = await tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [resourceId])
      if (!res) throw new Error(`Resource #${resourceId} not found`)

      const existing = await tx.queryOne(
        'SELECT id FROM daily_production WHERE date = ? AND production_resource_id = ?;',
        [d, resourceId]
      )

      let dpId: number
      if (existing) {
        await tx.run('UPDATE daily_production SET opening_quantity = ?, updated_at = datetime("now") WHERE id = ?;', [
          quantity,
          existing.id,
        ])
        dpId = existing.id
      } else {
        const ins = await tx.run(
          'INSERT INTO daily_production (date, production_resource_id, opening_quantity) VALUES (?, ?, ?);',
          [d, resourceId, quantity]
        )
        dpId = ins.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id
      }

      await tx.run(
        `INSERT INTO resource_transactions
         (production_resource_id, date, type, quantity, balance_after, reference_type, reference_id, note)
         VALUES (?, ?, 'OPENING', ?, ?, 'daily_production', ?, ?);`,
        [resourceId, d, quantity, quantity, dpId, `Opening production ${d}`]
      )

      await tx.run('UPDATE production_resources SET current_balance = ?, updated_at = datetime("now") WHERE id = ?;', [
        quantity,
        resourceId,
      ])

      return tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [resourceId])
    })
  }

  public async addProduction(resourceId: number, quantity: number, note?: string | null, date?: string | null) {
    const d = date || todayISO()
    return db.transaction(async (tx) => {
      const res = await tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [resourceId])
      if (!res) throw new Error(`Resource #${resourceId} not found`)

      const ins = await tx.run(
        'INSERT INTO production_adjustments (date, production_resource_id, quantity, note) VALUES (?, ?, ?, ?);',
        [d, resourceId, quantity, note || null]
      )
      const adjId = ins.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id

      const balanceAfter = Number(res.current_balance) + quantity

      await tx.run(
        `INSERT INTO resource_transactions
         (production_resource_id, date, type, quantity, balance_after, reference_type, reference_id, note)
         VALUES (?, ?, 'PRODUCTION', ?, ?, 'production_adjustment', ?, ?);`,
        [resourceId, d, quantity, balanceAfter, adjId, note || 'Additional production']
      )

      await tx.run('UPDATE production_resources SET current_balance = ?, updated_at = datetime("now") WHERE id = ?;', [
        balanceAfter,
        resourceId,
      ])

      return tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [resourceId])
    })
  }

  public async historyFor(date?: string | null) {
    const d = date || todayISO()
    const openings = await db.query(`
      SELECT dp.id, dp.production_resource_id as resource_id, dp.opening_quantity as quantity,
             dp.created_at, r.name as resource, r.unit
      FROM daily_production dp
      JOIN production_resources r ON r.id = dp.production_resource_id
      WHERE dp.date = ?;
    `, [d])

    const adjustments = await db.query(`
      SELECT pa.id, pa.production_resource_id as resource_id, pa.quantity, pa.note,
             pa.created_at, r.name as resource, r.unit
      FROM production_adjustments pa
      JOIN production_resources r ON r.id = pa.production_resource_id
      WHERE pa.date = ?;
    `, [d])

    const list = [
      ...openings.map((o: any) => ({
        id: `opening-${o.id}`,
        resource_id: o.resource_id,
        resource: o.resource,
        unit: o.unit,
        quantity: Number(o.quantity),
        type: 'OPENING',
        note: `Opening production ${d}`,
        created_at: o.created_at,
      })),
      ...adjustments.map((a: any) => ({
        id: `adjustment-${a.id}`,
        resource_id: a.resource_id,
        resource: a.resource,
        unit: a.unit,
        quantity: Number(a.quantity),
        type: 'PRODUCTION',
        note: a.note || 'Additional production',
        created_at: a.created_at,
      })),
    ]

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return list
  }

  public async resetAll(date?: string | null): Promise<void> {
    const d = date || todayISO()
    await db.transaction(async (tx) => {
      const activeResources = await tx.query('SELECT id FROM production_resources WHERE is_active = 1;')
      for (const res of activeResources) {
        const existing = await tx.queryOne(
          'SELECT id FROM daily_production WHERE date = ? AND production_resource_id = ?;',
          [d, res.id]
        )
        if (existing) {
          await tx.run('UPDATE daily_production SET opening_quantity = 0 WHERE id = ?;', [existing.id])
        } else {
          await tx.run(
            'INSERT INTO daily_production (date, production_resource_id, opening_quantity) VALUES (?, ?, 0);',
            [d, res.id]
          )
        }
        await tx.run('UPDATE production_resources SET current_balance = 0 WHERE id = ?;', [res.id])
      }
    })
  }
}

export const localProductionService = new LocalProductionService()
