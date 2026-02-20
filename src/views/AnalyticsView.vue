<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChallenges } from '@/composables/useChallenges'
import { useMetaCopier } from '@/composables/useMetaCopier'
import type { MetaCopierTrade } from '@/types'

const { challengeRows } = useChallenges()
const { fetchTrades } = useMetaCopier()

interface ClosedTrade extends MetaCopierTrade {
  accountId: string
  alias: string
}

interface AccountStats {
  id: string
  alias: string
  phase: string
  trades: number
  wins: number
  losses: number
  winRate: number
  netPnl: number
  grossProfit: number
  grossLoss: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  bestTrade: number
  worstTrade: number
  maxWinStreak: number
  maxLossStreak: number
}

interface SymbolStats {
  symbol: string
  trades: number
  wins: number
  winRate: number
  netPnl: number
}

interface DayPnl {
  date: string
  label: string
  pnl: number
}

const loading = ref(false)
const accountStats = ref<AccountStats[]>([])
const dailyPnl = ref<DayPnl[]>([])
const allClosedTrades = ref<ClosedTrade[]>([])

function calcStreaks(trades: ClosedTrade[]): { maxWin: number; maxLoss: number } {
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0
  for (const t of trades) {
    if ((t.profit ?? 0) > 0) {
      curWin++; curLoss = 0
      if (curWin > maxWin) maxWin = curWin
    } else if ((t.profit ?? 0) < 0) {
      curLoss++; curWin = 0
      if (curLoss > maxLoss) maxLoss = curLoss
    }
  }
  return { maxWin, maxLoss }
}

// Aggregate stats across all non-master accounts
const nonMasterStats = computed(() =>
  accountStats.value.filter(s => {
    const row = challengeRows.value.find(r => r.id === s.id)
    return !row?.is_master
  })
)

const overallStats = computed(() => {
  const stats = nonMasterStats.value
  const trades = stats.reduce((s, a) => s + a.trades, 0)
  const wins = stats.reduce((s, a) => s + a.wins, 0)
  const netPnl = stats.reduce((s, a) => s + a.netPnl, 0)
  const grossProfit = stats.reduce((s, a) => s + a.grossProfit, 0)
  const grossLoss = stats.reduce((s, a) => s + a.grossLoss, 0)
  const best = allClosedTrades.value.filter(t => {
    const row = challengeRows.value.find(r => r.metacopier_account_id === t.accountId)
    return !row?.is_master
  }).reduce((max, t) => Math.max(max, t.profit ?? 0), 0)
  const worst = allClosedTrades.value.filter(t => {
    const row = challengeRows.value.find(r => r.metacopier_account_id === t.accountId)
    return !row?.is_master
  }).reduce((min, t) => Math.min(min, t.profit ?? 0), 0)

  const bestDay = dailyPnl.value.reduce((max, d) => Math.max(max, d.pnl), 0)
  const worstDay = dailyPnl.value.reduce((min, d) => Math.min(min, d.pnl), 0)

  return {
    trades,
    winRate: trades > 0 ? Math.round((wins / trades) * 1000) / 10 : 0,
    netPnl: Math.round(netPnl * 100) / 100,
    profitFactor: grossLoss !== 0
      ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100
      : grossProfit > 0 ? Infinity : 0,
    avgWin: wins > 0 ? Math.round((grossProfit / wins) * 100) / 100 : 0,
    avgLoss: stats.reduce((s, a) => s + a.losses, 0) > 0
      ? Math.round((grossLoss / stats.reduce((s, a) => s + a.losses, 0)) * 100) / 100
      : 0,
    bestTrade: Math.round(best * 100) / 100,
    worstTrade: Math.round(worst * 100) / 100,
    bestDay: Math.round(bestDay * 100) / 100,
    worstDay: Math.round(worstDay * 100) / 100,
    expectancy: trades > 0 ? Math.round(netPnl / trades * 100) / 100 : 0,
  }
})

// Symbol breakdown across all non-master accounts
const symbolStats = computed((): SymbolStats[] => {
  const map: Record<string, { trades: number; wins: number; pnl: number }> = {}
  for (const t of allClosedTrades.value) {
    const row = challengeRows.value.find(r => r.metacopier_account_id === t.accountId)
    if (row?.is_master) continue
    const sym = t.symbol.toUpperCase()
    if (!map[sym]) map[sym] = { trades: 0, wins: 0, pnl: 0 }
    map[sym].trades++
    map[sym].pnl += t.profit ?? 0
    if ((t.profit ?? 0) > 0) map[sym].wins++
  }
  return Object.entries(map)
    .map(([symbol, s]) => ({
      symbol,
      trades: s.trades,
      wins: s.wins,
      winRate: Math.round((s.wins / s.trades) * 1000) / 10,
      netPnl: Math.round(s.pnl * 100) / 100,
    }))
    .sort((a, b) => b.trades - a.trades)
    .slice(0, 10)
})

// Build 30-day label array
function buildDayLabels(): DayPnl[] {
  const days: DayPnl[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    days.push({ date, label, pnl: 0 })
  }
  return days
}

async function loadAnalytics() {
  loading.value = true
  try {
    const rows = challengeRows.value
    const dayMap: Record<string, number> = {}
    const days = buildDayLabels()
    for (const d of days) dayMap[d.date] = 0

    const allClosed: ClosedTrade[] = []
    const results: AccountStats[] = []

    await Promise.all(rows.map(async (row) => {
      const trades = await fetchTrades(row.metacopier_account_id)
      const closed = trades.filter(t => t.close_time !== null)

      let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, netPnl = 0
      let bestTrade = 0, worstTrade = 0

      const sorted = [...closed].sort((a, b) =>
        (a.close_time ?? '').localeCompare(b.close_time ?? '')
      )

      for (const t of sorted) {
        const p = t.profit ?? 0
        netPnl += p
        if (p > 0) { wins++; grossProfit += p; if (p > bestTrade) bestTrade = p }
        else if (p < 0) { losses++; grossLoss += p; if (p < worstTrade) worstTrade = p }

        const day = (t.close_time ?? '').slice(0, 10)
        if (dayMap[day] !== undefined) dayMap[day] += p

        allClosed.push({ ...t, accountId: row.metacopier_account_id, alias: row.alias })
      }

      const { maxWin, maxLoss } = calcStreaks(sorted.map(t => ({ ...t, accountId: row.metacopier_account_id, alias: row.alias })))
      const total = wins + losses
      results.push({
        id: row.id,
        alias: row.alias,
        phase: row.phase,
        trades: total,
        wins,
        losses,
        winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
        netPnl: Math.round(netPnl * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossLoss: Math.round(grossLoss * 100) / 100,
        profitFactor: grossLoss !== 0 ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100 : grossProfit > 0 ? 999 : 0,
        avgWin: wins > 0 ? Math.round((grossProfit / wins) * 100) / 100 : 0,
        avgLoss: losses > 0 ? Math.round((grossLoss / losses) * 100) / 100 : 0,
        bestTrade: Math.round(bestTrade * 100) / 100,
        worstTrade: Math.round(worstTrade * 100) / 100,
        maxWinStreak: maxWin,
        maxLossStreak: maxLoss,
      })
    }))

    accountStats.value = results
    allClosedTrades.value = allClosed
    dailyPnl.value = days.map(d => ({ ...d, pnl: Math.round((dayMap[d.date] ?? 0) * 100) / 100 }))
  } finally {
    loading.value = false
  }
}

onMounted(loadAnalytics)

// ── Chart helpers ──────────────────────────────────────────
const chartHeight = 140
const chartPad = { l: 54, r: 12, t: 10, b: 28 }

const barChartData = computed(() => {
  const vals = dailyPnl.value.map(d => d.pnl)
  const maxAbs = Math.max(...vals.map(Math.abs), 1)
  const count = vals.length
  const innerW = 680 - chartPad.l - chartPad.r
  const barW = Math.floor(innerW / count) - 2
  return dailyPnl.value.map((d, i) => {
    const x = chartPad.l + i * (innerW / count) + 1
    const midY = chartPad.t + chartHeight / 2
    const barH = Math.abs(d.pnl) / maxAbs * (chartHeight / 2 - 6)
    return {
      ...d,
      x,
      barW,
      barH,
      y: d.pnl >= 0 ? midY - barH : midY,
      color: d.pnl >= 0 ? 'var(--green)' : 'var(--red)',
      midY,
    }
  })
})

const yLabels = computed(() => {
  const vals = dailyPnl.value.map(d => d.pnl)
  const maxAbs = Math.max(...vals.map(Math.abs), 1)
  const rounded = Math.ceil(maxAbs / 100) * 100
  return [-rounded, -rounded / 2, 0, rounded / 2, rounded].map(v => {
    const midY = chartPad.t + chartHeight / 2
    const y = midY - (v / rounded) * (chartHeight / 2 - 6)
    return { value: v, y }
  })
})

const xLabels = computed(() =>
  barChartData.value
    .filter((_, i) => i % 5 === 0 || i === barChartData.value.length - 1)
    .map(d => ({ label: d.label, x: d.x + d.barW / 2 }))
)

// ── Formatting ──────────────────────────────────────────────
function fmtPnl(v: number): string {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}

function fmtCurrency(v: number): string {
  return `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pfColor(pf: number): string {
  if (pf >= 1.5) return 'var(--green)'
  if (pf >= 1) return 'var(--accent)'
  return 'var(--red)'
}

function pnlColor(v: number): string {
  return v >= 0 ? 'var(--green)' : 'var(--red)'
}
</script>

<template>
  <div class="analytics-view">
    <div class="page-header">
      <h1>Analytics</h1>
      <div v-if="loading" class="loading-badge">
        <div class="spinner" />
        <span>Loading</span>
      </div>
    </div>

    <!-- Row 1: Core stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Trades</div>
        <div class="stat-value">{{ overallStats.trades }}</div>
        <div class="stat-sub">last 30 days</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Win Rate</div>
        <div class="stat-value" :style="{ color: overallStats.winRate >= 50 ? 'var(--green)' : overallStats.trades > 0 ? 'var(--red)' : '' }">
          {{ overallStats.trades > 0 ? overallStats.winRate + '%' : '—' }}
        </div>
        <div class="stat-sub">closed trades</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net P&amp;L</div>
        <div class="stat-value" :style="{ color: pnlColor(overallStats.netPnl) }">
          {{ overallStats.trades > 0 ? fmtPnl(overallStats.netPnl) : '—' }}
        </div>
        <div class="stat-sub">realized</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Profit Factor</div>
        <div class="stat-value" :style="{ color: pfColor(overallStats.profitFactor) }">
          {{ overallStats.trades > 0 ? (overallStats.profitFactor === Infinity ? '∞' : overallStats.profitFactor.toFixed(2)) : '—' }}
        </div>
        <div class="stat-sub">gross profit / loss</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Win</div>
        <div class="stat-value green">{{ overallStats.avgWin > 0 ? fmtCurrency(overallStats.avgWin) : '—' }}</div>
        <div class="stat-sub">per winning trade</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Loss</div>
        <div class="stat-value red">{{ overallStats.avgLoss < 0 ? fmtCurrency(overallStats.avgLoss) : '—' }}</div>
        <div class="stat-sub">per losing trade</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expectancy</div>
        <div class="stat-value" :style="{ color: pnlColor(overallStats.expectancy) }">
          {{ overallStats.trades > 0 ? fmtPnl(overallStats.expectancy) : '—' }}
        </div>
        <div class="stat-sub">avg $ per trade</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">R:R Ratio</div>
        <div class="stat-value accent">
          {{ overallStats.avgWin > 0 && overallStats.avgLoss < 0
            ? (overallStats.avgWin / Math.abs(overallStats.avgLoss)).toFixed(2)
            : '—' }}
        </div>
        <div class="stat-sub">avg win / avg loss</div>
      </div>
    </div>

    <!-- Row 2: Extremes -->
    <div class="stats-grid grid-4">
      <div class="stat-card highlight-green">
        <div class="stat-label">Best Trade</div>
        <div class="stat-value green">{{ overallStats.bestTrade > 0 ? fmtPnl(overallStats.bestTrade) : '—' }}</div>
        <div class="stat-sub">single closed trade</div>
      </div>
      <div class="stat-card highlight-red">
        <div class="stat-label">Worst Trade</div>
        <div class="stat-value red">{{ overallStats.worstTrade < 0 ? fmtPnl(overallStats.worstTrade) : '—' }}</div>
        <div class="stat-sub">single closed trade</div>
      </div>
      <div class="stat-card highlight-green">
        <div class="stat-label">Best Day</div>
        <div class="stat-value green">{{ overallStats.bestDay > 0 ? fmtPnl(overallStats.bestDay) : '—' }}</div>
        <div class="stat-sub">combined all accounts</div>
      </div>
      <div class="stat-card highlight-red">
        <div class="stat-label">Worst Day</div>
        <div class="stat-value red">{{ overallStats.worstDay < 0 ? fmtPnl(overallStats.worstDay) : '—' }}</div>
        <div class="stat-sub">combined all accounts</div>
      </div>
    </div>

    <!-- Daily P&L chart -->
    <div class="chart-card">
      <div class="chart-header">
        <span class="chart-title">Daily P&amp;L</span>
        <span class="chart-sub">Last 30 days · all accounts</span>
      </div>
      <div v-if="loading" class="chart-loading">
        <div class="spinner large" />
      </div>
      <svg v-else class="bar-chart" viewBox="0 0 680 190" preserveAspectRatio="xMidYMid meet">
        <g v-for="label in yLabels" :key="label.value">
          <line
            :x1="chartPad.l" :y1="label.y"
            :x2="680 - chartPad.r" :y2="label.y"
            stroke="var(--border-subtle)" stroke-width="1"
          />
          <text :x="chartPad.l - 6" :y="label.y + 4" text-anchor="end" class="chart-label">
            {{ label.value === 0 ? '0' : (label.value > 0 ? '+' : '') + (Math.abs(label.value) >= 1000 ? (label.value / 1000).toFixed(0) + 'k' : label.value) }}
          </text>
        </g>
        <line
          :x1="chartPad.l" :y1="chartPad.t + chartHeight / 2"
          :x2="680 - chartPad.r" :y2="chartPad.t + chartHeight / 2"
          stroke="var(--border)" stroke-width="1.5"
        />
        <g v-for="bar in barChartData" :key="bar.date">
          <rect
            :x="bar.x" :y="bar.y"
            :width="bar.barW" :height="Math.max(bar.barH, 1)"
            :fill="bar.color" opacity="0.75" rx="1"
          />
        </g>
        <g v-for="xl in xLabels" :key="xl.label">
          <text :x="xl.x" :y="chartPad.t + chartHeight + 18" text-anchor="middle" class="chart-label">
            {{ xl.label }}
          </text>
        </g>
      </svg>
    </div>

    <!-- Two columns: symbol breakdown + per-account -->
    <div class="two-col">
      <!-- Symbol breakdown -->
      <div>
        <div class="section-title">Top Symbols</div>
        <div class="table-wrapper">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th class="text-right">Trades</th>
                <th class="text-right">Win %</th>
                <th class="text-right">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="symbolStats.length === 0 && !loading">
                <td colspan="4" class="empty-cell">No data</td>
              </tr>
              <tr v-for="s in symbolStats" :key="s.symbol">
                <td class="account-name mono">{{ s.symbol }}</td>
                <td class="text-right mono">{{ s.trades }}</td>
                <td class="text-right mono" :style="{ color: s.winRate >= 50 ? 'var(--green)' : 'var(--red)' }">
                  {{ s.winRate }}%
                </td>
                <td class="text-right mono" :style="{ color: pnlColor(s.netPnl), fontWeight: 600 }">
                  {{ fmtPnl(s.netPnl) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Per-account streaks -->
      <div>
        <div class="section-title">Streaks</div>
        <div class="table-wrapper">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Account</th>
                <th class="text-right">Max Win</th>
                <th class="text-right">Max Loss</th>
                <th class="text-right">Best Trade</th>
                <th class="text-right">Worst Trade</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="accountStats.length === 0 && !loading">
                <td colspan="5" class="empty-cell">No data</td>
              </tr>
              <tr v-for="s in accountStats" :key="s.id">
                <td class="account-name">{{ s.alias }}</td>
                <td class="text-right mono green">{{ s.maxWinStreak > 0 ? s.maxWinStreak : '—' }}</td>
                <td class="text-right mono red">{{ s.maxLossStreak > 0 ? s.maxLossStreak : '—' }}</td>
                <td class="text-right mono green">{{ s.bestTrade > 0 ? fmtPnl(s.bestTrade) : '—' }}</td>
                <td class="text-right mono red">{{ s.worstTrade < 0 ? fmtPnl(s.worstTrade) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Full per-account breakdown -->
    <div class="section-title">Per Account</div>
    <div class="table-wrapper">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Phase</th>
            <th class="text-right">Trades</th>
            <th class="text-right">Win %</th>
            <th class="text-right">Avg Win</th>
            <th class="text-right">Avg Loss</th>
            <th class="text-right">Profit Factor</th>
            <th class="text-right">Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="accountStats.length === 0 && !loading">
            <td colspan="8" class="empty-cell">No data yet — trades appear after the first load.</td>
          </tr>
          <tr v-for="s in accountStats" :key="s.id">
            <td class="account-name">{{ s.alias }}</td>
            <td>
              <span class="chip" :class="s.phase === 'Master' ? 'chip-master' : 'chip-phase'">{{ s.phase }}</span>
            </td>
            <td class="text-right mono">{{ s.trades }}</td>
            <td class="text-right mono" :style="{ color: s.winRate >= 50 ? 'var(--green)' : s.trades > 0 ? 'var(--red)' : 'var(--text-tertiary)' }">
              {{ s.trades > 0 ? s.winRate + '%' : '—' }}
            </td>
            <td class="text-right mono green">{{ s.avgWin > 0 ? fmtCurrency(s.avgWin) : '—' }}</td>
            <td class="text-right mono red">{{ s.avgLoss < 0 ? fmtCurrency(s.avgLoss) : '—' }}</td>
            <td class="text-right mono" :style="{ color: pfColor(s.profitFactor) }">
              {{ s.trades > 0 ? (s.profitFactor === 999 ? '∞' : s.profitFactor.toFixed(2)) : '—' }}
            </td>
            <td class="text-right mono" :style="{ color: pnlColor(s.netPnl), fontWeight: 600 }">
              {{ s.trades > 0 ? fmtPnl(s.netPnl) : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.analytics-view {
  padding: 24px 28px;
  max-width: 1440px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.page-header h1 {
  font-family: var(--font-ui);
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.loading-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

.spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.large {
  width: 24px;
  height: 24px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Stats grids ─── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 10px;
}

.grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-card.highlight-green {
  border-color: rgba(0, 230, 118, 0.15);
}

.stat-card.highlight-red {
  border-color: rgba(255, 71, 87, 0.15);
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.15;
}

.stat-sub {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 1px;
}

.green { color: var(--green) !important; }
.red { color: var(--red) !important; }
.accent { color: var(--accent) !important; }

/* ─── Chart ─── */
.chart-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 16px 20px;
}

.chart-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.chart-title {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

.bar-chart {
  width: 100%;
  height: 190px;
  display: block;
}

.chart-label {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--text-tertiary);
}

.chart-loading {
  height: 190px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── Two column layout ─── */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* ─── Tables ─── */
.section-title {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: -8px;
}

.table-wrapper {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.stats-table th {
  padding: 9px 14px;
  text-align: left;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.stats-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  font-family: var(--font-ui);
  color: var(--text-primary);
  white-space: nowrap;
}

.stats-table tbody tr:last-child td {
  border-bottom: none;
}

.stats-table tbody tr:hover {
  background: var(--surface-hover);
}

.text-right { text-align: right; }
.mono { font-family: var(--font-mono); }
.account-name { font-weight: 600; }

.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
}

.chip-phase {
  background: var(--purple-muted);
  color: var(--purple);
  border: 1px solid rgba(165, 94, 234, 0.12);
}

.chip-master {
  background: rgba(24, 220, 255, 0.08);
  color: var(--cyan);
  border: 1px solid rgba(24, 220, 255, 0.14);
}

.empty-cell {
  text-align: center;
  padding: 32px 20px !important;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* ─── Responsive ─── */
@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .analytics-view {
    padding: 16px 12px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .grid-4 {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-value {
    font-size: 18px;
  }

  .two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    gap: 8px;
  }

  .stat-card {
    padding: 10px 12px;
  }

  .stat-value {
    font-size: 16px;
  }
}
</style>
