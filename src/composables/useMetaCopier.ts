import { ref } from 'vue'
import type { MetaCopierAccount, MetaCopierTrade } from '@/types'
import { getAccounts, getAccountTrades } from '@/lib/metacopier'

const accounts = ref<MetaCopierAccount[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

let refreshInterval: ReturnType<typeof setInterval> | null = null

export function useMetaCopier() {
  async function fetchAccounts() {
    loading.value = true
    error.value = null
    try {
      accounts.value = await getAccounts()
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
    loading,
    error,
    fetchAccounts,
    fetchTrades,
    startAutoRefresh,
    stopAutoRefresh,
  }
}
