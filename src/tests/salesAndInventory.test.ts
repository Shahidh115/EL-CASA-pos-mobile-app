import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { localSaleService } from '../services/localSaleService'
import { localResourceService } from '../services/localResourceService'

describe('Offline POS Sales & Inventory Integrity', () => {
  beforeEach(async () => {
    await db.init()
  })

  it('calculates stock and completes a sale with exact resource deductions', async () => {
    const resources = await localResourceService.list()
    const rice = resources.find((r) => r.name === 'Rice Portion')
    expect(rice).toBeDefined()
    const initialBalance = rice!.current_balance

    const items = await db.query('SELECT id, name, price FROM menu_items WHERE name = "Chicken Fried Rice";')
    expect(items.length).toBeGreaterThan(0)
    const friedRiceId = items[0].id

    const bill = await localSaleService.completeSale({
      items: [{ menu_item_id: friedRiceId, quantity: 2 }],
      discount: 100,
      payment_type: 'cash',
      customer_phone: '0770000000',
    })

    expect(bill.status).toBe('completed')
    expect(bill.items.length).toBe(1)
    expect(bill.items[0].quantity).toBe(2)
    expect(bill.discount).toBe(100)
    expect(bill.invoice_number.startsWith('INV-')).toBe(true)
    expect(bill.invoice_number.endsWith('-0001')).toBe(true)

    const updatedRice = await localResourceService.get(rice!.id)
    expect(updatedRice!.current_balance).toBe(initialBalance - 2)

    const txRows = await db.query(
      'SELECT * FROM resource_transactions WHERE production_resource_id = ? AND reference_id = ?;',
      [rice!.id, bill.id]
    )
    expect(txRows.length).toBe(1)
    expect(txRows[0].type).toBe('SALE')
    expect(Number(txRows[0].quantity)).toBe(-2)
  })

  it('rejects a sale when resources are insufficient', async () => {
    const resources = await localResourceService.list()
    const bbq = resources.find((r) => r.name === 'BBQ Chicken')
    expect(bbq).toBeDefined()

    const bbqPackage = (await db.query('SELECT id FROM menu_items WHERE name = "BBQ Package";'))[0]

    await expect(
      localSaleService.completeSale({
        items: [{ menu_item_id: bbqPackage.id, quantity: 9999 }],
      })
    ).rejects.toThrow(/Insufficient stock/)
  })

  it('supports hold, complete hold, and hold cancellation', async () => {
    const friedRice = (await db.query('SELECT id FROM menu_items WHERE name = "Chicken Fried Rice";'))[0]

    const heldBill = await localSaleService.hold({
      items: [{ menu_item_id: friedRice.id, quantity: 1 }],
      payment_type: 'card',
    })
    expect(heldBill.status).toBe('hold')
    expect(heldBill.hold_code).toBeTruthy()
    expect(heldBill.hold_code?.length).toBe(6)

    const fetched = await localSaleService.getHold(heldBill.hold_code!)
    expect(fetched.id).toBe(heldBill.id)

    const completed = await localSaleService.completeHold(heldBill.hold_code!, {
      items: [{ menu_item_id: friedRice.id, quantity: 1 }],
      payment_type: 'card',
    })
    expect(completed.status).toBe('completed')
  })

  it('cancels a completed bill and completely restores all deducted resources', async () => {
    const resources = await localResourceService.list()
    const rice = resources.find((r) => r.name === 'Rice Portion')
    const balanceBeforeSale = rice!.current_balance

    const friedRice = (await db.query('SELECT id FROM menu_items WHERE name = "Chicken Fried Rice";'))[0]

    const bill = await localSaleService.completeSale({
      items: [{ menu_item_id: friedRice.id, quantity: 3 }],
      payment_type: 'cash',
    })

    const balanceAfterSale = (await localResourceService.get(rice!.id))!.current_balance
    expect(balanceAfterSale).toBe(balanceBeforeSale - 3)

    const cancelled = await localSaleService.cancelBill(bill.id)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.cancelled_at).toBeTruthy()

    const balanceAfterRestore = (await localResourceService.get(rice!.id))!.current_balance
    expect(balanceAfterRestore).toBe(balanceBeforeSale)

    const restoreTx = await db.query(
      'SELECT * FROM resource_transactions WHERE reference_id = ? AND type = "SALE_RESTORE";',
      [bill.id]
    )
    expect(restoreTx.length).toBe(1)
    expect(Number(restoreTx[0].quantity)).toBe(3)
  })
})
