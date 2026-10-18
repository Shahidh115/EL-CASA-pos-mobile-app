import { db } from '@/db/database'
import type { MenuItem } from '@/types'
import { localResourceService } from './localResourceService'

export class LocalMenuItemService {
  public async list(includeArchived = false): Promise<MenuItem[]> {
    const where = includeArchived ? '' : 'WHERE m.is_active = 1 AND m.archived_at IS NULL'
    const sql = `
      SELECT m.*, c.name as category_name,
             r.id as current_recipe_id, r.version as recipe_version
      FROM menu_items m
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN recipes r ON r.menu_item_id = m.id AND r.is_current = 1
      ${where}
      ORDER BY m.sort_order ASC, m.name ASC;
    `
    const rows = await db.query(sql)
    const list: MenuItem[] = []

    for (const r of rows) {
      const maxPrep = await localResourceService.itemMaxQuantity(r.id)
      list.push({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        price: Number(r.price),
        category_id: r.category_id,
        category: r.category_name,
        image_path: r.image_path,
        image_url: r.image_path,
        is_active: Boolean(r.is_active),
        is_favourite: Boolean(r.is_favourite),
        sort_order: r.sort_order,
        archived_at: r.archived_at,
        has_recipe: Boolean(r.current_recipe_id),
        current_recipe_id: r.current_recipe_id || null,
        recipe_version: r.recipe_version || null,
        max_preparable: maxPrep,
      })
    }
    return list
  }

  public async get(id: number): Promise<MenuItem | null> {
    const sql = `
      SELECT m.*, c.name as category_name,
             r.id as current_recipe_id, r.version as recipe_version
      FROM menu_items m
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN recipes r ON r.menu_item_id = m.id AND r.is_current = 1
      WHERE m.id = ?;
    `
    const r = await db.queryOne(sql, [id])
    if (!r) return null

    const maxPrep = await localResourceService.itemMaxQuantity(r.id)
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      price: Number(r.price),
      category_id: r.category_id,
      category: r.category_name,
      image_path: r.image_path,
      image_url: r.image_path,
      is_active: Boolean(r.is_active),
      is_favourite: Boolean(r.is_favourite),
      sort_order: r.sort_order,
      archived_at: r.archived_at,
      has_recipe: Boolean(r.current_recipe_id),
      current_recipe_id: r.current_recipe_id || null,
      recipe_version: r.recipe_version || null,
      max_preparable: maxPrep,
    }
  }

  public async create(data: { name: string; price: number; category_id: number; description?: string }): Promise<MenuItem> {
    let slug = data.name.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const exists = await db.queryOne('SELECT id FROM menu_items WHERE slug = ?;', [slug])
    if (exists) {
      slug += '-' + Math.random().toString(36).substring(2, 6)
    }

    const ins = await db.run(
      'INSERT INTO menu_items (category_id, name, slug, description, price, is_active) VALUES (?, ?, ?, ?, ?, 1);',
      [data.category_id, data.name.trim(), slug, data.description || null, data.price]
    )
    const id = ins.lastId || (await db.queryOne('SELECT last_insert_rowid() as id')).id
    return (await this.get(id))!
  }

  public async update(id: number, data: { name?: string; price?: number; category_id?: number; description?: string }): Promise<MenuItem> {
    const current = await this.get(id)
    if (!current) throw new Error(`Menu item #${id} not found`)

    const name = data.name !== undefined ? data.name.trim() : current.name
    const price = data.price !== undefined ? data.price : current.price
    const catId = data.category_id !== undefined ? data.category_id : current.category_id
    const desc = data.description !== undefined ? data.description : current.description

    await db.run(
      'UPDATE menu_items SET name = ?, price = ?, category_id = ?, description = ?, updated_at = datetime("now") WHERE id = ?;',
      [name, price, catId, desc, id]
    )
    return (await this.get(id))!
  }

  public async toggleFavourite(id: number): Promise<MenuItem> {
    await db.run('UPDATE menu_items SET is_favourite = CASE WHEN is_favourite = 1 THEN 0 ELSE 1 END WHERE id = ?;', [id])
    return (await this.get(id))!
  }

  public async archive(id: number): Promise<MenuItem> {
    await db.run('UPDATE menu_items SET is_active = 0, archived_at = datetime("now") WHERE id = ?;', [id])
    return (await this.get(id))!
  }

  public async restore(id: number): Promise<MenuItem> {
    await db.run('UPDATE menu_items SET is_active = 1, archived_at = NULL WHERE id = ?;', [id])
    return (await this.get(id))!
  }

  public async uploadImage(id: number, imageBase64: string): Promise<MenuItem> {
    await db.run('UPDATE menu_items SET image_path = ? WHERE id = ?;', [imageBase64, id])
    return (await this.get(id))!
  }

  public async delete(id: number): Promise<string> {
    return db.transaction(async (tx) => {
      const item = await tx.queryOne('SELECT * FROM menu_items WHERE id = ?;', [id])
      if (!item) throw new Error(`Menu item #${id} not found`)

      // Unlink from bill items to preserve sales audit history
      await tx.run('UPDATE bill_items SET menu_item_id = NULL, recipe_id = NULL WHERE menu_item_id = ?;', [id])

      const recipes = await tx.query('SELECT id FROM recipes WHERE menu_item_id = ?;', [id])
      for (const r of recipes) {
        await tx.run('DELETE FROM recipe_items WHERE recipe_id = ?;', [r.id])
      }
      await tx.run('DELETE FROM recipes WHERE menu_item_id = ?;', [id])
      await tx.run('DELETE FROM menu_items WHERE id = ?;', [id])

      return item.name
    })
  }
}

export const localMenuItemService = new LocalMenuItemService()
