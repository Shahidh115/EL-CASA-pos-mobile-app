import React from 'react'
import {
  DollarSign, ShoppingBag, Receipt, AlertTriangle, TrendingUp,
  Package, Clock, CheckCircle2, ChevronRight
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDashboard, useSettings } from '@/hooks/useData'
import { formatMoney } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingBlock } from '@/components/shared'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

export default function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const { data: settings } = useSettings()

  if (isLoading || !data) return <LoadingBlock label="Loading Dashboard Metrics…" />

  const currency = settings?.currency || 'Rs.'
  const summary = data.summary

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Today Revenue</span>
            <DollarSign className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black font-mono text-foreground">
            {formatMoney(summary.revenue, currency)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Discounts: {formatMoney(summary.discount, currency)}
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Bills Completed</span>
            <Receipt className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black font-mono text-foreground">
            {summary.sales_count}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Avg Bill: {formatMoney(summary.average_bill, currency)}
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Dishes Sold</span>
            <ShoppingBag className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black font-mono text-foreground">
            {summary.items_sold}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Individual line portions</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Low Stock Alert</span>
            <AlertTriangle className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black font-mono text-foreground">
            {data.low_resources.length}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {data.low_resources.length === 0 ? 'All resources healthy' : 'Requires production add'}
          </p>
        </Card>
      </div>

      {/* Hourly Sales Chart & Top Selling */}
      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4 p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Hourly Sales (Revenue)
            </CardTitle>
          </CardHeader>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourly_sales.filter((h) => h.revenue > 0 || h.count > 0)}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: any) => [formatMoney(val, currency), 'Revenue']}
                  labelStyle={{ color: '#000' }}
                />
                <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Selling Items */}
        <Card className="lg:col-span-3 p-5">
          <CardHeader className="p-0 mb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-500" />
              Top Selling Dishes
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {data.top_selling.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No sales recorded yet today.</div>
            ) : (
              data.top_selling.map((item, idx) => (
                <div key={item.menu_item_id || idx} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-foreground truncate block">{item.name}</span>
                    <span className="text-muted-foreground font-mono">{item.quantity} portions sold</span>
                  </div>
                  <span className="font-bold font-mono text-primary whitespace-nowrap">
                    {formatMoney(item.revenue, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Production Capacity & Low Resources */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Production Capacity */}
        <Card className="p-5">
          <CardHeader className="p-0 mb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Package className="size-4 text-primary" />
              Kitchen Production Capacity
            </CardTitle>
            <Link to="/production" className="text-xs text-primary font-bold hover:underline flex items-center">
              Manage <ChevronRight className="size-3" />
            </Link>
          </CardHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin pr-1">
            {data.production_capacity.map((cap) => (
              <div key={cap.menu_item_id} className="flex items-center justify-between p-2 rounded-xl border bg-background/50 text-xs">
                <div>
                  <span className="font-bold text-foreground">{cap.name}</span>
                  {cap.limiting_resource && (
                    <span className="text-[10px] text-destructive block">Limited by: {cap.limiting_resource}</span>
                  )}
                </div>
                <Badge variant={cap.max_preparable > 0 ? 'success' : 'destructive'} className="font-mono font-bold">
                  {cap.max_preparable > 0 ? `${cap.max_preparable} portions` : 'Sold Out'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Low Resources Warnings */}
        <Card className="p-5">
          <CardHeader className="p-0 mb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Low Stock Warnings
            </CardTitle>
            <Link to="/resources" className="text-xs text-primary font-bold hover:underline flex items-center">
              Restock <ChevronRight className="size-3" />
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {data.low_resources.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-500 font-semibold flex flex-col items-center gap-1">
                <CheckCircle2 className="size-8" />
                All resources are above warning thresholds.
              </div>
            ) : (
              data.low_resources.map((res) => (
                <div key={res.id} className="flex items-center justify-between p-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-xs">
                  <div>
                    <span className="font-bold text-foreground">{res.name}</span>
                    <span className="text-[11px] text-muted-foreground block">Warning trigger: {res.warning_level} {res.unit}</span>
                  </div>
                  <span className="font-mono font-black text-destructive text-sm">
                    {res.current_balance} {res.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
