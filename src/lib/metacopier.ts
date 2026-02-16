import type { MetaCopierAccount, MetaCopierTrade } from '@/types'

const API_KEY = import.meta.env.VITE_METACOPIER_API_KEY

// In dev, use Vite proxy to avoid CORS. In production, call API directly.
const BASE = import.meta.env.DEV
  ? '/metacopier-api/rest/api/v1'
  : `${import.meta.env.VITE_METACOPIER_API_URL || 'https://api.metacopier.io'}/rest/api/v1`

async function apiFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  let url = `${BASE}${endpoint}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url += `?${qs}`
  }

  const res = await fetch(url, {
    headers: {
      'X-API-KEY': API_KEY,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`MetaCopier API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// Extract platform string from whatever MetaCopier returns.
// The API may return type as a string enum, an object, or nested structure.
// We stringify the whole thing and let normalizePlatform pattern-match.
function extractPlatform(raw: any): string {
  if (!raw) return 'Unknown'
  if (typeof raw === 'string') return raw
  // For any non-string (object, number, etc.), JSON.stringify so normalizePlatform
  // can pattern-match "meta_trader_5", "c_trader", etc. from the serialized form.
  const serialized = JSON.stringify(raw)
  if (serialized && serialized !== '{}') return serialized
  return 'Unknown'
}

function normalizePlatform(platform: string): string {
  const p = platform.toLowerCase()
  if (p.includes('mt5') || p.includes('metatrader 5') || p.includes('meta_trader_5')) return 'MT5'
  if (p.includes('mt4') || p.includes('metatrader 4') || p.includes('meta_trader_4')) return 'MT4'
  if (p.includes('ctrader') || p.includes('c_trader')) return 'cTrader'
  return platform || 'Unknown'
}

export async function getAccounts(): Promise<MetaCopierAccount[]> {
  const raw = await apiFetch<any[]>('/accounts')

  const infoPromises = raw.map(async (acc: any) => {
    const platformStr = normalizePlatform(extractPlatform(acc.type ?? acc.platform))

    try {
      const info = await apiFetch<any>(`/accounts/${acc.id}/information`)

      return {
        id: acc.id,
        name: acc.alias || acc.name || acc.number || acc.id,
        login: String(acc.number ?? ''),
        server: String(acc.server ?? ''),
        platform: platformStr,
        balance: Number(info.balance ?? 0),
        equity: Number(info.equity ?? 0),
        margin: Number(info.usedMargin ?? 0),
        free_margin: Number(info.freeMargin ?? 0),
        connected: Boolean(info.connected),
        trades_count: Number(info.openPositionsCount ?? 0),
        unrealized_pnl: Number(info.unrealizedProfit ?? 0),
      } satisfies MetaCopierAccount
    } catch {
      return {
        id: acc.id,
        name: acc.alias || acc.name || acc.number || acc.id,
        login: String(acc.number ?? ''),
        server: String(acc.server ?? ''),
        platform: platformStr,
        balance: 0,
        equity: 0,
        margin: 0,
        free_margin: 0,
        connected: false,
        trades_count: 0,
        unrealized_pnl: 0,
      } satisfies MetaCopierAccount
    }
  })

  return Promise.all(infoPromises)
}

export async function getAccount(accountId: string): Promise<MetaCopierAccount> {
  const [acc, info] = await Promise.all([
    apiFetch<any>(`/accounts/${accountId}`),
    apiFetch<any>(`/accounts/${accountId}/information`),
  ])

  return {
    id: acc.id,
    name: acc.alias || acc.name || acc.number || acc.id,
    login: String(acc.number ?? ''),
    server: String(acc.server ?? ''),
    platform: normalizePlatform(extractPlatform(acc.type ?? acc.platform)),
    balance: Number(info.balance ?? 0),
    equity: Number(info.equity ?? 0),
    margin: Number(info.usedMargin ?? 0),
    free_margin: Number(info.freeMargin ?? 0),
    connected: Boolean(info.connected),
    trades_count: Number(info.openPositionsCount ?? 0),
    unrealized_pnl: Number(info.unrealizedProfit ?? 0),
  }
}

export async function getAccountTrades(accountId: string): Promise<MetaCopierTrade[]> {
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const data = await apiFetch<any[]>(`/accounts/${accountId}/history/positions`, {
    startDate,
    endDate,
  })

  const positions = Array.isArray(data) ? data : []

  return positions.map((p: any) => ({
    id: p.id || p.positionId || String(p.ticket),
    symbol: p.symbol || '',
    type: p.type || p.side || '',
    volume: p.volume ?? p.lots ?? 0,
    open_price: p.openPrice ?? p.entryPrice ?? 0,
    close_price: p.closePrice ?? p.exitPrice ?? null,
    profit: p.profit ?? p.pnl ?? 0,
    swap: p.swap ?? 0,
    commission: p.commission ?? 0,
    open_time: p.openTime ?? p.openedAt ?? '',
    close_time: p.closeTime ?? p.closedAt ?? null,
  }))
}
