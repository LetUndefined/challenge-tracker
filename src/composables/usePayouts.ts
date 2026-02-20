import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Payout } from '@/types'

const payouts = ref<Payout[]>([])
const loading = ref(false)

export function usePayouts() {
  async function fetchPayouts() {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .order('requested_at', { ascending: false })
      if (error) throw error
      payouts.value = data ?? []
    } catch (e) {
      console.error('Failed to fetch payouts:', e)
    } finally {
      loading.value = false
    }
  }

  async function addPayout(payout: Omit<Payout, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('payouts')
      .insert(payout)
      .select()
      .single()
    if (error) throw error
    payouts.value.unshift(data)
    return data
  }

  async function updatePayout(id: string, fields: Partial<Pick<Payout, 'status' | 'received_at' | 'notes' | 'amount'>>) {
    const { data, error } = await supabase
      .from('payouts')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const idx = payouts.value.findIndex(p => p.id === id)
    if (idx !== -1) payouts.value[idx] = data
    return data
  }

  async function deletePayout(id: string) {
    const { error } = await supabase.from('payouts').delete().eq('id', id)
    if (error) throw error
    payouts.value = payouts.value.filter(p => p.id !== id)
  }

  const totalReceived = computed(() =>
    payouts.value.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)
  )
  const totalPending = computed(() =>
    payouts.value.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0)
  )

  return {
    payouts,
    loading,
    totalReceived,
    totalPending,
    fetchPayouts,
    addPayout,
    updatePayout,
    deletePayout,
  }
}
