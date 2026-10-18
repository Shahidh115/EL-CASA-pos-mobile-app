import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Calendar, DollarSign, Download, Layers, TrendingUp } from 'lucide-react'
import { api, unwrap } from '@/lib/api'
import { todayISO, formatMoney } from '@/lib/utils'
import { useSettings } from '@/hooks/useData'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingBlock } from '@/components/shared'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

export default function ReportsPage() {
  const { data: settings } = useSettings()
  const currency = settings?.currency || 'Rs.'

  const [tab, setTab] = useState<'sales' | 'reconciliation' | 'waste' | 'trends'>('sales')
  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState(todayISO())

  // Queries
  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['report-summary', from, to],
    queryFn: async () => unwrap<any>(api.get('/reports/summary', { params: { from, to } })),
  })

  const { data: foodSales = [], isLoading: foodLoading } = useQuery({
    queryKey: ['report-food', from, to],
    queryFn: async () => unwrap<any[]>(api.get('/reports/food-sales', { params: { from, to } })),
    enabled: tab === 'sales',
  })

  const { data: reconciliation = [], isLoading: recLoading } = useQuery({
    queryKey: ['report-rec', from, to],
    queryFn: async () => unwrap<any[]>(api.get('/reports/resource-usage', { params: { from, to } })),
    enabled: tab === 'reconciliation',
  })

  const { data: wasteReport, isLoading: wasteLoading } = useQuery({
    queryKey: ['report-waste', from, to],
    queryFn: async () => unwrap<any>(api.get('/reports/waste', { params: { from, to } })),
    enabled: tab === 'waste',
  })

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['report-trends', from, to],
    queryFn: async () => unwrap<any[]>(api.get('/reports/trends', { params: { from, to } })),
    enabled: tab === 'trends',
  })

  return (
    <div className="space-y-4">
      {/* Header and Date Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Operational & Financial Reports</h2>
          <p className="text-xs text-muted-foreground">Comprehensive sales summaries, item rankings, and inventory reconciliation</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border bg-card p-1.5 text-xs shadow-xs">
          <Calendar className="size-3.5 text-primary" />
          <span className="font-semibold text-muted-foreground">From:</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-transparent font-bold focus:outline-none cursor-pointer"
          />
          <span className="font-semibold text-muted-foreground ml-1">To:</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-transparent font-bold focus:outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList className="bg-card border p-1 rounded-xl">
          <TabsTrigger value="sales">Sales & Dishes</TabsTrigger>
          <TabsTrigger value="reconciliation">Resource Usage Matrix</TabsTrigger>
          <TabsTrigger value="waste">Waste Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Sales Trends</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-3.5">
            <span className="text-xs font-semibold text-muted-foreground">Total Revenue</span>
            <div className="mt-1 text-xl font-black font-mono text-foreground">
              {formatMoney(summary.revenue, currency)}
            </div>
          </Card>
          <Card className="p-3.5">
            <span className="text-xs font-semibold text-muted-foreground">Bills Count</span>
            <div className="mt-1 text-xl font-black font-mono text-foreground">
              {summary.sales_count}
            </div>
          </Card>
          <Card className="p-3.5">
            <span className="text-xs font-semibold text-muted-foreground">Dishes Sold</span>
            <div className="mt-1 text-xl font-black font-mono text-foreground">
              {summary.items_sold}
            </div>
          </Card>
          <Card className="p-3.5">
            <span className="text-xs font-semibold text-muted-foreground">Discounts Given</span>
            <div className="mt-1 text-xl font-black font-mono text-emerald-500">
              {formatMoney(summary.discount, currency)}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Sales */}
      {tab === 'sales' && (
        <Card>
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold">Food Dishes Sales Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {foodLoading ? (
              <LoadingBlock label="Loading food sales…" />
            ) : foodSales.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">No dishes sold during this date range.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="p-3 pl-4">Dish Name</th>
                    <th className="p-3">Quantity Sold</th>
                    <th className="p-3 pr-4 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {foodSales.map((item) => (
                    <tr key={item.name} className="hover:bg-accent/30">
                      <td className="p-3 pl-4 font-bold text-foreground">{item.name}</td>
                      <td className="p-3 font-mono">{item.quantity}</td>
                      <td className="p-3 pr-4 text-right font-mono font-bold text-foreground">
                        {formatMoney(item.revenue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Resource Usage Reconciliation Matrix */}
      {tab === 'reconciliation' && (
        <Card>
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold">
              Ingredient Reconciliation: Opening + Produced - Sold + Restored - Wasted +/- Adjust = Closing
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {recLoading ? (
              <LoadingBlock label="Calculating inventory reconciliation…" />
            ) : reconciliation.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">No resources found.</div>
            ) : (
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                  <tr>
                    <th className="p-3 pl-4">Resource</th>
                    <th className="p-3 text-right">Opening</th>
                    <th className="p-3 text-right text-emerald-500">+ Produced</th>
                    <th className="p-3 text-right text-destructive">- Sold</th>
                    <th className="p-3 text-right text-emerald-500">+ Restored</th>
                    <th className="p-3 text-right text-destructive">- Wasted</th>
                    <th className="p-3 text-right">Adjust</th>
                    <th className="p-3 pr-4 text-right font-black">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {reconciliation.map((r: any) => (
                    <tr key={r.resource_id} className="hover:bg-accent/30">
                      <td className="p-3 pl-4 font-bold font-sans text-foreground">{r.name}</td>
                      <td className="p-3 text-right">{r.opening} {r.unit}</td>
                      <td className="p-3 text-right text-emerald-500">+{r.produced}</td>
                      <td className="p-3 text-right text-destructive">-{r.sold}</td>
                      <td className="p-3 text-right text-emerald-500">+{r.restored}</td>
                      <td className="p-3 text-right text-destructive">-{r.wasted}</td>
                      <td className="p-3 text-right">{r.manual_adjust}</td>
                      <td className="p-3 pr-4 text-right font-black text-foreground">
                        {r.closing} {r.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Waste */}
      {tab === 'waste' && (
        <div className="space-y-4">
          {wasteLoading || !wasteReport ? (
            <LoadingBlock label="Calculating waste analytics…" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <CardHeader className="p-0 mb-3">
                  <CardTitle className="text-sm font-bold">Waste Breakdown by Type</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {Object.entries(wasteReport.by_type || {}).map(([type, qty]) => (
                    <div key={type} className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/40">
                      <span className="font-bold">{type}</span>
                      <span className="font-mono text-destructive font-black">-{String(qty)} portions</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <CardHeader className="p-0 mb-3">
                  <CardTitle className="text-sm font-bold">Waste Breakdown by Resource</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {(wasteReport.by_resource || []).map((res: any) => (
                    <div key={res.resource_id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/40">
                      <span className="font-bold">{res.name}</span>
                      <span className="font-mono text-destructive font-black">-{res.quantity} {res.unit}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab: Trends */}
      {tab === 'trends' && (
        <Card className="p-5">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-sm font-bold">Revenue Trend Over Selected Date Range</CardTitle>
          </CardHeader>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [formatMoney(v, currency), 'Daily Revenue']} />
                <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  )
}
