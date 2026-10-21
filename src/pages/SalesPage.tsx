import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Calendar, Printer, Ban, Eye, FileText, CheckCircle2,
  ShoppingBag, ReceiptText, TrendingUp, Layers, ArrowUpDown, Copy, Check, DollarSign
} from 'lucide-react'
import { toast } from 'sonner'
import { api, unwrap } from '@/lib/api'
import type { Bill, ProductSaleItem } from '@/types'
import { formatMoney, formatDateTime, formatDate, formatTime, todayISO } from '@/lib/utils'
import { useSettings } from '@/hooks/useData'
import { useHardwareStore } from '@/stores/useHardwareStore'
import { printerService } from '@/hardware/printerService'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingBlock } from '@/components/shared'
import { ReceiptModal } from '@/components/hardware/ReceiptModal'

export default function SalesPage() {
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()
  const { printerConfig, setPrinterConfig } = useHardwareStore()
  const currency = settings?.currency || 'Rs.'

  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') === 'bills' ? 'bills' : 'today'

  // Tab State
  const handleTabChange = (val: string) => {
    setSearchParams(val === 'bills' ? { tab: 'bills' } : {})
  }

  // --- Today's Sales Tab State ---
  const [todayDate, setTodayDate] = useState(todayISO())
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [productSort, setProductSort] = useState<'revenue' | 'quantity' | 'name'>('revenue')
  const [printSummaryOpen, setPrintSummaryOpen] = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)

  // --- Bills Tab State ---
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [date, setDate] = useState('')
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [printBill, setPrintBill] = useState<Bill | null>(null)
  const [printOpen, setPrintOpen] = useState(false)

  // Query: Today Product Sales Breakdown
  const { data: productSales = [], isLoading: productsLoading } = useQuery({
    queryKey: ['today-product-sales', todayDate],
    queryFn: async () => {
      return unwrap<ProductSaleItem[]>(
        api.get('/reports/product-sales', { params: { date: todayDate } })
      )
    },
  })

  // Query: Bills List
  const { data: salesData, isLoading: billsLoading } = useQuery({
    queryKey: ['bills', search, status, date],
    queryFn: async () => {
      const params: any = {}
      if (search.trim()) params.q = search.trim()
      if (status !== 'all') params.status = status
      if (date) params.date = date
      return unwrap<{ items: Bill[]; pagination: any }>(api.get('/bills', { params }))
    },
    enabled: currentTab === 'bills',
  })

  // Cancel bill mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      return unwrap<Bill>(api.post(`/bills/${id}/cancel`))
    },
    onSuccess: (updated) => {
      toast.success(`Bill ${updated.invoice_number} cancelled and stock restored`)
      setSelectedBill(null)
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['today-product-sales'] })
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: any) => toast.error(e.message || 'Cancellation failed'),
  })

  // Filtered & Sorted Product Sales
  const filteredProducts = useMemo(() => {
    let list = [...productSales]
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      )
    }
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase())
    }

    list.sort((a, b) => {
      if (productSort === 'revenue') return b.revenue - a.revenue
      if (productSort === 'quantity') return b.quantity - a.quantity
      return a.name.localeCompare(b.name)
    })
    return list
  }, [productSales, productSearch, selectedCategory, productSort])

  // Aggregate metrics for Today's Sales
  const totalRevenue = useMemo(() => productSales.reduce((sum, p) => sum + p.revenue, 0), [productSales])
  const totalQuantity = useMemo(() => productSales.reduce((sum, p) => sum + p.quantity, 0), [productSales])
  const uniqueProductsCount = productSales.length
  const topProduct = useMemo(() => {
    if (productSales.length === 0) return null
    return [...productSales].sort((a, b) => b.quantity - a.quantity)[0]
  }, [productSales])

  // Extract unique categories from sold items
  const categoriesList = useMemo(() => {
    const set = new Set<string>()
    productSales.forEach((p) => {
      if (p.category) set.add(p.category)
    })
    return Array.from(set).sort()
  }, [productSales])

  // Text preview for printing daily product sales summary
  const summaryReportText = useMemo(() => {
    return printerService.formatProductSalesReportText(
      todayDate,
      productSales,
      settings || ({} as any),
      printerConfig.paperWidth
    )
  }, [todayDate, productSales, settings, printerConfig.paperWidth])

  const handlePrintSummary = async () => {
    try {
      const res = await printerService.printProductSalesReport(
        todayDate,
        productSales,
        settings || ({} as any),
        printerConfig
      )
      toast.success(res.message)
    } catch (e: any) {
      toast.error('Print failed: ' + (e.message || 'Unknown error'))
    }
  }

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryReportText)
    setSummaryCopied(true)
    toast.success('Product sales summary copied to clipboard')
    setTimeout(() => setSummaryCopied(false), 2000)
  }

  const bills = salesData?.items || []

  return (
    <div className="space-y-4">
      {/* Top Navigation Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <TabsList className="bg-card border p-1 rounded-xl shadow-2xs">
            <TabsTrigger
              value="today"
              className="gap-2 text-xs font-bold rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              <ShoppingBag className="size-4" />
              Today's Sales Breakdown
            </TabsTrigger>
            <TabsTrigger
              value="bills"
              className="gap-2 text-xs font-bold rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              <ReceiptText className="size-4" />
              All Bills & Invoices
            </TabsTrigger>
          </TabsList>

          {currentTab === 'today' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintSummaryOpen(true)}
                disabled={productSales.length === 0}
                className="gap-1.5 text-xs font-bold h-9 shadow-2xs"
              >
                <Printer className="size-3.5 text-primary" />
                Print Sales Report
              </Button>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* TAB 1: TODAY'S PRODUCT SALES                             */}
        {/* ======================================================== */}
        <TabsContent value="today" className="space-y-4 focus-visible:outline-none">
          {/* Header Controls: Date & Filters */}
          <div className="flex flex-wrap items-center gap-2.5 bg-card/60 border p-3 rounded-xl shadow-xs">
            {/* Date Picker */}
            <div className="flex items-center gap-1.5 rounded-lg border bg-card px-3 h-10 text-xs shadow-2xs">
              <Calendar className="size-3.5 text-primary" />
              <span className="font-semibold text-muted-foreground">Date:</span>
              <input
                type="date"
                value={todayDate}
                onChange={(e) => setTodayDate(e.target.value)}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
              />
              {todayDate !== todayISO() && (
                <button
                  type="button"
                  onClick={() => setTodayDate(todayISO())}
                  className="text-[11px] text-primary hover:underline ml-1 font-bold"
                >
                  Today
                </button>
              )}
            </div>

            {/* Product Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Filter by product name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 h-10 text-xs bg-card"
              />
            </div>

            {/* Category Filter */}
            {categoriesList.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories ({productSales.length})</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <select
              value={productSort}
              onChange={(e) => setProductSort(e.target.value as any)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="revenue">Sort by Highest Revenue</option>
              <option value="quantity">Sort by Highest Qty Sold</option>
              <option value="name">Sort by Product Name</option>
            </select>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 shadow-xs border-primary/20 bg-primary/5">
              <span className="text-xs font-semibold text-muted-foreground">Total Revenue</span>
              <div className="mt-1 text-2xl font-black font-mono text-primary">
                {formatMoney(totalRevenue, currency)}
              </div>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {todayDate === todayISO() ? "Today's net product revenue" : `Sales on ${todayDate}`}
              </span>
            </Card>

            <Card className="p-4 shadow-xs">
              <span className="text-xs font-semibold text-muted-foreground">Total Items Sold</span>
              <div className="mt-1 text-2xl font-black font-mono text-foreground">
                {totalQuantity} <span className="text-sm font-medium text-muted-foreground">units</span>
              </div>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Across all completed orders
              </span>
            </Card>

            <Card className="p-4 shadow-xs">
              <span className="text-xs font-semibold text-muted-foreground">Distinct Products</span>
              <div className="mt-1 text-2xl font-black font-mono text-foreground">
                {uniqueProductsCount} <span className="text-sm font-medium text-muted-foreground">items</span>
              </div>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Unique menu dishes ordered
              </span>
            </Card>

            <Card className="p-4 shadow-xs">
              <span className="text-xs font-semibold text-muted-foreground">Best Seller</span>
              <div className="mt-1 text-base font-bold text-foreground truncate" title={topProduct?.name || '—'}>
                {topProduct ? topProduct.name : '—'}
              </div>
              <span className="text-[10px] font-semibold text-emerald-500 block mt-0.5">
                {topProduct ? `${topProduct.quantity} sold (${formatMoney(topProduct.revenue, currency)})` : 'No sales recorded'}
              </span>
            </Card>
          </div>

          {/* Product Sales Breakdown Table */}
          <Card className="shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShoppingBag className="size-4 text-primary" />
                  Product Quantities & Revenue Generated
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Breakdown of every dish sold, its unit price, volume, and total revenue contribution
                </p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}
              </Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {productsLoading ? (
                <LoadingBlock label="Calculating today's product sales..." />
              ) : filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
                  <ShoppingBag className="size-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground">No product sales found</p>
                  <p>No completed sales recorded for {todayDate === todayISO() ? 'today' : todayDate}.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                    <tr>
                      <th className="p-3 pl-4 w-12 text-center">#</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-center">Quantity Sold</th>
                      <th className="p-3 text-right">Revenue</th>
                      <th className="p-3 w-40 text-left">Share of Sales</th>
                      <th className="p-3 pr-4 text-right">In Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredProducts.map((item, idx) => {
                      const sharePct = totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0
                      return (
                        <tr key={item.menu_item_id || item.name} className="hover:bg-accent/40 transition-colors">
                          <td className="p-3 pl-4 font-mono text-center text-muted-foreground font-semibold">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-bold text-foreground">
                            {item.name}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px] font-semibold py-0 px-2 bg-muted/40">
                              {item.category}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono text-muted-foreground">
                            {formatMoney(item.price, currency)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-mono font-bold text-xs bg-primary/10 text-primary">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-foreground text-sm">
                            {formatMoney(item.revenue, currency)}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-500"
                                  style={{ width: `${sharePct}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                                {sharePct}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3 pr-4 text-right font-mono text-muted-foreground">
                            {item.orders_count} {item.orders_count === 1 ? 'order' : 'orders'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-muted/40 font-bold border-t border-border">
                    <tr>
                      <td colSpan={4} className="p-3 pl-4 text-foreground uppercase tracking-wider text-xs">
                        Total Daily Product Sales
                      </td>
                      <td className="p-3 text-center font-mono text-sm text-primary font-black">
                        {totalQuantity}
                      </td>
                      <td className="p-3 text-right font-mono text-sm text-primary font-black">
                        {formatMoney(totalRevenue, currency)}
                      </td>
                      <td colSpan={2} className="p-3 pr-4 text-right text-muted-foreground text-[11px] font-normal">
                        100% of dish revenue
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: ALL BILLS & INVOICES                              */}
        {/* ======================================================== */}
        <TabsContent value="bills" className="space-y-4 focus-visible:outline-none">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice # or customer phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="hold">Held Orders</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="flex items-center gap-1.5 rounded-lg border bg-card px-3 h-10 text-xs">
              <Calendar className="size-3.5 text-primary" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent font-medium text-foreground focus:outline-none cursor-pointer"
              />
              {date && (
                <button type="button" onClick={() => setDate('')} className="text-xs text-primary ml-1 font-bold">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Bills Table */}
          <Card className="shadow-xs overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {billsLoading ? (
                <LoadingBlock label="Loading sales history..." />
              ) : bills.length === 0 ? (
                <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
                  <ReceiptText className="size-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground">No invoices found</p>
                  <p>Try adjusting your search query, status, or date filter.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                    <tr>
                      <th className="p-3 pl-4">Invoice #</th>
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Items</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-accent/30 transition-colors">
                        <td className="p-3 pl-4 font-mono font-bold text-foreground">{bill.invoice_number}</td>
                        <td className="p-3 text-muted-foreground font-mono text-xs">
                          {bill.bill_date} {formatTime(bill.completed_at || bill.created_at) ? `· ${formatTime(bill.completed_at || bill.created_at)}` : ''}
                        </td>
                        <td className="p-3 font-mono">{bill.customer_phone || '—'}</td>
                        <td className="p-3">{bill.item_count} items</td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          {formatMoney(bill.total, currency)}
                        </td>
                        <td className="p-3">
                          <span className="capitalize">{bill.payment_type}</span>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={bill.status === 'completed' ? 'success' : bill.status === 'hold' ? 'warning' : 'destructive'}
                            className="uppercase text-[10px]"
                          >
                            {bill.status}
                          </Badge>
                        </td>
                        <td className="p-3 pr-4 text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedBill(bill)}
                            title="View Items"
                            className="size-8"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPrintBill(bill)
                              setPrintOpen(true)
                            }}
                            title="Print Thermal Receipt"
                            className="size-8 text-primary"
                          >
                            <Printer className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bill Details Modal */}
      <Dialog open={Boolean(selectedBill)} onOpenChange={(v) => !v && setSelectedBill(null)}>
        {selectedBill && (
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Invoice #{selectedBill.invoice_number}</span>
                <Badge
                  variant={selectedBill.status === 'completed' ? 'success' : selectedBill.status === 'hold' ? 'warning' : 'destructive'}
                  className="uppercase text-xs"
                >
                  {selectedBill.status}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Date: {selectedBill.bill_date} {formatTime(selectedBill.completed_at || selectedBill.created_at) ? `· Time: ${formatTime(selectedBill.completed_at || selectedBill.created_at)}` : ''}
              </p>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {selectedBill.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/40">
                    <div>
                      <span className="font-bold text-foreground">{item.name}</span>
                      <span className="text-muted-foreground block font-mono">
                        {item.quantity} x {formatMoney(item.unit_price, currency)}
                      </span>
                    </div>
                    <span className="font-mono font-bold">{formatMoney(item.line_total, currency)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs pt-2 border-t">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatMoney(selectedBill.subtotal, currency)}</span>
                </div>
                {selectedBill.discount > 0 && (
                  <div className="flex justify-between text-emerald-500 font-semibold">
                    <span>Discount</span>
                    <span className="font-mono">-{formatMoney(selectedBill.discount, currency)}</span>
                  </div>
                )}
                {selectedBill.tax_amount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({selectedBill.tax_rate}%)</span>
                    <span className="font-mono">{formatMoney(selectedBill.tax_amount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t text-foreground">
                  <span>Total</span>
                  <span className="font-mono text-primary">{formatMoney(selectedBill.total, currency)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                {selectedBill.status === 'completed' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Cancel bill ${selectedBill.invoice_number} and restore inventory stock?`)) {
                        cancelMutation.mutate(selectedBill.id)
                      }
                    }}
                    disabled={cancelMutation.isPending}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Ban className="size-3.5" />
                    Cancel Bill & Restore Stock
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPrintBill(selectedBill)
                    setPrintOpen(true)
                  }}
                  className="gap-1.5 text-xs font-bold ml-auto"
                >
                  <Printer className="size-3.5 text-primary" />
                  Print Receipt
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Bill Print Modal */}
      <ReceiptModal bill={printBill} open={printOpen} onClose={() => setPrintOpen(false)} />

      {/* Daily Product Sales Report Modal */}
      <Dialog open={printSummaryOpen} onOpenChange={setPrintSummaryOpen}>
        <DialogContent className="max-w-md p-6 max-h-[92vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle>Product Sales Summary</DialogTitle>
              <p className="text-xs text-muted-foreground">Date: {todayDate}</p>
            </div>
            <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg">
              <button
                onClick={() => setPrinterConfig({ paperWidth: '58mm' })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${printerConfig.paperWidth === '58mm' ? 'bg-[#00447c] text-white shadow-xs font-bold' : 'text-muted-foreground'}`}
              >
                58mm
              </button>
              <button
                onClick={() => setPrinterConfig({ paperWidth: '80mm' })}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${printerConfig.paperWidth === '80mm' ? 'bg-[#00447c] text-white shadow-xs font-bold' : 'text-muted-foreground'}`}
              >
                80mm
              </button>
            </div>
          </DialogHeader>

          {/* Paper Receipt Simulation */}
          <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-[#dddace] border border-[#c6c3b6] font-mono text-xs text-[#0c0c0c] shadow-sm shadow-inner whitespace-pre leading-relaxed select-text">
            {summaryReportText}
          </div>

          {/* Footer actions */}
          <div className="pt-4 flex gap-2">
            <Button onClick={handlePrintSummary} className="flex-1 gap-2 text-sm font-bold">
              <Printer className="size-4" />
              Print Report Slip
            </Button>
            <Button variant="outline" size="icon" onClick={handleCopySummary} title="Copy Text">
              {summaryCopied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
