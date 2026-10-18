import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PackageMinus, Plus, Trash2, Calendar, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { api, unwrap } from '@/lib/api'
import type { Waste, ProductionResource, MenuItem } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingBlock } from '@/components/shared'

const WASTE_TYPES = ['BURNT', 'SPOILED', 'STAFF_MEAL', 'DAMAGED', 'MANUAL']

export default function WastePage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [mode, setMode] = useState<'resource' | 'menu_item'>('resource')

  // Form states
  const [resourceId, setResourceId] = useState<number>(0)
  const [menuItemId, setMenuItemId] = useState<number>(0)
  const [type, setType] = useState('BURNT')
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')

  const { data: wastes = [], isLoading } = useQuery({
    queryKey: ['wastes'],
    queryFn: async () => unwrap<Waste[]>(api.get('/wastes')),
  })

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => unwrap<ProductionResource[]>(api.get('/resources')),
  })

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => unwrap<MenuItem[]>(api.get('/menu-items')),
  })

  const recordMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        type,
        quantity: parseFloat(quantity) || 0,
        note: note.trim() || undefined,
      }
      if (mode === 'menu_item') {
        payload.menu_item_id = menuItemId || menuItems[0]?.id
      } else {
        payload.production_resource_id = resourceId || resources[0]?.id
      }
      return unwrap(api.post('/wastes', payload))
    },
    onSuccess: () => {
      toast.success('Deduction & waste recorded successfully')
      setModalOpen(false)
      setNote('')
      setQuantity('1')
      queryClient.invalidateQueries({ queryKey: ['wastes'] })
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: any) => toast.error(e.message),
  })

  if (isLoading) return <LoadingBlock label="Loading deductions…" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Stock Deductions & Staff Meals</h2>
          <p className="text-xs text-muted-foreground">Log food waste, spoiled portions, and staff meals with automatic stock deductions</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-1.5">
          <Plus className="size-4" /> Record Deduction
        </Button>
      </div>

      {/* Wastes Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {wastes.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No waste or deduction records found.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3 pl-4">Resource</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Note / Reason</th>
                  <th className="p-3 pr-4 text-right">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {wastes.map((w) => (
                  <tr key={w.id} className="hover:bg-accent/30 transition-colors">
                    <td className="p-3 pl-4 font-bold text-foreground">{w.resource}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] font-mono uppercase font-bold">
                        {w.type}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono font-bold text-destructive">
                      -{w.quantity} {w.unit}
                    </td>
                    <td className="p-3 text-muted-foreground">{w.note || '—'}</td>
                    <td className="p-3 pr-4 text-right text-muted-foreground font-mono">
                      {formatDateTime(w.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Record Waste Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Record Stock Deduction / Waste</DialogTitle>
          </DialogHeader>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setMode('resource')}
              className={`py-2 text-xs font-bold rounded-lg border ${mode === 'resource' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              By Resource
            </button>
            <button
              type="button"
              onClick={() => setMode('menu_item')}
              className={`py-2 text-xs font-bold rounded-lg border ${mode === 'menu_item' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}
            >
              By Menu Dish
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              recordMutation.mutate()
            }}
            className="space-y-3 pt-3"
          >
            {mode === 'resource' ? (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Production Resource</label>
                <select
                  value={resourceId || resources[0]?.id}
                  onChange={(e) => setResourceId(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none"
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Available: {r.current_balance} {r.unit})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Menu Item (Dish)</label>
                <select
                  value={menuItemId || menuItems[0]?.id}
                  onChange={(e) => setMenuItemId(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none"
                >
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Deduction Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none uppercase font-semibold"
                >
                  {WASTE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Quantity</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Reason / Note</label>
              <Input
                placeholder="e.g. Overcooked in kitchen / Staff dinner"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={recordMutation.isPending}>Record & Deduct</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
