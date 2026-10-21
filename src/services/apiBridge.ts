import { todayISO } from '@/lib/utils'
import { localCategoryService } from './localCategoryService'
import { localMenuItemService } from './localMenuItemService'
import { localRecipeService } from './localRecipeService'
import { localProductionService } from './localProductionService'
import { localResourceService } from './localResourceService'
import { localSaleService } from './localSaleService'
import { localWasteService } from './localWasteService'
import { localReportService } from './localReportService'
import { localSettingsService } from './localSettingsService'
import { db } from '@/db/database'

export async function handleLocalApi(method: string, path: string, data?: any, params?: any): Promise<any> {
  const cleanPath = path.replace(/^\/?(api\/v1\/|\/)?/, '')
  const parts = cleanPath.split('?')[0].split('/')

  // Dashboard
  if (parts[0] === 'dashboard' && method === 'GET') {
    return localReportService.dashboard()
  }

  // Reports
  if (parts[0] === 'reports') {
    const sub = parts[1]
    const p = params || data || {}
    if (sub === 'summary') return localReportService.salesSummary(p.from, p.to)
    if (sub === 'food-sales' || sub === 'today-sales' || sub === 'product-sales') {
      const from = p.from || p.date || todayISO()
      const to = p.to || p.date || from
      return localReportService.productSales(from, to)
    }
    if (sub === 'resource-usage') return localReportService.resourceUsage(p.from, p.to)
    if (sub === 'waste') return localReportService.wasteReport(p.from, p.to)
    if (sub === 'hourly') return localReportService.hourlySales(p.date)
    if (sub === 'trends') return localReportService.salesTrends(p.from, p.to)
  }

  // POS
  if (parts[0] === 'pos') {
    if (parts[1] === 'data' && method === 'GET') {
      const items = await localMenuItemService.list()
      const categories = await localCategoryService.list()
      const resources = await localResourceService.list()
      const settings = await localSettingsService.all()
      return {
        menu_items: items,
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        resources,
        settings,
      }
    }
    if (parts[1] === 'sale' && method === 'POST') {
      return localSaleService.completeSale(data)
    }
    if (parts[1] === 'hold' && method === 'POST') {
      return localSaleService.hold(data)
    }
    if (parts[1] === 'holds' && method === 'GET') {
      return localSaleService.holds()
    }
    if (parts[1] === 'holds' && parts[3] === 'complete' && method === 'POST') {
      return localSaleService.completeHold(parts[2], data)
    }
    if (parts[1] === 'holds' && method === 'DELETE') {
      return localSaleService.discardHold(parts[2])
    }
    if (parts[1] === 'receipt' && method === 'GET') {
      return localSaleService.get(Number(parts[2]))
    }
  }

  // Bills
  if (parts[0] === 'bills') {
    if (parts.length === 1 && method === 'GET') {
      return localSaleService.list(params)
    }
    if (parts.length === 2 && method === 'GET') {
      return localSaleService.get(Number(parts[1]))
    }
    if (parts[2] === 'cancel' && method === 'POST') {
      return localSaleService.cancelBill(Number(parts[1]))
    }
  }

  // Categories
  if (parts[0] === 'categories') {
    if (parts.length === 1 && method === 'GET') return localCategoryService.list(Boolean(params?.all))
    if (parts.length === 1 && method === 'POST') return localCategoryService.create(data)
    if (parts.length === 2 && method === 'PUT') return localCategoryService.update(Number(parts[1]), data)
    if (parts[2] === 'archive' && method === 'POST') return localCategoryService.archive(Number(parts[1]))
    if (parts[2] === 'restore' && method === 'POST') return localCategoryService.restore(Number(parts[1]))
    if (parts.length === 2 && method === 'DELETE') return localCategoryService.delete(Number(parts[1]))
  }

  // Menu items
  if (parts[0] === 'menu-items') {
    if (parts.length === 1 && method === 'GET') return localMenuItemService.list(Boolean(params?.all))
    if (parts.length === 1 && method === 'POST') return localMenuItemService.create(data)
    if (parts.length === 2 && method === 'GET') return localMenuItemService.get(Number(parts[1]))
    if (parts.length === 2 && method === 'PUT') return localMenuItemService.update(Number(parts[1]), data)
    if (parts[2] === 'archive' && method === 'POST') return localMenuItemService.archive(Number(parts[1]))
    if (parts[2] === 'restore' && method === 'POST') return localMenuItemService.restore(Number(parts[1]))
    if (parts[2] === 'favourite' && method === 'POST') return localMenuItemService.toggleFavourite(Number(parts[1]))
    if (parts[2] === 'image' && method === 'POST') return localMenuItemService.uploadImage(Number(parts[1]), data.image)
    if (parts.length === 2 && method === 'DELETE') return localMenuItemService.delete(Number(parts[1]))
    if (parts[2] === 'recipes' && method === 'GET') return localRecipeService.versionsFor(Number(parts[1]))
    if (parts[2] === 'recipes' && method === 'POST') return localRecipeService.createVersion(Number(parts[1]), data.items, data.name)
  }

  // Recipes
  if (parts[0] === 'recipes') {
    if (parts.length === 2 && method === 'PUT') return localRecipeService.updateItems(Number(parts[1]), data.items)
    if (parts[2] === 'activate' && method === 'POST') return localRecipeService.activateVersion(Number(parts[1]))
    if (parts.length === 2 && method === 'DELETE') return localRecipeService.delete(Number(parts[1]))
  }

  // Resources
  if (parts[0] === 'resources') {
    if (parts[1] === 'units' && method === 'GET') {
      return ['Portion', 'Piece', 'Kg', 'Gram', 'Liter', 'Ml', 'Can', 'Bottle']
    }
    if (parts.length === 1 && method === 'GET') return localResourceService.list(Boolean(params?.all))
    if (parts.length === 1 && method === 'POST') return localResourceService.create(data)
    if (parts.length === 2 && method === 'GET') return localResourceService.get(Number(parts[1]))
    if (parts.length === 2 && method === 'PUT') return localResourceService.update(Number(parts[1]), data)
    if (parts[2] === 'archive' && method === 'POST') return localResourceService.archive(Number(parts[1]))
    if (parts[2] === 'restore' && method === 'POST') return localResourceService.restore(Number(parts[1]))
    if (parts[2] === 'adjust' && method === 'POST') return localResourceService.manualAdjust(Number(parts[1]), Number(data.quantity), data.note)
  }

  // Daily production
  if (parts[0] === 'production') {
    if (parts[1] === 'opening' && method === 'GET') return localProductionService.openingFor(params?.date)
    if (parts[1] === 'history' && method === 'GET') return localProductionService.historyFor(params?.date)
    if (parts[1] === 'opening' && method === 'POST') return localProductionService.setOpening(data.resource_id, Number(data.quantity), data.date)
    if (parts[1] === 'add' && method === 'POST') return localProductionService.addProduction(data.resource_id, Number(data.quantity), data.note, data.date)
    if (parts[1] === 'quick-add' && method === 'POST') return localProductionService.addProduction(data.resource_id, Number(data.quantity), 'Quick-add', data.date)
    if (parts[1] === 'reset-all' && method === 'POST') return localProductionService.resetAll(data?.date)
  }

  // Wastes
  if (parts[0] === 'wastes') {
    if (parts[1] === 'types' && method === 'GET') {
      return ['BURNT', 'SPOILED', 'STAFF_MEAL', 'DAMAGED', 'MANUAL']
    }
    if (parts.length === 1 && method === 'GET') return localWasteService.list(params)
    if (parts.length === 1 && method === 'POST') {
      if (data.menu_item_id) {
        return localWasteService.recordMenuItem(data)
      }
      return localWasteService.record(data)
    }
  }

  // Transactions
  if (parts[0] === 'transactions' && method === 'GET') {
    const p = params || {}
    const conditions = []
    const sqlParams = []
    if (p.from && p.to) {
      conditions.push('rt.date >= ? AND rt.date <= ?')
      sqlParams.push(p.from, p.to)
    }
    if (p.resource_id) {
      conditions.push('rt.production_resource_id = ?')
      sqlParams.push(p.resource_id)
    }
    if (p.type) {
      conditions.push('rt.type = ?')
      sqlParams.push(p.type)
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `
      SELECT rt.*, r.name as resource, r.unit
      FROM resource_transactions rt
      JOIN production_resources r ON r.id = rt.production_resource_id
      ${where}
      ORDER BY rt.id DESC
      LIMIT 200;
    `
    return db.query(sql, sqlParams)
  }

  // Settings
  if (parts[0] === 'settings') {
    if (parts.length === 1 && method === 'GET') return localSettingsService.all()
    if (parts.length === 1 && method === 'PUT') return localSettingsService.update(data)
    if (parts[1] === 'logo' && method === 'POST') return localSettingsService.uploadLogo(data.logo)
  }

  throw new Error(`Local API route not found: ${method} ${path}`)
}
