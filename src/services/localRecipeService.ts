import { db } from '@/db/database'
import type { RecipeDto } from '@/types'

export class LocalRecipeService {
  public async versionsFor(menuItemId: number): Promise<RecipeDto[]> {
    const recipes = await db.query(
      'SELECT * FROM recipes WHERE menu_item_id = ? ORDER BY version DESC;',
      [menuItemId]
    )

    const list: RecipeDto[] = []
    for (const r of recipes) {
      const items = await db.query(`
        SELECT ri.id as recipe_item_id, ri.production_resource_id as resource_id,
               ri.quantity, res.name as resource, res.unit
        FROM recipe_items ri
        JOIN production_resources res ON res.id = ri.production_resource_id
        WHERE ri.recipe_id = ?;
      `, [r.id])

      list.push({
        id: r.id,
        version: r.version,
        name: r.name,
        is_current: Boolean(r.is_current),
        created_at: r.created_at,
        items: items.map((i: any) => ({
          recipe_item_id: i.recipe_item_id,
          resource_id: i.resource_id,
          resource: i.resource,
          unit: i.unit,
          quantity: Number(i.quantity),
        })),
      })
    }
    return list
  }

  public async createVersion(
    menuItemId: number,
    items: { production_resource_id: number; quantity: number }[],
    name?: string | null
  ): Promise<RecipeDto> {
    if (!items || items.length === 0) {
      throw new Error('A recipe must contain at least one resource line.')
    }

    return db.transaction(async (tx) => {
      const maxVerRow = await tx.queryOne(
        'SELECT COALESCE(MAX(version), 0) as max_ver FROM recipes WHERE menu_item_id = ?;',
        [menuItemId]
      )
      const nextVer = Number(maxVerRow?.max_ver || 0) + 1

      const ins = await tx.run(
        'INSERT INTO recipes (menu_item_id, version, name, is_current) VALUES (?, ?, ?, 1);',
        [menuItemId, nextVer, name || null]
      )
      const recipeId = ins.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id

      for (const line of items) {
        await tx.run(
          'INSERT INTO recipe_items (recipe_id, production_resource_id, quantity) VALUES (?, ?, ?);',
          [recipeId, line.production_resource_id, line.quantity]
        )
      }

      await tx.run('UPDATE recipes SET is_current = 0 WHERE menu_item_id = ? AND id != ?;', [
        menuItemId,
        recipeId,
      ])

      const versions = await this.versionsFor(menuItemId)
      return versions.find((v) => v.id === recipeId)!
    })
  }

  public async updateItems(recipeId: number, items: { production_resource_id: number; quantity: number }[]): Promise<RecipeDto> {
    return db.transaction(async (tx) => {
      const recipe = await tx.queryOne('SELECT * FROM recipes WHERE id = ?;', [recipeId])
      if (!recipe) throw new Error(`Recipe #${recipeId} not found`)

      const salesCheck = await tx.queryOne('SELECT id FROM bill_items WHERE recipe_id = ? LIMIT 1;', [recipeId])
      if (salesCheck) {
        throw new Error('This recipe version is referenced by historical sales and can no longer be edited. Create a new version instead.')
      }

      await tx.run('DELETE FROM recipe_items WHERE recipe_id = ?;', [recipeId])
      for (const l of items) {
        await tx.run(
          'INSERT INTO recipe_items (recipe_id, production_resource_id, quantity) VALUES (?, ?, ?);',
          [recipeId, l.production_resource_id, l.quantity]
        )
      }

      const versions = await this.versionsFor(recipe.menu_item_id)
      return versions.find((v) => v.id === recipeId)!
    })
  }

  public async activateVersion(recipeId: number): Promise<void> {
    await db.transaction(async (tx) => {
      const recipe = await tx.queryOne('SELECT menu_item_id FROM recipes WHERE id = ?;', [recipeId])
      if (!recipe) throw new Error(`Recipe #${recipeId} not found`)

      await tx.run('UPDATE recipes SET is_current = 1 WHERE id = ?;', [recipeId])
      await tx.run('UPDATE recipes SET is_current = 0 WHERE menu_item_id = ? AND id != ?;', [
        recipe.menu_item_id,
        recipeId,
      ])
    })
  }

  public async delete(recipeId: number): Promise<void> {
    const salesCheck = await db.queryOne('SELECT id FROM bill_items WHERE recipe_id = ? LIMIT 1;', [recipeId])
    if (salesCheck) {
      throw new Error('This recipe version is referenced by historical sales and cannot be deleted.')
    }
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM recipe_items WHERE recipe_id = ?;', [recipeId])
      await tx.run('DELETE FROM recipes WHERE id = ?;', [recipeId])
    })
  }
}

export const localRecipeService = new LocalRecipeService()
