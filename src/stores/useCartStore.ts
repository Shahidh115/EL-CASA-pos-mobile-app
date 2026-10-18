import { create } from 'zustand'
import type { MenuItem } from '@/types'

export interface CartLine {
  menu_item_id: number
  name: string
  price: number
  quantity: number
  category?: string
}

interface CartState {
  lines: CartLine[]
  discount: number
  paymentType: string
  note: string
  addItem: (item: MenuItem, quantity?: number) => void
  setQuantity: (menuItemId: number, quantity: number) => void
  removeItem: (menuItemId: number) => void
  clear: () => void
  setDiscount: (value: number) => void
  setPaymentType: (value: string) => void
  setNote: (value: string) => void
  replaceWith: (lines: CartLine[]) => void
}

export const useCartStore = create<CartState>()((set) => ({
  lines: [],
  discount: 0,
  paymentType: 'cash',
  note: '',
  addItem: (item, quantity = 1) =>
    set((state) => {
      const existing = state.lines.find((line) => line.menu_item_id === item.id)
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.menu_item_id === item.id ? { ...line, quantity: line.quantity + quantity } : line
          ),
        }
      }
      return {
        lines: [
          ...state.lines,
          {
            menu_item_id: item.id,
            name: item.name,
            price: item.price,
            quantity,
            category: item.category,
          },
        ],
      }
    }),
  setQuantity: (menuItemId, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((line) => line.menu_item_id !== menuItemId)
          : state.lines.map((line) =>
              line.menu_item_id === menuItemId ? { ...line, quantity } : line
            ),
    })),
  removeItem: (menuItemId) =>
    set((state) => ({
      lines: state.lines.filter((line) => line.menu_item_id !== menuItemId),
    })),
  clear: () => set({ lines: [], discount: 0, note: '' }),
  setDiscount: (value) => set({ discount: Math.max(0, value) }),
  setPaymentType: (value) => set({ paymentType: value }),
  setNote: (value) => set({ note: value }),
  replaceWith: (lines) => set({ lines, discount: 0, note: '' }),
}))

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
}
