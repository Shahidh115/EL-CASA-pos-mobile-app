import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Sliders, Archive, RotateCcw, Package, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { api, unwrap } from '@/lib/api'
import type { ProductionResource } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingBlock } from '@/components/shared'

export default function ResourcesPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRes, setEditingRes] = useState<ProductionResource | null>(null)
  const [adjustRes, setAdjustRes] = useState<ProductionResource | null>(null)

  // Form inputs
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('Portion')
  const [warningLevel, setWarningLevel] = useState('')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => unwrap<ProductionResource[]>(api.get('/resources?all=1')),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['resources'] })
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        unit: unit.trim(),
        warning_level: parseFloat(warningLevel) || 0,
      }
      if (editingRes) {
        return unwrap(api.put(`/resources/${editingRes.id}`, payload))
      }
      return unwrap(api.post('/resources', payload))
    },
    onSuccess: () => {
      toast.success(editingRes ? 'Resource updated' : 'Resource created')
      setModalOpen(false)
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjustRes) return
      return unwrap(
        api.post(`/resources/${adjustRes.id}/adjust`, {
          quantity: parseFloat(adjustQty) || 0,
          note: adjustNote.trim() || undefined,
        })
      )
    },
    onSuccess: () => {
      toast.success('Stock adjusted')
      setAdjustRes(null)
      setAdjustQty('')
      setAdjustNote('')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const toggleArchiveMutation = useMutation({
    mutationFn: async (res: ProductionResource) => {
      if (res.is_active) {
        return unwrap(api.post(`/resources/${res.id}/archive`))
      }
      return unwrap(api.post(`/resources/${res.id}/restore`))
    },
    onSuccess: () => {
      toast.success('Resource status updated')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  if (isLoading) return <LoadingBlock label="Loading resources…" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Production Resources</h2>
          <p className="text-xs text-muted-foreground">Kitchen inventory ingredients tracked by portions and units</p>
        </div>
        <Button
          onClick={() => {
            setEditingRes(null)
            setName('')
            setUnit('Portion')
            setWarningLevel('10')
            setModalOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" /> Add Resource
        </Button>
      </div>

      {/* Grid of resources */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((res) => {
          const isLow = res.current_balance <= res.warning_level

          return (
            <Card key={res.id} className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground">{res.name}</h3>
                    <span className="text-xs text-muted-foreground font-mono">Unit: {res.unit}</span>
                  </div>
                  {isLow && (
                    <Badge variant="destructive" className="text-[10px] gap-1 font-bold">
                      <AlertTriangle className="size-3" /> LOW STOCK
                    </Badge>
                  )}
                </div>

                <div className="mt-4 flex items-baseline justify-between p-3 rounded-xl bg-muted/40 border">
                  <span className="text-xs font-semibold text-muted-foreground">Current Balance</span>
                  <span className={`font-mono text-2xl font-black ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                    {res.current_balance} {res.unit}
                  </span>
                </div>

                <div className="mt-2 text-[11px] text-muted-foreground flex justify-between">
                  <span>Warning threshold:</span>
                  <span className="font-mono font-semibold">{res.warning_level} {res.unit}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAdjustRes(res)
                    setAdjustQty('0')
                    setAdjustNote('')
                  }}
                  className="h-8 text-xs gap-1.5"
                >
                  <Sliders className="size-3.5" /> Manual Adjust
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingRes(res)
                      setName(res.name)
                      setUnit(res.unit)
                      setWarningLevel(String(res.warning_level))
                      setModalOpen(true)
                    }}
                    className="size-8"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleArchiveMutation.mutate(res)}
                    className="size-8"
                  >
                    {res.is_active ? <Archive className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Edit / Create Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>{editingRes ? 'Edit Resource' : 'Add Production Resource'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveMutation.mutate()
            }}
            className="space-y-3 pt-2"
          >
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Resource Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Unit</label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Warning Trigger</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={warningLevel}
                  onChange={(e) => setWarningLevel(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="pt-3 flex justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Resource</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manual Stock Adjust Dialog */}
      <Dialog open={Boolean(adjustRes)} onOpenChange={(v) => !v && setAdjustRes(null)}>
        {adjustRes && (
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle>Manual Stock Adjustment · {adjustRes.name}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                adjustMutation.mutate()
              }}
              className="space-y-3 pt-2"
            >
              <div className="p-3 rounded-xl bg-muted/40 border text-xs">
                Current Balance: <span className="font-bold font-mono">{adjustRes.current_balance} {adjustRes.unit}</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Quantity Adjustment (+ or -)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. +10 or -5"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Reason / Audit Note</label>
                <Input
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. Physical inventory reconciliation"
                  required
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAdjustRes(null)}>Cancel</Button>
                <Button type="submit">Apply Adjustment</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
