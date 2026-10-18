export async function seedDatabaseIfEmpty(db: any): Promise<void> {
  const existingSettings = await db.query('SELECT count(*) as count FROM settings;')
  if (existingSettings[0]?.count > 0) {
    return
  }

  console.log('Seeding initial EL CASA ROMS data into SQLite...')

  await db.transaction(async (tx: any) => {
    // 1. Settings
    const defaultSettings: Record<string, string> = {
      restaurant_name: 'EL CASA',
      logo_path: '',
      address: '123 Main Street, Colombo',
      phone: '+94 11 234 5678',
      receipt_header: 'Welcome to EL CASA',
      receipt_footer: 'Thank you! Please come again.',
      currency: 'Rs.',
      tax_rate: '0',
      printer_config: JSON.stringify({
        type: 'system',
        paperWidth: '80mm',
        autoCut: true,
        openCashDrawer: false,
        printLogo: false,
        copies: 1,
      }),
      invoice_prefix: 'INV',
    }

    for (const [key, value] of Object.entries(defaultSettings)) {
      await tx.run('INSERT INTO settings (key, value) VALUES (?, ?);', [key, value])
    }

    // 2. Production Resources
    const resources = [
      { name: 'Rice Portion', unit: 'Portion', warning_level: 10, current_balance: 50 },
      { name: 'Dough Ball', unit: 'Piece', warning_level: 10, current_balance: 100 },
      { name: 'BBQ Chicken', unit: 'Piece', warning_level: 5, current_balance: 20 },
      { name: 'Mandi Portion', unit: 'Portion', warning_level: 5, current_balance: 15 },
      { name: 'Biriyani Portion', unit: 'Portion', warning_level: 5, current_balance: 15 },
    ]

    const resourceIdMap: Record<string, number> = {}
    for (const res of resources) {
      const result = await tx.run(
        'INSERT INTO production_resources (name, unit, warning_level, current_balance) VALUES (?, ?, ?, ?);',
        [res.name, res.unit, res.warning_level, res.current_balance]
      )
      const resId = result.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id
      resourceIdMap[res.name] = resId

      // Opening resource transaction
      const today = new Date().toISOString().slice(0, 10)
      await tx.run(
        'INSERT INTO resource_transactions (production_resource_id, date, type, quantity, balance_after, note) VALUES (?, ?, ?, ?, ?, ?);',
        [resId, today, 'OPENING', res.current_balance, res.current_balance, 'Initial opening stock']
      )

      await tx.run(
        'INSERT INTO daily_production (date, production_resource_id, opening_quantity) VALUES (?, ?, ?);',
        [today, resId, res.current_balance]
      )
    }

    // 3. Categories
    const categories = ['Rice', 'Kottu', 'Parata', 'BBQ', 'Shawarma', 'Drinks', 'Desserts']
    const categoryIdMap: Record<string, number> = {}

    for (let i = 0; i < categories.length; i++) {
      const name = categories[i]
      const slug = name.toLowerCase().replace(/\\s+/g, '-')
      const result = await tx.run(
        'INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?);',
        [name, slug, i]
      )
      const catId = result.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id
      categoryIdMap[name] = catId
    }

    // 4. Menu items & recipes
    const menuItems = [
      { name: 'Chicken Fried Rice', category: 'Rice', price: 950, recipe: { 'Rice Portion': 1 } },
      { name: 'Mixed Fried Rice', category: 'Rice', price: 1100, recipe: { 'Rice Portion': 1 } },
      { name: 'Nasi Goreng', category: 'Rice', price: 1050, recipe: { 'Rice Portion': 1 } },
      { name: 'Parata', category: 'Parata', price: 120, recipe: { 'Dough Ball': 1 } },
      { name: 'Egg Roti', category: 'Parata', price: 180, recipe: { 'Dough Ball': 1 } },
      { name: 'Chicken Kottu', category: 'Kottu', price: 1300, recipe: { 'Dough Ball': 2 } },
      { name: 'Shawarma', category: 'Shawarma', price: 650, recipe: { 'Dough Ball': 1 } },
      { name: 'BBQ Package', category: 'BBQ', price: 4500, recipe: { 'BBQ Chicken': 1, 'Dough Ball': 4 } },
    ]

    for (const item of menuItems) {
      const slug = item.name.toLowerCase().replace(/\\s+/g, '-')
      const catId = categoryIdMap[item.category]
      const itemRes = await tx.run(
        'INSERT INTO menu_items (category_id, name, slug, price, is_active, is_favourite) VALUES (?, ?, ?, ?, 1, 0);',
        [catId, item.name, slug, item.price]
      )
      const itemId = itemRes.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id

      // Create recipe v1
      const recipeRes = await tx.run(
        'INSERT INTO recipes (menu_item_id, version, name, is_current) VALUES (?, 1, ?, 1);',
        [itemId, 'Standard Version']
      )
      const recipeId = recipeRes.lastId || (await tx.queryOne('SELECT last_insert_rowid() as id')).id

      for (const [resName, qty] of Object.entries(item.recipe)) {
        const resId = resourceIdMap[resName]
        if (resId) {
          await tx.run(
            'INSERT INTO recipe_items (recipe_id, production_resource_id, quantity) VALUES (?, ?, ?);',
            [recipeId, resId, qty]
          )
        }
      }
    }
  })

  console.log('Database seeded successfully!')
}
