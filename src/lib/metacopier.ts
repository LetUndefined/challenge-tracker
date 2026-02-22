import type { MetaCopierAccount, MetaCopierTrade } from '@/types'

const API_URL = import.meta.env.VITE_METACOPIER_API_URL || 'https://api.metacopier.io'
const API_KEY = import.meta.env.VITE_METACOPIER_API_KEY

async function apiFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_URL}/rest/api/v1${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
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

interface RawAccount {
  id: string
  alias?: string
  name?: string
  number?: string
  server?: string
  type?: string
  platform?: string
  status?: string
  role?: string
  isMaster?: boolean
}

interface RawAccountInfo {
  accountId: string
  balance: number
  equity: number
  leverage: number
  currency: string
  profitThisMonth: number
  connected: boolean
  drawdown: number
  openPositions: number
  pendingOrders: number
  latencyInMs: number
}

function checkIsMaster(acc: RawAccount): boolean {
  const alias = (acc.alias ?? acc.name ?? '').toUpperCase()
  return alias === 'MASTER' || alias.includes('MASTER')
}

export async function getAccounts(): Promise<MetaCopierAccount[]> {
  const raw = await apiFetch<RawAccount[]>('/accounts')

  // Fetch live info for each account in parallel
  const infoPromises = raw.map(async (acc) => {
    const master = checkIsMaster(acc)
    try {
      const info = await apiFetch<RawAccountInfo>(`/accounts/${acc.id}/information`)
      return {
        id: acc.id,
        name: acc.alias || acc.name || acc.number || acc.id,
        login: acc.number || '',
        server: acc.server || '',
        platform: (acc.type as any)?.name ?? acc.platform ?? '',
        balance: info.balance ?? 0,
        equity: info.equity ?? 0,
        margin: 0,
        free_margin: 0,
        connected: info.connected ?? false,
        trades_count: typeof info.openPositions === 'number' ? info.openPositions : 0,
        unrealized_pnl: (info.equity ?? 0) - (info.balance ?? 0),
        is_master: master,
      } satisfies MetaCopierAccount
    } catch {
      return {
        id: acc.id,
        name: acc.alias || acc.name || acc.number || acc.id,
        login: acc.number || '',
        server: acc.server || '',
        platform: (acc.type as any)?.name ?? acc.platform ?? '',
        balance: 0,
        equity: 0,
        margin: 0,
        free_margin: 0,
        connected: false,
        trades_count: 0,
        unrealized_pnl: 0,
        is_master: false,
      } satisfies MetaCopierAccount
    }
  })

  return Promise.all(infoPromises)
}

export async function getAccount(accountId: string): Promise<MetaCopierAccount> {
  const [acc, info] = await Promise.all([
    apiFetch<RawAccount>(`/accounts/${accountId}`),
    apiFetch<RawAccountInfo>(`/accounts/${accountId}/information`),
  ])

  return {
    id: acc.id,
    name: acc.alias || acc.name || acc.number || acc.id,
    login: acc.number || '',
    server: acc.server || '',
    platform: acc.type || acc.platform || '',
    balance: info.balance ?? 0,
    equity: info.equity ?? 0,
    margin: 0,
    free_margin: 0,
    connected: info.connected ?? false,
    trades_count: typeof info.openPositions === 'number' ? info.openPositions : 0,
    unrealized_pnl: (info.equity ?? 0) - (info.balance ?? 0),
    is_master: checkIsMaster(acc),
  }
}

export interface OpenPosition {
  symbol: string
  side: string
  tp: number | null
  sl: number | null
  volume: number
  profit: number
  tpPnl: number | null
  slPnl: number | null
}

export interface OpenPositionInfo {
  pnl: number
  positions: OpenPosition[]
}

function calcProjectedPnl(
  openPrice: number,
  targetPrice: number | null,
  currentProfit: number,
  side: string,
): number | null {
  if (targetPrice === null || currentProfit === 0) return null
  const isBuy = side.toLowerCase().includes('buy') || side.toLowerCase().includes('long')
  // Current price distance from open (signed so profit is positive)
  // For buy: currentDist = currentPrice - openPrice (positive when in profit)
  // For sell: currentDist = openPrice - currentPrice (positive when in profit)
  // profit = dollarPerPoint * currentDist => dollarPerPoint = profit / currentDist
  // We don't know currentPrice, but: dollarPerPoint = profit / currentDist
  // tpPnl = dollarPerPoint * tpDist
  // Since dollarPerPoint cancels: tpPnl = profit * (tpDist / currentDist)
  // But we can compute tpDist directly:
  // For buy: tpDist = tp - openPrice, slDist = sl - openPrice
  // For sell: tpDist = openPrice - tp, slDist = openPrice - sl
  const tpDist = isBuy ? targetPrice - openPrice : openPrice - targetPrice
  // We need currentDist, derive from: profit = dollarPerPoint * currentDist
  // Since we can't separate dollarPerPoint and currentDist without contract size,
  // use the relationship: projectedPnl / profit = tpDist / currentDist
  // But we CAN get dollarPerPoint if we know one known pair: profit at openPrice = 0
  // Actually the simplest: assume profit scales linearly with price
  // tpPnl = profit * tpDist / currentDist... we still need currentDist.
  // Let's try: get dollarPerPoint from volume and known contract sizes
  return null // will use alternative approach below
}

export async function getOpenPositions(accountId: string): Promise<OpenPositionInfo> {
  try {
    const data = await apiFetch<any[]>(`/accounts/${accountId}/positions`)
    const positions = Array.isArray(data) ? data : []
    const mapped: OpenPosition[] = positions.map((p: any) => {
      const openPrice = p.openPrice ?? 0
      const tp = p.takeProfit ?? null
      const sl = p.stopLoss ?? null
      const profit = p.profit ?? p.netProfit ?? p.pnl ?? 0
      const volume = p.volume ?? 0
      const side = p.orderType ?? p.dealType ?? p.type ?? ''
      const isBuy = side.toLowerCase().includes('buy') || side.toLowerCase().includes('long')

      // Derive dollarPerPoint from current profit and price movement
      // Use currentPrice from: we fetch it indirectly
      // Alternative: compute using volume and standard contract sizes
      // For most instruments: profit = pointValue * volume * priceMovement
      // pointValue varies but profit/priceMovement * volume = constant
      // Since profit = (currentPrice - openPrice) * multiplier for buy:
      // multiplier = profit / (currentPrice - openPrice)
      // tpPnl = (tp - openPrice) * multiplier = profit * (tp - openPrice) / (currentPrice - openPrice)
      // Without currentPrice, use: swap + commission are separate, so profit is pure P&L
      // We can compute multiplier if we assume standard lot sizes, but that's fragile

      // Practical approach: use the gross profit and assume linear scaling
      // Since we can't get currentPrice, calculate the multiplier from profit per point
      // by using the account's equity change... too complex

      // Simplest reliable approach: compute dollar per point from volume
      // For metals (XAU): 1 lot = 100 units, so dollarPerPoint = volume * 100
      // For forex: 1 lot = 100,000 units, dollarPerPoint = volume * 100000 * pipSize
      // This is symbol-dependent, let's use a heuristic
      const symbol = (p.symbol ?? '').toUpperCase()
      let dollarPerPoint: number
      if (symbol.includes('XAU') || symbol.includes('GOLD')) {
        dollarPerPoint = volume * 100
      } else if (symbol.includes('XAG') || symbol.includes('SILVER')) {
        dollarPerPoint = volume * 5000
      } else if (symbol.includes('BTC')) {
        dollarPerPoint = volume * 1
      } else if (symbol.includes('US30') || symbol.includes('DJ30')) {
        dollarPerPoint = volume * 1
      } else if (symbol.includes('NAS') || symbol.includes('US100')) {
        dollarPerPoint = volume * 1
      } else if (symbol.includes('SPX') || symbol.includes('US500')) {
        dollarPerPoint = volume * 1
      } else {
        // Forex default: 1 lot = 100,000 units
        dollarPerPoint = volume * 100000
        // For JPY pairs, pip = 0.01, for others pip = 0.0001
        // But we're computing per price point, not per pip
      }

      let tpPnl: number | null = null
      let slPnl: number | null = null

      if (tp !== null) {
        const tpDist = isBuy ? tp - openPrice : openPrice - tp
        tpPnl = Math.round(tpDist * dollarPerPoint * 100) / 100
      }
      if (sl !== null) {
        const slDist = isBuy ? sl - openPrice : openPrice - sl
        slPnl = Math.round(slDist * dollarPerPoint * 100) / 100
      }

      return { symbol, side, tp, sl, volume, profit, tpPnl, slPnl }
    })
    const pnl = mapped.reduce((sum, p) => sum + p.profit, 0)
    return { pnl, positions: mapped }
  } catch {
    return { pnl: 0, positions: [] }
  }
}

export async function getAccountTrades(accountId: string, daysBack = 30): Promise<MetaCopierTrade[]> {
  const endDate = new Date().toISOString()
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

  const data = await apiFetch<any[]>(`/accounts/${accountId}/history/positions`, {
    start: startDate,
    stop: endDate,
  })

  const raw = Array.isArray(data) ? data : []

  // Filter out deposits, withdrawals, and balance operations
  const positions = raw.filter((p: any) => {
    const type = String(p.type ?? p.side ?? '').toLowerCase()
    if (type === 'balance' || type === 'deposit' || type === 'withdrawal' || type === 'credit') return false
    if (!p.symbol && (p.volume === 0 || p.volume === undefined)) return false
    return true
  })

  return positions.map((p: any) => ({
    id: p.id || p.positionId || String(p.ticket),
    symbol: p.symbol || '',
    type: p.type || p.side || '',
    volume: p.volume ?? p.lots ?? 0,
    open_price: p.openPrice ?? p.entryPrice ?? 0,
    close_price: p.closePrice ?? p.exitPrice ?? null,
    profit: p.profit ?? p.pnl ?? p.netProfit ?? p.pl ?? p.realizedPnl ?? 0,
    swap: p.swap ?? 0,
    commission: p.commission ?? 0,
    open_time: p.openTime ?? p.openedAt ?? '',
    close_time: p.closeTime ?? p.closedAt ?? null,
  }))
}
