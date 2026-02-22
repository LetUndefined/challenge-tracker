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
}

interface DayPnl {
  date: string
  label: string
  pnl: number
}

interface CalendarDay {
  date: string
  dayOfMonth: number
  pnl: number
  isToday: boolean
  isEmpty: boolean
}

interface CalendarMonth {
  label: string
  weeks: CalendarDay[][]
}

const loading = ref(false)
const accountStats = ref<AccountStats[]>([])
const dailyPnl = ref<DayPnl[]>([])
const allClosedTrades = ref<ClosedTrade[]>([])

// ── Calendar navigation ──────────────────────────────────────
const calendarDate = ref(new Date())

function prevMonth() {
  const d = new Date(calendarDate.value)
  d.setMonth(d.getMonth() - 1)
  calendarDate.value = d
}

function nextMonth() {
  const d = new Date(calendarDate.value)
  d.setMonth(d.getMonth() + 1)
  calendarDate.value = d
}

const canGoNext = computed(() => {
  const now = new Date()
  return (
    calendarDate.value.getFullYear() < now.getFullYear() ||
    calendarDate.value.getMonth() < now.getMonth()
  )
})

// ── Non-master filter ────────────────────────────────────────
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
  const recent = dailyPnl.value.slice(-30)
  const bestDay  = recent.reduce((max, d) => Math.max(max, d.pnl), 0)
  const worstDay = recent.reduce((min, d) => Math.min(min, d.pnl), 0)

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

function buildDateRange(daysBack: number): { days: DayPnl[]; dayMap: Record<string, number> } {
  const days: DayPnl[] = []
  const dayMap: Record<string, number> = {}
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    days.push({
      date,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pnl: 0,
    })
    dayMap[date] = 0
  }
  return { days, dayMap }
}

async function loadAnalytics() {
  loading.value = true
  try {
    const rows = challengeRows.value
    const { days, dayMap } = buildDateRange(365) // 1 year of history

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
        if (dayMap[day] !== undefined && !row.is_master) dayMap[day] += p
        allClosed.push({ ...t, accountId: row.metacopier_account_id, alias: row.alias })
      }

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

// ── P&L Calendar heatmap ─────────────────────────────────────
function buildCalendarMonth(year: number, month: number, pnlMap: Record<string, number>): CalendarMonth {
  const today = new Date().toISOString().slice(0, 10)
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (firstDay.getDay() + 6) % 7 // Mon = 0

  const slots: CalendarDay[] = []

  for (let i = 0; i < firstWeekday; i++) {
    slots.push({ date: '', dayOfMonth: 0, pnl: 0, isToday: false, isEmpty: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    slots.push({
      date,
      dayOfMonth: d,
      pnl: Math.round((pnlMap[date] ?? 0) * 100) / 100,
      isToday: date === today,
      isEmpty: false,
    })
  }
  while (slots.length % 7 !== 0) {
    slots.push({ date: '', dayOfMonth: 0, pnl: 0, isToday: false, isEmpty: true })
  }

  const weeks: CalendarDay[][] = []
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7))

  return {
    label: firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    weeks,
  }
}

const pnlMap = computed(() => {
  const map: Record<string, number> = {}
  for (const d of dailyPnl.value) map[d.date] = d.pnl
  return map
})

const calendarMonth = computed(() =>
  buildCalendarMonth(calendarDate.value.getFullYear(), calendarDate.value.getMonth(), pnlMap.value)
)

// Normalize intensity per-month (so the biggest day in the month = full intensity)
const calendarMaxAbs = computed(() => {
  const vals = calendarMonth.value.weeks
    .flat()
    .filter(d => !d.isEmpty && d.pnl !== 0)
    .map(d => Math.abs(d.pnl))
  return vals.length > 0 ? Math.max(...vals) : 1
})

const activeDays  = computed(() => calendarMonth.value.weeks.flat().filter(d => !d.isEmpty && d.pnl !== 0).length)
const profitDays  = computed(() => calendarMonth.value.weeks.flat().filter(d => !d.isEmpty && d.pnl > 0).length)
const lossDays    = computed(() => calendarMonth.value.weeks.flat().filter(d => !d.isEmpty && d.pnl < 0).length)
const monthlyPnl  = computed(() => {
  const total = calendarMonth.value.weeks.flat().reduce((s, d) => s + (d.isEmpty ? 0 : d.pnl), 0)
  return Math.round(total * 100) / 100
})

function getDayStyle(day: CalendarDay): Record<string, string> {
  if (day.isEmpty || day.pnl === 0) return {}
  const intensity = Math.min(Math.abs(day.pnl) / calendarMaxAbs.value, 1)
  const opacity   = 0.12 + intensity * 0.72
  const rgb       = day.pnl > 0 ? '0, 212, 170' : '255, 71, 87'
  return {
    background:  `rgba(${rgb}, ${opacity})`,
    borderColor: `rgba(${rgb}, ${Math.min(opacity + 0.12, 1)})`,
  }
}

// ── Bar chart (last 30 days) ─────────────────────────────────
const last30 = computed(() => dailyPnl.value.slice(-30))

const CH = 160
const CP = { l: 56, r: 14, t: 12, b: 30 }
const SVG_W = 700

const barChartData = computed(() => {
  const vals = last30.value.map(d => d.pnl)
  const maxAbs = Math.max(...vals.map(Math.abs), 1)
  const count = vals.length || 1
  const innerW = SVG_W - CP.l - CP.r
  const barW = Math.floor(innerW / count) - 2
  return last30.value.map((d, i) => {
    const x = CP.l + i * (innerW / count) + 1
    const midY = CP.t + CH / 2
    const barH = Math.abs(d.pnl) / maxAbs * (CH / 2 - 8)
    return { ...d, x, barW, barH, y: d.pnl >= 0 ? midY - barH : midY, isPos: d.pnl >= 0, midY }
  })
})

const yLabels = computed(() => {
  const maxAbs = Math.max(...last30.value.map(d => Math.abs(d.pnl)), 1)
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

// ── Calendar mobile helpers ──────────────────────────────────
const calendarDays = computed(() =>
  calendarMonth.value.weeks.flat().filter(d => !d.isEmpty)
)

function getDowLabel(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

// ── Formatting ───────────────────────────────────────────────
function fmtPnl(v: number): string {
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}
function fmtY(v: number): string {
  if (v === 0) return '0'
  const sign = v > 0 ? '+' : '-'
  const abs = Math.abs(v)
  return sign + (abs >= 1000 ? `$${(abs / 1000).toFixed(0)}k` : `$${abs}`)
}
function fmtPnlShort(v: number): string {
  const abs = Math.abs(v)
  const sign = v >= 0 ? '+' : '−'
  if (abs >= 10000) return `${sign}${Math.round(abs / 1000)}k`
  if (abs >= 1000)  return `${sign}${(abs / 1000).toFixed(1)}k`
  if (abs >= 10)    return `${sign}$${Math.round(abs)}`
  return `${sign}$${abs.toFixed(1)}`
}
function pfColor(pf: number): string {
  if (pf >= 1.5) return 'var(--green)'
  if (pf >= 1)   return 'var(--accent)'
  return 'var(--red)'
}
function pnlColor(v: number): string { return v >= 0 ? 'var(--green)' : 'var(--red)' }
function wrColor(wr: number, has: boolean): string {
  if (!has) return 'var(--text-tertiary)'
  return wr >= 50 ? 'var(--green)' : 'var(--red)'
}
</script>

<template>
  <div class="analytics-view">

    <!-- ── Banner Header ─────────────────────────────────── -->
    <header class="page-header">
      <div class="header-grid" aria-hidden="true" />

      <div class="header-inner">
        <div class="header-left">
          <div class="header-tag">
            <span class="tag-mark">▸</span>
            PERFORMANCE REPORT
          </div>
          <h1 class="page-title">
            Performance<br />
            <span class="title-accent">Analytics</span>
          </h1>
        </div>

        <div class="header-right">
          <div class="hdr-stat-block">
            <div class="hdr-stat-row">
              <div v-if="loading" class="hdr-spinner" />
              <span class="hdr-big-num accent">{{ overallStats.trades > 0 ? overallStats.trades : '—' }}</span>
            </div>
            <div class="hdr-stat-label">TOTAL TRADES</div>
          </div>

          <div class="hdr-divider" />

          <div class="hdr-stat-block">
            <div class="hdr-stat-row">
              <span class="hdr-big-num" :style="{ color: wrColor(overallStats.winRate, overallStats.trades > 0) }">
                {{ overallStats.trades > 0 ? overallStats.winRate + '%' : '—' }}
              </span>
            </div>
            <div class="hdr-stat-label">WIN RATE</div>
          </div>

          <div class="hdr-divider" />

          <div class="hdr-stat-block hdr-accent">
            <div class="hdr-stat-row">
              <span
                class="hdr-big-num"
                :style="{ color: overallStats.trades > 0 ? pnlColor(overallStats.netPnl) : 'var(--text-tertiary)' }"
              >
                {{ overallStats.trades > 0 ? fmtPnl(overallStats.netPnl) : '—' }}
              </span>
            </div>
            <div class="hdr-stat-label">NET P&amp;L</div>
          </div>
        </div>
      </div>

      <div class="header-meta">
        <span class="period-badge">ALL TIME</span>
        <span class="period-sep">·</span>
        <span class="period-sub">closed positions · all challenges</span>
      </div>
    </header>

    <!-- ── Page body ─────────────────────────────────────── -->
    <div class="page-body">

      <!-- ── Core metrics strip ───────────────────────── -->
      <div class="metric-strip">
        <div class="scan-line" />

        <div class="ms-cell">
          <div class="ms-label">TRADES</div>
          <div class="ms-value accent">{{ overallStats.trades > 0 ? overallStats.trades : '—' }}</div>
          <div class="ms-sub">{{ overallStats.wins }}W · {{ overallStats.losses }}L</div>
        </div>
        <div class="ms-div" />

        <div class="ms-cell">
          <div class="ms-label">WIN RATE</div>
          <div class="ms-value" :style="{ color: wrColor(overallStats.winRate, overallStats.trades > 0) }">
            {{ overallStats.trades > 0 ? overallStats.winRate + '%' : '—' }}
          </div>
          <div class="ms-bar-wrap" v-if="overallStats.trades > 0">
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
          <div class="ms-sub">realized</div>
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
          <div class="ms-label">R:R RATIO</div>
          <div class="ms-value accent">
            {{ overallStats.avgWin > 0 && overallStats.avgLoss < 0
              ? (overallStats.avgWin / Math.abs(overallStats.avgLoss)).toFixed(2) : '—' }}
          </div>
          <div class="ms-sub">win / loss size</div>
        </div>
      </div>

      <!-- ── Extremes row ──────────────────────────────── -->
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
          <div class="ec-sub">last 30 days · combined</div>
        </div>
        <div class="extreme-card red-card">
          <div class="ec-label">WORST DAY</div>
          <div class="ec-value red">{{ overallStats.worstDay < 0 ? fmtPnl(overallStats.worstDay) : '—' }}</div>
          <div class="ec-sub">last 30 days · combined</div>
        </div>
      </div>

      <!-- ── Daily P&L bar chart ───────────────────────── -->
      <div class="chart-panel">
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-eyebrow">// DAILY P&amp;L</span>
            <span class="panel-sub">Last 30 days · all challenges combined</span>
          </div>
        </div>
        <div v-if="loading" class="chart-loading">
          <div class="spinner" />
        </div>
        <svg v-else class="bar-chart" :viewBox="`0 0 ${SVG_W} ${CP.t + CH + CP.b}`" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="bar-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--green)" stop-opacity="0.9"/>
              <stop offset="100%" stop-color="var(--green)" stop-opacity="0.35"/>
            </linearGradient>
            <linearGradient id="bar-neg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--red)" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="var(--red)" stop-opacity="0.9"/>
            </linearGradient>
          </defs>
          <g v-for="lbl in yLabels" :key="lbl.value">
            <line
              :x1="CP.l" :y1="lbl.y" :x2="SVG_W - CP.r" :y2="lbl.y"
              :stroke="lbl.value === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'"
              :stroke-width="lbl.value === 0 ? 1.5 : 1"
            />
            <text :x="CP.l - 8" :y="lbl.y + 4" text-anchor="end" class="axis-label">{{ fmtY(lbl.value) }}</text>
          </g>
          <g v-for="bar in barChartData" :key="bar.date">
            <rect
              :x="bar.x" :y="bar.y"
              :width="bar.barW" :height="Math.max(bar.barH, 1.5)"
              :fill="bar.isPos ? 'url(#bar-pos)' : 'url(#bar-neg)'"
              rx="2"
            />
          </g>
          <g v-for="xl in xLabels" :key="xl.label">
            <text :x="xl.x" :y="CP.t + CH + 20" text-anchor="middle" class="axis-label">{{ xl.label }}</text>
          </g>
        </svg>
      </div>

      <!-- ── P&L Calendar ──────────────────────────────── -->
      <div class="calendar-panel">

        <!-- Panel header: eyebrow + stats -->
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-eyebrow">// P&amp;L CALENDAR</span>
            <span class="panel-sub">Daily performance · non-master accounts</span>
          </div>

          <div class="cal-legend">
            <div class="cal-stat">
              <span
                class="cal-stat-num"
                :style="{ color: activeDays > 0 ? pnlColor(monthlyPnl) : 'var(--text-tertiary)' }"
              >
                {{ activeDays > 0 ? fmtPnl(monthlyPnl) : '—' }}
              </span>
              <span class="cal-stat-lbl">month P&amp;L</span>
            </div>
            <div class="cal-stat-sep" />
            <div class="cal-stat">
              <span class="cal-stat-num green">{{ profitDays }}</span>
              <span class="cal-stat-lbl">profit days</span>
            </div>
            <div class="cal-stat-sep" />
            <div class="cal-stat">
              <span class="cal-stat-num red">{{ lossDays }}</span>
              <span class="cal-stat-lbl">loss days</span>
            </div>
            <div class="cal-stat-sep" />
            <div class="cal-stat">
              <span class="cal-stat-num dim">{{ activeDays }}</span>
              <span class="cal-stat-lbl">active days</span>
            </div>
            <div class="legend-swatches">
              <div class="swatch-group">
                <span class="swatch" style="background: rgba(0,212,170,0.15)" />
                <span class="swatch" style="background: rgba(0,212,170,0.35)" />
                <span class="swatch" style="background: rgba(0,212,170,0.6)" />
                <span class="swatch" style="background: rgba(0,212,170,0.84)" />
                <span class="swatch-label">profit</span>
              </div>
              <div class="swatch-group">
                <span class="swatch" style="background: rgba(255,71,87,0.15)" />
                <span class="swatch" style="background: rgba(255,71,87,0.35)" />
                <span class="swatch" style="background: rgba(255,71,87,0.6)" />
                <span class="swatch" style="background: rgba(255,71,87,0.84)" />
                <span class="swatch-label">loss</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Month navigation bar -->
        <div class="cal-nav-bar">
          <button class="cal-nav-btn" @click="prevMonth" title="Previous month">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="cal-nav-month">{{ calendarMonth.label }}</span>
          <button class="cal-nav-btn" @click="nextMonth" :disabled="!canGoNext" title="Next month">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <div v-if="loading" class="cal-loading">
          <div class="spinner" />
        </div>

        <div v-else class="single-calendar">
          <!-- Day-of-week headers -->
          <div class="cal-dow-row">
            <span v-for="d in ['MON','TUE','WED','THU','FRI','SAT','SUN']" :key="d" class="cal-dow">{{ d }}</span>
          </div>

          <!-- Weeks -->
          <div class="cal-weeks">
            <div v-for="(week, wi) in calendarMonth.weeks" :key="wi" class="cal-week">
              <div
                v-for="(day, di) in week"
                :key="day.date || `${wi}-${di}`"
                class="cal-day"
                :class="{
                  'cal-empty':    day.isEmpty,
                  'cal-today':    day.isToday,
                  'cal-has-data': !day.isEmpty && day.pnl !== 0,
                  'cal-zero':     !day.isEmpty && day.pnl === 0,
                  'cal-pos':      !day.isEmpty && day.pnl > 0,
                  'cal-neg':      !day.isEmpty && day.pnl < 0,
                }"
                :style="getDayStyle(day)"
                :title="!day.isEmpty
                  ? (day.pnl !== 0 ? `${day.date}  ${fmtPnl(day.pnl)}` : `${day.date}  No trades`)
                  : ''"
              >
                <template v-if="!day.isEmpty">
                  <span class="cal-day-num">{{ day.dayOfMonth }}</span>
                  <span v-if="day.pnl !== 0" class="cal-day-pnl">{{ fmtPnl(day.pnl) }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Mobile list view ──────────────────────────── -->
        <div v-if="!loading" class="cal-mobile-list">
          <div
            v-for="day in calendarDays"
            :key="day.date"
            class="cal-list-row"
            :class="{
              'cal-list-pos':   day.pnl > 0,
              'cal-list-neg':   day.pnl < 0,
              'cal-list-today': day.isToday,
            }"
          >
            <span class="cal-list-dow">{{ getDowLabel(day.date) }}</span>
            <span class="cal-list-date">{{ day.dayOfMonth }}</span>
            <span class="cal-list-bar">
              <span
                v-if="day.pnl !== 0"
                class="cal-list-bar-fill"
                :style="{
                  width: Math.min(Math.abs(day.pnl) / calendarMaxAbs * 100, 100) + '%',
                  background: day.pnl > 0 ? 'var(--green)' : 'var(--red)',
                }"
              />
            </span>
            <span
              class="cal-list-pnl"
              :style="{ color: day.pnl > 0 ? 'var(--green)' : day.pnl < 0 ? 'var(--red)' : 'var(--text-tertiary)' }"
            >
              {{ day.pnl !== 0 ? fmtPnl(day.pnl) : '—' }}
            </span>
          </div>
        </div>

      </div>

    </div><!-- /.page-body -->
  </div>
</template>

<style scoped>
/* ── View ──────────────────────────────────────────────────── */
.analytics-view {
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

/* ── Banner Header ─────────────────────────────────────────── */
.page-header {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 32px 28px 28px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-subtle);
  overflow: hidden;
}

.header-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

.header-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, var(--surface) 0%, transparent 20%, transparent 70%, var(--surface) 100%);
}

.header-inner {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  z-index: 1;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
}

.tag-mark { font-size: 11px; opacity: 0.8; }

.page-title {
  font-family: var(--font-ui);
  font-size: 42px;
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.04em;
  color: var(--text-primary);
  margin: 0;
}

.title-accent { color: var(--accent); }

.header-right {
  display: flex;
  align-items: flex-end;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
}

.hdr-stat-block {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
  padding: 14px 18px;
}

.hdr-accent {
  background: var(--accent-muted);
  border-left: 1px solid rgba(240, 180, 41, 0.15);
}

.hdr-stat-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.hdr-stat-label {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.hdr-big-num {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--text-primary);
}

.hdr-divider {
  width: 1px;
  background: var(--border-subtle);
  align-self: stretch;
}

.hdr-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.header-meta {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.period-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 2px;
  color: var(--text-tertiary);
  background: var(--bg-elevated);
}

.period-sep {
  color: var(--border);
  font-size: 10px;
}

.period-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

/* ── Page body ─────────────────────────────────────────────── */
.page-body {
  padding: 20px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Spinner ─────────────────────────────────────────────── */
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Metric strip ────────────────────────────────────────── */
.metric-strip {
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.scan-line {
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent) 40%, var(--cyan) 70%, transparent);
  opacity: 0.4;
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

.ms-wide { flex: 1.4; }

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
  font-size: 19px;
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

.ms-bar-wrap { margin-top: 2px; }

.ms-bar-track {
  width: 100%;
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
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

.accent { color: var(--accent); }
.green  { color: var(--green); }
.red    { color: var(--red); }

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
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 18px 10px;
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}

.panel-header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.panel-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--accent);
  white-space: nowrap;
}

.panel-sub {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
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

/* ── Calendar panel ──────────────────────────────────────── */
.calendar-panel {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* Legend */
.cal-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
  flex-shrink: 0;
}

.cal-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.cal-stat-num {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.cal-stat-num.green { color: var(--green); }
.cal-stat-num.red   { color: var(--red); }
.cal-stat-num.dim   { color: var(--text-secondary); }

.cal-stat-lbl {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  white-space: nowrap;
}

.cal-stat-sep {
  width: 1px;
  height: 28px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

.legend-swatches {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 4px;
}

.swatch-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.swatch {
  display: block;
  width: 12px;
  height: 8px;
  border-radius: 1px;
}

.swatch-label {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--text-tertiary);
  margin-left: 4px;
  white-space: nowrap;
}

/* Month navigation bar */
.cal-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.cal-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.cal-nav-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-muted);
}

.cal-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.cal-nav-month {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-primary);
}

/* Single-month calendar body */
.cal-loading {
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.single-calendar {
  padding: 16px 18px 20px;
}

.cal-dow-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.cal-dow {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  text-align: center;
  padding: 4px 0;
}

.cal-weeks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cal-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-day {
  min-height: 72px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.018);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 7px 9px;
  cursor: default;
  transition: transform 0.12s, box-shadow 0.12s;
  position: relative;
  overflow: hidden;
}

.cal-has-data:hover {
  transform: scale(1.04);
  z-index: 20;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
}

.cal-zero:hover {
  background: rgba(255, 255, 255, 0.04);
}

.cal-empty {
  background: transparent !important;
  border-color: transparent !important;
  pointer-events: none;
}

.cal-today {
  box-shadow: inset 0 0 0 1.5px var(--accent) !important;
}

.cal-day-num {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: rgba(255, 255, 255, 0.28);
}

.cal-has-data .cal-day-num {
  color: rgba(255, 255, 255, 0.75);
  font-weight: 700;
}

.cal-today .cal-day-num {
  color: var(--accent);
  font-weight: 800;
}

.cal-day-pnl {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.02em;
}

.cal-pos .cal-day-pnl { color: var(--green); }
.cal-neg .cal-day-pnl { color: var(--red); }

/* ── Mobile list view (hidden on desktop) ────────────────── */
.cal-mobile-list { display: none; }

.cal-list-row {
  display: grid;
  grid-template-columns: 36px 28px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.1s;
}

.cal-list-row:last-child { border-bottom: none; }

.cal-list-pos { background: rgba(0, 212, 170, 0.04); }
.cal-list-neg { background: rgba(255, 71, 87, 0.04); }

.cal-list-today {
  box-shadow: inset 3px 0 0 var(--accent);
}

.cal-list-dow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}

.cal-list-date {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: right;
}

.cal-list-today .cal-list-date {
  color: var(--accent);
}

.cal-list-bar {
  height: 4px;
  background: var(--border-subtle);
  border-radius: 2px;
  overflow: hidden;
}

.cal-list-bar-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  opacity: 0.7;
  transition: width 0.4s var(--ease-out);
}

.cal-list-pnl {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-align: right;
  white-space: nowrap;
  min-width: 88px;
}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 1200px) {
  .metric-strip {
    flex-wrap: wrap;
  }
  .ms-cell { flex: 1 1 22%; border-bottom: 1px solid var(--border-subtle); }
  .ms-cell:nth-last-child(-n+4) { border-bottom: none; }
  .ms-div { display: none; }

  .cal-legend { display: none; }
}

@media (max-width: 900px) {
  .extremes-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .page-header { padding: 24px 16px 20px; }
  .page-title { font-size: 32px; }

  .header-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-right { width: 100%; }
  .hdr-stat-block { flex: 1; }

  .page-body { padding: 16px 16px 20px; }

  .single-calendar { padding: 12px 12px 16px; }

  .cal-day { min-height: 58px; padding: 5px 6px; }
  .cal-day-pnl { font-size: 10px; }
}

@media (max-width: 640px) {
  .ms-cell { flex: 1 1 45%; }
  .ms-value { font-size: 16px; }
  .extremes-row { gap: 8px; }
  .ec-value { font-size: 17px; }

  /* Switch to list view on mobile */
  .single-calendar { display: none; }
  .cal-mobile-list { display: block; }
}
</style>
