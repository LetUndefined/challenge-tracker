<script setup lang="ts">
import { computed } from 'vue'
import type { ChallengeRow } from '@/types'

const props = defineProps<{
  rows: ChallengeRow[]
}>()

const nonMaster = computed(() => props.rows.filter(r => !r.is_master))

const connected    = computed(() => nonMaster.value.filter(r => r.state === 'Connected').length)
const disconnected = computed(() => nonMaster.value.filter(r => r.state === 'Disconnected').length)

const totalBalance = computed(() => nonMaster.value.reduce((s, r) => s + r.balance, 0))
const totalEquity  = computed(() => nonMaster.value.reduce((s, r) => s + r.equity,  0))
const equityDelta  = computed(() => totalEquity.value - totalBalance.value)
const openPnl      = computed(() => nonMaster.value.reduce((s, r) => s + r.open_pnl, 0))
const totalCost    = computed(() => nonMaster.value.reduce((s, r) => s + (r.cost ?? 0), 0))

const avgProgress = computed(() => {
  const eligible = nonMaster.value.filter(r => r.target_pct > 0)
  if (!eligible.length) return null
  return Math.round(eligible.reduce((s, r) => s + r.progress, 0) / eligible.length * 10) / 10
})

function fmt(v: number, compact = false): string {
  const abs = Math.abs(v)
  if (compact && abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (compact && abs >= 10_000)    return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sign(v: number): string {
  return v >= 0 ? '+' : ''
}
</script>

<template>
  <div class="strip-wrap">
    <!-- Animated top scan line -->
    <div class="scan-line" />

    <div class="strip">

      <!-- ACCOUNTS -->
      <div class="cell">
        <div class="cell-label">ACCOUNTS</div>
        <div class="cell-value accent">{{ nonMaster.length }}</div>
        <div class="cell-sub">
          <span class="dot dot-green" />
          <span class="sub-green">{{ connected }}</span>
          <span class="sub-dim"> online</span>
          <template v-if="disconnected > 0">
            <span class="sub-sep">·</span>
            <span class="sub-red">{{ disconnected }}</span>
            <span class="sub-dim"> offline</span>
          </template>
        </div>
      </div>

      <div class="divider" />

      <!-- BALANCE -->
      <div class="cell cell-wide">
        <div class="cell-label">TOTAL BALANCE</div>
        <div class="cell-value cyan">{{ fmt(totalBalance, true) }}</div>
        <div class="cell-sub">
          <span class="sub-dim">{{ nonMaster.length }} account{{ nonMaster.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <div class="divider" />

      <!-- EQUITY -->
      <div class="cell cell-wide">
        <div class="cell-label">TOTAL EQUITY</div>
        <div class="cell-value green">{{ fmt(totalEquity, true) }}</div>
        <div class="cell-sub">
          <span :class="equityDelta >= 0 ? 'sub-green' : 'sub-red'">
            {{ sign(equityDelta) }}{{ fmt(equityDelta, true) }}
          </span>
          <span class="sub-dim"> vs balance</span>
        </div>
      </div>

      <div class="divider" />

      <!-- OPEN P&L — live -->
      <div class="cell cell-wide live-cell">
        <div class="cell-label">
          <span class="live-pip" />
          OPEN P&amp;L
        </div>
        <div class="cell-value" :class="openPnl >= 0 ? 'green' : 'red'">
          {{ sign(openPnl) }}{{ fmt(openPnl, true) }}
        </div>
        <div class="cell-sub">
          <span class="sub-dim">live unrealized</span>
        </div>
      </div>

      <div class="divider" />

      <!-- COST -->
      <div class="cell cell-wide">
        <div class="cell-label">TOTAL COST</div>
        <div class="cell-value orange">{{ totalCost > 0 ? fmt(totalCost, true) : '—' }}</div>
        <div class="cell-sub">
          <span class="sub-dim">invested</span>
        </div>
      </div>

      <div class="divider" />

      <!-- AVG PROGRESS -->
      <div class="cell">
        <div class="cell-label">AVG PROGRESS</div>
        <div
          class="cell-value"
          :class="avgProgress === null ? 'dim' : avgProgress >= 0 ? 'green' : 'red'"
        >
          {{ avgProgress === null ? '—' : sign(avgProgress) + avgProgress + '%' }}
        </div>
        <div class="cell-sub">
          <span class="sub-dim">{{ nonMaster.filter(r => r.target_pct > 0).length }} challenges</span>
        </div>
      </div>

    </div>

    <!-- Bottom ticker line -->
    <div class="ticker-line" />
  </div>
</template>

<style scoped>
/* ── Wrapper ─────────────────────────────────────────── */
.strip-wrap {
  position: relative;
  margin: 16px 0 14px;
  animation: fadeInUp 0.35s var(--ease-out) both;
}

/* ── Animated scan line (top) ────────────────────────── */
.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--accent) 30%,
    var(--cyan) 60%,
    transparent 100%
  );
  opacity: 0.5;
  animation: scan 4s ease-in-out infinite;
  background-size: 200% 100%;
}

@keyframes scan {
  0%   { background-position: -100% 0; opacity: 0.3; }
  50%  { background-position: 100% 0;  opacity: 0.6; }
  100% { background-position: -100% 0; opacity: 0.3; }
}

/* ── Main strip ──────────────────────────────────────── */
.strip {
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-top: none;
  border-bottom: none;
  overflow: hidden;
}

/* ── Ticker line (bottom) ────────────────────────────── */
.ticker-line {
  height: 1px;
  background: var(--border-subtle);
}

/* ── Cells ───────────────────────────────────────────── */
.cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 14px 18px;
  min-width: 0;
}

.cell-wide {
  flex: 1.4;
}

.cell-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  white-space: nowrap;
}

.cell-value {
  font-family: var(--font-mono);
  font-size: 21px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  white-space: nowrap;
  color: var(--text-primary);
}

/* Value color variants */
.cell-value.accent { color: var(--accent); }
.cell-value.cyan   { color: var(--cyan); }
.cell-value.green  { color: var(--green); }
.cell-value.red    { color: var(--red); }
.cell-value.orange { color: var(--orange); }
.cell-value.dim    { color: var(--text-tertiary); }

.cell-sub {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  white-space: nowrap;
  line-height: 1;
}

.sub-green { color: var(--green); }
.sub-red   { color: var(--red); }
.sub-dim   { color: var(--text-tertiary); }
.sub-sep   { color: var(--text-tertiary); margin: 0 1px; }

/* ── Divider ─────────────────────────────────────────── */
.divider {
  width: 1px;
  background: var(--border-subtle);
  flex-shrink: 0;
  margin: 10px 0;
}

/* ── Status dot ──────────────────────────────────────── */
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green {
  background: var(--green);
  box-shadow: 0 0 5px var(--green);
  animation: pulse-live 2.5s ease-in-out infinite;
}

/* ── Live cell ───────────────────────────────────────── */
.live-cell {
  position: relative;
}

.live-pip {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: pulse-live 2s ease-in-out infinite;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 1100px) {
  .strip {
    flex-wrap: wrap;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }

  .strip-wrap {
    /* On smaller screens, wrap cells into a card grid */
  }

  .cell {
    flex: 1 1 30%;
    border-bottom: 1px solid var(--border-subtle);
    padding: 12px 16px;
  }

  .cell:nth-last-child(-n+3) {
    border-bottom: none;
  }

  .divider {
    display: none;
  }

  .scan-line {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .ticker-line {
    display: none;
  }
}

@media (max-width: 640px) {
  .cell {
    flex: 1 1 45%;
  }

  .cell:nth-last-child(-n+3) {
    border-bottom: 1px solid var(--border-subtle);
  }

  .cell:nth-last-child(-n+2) {
    border-bottom: none;
  }

  .cell-value {
    font-size: 17px;
  }

  .cell {
    padding: 11px 14px;
  }
}
</style>
