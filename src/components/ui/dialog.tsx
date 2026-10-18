import React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => onOpenChange?.(false)} />
      <div className="relative z-50 w-full max-w-lg overflow-hidden rounded-2xl border bg-card p-6 shadow-2xl">
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-col space-y-1.5 text-left mb-4', className)}>{children}</div>
}

export function DialogTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn('text-lg font-bold leading-none tracking-tight text-foreground', className)}>{children}</h2>
}

export function DialogDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn('text-xs text-muted-foreground', className)}>{children}</p>
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>
}
