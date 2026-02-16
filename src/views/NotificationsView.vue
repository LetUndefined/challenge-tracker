<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useNotifications } from '@/composables/useNotifications'

const { notifications, loading, startPolling, stopPolling } = useNotifications()

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

function isBuy(side: string): boolean {
  const s = side.toLowerCase()
  return s.includes('buy') || s === 'long'
}

onMounted(() => startPolling(15_000))
onUnmounted(() => stopPolling())
</script>

<template>
  <div class="notifications-view">
    <div class="page-header">
      <div class="page-title-row">
        <h1>Notifications</h1>
        <div v-if="loading" class="poll-indicator">
          <div class="poll-spinner" />
        </div>
      </div>
      <p class="page-desc">Live trade feed across all tracked accounts</p>
    </div>

    <div v-if="notifications.length === 0" class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <p>No trade notifications yet</p>
      <p class="empty-hint">Trades will appear here as your accounts take positions</p>
    </div>

    <div v-else class="feed">
      <div
        v-for="(n, i) in notifications"
        :key="n.id"
        class="feed-item"
        :class="{ 'is-open': n.is_open }"
        :style="{ 'animation-delay': `${Math.min(i, 20) * 25}ms` }"
      >
        <div class="feed-icon" :class="isBuy(n.side) ? 'icon-buy' : 'icon-sell'">
          <svg v-if="isBuy(n.side)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </div>

        <div class="feed-body">
          <div class="feed-top">
            <span class="feed-account">{{ n.account_alias }}</span>
            <span class="feed-divider">/</span>
            <span class="feed-symbol">{{ n.symbol }}</span>
            <span class="feed-side" :class="isBuy(n.side) ? 'side-buy' : 'side-sell'">{{ n.side }}</span>
            <span class="feed-volume">{{ n.volume }}L</span>
          </div>
          <div class="feed-bottom">
            <span class="feed-prices">
              {{ n.open_price }}
              <template v-if="n.close_price !== null">
                <span class="arrow">-></span>
                {{ n.close_price }}
              </template>
            </span>
            <span v-if="n.profit !== null" class="feed-pnl" :class="n.profit >= 0 ? 'pnl-up' : 'pnl-down'">
              {{ n.profit >= 0 ? '+' : '' }}${{ n.profit.toFixed(2) }}
            </span>
            <span v-if="n.is_open" class="feed-live-badge">OPEN</span>
          </div>
        </div>

        <div class="feed-time">{{ formatTime(n.timestamp) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notifications-view {
  padding: 24px 28px;
  max-width: 860px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

.page-header {
  margin-bottom: 20px;
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

.poll-indicator {
  display: flex;
}

.poll-spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.page-desc {
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 4px 0 0;
}

/* ─── Empty ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 72px 20px;
  text-align: center;
}

.empty-state p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.empty-hint {
  font-size: 12px !important;
  color: var(--text-tertiary) !important;
}

/* ─── Feed ─── */
.feed {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feed-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  animation: fadeInUp 0.3s var(--ease-out) both;
  transition: background 0.12s;
}

.feed-item:hover {
  background: var(--surface-hover);
}

.feed-item.is-open {
  border-left: 2px solid var(--accent);
}

/* ─── Icon ─── */
.feed-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.icon-buy {
  background: var(--green-muted);
  color: var(--green);
}

.icon-sell {
  background: var(--red-muted);
  color: var(--red);
}

/* ─── Body ─── */
.feed-body {
  flex: 1;
  min-width: 0;
}

.feed-top {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.feed-account {
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.feed-divider {
  color: var(--text-ghost);
  font-size: 12px;
}

.feed-symbol {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 12px;
  color: var(--accent);
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

.side-buy {
  background: var(--green-muted);
  color: var(--green);
}

.side-sell {
  background: var(--red-muted);
  color: var(--red);
}

.feed-volume {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

.feed-bottom {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 3px;
}

.feed-prices {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

.arrow {
  color: var(--text-ghost);
  margin: 0 2px;
}

.feed-pnl {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}

.pnl-up { color: var(--green); }
.pnl-down { color: var(--red); }

.feed-live-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--accent-muted);
  color: var(--accent);
  letter-spacing: 0.08em;
  animation: pulse-live 2s ease-in-out infinite;
}

/* ─── Time ─── */
.feed-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-ghost);
  flex-shrink: 0;
  min-width: 36px;
  text-align: right;
}

@media (max-width: 768px) {
  .notifications-view {
    padding: 16px;
  }

  .page-title-row h1 {
    font-size: 18px;
  }

  .feed-item {
    padding: 10px 12px;
    gap: 10px;
  }

  .feed-top {
    gap: 4px;
  }

  .feed-account {
    font-size: 12px;
  }
}
</style>
