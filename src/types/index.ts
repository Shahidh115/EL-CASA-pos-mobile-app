export interface Category {
  id: number
  name: string
  slug: string
  description?: string | null
  sort_order: number
  is_active: boolean
  archived_at?: string | null
  menu_items_count?: number
}

export interface ProductionResource {
  id: number
  name: string
  unit: string
  warning_level: number
  current_balance: number
  is_active: boolean
  archived_at?: string | null
  recipe_count?: number
  is_low?: boolean
}

export interface RecipeItemDto {
  recipe_item_id?: number
  resource_id: number
  resource: string
  unit: string
  quantity: number
}

export interface RecipeDto {
  id: number
  version: number
  name?: string | null
  is_current: boolean
  created_at?: string
  items: RecipeItemDto[]
}

export interface MenuItem {
  id: number
  name: string
  slug: string
  description?: string | null
  price: number
  category_id: number
  category?: string
  image_path?: string | null
  image_url?: string | null
  is_active: boolean
  is_favourite: boolean
  sort_order: number
  archived_at?: string | null
  has_recipe: boolean
  current_recipe_id?: number | null
  recipe_version?: number | null
  recipe?: { id: number; version: number; items: RecipeItemDto[] } | null
  max_preparable: number
}

export interface BillItem {
  id: number
  bill_id?: number
  menu_item_id: number | null
  recipe_id?: number | null
  name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Bill {
  id: number
  invoice_number: string
  bill_date?: string
  status: 'completed' | 'hold' | 'cancelled'
  hold_code?: string | null
  subtotal: number
  discount: number
  tax_rate: number
  tax_amount: number
  total: number
  payment_type: string
  customer_phone?: string | null
  note?: string | null
  item_count: number
  completed_at?: string | null
  cancelled_at?: string | null
  created_at: string
  items: BillItem[]
}

export interface Paginated<T> {
  items: T[]
  pagination: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export interface ResourceTransaction {
  id: number
  resource_id: number
  resource: string
  unit: string
  type:
    | 'OPENING'
    | 'PRODUCTION'
    | 'SALE'
    | 'SALE_RESTORE'
    | 'WASTE'
    | 'MANUAL_ADJUSTMENT'
  quantity: number
  balance_after: number
  reference_type?: string | null
  reference_id?: number | null
  note?: string | null
  date: string
  created_at: string
}

export interface Waste {
  id: number
  resource_id: number
  resource: string
  unit: string
  type: string
  quantity: number
  note?: string | null
  created_at: string
}

export interface PosData {
  menu_items: MenuItem[]
  categories: { id: number; name: string }[]
  resources: {
    id: number
    name: string
    unit: string
    current_balance: number
    warning_level: number
    is_low: boolean
  }[]
  settings: SettingsData
}

export interface DashboardData {
  date: string
  summary: {
    revenue: number
    discount: number
    sales_count: number
    items_sold: number
    average_bill: number
  }
  top_selling: { menu_item_id: number; name: string; quantity: number; revenue: number }[]
  hourly_sales: { hour: number; label: string; count: number; revenue: number }[]
  low_resources: {
    id: number
    name: string
    unit: string
    current_balance: number
    warning_level: number
  }[]
  recent_bills: Bill[]
  production_capacity: {
    menu_item_id: number
    name: string
    price: number
    max_preparable: number
    limiting_resource?: string | null
  }[]
}

export interface SettingsData {
  restaurant_name?: string | null
  logo_path?: string | null
  address?: string | null
  phone?: string | null
  receipt_header?: string | null
  receipt_footer?: string | null
  currency: string
  tax_rate: number
  printer_config?: string | null
  invoice_prefix: string
}

export interface PrinterConfig {
  type: 'system' | 'bluetooth' | 'network'
  paperWidth: '58mm' | '80mm'
  targetAddress?: string
  port?: number
  autoCut: boolean
  openCashDrawer: boolean
  printLogo: boolean
  copies: number
}

export interface BackupPayload {
  version: number
  exported_at: string
  restaurant_name: string
  categories: any[]
  production_resources: any[]
  menu_items: any[]
  recipes: any[]
  recipe_items: any[]
  daily_production: any[]
  production_adjustments: any[]
  bills: any[]
  bill_items: any[]
  resource_transactions: any[]
  wastes: any[]
  settings: any[]
}

export interface ProductSaleItem {
  menu_item_id: number
  name: string
  category: string
  price: number
  quantity: number
  revenue: number
  orders_count: number
}
