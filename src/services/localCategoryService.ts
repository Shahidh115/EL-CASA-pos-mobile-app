import { db } from '@/db/database'
import type { Category } from '@/types'

export class LocalCategoryService {
  public async list(includeArchived = false): Promise<Category[]> {
    const where = includeArchived ? '' : 'WHERE c.is_active = 1 AND c.archived_at IS NULL'
    const sql = `
      SELECT c.*,
             (SELECT count(*) FROM menu_items m WHERE m.category_id = c.id AND m.is_active = 1) as menu_items_count
      FROM categories c
      ${where}
      ORDER BY c.sort_order ASC, c.name ASC;
    `
    const rows = await db.query(sql)
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      sort_order: r.sort_order,
      is_active: Boolean(r.is_active),
      archived_at: r.archived_at,
      menu_items_count: Number(r.menu_items_count || 0),
    }))
  }

  public async create(data: { name: string; description?: string }): Promise<Category> {
    let slug = data.name.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const exists = await db.queryOne('SELECT id FROM categories WHERE slug = ?;', [slug])
    if (exists) {
      slug += '-' + Math.random().toString(36).substring(2, 6)
    }

    const maxSortRow = await db.queryOne('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM categories;')
    const sort = Number(maxSortRow?.max_sort || 0) + 1

    const ins = await db.run(
      'INSERT INTO categories (name, slug, description, sort_order, is_active) VALUES (?, ?, ?, ?, 1);',
      [data.name.trim(), slug, data.description || null, sort]
    )
    const id = ins.lastId || (await db.queryOne('SELECT last_insert_rowid() as id')).id
    return (await this.get(id))!
  }

  public async get(id: number): Promise<Category | null> {
    const row = await db.queryOne('SELECT * FROM categories WHERE id = ?;', [id])
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sort_order: row.sort_order,
      is_active: Boolean(row.is_active),
      archived_at: row.archived_at,
    }
  }

  public async update(id: number, data: { name?: string; description?: string }): Promise<Category> {
    const current = await this.get(id)
    if (!current) throw new Error(`Category #${id} not found`)
    const name = data.name !== undefined ? data.name.trim() : current.name
    const desc = data.description !== undefined ? data.description : current.description

    await db.run('UPDATE categories SET name = ?, description = ?, updated_at = datetime("now") WHERE id = ?;', [
      name,
      desc,
      id,
    ])
    return (await this.get(id))!
  }

  public async archive(id: number): Promise<Category> {
    await db.transaction(async (tx) => {
      await tx.run('UPDATE categories SET is_active = 0, archived_at = datetime("now") WHERE id = ?;', [id])
      await tx.run('UPDATE menu_items SET is_active = 0, archived_at = datetime("now") WHERE category_id = ?;', [id])
    })
    return (await this.get(id))!
  }

  public async restore(id: number): Promise<Category> {
    await db.transaction(async (tx) => {
      await tx.run('UPDATE categories SET is_active = 1, archived_at = NULL WHERE id = ?;', [id])
      await tx.run('UPDATE menu_items SET is_active = 1, archived_at = NULL WHERE category_id = ?;', [id])
    })
    return (await this.get(id))!
  }

  public async delete(id: number): Promise<{ category_name: string; deleted_items_count: number }> {
    return db.transaction(async (tx) => {
      const cat = await tx.queryOne('SELECT * FROM categories WHERE id = ?;', [id])
      if (!cat) throw new Error(`Category #${id} not found`)

      const items = await tx.query('SELECT id FROM menu_items WHERE category_id = ?;', [id])
      for (const item of items) {
        await tx.run('UPDATE bill_items SET menu_item_id = NULL, recipe_id = NULL WHERE menu_item_id = ?;', [item.id])
        const recipes = await tx.query('SELECT id FROM recipes WHERE menu_item_id = ?;', [item.id])
        for (const r of recipes) {
          await tx.run('DELETE FROM recipe_items WHERE recipe_id = ?;', [r.id])
        }
        await tx.run('DELETE FROM recipes WHERE menu_item_id = ?;', [item.id])
        await tx.run('DELETE FROM menu_items WHERE id = ?;', [item.id])
      }

      await tx.run('DELETE FROM categories WHERE id = ?;', [id])

      return {
        category_name: cat.name,
        deleted_items_count: items.length,
      }
    })
  }
}

export const localCategoryService = new LocalCategoryService()
