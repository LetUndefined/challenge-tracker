<script setup lang="ts">
import { computed } from 'vue'

interface Snapshot {
  timestamp: string
  equity: number
}

const props = defineProps<{
  snapshots: Snapshot[]
  startingBalance: number
  createdAt: string
  loading: boolean
}>()

// SVG layout constants
const W = 600
const H = 200
const PAD_L = 72
const PAD_R = 14
const PAD_T = 14
const PAD_B = 36
const CW = W - PAD_L - PAD_R   // chart width
const CH = H - PAD_T - PAD_B   // chart height

const chartData = computed<{ t: number; equity: number }[]>(() => {
  if (props.loading) return []

  // Start with a virtual point at created_at with starting balance
  const startMs = new Date(props.createdAt).getTime()
  const points: { t: number; equity: number }[] = [
    { t: startMs, equity: props.startingBalance },
  ]

  for (const s of props.snapshots) {
    const t = new Date(s.timestamp).getTime()
    if (t > startMs) {
      points.push({ t, equity: s.equity })
    }
  }
  return points
})

const hasData = computed(() => chartData.value.length >= 2)

const minT = computed(() => Math.min(...chartData.value.map(p => p.t)))
const maxT = computed(() => Math.max(...chartData.value.map(p => p.t)))

const allEquities = computed(() => chartData.value.map(p => p.equity))
const rawMinE = computed(() => Math.min(...allEquities.value, props.startingBalance))
const rawMaxE = computed(() => Math.max(...allEquities.value, props.startingBalance))
const eRange = computed(() => {
  const r = rawMaxE.value - rawMinE.value
  return r < 1 ? 10 : r  // ensure non-zero range
})
const minE = computed(() => rawMinE.value - eRange.value * 0.08)
const maxE = computed(() => rawMaxE.value + eRange.value * 0.08)

function mapX(t: number): number {
  const span = maxT.value - minT.value
  if (span === 0) return PAD_L + CW / 2
  return PAD_L + ((t - minT.value) / span) * CW
}

function mapY(equity: number): number {
  return PAD_T + ((maxE.value - equity) / (maxE.value - minE.value)) * CH
}

const linePath = computed(() => {
  if (!hasData.value) return ''
  return chartData.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.t).toFixed(1)} ${mapY(p.equity).toFixed(1)}`)
    .join(' ')
})

const areaPath = computed(() => {
  if (!hasData.value) return ''
  const startY = mapY(props.startingBalance).toFixed(1)
  const firstX = mapX(chartData.value[0].t).toFixed(1)
  const lastX = mapX(chartData.value[chartData.value.length - 1].t).toFixed(1)
  return `${linePath.value} L ${lastX} ${startY} L ${firstX} ${startY} Z`
})

const currentEquity = computed(() => {
  if (!chartData.value.length) return props.startingBalance
  return chartData.value[chartData.value.length - 1].equity
})

const isProfit = computed(() => currentEquity.value >= props.startingBalance)
const lineColor = computed(() => isProfit.value ? 'var(--green)' : 'var(--red)')
const areaId = computed(() => `area-grad-${Math.random().toString(36).slice(2, 7)}`)

// Y axis labels (5 evenly spaced)
const yLabels = computed(() => {
  const labels: { y: number; value: number }[] = []
  const step = (maxE.value - minE.value) / 4
  for (let i = 0; i <= 4; i++) {
    const val = maxE.value - step * i
    labels.push({ y: mapY(val), value: val })
  }
  return labels
})

// X axis labels (up to 5 evenly spaced)
const xLabels = computed(() => {
  if (!hasData.value) return []
  const labels: { x: number; label: string }[] = []
  const count = Math.min(5, chartData.value.length)
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (chartData.value.length - 1))
    const p = chartData.value[idx]
    const d = new Date(p.t)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    labels.push({ x: mapX(p.t), label })
  }
  return labels
})

// Starting balance reference line
const startLineY = computed(() => mapY(props.startingBalance))

function formatCurrency(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}
</script>

<template>
  <div class="chart-container">
    <div v-if="loading" class="chart-state">
      <div class="chart-spinner" />
      <span>Loading chart data...</span>
    </div>
    <div v-else-if="!hasData" class="chart-state">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      <span>No chart data yet — snapshots are captured every 5 minutes once connected.</span>
    </div>
    <svg
      v-else
      :viewBox="`0 0 ${W} ${H}`"
      class="equity-svg"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient :id="areaId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="isProfit ? '#00d4aa' : '#ff4757'" stop-opacity="0.18"/>
          <stop offset="100%" :stop-color="isProfit ? '#00d4aa' : '#ff4757'" stop-opacity="0.01"/>
        </linearGradient>
      </defs>

      <!-- Subtle grid lines -->
      <g class="grid">
        <line
          v-for="lbl in yLabels"
          :key="lbl.value"
          :x1="PAD_L" :y1="lbl.y.toFixed(1)"
          :x2="W - PAD_R" :y2="lbl.y.toFixed(1)"
          stroke="rgba(255,255,255,0.04)" stroke-width="1"
        />
      </g>

      <!-- Starting balance reference line -->
      <line
        :x1="PAD_L" :y1="startLineY.toFixed(1)"
        :x2="W - PAD_R" :y2="startLineY.toFixed(1)"
        stroke="#f0b429" stroke-width="1" stroke-dasharray="5 4" opacity="0.5"
      />

      <!-- Area fill -->
      <path :d="areaPath" :fill="`url(#${areaId})`" />

      <!-- Equity line -->
      <path :d="linePath" fill="none" :stroke="lineColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>

      <!-- First point dot -->
      <circle
        :cx="mapX(chartData[0].t).toFixed(1)"
        :cy="mapY(chartData[0].equity).toFixed(1)"
        r="3" :fill="lineColor" opacity="0.7"
      />

      <!-- Last point dot -->
      <circle
        :cx="mapX(chartData[chartData.length - 1].t).toFixed(1)"
        :cy="mapY(chartData[chartData.length - 1].equity).toFixed(1)"
        r="3.5" :fill="lineColor"
      />

      <!-- Y axis labels -->
      <g class="y-labels">
        <text
          v-for="lbl in yLabels"
          :key="lbl.value"
          :x="PAD_L - 6"
          :y="(lbl.y + 3.5).toFixed(1)"
          text-anchor="end"
          font-family="'JetBrains Mono', monospace"
          font-size="9"
          fill="rgba(255,255,255,0.35)"
        >{{ formatCurrency(lbl.value) }}</text>
      </g>

      <!-- X axis labels -->
      <g class="x-labels">
        <text
          v-for="lbl in xLabels"
          :key="lbl.x"
          :x="lbl.x.toFixed(1)"
          :y="H - 10"
          text-anchor="middle"
          font-family="'JetBrains Mono', monospace"
          font-size="9"
          fill="rgba(255,255,255,0.3)"
        >{{ lbl.label }}</text>
      </g>

      <!-- Starting balance label -->
      <text
        :x="W - PAD_R - 2"
        :y="(startLineY - 4).toFixed(1)"
        text-anchor="end"
        font-family="'JetBrains Mono', monospace"
        font-size="9"
        fill="#f0b429"
        opacity="0.7"
      >start</text>
    </svg>
  </div>
</template>

<style scoped>
.chart-container {
  width: 100%;
  padding: 10px 14px 8px;
}

.equity-svg {
  display: block;
  width: 100%;
  height: 160px;
}

.chart-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 0;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 12px;
}

.chart-spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
