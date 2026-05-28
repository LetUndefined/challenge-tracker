<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMacro } from '@/composables/useMacro'
import type { MacroReading } from '@/types'

const { readings, pairs, loading, error, lastUpdated, fetchMacro } = useMacro()

const FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭',
  NOK: '🇳🇴', SEK: '🇸🇪',
}

// ── Stats ───────────────────────────────────────────────────────────────────

const overheatCount    = computed(() => readings.value.filter(r => r.signal === 'overheating').length)
const elevatedCount    = computed(() => readings.value.filter(r => r.signal === 'elevated').length)
const easingCount      = computed(() => readings.value.filter(r => r.signal === 'easing').length)
const deflationaryCount = computed(() => readings.value.filter(r => r.signal === 'deflationary').length)

const hasData = computed(() => readings.value.length > 0)

// ── Pairs sorted: strong first ───────────────────────────────────────────────

const sortedPairs = computed(() => {
  return [...pairs.value].sort((a, b) => {
    if (a.divergence_strength !== b.divergence_strength) {
      return a.divergence_strength === 'strong' ? -1 : 1
    }
    return a.pair.localeCompare(b.pair)
  })
})

// ── Formatting helpers ───────────────────────────────────────────────────────

const lastUpdatedFormatted = computed<string | null>(() => {
  if (!lastUpdated.value) return null
  return new Date(lastUpdated.value + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
})

function formatPct(val: number | null): string {
  if (val === null || val === undefined) return '—'
  return val.toFixed(1) + '%'
}

function deviationText(r: MacroReading): string {
  if (r.core_cpi === null) return ''
  const diff = r.core_cpi - r.cb_target
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${diff.toFixed(1)}pp`
}

function deviationClass(r: MacroReading): string {
  if (r.core_cpi === null) return 'dev-neutral'
  const diff = r.core_cpi - r.cb_target
  if (diff > 0.5)  return 'dev-hot'
  if (diff > 0)    return 'dev-warm'
  if (diff < -0.5) return 'dev-cold'
  return 'dev-ok'
}

function trendArrow(trend: string): string {
  if (trend === 'rising')  return '↑'
  if (trend === 'falling') return '↓'
  return '→'
}

function trendClass(trend: string): string {
  if (trend === 'rising')  return 'trend-up'
  if (trend === 'falling') return 'trend-down'
  return 'trend-flat'
}

function labourArrow(trend: string): string {
  if (trend === 'tightening') return '↓'  // unemployment falling
  if (trend === 'softening')  return '↑'  // unemployment rising
  return '→'
}

function labourClass(trend: string): string {
  if (trend === 'tightening') return 'labour-tight'
  if (trend === 'softening')  return 'labour-soft'
  return 'trend-flat'
}

function signalClass(signal: string): string {
  switch (signal) {
    case 'overheating':   return 'sig-overheat'
    case 'elevated':      return 'sig-elevated'
    case 'easing':        return 'sig-easing'
    case 'deflationary':  return 'sig-deflation'
    default: return ''
  }
}

function cpiClass(signal: string): string {
  switch (signal) {
    case 'overheating':  return 'cpi-hot'
    case 'elevated':     return 'cpi-warm'
    case 'easing':       return 'cpi-cool'
    case 'deflationary': return 'cpi-cold'
    default: return ''
  }
}

function strengthClass(s: string): string {
  return s === 'strong' ? 'strength-strong' : 'strength-moderate'
}

onMounted(fetchMacro)
</script>

<template>
  <div class="macro-view">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <header class="page-header">
      <div class="header-grid" aria-hidden="true" />
      <div class="header-inner">
        <div class="header-left">
          <div class="header-tag">
            <span class="tag-mark">▸</span>
            G10 MACRO
          </div>
          <h1 class="page-title">
            Macro<br />
            <span class="title-accent">Scorecard</span>
          </h1>
        </div>

        <div class="header-right">
          <div class="hdr-stat-block">
            <div class="hdr-stat-row">
              <template v-if="loading">
                <div class="sync-spinner" />
                <span class="hdr-status-text syncing">Fetching data...</span>
              </template>
              <template v-else-if="lastUpdatedFormatted">
                <span class="hdr-live-dot" />
                <span class="hdr-status-text live">{{ lastUpdatedFormatted }}</span>
              </template>
              <template v-else>
                <span class="hdr-status-text muted">No data yet</span>
              </template>
            </div>
            <div class="hdr-stat-label">LAST SNAPSHOT</div>
          </div>

          <div class="hdr-divider" />

          <div class="hdr-stat-block hdr-accent">
            <div class="hdr-stat-row">
              <span class="hdr-big-num">{{ readings.length }}</span>
            </div>
            <div class="hdr-stat-label">ECONOMIES</div>
          </div>

          <div class="hdr-divider" />

          <div class="hdr-stat-block hdr-action">
            <button class="refresh-btn" :disabled="loading" @click="fetchMacro">
              <svg
                class="refresh-icon"
                :class="{ spinning: loading }"
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M8 16H3v5"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" class="api-error">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        {{ error }}
      </div>
    </header>

    <!-- ── Page body ──────────────────────────────────────────────────────── -->
    <div class="page-body">

      <!-- Stats bar -->
      <div class="stats-bar">
        <div class="stat-card stat-overheat">
          <div class="stat-value">{{ overheatCount }}</div>
          <div class="stat-label">OVERHEATING</div>
        </div>
        <div class="stat-card stat-elevated">
          <div class="stat-value">{{ elevatedCount }}</div>
          <div class="stat-label">ELEVATED</div>
        </div>
        <div class="stat-card stat-easing">
          <div class="stat-value">{{ easingCount }}</div>
          <div class="stat-label">EASING</div>
        </div>
        <div class="stat-card stat-deflation">
          <div class="stat-value">{{ deflationaryCount }}</div>
          <div class="stat-label">DEFLATIONARY</div>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading && !hasData" class="empty-state">
        <div class="loading-ring" />
        <p class="empty-title">Fetching macro data…</p>
      </div>

      <!-- No-data state -->
      <template v-else-if="!loading && !hasData && !error">
        <div class="empty-state">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
              <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 5-5"/>
            </svg>
          </div>
          <p class="empty-title">No macro data yet</p>
          <p class="empty-body">
            Run the update script to populate data:
          </p>
          <code class="empty-code">node scripts/update-macro.js</code>
          <p class="empty-body">
            Or trigger the <strong>Macro Data Update</strong> workflow in GitHub Actions.
            Make sure <code>SUPABASE_URL</code>, <code>SUPABASE_KEY</code>, and
            <code>FRED_API_KEY</code> are set as repository secrets.
          </p>
        </div>
      </template>

      <!-- Data tables -->
      <template v-else-if="hasData">

        <!-- ── Section 1: Macro Readings ───────────────────────────────── -->
        <section class="section">
          <div class="section-header">
            <span class="section-label">MACRO READINGS</span>
            <span class="section-count">{{ readings.length }} economies</span>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Central Bank</th>
                  <th>CB Target</th>
                  <th>Core CPI</th>
                  <th>Headline</th>
                  <th>Unemployment</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in readings" :key="r.currency" class="data-row">
                  <!-- Currency -->
                  <td class="td-currency">
                    <span class="flag">{{ FLAGS[r.currency] ?? '🏳' }}</span>
                    <span class="currency-code">{{ r.currency }}</span>
                  </td>

                  <!-- Central Bank -->
                  <td class="td-cb">
                    <span class="cb-name">{{ r.central_bank }}</span>
                  </td>

                  <!-- CB Target -->
                  <td class="td-target">
                    <span class="target-val">{{ r.cb_target.toFixed(1) }}%</span>
                    <span v-if="r.core_cpi !== null" class="deviation" :class="deviationClass(r)">
                      {{ deviationText(r) }}
                    </span>
                  </td>

                  <!-- Core CPI -->
                  <td class="td-cpi">
                    <span class="cpi-val" :class="cpiClass(r.signal)">
                      {{ formatPct(r.core_cpi) }}
                    </span>
                    <span class="trend-arrow" :class="trendClass(r.cpi_trend)">
                      {{ trendArrow(r.cpi_trend) }}
                    </span>
                  </td>

                  <!-- Headline -->
                  <td class="td-headline">
                    <span class="headline-val">{{ formatPct(r.headline_cpi) }}</span>
                  </td>

                  <!-- Unemployment -->
                  <td class="td-unemp">
                    <span class="unemp-val">{{ formatPct(r.unemployment) }}</span>
                    <span class="labour-arrow" :class="labourClass(r.labour_trend)">
                      {{ labourArrow(r.labour_trend) }}
                    </span>
                  </td>

                  <!-- Signal -->
                  <td class="td-signal">
                    <span class="signal-badge" :class="signalClass(r.signal)">
                      {{ r.signal }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ── Section 2: Divergence Pairs ─────────────────────────────── -->
        <section class="section">
          <div class="section-header">
            <span class="section-label">DIVERGENCE PAIRS</span>
            <span class="section-count">{{ sortedPairs.length }} qualifying pair{{ sortedPairs.length !== 1 ? 's' : '' }}</span>
          </div>

          <div v-if="sortedPairs.length === 0" class="no-pairs">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            No divergence pairs qualify today — all signals are aligned or neutral.
          </div>

          <div v-else class="table-wrap">
            <table class="data-table pairs-table">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Direction</th>
                  <th>Base Signal</th>
                  <th>Quote Signal</th>
                  <th>Strength</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in sortedPairs"
                  :key="p.pair"
                  class="data-row pair-row"
                  :class="{ 'pair-strong': p.divergence_strength === 'strong' }"
                >
                  <!-- Pair -->
                  <td class="td-pair">
                    <span class="pair-name">{{ p.pair }}</span>
                  </td>

                  <!-- Direction -->
                  <td class="td-direction">
                    <span class="dir-badge">↑ LONG</span>
                  </td>

                  <!-- Base Signal -->
                  <td class="td-sig">
                    <span class="signal-badge" :class="signalClass(p.base_signal)">
                      {{ p.base_currency }}: {{ p.base_signal }}
                    </span>
                  </td>

                  <!-- Quote Signal -->
                  <td class="td-sig">
                    <span class="signal-badge" :class="signalClass(p.quote_signal)">
                      {{ p.quote_currency }}: {{ p.quote_signal }}
                    </span>
                  </td>

                  <!-- Strength -->
                  <td class="td-strength">
                    <span class="strength-badge" :class="strengthClass(p.divergence_strength)">
                      {{ p.divergence_strength.toUpperCase() }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </template>
    </div>
  </div>
</template>

<style scoped>
.macro-view {
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
  animation: fadeInUp 0.4s var(--ease-out);
}

/* ── Page header ──────────────────────────────────────────────────────────── */
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

.tag-mark { font-size: 11px; line-height: 1; opacity: 0.8; }

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
  flex-shrink: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.hdr-stat-block {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
  padding: 14px 18px;
}

.hdr-accent { background: var(--accent-muted); border-left: 1px solid rgba(240,180,41,0.15); }
.hdr-action { border-left: 1px solid var(--border-subtle); padding: 10px 14px; justify-content: center; }

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

.hdr-status-text {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.hdr-status-text.live    { color: var(--green); }
.hdr-status-text.syncing { color: var(--accent); }
.hdr-status-text.muted   { color: var(--text-tertiary); }

.hdr-live-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: pulse-live 2.5s ease-in-out infinite;
  flex-shrink: 0;
}

.hdr-big-num {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--accent);
}

.hdr-divider { width: 1px; background: var(--border-subtle); align-self: stretch; }

.sync-spinner {
  width: 12px; height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.refresh-btn:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
.refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.refresh-icon { flex-shrink: 0; }
.refresh-icon.spinning { animation: spin 0.8s linear infinite; }

.api-error {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding: 5px 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--red-muted);
  border: 1px solid rgba(255,71,87,0.15);
  border-radius: var(--radius-sm);
  color: var(--red);
}

/* ── Page body ────────────────────────────────────────────────────────────── */
.page-body { padding: 0 28px 28px; }

/* ── Stats bar ────────────────────────────────────────────────────────────── */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 24px 0;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  border-top-width: 2px;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--text-tertiary);
}

.stat-overheat  { border-top-color: var(--red);    }
.stat-overheat  .stat-value { color: var(--red);    }
.stat-elevated  { border-top-color: var(--orange);  }
.stat-elevated  .stat-value { color: var(--orange);  }
.stat-easing    { border-top-color: var(--green);   }
.stat-easing    .stat-value { color: var(--green);   }
.stat-deflation { border-top-color: var(--cyan);    }
.stat-deflation .stat-value { color: var(--cyan);    }

/* ── Sections ─────────────────────────────────────────────────────────────── */
.section { margin-bottom: 32px; }

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--text-tertiary);
}

.section-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-ghost);
  padding: 2px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

/* ── Table ────────────────────────────────────────────────────────────────── */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table thead tr {
  border-bottom: 1px solid var(--border);
}

.data-table th {
  padding: 10px 16px;
  text-align: left;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  background: var(--bg-elevated);
  white-space: nowrap;
}

.data-table th:first-child { border-radius: var(--radius-lg) 0 0 0; }
.data-table th:last-child  { border-radius: 0 var(--radius-lg) 0 0; }

.data-row {
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.12s;
}
.data-row:last-child { border-bottom: none; }
.data-row:hover { background: var(--surface-hover); }

.data-table td {
  padding: 12px 16px;
  vertical-align: middle;
}

/* Currency column */
.td-currency { white-space: nowrap; }
.flag { font-size: 16px; margin-right: 8px; }
.currency-code {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.04em;
}

/* Central bank */
.cb-name {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Target + deviation */
.td-target {
  white-space: nowrap;
}
.target-val {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
  display: block;
}
.deviation {
  font-family: var(--font-mono);
  font-size: 10px;
  margin-top: 2px;
  display: block;
}
.dev-hot    { color: var(--red);    }
.dev-warm   { color: var(--orange); }
.dev-ok     { color: var(--green);  }
.dev-cold   { color: var(--cyan);   }
.dev-neutral { color: var(--text-tertiary); }

/* Core CPI */
.td-cpi { white-space: nowrap; }
.cpi-val {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
}
.cpi-hot  { color: var(--red);    }
.cpi-warm { color: var(--orange); }
.cpi-cool { color: var(--green);  }
.cpi-cold { color: var(--cyan);   }

.trend-arrow {
  font-family: var(--font-mono);
  font-size: 13px;
  margin-left: 5px;
}
.trend-up   { color: var(--red);    }
.trend-down { color: var(--green);  }
.trend-flat { color: var(--text-tertiary); }

/* Headline CPI */
.headline-val {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
}

/* Unemployment */
.td-unemp { white-space: nowrap; }
.unemp-val {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-secondary);
}
.labour-arrow {
  font-family: var(--font-mono);
  font-size: 13px;
  margin-left: 5px;
}
.labour-tight { color: var(--green); }
.labour-soft  { color: var(--red);   }

/* Signal badge */
.td-signal { white-space: nowrap; }

.signal-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.sig-overheat  { background: var(--red-muted);    color: var(--red);    border: 1px solid rgba(255,71,87,0.2);   }
.sig-elevated  { background: var(--orange-muted);  color: var(--orange);  border: 1px solid rgba(255,159,67,0.2); }
.sig-easing    { background: var(--green-muted);   color: var(--green);   border: 1px solid rgba(0,212,170,0.2);  }
.sig-deflation { background: var(--cyan-muted);    color: var(--cyan);    border: 1px solid rgba(24,220,255,0.2); }

/* ── Pairs table ──────────────────────────────────────────────────────────── */
.pairs-table .td-pair { min-width: 100px; }

.pair-row.pair-strong {
  border-left: 2px solid var(--accent);
}

.pair-name {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.dir-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  background: var(--green-muted);
  border: 1px solid rgba(0,212,170,0.2);
  color: var(--green);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.strength-badge {
  display: inline-block;
  padding: 3px 9px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.strength-strong   { background: var(--accent-muted);  color: var(--accent); border: 1px solid rgba(240,180,41,0.25); }
.strength-moderate { background: transparent; color: var(--text-tertiary); border: 1px solid var(--border); }

/* ── Loading / empty states ───────────────────────────────────────────────── */
.no-pairs {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  font-size: 13px;
  color: var(--text-tertiary);
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 64px 24px;
}

.loading-ring {
  width: 36px; height: 36px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

.empty-icon { color: var(--text-ghost); }

.empty-title {
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-body {
  font-size: 13px;
  color: var(--text-tertiary);
  max-width: 440px;
  line-height: 1.6;
}

.empty-body strong { color: var(--text-secondary); }

.empty-code {
  display: inline-block;
  padding: 8px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  letter-spacing: 0.02em;
}

/* ── Animations ───────────────────────────────────────────────────────────── */
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .page-header { padding: 24px 16px 20px; }
  .page-title  { font-size: 32px; }
  .header-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
  .header-right { width: 100%; }
  .hdr-stat-block { flex: 1; }
  .page-body { padding: 0 16px 16px; }
  .stats-bar { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .page-title { font-size: 28px; }
  .stats-bar  { grid-template-columns: repeat(2, 1fr); }
}
</style>
