import { db } from '@/db/database'
import type { Bill, BillItem } from '@/types'
import { todayISO } from '@/lib/utils'
import { localResourceService } from './localResourceService'

export interface SalePayload {
  items: { menu_item_id: number; quantity: number }[]
  discount?: number
  payment_type?: string
  customer_phone?: string | null
  note?: string | null
  bill_date?: string | null
}

export class LocalSaleService {
  public async list(filters: { date?: string; status?: string; from?: string; to?: string; q?: string; page?: number; per_page?: number } = {}) {
    const conditions: string[] = []
    const params: any[] = []

    if (filters.date) {
      conditions.push('bill_date = ?')
      params.push(filters.date)
    }
    if (filters.status) {
      conditions.push('status = ?')
      params.push(filters.status)
    }
    if (filters.from && filters.to) {
      conditions.push('bill_date >= ? AND bill_date <= ?')
      params.push(filters.from, filters.to)
    }
    if (filters.q) {
      conditions.push('(invoice_number LIKE ? OR customer_phone LIKE ?)')
      params.push(`%${filters.q}%`, `%${filters.q}%`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRow = await db.queryOne(`SELECT count(*) as total FROM bills ${where};`, params)
    const total = Number(countRow?.total || 0)

    const perPage = filters.per_page || 25
    const page = filters.page || 1
    const offset = (page - 1) * perPage

    const sql = `
      SELECT b.*,
        (SELECT count(*) FROM bill_items bi WHERE bi.bill_id = b.id) as item_count
      FROM bills b
      ${where}
      ORDER BY b.id DESC
      LIMIT ? OFFSET ?;
    `
    const billRows = await db.query(sql, [...params, perPage, offset])
    const bills: Bill[] = []

    for (const b of billRows) {
      const items = await this.getBillItems(b.id)
      bills.push(this.formatBill(b, items))
    }

    return {
      items: bills,
      pagination: {
        current_page: page,
        last_page: Math.ceil(total / perPage) || 1,
        per_page: perPage,
        total,
      },
    }
  }

  public async get(id: number): Promise<Bill> {
    const bill = await db.queryOne('SELECT * FROM bills WHERE id = ?;', [id])
    if (!bill) throw new Error(`Bill #${id} not found`)
    const items = await this.getBillItems(id)
    return this.formatBill(bill, items)
  }

  private async getBillItems(billId: number): Promise<BillItem[]> {
    const rows = await db.query('SELECT * FROM bill_items WHERE bill_id = ? ORDER BY id ASC;', [billId])
    return rows.map((r: any) => ({
      id: r.id,
      bill_id: r.bill_id,
      menu_item_id: r.menu_item_id,
      recipe_id: r.recipe_id,
      name: r.item_name,
      unit_price: Number(r.unit_price),
      quantity: Number(r.quantity),
      line_total: Number(r.line_total),
    }))
  }

  private formatBill(b: any, items: BillItem[]): Bill {
    return {
      id: b.id,
      invoice_number: b.invoice_number,
      bill_date: b.bill_date,
      status: b.status,
      hold_code: b.hold_code,
      subtotal: Number(b.subtotal),
      discount: Number(b.discount),
      tax_rate: Number(b.tax_rate),
      tax_amount: Number(b.tax_amount),
      total: Number(b.total),
      payment_type: b.payment_type,
      customer_phone: b.customer_phone,
      note: b.note,
      item_count: items.length,
      completed_at: b.completed_at,
      cancelled_at: b.cancelled_at,
      created_at: b.created_at,
      items,
    }
  }

  public async completeSale(payload: SalePayload): Promise<Bill> {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Cart cannot be empty')
    }
    await localResourceService.assertCartAvailable(payload.items)

    return db.transaction(async (tx) => {
      const date = payload.bill_date || todayISO()
      const invNum = await this.nextInvoiceNumber(date, tx)

      return this.buildBill(tx, {
        cart: payload.items,
        status: 'completed',
        discount: Number(payload.discount || 0),
        paymentType: payload.payment_type || 'cash',
        customerPhone: payload.customer_phone || null,
        note: payload.note || null,
        date,
        invoiceNumber: invNum,
      })
    })
  }

  public async hold(payload: SalePayload): Promise<Bill> {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Cart cannot be empty')
    }

    return db.transaction(async (tx) => {
      const date = payload.bill_date || todayISO()
      const invNum = await this.nextInvoiceNumber(date, tx)
      const holdCode = await this.uniqueHoldCode(tx)

      return this.buildBill(tx, {
        cart: payload.items,
        status: 'hold',
        discount: Number(payload.discount || 0),
        paymentType: payload.payment_type || 'cash',
        customerPhone: payload.customer_phone || null,
        note: payload.note || null,
        date,
        invoiceNumber: invNum,
        holdCode,
      })
    })
  }

  public async holds(): Promise<Bill[]> {
    const rows = await db.query('SELECT * FROM bills WHERE status = "hold" ORDER BY id DESC;')
    const list: Bill[] = []
    for (const r of rows) {
      const items = await this.getBillItems(r.id)
      list.push(this.formatBill(r, items))
    }
    return list
  }

  public async getHold(code: string): Promise<Bill> {
    const row = await db.queryOne('SELECT * FROM bills WHERE hold_code = ? AND status = "hold";', [code.toUpperCase()])
    if (!row) throw new Error(`Held order ${code} not found`)
    const items = await this.getBillItems(row.id)
    return this.formatBill(row, items)
  }

  public async completeHold(code: string, payload: SalePayload): Promise<Bill> {
    await localResourceService.assertCartAvailable(payload.items)

    return db.transaction(async (tx) => {
      const bill = await tx.queryOne('SELECT * FROM bills WHERE hold_code = ? AND status = "hold";', [code.toUpperCase()])
      if (!bill) throw new Error(`Held order ${code} not found`)

      await tx.run('DELETE FROM bill_items WHERE bill_id = ?;', [bill.id])

      const date = payload.bill_date || bill.bill_date || todayISO()
      return this.buildBill(tx, {
        cart: payload.items,
        status: 'completed',
        discount: Number(payload.discount || 0),
        paymentType: payload.payment_type || 'cash',
        customerPhone: payload.customer_phone || null,
        note: payload.note || null,
        date,
        existingBillId: bill.id,
        invoiceNumber: bill.invoice_number,
      })
    })
  }

  public async discardHold(code: string): Promise<void> {
    const nowIso = new Date().toISOString()
    await db.run(
      'UPDATE bills SET status = "cancelled", cancelled_at = ?, updated_at = ?, note = COALESCE(note || " | ", "") || "Hold discarded" WHERE hold_code = ? AND status = "hold";',
      [nowIso, nowIso, code.toUpperCase()]
    )
  }

  public async cancelBill(id: number): Promise<Bill> {
    return db.transaction(async (tx) => {
      const bill = await tx.queryOne('SELECT * FROM bills WHERE id = ?;', [id])
      if (!bill) throw new Error(`Bill #${id} not found`)
      if (bill.status !== 'completed') {
        throw new Error('Only completed bills can be cancelled.')
      }

      const items = await tx.query('SELECT * FROM bill_items WHERE bill_id = ?;', [id])
      const today = todayISO()

      for (const item of items) {
        if (!item.recipe_id) continue
        const recipeItems = await tx.query('SELECT * FROM recipe_items WHERE recipe_id = ?;', [item.recipe_id])

        for (const ri of recipeItems) {
          const res = await tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [ri.production_resource_id])
          if (!res) continue

          const restoreQty = Number(ri.quantity) * Number(item.quantity)
          const balanceAfter = Number(res.current_balance) + restoreQty

          await tx.run(
            `INSERT INTO resource_transactions
             (production_resource_id, date, type, quantity, balance_after, reference_type, reference_id, note)
             VALUES (?, ?, 'SALE_RESTORE', ?, ?, 'bill', ?, ?);`,
            [res.id, today, restoreQty, balanceAfter, bill.id, `Restore for ${bill.invoice_number}`]
          )

          await tx.run('UPDATE production_resources SET current_balance = ?, updated_at = datetime("now") WHERE id = ?;', [
            balanceAfter,
            res.id,
          ])
        }
      }

      const nowIso = new Date().toISOString()
      await tx.run('UPDATE bills SET status = "cancelled", cancelled_at = ?, updated_at = ? WHERE id = ?;', [
        nowIso,
        nowIso,
        id,
      ])

      const updatedBill = await tx.queryOne('SELECT * FROM bills WHERE id = ?;', [id])
      const updatedItems = await this.getBillItems(id)
      return this.formatBill(updatedBill, updatedItems)
    })
  }

  private async buildBill(
    tx: any,
    params: {
      cart: { menu_item_id: number; quantity: number }[]
      status: 'completed' | 'hold'
      discount: number
      paymentType: string
      customerPhone: string | null
      note: string | null
      date: string
      invoiceNumber: string
      holdCode?: string
      existingBillId?: number
    }
  ): Promise<Bill> {
    const taxSetting = await tx.queryOne('SELECT value FROM settings WHERE key = "tax_rate";')
    const taxRate = Number(taxSetting?.value || 0)

    let subtotal = 0
    const linesToInsert: any[] = []

    for (const line of params.cart) {
      const item = await tx.queryOne(`
        SELECT m.*, r.id as recipe_id
        FROM menu_items m
        LEFT JOIN recipes r ON r.menu_item_id = m.id AND r.is_current = 1
        WHERE m.id = ?;
      `, [line.menu_item_id])

      if (!item || !item.recipe_id) {
        throw new Error(`Menu item #${line.menu_item_id} has no active recipe configured.`)
      }

      const qty = Number(line.quantity) || 1
      const unitPrice = Number(item.price)
      const lineTotal = Math.round(unitPrice * qty * 100) / 100
      subtotal += lineTotal

      linesToInsert.push({
        menu_item_id: item.id,
        recipe_id: item.recipe_id,
        item_name: item.name,
        unit_price: unitPrice,
        quantity: qty,
        line_total: lineTotal,
      })
    }

    subtotal = Math.round(subtotal * 100) / 100
    const discount = Math.min(params.discount, subtotal)
    const taxable = Math.max(0, subtotal - discount)
    const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100
    const total = Math.round((taxable + taxAmount) * 100) / 100

    let billId = params.existingBillId

    const nowIso = new Date().toISOString()
    if (billId) {
      await tx.run(
        `UPDATE bills SET
          bill_date = ?, status = ?, subtotal = ?, discount = ?,
          tax_rate = ?, tax_amount = ?, total = ?, payment_type = ?,
          customer_phone = ?, note = ?, completed_at = ?, updated_at = ?
         WHERE id = ?;`,
        [
          params.date,
          params.status,
          subtotal,
          discount,
          taxRate,
          taxAmount,
          total,
          params.paymentType,
          params.customerPhone,
          params.note,
          params.status === 'completed' ? nowIso : null,
          nowIso,
          billId,
        ]
      )
    } else {
      const insertRes = await tx.run(
        `INSERT INTO bills
         (invoice_number, bill_date, status, hold_code, subtotal, discount,
          tax_rate, tax_amount, total, payment_type, customer_phone, note, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          params.invoiceNumber,
          params.date,
          params.status,
          params.holdCode || null,
          subtotal,
          discount,
          taxRate,
          taxAmount,
          total,
          params.paymentType,
          params.customerPhone,
          params.note,
          params.status === 'completed' ? nowIso : null,
          nowIso,
          nowIso,
        ]
      )
      billId = insertRes.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id
    }

    for (const l of linesToInsert) {
      await tx.run(
        `INSERT INTO bill_items (bill_id, menu_item_id, recipe_id, item_name, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [billId!, l.menu_item_id, l.recipe_id, l.item_name, l.unit_price, l.quantity, l.line_total]
      )
    }

    if (params.status === 'completed') {
      await this.deductResources(tx, billId!, params.invoiceNumber, params.date, linesToInsert)
    }

    const savedBill = await tx.queryOne('SELECT * FROM bills WHERE id = ?;', [billId!])
    const items = await this.getBillItems(billId!)
    return this.formatBill(savedBill, items)
  }

  private async deductResources(tx: any, billId: number, invoiceNum: string, date: string, lines: any[]) {
    const consumption: Record<number, number> = {}

    for (const line of lines) {
      const rItems = await tx.query('SELECT * FROM recipe_items WHERE recipe_id = ?;', [line.recipe_id])
      for (const ri of rItems) {
        const resId = Number(ri.production_resource_id)
        consumption[resId] = (consumption[resId] || 0) + Number(ri.quantity) * Number(line.quantity)
      }
    }

    for (const [resIdStr, qty] of Object.entries(consumption)) {
      const resId = Number(resIdStr)
      const resource = await tx.queryOne('SELECT * FROM production_resources WHERE id = ?;', [resId])
      if (!resource) continue

      const newBalance = Math.max(0, Number(resource.current_balance) - qty)

      await tx.run(
        `INSERT INTO resource_transactions
         (production_resource_id, date, type, quantity, balance_after, reference_type, reference_id, note)
         VALUES (?, ?, 'SALE', ?, ?, 'bill', ?, ?);`,
        [resId, date, -qty, newBalance, billId, `Sale ${invoiceNum}`]
      )

      await tx.run('UPDATE production_resources SET current_balance = ?, updated_at = datetime("now") WHERE id = ?;', [
        newBalance,
        resId,
      ])
    }
  }

  private async nextInvoiceNumber(date: string, tx: any): Promise<string> {
    const prefixRow = await tx.queryOne('SELECT value FROM settings WHERE key = "invoice_prefix";')
    const prefix = prefixRow?.value || 'INV'
    const dateFormatted = date.replace(/-/g, '')

    const lastBill = await tx.queryOne(
      'SELECT invoice_number FROM bills WHERE bill_date = ? ORDER BY id DESC LIMIT 1;',
      [date]
    )

    let seq = 1
    if (lastBill?.invoice_number) {
      const parts = lastBill.invoice_number.split('-')
      const lastSeq = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1
      }
    }

    return `${prefix}-${dateFormatted}-${String(seq).padStart(4, '0')}`
  }

  private async uniqueHoldCode(tx: any): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    let exists = true
    while (exists) {
      code = ''
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      const found = await tx.queryOne('SELECT id FROM bills WHERE hold_code = ?;', [code])
      exists = Boolean(found)
    }
    return code
  }
}

export const localSaleService = new LocalSaleService()
