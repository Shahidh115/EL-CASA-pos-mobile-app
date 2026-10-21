import { db } from '@/db/database'
import { todayISO, parseDate } from '@/lib/utils'
import { localResourceService } from './localResourceService'

export class LocalReportService {
  public async dashboard() {
    const today = todayISO()
    const summary = await this.salesSummary(today, today)
    const topSelling = await this.topSelling(today, today, 6)
    const hourly = await this.hourlySales(today)
    const lowResources = await this.lowResources()
    const recentBills = await this.recentBills(8)
    const capacity = await this.productionCapacity()

    return {
      date: today,
      summary,
      top_selling: topSelling,
      hourly_sales: hourly,
      low_resources: lowResources,
      recent_bills: recentBills,
      production_capacity: capacity,
    }
  }

  public async salesSummary(from: string, to: string) {
    const bills = await db.query(
      'SELECT total, discount FROM bills WHERE status = "completed" AND bill_date >= ? AND bill_date <= ?;',
      [from, to]
    )

    const revenue = bills.reduce((sum: number, b: any) => sum + Number(b.total), 0)
    const discount = bills.reduce((sum: number, b: any) => sum + Number(b.discount), 0)
    const count = bills.length

    const itemsSoldRow = await db.queryOne(`
      SELECT COALESCE(SUM(bi.quantity), 0) as items_sold
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE b.status = 'completed' AND b.bill_date >= ? AND b.bill_date <= ?;
    `, [from, to])

    const itemsSold = Number(itemsSoldRow?.items_sold || 0)
    const avg = count > 0 ? revenue / count : 0

    return {
      revenue: Math.round(revenue * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      sales_count: count,
      items_sold: itemsSold,
      average_bill: Math.round(avg * 100) / 100,
    }
  }

  public async topSelling(from: string, to: string, limit = 10) {
    const sql = `
      SELECT bi.menu_item_id, bi.item_name as name,
             SUM(bi.quantity) as quantity, SUM(bi.line_total) as revenue
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE b.status = 'completed' AND b.bill_date >= ? AND b.bill_date <= ?
      GROUP BY bi.menu_item_id, bi.item_name
      ORDER BY quantity DESC
      LIMIT ?;
    `
    const rows = await db.query(sql, [from, to, limit])
    return rows.map((r: any) => ({
      menu_item_id: r.menu_item_id,
      name: r.name,
      quantity: Number(r.quantity),
      revenue: Math.round(Number(r.revenue) * 100) / 100,
    }))
  }

  public async hourlySales(date: string) {
    const rows = await db.query(
      'SELECT created_at, completed_at, total FROM bills WHERE status = "completed" AND bill_date = ?;',
      [date]
    )

    const hours: Record<number, { hour: number; label: string; count: number; revenue: number }> = {}
    for (let h = 0; h < 24; h++) {
      hours[h] = {
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        count: 0,
        revenue: 0,
      }
    }

    for (const r of rows) {
      const ts = r.completed_at || r.created_at
      if (ts) {
        const d = parseDate(ts)
        if (d && !isNaN(d.getHours())) {
          const hour = d.getHours()
          hours[hour].count += 1
          hours[hour].revenue += Number(r.total)
        }
      }
    }

    return Object.values(hours).map((h) => ({
      ...h,
      revenue: Math.round(h.revenue * 100) / 100,
    }))
  }

  public async lowResources() {
    const rows = await db.query(`
      SELECT id, name, unit, current_balance, warning_level
      FROM production_resources
      WHERE is_active = 1 AND current_balance <= warning_level
      ORDER BY name ASC;
    `)
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      current_balance: Number(r.current_balance),
      warning_level: Number(r.warning_level),
    }))
  }

  public async productionCapacity() {
    const items = await db.query(`
      SELECT m.id, m.name, m.price, r.id as recipe_id
      FROM menu_items m
      JOIN recipes r ON r.menu_item_id = m.id AND r.is_current = 1
      WHERE m.is_active = 1
      ORDER BY m.name ASC;
    `)

    const result = []
    for (const item of items) {
      const max = await localResourceService.itemMaxQuantity(item.id)
      let limiting = null

      if (max === 0) {
        const rItems = await db.query(`
          SELECT res.name, res.current_balance, ri.quantity
          FROM recipe_items ri
          JOIN production_resources res ON res.id = ri.production_resource_id
          WHERE ri.recipe_id = ?;
        `, [item.recipe_id])

        for (const ri of rItems) {
          if (Number(ri.current_balance) < Number(ri.quantity)) {
            limiting = ri.name
            break
          }
        }
      }

      result.push({
        menu_item_id: item.id,
        name: item.name,
        price: Number(item.price),
        max_preparable: max,
        limiting_resource: limiting,
      })
    }

    return result
  }

  public async productSales(from: string, to: string) {
    const sql = `
      SELECT 
        bi.menu_item_id,
        bi.item_name as name,
        COALESCE(c.name, 'General') as category,
        COALESCE(m.price, ROUND(SUM(bi.line_total) / NULLIF(SUM(bi.quantity), 0), 2)) as price,
        SUM(bi.quantity) as quantity,
        SUM(bi.line_total) as revenue,
        COUNT(DISTINCT bi.bill_id) as orders_count
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      LEFT JOIN menu_items m ON m.id = bi.menu_item_id
      LEFT JOIN categories c ON c.id = m.category_id
      WHERE b.status = 'completed' AND b.bill_date >= ? AND b.bill_date <= ?
      GROUP BY bi.menu_item_id, bi.item_name, c.name, m.price
      ORDER BY quantity DESC;
    `
    const rows = await db.query(sql, [from, to])
    return rows.map((r: any) => ({
      menu_item_id: r.menu_item_id,
      name: r.name,
      category: r.category || 'General',
      price: Number(r.price) || 0,
      quantity: Number(r.quantity),
      revenue: Math.round(Number(r.revenue) * 100) / 100,
      orders_count: Number(r.orders_count) || 1,
    }))
  }

  public async foodSales(from: string, to: string) {
    return this.productSales(from, to)
  }

  public async oldFoodSales(from: string, to: string) {
    return this.topSelling(from, to, 500)
  }

  public async resourceUsage(from: string, to: string) {
    const resources = await db.query('SELECT * FROM production_resources ORDER BY name ASC;')
    const usage = []

    for (const res of resources) {
      const txRows = await db.query(
        'SELECT type, quantity, balance_after FROM resource_transactions WHERE production_resource_id = ? AND date >= ? AND date <= ? ORDER BY id ASC;',
        [res.id, from, to]
      )

      let opening = 0
      let produced = 0
      let sold = 0
      let restored = 0
      let wasted = 0
      let manual = 0

      for (const t of txRows) {
        const q = Number(t.quantity)
        switch (t.type) {
          case 'OPENING':
            opening += q
            break
          case 'PRODUCTION':
            produced += q
            break
          case 'SALE':
            sold += Math.abs(q)
            break
          case 'SALE_RESTORE':
            restored += q
            break
          case 'WASTE':
            wasted += Math.abs(q)
            break
          case 'MANUAL_ADJUSTMENT':
            manual += q
            break
        }
      }

      const closing = txRows.length > 0 ? Number(txRows[txRows.length - 1].balance_after) : Number(res.current_balance)

      usage.push({
        resource_id: res.id,
        name: res.name,
        unit: res.unit,
        opening: Math.round(opening * 1000) / 1000,
        produced: Math.round(produced * 1000) / 1000,
        sold: Math.round(sold * 1000) / 1000,
        restored: Math.round(restored * 1000) / 1000,
        wasted: Math.round(wasted * 1000) / 1000,
        manual_adjust: Math.round(manual * 1000) / 1000,
        closing: Math.round(closing * 1000) / 1000,
        current_balance: Number(res.current_balance),
      })
    }

    return usage
  }

  public async wasteReport(from: string, to: string) {
    const wastes = await db.query(`
      SELECT w.*, r.name as resource_name, r.unit
      FROM wastes w
      JOIN production_resources r ON r.id = w.production_resource_id
      WHERE w.created_at >= ? AND w.created_at <= ?
      ORDER BY w.id DESC;
    `, [from + ' 00:00:00', to + ' 23:59:59'])

    let total = 0
    const byType: Record<string, number> = {}
    const byResourceMap: Record<number, { resource_id: number; name: string; unit: string; quantity: number }> = {}

    for (const w of wastes) {
      const q = Number(w.quantity)
      total += q
      byType[w.type] = (byType[w.type] || 0) + q

      if (!byResourceMap[w.production_resource_id]) {
        byResourceMap[w.production_resource_id] = {
          resource_id: w.production_resource_id,
          name: w.resource_name,
          unit: w.unit,
          quantity: 0,
        }
      }
      byResourceMap[w.production_resource_id].quantity += q
    }

    return {
      total: Math.round(total * 1000) / 1000,
      by_type: byType,
      by_resource: Object.values(byResourceMap).map((r) => ({
        ...r,
        quantity: Math.round(r.quantity * 1000) / 1000,
      })),
      records: wastes.map((w: any) => ({
        id: w.id,
        resource: w.resource_name,
        unit: w.unit,
        type: w.type,
        quantity: Number(w.quantity),
        note: w.note,
        created_at: w.created_at,
      })),
    }
  }

  public async salesTrends(from: string, to: string) {
    const rows = await db.query(
      'SELECT bill_date, total FROM bills WHERE status = "completed" AND bill_date >= ? AND bill_date <= ?;',
      [from, to]
    )

    const dateMap: Record<string, { date: string; revenue: number; count: number }> = {}
    for (const r of rows) {
      const d = r.bill_date
      if (!dateMap[d]) {
        dateMap[d] = { date: d, revenue: 0, count: 0 }
      }
      dateMap[d].revenue += Number(r.total)
      dateMap[d].count += 1
    }

    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  }

  private async recentBills(limit = 8) {
    const rows = await db.query('SELECT * FROM bills ORDER BY id DESC LIMIT ?;', [limit])
    const list = []
    for (const b of rows) {
      const items = await db.query('SELECT * FROM bill_items WHERE bill_id = ?;', [b.id])
      list.push({
        id: b.id,
        invoice_number: b.invoice_number,
        bill_date: b.bill_date,
        status: b.status,
        subtotal: Number(b.subtotal),
        discount: Number(b.discount),
        tax_rate: Number(b.tax_rate),
        tax_amount: Number(b.tax_amount),
        total: Number(b.total),
        payment_type: b.payment_type,
        customer_phone: b.customer_phone,
        item_count: items.length,
        created_at: b.created_at,
        items: items.map((i: any) => ({
          id: i.id,
          name: i.item_name,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          line_total: Number(i.line_total),
        })),
      })
    }
    return list
  }
}

export const localReportService = new LocalReportService()
