import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Archive, RotateCcw, Utensils, Star, BookOpen, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { api, unwrap } from '@/lib/api'
import type { MenuItem, Category, ProductionResource, RecipeDto } from '@/types'
import { formatMoney } from '@/lib/utils'
import { useSettings } from '@/hooks/useData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingBlock } from '@/components/shared'
import { RecipeBuilder, type RecipeLineInput } from '@/components/RecipeBuilder'

export default function MenuPage() {
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()
  const currency = settings?.currency || 'Rs.'

  const [selectedCat, setSelectedCat] = useState('all')
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [recipeModalItem, setRecipeModalItem] = useState<MenuItem | null>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState<number>(0)
  const [description, setDescription] = useState('')
  const [catName, setCatName] = useState('')

  // Recipe versioning states
  const [recipeLines, setRecipeLines] = useState<RecipeLineInput[]>([])
  const [recipeVerName, setRecipeVerName] = useState('')

  // Queries
  const { data: menuItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => unwrap<MenuItem[]>(api.get('/menu-items?all=1')),
  })

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => unwrap<Category[]>(api.get('/categories?all=1')),
  })

  const { data: resources = [] } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => unwrap<ProductionResource[]>(api.get('/resources')),
  })

  const { data: recipeVersions = [] } = useQuery({
    queryKey: ['recipes', recipeModalItem?.id],
    queryFn: async () => {
      if (!recipeModalItem) return []
      return unwrap<RecipeDto[]>(api.get(`/menu-items/${recipeModalItem.id}/recipes`))
    },
    enabled: Boolean(recipeModalItem),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['menu-items'] })
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // Mutations
  const saveItemMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        price: parseFloat(price) || 0,
        category_id: categoryId || categories[0]?.id,
        description: description.trim() || undefined,
      }
      if (editingItem) {
        return unwrap(api.put(`/menu-items/${editingItem.id}`, payload))
      }
      return unwrap(api.post('/menu-items', payload))
    },
    onSuccess: () => {
      toast.success(editingItem ? 'Item updated' : 'Item created')
      setItemModalOpen(false)
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => unwrap(api.delete(`/menu-items/${id}`)),
    onSuccess: (name) => {
      toast.success(`Menu item '${name}' deleted`)
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const createCategoryMutation = useMutation({
    mutationFn: async () => unwrap(api.post('/categories', { name: catName.trim() })),
    onSuccess: () => {
      toast.success('Category created')
      setCategoryModalOpen(false)
      setCatName('')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const saveRecipeVersionMutation = useMutation({
    mutationFn: async () => {
      if (!recipeModalItem) return
      return unwrap(
        api.post(`/menu-items/${recipeModalItem.id}/recipes`, {
          name: recipeVerName || null,
          items: recipeLines,
        })
      )
    },
    onSuccess: () => {
      toast.success('New recipe version activated')
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeModalItem?.id] })
      setRecipeLines([])
      setRecipeVerName('')
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const activateRecipeMutation = useMutation({
    mutationFn: async (recipeId: number) => unwrap(api.post(`/recipes/${recipeId}/activate`)),
    onSuccess: () => {
      toast.success('Recipe version activated')
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeModalItem?.id] })
      invalidate()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const openEdit = (item: MenuItem) => {
    setEditingItem(item)
    setName(item.name)
    setPrice(String(item.price))
    setCategoryId(item.category_id)
    setDescription(item.description || '')
    setItemModalOpen(true)
  }

  const openCreate = () => {
    setEditingItem(null)
    setName('')
    setPrice('')
    setCategoryId(categories[0]?.id || 0)
    setDescription('')
    setItemModalOpen(true)
  }

  if (itemsLoading || catsLoading) return <LoadingBlock label="Loading menu items…" />

  const filtered = selectedCat === 'all'
    ? menuItems
    : menuItems.filter((i) => i.category_id === Number(selectedCat))

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedCat('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCat === 'all' ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-card border text-muted-foreground'}`}
          >
            All Items ({menuItems.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCat(String(c.id))}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCat === String(c.id) ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-card border text-muted-foreground'}`}
            >
              {c.name} ({c.menu_items_count || 0})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoryModalOpen(true)} className="gap-1.5">
            <Plus className="size-4" /> Add Category
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" /> Add Menu Item
          </Button>
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <Card key={item.id} className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold mb-1">
                    {item.category}
                  </Badge>
                  <h3 className="text-base font-bold text-foreground leading-tight">{item.name}</h3>
                </div>
                <span className="font-mono font-black text-primary text-base">
                  {formatMoney(item.price, currency)}
                </span>
              </div>

              {item.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              )}

              <div className="mt-3 flex items-center gap-2 text-xs">
                {item.has_recipe ? (
                  <Badge variant="success" className="gap-1 text-[10px]">
                    <Layers className="size-3" /> Recipe v{item.recipe_version || 1}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">No Recipe</Badge>
                )}
                <span className="text-muted-foreground text-[11px] font-mono">
                  Capacity: {item.max_preparable}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecipeModalItem(item)}
                className="h-8 text-xs gap-1.5 text-primary"
              >
                <BookOpen className="size-3.5" />
                Recipe Versions
              </Button>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="size-8">
                  <Edit2 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`Delete menu item '${item.name}'?`)) {
                      deleteItemMutation.mutate(item.id)
                    }
                  }}
                  className="size-8 text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add / Edit Menu Item Dialog */}
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveItemMutation.mutate()
            }}
            className="space-y-3 pt-2"
          >
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Item Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Price ({currency})</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => setItemModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveItemMutation.isPending}>Save Item</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              createCategoryMutation.mutate()
            }}
            className="space-y-3 pt-2"
          >
            <Input
              placeholder="e.g. Burgers, Beverages…"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recipe Versions Modal */}
      <Dialog open={Boolean(recipeModalItem)} onOpenChange={(v) => !v && setRecipeModalItem(null)}>
        {recipeModalItem && (
          <DialogContent className="max-w-lg p-6 max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                Recipe Versions · {recipeModalItem.name}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {/* Active / Historical versions list */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase">Version History</h4>
                {recipeVersions.map((ver) => (
                  <div
                    key={ver.id}
                    className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${ver.is_current ? 'border-primary bg-primary/5' : 'bg-card'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">Version {ver.version}</span>
                        {ver.is_current ? (
                          <Badge variant="success" className="text-[10px]">CURRENT ACTIVE</Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => activateRecipeMutation.mutate(ver.id)}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ver.items.map((item) => (
                        <span key={item.resource_id} className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono">
                          {item.resource}: {item.quantity} {item.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Create new version builder */}
              <div className="pt-4 border-t space-y-3">
                <h4 className="text-xs font-bold text-foreground">Create New Recipe Version</h4>
                <Input
                  placeholder="Version note / variation name (optional)…"
                  value={recipeVerName}
                  onChange={(e) => setRecipeVerName(e.target.value)}
                  className="h-8 text-xs"
                />
                <RecipeBuilder
                  resources={resources}
                  items={recipeLines}
                  onChange={setRecipeLines}
                />
                <Button
                  type="button"
                  disabled={recipeLines.length === 0 || saveRecipeVersionMutation.isPending}
                  onClick={() => saveRecipeVersionMutation.mutate()}
                  className="w-full text-xs font-bold"
                >
                  Activate New Version
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
