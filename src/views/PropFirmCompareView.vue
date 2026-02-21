<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

interface PropFirm {
  id: string
  name: string
  website: string | null
  rating: number | null
  reviews_count: number | null
  phases: number | null
  instant_funding: boolean
  profit_target_p1: number | null
  profit_target_p2: number | null
  min_trading_days: number | null
  max_trading_days: number | null
  drawdown_type: string | null
  max_daily_loss_pct: number | null
  max_total_loss_pct: number | null
  profit_split_pct: number | null
  payout_frequency: string | null
  ea_allowed: boolean | null
  copy_trading_allowed: boolean | null
  news_trading_allowed: boolean | null
  weekend_holding: boolean | null
  overnight_holding: boolean | null
  consistency_rule: boolean | null
  ip_restriction_notes: string | null
  multiple_accounts: boolean | null
  forex: boolean | null
  crypto: boolean | null
  indices: boolean | null
  commodities: boolean | null
  futures: boolean | null
  mt4: boolean | null
  mt5: boolean | null
  ctrader: boolean | null
  fee_10k: number | null
  fee_25k: number | null
  fee_50k: number | null
  fee_100k: number | null
  status: string
  notes: string | null
  last_scraped: string | null
}

const firms = ref<PropFirm[]>([])
const loading = ref(false)
const search = ref('')

// Filters
const filters = ref({
  ea_allowed: null as boolean | null,
  copy_trading_allowed: null as boolean | null,
  news_trading_allowed: null as boolean | null,
  weekend_holding: null as boolean | null,
  overnight_holding: null as boolean | null,
  consistency_rule: null as boolean | null,
  no_time_limit: false,
  drawdown_type: '' as '' | 'trailing' | 'static',
  min_split: 0,
  max_phases: 0,
})

const sortKey = ref<keyof PropFirm>('rating')
const sortAsc = ref(false)

async function load() {
  loading.value = true
  const { data, error } = await supabase
    .from('prop_firms')
    .select('*')
    .eq('status', 'active')
    .order('rating', { ascending: false })
  if (!error) firms.value = data ?? []
  loading.value = false
}

const filtered = computed(() => {
  let list = firms.value

  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(f => f.name.toLowerCase().includes(q))
  }

  if (filters.value.ea_allowed !== null)
    list = list.filter(f => f.ea_allowed === filters.value.ea_allowed)
  if (filters.value.copy_trading_allowed !== null)
    list = list.filter(f => f.copy_trading_allowed === filters.value.copy_trading_allowed)
  if (filters.value.news_trading_allowed !== null)
    list = list.filter(f => f.news_trading_allowed === filters.value.news_trading_allowed)
  if (filters.value.weekend_holding !== null)
    list = list.filter(f => f.weekend_holding === filters.value.weekend_holding)
  if (filters.value.overnight_holding !== null)
    list = list.filter(f => f.overnight_holding === filters.value.overnight_holding)
  if (filters.value.consistency_rule !== null)
    list = list.filter(f => f.consistency_rule === filters.value.consistency_rule)
  if (filters.value.no_time_limit)
    list = list.filter(f => f.max_trading_days === null)
  if (filters.value.drawdown_type)
    list = list.filter(f => f.drawdown_type === filters.value.drawdown_type)
  if (filters.value.min_split > 0)
    list = list.filter(f => (f.profit_split_pct ?? 0) >= filters.value.min_split)
  if (filters.value.max_phases > 0)
    list = list.filter(f => (f.phases ?? 99) <= filters.value.max_phases)

  // Sort
  list = [...list].sort((a, b) => {
    const av = a[sortKey.value] as any
    const bv = b[sortKey.value] as any
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortAsc.value ? cmp : -cmp
  })

  return list
})

function resetFilters() {
  search.value = ''
  filters.value = {
    ea_allowed: null,
    copy_trading_allowed: null,
    news_trading_allowed: null,
    weekend_holding: null,
    overnight_holding: null,
    consistency_rule: null,
    no_time_limit: false,
    drawdown_type: '',
    min_split: 0,
    max_phases: 0,
  }
}

function sortBy(key: keyof PropFirm) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else { sortKey.value = key; sortAsc.value = false }
}

function boolIcon(v: boolean | null): string {
  if (v === true)  return '✓'
  if (v === false) return '✗'
  return '—'
}

function boolClass(v: boolean | null): string {
  if (v === true)  return 'yes'
  if (v === false) return 'no'
  return 'unknown'
}

function pct(v: number | null) { return v != null ? `${v}%` : '—' }
function num(v: number | null) { return v != null ? String(v) : '—' }

onMounted(load)
</script>

<template>
  <div class="compare-view">
    <div class="page-header">
      <div class="page-title-row">
        <div>
          <h1>Prop Firm Compare</h1>
          <p class="page-sub">{{ filtered.length }} firms{{ firms.length !== filtered.length ? ` of ${firms.length}` : '' }}</p>
        </div>
        <div class="header-right">
          <span v-if="firms.length === 0 && !loading" class="no-data-hint">
            Run <code>node scripts/scrape-propfirms.js</code> to populate data
          </span>
        </div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <input v-model="search" class="search-input" placeholder="Search firm name..." />

      <div class="filter-group">
        <span class="filter-label">DD Type</span>
        <select v-model="filters.drawdown_type">
          <option value="">Any</option>
          <option value="static">Static</option>
          <option value="trailing">Trailing</option>
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">Phases</span>
        <select v-model="filters.max_phases">
          <option :value="0">Any</option>
          <option :value="1">1 Phase</option>
          <option :value="2">≤ 2 Phases</option>
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">Min Split %</span>
        <select v-model="filters.min_split">
          <option :value="0">Any</option>
          <option :value="80">80%+</option>
          <option :value="85">85%+</option>
          <option :value="90">90%+</option>
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">EA / Bots</span>
        <select v-model="filters.ea_allowed">
          <option :value="null">Any</option>
          <option :value="true">Allowed</option>
          <option :value="false">Not Allowed</option>
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">Copy Trading</span>
        <select v-model="filters.copy_trading_allowed">
          <option :value="null">Any</option>
          <option :value="true">Allowed</option>
          <option :value="false">Not Allowed</option>
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">News Trading</span>
        <select v-model="filters.news_trading_allowed">
          <option :value="null">Any</option>
          <option :value="true">Allowed</option>
          <option :value="false">Not Allowed</option>
        </select>
      </div>

      <div class="filter-group">
        <span class="filter-label">Weekend Hold</span>
        <select v-model="filters.weekend_holding">
          <option :value="null">Any</option>
          <option :value="true">Allowed</option>
          <option :value="false">Not Allowed</option>
        </select>
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <input type="checkbox" v-model="filters.no_time_limit" />
          No time limit
        </label>
      </div>

      <div class="filter-toggle">
        <label class="toggle-label">
          <input type="checkbox" v-model="filters.consistency_rule" :true-value="false" :false-value="null" />
          No consistency rule
        </label>
      </div>

      <button class="btn-reset" @click="resetFilters">Reset</button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loading" class="empty-state">Loading...</div>
      <div v-else-if="firms.length === 0" class="empty-state">
        <p>No prop firm data yet.</p>
        <p class="hint">Run <code>node scripts/scrape-propfirms.js</code> from the project root to populate.</p>
      </div>
      <div v-else-if="filtered.length === 0" class="empty-state">
        No firms match your filters. <button class="link-btn" @click="resetFilters">Reset filters</button>
      </div>
      <table v-else class="firms-table">
        <thead>
          <tr>
            <th @click="sortBy('name')" class="sortable">Firm <span class="sort-arrow" v-if="sortKey === 'name'">{{ sortAsc ? '↑' : '↓' }}</span></th>
            <th @click="sortBy('rating')" class="sortable text-right">Rating <span class="sort-arrow" v-if="sortKey === 'rating'">{{ sortAsc ? '↑' : '↓' }}</span></th>
            <th @click="sortBy('phases')" class="sortable text-right">Phases <span class="sort-arrow" v-if="sortKey === 'phases'">{{ sortAsc ? '↑' : '↓' }}</span></th>
            <th @click="sortBy('drawdown_type')" class="sortable">DD Type <span class="sort-arrow" v-if="sortKey === 'drawdown_type'">{{ sortAsc ? '↑' : '↓' }}</span></th>
            <th @click="sortBy('max_daily_loss_pct')" class="sortable text-right">Daily DD <span class="sort-arrow" v-if="sortKey === 'max_daily_loss_pct'">{{ sortAsc ? '↑' : '↓' }}</span></th>
            <th @click="sortBy('max_total_loss_pct')" class="sortable text-right">Max DD <span class="sort-arrow" v-if="sortKey === 'max_total_loss_pct'">{{ sortAsc ? '↑' : '↓' }}</span></th>
            <th @click="sortBy('profit_target_p1')" class="sortable text-right">P1 Target <span class="sort-arrow" v-if="sortKey === 'profit_target_p1'">{{ sortAsc ? '↑' : '↓' }}</span></th>
            <th @click="sortBy('profit_split_pct')" class="sortable text-right">Split <span class="sort-arrow" v-if="sortKey === 'profit_split_pct'">{{ sortAsc ? '↑' : '↓' }}</span></th>
            <th class="text-center">EA</th>
            <th class="text-center">Copy</th>
            <th class="text-center">News</th>
            <th class="text-center">Weekend</th>
            <th class="text-center">Overnight</th>
            <th class="text-center">Consistency</th>
            <th>IP Notes</th>
            <th>Platforms</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(firm, i) in filtered"
            :key="firm.id"
            :style="{ 'animation-delay': `${i * 20}ms` }"
            class="data-row"
          >
            <td class="firm-name-cell">
              <a v-if="firm.website" :href="firm.website" target="_blank" class="firm-link">{{ firm.name }}</a>
              <span v-else>{{ firm.name }}</span>
            </td>
            <td class="text-right mono">
              <span v-if="firm.rating" class="rating">{{ firm.rating.toFixed(1) }}</span>
              <span v-else class="text-ghost">—</span>
            </td>
            <td class="text-right mono">{{ firm.instant_funding ? 'Instant' : num(firm.phases) }}</td>
            <td>
              <span v-if="firm.drawdown_type" :class="['dd-chip', firm.drawdown_type === 'trailing' ? 'dd-trail' : 'dd-static']">
                {{ firm.drawdown_type }}
              </span>
              <span v-else class="text-ghost">—</span>
            </td>
            <td class="text-right mono text-red-dim">{{ pct(firm.max_daily_loss_pct) }}</td>
            <td class="text-right mono text-red-dim">{{ pct(firm.max_total_loss_pct) }}</td>
            <td class="text-right mono text-accent-dim">{{ pct(firm.profit_target_p1) }}</td>
            <td class="text-right mono">
              <span v-if="firm.profit_split_pct" class="split-val">{{ firm.profit_split_pct }}%</span>
              <span v-else class="text-ghost">—</span>
            </td>
            <td class="text-center"><span :class="['bool', boolClass(firm.ea_allowed)]">{{ boolIcon(firm.ea_allowed) }}</span></td>
            <td class="text-center"><span :class="['bool', boolClass(firm.copy_trading_allowed)]">{{ boolIcon(firm.copy_trading_allowed) }}</span></td>
            <td class="text-center"><span :class="['bool', boolClass(firm.news_trading_allowed)]">{{ boolIcon(firm.news_trading_allowed) }}</span></td>
            <td class="text-center"><span :class="['bool', boolClass(firm.weekend_holding)]">{{ boolIcon(firm.weekend_holding) }}</span></td>
            <td class="text-center"><span :class="['bool', boolClass(firm.overnight_holding)]">{{ boolIcon(firm.overnight_holding) }}</span></td>
            <td class="text-center">
              <span v-if="firm.consistency_rule === true" class="bool no" title="Has consistency rule">✗</span>
              <span v-else-if="firm.consistency_rule === false" class="bool yes" title="No consistency rule">✓</span>
              <span v-else class="bool unknown">—</span>
            </td>
            <td class="ip-cell text-ghost">{{ firm.ip_restriction_notes ? '⚠ ' + firm.ip_restriction_notes.slice(0, 40) : '—' }}</td>
            <td class="platform-cell">
              <span v-if="firm.mt4" class="plat-chip">MT4</span>
              <span v-if="firm.mt5" class="plat-chip">MT5</span>
              <span v-if="firm.ctrader" class="plat-chip">cTrader</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.compare-view {
  padding: 24px 28px;
  max-width: 1600px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

.page-header { margin-bottom: 14px; }

.page-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.page-title-row h1 {
  font-family: var(--font-ui);
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.page-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 2px 0 0;
}

.no-data-hint {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-tertiary);
}

.no-data-hint code {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--accent);
}

/* ── Filter bar ── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.search-input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  width: 180px;
  transition: border-color 0.15s;
}

.search-input:focus { outline: none; border-color: var(--accent); }

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.filter-group select {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 8px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.toggle-label input { cursor: pointer; accent-color: var(--accent); }

.btn-reset {
  padding: 5px 12px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: auto;
}

.btn-reset:hover { border-color: var(--border); color: var(--text-primary); }

/* ── Table ── */
.table-wrap {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.firms-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.firms-table th {
  padding: 9px 12px;
  text-align: left;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: var(--text-secondary); }
.sort-arrow { color: var(--accent); margin-left: 2px; }

.firms-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  white-space: nowrap;
}

.firms-table tbody tr { animation: fadeInUp 0.3s var(--ease-out) both; transition: background 0.12s; }
.firms-table tbody tr:hover { background: var(--surface-hover); }
.firms-table tbody tr:last-child td { border-bottom: none; }

.text-right   { text-align: right; }
.text-center  { text-align: center; }
.text-ghost   { color: var(--text-tertiary); }
.mono         { font-family: var(--font-mono); }
.text-red-dim    { color: rgba(255, 71, 87, 0.7); }
.text-accent-dim { color: rgba(240, 180, 41, 0.8); }

.firm-name-cell { font-weight: 600; min-width: 160px; }
.firm-link { color: var(--text-primary); text-decoration: none; }
.firm-link:hover { color: var(--accent); }

.rating {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--accent);
}

/* DD type chips */
.dd-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: capitalize;
}

.dd-trail {
  background: rgba(255, 159, 67, 0.1);
  color: var(--orange);
  border: 1px solid rgba(255, 159, 67, 0.2);
}

.dd-static {
  background: rgba(24, 220, 255, 0.08);
  color: var(--cyan);
  border: 1px solid rgba(24, 220, 255, 0.15);
}

/* Bool cells */
.bool {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
}

.bool.yes     { color: var(--green); }
.bool.no      { color: var(--red); opacity: 0.7; }
.bool.unknown { color: var(--text-tertiary); }

/* Split val */
.split-val {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--green);
}

/* Platform chips */
.platform-cell { display: flex; gap: 4px; flex-wrap: nowrap; }

.plat-chip {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  background: var(--accent-muted);
  color: var(--accent);
  border: 1px solid rgba(240, 180, 41, 0.12);
}

.ip-cell { max-width: 160px; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }

/* Empty */
.empty-state {
  text-align: center;
  padding: 52px 20px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.hint {
  margin-top: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.hint code {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--accent);
}

.link-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 12px;
  text-decoration: underline;
  padding: 0;
}

@media (max-width: 640px) {
  .compare-view { padding: 16px 12px; }
  .filter-bar { gap: 6px; }
  .search-input { width: 100%; }
}
</style>
