import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useMetaCopier } from './useMetaCopier'
import type { Challenge, ChallengeRow, MetaCopierAccount, ServerMapping, PropFirmConfig } from '@/types'

const challenges = ref<Challenge[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Server name -> prop firm mapping (user can extend)
const serverMappings: ServerMapping[] = [
  { pattern: 'FTMO', prop_firm: 'FTMO' },
  { pattern: 'TheFive', prop_firm: 'The 5%ers' },
  { pattern: '5ers', prop_firm: 'The 5%ers' },
  { pattern: 'FundedHive', prop_firm: 'FundedHive' },
  { pattern: 'FundedNext', prop_firm: 'FundedNext' },
  { pattern: 'MyFundedFX', prop_firm: 'MyFundedFX' },
  { pattern: 'TrueForex', prop_firm: 'TrueForexFunds' },
  { pattern: 'Topstep', prop_firm: 'Topstep' },
  { pattern: 'E8Fund', prop_firm: 'E8 Funding' },
  { pattern: 'E8Markets', prop_firm: 'E8 Funding' },
  { pattern: 'SurgeTrader', prop_firm: 'SurgeTrader' },
  { pattern: 'CityTraders', prop_firm: 'City Traders Imperium' },
  { pattern: 'Alpha', prop_firm: 'Alpha Capital' },
]

// Prop firm rules for drawdown limits
const propFirmRules: PropFirmConfig[] = [
  { id: '1', name: 'FTMO', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '2', name: 'The 5%ers', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '3', name: 'FundedHive', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 8 },
  ]},
  { id: '4', name: 'FundedNext', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '5', name: 'MyFundedFX', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 12 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 12 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 12 },
  ]},
  { id: '6', name: 'E8 Funding', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 8 },
  ]},
  { id: '7', name: 'Alpha Capital', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '8', name: 'SurgeTrader', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 4, max_dd_pct: 5 },
  ]},
  { id: '9', name: 'TrueForexFunds', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '10', name: 'City Traders Imperium', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 0, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 0, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 0, max_dd_pct: 10 },
  ]},
]

function getPhaseRules(propFirm: string, phase: string) {
  const firm = propFirmRules.find(f => f.name === propFirm)
  if (!firm) return { daily_dd_pct: 5, max_dd_pct: 10 }
  const phaseConfig = firm.phases.find(p => p.name === phase)
  return phaseConfig ?? { daily_dd_pct: 5, max_dd_pct: 10 }
}

function guessProFirm(server: string): string {
  const match = serverMappings.find(m =>
    server.toLowerCase().includes(m.pattern.toLowerCase())
  )
  return match?.prop_firm ?? 'Unknown'
}

function guessPlatform(account: MetaCopierAccount): string {
  const p = String(account.platform ?? '').toLowerCase()
  if (p.includes('mt5') || p.includes('metatrader 5')) return 'MT5'
  if (p.includes('mt4') || p.includes('metatrader 4')) return 'MT4'
  if (p.includes('ctrader')) return 'cTrader'
  return String(account.platform || 'Unknown')
}

export function useChallenges() {
  const { accounts } = useMetaCopier()

  async function fetchChallenges() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      challenges.value = data ?? []
    } catch (e: any) {
      error.value = e.message
      console.error('Failed to fetch challenges:', e)
    } finally {
      loading.value = false
    }
  }

  const challengeRows = computed<ChallengeRow[]>(() => {
    return challenges.value.map(ch => {
      const acc = accounts.value.find(a => a.id === ch.metacopier_account_id)
      const isMaster = Boolean((ch as any).is_master)
      const rules = getPhaseRules(ch.prop_firm, ch.phase)

      const balance = acc?.balance ?? 0
      const equity = acc?.equity ?? 0
      const starting = balance > 0 ? balance : 1
      const pnl = equity - starting
      const target = starting * (ch.target_pct / 100)
      const progress = target > 0 ? Math.min((pnl / target) * 100, 100) : 0

      // Current drawdown: how far equity is below starting balance
      const currentDd = starting > 0 ? Math.max(((starting - equity) / starting) * 100, 0) : 0

      // Challenge status (master accounts are always "Active")
      let challengeStatus: 'Active' | 'Passed' | 'Failed' = 'Active'
      if (!isMaster) {
        if (currentDd >= rules.max_dd_pct && rules.max_dd_pct > 0) {
          challengeStatus = 'Failed'
        } else if (progress >= 100 && ch.target_pct > 0) {
          challengeStatus = 'Passed'
        }
      }

      // Ignore stored "[object Object]" platform — re-derive from live account data
      const storedPlatform = ch.platform && !ch.platform.includes('[object') ? ch.platform : null
      const livePlatform = acc ? acc.platform : 'Unknown'

      return {
        id: ch.id,
        metacopier_account_id: ch.metacopier_account_id,
        alias: ch.alias || acc?.name || ch.login_number,
        owner: ch.owner,
        prop_firm: ch.prop_firm,
        phase: ch.phase,
        platform: storedPlatform || livePlatform,
        balance,
        equity,
        starting_balance: starting,
        target_pct: ch.target_pct,
        progress: Math.round(progress * 10) / 10,
        pnl: Math.round(pnl * 100) / 100,
        daily_dd_pct: rules.daily_dd_pct,
        max_dd_pct: rules.max_dd_pct,
        current_dd: Math.round(currentDd * 100) / 100,
        state: acc?.connected ? 'Connected' : 'Disconnected',
        challenge_status: challengeStatus,
        is_master: isMaster,
        cost: Number((ch as any).cost ?? 0),
        trades_count: acc?.trades_count ?? 0,
        last_trade: null,
        login_number: ch.login_number,
        login_server: ch.login_server,
      }
    })
  })

  // Accounts not yet linked to a challenge
  const unlinkedAccounts = computed(() => {
    const linkedIds = new Set(challenges.value.map(c => c.metacopier_account_id))
    return accounts.value.filter(a => !linkedIds.has(a.id))
  })

  async function addChallenge(challenge: Omit<Challenge, 'id' | 'created_at'>) {
    const { data, error: err } = await supabase
      .from('challenges')
      .insert(challenge)
      .select()
      .single()

    if (err) throw err
    challenges.value.unshift(data)
    return data
  }

  async function deleteChallenge(id: string) {
    const { error: err } = await supabase
      .from('challenges')
      .delete()
      .eq('id', id)

    if (err) throw err
    challenges.value = challenges.value.filter(c => c.id !== id)
  }

  async function saveSnapshot(challengeId: string, balance: number, equity: number) {
    const drawdown = balance > 0 ? ((balance - equity) / balance) * 100 : 0
    await supabase.from('snapshots').insert({
      challenge_id: challengeId,
      balance,
      equity,
      drawdown: Math.round(drawdown * 100) / 100,
      unrealized_pnl: equity - balance,
    })
  }

  // Store snapshots for all active challenges
  async function captureSnapshots() {
    for (const row of challengeRows.value) {
      if (row.state === 'Connected' && row.balance > 0) {
        await saveSnapshot(row.id, row.balance, row.equity)
      }
    }
  }

  return {
    challenges,
    challengeRows,
    unlinkedAccounts,
    loading,
    error,
    fetchChallenges,
    addChallenge,
    deleteChallenge,
    captureSnapshots,
    guessProFirm,
    guessPlatform,
  }
}
