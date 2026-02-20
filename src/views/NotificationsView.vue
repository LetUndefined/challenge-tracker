<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNotifications } from '@/composables/useNotifications'
import type { TradeNotification } from '@/composables/useNotifications'

const { notifications, loading, includeMaster, startPolling, stopPolling } = useNotifications()

// ── Group by account ─────────────────────────────────────
interface AccountGroup {
  challenge_id: string
  account_alias: string
  trades: TradeNotification[]
  openCount: number
  closedPnl: number
}

const accountGroups = computed<AccountGroup[]>(() => {
  const map = new Map<string, AccountGroup>()

  for (const n of notifications.value) {
    if (!map.has(n.challenge_id)) {
      map.set(n.challenge_id, {
        challenge_id: n.challenge_id,
        account_alias: n.account_alias,
        trades: [],
        openCount: 0,
        closedPnl: 0,
      })
    }
    const g = map.get(n.challenge_id)!
    g.trades.push(n)
    if (n.is_open) g.openCount++
    if (!n.is_open && n.profit !== null) g.closedPnl += n.profit
  }

  // sort by most recent trade first
  return Array.from(map.values()).sort((a, b) => {
    const aT = a.trades[0]?.timestamp ?? ''
    const bT = b.trades[0]?.timestamp ?? ''
    return bT.localeCompare(aT)
  })
})

const selectedId = ref<string | null>(null)

const selectedGroup = computed<AccountGroup | null>(() => {
  if (!selectedId.value) return accountGroups.value[0] ?? null
  return accountGroups.value.find(g => g.challenge_id === selectedId.value) ?? null
})

function selectAccount(id: string) {
  selectedId.value = id
}

// ── Formatting helpers ────────────────────────────────────
function formatTime(ts: string): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatPnl(v: number): string {
  const abs = Math.abs(v).toFixed(2)
  return v >= 0 ? `+$${abs}` : `-$${abs}`
}

function isBuy(side: string): boolean {
  const s = side.toLowerCase()
  return s.includes('buy') || s === 'long'
}

function pnlColor(v: number): string {
  return v >= 0 ? 'var(--green)' : 'var(--red)'
}

onMounted(() => startPolling(15_000))
onUnmounted(() => stopPolling())
</script>

<template>
  <div class="notifications-view">

    <!-- Page header -->
    <div class="page-header">
      <div class="page-title-row">
        <h1>Notifications</h1>
        <div v-if="loading" class="poll-dot">
          <div class="poll-spinner" />
        </div>
      </div>

      <div class="header-controls">
        <label class="toggle-label">
          <input type="checkbox" v-model="includeMaster" class="toggle-input" />
          <span class="toggle-switch" />
          <span class="toggle-text">Include master</span>
        </label>

        <span class="account-count">
          {{ accountGroups.length }} account{{ accountGroups.length !== 1 ? 's' : '' }}
        </span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="accountGroups.length === 0" class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <p>No trade notifications yet</p>
      <p class="empty-hint">Trades will appear here as your accounts take positions</p>
    </div>

    <!-- Main body: sidebar + feed -->
    <div v-else class="body">

      <!-- Account sidebar -->
      <aside class="sidebar">
        <div
          v-for="g in accountGroups"
          :key="g.challenge_id"
          class="account-card"
          :class="{ 'account-card--active': (selectedId ?? accountGroups[0]?.challenge_id) === g.challenge_id }"
          @click="selectAccount(g.challenge_id)"
        >
          <div class="ac-top">
            <span class="ac-name">{{ g.account_alias }}</span>
            <span v-if="g.openCount > 0" class="ac-open-badge">{{ g.openCount }} OPEN</span>
          </div>
          <div class="ac-meta">
            <span class="ac-trade-count">{{ g.trades.length }} trade{{ g.trades.length !== 1 ? 's' : '' }}</span>
            <span
              class="ac-pnl"
              :style="{ color: pnlColor(g.closedPnl) }"
            >{{ formatPnl(g.closedPnl) }}</span>
          </div>
        </div>
      </aside>

      <!-- Trade feed for selected account -->
      <section class="feed-panel" v-if="selectedGroup">
        <div class="feed-header">
          <div class="feed-header-left">
            <span class="feed-title">{{ selectedGroup.account_alias }}</span>
            <span v-if="selectedGroup.openCount > 0" class="feed-live-badge">
              {{ selectedGroup.openCount }} live
            </span>
          </div>
          <div class="feed-header-right">
            <span class="feed-pnl-total" :style="{ color: pnlColor(selectedGroup.closedPnl) }">
              {{ formatPnl(selectedGroup.closedPnl) }} closed
            </span>
            <span class="feed-trade-total text-ghost">
              {{ selectedGroup.trades.length }} trades
            </span>
          </div>
        </div>

        <div class="feed">
          <div
            v-for="(n, i) in selectedGroup.trades"
            :key="n.id"
            class="feed-item"
            :class="{ 'is-open': n.is_open }"
            :style="{ 'animation-delay': `${Math.min(i, 20) * 20}ms` }"
          >
            <!-- Direction icon -->
            <div class="feed-icon" :class="isBuy(n.side) ? 'icon-buy' : 'icon-sell'">
              <svg v-if="isBuy(n.side)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>

            <!-- Content -->
            <div class="feed-body">
              <div class="feed-top">
                <span class="feed-symbol">{{ n.symbol }}</span>
                <span class="feed-side" :class="isBuy(n.side) ? 'side-buy' : 'side-sell'">
                  {{ isBuy(n.side) ? 'BUY' : 'SELL' }}
                </span>
                <span class="feed-volume">{{ n.volume }}L</span>
                <span v-if="n.is_open" class="feed-open-chip">OPEN</span>
              </div>
              <div class="feed-bottom">
                <span class="feed-prices">
                  @{{ n.open_price }}
                  <template v-if="n.close_price !== null">
                    <span class="arrow">→</span>{{ n.close_price }}
                  </template>
                </span>
                <span
                  v-if="n.profit !== null && !n.is_open"
                  class="feed-pnl"
                  :style="{ color: pnlColor(n.profit) }"
                >{{ formatPnl(n.profit) }}</span>
              </div>
            </div>

            <!-- Timestamp -->
            <div class="feed-time">{{ formatTime(n.timestamp) }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.notifications-view {
  padding: 24px 28px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeInUp 0.35s var(--ease-out);
}

/* ─── Header ─── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-title-row h1 {
  font-family: var(--font-ui);
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.poll-dot {
  display: flex;
}

.poll-spinner {
  width: 13px;
  height: 13px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.header-controls {
  display: flex;
  align-items: center;
  gap: 18px;
}

.account-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

/* ─── Toggle ─── */
.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.toggle-input { display: none; }
.toggle-switch {
  width: 32px;
  height: 17px;
  background: var(--border);
  border-radius: 9px;
  position: relative;
  transition: background 0.2s;
}
.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  background: var(--text-tertiary);
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}
.toggle-input:checked + .toggle-switch { background: var(--accent-muted); }
.toggle-input:checked + .toggle-switch::after {
  transform: translateX(15px);
  background: var(--accent);
}
.toggle-text {
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--text-secondary);
}

/* ─── Empty ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 80px 20px;
  text-align: center;
}
.empty-state p { font-size: 14px; color: var(--text-secondary); margin: 0; }
.empty-hint { font-size: 12px !important; color: var(--text-tertiary) !important; }

/* ─── Body layout ─── */
.body {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 12px;
  align-items: start;
}

/* ─── Account sidebar ─── */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
}

.account-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.15s;
  border-left: 2px solid transparent;
  animation: fadeInUp 0.3s var(--ease-out) both;
}

.account-card:hover {
  background: var(--surface-hover);
}

.account-card--active {
  border-left-color: var(--accent);
  background: var(--surface-hover);
}

.ac-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 5px;
}

.ac-name {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ac-open-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--accent-muted);
  color: var(--accent);
  letter-spacing: 0.06em;
  flex-shrink: 0;
  animation: pulse-live 2s ease-in-out infinite;
}

.ac-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ac-trade-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
}

.ac-pnl {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
}

/* ─── Feed panel ─── */
.feed-panel {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.01);
  gap: 12px;
}

.feed-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feed-title {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.feed-live-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 2px;
  background: var(--accent-muted);
  color: var(--accent);
  letter-spacing: 0.08em;
  animation: pulse-live 2s ease-in-out infinite;
}

.feed-header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.feed-pnl-total {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
}

.feed-trade-total {
  font-family: var(--font-mono);
  font-size: 11px;
}

.text-ghost { color: var(--text-tertiary); }

/* ─── Feed ─── */
.feed {
  display: flex;
  flex-direction: column;
}

.feed-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--border-subtle);
  animation: fadeInUp 0.25s var(--ease-out) both;
  transition: background 0.1s;
}

.feed-item:last-child {
  border-bottom: none;
}

.feed-item:hover {
  background: var(--surface-hover);
}

.feed-item.is-open {
  border-left: 2px solid var(--accent);
}

/* ─── Icon ─── */
.feed-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.icon-buy  { background: var(--green-muted); color: var(--green); }
.icon-sell { background: var(--red-muted);   color: var(--red); }

/* ─── Content ─── */
.feed-body {
  flex: 1;
  min-width: 0;
}

.feed-top {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.feed-symbol {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.feed-side {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 2px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.side-buy  { background: var(--green-muted); color: var(--green); }
.side-sell { background: var(--red-muted);   color: var(--red); }

.feed-volume {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

.feed-open-chip {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--accent-muted);
  color: var(--accent);
  letter-spacing: 0.06em;
  animation: pulse-live 2s ease-in-out infinite;
}

.feed-bottom {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.feed-prices {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

.arrow {
  margin: 0 3px;
  color: var(--text-ghost);
}

.feed-pnl {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}

/* ─── Time ─── */
.feed-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-ghost);
  flex-shrink: 0;
  min-width: 32px;
  text-align: right;
}

/* ─── Mobile ─── */
@media (max-width: 720px) {
  .notifications-view {
    padding: 16px 12px;
    gap: 12px;
  }

  .page-title-row h1 { font-size: 18px; }

  .body {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    max-height: none;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: visible;
    gap: 8px;
    padding-bottom: 4px;
  }

  .account-card {
    min-width: 160px;
    flex-shrink: 0;
    border-left: none;
    border-top: 2px solid transparent;
  }

  .account-card--active {
    border-left-color: transparent;
    border-top-color: var(--accent);
  }

  .feed-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .feed-item {
    padding: 10px 12px;
    gap: 10px;
  }
}
</style>
