import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '@/lib/api'
import type { DashboardData, PosData, SettingsData } from '@/types'

export function usePosData() {
  return useQuery({
    queryKey: ['pos-data'],
    queryFn: async () => unwrap<PosData>(api.get('/pos/data')),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => unwrap<DashboardData>(api.get('/dashboard')),
    refetchInterval: 30_000,
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => unwrap<SettingsData>(api.get('/settings')),
    staleTime: 30_000,
  })
}
