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
    if ((t.profit ?? 0) > 0) { curWin++; curLoss = 0; if (curWin > maxWin) maxWin = curWin }
    else if ((t.profit ?? 0) < 0) { curLoss++; curWin = 0; if (curLoss > maxLoss) maxLoss = curLoss }
  }
  return { maxWin, maxLoss }
}

const nonMasterStats = computed(() =>
  accountStats.value.filter(s => {
    const row = challengeRows.value.find(r => r.id === s.id)
    return !row?.is_master
  })
)

const overallStats = computed(() => {
  const stats = nonMasterStats.value
  const trades = stats.reduce((s, a) => s + a.trades, 0)
  const wins   = stats.reduce((s, a) => s + a.wins,   0)
  const losses = stats.reduce((s, a) => s + a.losses, 0)
  const netPnl = stats.reduce((s, a) => s + a.netPnl, 0)
  const grossProfit = stats.reduce((s, a) => s + a.grossProfit, 0)
  const grossLoss   = stats.reduce((s, a) => s + a.grossLoss,   0)

  const nonMasterTrades = allClosedTrades.value.filter(t => {
    const row = challengeRows.value.find(r => r.metacopier_account_id === t.accountId)
    return !row?.is_master
  })
  const best  = nonMasterTrades.reduce((max, t) => Math.max(max, t.profit ?? 0), 0)
  const worst = nonMasterTrades.reduce((min, t) => Math.min(min, t.profit ?? 0), 0)
  const bestDay  = dailyPnl.value.reduce((max, d) => Math.max(max, d.pnl), 0)
  const worstDay = dailyPnl.value.reduce((min, d) => Math.min(min, d.pnl), 0)

  return {
    trades,
    wins,
    losses,
    winRate: trades > 0 ? Math.round((wins / trades) * 1000) / 10 : 0,
    netPnl: Math.round(netPnl * 100) / 100,
    profitFactor: grossLoss !== 0
      ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100
      : grossProfit > 0 ? Infinity : 0,
    avgWin:  wins   > 0 ? Math.round((grossProfit / wins)   * 100) / 100 : 0,
    avgLoss: losses > 0 ? Math.round((grossLoss   / losses) * 100) / 100 : 0,
    bestTrade:  Math.round(best  * 100) / 100,
    worstTrade: Math.round(worst * 100) / 100,
    bestDay:    Math.round(bestDay  * 100) / 100,
    worstDay:   Math.round(worstDay * 100) / 100,
    expectancy: trades > 0 ? Math.round(netPnl / trades * 100) / 100 : 0,
  }
})

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

function buildDayLabels(): DayPnl[] {
  const days: DayPnl[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: 0,
    })
  }
  return days
}

async function loadAnalytics() {
  loading.value = true
  try {
    const rows = challengeRows.value
    const days = buildDayLabels()
    const dayMap: Record<string, number> = {}
    for (const d of days) dayMap[d.date] = 0

    const allClosed: ClosedTrade[] = []
    const results: AccountStats[] = []

    await Promise.all(rows.map(async (row) => {
      const trades = await fetchTrades(row.metacopier_account_id)
      const closed = trades.filter(t => t.close_time !== null)
      const sorted = [...closed].sort((a, b) => (a.close_time ?? '').localeCompare(b.close_time ?? ''))

      let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, netPnl = 0
      let bestTrade = 0, worstTrade = 0

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
        id: row.id, alias: row.alias, phase: row.phase,
        trades: total, wins, losses,
        winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
        netPnl: Math.round(netPnl * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossLoss: Math.round(grossLoss * 100) / 100,
        profitFactor: grossLoss !== 0 ? Math.round((grossProfit / Math.abs(grossLoss)) * 100) / 100 : grossProfit > 0 ? 999 : 0,
        avgWin: wins > 0 ? Math.round((grossProfit / wins) * 100) / 100 : 0,
        avgLoss: losses > 0 ? Math.round((grossLoss / losses) * 100) / 100 : 0,
        bestTrade: Math.round(bestTrade * 100) / 100,
        worstTrade: Math.round(worstTrade * 100) / 100,
        maxWinStreak: maxWin, maxLossStreak: maxLoss,
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

// ── Chart ───────────────────────────────────────────────────
const CH = 160
const CP = { l: 56, r: 14, t: 12, b: 30 }
const SVG_W = 700

const barChartData = computed(() => {
  const vals = dailyPnl.value.map(d => d.pnl)
  const maxAbs = Math.max(...vals.map(Math.abs), 1)
  const count = vals.length
  const innerW = SVG_W - CP.l - CP.r
  const barW = Math.floor(innerW / count) - 2
  return dailyPnl.value.map((d, i) => {
    const x = CP.l + i * (innerW / count) + 1
    const midY = CP.t + CH / 2
    const barH = Math.abs(d.pnl) / maxAbs * (CH / 2 - 8)
    return { ...d, x, barW, barH, y: d.pnl >= 0 ? midY - barH : midY, isPos: d.pnl >= 0, midY }
  })
})

const yLabels = computed(() => {
  const maxAbs = Math.max(...dailyPnl.value.map(d => Math.abs(d.pnl)), 1)
  const rounded = Math.ceil(maxAbs / 100) * 100
  const midY = CP.t + CH / 2
  return [-rounded, -rounded / 2, 0, rounded / 2, rounded].map(v => ({
    value: v,
    y: midY - (v / rounded) * (CH / 2 - 8),
  }))
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
function fmtAbs(v: number): string {
  return `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtY(v: number): string {
  if (v === 0) return '0'
  const sign = v > 0 ? '+' : '-'
  const abs = Math.abs(v)
  return sign + (abs >= 1000 ? `$${(abs / 1000).toFixed(0)}k` : `$${abs}`)
}
function pfColor(pf: number): string {
  if (pf >= 1.5) return 'var(--green)'
  if (pf >= 1)   return 'var(--accent)'
  return 'var(--red)'
}
function pnlColor(v: number): string { return v >= 0 ? 'var(--green)' : 'var(--red)' }
function wrColor(wr: number, hasTrades: boolean): string {
  if (!hasTrades) return 'var(--text-tertiary)'
  return wr >= 50 ? 'var(--green)' : 'var(--red)'
}
</script>

<template>
  <div class="analytics-view">

    <!-- ── Header ─────────────────────────────── -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-eyebrow">// PERFORMANCE REPORT</div>
        <h1>Analytics</h1>
      </div>
      <div class="header-right">
        <span class="period-badge">30D</span>
        <div v-if="loading" class="loading-badge">
          <div class="spinner" />
          <span>Loading</span>
        </div>
      </div>
    </div>

    <!-- ── Core metrics strip ─────────────────── -->
    <div class="metric-strip">
      <div class="scan-line" />

      <div class="ms-cell">
        <div class="ms-label">TOTAL TRADES</div>
        <div class="ms-value accent">{{ overallStats.trades > 0 ? overallStats.trades : '—' }}</div>
        <div class="ms-sub">{{ overallStats.wins }}W · {{ overallStats.losses }}L</div>
      </div>
      <div class="ms-div" />

      <div class="ms-cell">
        <div class="ms-label">WIN RATE</div>
        <div class="ms-value" :style="{ color: wrColor(overallStats.winRate, overallStats.trades > 0) }">
          {{ overallStats.trades > 0 ? overallStats.winRate + '%' : '—' }}
        </div>
        <div class="ms-sub ms-bar-wrap" v-if="overallStats.trades > 0">
          <div class="ms-bar-track">
            <div class="ms-bar-fill" :style="{ width: overallStats.winRate + '%', background: overallStats.winRate >= 50 ? 'var(--green)' : 'var(--red)' }" />
          </div>
        </div>
        <div class="ms-sub" v-else>closed trades</div>
      </div>
      <div class="ms-div" />

      <div class="ms-cell ms-wide">
        <div class="ms-label">NET P&amp;L</div>
        <div class="ms-value" :style="{ color: pnlColor(overallStats.netPnl) }">
          {{ overallStats.trades > 0 ? fmtPnl(overallStats.netPnl) : '—' }}
        </div>
        <div class="ms-sub">realized · last 30d</div>
      </div>
      <div class="ms-div" />

      <div class="ms-cell">
        <div class="ms-label">PROFIT FACTOR</div>
        <div class="ms-value" :style="{ color: pfColor(overallStats.profitFactor) }">
          {{ overallStats.trades > 0 ? (overallStats.profitFactor === Infinity ? '∞' : overallStats.profitFactor.toFixed(2)) : '—' }}
        </div>
        <div class="ms-sub">gross P / gross L</div>
      </div>
      <div class="ms-div" />

      <div class="ms-cell">
        <div class="ms-label">AVG WIN</div>
        <div class="ms-value green">{{ overallStats.avgWin > 0 ? fmtAbs(overallStats.avgWin) : '—' }}</div>
        <div class="ms-sub">per winner</div>
      </div>
      <div class="ms-div" />

      <div class="ms-cell">
        <div class="ms-label">AVG LOSS</div>
        <div class="ms-value red">{{ overallStats.avgLoss < 0 ? fmtAbs(overallStats.avgLoss) : '—' }}</div>
        <div class="ms-sub">per loser</div>
      </div>
      <div class="ms-div" />

      <div class="ms-cell">
        <div class="ms-label">EXPECTANCY</div>
        <div class="ms-value" :style="{ color: pnlColor(overallStats.expectancy) }">
          {{ overallStats.trades > 0 ? fmtPnl(overallStats.expectancy) : '—' }}
        </div>
        <div class="ms-sub">avg $ / trade</div>
      </div>
      <div class="ms-div" />

      <div class="ms-cell">
        <div class="ms-label">R:R RATIO</div>
        <div class="ms-value accent">
          {{ overallStats.avgWin > 0 && overallStats.avgLoss < 0
            ? (overallStats.avgWin / Math.abs(overallStats.avgLoss)).toFixed(2) : '—' }}
        </div>
        <div class="ms-sub">win / loss size</div>
      </div>
    </div>

    <!-- ── Extremes row ───────────────────────── -->
    <div class="extremes-row">
      <div class="extreme-card green-card">
        <div class="ec-label">BEST TRADE</div>
        <div class="ec-value green">{{ overallStats.bestTrade > 0 ? fmtPnl(overallStats.bestTrade) : '—' }}</div>
        <div class="ec-sub">single position</div>
      </div>
      <div class="extreme-card red-card">
        <div class="ec-label">WORST TRADE</div>
        <div class="ec-value red">{{ overallStats.worstTrade < 0 ? fmtPnl(overallStats.worstTrade) : '—' }}</div>
        <div class="ec-sub">single position</div>
      </div>
      <div class="extreme-card green-card">
        <div class="ec-label">BEST DAY</div>
        <div class="ec-value green">{{ overallStats.bestDay > 0 ? fmtPnl(overallStats.bestDay) : '—' }}</div>
        <div class="ec-sub">all accounts combined</div>
      </div>
      <div class="extreme-card red-card">
        <div class="ec-label">WORST DAY</div>
        <div class="ec-value red">{{ overallStats.worstDay < 0 ? fmtPnl(overallStats.worstDay) : '—' }}</div>
        <div class="ec-sub">all accounts combined</div>
      </div>
    </div>

    <!-- ── Daily P&L chart ────────────────────── -->
    <div class="chart-panel">
      <div class="panel-header">
        <span class="panel-eyebrow">// DAILY P&amp;L</span>
        <span class="panel-sub">Last 30 days · all accounts</span>
      </div>
      <div v-if="loading" class="chart-loading">
        <div class="spinner large" />
      </div>
      <svg v-else class="bar-chart" :viewBox="`0 0 ${SVG_W} ${CP.t + CH + CP.b}`" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="bar-pos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--green)" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="var(--green)" stop-opacity="0.4"/>
          </linearGradient>
          <linearGradient id="bar-neg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--red)" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="var(--red)" stop-opacity="0.9"/>
          </linearGradient>
        </defs>

        <!-- Grid -->
        <g v-for="lbl in yLabels" :key="lbl.value">
          <line :x1="CP.l" :y1="lbl.y" :x2="SVG_W - CP.r" :y2="lbl.y"
            :stroke="lbl.value === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'"
            :stroke-width="lbl.value === 0 ? 1.5 : 1" />
          <text :x="CP.l - 8" :y="lbl.y + 4" text-anchor="end" class="axis-label">
            {{ fmtY(lbl.value) }}
          </text>
        </g>

        <!-- Bars -->
        <g v-for="bar in barChartData" :key="bar.date">
          <rect
            :x="bar.x" :y="bar.y"
            :width="bar.barW" :height="Math.max(bar.barH, 1.5)"
            :fill="bar.isPos ? 'url(#bar-pos)' : 'url(#bar-neg)'"
            rx="2"
          />
        </g>

        <!-- X labels -->
        <g v-for="xl in xLabels" :key="xl.label">
          <text :x="xl.x" :y="CP.t + CH + 20" text-anchor="middle" class="axis-label">
            {{ xl.label }}
          </text>
        </g>
      </svg>
    </div>

    <!-- ── Bottom two columns ─────────────────── -->
    <div class="two-col">

      <!-- Top Symbols -->
      <div class="data-panel">
        <div class="panel-header">
          <span class="panel-eyebrow">// TOP SYMBOLS</span>
          <span class="panel-sub">by trade count</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th class="tr">Trades</th>
              <th class="tr">Win %</th>
              <th class="tr">Net P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="symbolStats.length === 0 && !loading">
              <td colspan="4" class="empty-cell">No data</td>
            </tr>
            <tr v-for="s in symbolStats" :key="s.symbol">
              <td class="td-symbol">{{ s.symbol }}</td>
              <td class="tr mono">{{ s.trades }}</td>
              <td class="tr">
                <div class="wr-cell">
                  <span class="mono" :style="{ color: s.winRate >= 50 ? 'var(--green)' : 'var(--red)' }">{{ s.winRate }}%</span>
                  <div class="mini-bar-track">
                    <div class="mini-bar-fill" :style="{ width: s.winRate + '%', background: s.winRate >= 50 ? 'var(--green)' : 'var(--red)' }" />
                  </div>
                </div>
              </td>
              <td class="tr mono fw" :style="{ color: pnlColor(s.netPnl) }">{{ fmtPnl(s.netPnl) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Streaks -->
      <div class="data-panel">
        <div class="panel-header">
          <span class="panel-eyebrow">// STREAKS &amp; EXTREMES</span>
          <span class="panel-sub">per account</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th class="tr">Win</th>
              <th class="tr">Loss</th>
              <th class="tr">Best</th>
              <th class="tr">Worst</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="accountStats.length === 0 && !loading">
              <td colspan="5" class="empty-cell">No data</td>
            </tr>
            <tr v-for="s in accountStats" :key="s.id">
              <td class="td-account">{{ s.alias }}</td>
              <td class="tr">
                <span class="streak-badge sw" v-if="s.maxWinStreak > 0">W{{ s.maxWinStreak }}</span>
                <span class="dim" v-else>—</span>
              </td>
              <td class="tr">
                <span class="streak-badge sl" v-if="s.maxLossStreak > 0">L{{ s.maxLossStreak }}</span>
                <span class="dim" v-else>—</span>
              </td>
              <td class="tr mono green-t">{{ s.bestTrade > 0 ? fmtPnl(s.bestTrade) : '—' }}</td>
              <td class="tr mono red-t">{{ s.worstTrade < 0 ? fmtPnl(s.worstTrade) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- ── Per account breakdown ──────────────── -->
    <div class="data-panel">
      <div class="panel-header">
        <span class="panel-eyebrow">// PER ACCOUNT</span>
        <span class="panel-sub">30-day closed trades</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Phase</th>
            <th class="tr">Trades</th>
            <th class="tr">Win %</th>
            <th class="tr">Avg Win</th>
            <th class="tr">Avg Loss</th>
            <th class="tr">P. Factor</th>
            <th class="tr">Net P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="accountStats.length === 0 && !loading">
            <td colspan="8" class="empty-cell">No data yet — trades appear after the first load.</td>
          </tr>
          <tr v-for="s in accountStats" :key="s.id">
            <td class="td-account">{{ s.alias }}</td>
            <td>
              <span class="chip" :class="s.phase === 'Master' ? 'chip-master' : 'chip-phase'">{{ s.phase }}</span>
            </td>
            <td class="tr mono">{{ s.trades > 0 ? s.trades : '—' }}</td>
            <td class="tr">
              <div class="wr-cell" v-if="s.trades > 0">
                <span class="mono" :style="{ color: wrColor(s.winRate, s.trades > 0) }">{{ s.winRate }}%</span>
                <div class="mini-bar-track">
                  <div class="mini-bar-fill" :style="{ width: s.winRate + '%', background: s.winRate >= 50 ? 'var(--green)' : 'var(--red)' }" />
                </div>
              </div>
              <span class="dim" v-else>—</span>
            </td>
            <td class="tr mono green-t">{{ s.avgWin > 0 ? fmtAbs(s.avgWin) : '—' }}</td>
            <td class="tr mono red-t">{{ s.avgLoss < 0 ? fmtAbs(s.avgLoss) : '—' }}</td>
            <td class="tr mono fw" :style="{ color: pfColor(s.profitFactor) }">
              {{ s.trades > 0 ? (s.profitFactor === 999 ? '∞' : s.profitFactor.toFixed(2)) : '—' }}
            </td>
            <td class="tr mono fw" :style="{ color: pnlColor(s.netPnl) }">
              {{ s.trades > 0 ? fmtPnl(s.netPnl) : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.analytics-view {
  padding: 24px 28px;
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: fadeInUp 0.35s var(--ease-out);
}

/* ── Header ─────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.header-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--accent);
  margin-bottom: 4px;
}

h1 {
  font-family: var(--font-ui);
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 2px;
}

.period-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 3px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
}

.loading-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

/* ── Spinner ─────────────────────────────────────────────── */
.spinner {
  width: 12px; height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.spinner.large { width: 22px; height: 22px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Metric strip ────────────────────────────────────────── */
.metric-strip {
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.scan-line {
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent) 40%, var(--purple) 70%, transparent);
  opacity: 0.45;
  animation: scan 5s ease-in-out infinite;
  background-size: 200% 100%;
}
@keyframes scan {
  0%   { background-position: -100% 0; }
  50%  { background-position: 100%  0; }
  100% { background-position: -100% 0; }
}

.ms-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 14px 16px;
  min-width: 0;
}

.ms-wide { flex: 1.5; }

.ms-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.ms-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.025em;
  color: var(--text-primary);
  white-space: nowrap;
}

.ms-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.ms-bar-wrap {
  display: flex;
  align-items: center;
  gap: 0;
}

.ms-bar-track {
  width: 100%;
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 2px;
}

.ms-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s var(--ease-out);
}

.ms-div {
  width: 1px;
  background: var(--border-subtle);
  flex-shrink: 0;
  margin: 10px 0;
}

/* ── Extremes row ────────────────────────────────────────── */
.extremes-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.extreme-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px 16px 14px 20px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.green-card { border-left: 3px solid rgba(0, 230, 118, 0.35); }
.red-card   { border-left: 3px solid rgba(255, 71, 87, 0.35); }

.ec-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
}

.ec-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.025em;
}

.ec-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

/* ── Chart panel ─────────────────────────────────────────── */
.chart-panel {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 13px 18px 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.panel-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.panel-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

.bar-chart {
  display: block;
  width: 100%;
  height: 210px;
  padding: 0 4px;
}

.axis-label {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: rgba(255,255,255,0.3);
}

.chart-loading {
  height: 210px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Two-column ──────────────────────────────────────────── */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

/* ── Data panels (tables) ────────────────────────────────── */
.data-panel {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  padding: 9px 14px;
  text-align: left;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  background: rgba(255,255,255,0.01);
}

.data-table td {
  padding: 9px 14px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  white-space: nowrap;
}

.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr:nth-child(even) td { background: rgba(255,255,255,0.012); }
.data-table tbody tr:hover td { background: var(--surface-hover); }

.tr { text-align: right; }
.mono { font-family: var(--font-mono); }
.fw { font-weight: 700; }
.dim { color: var(--text-tertiary); font-family: var(--font-mono); }
.green { color: var(--green); }
.red   { color: var(--red);   }
.accent { color: var(--accent); }
.green-t { color: var(--green); font-family: var(--font-mono); }
.red-t   { color: var(--red);   font-family: var(--font-mono); }

.td-symbol  { font-family: var(--font-mono); font-weight: 700; letter-spacing: 0.04em; }
.td-account { font-weight: 600; }

/* ── Win rate mini bar ───────────────────────────────────── */
.wr-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.mini-bar-track {
  width: 48px;
  height: 2px;
  background: var(--border);
  border-radius: 1px;
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.5s var(--ease-out);
}

/* ── Streak badges ───────────────────────────────────────── */
.streak-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.sw { background: rgba(0,230,118,0.1); color: var(--green); border: 1px solid rgba(0,230,118,0.2); }
.sl { background: rgba(255,71,87,0.1); color: var(--red);   border: 1px solid rgba(255,71,87,0.2); }

/* ── Chips ───────────────────────────────────────────────── */
.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
}
.chip-phase  { background: var(--purple-muted); color: var(--purple); border: 1px solid rgba(165,94,234,0.12); }
.chip-master { background: rgba(24,220,255,0.08); color: var(--cyan); border: 1px solid rgba(24,220,255,0.14); }

/* ── Empty ───────────────────────────────────────────────── */
.empty-cell {
  text-align: center !important;
  padding: 30px 20px !important;
  color: var(--text-tertiary);
  font-size: 12px;
  font-family: var(--font-mono);
}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 1200px) {
  .metric-strip {
    flex-wrap: wrap;
    border-radius: var(--radius-md);
  }
  .ms-cell { flex: 1 1 22%; border-bottom: 1px solid var(--border-subtle); }
  .ms-cell:nth-last-child(-n+4) { border-bottom: none; }
  .ms-div { display: none; }
}

@media (max-width: 900px) {
  .extremes-row { grid-template-columns: repeat(2, 1fr); }
  .two-col { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .analytics-view { padding: 16px 12px; gap: 14px; }
  .ms-cell { flex: 1 1 45%; }
  .ms-value { font-size: 17px; }
  .extremes-row { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .ec-value { font-size: 17px; }
  h1 { font-size: 18px; }
}
</style>
