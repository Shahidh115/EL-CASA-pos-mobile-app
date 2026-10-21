import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search, Barcode, Plus, Minus, Trash2, Calendar, PauseCircle,
  CheckCircle, ReceiptText, Camera, CreditCard, Banknote, HelpCircle, ShoppingCart, Clock, ShoppingBag
} from 'lucide-react'
import { api, unwrap } from '@/lib/api'
import type { MenuItem, Bill } from '@/types'
import { todayISO, formatTime, cn, formatMoney } from '@/lib/utils'
import { usePosData, useSettings } from '@/hooks/useData'
import { useCartStore, cartTotal } from '@/stores/useCartStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { LoadingBlock, Money } from '@/components/shared'
import { BarcodeScannerModal } from '@/components/hardware/BarcodeScannerModal'
import { ReceiptModal } from '@/components/hardware/ReceiptModal'

export default function PosPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: posData, isLoading } = usePosData()
  const { data: settings } = useSettings()

  const cart = useCartStore()
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [paymentType, setPaymentType] = useState('cash')
  const [discount, setDiscount] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [billDate, setBillDate] = useState(todayISO())
  const [liveTime, setLiveTime] = useState(() => formatTime(new Date(), true))

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(formatTime(new Date(), true))
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  const [receiptBill, setReceiptBill] = useState<Bill | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [activeHoldingCode, setActiveHoldingCode] = useState<string | null>(null)

  const currency = settings?.currency || 'Rs.'
  const taxRate = Number(settings?.tax_rate || 0)

  const subtotal = cartTotal(cart.lines)
  const discountNum = Number(discount) || 0
  const taxable = Math.max(0, subtotal - discountNum)
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100
  const total = Math.round((taxable + taxAmount) * 100) / 100

  // Holds query
  const { data: holds } = useQuery({
    queryKey: ['pos-holds'],
    queryFn: async () => unwrap<Bill[]>(api.get('/pos/holds')),
    refetchInterval: 15_000,
  })

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['bills'] })
    queryClient.invalidateQueries({ queryKey: ['pos-holds'] })
  }

  // Complete Sale
  const saleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        items: cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
        discount: discountNum,
        payment_type: paymentType,
        customer_phone: customerPhone || null,
        bill_date: billDate,
      }
      if (activeHoldingCode) {
        return unwrap<Bill>(api.post(`/pos/holds/${activeHoldingCode}/complete`, payload))
      }
      return unwrap<Bill>(api.post('/pos/sale', payload))
    },
    onSuccess: (bill) => {
      toast.success(`Sale completed · Invoice ${bill.invoice_number}`)
      setReceiptBill(bill)
      setReceiptOpen(true)
      cart.clear()
      setDiscount('')
      setCustomerPhone('')
      setActiveHoldingCode(null)
      invalidateData()
    },
    onError: (err: any) => {
      toast.error(err.message || 'Checkout failed')
    },
  })

  // Hold Order
  const holdMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        items: cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
        discount: discountNum,
        payment_type: paymentType,
        customer_phone: customerPhone || null,
        bill_date: billDate,
      }
      return unwrap<Bill>(api.post('/pos/hold', payload))
    },
    onSuccess: (bill) => {
      toast.success(`Order held · Code ${bill.hold_code}`)
      cart.clear()
      setDiscount('')
      setCustomerPhone('')
      invalidateData()
    },
    onError: (err: any) => {
      toast.error(err.message || 'Hold failed')
    },
  })

  // Discard Hold
  const discardHold = async (code: string) => {
    try {
      await api.delete(`/pos/holds/${code}`)
      toast.success(`Held order ${code} discarded`)
      if (activeHoldingCode === code) {
        setActiveHoldingCode(null)
        cart.clear()
      }
      invalidateData()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // Barcode detection
  const handleBarcodeDetected = (code: string) => {
    if (!posData) return
    const id = Number(code)
    const item = posData.menu_items.find((i) => i.id === id || i.slug === code || i.name.toLowerCase() === code.toLowerCase())
    if (item) {
      if (item.max_preparable <= 0) {
        toast.error(`${item.name} is SOLD OUT`)
        return
      }
      cart.addItem(item)
      toast.success(`Added ${item.name} to cart`)
    } else {
      toast.error(`No menu item matches code: ${code}`)
    }
  }

  const filteredItems = useMemo(() => {
    if (!posData) return []
    let list = posData.menu_items
    if (category !== 'all') {
      list = list.filter((i) => i.category_id === Number(category))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((i) => i.name.toLowerCase().includes(q))
    }
    return list
  }, [posData, category, search])

  if (isLoading) return <LoadingBlock label="Loading POS System…" />

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
      {/* Products & Scanning Section */}
      <section className="space-y-3 min-w-0">
        {/* Top toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search items by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 text-sm bg-card"
            />
          </div>

          {/* Native Barcode Scanner Button */}
          <Button
            type="button"
            variant="outline"
            className="h-11 px-3.5 gap-2 font-semibold bg-card border-primary/40 hover:bg-primary/10 text-primary"
            onClick={() => setScannerOpen(true)}
          >
            <Camera className="size-4.5" />
            Scan Barcode
          </Button>

          {/* Manual Barcode Input */}
          <div className="relative w-36">
            <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Item # / Barcode"
              value={barcodeInput}
              onChange={(e) => {
                setBarcodeInput(e.target.value)
                const id = Number(e.target.value)
                const item = posData?.menu_items.find((i) => i.id === id)
                if (item) {
                  cart.addItem(item)
                  setBarcodeInput('')
                  toast.success(`Added ${item.name}`)
                }
              }}
              className="pl-8 h-11 text-xs bg-card"
            />
          </div>

          {/* Bill date */}
          <div className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs shadow-xs">
            <Calendar className="size-3.5 text-primary" />
            <span className="font-semibold text-muted-foreground">Date:</span>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
            />
            {billDate !== todayISO() && (
              <button
                type="button"
                onClick={() => setBillDate(todayISO())}
                className="text-[11px] text-primary hover:underline ml-1 font-bold"
              >
                Today
              </button>
            )}
          </div>

          {/* Real-time Clock Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-xs shadow-xs" title="Device Local Time">
            <Clock className="size-3.5 text-primary animate-pulse" />
            <span className="font-semibold text-muted-foreground">Time:</span>
            <span className="font-mono font-bold text-foreground">{liveTime}</span>
          </div>

          {/* Quick link to Today Sales Tab */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/sales?tab=today')}
            className="h-9 px-3 gap-1.5 text-xs font-bold border bg-card hover:bg-primary/10 hover:text-primary transition-colors shadow-2xs"
            title="View Today's Product Sales & Quantities"
          >
            <ShoppingBag className="size-3.5 text-primary" />
            Today's Sales
          </Button>
        </div>

        {/* Categories Bar */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${category === 'all' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-card border text-muted-foreground hover:bg-accent'}`}
          >
            All Items
          </button>
          {posData?.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(String(c.id))}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${category === String(c.id) ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-card border text-muted-foreground hover:bg-accent'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Items Grid */}
        <ScrollArea className="h-[calc(100vh-16rem)] pr-1">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => {
              const isOut = item.max_preparable <= 0
              const isLow = item.max_preparable > 0 && item.max_preparable <= 5

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => !isOut && cart.addItem(item)}
                  disabled={isOut}
                  className={cn(
                    'group relative flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98]',
                    isOut
                      ? 'cursor-not-allowed border-destructive/50 bg-destructive/5 opacity-60'
                      : isLow
                        ? 'border-amber-500/80 bg-amber-500/5 hover:border-amber-500'
                        : 'bg-card hover:border-primary/60 hover:shadow-md'
                  )}
                >
                  {isOut && (
                    <div className="absolute top-0 right-0 bg-destructive text-white text-[10px] font-black px-2 py-0.5 rounded-bl-xl shadow-xs">
                      SOLD OUT
                    </div>
                  )}
                  {isLow && (
                    <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-bl-xl shadow-xs">
                      LOW ({item.max_preparable})
                    </div>
                  )}

                  <div className="size-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground overflow-hidden mb-2">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="size-full object-cover" />
                    ) : (
                      <ReceiptText className="size-6 text-primary/70" />
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground font-semibold truncate">{item.category}</div>
                    <div className="text-sm font-bold text-foreground line-clamp-1">{item.name}</div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t flex items-center justify-between">
                    <Money value={item.price} currency={currency} className="text-sm font-bold text-foreground" />
                    <span className={cn('text-[11px] font-bold', isOut ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-emerald-500')}>
                      {item.max_preparable > 0 ? `×${item.max_preparable}` : '0 left'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>

        {/* Held Orders Panel */}
        {holds && holds.length > 0 && (
          <div className="p-3 rounded-2xl border bg-card/60 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Held Orders:</span>
            {holds.map((h) => (
              <Badge
                key={h.hold_code}
                variant={activeHoldingCode === h.hold_code ? 'default' : 'secondary'}
                className="cursor-pointer py-1.5 px-3 text-xs font-mono font-bold flex items-center gap-1.5"
                onClick={() => {
                  setActiveHoldingCode(h.hold_code!)
                  cart.replaceWith(
                    h.items.map((i) => ({
                      menu_item_id: i.menu_item_id!,
                      name: i.name,
                      price: i.unit_price,
                      quantity: i.quantity,
                    }))
                  )
                  setDiscount(String(h.discount || ''))
                  setCustomerPhone(h.customer_phone || '')
                  toast.info(`Resumed held order ${h.hold_code}`)
                }}
              >
                <span>{h.hold_code}</span>
                <span className="opacity-80">({formatMoney(h.total, currency)})</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    discardHold(h.hold_code!)
                  }}
                  className="hover:text-destructive ml-1"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Cart & Billing Checkout Drawer */}
      <section className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm h-full">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-base font-bold text-foreground">Current Order</h2>
            {activeHoldingCode && (
              <span className="text-[11px] font-mono text-primary font-bold">Resumed: {activeHoldingCode}</span>
            )}
          </div>
          {cart.lines.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                cart.clear()
                setActiveHoldingCode(null)
              }}
              className="text-destructive h-7 text-xs"
            >
              Clear Cart
            </Button>
          )}
        </div>

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 min-h-52 max-h-[38vh] scrollbar-thin">
          {cart.lines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ShoppingCart className="size-10 stroke-1 mb-2 opacity-50" />
              <p className="text-xs">Your cart is empty.</p>
              <p className="text-[11px] opacity-70">Scan barcode or tap menu items to add.</p>
            </div>
          ) : (
            cart.lines.map((line) => (
              <div key={line.menu_item_id} className="flex items-center justify-between p-2.5 rounded-xl border bg-background/50">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-xs font-bold text-foreground truncate">{line.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {formatMoney(line.price, currency)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(line.menu_item_id, line.quantity - 1)}
                    className="size-7 rounded-lg border bg-card flex items-center justify-center hover:bg-accent text-foreground font-bold"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-7 text-center font-bold text-xs font-mono">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(line.menu_item_id, line.quantity + 1)}
                    className="size-7 rounded-lg border bg-card flex items-center justify-center hover:bg-accent text-foreground font-bold"
                  >
                    <Plus className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cart.removeItem(line.menu_item_id)}
                    className="size-7 rounded-lg text-muted-foreground hover:text-destructive flex items-center justify-center ml-1"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <Separator />

        {/* Inputs (Discount & Customer phone) */}
        <div className="grid grid-cols-2 gap-2 py-2">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Discount ({currency})</label>
            <Input
              type="number"
              min="0"
              placeholder="0.00"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Customer Mobile</label>
            <Input
              placeholder="07xxxxxxxx"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>

        {/* Payment Type Tabs */}
        <div className="grid grid-cols-3 gap-1.5 py-2">
          <button
            type="button"
            onClick={() => setPaymentType('cash')}
            className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${paymentType === 'cash' ? 'border-primary bg-primary/10 text-primary' : 'bg-background hover:bg-accent text-muted-foreground'}`}
          >
            <Banknote className="size-4" />
            Cash
          </button>
          <button
            type="button"
            onClick={() => setPaymentType('card')}
            className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${paymentType === 'card' ? 'border-primary bg-primary/10 text-primary' : 'bg-background hover:bg-accent text-muted-foreground'}`}
          >
            <CreditCard className="size-4" />
            Card
          </button>
          <button
            type="button"
            onClick={() => setPaymentType('other')}
            className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all ${paymentType === 'other' ? 'border-primary bg-primary/10 text-primary' : 'bg-background hover:bg-accent text-muted-foreground'}`}
          >
            <HelpCircle className="size-4" />
            Other
          </button>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-1.5 pt-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-mono">{formatMoney(subtotal, currency)}</span>
          </div>
          {discountNum > 0 && (
            <div className="flex justify-between text-emerald-500 font-semibold">
              <span>Discount</span>
              <span className="font-mono">-{formatMoney(discountNum, currency)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({taxRate}%)</span>
              <span className="font-mono">{formatMoney(taxAmount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-black pt-1 border-t text-foreground">
            <span>Total Payable</span>
            <span className="font-mono text-primary">{formatMoney(total, currency)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={cart.lines.length === 0 || holdMutation.isPending}
            onClick={() => holdMutation.mutate()}
            className="h-12 font-bold text-xs gap-1.5"
          >
            <PauseCircle className="size-4" />
            Hold
          </Button>

          <Button
            type="button"
            disabled={cart.lines.length === 0 || saleMutation.isPending}
            onClick={() => saleMutation.mutate()}
            className="col-span-2 h-12 text-sm font-black gap-2 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="size-5" />
            {saleMutation.isPending ? 'Processing…' : `Pay ${formatMoney(total, currency)}`}
          </Button>
        </div>
      </section>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcodeDetected}
      />

      {/* Thermal Receipt Print Modal */}
      <ReceiptModal
        bill={receiptBill}
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
      />
    </div>
  )
}
