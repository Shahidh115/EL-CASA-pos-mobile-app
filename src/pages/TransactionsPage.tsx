import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Filter, Calendar } from 'lucide-react'
import { api, unwrap } from '@/lib/api'
import type { ResourceTransaction } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingBlock } from '@/components/shared'

const TX_TYPES = ['ALL', 'OPENING', 'PRODUCTION', 'SALE', 'SALE_RESTORE', 'WASTE', 'MANUAL_ADJUSTMENT']

export default function TransactionsPage() {
  const [type, setType] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', type, from, to],
    queryFn: async () => {
      const params: any = {}
      if (type !== 'ALL') params.type = type
      if (from) params.from = from
      if (to) params.to = to
      return unwrap<ResourceTransaction[]>(api.get('/transactions', { params }))
    },
  })

  if (isLoading) return <LoadingBlock label="Loading audit log…" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Resource Transaction Audit Log</h2>
          <p className="text-xs text-muted-foreground">Immutable historical trail of all kitchen ingredient stock movements</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold focus:outline-none"
          >
            {TX_TYPES.map((t) => (
              <option key={t} value={t}>{t === 'ALL' ? 'All Movement Types' : t}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">No transaction records found.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3 pl-4">Resource</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Balance After</th>
                  <th className="p-3">Note / Reference</th>
                  <th className="p-3 pr-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx) => {
                  const isPositive = tx.quantity > 0
                  return (
                    <tr key={tx.id} className="hover:bg-accent/30 transition-colors">
                      <td className="p-3 pl-4 font-bold text-foreground">{tx.resource}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            tx.type === 'SALE'
                              ? 'destructive'
                              : tx.type === 'PRODUCTION' || tx.type === 'OPENING' || tx.type === 'SALE_RESTORE'
                                ? 'success'
                                : 'secondary'
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {tx.type}
                        </Badge>
                      </td>
                      <td className={`p-3 font-mono font-bold ${isPositive ? 'text-emerald-500' : 'text-destructive'}`}>
                        {isPositive ? `+${tx.quantity}` : tx.quantity} {tx.unit}
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground">
                        {tx.balance_after} {tx.unit}
                      </td>
                      <td className="p-3 text-muted-foreground">{tx.note || '—'}</td>
                      <td className="p-3 pr-4 text-right text-muted-foreground font-mono">
                        {tx.date} ({formatDateTime(tx.created_at)})
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
