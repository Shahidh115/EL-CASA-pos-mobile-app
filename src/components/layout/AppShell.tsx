import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  ReceiptText,
  Utensils,
  Factory,
  Package,
  PackageMinus,
  History,
  BarChart3,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  X,
  Moon,
  Sun,
  Database,
  Radio,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/useThemeStore'
import { useSettings } from '@/hooks/useData'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS Billing', icon: ShoppingCart },
  { to: '/sales', label: 'Sales History', icon: ReceiptText },
  { to: '/menu', label: 'Menu & Recipes', icon: Utensils },
  { to: '/production', label: 'Daily Production', icon: Factory },
  { to: '/resources', label: 'Resources', icon: Package },
  { to: '/waste', label: 'Deductions & Waste', icon: PackageMinus },
  { to: '/transactions', label: 'Audit Log', icon: History },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings & Backups', icon: SettingsIcon },
]

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore()
  const isDark = theme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title="Toggle theme"
      className="size-8 rounded-lg"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { data: settings } = useSettings()

  return (
    <div className="flex h-full flex-col pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        {settings?.logo_path ? (
          <img
            src={settings.logo_path}
            alt="Logo"
            className="size-10 rounded-xl border bg-white p-1 object-contain shadow-sm"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-xl font-black text-primary-foreground shadow-sm">
            {settings?.restaurant_name?.charAt(0) ?? 'E'}
          </div>
        )}
        <div className="leading-tight">
          <div className="text-sm font-bold text-sidebar-foreground truncate max-w-[130px]">
            {settings?.restaurant_name ?? 'EL CASA'}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#0b7b9e] flex items-center gap-1 mt-0.5">
            <span className="size-1.5 rounded-full bg-[#0b7b9e] animate-pulse" />
            Offline ROMS
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all',
                isActive
                  ? 'bg-[#00447c] text-white shadow-sm font-bold'
                  : 'text-sidebar-muted hover:bg-[#212121] hover:text-[#f2f3f4]'
              )
            }
          >
            <item.icon className="size-4.5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border text-[11px] text-sidebar-muted space-y-1">
        <div className="flex items-center gap-1.5 text-[#0b7b9e] font-medium">
          <Database className="size-3.5" />
          <span>Local SQLite Storage</span>
        </div>
        <div>v1.0.0 Standalone Android POS</div>
      </div>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const current = navItems.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop / Tablet Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar text-sidebar-foreground shadow-2xl">
            <button
              className="absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] right-4 size-8 rounded-full bg-white/10 text-white flex items-center justify-center z-10"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-4 border-b bg-background/90 px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden size-9"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="size-5" />
            </Button>
            <h1 className="text-base font-bold sm:text-lg">
              {current?.label ?? 'ROMS'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00447c]/15 text-[#0b7b9e] text-xs font-semibold border border-[#0b7b9e]/30">
              <span className="size-2 rounded-full bg-[#0b7b9e] animate-pulse" />
              Offline Native POS
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

