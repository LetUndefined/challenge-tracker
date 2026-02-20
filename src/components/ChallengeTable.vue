<script setup lang="ts">
import { ref } from 'vue'
import type { ChallengeRow } from '@/types'
import { useChallenges } from '@/composables/useChallenges'
import ProgressChart from './ProgressChart.vue'

defineProps<{
  rows: ChallengeRow[]
}>()

const emit = defineEmits<{
  delete: [id: string]
  edit: [row: ChallengeRow]
}>()

const { fetchSnapshots } = useChallenges()

const expandedId = ref<string | null>(null)
const snapshotsCache = ref<Record<string, { timestamp: string; equity: number }[]>>({})
const snapshotsLoading = ref<Record<string, boolean>>({})

async function toggleRow(row: ChallengeRow) {
  if (expandedId.value === row.id) {
    expandedId.value = null
    return
  }
  expandedId.value = row.id
  if (snapshotsCache.value[row.id] === undefined) {
    snapshotsLoading.value[row.id] = true
    snapshotsCache.value[row.id] = await fetchSnapshots(row.id)
    snapshotsLoading.value[row.id] = false
  }
}

function formatCurrency(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPnl(val: number): string {
  const abs = Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (val >= 0) return `+$${abs}`
  return `-$${abs}`
}

// Row danger coloring based on drawdown relative to max DD limit
function ddClass(row: ChallengeRow): string {
  if (row.is_master || row.progress >= 0) return ''
  if (row.max_dd_pct !== null && row.max_dd_pct > 0) {
    const ddUsed = Math.abs(row.progress) / row.max_dd_pct * 100
    if (ddUsed >= 80) return 'row-danger'
    if (ddUsed >= 50) return 'row-warn'
    return 'row-caution'
  }
  // Fallback thresholds if no max_dd_pct set
  if (row.progress <= -5) return 'row-danger'
  if (row.progress <= -3) return 'row-warn'
  return 'row-caution'
}

function pnlClass(val: number): string {
  if (val > 0) return 'pnl-positive'
  if (val < 0) return 'pnl-negative'
  return ''
}


function stateClass(state: string): string {
  return state === 'Connected' ? 'state-connected' : 'state-disconnected'
}

function formatLastTrade(ts: string | null): string {
  if (!ts) return '---'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <!-- Desktop: scrollable table -->
  <div class="table-wrapper desktop-table">
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
          <th class="text-right">PNL</th>
          <th class="text-right">TP</th>
          <th class="text-right">SL</th>
          <th class="text-right">Target</th>
          <th>Progress</th>
          <th>State</th>
          <th class="text-right">Trades</th>
          <th>Last Trade</th>
          <th class="th-actions"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td colspan="16" class="empty-state">
            <div class="empty-inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              <span>No challenges found. Add one to get started.</span>
            </div>
          </td>
        </tr>
        <template v-for="(row, i) in rows" :key="row.id">
          <tr
            :style="{ 'animation-delay': `${i * 30}ms` }"
            :class="['data-row', ddClass(row), { 'row-expanded': expandedId === row.id }]"
          >
            <td>
              <div class="account-cell clickable" @click="toggleRow(row)" :title="expandedId === row.id ? 'Collapse chart' : 'Expand chart'">
                <div class="account-name-row">
                  <span class="account-alias">{{ row.alias }}</span>
                  <svg
                    class="chevron"
                    :class="{ 'chevron-open': expandedId === row.id }"
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                  ><path d="M6 9l6 6 6-6"/></svg>
                </div>
                <span class="account-login">{{ row.login_number }}</span>
              </div>
            </td>
            <td class="text-secondary">{{ row.owner }}</td>
            <td>
              <span class="chip chip-firm">{{ row.prop_firm }}</span>
            </td>
            <td>
              <span class="chip" :class="row.phase === 'Master' ? 'chip-master' : 'chip-phase'">{{ row.phase }}</span>
            </td>
            <td class="text-secondary">{{ row.platform }}</td>
            <td class="text-right mono">{{ formatCurrency(row.balance) }}</td>
            <td class="text-right mono">{{ formatCurrency(row.equity) }}</td>
            <td class="text-right mono" :class="pnlClass(row.open_pnl)">
              <template v-if="row.open_positions.length > 0">
                <div v-for="(pos, pi) in row.open_positions" :key="pi" :class="pnlClass(pos.profit)">
                  {{ formatPnl(pos.profit) }}
                </div>
              </template>
              <span v-else class="text-ghost">---</span>
            </td>
            <td class="text-right mono">
              <template v-if="row.open_positions.length > 0">
                <div v-for="(pos, pi) in row.open_positions" :key="pi" class="tp-value">
                  {{ pos.tpPnl !== null ? formatPnl(pos.tpPnl) : '---' }}
                </div>
              </template>
              <span v-else class="text-ghost">---</span>
            </td>
            <td class="text-right mono">
              <template v-if="row.open_positions.length > 0">
                <div v-for="(pos, pi) in row.open_positions" :key="pi" class="sl-value">
                  {{ pos.slPnl !== null ? formatPnl(pos.slPnl) : '---' }}
                </div>
              </template>
              <span v-else class="text-ghost">---</span>
            </td>
            <td class="text-right mono text-secondary">{{ row.target_pct > 0 ? `${row.target_pct}%` : '—' }}</td>
            <td>
              <div class="progress-cell">
                <div class="progress-bidir">
                  <div class="progress-half loss-half">
                    <div
                      v-if="row.progress < 0 && row.target_pct > 0"
                      class="progress-fill-loss"
                      :style="{ width: `${Math.min(Math.abs(row.progress) / row.target_pct * 100, 100)}%` }"
                    />
                  </div>
                  <div class="progress-center" />
                  <div class="progress-half profit-half">
                    <div
                      v-if="row.progress > 0 && row.target_pct > 0"
                      class="progress-fill-profit"
                      :style="{ width: `${Math.min(row.progress / row.target_pct * 100, 100)}%` }"
                    />
                  </div>
                </div>
                <span class="progress-text" :style="{ color: row.progress >= 0 ? 'var(--green)' : 'var(--red)' }">
                  {{ row.progress }}%
                </span>
              </div>
            </td>
            <td>
              <div class="state-cell" :class="stateClass(row.state)">
                <span class="state-dot" />
                <span>{{ row.state }}</span>
              </div>
            </td>
            <td class="text-right mono">{{ row.trades_count }}</td>
            <td class="text-ghost mono-sm">{{ formatLastTrade(row.last_trade) }}</td>
            <td>
              <div class="row-actions">
                <button class="btn-edit" title="Edit" @click="emit('edit', row)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-delete" title="Remove" @click="emit('delete', row.id)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
          <!-- Expandable chart row -->
          <tr v-if="expandedId === row.id" class="chart-row">
            <td colspan="16" class="chart-td">
              <ProgressChart
                :snapshots="snapshotsCache[row.id] ?? []"
                :starting-balance="row.starting_balance"
                :created-at="row.created_at"
                :loading="!!snapshotsLoading[row.id]"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>

  <!-- Mobile: card layout -->
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
      class="challenge-card"
      :class="ddClass(row)"
      :style="{ 'animation-delay': `${i * 30}ms` }"
    >
      <div class="card-header" @click="toggleRow(row)">
        <div class="card-account">
          <div class="account-name-row">
            <span class="account-alias">{{ row.alias }}</span>
            <svg
              class="chevron"
              :class="{ 'chevron-open': expandedId === row.id }"
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            ><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <span class="account-login">{{ row.login_number }}</span>
        </div>
        <div class="card-header-right" @click.stop>
          <div class="state-cell" :class="stateClass(row.state)">
            <span class="state-dot" />
            <span>{{ row.state }}</span>
          </div>
          <button class="btn-edit" title="Edit" @click="emit('edit', row)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-delete" title="Remove" @click="emit('delete', row.id)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="card-chips">
        <span class="chip chip-firm">{{ row.prop_firm }}</span>
        <span class="chip" :class="row.phase === 'Master' ? 'chip-master' : 'chip-phase'">{{ row.phase }}</span>
        <span class="card-owner">{{ row.owner }}</span>
      </div>

      <div class="card-grid">
        <div class="card-stat">
          <span class="card-label">Balance</span>
          <span class="card-value mono">{{ formatCurrency(row.balance) }}</span>
        </div>
        <div class="card-stat">
          <span class="card-label">Equity</span>
          <span class="card-value mono">{{ formatCurrency(row.equity) }}</span>
        </div>
        <div class="card-stat">
          <span class="card-label">PNL</span>
          <div class="card-value mono" :class="pnlClass(row.open_pnl)">
            <template v-if="row.open_positions.length > 0">
              <div v-for="(pos, pi) in row.open_positions" :key="pi" :class="pnlClass(pos.profit)">
                {{ formatPnl(pos.profit) }}
              </div>
            </template>
            <span v-else class="text-ghost">---</span>
          </div>
        </div>
        <div class="card-stat">
          <span class="card-label">Target</span>
          <span class="card-value mono text-secondary">{{ row.target_pct > 0 ? `${row.target_pct}%` : '—' }}</span>
        </div>
        <div class="card-stat">
          <span class="card-label">Trades</span>
          <span class="card-value mono">{{ row.trades_count }}</span>
        </div>
        <div class="card-stat">
          <span class="card-label">Last Trade</span>
          <span class="card-value mono-sm text-ghost">{{ formatLastTrade(row.last_trade) }}</span>
        </div>
      </div>

      <div v-if="row.open_positions.length > 0" class="card-positions">
        <div v-for="(pos, pi) in row.open_positions" :key="pi" class="card-pos-row">
          <span class="card-pos-pnl" :class="pnlClass(pos.profit)">{{ formatPnl(pos.profit) }}</span>
          <span class="tp-value">TP {{ pos.tpPnl !== null ? formatPnl(pos.tpPnl) : '---' }}</span>
          <span class="sl-value">SL {{ pos.slPnl !== null ? formatPnl(pos.slPnl) : '---' }}</span>
        </div>
      </div>

      <div class="card-progress">
        <div class="progress-bidir">
          <div class="progress-half loss-half">
            <div
              v-if="row.progress < 0 && row.target_pct > 0"
              class="progress-fill-loss"
              :style="{ width: `${Math.min(Math.abs(row.progress) / row.target_pct * 100, 100)}%` }"
            />
          </div>
          <div class="progress-center" />
          <div class="progress-half profit-half">
            <div
              v-if="row.progress > 0 && row.target_pct > 0"
              class="progress-fill-profit"
              :style="{ width: `${Math.min(row.progress / row.target_pct * 100, 100)}%` }"
            />
          </div>
        </div>
        <span class="progress-text" :style="{ color: row.progress >= 0 ? 'var(--green)' : 'var(--red)' }">
          {{ row.progress }}%
        </span>
      </div>

      <!-- Mobile chart dropdown -->
      <div v-if="expandedId === row.id" class="card-chart">
        <ProgressChart
          :snapshots="snapshotsCache[row.id] ?? []"
          :starting-balance="row.starting_balance"
          :created-at="row.created_at"
          :loading="!!snapshotsLoading[row.id]"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
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

/* ─── Header ─── */
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

/* ─── Rows ─── */
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

/* ─── PNL ─── */
.challenge-table td.pnl-positive { color: var(--green); font-weight: 600; }
.challenge-table td.pnl-negative { color: var(--red); font-weight: 600; }

/* ─── TP / SL ─── */
.tp-sl-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  line-height: 1.6;
}

.tp-symbol {
  font-size: 9px;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
}

.tp-value {
  color: var(--green);
  font-size: 12px;
}

.sl-value {
  color: var(--red);
  font-size: 12px;
}

/* ─── Account cell ─── */
.account-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
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

/* ─── Progress ─── */
.progress-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 150px;
}

.progress-bidir {
  flex: 1;
  display: flex;
  align-items: center;
  height: 6px;
  gap: 0;
}

.progress-half {
  flex: 1;
  height: 100%;
  background: var(--border);
  overflow: hidden;
  position: relative;
}

.loss-half {
  border-radius: 3px 0 0 3px;
  direction: rtl;
}

.profit-half {
  border-radius: 0 3px 3px 0;
}

.progress-center {
  width: 2px;
  height: 10px;
  background: var(--text-tertiary);
  flex-shrink: 0;
  border-radius: 1px;
}

.progress-fill-profit {
  height: 100%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  border-radius: 0 3px 3px 0;
  transition: width 0.4s var(--ease-out);
}

.progress-fill-loss {
  height: 100%;
  background: var(--red);
  box-shadow: 0 0 8px var(--red);
  border-radius: 3px 0 0 3px;
  transition: width 0.4s var(--ease-out);
}

.progress-text {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  min-width: 48px;
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

/* ─── Drawdown row coloring ─── */
.row-caution {
  background: rgba(255, 159, 67, 0.03) !important;
  border-left: 2px solid rgba(255, 159, 67, 0.4) !important;
}

.row-warn {
  background: rgba(255, 159, 67, 0.06) !important;
  border-left: 2px solid var(--orange) !important;
}

.row-danger {
  background: rgba(255, 71, 87, 0.07) !important;
  border-left: 2px solid var(--red) !important;
  animation: danger-pulse 2.5s ease-in-out infinite !important;
}

@keyframes danger-pulse {
  0%, 100% { background: rgba(255, 71, 87, 0.07); }
  50%       { background: rgba(255, 71, 87, 0.13); }
}

/* ─── Master chip ─── */
.chip-master {
  background: rgba(24, 220, 255, 0.08);
  color: var(--cyan);
  border: 1px solid rgba(24, 220, 255, 0.14);
}

/* ─── Expand toggle ─── */
.account-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.clickable {
  cursor: pointer;
}

.clickable:hover .account-alias {
  color: var(--accent);
}

.chevron {
  color: var(--text-tertiary);
  transition: transform 0.2s var(--ease-out), color 0.15s;
  flex-shrink: 0;
}

.chevron-open {
  transform: rotate(180deg);
  color: var(--accent);
}

/* ─── Expanded chart row ─── */
.row-expanded td {
  background: var(--surface);
  border-bottom: none !important;
}

.chart-row td {
  padding: 0 !important;
  border-bottom: 1px solid var(--border-subtle);
}

.chart-td {
  background: rgba(6, 6, 11, 0.6);
  border-left: 2px solid var(--accent);
  border-left-color: var(--accent);
  animation: slideDown 0.25s var(--ease-out);
}

/* ─── Row actions ─── */
.row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-edit, .btn-delete {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-edit:hover {
  background: var(--purple-muted);
  border-color: rgba(165, 94, 234, 0.2);
  color: var(--purple);
}

.btn-delete:hover {
  background: var(--red-muted);
  border-color: rgba(255, 71, 87, 0.2);
  color: var(--red);
}

/* Mobile DD coloring — override border since cards use border shorthand */
@media (max-width: 768px) {
  .challenge-card.row-caution { border-color: rgba(255, 159, 67, 0.4); }
  .challenge-card.row-warn    { border-color: var(--orange); }
  .challenge-card.row-danger  { border-color: var(--red); }
}

/* ─── Mobile cards (hidden on desktop) ─── */
.mobile-cards {
  display: none;
}

@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }

  .mobile-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
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
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }

  .challenge-card {
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 14px;
    animation: fadeInUp 0.35s var(--ease-out) both;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 10px;
    cursor: pointer;
  }

  .card-account {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .card-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-chips {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .card-owner {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 10px;
  }

  .card-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-tertiary);
  }

  .card-value {
    font-size: 13px;
    color: var(--text-primary);
  }

  .card-value.pnl-positive { color: var(--green); font-weight: 600; }
  .card-value.pnl-negative { color: var(--red); font-weight: 600; }
  .card-value .pnl-positive { color: var(--green); font-weight: 600; }
  .card-value .pnl-negative { color: var(--red); font-weight: 600; }

  .card-positions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
    border-top: 1px solid var(--border-subtle);
    margin-bottom: 8px;
  }

  .card-pos-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .card-pos-pnl {
    font-weight: 600;
    min-width: 70px;
  }

  .card-progress {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
  }

  .card-progress .progress-bidir {
    flex: 1;
  }

  .card-chart {
    margin-top: 8px;
    border-top: 1px solid var(--border-subtle);
    border-left: 2px solid var(--accent);
    margin-left: -14px;
    padding-left: 0;
    animation: slideDown 0.25s var(--ease-out);
  }
}
</style>
