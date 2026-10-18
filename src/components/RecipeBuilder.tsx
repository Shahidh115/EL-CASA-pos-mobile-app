import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ProductionResource } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface RecipeLineInput {
  production_resource_id: number
  quantity: number
}

interface RecipeBuilderProps {
  resources: ProductionResource[]
  items: RecipeLineInput[]
  onChange: (items: RecipeLineInput[]) => void
}

export function RecipeBuilder({ resources, items, onChange }: RecipeBuilderProps) {
  const handleAddLine = () => {
    if (resources.length === 0) return
    const unused = resources.find((r) => !items.some((i) => i.production_resource_id === r.id))
    const resId = unused ? unused.id : resources[0].id
    onChange([...items, { production_resource_id: resId, quantity: 1 }])
  }

  const handleUpdate = (index: number, patch: Partial<RecipeLineInput>) => {
    const updated = items.map((line, i) => (i === index ? { ...line, ...patch } : line))
    onChange(updated)
  }

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground">Recipe Ingredients & Resources</label>
        <Button type="button" variant="outline" size="sm" onClick={handleAddLine} className="gap-1.5 h-7 text-xs">
          <Plus className="size-3.5" /> Add Resource
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
          No resources attached. Click "Add Resource" to define recipe quantities.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((line, idx) => {
            const res = resources.find((r) => r.id === line.production_resource_id)
            return (
              <div key={idx} className="flex items-center gap-2 rounded-lg border p-2 bg-card">
                <select
                  value={line.production_resource_id}
                  onChange={(e) => handleUpdate(idx, { production_resource_id: Number(e.target.value) })}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.unit})
                    </option>
                  ))}
                </select>

                <div className="w-24">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.001"
                    value={line.quantity}
                    onChange={(e) => handleUpdate(idx, { quantity: parseFloat(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>

                <span className="text-xs text-muted-foreground min-w-10">{res?.unit || ''}</span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(idx)}
                  className="size-8 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
