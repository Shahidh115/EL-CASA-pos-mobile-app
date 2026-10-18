import * as React from 'react'
import { cn } from '@/lib/utils'

export function ScrollArea({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('overflow-y-auto scrollbar-thin', className)} {...props}>
      {children}
    </div>
  )
}
