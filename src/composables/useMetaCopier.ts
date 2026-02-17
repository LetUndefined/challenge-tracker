import { ref } from 'vue'
import type { MetaCopierAccount, MetaCopierTrade } from '@/types'
import { getAccounts, getAccountTrades, getOpenPositions } from '@/lib/metacopier'
import type { OpenPositionInfo } from '@/lib/metacopier'

const accounts = ref<MetaCopierAccount[]>([])
const openPositionsMap = ref<Record<string, OpenPositionInfo>>({})
const lastTradeMap = ref<Record<string, string>>({})
const tradeCountMap = ref<Record<string, number>>({})
const loading = ref(false)
const error = ref<string | null>(null)

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
            return { id: acc.id, lastTime, count: trades.length }
          } catch {
            return { id: acc.id, lastTime: '', count: 0 }
          }
        })
      )
      lastTradeMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.lastTime]))
      tradeCountMap.value = Object.fromEntries(tradeResults.map(r => [r.id, r.count]))
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
    loading,
    error,
    fetchAccounts,
    fetchTrades,
    startAutoRefresh,
    stopAutoRefresh,
  }
}
