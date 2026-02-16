<script setup lang="ts">
import type { ChallengeRow } from '@/types'

defineProps<{
  rows: ChallengeRow[]
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

function formatCurrency(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function progressColor(progress: number): string {
  if (progress >= 80) return 'var(--green)'
  if (progress >= 50) return 'var(--cyan)'
  if (progress >= 20) return 'var(--orange)'
  return 'var(--text-tertiary)'
}

function formatPnl(val: number): string {
  const prefix = val >= 0 ? '+' : ''
  return `${prefix}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pnlClass(val: number): string {
  if (val > 0) return 'pnl-up'
  if (val < 0) return 'pnl-down'
  return ''
}

function ddWarningClass(current: number, max: number): string {
  if (max <= 0) return ''
  const ratio = current / max
  if (ratio >= 0.9) return 'dd-danger'
  if (ratio >= 0.7) return 'dd-warning'
  return ''
}

function statusClass(status: string): string {
  if (status === 'Passed') return 'status-passed'
  if (status === 'Failed') return 'status-failed'
  return 'status-active'
}

function stateClass(state: string): string {
  return state === 'Connected' ? 'state-connected' : 'state-disconnected'
}
</script>

<template>
  <!-- Desktop table -->
  <div class="table-wrapper">
    <table class="challenge-table">
      <thead>
        <tr>
          <th>Account</th>
          <th>Owner</th>
          <th>Prop Firm</th>
          <th>Phase</th>
          <th>Platform</th>
          <th class="text-right">Balance</th>
          <th class="text-right">Equity</th>
          <th class="text-right">P&L</th>
          <th class="text-right">Target</th>
          <th>Progress</th>
          <th class="text-right">DD</th>
          <th>Status</th>
          <th>State</th>
          <th class="text-right">Trades</th>
          <th class="th-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td colspan="14" class="empty-state">
            <div class="empty-inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              <span>No challenges found. Add one to get started.</span>
            </div>
          </td>
        </tr>
        <tr v-for="(row, i) in rows" :key="row.id" :style="{ 'animation-delay': `${i * 30}ms` }">
          <td>
            <div class="account-cell">
              <div class="account-name-row">
                <span class="account-alias">{{ row.alias }}</span>
                <span v-if="row.is_master" class="chip chip-master">MASTER</span>
              </div>
              <span class="account-login">{{ row.login_number }}</span>
            </div>
          </td>
          <td class="text-secondary">{{ row.owner }}</td>
          <td>
            <span class="chip chip-firm">{{ row.prop_firm }}</span>
          </td>
          <td>
            <span class="chip chip-phase">{{ row.phase }}</span>
          </td>
          <td class="text-secondary">{{ row.platform }}</td>
          <td class="text-right mono">{{ formatCurrency(row.balance) }}</td>
          <td class="text-right mono">{{ formatCurrency(row.equity) }}</td>
          <td class="text-right mono" :class="pnlClass(row.pnl)">{{ formatPnl(row.pnl) }}</td>
          <td class="text-right mono text-secondary">{{ row.target_pct }}%</td>
          <td>
            <div class="progress-cell">
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :style="{ width: `${Math.min(row.progress, 100)}%`, background: progressColor(row.progress) }"
                />
              </div>
              <span class="progress-text" :style="{ color: progressColor(row.progress) }">
                {{ row.progress }}%
              </span>
            </div>
          </td>
          <td class="text-right">
            <span class="mono dd-value" :class="ddWarningClass(row.current_dd, row.max_dd_pct)">
              {{ row.current_dd }}%
            </span>
            <span class="dd-limit"> / {{ row.max_dd_pct }}%</span>
          </td>
          <td>
            <span class="chip" :class="statusClass(row.challenge_status)">{{ row.challenge_status }}</span>
          </td>
          <td>
            <div class="state-cell" :class="stateClass(row.state)">
              <span class="state-dot" />
              <span>{{ row.state }}</span>
            </div>
          </td>
          <td class="text-right mono">{{ row.trades_count }}</td>
          <td>
            <button class="btn-delete" title="Remove" @click="emit('delete', row.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Mobile card layout -->
  <div class="mobile-cards">
    <div v-if="rows.length === 0" class="empty-state-mobile">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <span>No challenges found. Add one to get started.</span>
    </div>
    <div
      v-for="(row, i) in rows"
      :key="row.id"
      class="mobile-card"
      :style="{ 'animation-delay': `${i * 40}ms` }"
    >
      <div class="card-header">
        <div class="card-title">
          <span class="card-alias">{{ row.alias }}</span>
          <div class="state-cell" :class="stateClass(row.state)">
            <span class="state-dot" />
            <span>{{ row.state }}</span>
          </div>
        </div>
        <button class="btn-delete" title="Remove" @click="emit('delete', row.id)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="card-chips">
        <span v-if="row.is_master" class="chip chip-master">MASTER</span>
        <span class="chip chip-firm">{{ row.prop_firm }}</span>
        <span class="chip chip-phase">{{ row.phase }}</span>
        <span class="card-platform">{{ row.platform }}</span>
      </div>

      <div class="card-financials">
        <div class="card-fin-item">
          <span class="card-fin-label">Balance</span>
          <span class="card-fin-value">{{ formatCurrency(row.balance) }}</span>
        </div>
        <div class="card-fin-item">
          <span class="card-fin-label">Equity</span>
          <span class="card-fin-value">{{ formatCurrency(row.equity) }}</span>
        </div>
        <div class="card-fin-item">
          <span class="card-fin-label">P&L</span>
          <span class="card-fin-value" :class="pnlClass(row.pnl)">{{ formatPnl(row.pnl) }}</span>
        </div>
      </div>

      <div class="card-row-dd">
        <div class="card-fin-item">
          <span class="card-fin-label">Drawdown</span>
          <span class="card-fin-value">
            <span :class="ddWarningClass(row.current_dd, row.max_dd_pct)">{{ row.current_dd }}%</span>
            <span class="dd-limit"> / {{ row.max_dd_pct }}%</span>
          </span>
        </div>
        <div class="card-fin-item" style="align-items: flex-end;">
          <span class="card-fin-label">Trades</span>
          <span class="card-fin-value">{{ row.trades_count }}</span>
        </div>
        <div class="card-fin-item" style="align-items: flex-end;">
          <span class="card-fin-label">Status</span>
          <span class="chip" :class="statusClass(row.challenge_status)" style="font-size: 10px;">{{ row.challenge_status }}</span>
        </div>
      </div>

      <div class="card-progress">
        <div class="card-progress-header">
          <span class="card-fin-label">Progress</span>
          <span class="progress-text" :style="{ color: progressColor(row.progress) }">
            {{ row.progress }}% / {{ row.target_pct }}%
          </span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: `${Math.min(row.progress, 100)}%`, background: progressColor(row.progress) }"
          />
        </div>
      </div>

      <div class="card-meta">
        <span>{{ row.owner }}</span>
        <span class="card-login">{{ row.login_number }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Desktop table ─── */
.table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.challenge-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.challenge-table th {
  padding: 10px 14px;
  text-align: left;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  position: relative;
}

.challenge-table th::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, var(--accent-muted) 0%, transparent 100%);
}

.th-actions {
  width: 44px;
}

.challenge-table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  white-space: nowrap;
  font-family: var(--font-ui);
}

.challenge-table tbody tr {
  animation: fadeInUp 0.35s var(--ease-out) both;
  transition: background 0.12s;
}

.challenge-table tbody tr:last-child td {
  border-bottom: none;
}

.challenge-table tbody tr:hover {
  background: var(--surface-hover);
}

.text-right { text-align: right; }
.text-secondary { color: var(--text-secondary); }
.text-ghost { color: var(--text-tertiary); }
.mono { font-family: var(--font-mono); font-size: 13px; }
.mono-sm { font-family: var(--font-mono); font-size: 11px; }

/* ─── Account cell ─── */
.account-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.account-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.account-alias {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.account-login {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
}

/* ─── Chips ─── */
.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.chip-firm {
  background: var(--accent-muted);
  color: var(--accent);
  border: 1px solid rgba(240, 180, 41, 0.12);
}

.chip-phase {
  background: var(--purple-muted);
  color: var(--purple);
  border: 1px solid rgba(165, 94, 234, 0.12);
}

.chip-master {
  background: var(--orange-muted);
  color: var(--orange);
  border: 1px solid rgba(255, 159, 67, 0.12);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 1px 5px;
}

/* ─── P&L ─── */
.pnl-up { color: var(--green); }
.pnl-down { color: var(--red); }

/* ─── Drawdown ─── */
.dd-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.dd-limit {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-ghost);
}

.dd-warning { color: var(--orange); }
.dd-danger { color: var(--red); }

/* ─── Status chips ─── */
.status-active {
  background: var(--cyan-muted);
  color: var(--cyan);
  border: 1px solid rgba(24, 220, 255, 0.12);
}

.status-passed {
  background: var(--green-muted);
  color: var(--green);
  border: 1px solid rgba(0, 212, 170, 0.12);
}

.status-failed {
  background: var(--red-muted);
  color: var(--red);
  border: 1px solid rgba(255, 71, 87, 0.12);
}

/* ─── Progress ─── */
.progress-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 130px;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s var(--ease-out);
}

.progress-text {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  min-width: 42px;
  text-align: right;
}

/* ─── State ─── */
.state-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.state-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.state-connected .state-dot {
  background: var(--green);
  box-shadow: 0 0 6px var(--green-muted);
  animation: pulse-live 2.5s ease-in-out infinite;
}

.state-connected {
  color: var(--green);
}

.state-disconnected .state-dot {
  background: var(--text-tertiary);
}

.state-disconnected {
  color: var(--text-tertiary);
}

/* ─── Empty ─── */
.empty-state {
  text-align: center;
  padding: 52px 20px !important;
}

.empty-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* ─── Delete button ─── */
.btn-delete {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-ghost);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-delete:hover {
  background: var(--red-muted);
  border-color: rgba(255, 71, 87, 0.2);
  color: var(--red);
}

/* ─── Mobile cards (hidden by default) ─── */
.mobile-cards {
  display: none;
}

.empty-state-mobile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 52px 20px;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}

.mobile-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 8px;
  animation: fadeInUp 0.35s var(--ease-out) both;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.card-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-alias {
  font-family: var(--font-ui);
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}

.card-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.card-platform {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

.card-financials {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.card-fin-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-fin-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

.card-fin-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-row-dd {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  margin-bottom: 12px;
}

.card-progress {
  margin-bottom: 10px;
}

.card-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.card-progress .progress-track {
  height: 5px;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-tertiary);
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.card-login {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-ghost);
}

/* ─── Responsive: swap table for cards ─── */
@media (max-width: 768px) {
  .table-wrapper {
    display: none;
  }

  .mobile-cards {
    display: block;
  }
}
</style>
