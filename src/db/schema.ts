export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  archived_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS production_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'Portion',
  warning_level REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  archived_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price REAL DEFAULT 0,
  image_path TEXT,
  is_active INTEGER DEFAULT 1,
  is_favourite INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  archived_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  version INTEGER DEFAULT 1,
  name TEXT,
  is_current INTEGER DEFAULT 0,
  archived_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE,
  UNIQUE(menu_item_id, version)
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL,
  production_resource_id INTEGER NOT NULL,
  quantity REAL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
  FOREIGN KEY (production_resource_id) REFERENCES production_resources (id) ON DELETE CASCADE,
  UNIQUE(recipe_id, production_resource_id)
);

CREATE TABLE IF NOT EXISTS daily_production (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  production_resource_id INTEGER NOT NULL,
  opening_quantity REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (production_resource_id) REFERENCES production_resources (id) ON DELETE CASCADE,
  UNIQUE(date, production_resource_id)
);

CREATE TABLE IF NOT EXISTS production_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  production_resource_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (production_resource_id) REFERENCES production_resources (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  bill_date TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  hold_code TEXT,
  subtotal REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  payment_type TEXT DEFAULT 'cash',
  customer_phone TEXT,
  note TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL,
  menu_item_id INTEGER,
  recipe_id INTEGER,
  item_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity REAL DEFAULT 1,
  line_total REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE SET NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS resource_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  production_resource_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  balance_after REAL NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (production_resource_id) REFERENCES production_resources (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wastes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  production_resource_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (production_resource_id) REFERENCES production_resources (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bills_date ON bills (bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills (status);
CREATE INDEX IF NOT EXISTS idx_bills_hold_code ON bills (hold_code);
CREATE INDEX IF NOT EXISTS idx_transactions_res_date ON resource_transactions (production_resource_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON resource_transactions (date, type);
CREATE INDEX IF NOT EXISTS idx_wastes_type ON wastes (type);
`;
