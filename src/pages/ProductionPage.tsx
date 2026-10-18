import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Factory, Calendar, Plus, RotateCcw, Clock, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api, unwrap } from '@/lib/api'
import { todayISO, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoadingBlock } from '@/components/shared'

export default function ProductionPage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayISO())
  const [addModalResource, setAddModalResource] = useState<{ id: number; name: string; unit: string } | null>(null)
  const [addQty, setAddQty] = useState('')
  const [addNote, setAddNote] = useState('')

  // Opening counts
  const { data: openingList = [], isLoading: openLoading } = useQuery({
    queryKey: ['production-opening', date],
    queryFn: async () => unwrap<any[]>(api.get(`/production/opening?date=${date}`)),
  })

  // History timeline
  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['production-history', date],
    queryFn: async () => unwrap<any[]>(api.get(`/production/history?date=${date}`)),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-opening'] })
    queryClient.invalidateQueries({ queryKey: ['production-history'] })
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // Set opening
  const openingMutation = useMutation({
    mutationFn: async ({ resourceId, qty }: { resourceId: number; qty: number }) => {
      return unwrap(api.post('/production/opening', { resource_id: resourceId, quantity: qty, date }))
    },
    onSuccess: () => {
      toast.success('Opening balance updated')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Quick Add
  const quickAddMutation = useMutation({
    mutationFn: async ({ resourceId, qty }: { resourceId: number; qty: number }) => {
      return unwrap(api.post('/production/add', { resource_id: resourceId, quantity: qty, date, note: 'Quick-add' }))
    },
    onSuccess: () => {
      toast.success('Production added')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Additional Add
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!addModalResource) return
      return unwrap(
        api.post('/production/add', {
          resource_id: addModalResource.id,
          quantity: parseFloat(addQty) || 0,
          note: addNote.trim() || undefined,
          date,
        })
      )
    },
    onSuccess: () => {
      toast.success('Production added')
      setAddModalResource(null)
      setAddQty('')
      setAddNote('')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Reset All
  const resetAllMutation = useMutation({
    mutationFn: async () => unwrap(api.post('/production/reset-all', { date })),
    onSuccess: () => {
      toast.success('Daily production reset to 0')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  if (openLoading || histLoading) return <LoadingBlock label="Loading production data…" />

  return (
    <div className="space-y-5">
      {/* Top Header & Date Selection */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs shadow-xs">
          <Calendar className="size-4 text-primary" />
          <span className="font-semibold text-muted-foreground">Production Date:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
          />
          {date !== todayISO() && (
            <button type="button" onClick={() => setDate(todayISO())} className="text-primary font-bold ml-1">
              Today
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm(`Reset all opening and production balances for ${date} to 0?`)) {
              resetAllMutation.mutate()
            }
          }}
          disabled={resetAllMutation.isPending}
          className="gap-2 text-destructive hover:bg-destructive/10"
        >
          <RotateCcw className="size-4" />
          Everyday Reset All
        </Button>
      </div>

      {/* Opening & Live Balances Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {openingList.map((res) => (
          <Card key={res.resource_id} className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">{res.resource}</h3>
                <span className="text-xs font-semibold text-muted-foreground font-mono">{res.unit}</span>
              </div>

              {/* Current balance display */}
              <div className="mt-3 flex items-baseline justify-between p-2.5 rounded-xl bg-muted/40 border">
                <span className="text-xs font-semibold text-muted-foreground">Current Balance</span>
                <span className="font-mono text-xl font-black text-foreground">{res.current_balance}</span>
              </div>

              {/* Opening production input */}
              <div className="mt-3">
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Opening Production ({res.unit})
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={res.opening_quantity}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      if (val !== res.opening_quantity) {
                        openingMutation.mutate({ resourceId: res.resource_id, qty: val })
                      }
                    }}
                    className="h-9 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Quick add shortcuts & custom add */}
            <div className="mt-4 pt-3 border-t space-y-2">
              <div className="flex gap-1.5">
                {[5, 10, 25].map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => quickAddMutation.mutate({ resourceId: res.resource_id, qty: amt })}
                    className="flex-1 h-7 text-[11px] font-bold font-mono"
                  >
                    +{amt}
                  </Button>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setAddModalResource({ id: res.resource_id, name: res.resource, unit: res.unit })
                  setAddQty('10')
                }}
                className="w-full h-8 text-xs font-bold gap-1.5"
              >
                <Plus className="size-3.5" /> Additional Production
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Production History Timeline */}
      <Card className="p-5">
        <CardHeader className="p-0 mb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Production Timeline · {date}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No production recorded for this date.</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
              {history.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-background/50 text-xs">
                  <div>
                    <span className="font-bold text-foreground">{h.resource}</span>
                    <span className="text-[11px] text-muted-foreground block">{h.note}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-500">+{h.quantity} {h.unit}</span>
                    <span className="text-[10px] text-muted-foreground block">{formatDateTime(h.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
