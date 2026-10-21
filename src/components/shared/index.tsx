import React from 'react'
import { formatMoney } from '@/lib/utils'

export function Money({ value, currency = 'Rs.', className = '' }: { value: number | string; currency?: string; className?: string }) {
  return <span className={`font-mono tabular-nums ${className}`}>{formatMoney(value, currency)}</span>
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
      <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent mb-3" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && <p className="mt-1 text-xs">{description}</p>}
    </div>
  )
}

export { Button } from '@/components/ui/button'
export { UpdateModal } from './UpdateModal'
export { AppUpdateCard } from './AppUpdateCard'
