import * as React from 'react'
import { cn } from '@/lib/utils'

export function Separator({ className, orientation = 'horizontal', ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full my-2' : 'h-full w-[1px] mx-2',
        className
      )}
      {...props}
    />
  )
}
