import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useMetaCopier } from './useMetaCopier'
import { useChallenges } from './useChallenges'
import type { MetaCopierTrade } from '@/types'

export interface TradeNotification {
  id: string
  challenge_id: string
  account_alias: string
  symbol: string
  side: string
  volume: number
  profit: number | null
  open_price: number
  close_price: number | null
  open_time: string
  close_time: string | null
  is_open: boolean
  timestamp: string
}

const notifications = ref<TradeNotification[]>([])
const seenTradeIds = ref<Set<string>>(new Set())
const loading = ref(false)

let pollInterval: ReturnType<typeof setInterval> | null = null

export function useNotifications() {
  const { fetchTrades } = useMetaCopier()
  const { challenges, challengeRows } = useChallenges()

  async function pollForNewTrades() {
    loading.value = true
    try {
      for (const ch of challenges.value) {
        const trades = await fetchTrades(ch.metacopier_account_id)
        const row = challengeRows.value.find(r => r.id === ch.id)
        const alias = row?.alias ?? ch.alias ?? ch.login_number

        for (const trade of trades) {
          const key = `${ch.metacopier_account_id}-${trade.id}`
          if (!seenTradeIds.value.has(key)) {
            seenTradeIds.value.add(key)
            notifications.value.unshift({
              id: key,
              challenge_id: ch.id,
              account_alias: alias,
              symbol: trade.symbol,
              side: trade.type,
              volume: trade.volume,
              profit: trade.profit,
              open_price: trade.open_price,
              close_price: trade.close_price,
              open_time: trade.open_time,
              close_time: trade.close_time,
              is_open: trade.close_time === null,
              timestamp: trade.close_time ?? trade.open_time,
            })
          }
        }
      }
      // Keep last 200 notifications
      if (notifications.value.length > 200) {
        notifications.value = notifications.value.slice(0, 200)
      }
    } catch (e) {
      console.error('Failed to poll trades:', e)
    } finally {
      loading.value = false
    }
  }

  function startPolling(intervalMs = 15_000) {
    stopPolling()
    pollForNewTrades()
    pollInterval = setInterval(pollForNewTrades, intervalMs)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  const unreadCount = computed(() => {
    // Count notifications from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    return notifications.value.filter(n => n.timestamp > oneHourAgo).length
  })

  return {
    notifications,
    loading,
    unreadCount,
    pollForNewTrades,
    startPolling,
    stopPolling,
  }
}
