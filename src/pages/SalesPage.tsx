import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Calendar, Printer, Ban, Eye, FileText, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, unwrap } from '@/lib/api'
import type { Bill } from '@/types'
import { formatMoney, formatDateTime, todayISO } from '@/lib/utils'
import { useSettings } from '@/hooks/useData'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingBlock } from '@/components/shared'
import { ReceiptModal } from '@/components/hardware/ReceiptModal'

export default function SalesPage() {
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()
  const currency = settings?.currency || 'Rs.'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [date, setDate] = useState('')
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [printBill, setPrintBill] = useState<Bill | null>(null)
  const [printOpen, setPrintOpen] = useState(false)

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['bills', search, status, date],
    queryFn: async () => {
      const params: any = {}
      if (search.trim()) params.q = search.trim()
      if (status !== 'all') params.status = status
      if (date) params.date = date
      return unwrap<{ items: Bill[]; pagination: any }>(api.get('/bills', { params }))
    },
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
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: any) => toast.error(e.message || 'Cancellation failed'),
  })

  if (isLoading) return <LoadingBlock label="Loading sales history…" />

  const bills = salesData?.items || []

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice # or customer phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold focus:outline-none"
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
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {bills.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No sales records found.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3 pl-4">Invoice #</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Items</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-accent/30 transition-colors">
                    <td className="p-3 pl-4 font-mono font-bold text-foreground">{bill.invoice_number}</td>
                    <td className="p-3 text-muted-foreground">
                      {bill.bill_date} ({formatDateTime(bill.created_at)})
                    </td>
                    <td className="p-3 font-mono">{bill.customer_phone || '—'}</td>
                    <td className="p-3">{bill.item_count} items</td>
                    <td className="p-3 uppercase font-semibold text-muted-foreground">{bill.payment_type}</td>
                    <td className="p-3">
                      <Badge
                        variant={bill.status === 'completed' ? 'success' : bill.status === 'hold' ? 'warning' : 'destructive'}
                        className="font-semibold uppercase text-[10px]"
                      >
                        {bill.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-foreground">
                      {formatMoney(bill.total, currency)}
                    </td>
                    <td className="p-3 pr-4 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedBill(bill)}
                        title="View Details"
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
                Date: {selectedBill.bill_date} ({formatDateTime(selectedBill.created_at)})
              </p>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {selectedBill.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-muted/40">
                    <div>
                      <span className="font-bold text-foreground">{item.name}</span>
                      <span className="text-muted-foreground block font-mono">
                        {item.quantity} × {formatMoney(item.unit_price, currency)}
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
                  <div className="flex justify-between text-emerald-500">
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
                <div className="flex justify-between font-black text-base pt-1 border-t text-foreground">
                  <span>Total</span>
                  <span className="font-mono text-primary">{formatMoney(selectedBill.total, currency)}</span>
                </div>
              </div>

              {selectedBill.status === 'completed' && (
                <div className="pt-3 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2 font-bold"
                    onClick={() => cancelMutation.mutate(selectedBill.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <Ban className="size-4" />
                    Cancel Bill & Restore All Stock
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Thermal Receipt Print Modal */}
      <ReceiptModal bill={printBill} open={printOpen} onClose={() => setPrintOpen(false)} />
    </div>
  )
}
