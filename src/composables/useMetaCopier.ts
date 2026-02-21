import { ref } from 'vue'
import type { MetaCopierAccount, MetaCopierTrade } from '@/types'
import { getAccounts, getAccountTrades, getOpenPositions } from '@/lib/metacopier'
import type { OpenPositionInfo } from '@/lib/metacopier'

const accounts = ref<MetaCopierAccount[]>([])
const openPositionsMap = ref<Record<string, OpenPositionInfo>>({})
const lastTradeMap = ref<Record<string, string>>({})
const tradeCountMap = ref<Record<string, number>>({})
const streakMap = ref<Record<string, { direction: 'W' | 'L'; count: number } | null>>({})
const dailyPnlMap = ref<Record<string, number>>({})
const loading = ref(false)
const error = ref<string | null>(null)

function computeDailyPnl(trades: MetaCopierTrade[]): number {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const midnightMs = midnight.getTime()
  return trades
    .filter(t => t.close_time !== null && new Date(t.close_time).getTime() >= midnightMs)
    .reduce((sum, t) => sum + (t.profit ?? 0), 0)
}

function computeStreak(trades: MetaCopierTrade[]): { direction: 'W' | 'L'; count: number } | null {
  const closed = trades
    .filter(t => t.close_time !== null && (t.profit ?? 0) !== 0)
    .sort((a, b) => (b.close_time ?? '').localeCompare(a.close_time ?? ''))
  if (closed.length === 0) return null
  const direction = (closed[0].profit ?? 0) > 0 ? 'W' : 'L'
  let count = 0
  for (const t of closed) {
    if (((t.profit ?? 0) > 0) === (direction === 'W')) count++
    else break
  }
  return { direction, count }
}

let refreshInterval: ReturnType<typeof setInterval> | null = null

export function useMetaCopier() {
  async function fetchAccounts() {
    loading.value = true
    error.value = null
    try {
      accounts.value = await getAccounts()
      // Fetch open positions (PNL, TP, SL) in parallel
      const posEntries = await Promise.all(
        accounts.value.map(async (acc) => {
          const info = await getOpenPositions(acc.id)
          return [acc.id, info] as const
        })
      )
      openPositionsMap.value = Object.fromEntries(posEntries)

      // Fetch trade history for last trade time and total count
      const tradeResults = await Promise.all(
        accounts.value.map(async (acc) => {
          try {
            const trades = await getAccountTrades(acc.id)
            let lastTime = ''
            if (trades.length > 0) {
              const sorted = trades.sort((a, b) => {
                const ta = a.close_time ?? a.open_time
                const tb = b.close_time ?? b.open_time
                return tb.localeCompare(ta)
              })
              lastTime = sorted[0].close_time ?? sorted[0].open_time
            }
            return { id: acc.id, lastTime, count: trades.length, streak: computeStreak(trades), dailyPnl: computeDailyPnl(trades) }
          } catch {
            return { id: acc.id, lastTime: '', count: 0, streak: null, dailyPnl: 0 }
          }
        })
      )
      lastTradeMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.lastTime]))
      tradeCountMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.count]))
      streakMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.streak]))
      dailyPnlMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.dailyPnl]))
    } catch (e: any) {
      error.value = e.message
      console.error('Failed to fetch MetaCopier accounts:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchTrades(accountId: string): Promise<MetaCopierTrade[]> {
    try {
      return await getAccountTrades(accountId)
    } catch (e: any) {
      console.error(`Failed to fetch trades for ${accountId}:`, e)
      return []
    }
  }

  function startAutoRefresh(intervalMs = 30_000) {
    stopAutoRefresh()
    fetchAccounts()
    refreshInterval = setInterval(fetchAccounts, intervalMs)
  }

  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  return {
    accounts,
    openPositionsMap,
    lastTradeMap,
    tradeCountMap,
    streakMap,
    dailyPnlMap,
    loading,
    error,
    fetchAccounts,
    fetchTrades,
    startAutoRefresh,
    stopAutoRefresh,
  }
}
