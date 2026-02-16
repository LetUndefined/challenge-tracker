<script setup lang="ts">
import { computed } from 'vue'
import type { ChallengeRow } from '@/types'

const props = defineProps<{
  rows: ChallengeRow[]
}>()

const stats = computed(() => {
  const rows = props.rows
  // Exclude master accounts from analytics
  const tracked = rows.filter(r => !r.is_master)
  const running = tracked.filter(r => r.state === 'Connected').length
  const totalBalance = tracked.reduce((sum, r) => sum + r.balance, 0)
  // P&L only from funded accounts
  const fundedPnl = tracked.filter(r => r.phase === 'Funded').reduce((sum, r) => sum + r.pnl, 0)
  const pnlSign = fundedPnl >= 0 ? '+' : ''
  const pnlColor = fundedPnl >= 0 ? 'var(--green)' : 'var(--red)'
  const passed = tracked.filter(r => r.challenge_status === 'Passed').length
  const failed = tracked.filter(r => r.challenge_status === 'Failed').length
  const totalCost = tracked.reduce((sum, r) => sum + r.cost, 0)

  return [
    { label: 'Accounts', value: String(tracked.length), color: 'var(--accent)' },
    { label: 'Running', value: String(running), color: 'var(--green)' },
    { label: 'Total Balance', value: `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'var(--cyan)' },
    { label: 'Funded P&L', value: `${pnlSign}$${Math.abs(fundedPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: pnlColor },
    { label: 'Total Cost', value: `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'var(--orange)' },
    { label: 'Passed / Failed', value: `${passed} / ${failed}`, color: passed > 0 ? 'var(--green)' : 'var(--purple)' },
  ]
})
</script>

<template>
  <div class="stats-bar">
    <div
      v-for="(stat, i) in stats"
      :key="stat.label"
      class="stat-card"
      :style="{
        '--card-accent': stat.color,
        'animation-delay': `${i * 60}ms`
      }"
    >
      <div class="stat-accent" />
      <div class="stat-label">{{ stat.label }}</div>
      <div class="stat-value">{{ stat.value }}</div>
    </div>
  </div>
</template>

<style scoped>
.stats-bar {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  padding: 20px 0 12px;
}

@media (max-width: 1100px) {
  .stats-bar {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 16px 0 8px;
  }

  .stat-card {
    padding: 10px 12px;
  }

  .stat-value {
    font-size: 16px;
  }
}

.stat-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  overflow: hidden;
  animation: fadeInUp 0.4s var(--ease-out) both;
}

.stat-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--card-accent);
  opacity: 0.6;
}

.stat-label {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--card-accent);
  line-height: 1;
  letter-spacing: -0.02em;
}
</style>
