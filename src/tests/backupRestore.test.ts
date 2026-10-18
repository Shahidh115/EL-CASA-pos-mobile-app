import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { localBackupService } from '../services/localBackupService'
import { localMenuItemService } from '../services/localMenuItemService'
import { localSaleService } from '../services/localSaleService'

describe('Offline Database Backup and Restore', () => {
  beforeEach(async () => {
    await db.init()
  })

  it('exports valid JSON backup containing all relational tables', async () => {
    const jsonStr = await localBackupService.exportBackup()
    expect(jsonStr).toBeTruthy()

    const parsed = JSON.parse(jsonStr)
    expect(parsed.version).toBe(1)
    expect(parsed.restaurant_name).toBeTruthy()
    expect(Array.isArray(parsed.categories)).toBe(true)
    expect(Array.isArray(parsed.production_resources)).toBe(true)
    expect(Array.isArray(parsed.menu_items)).toBe(true)
    expect(Array.isArray(parsed.recipes)).toBe(true)
    expect(Array.isArray(parsed.settings)).toBe(true)
  })

  it('successfully restores from JSON backup without data corruption', async () => {
    // 1. Export initial state
    const backupJson = await localBackupService.exportBackup()

    // 2. Create a unique test item
    const testItem = await localMenuItemService.create({
      name: 'Backup Test Burger',
      price: 550,
      category_id: 1,
      description: 'Temporary item for backup test',
    })

    const found = await localMenuItemService.get(testItem.id)
    expect(found).toBeTruthy()

    // 3. Restore original backup
    const result = await localBackupService.importBackup(backupJson)
    expect(result.success).toBe(true)

    // 4. Verify test item is no longer present, restoring original state cleanly
    const restoredCheck = await localMenuItemService.get(testItem.id)
    expect(restoredCheck).toBeNull()
  })
})
