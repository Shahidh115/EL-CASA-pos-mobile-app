import React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextType {
  value: string
  onChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType>({ value: '', onChange: () => {} })

export function Tabs({ value, onValueChange, children, className }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('inline-flex items-center gap-1.5 rounded-lg bg-muted p-1', className)}>{children}</div>
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { value: selected, onChange } = React.useContext(TabsContext)
  const isSelected = selected === value

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none',
        isSelected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}
