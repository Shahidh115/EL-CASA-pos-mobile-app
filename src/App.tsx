import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingBlock } from '@/components/shared'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const PosPage = lazy(() => import('@/pages/PosPage'))
const SalesPage = lazy(() => import('@/pages/SalesPage'))
const MenuPage = lazy(() => import('@/pages/MenuPage'))
const ProductionPage = lazy(() => import('@/pages/ProductionPage'))
const ResourcesPage = lazy(() => import('@/pages/ResourcesPage'))
const WastePage = lazy(() => import('@/pages/WastePage'))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function withSuspense(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Component />
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={withSuspense(DashboardPage)} />
        <Route path="pos" element={withSuspense(PosPage)} />
        <Route path="sales" element={withSuspense(SalesPage)} />
        <Route path="menu" element={withSuspense(MenuPage)} />
        <Route path="production" element={withSuspense(ProductionPage)} />
        <Route path="resources" element={withSuspense(ResourcesPage)} />
        <Route path="waste" element={withSuspense(WastePage)} />
        <Route path="transactions" element={withSuspense(TransactionsPage)} />
        <Route path="reports" element={withSuspense(ReportsPage)} />
        <Route path="settings" element={withSuspense(SettingsPage)} />
      </Route>
    </Routes>
  )
}
