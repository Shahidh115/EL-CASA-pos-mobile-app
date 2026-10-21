import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number | string | null | undefined, currency = 'Rs.'): string {
  const n = Number(amount) || 0
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function todayISO(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDate(isoStr?: string | number | Date | null): Date | null {
  if (!isoStr) return null
  if (isoStr instanceof Date) return isNaN(isoStr.getTime()) ? null : isoStr
  if (typeof isoStr === 'number') {
    const d = new Date(isoStr)
    return isNaN(d.getTime()) ? null : d
  }

  try {
    let parseStr = String(isoStr).trim()
    if (!parseStr) return null

    // SQLite datetime('now') returns UTC string like "YYYY-MM-DD HH:MM:SS" without a timezone
    // Append 'Z' and replace space with 'T' so JS Date parses it as UTC, then converts to local timezone
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(parseStr)) {
      parseStr = parseStr.replace(' ', 'T') + 'Z'
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(parseStr) && !parseStr.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(parseStr)) {
      parseStr += 'Z'
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(parseStr)) {
      // Date only (YYYY-MM-DD): parse in local timezone to avoid UTC midnight date shifts
      const [y, m, day] = parseStr.split('-').map(Number)
      return new Date(y, m - 1, day)
    }

    const d = new Date(parseStr)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

export function formatDate(isoStr?: string | number | Date | null): string {
  const d = parseDate(isoStr)
  if (!d) return typeof isoStr === 'string' ? isoStr : ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatTime(isoStr?: string | number | Date | null, includeSeconds = false): string {
  const d = parseDate(isoStr)
  if (!d) return ''
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  })
}

export function formatDateTime(isoStr?: string | number | Date | null): string {
  const d = parseDate(isoStr)
  if (!d) return typeof isoStr === 'string' ? isoStr : ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}
