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
  program_types: string | null
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
  stocks: boolean | null
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

const filters = ref({
  market: '' as '' | 'forex' | 'futures',
  ea_allowed: null as boolean | null,
  copy_trading_allowed: null as boolean | null,
  news_trading_allowed: null as boolean | null,
  weekend_holding: null as boolean | null,
  consistency_rule: null as boolean | null,
  drawdown_type: '' as '' | 'trailing' | 'static',
  min_split: 0,
  max_phases: 0,
  min_rating: 0,
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

  if (filters.value.market === 'forex')   list = list.filter(f => f.forex)
  if (filters.value.market === 'futures') list = list.filter(f => f.futures)
  if (filters.value.ea_allowed !== null)
    list = list.filter(f => f.ea_allowed === filters.value.ea_allowed)
  if (filters.value.copy_trading_allowed !== null)
    list = list.filter(f => f.copy_trading_allowed === filters.value.copy_trading_allowed)
  if (filters.value.news_trading_allowed !== null)
    list = list.filter(f => f.news_trading_allowed === filters.value.news_trading_allowed)
  if (filters.value.weekend_holding !== null)
    list = list.filter(f => f.weekend_holding === filters.value.weekend_holding)
  if (filters.value.consistency_rule !== null)
    list = list.filter(f => f.consistency_rule === filters.value.consistency_rule)
  if (filters.value.drawdown_type)
    list = list.filter(f => f.drawdown_type === filters.value.drawdown_type)
  if (filters.value.min_split > 0)
    list = list.filter(f => (f.profit_split_pct ?? 0) >= filters.value.min_split)
  if (filters.value.max_phases > 0)
    list = list.filter(f => (f.phases ?? 99) <= filters.value.max_phases)
  if (filters.value.min_rating > 0)
    list = list.filter(f => (f.rating ?? 0) >= filters.value.min_rating)

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

// Counts for the market toggle
const forexCount   = computed(() => firms.value.filter(f => f.forex).length)
const futuresCount = computed(() => firms.value.filter(f => f.futures).length)

const activeFiltersCount = computed(() => {
  let n = 0
  if (filters.value.ea_allowed !== null) n++
  if (filters.value.copy_trading_allowed !== null) n++
  if (filters.value.news_trading_allowed !== null) n++
  if (filters.value.weekend_holding !== null) n++
  if (filters.value.consistency_rule !== null) n++
  if (filters.value.drawdown_type) n++
  if (filters.value.min_split > 0) n++
  if (filters.value.max_phases > 0) n++
  if (filters.value.min_rating > 0) n++
  return n
})

function resetFilters() {
  search.value = ''
  filters.value = {
    market: '',
    ea_allowed: null,
    copy_trading_allowed: null,
    news_trading_allowed: null,
    weekend_holding: null,
    consistency_rule: null,
    drawdown_type: '',
    min_split: 0,
    max_phases: 0,
    min_rating: 0,
  }
}

function sortBy(key: keyof PropFirm) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else { sortKey.value = key; sortAsc.value = false }
}

function boolIcon(v: boolean | null) { return v === true ? '✓' : v === false ? '✗' : '—' }
function boolClass(v: boolean | null) { return v === true ? 'yes' : v === false ? 'no' : 'unknown' }
function pct(v: number | null) { return v != null ? `${v}%` : '—' }
function num(v: number | null) { return v != null ? String(v) : '—' }

function rowClass(firm: PropFirm): string {
  if (firm.futures && !firm.forex) return 'row-futures'
  if (firm.forex && !firm.futures) return 'row-forex'
  return ''
}

function marketTags(firm: PropFirm): { label: string; cls: string }[] {
  const tags: { label: string; cls: string }[] = []
  if (firm.futures) tags.push({ label: 'FUT', cls: 'tag-futures' })
  if (firm.forex)   tags.push({ label: 'FX',  cls: 'tag-forex' })
  if (firm.crypto)  tags.push({ label: 'CRY', cls: 'tag-crypto' })
  if (firm.indices) tags.push({ label: 'IDX', cls: 'tag-indices' })
  return tags
}

onMounted(load)
</script>

<template>
  <div class="compare-view">

    <!-- Header -->
    <div class="page-header">
      <div class="header-top">
        <div>
          <h1 class="page-title">PROP FIRMS</h1>
          <p class="page-sub">
            {{ filtered.length }} firms
            <span v-if="firms.length !== filtered.length" class="sub-of">of {{ firms.length }}</span>
          </p>
        </div>
        <span v-if="firms.length === 0 && !loading" class="no-data-hint">
          Run <code>node scripts/scrape-propfirms.js</code> to populate
        </span>
      </div>

      <!-- Market toggle -->
      <div class="market-toggle">
        <button
          class="market-btn"
          :class="{ active: filters.market === '' }"
          @click="filters.market = ''"
        >
          ALL
          <span class="mkt-count">{{ firms.length }}</span>
        </button>
        <button
          class="market-btn market-forex"
          :class="{ active: filters.market === 'forex' }"
          @click="filters.market = filters.market === 'forex' ? '' : 'forex'"
        >
          <span class="mkt-dot dot-forex" />
          FOREX
          <span class="mkt-count">{{ forexCount }}</span>
        </button>
        <button
          class="market-btn market-futures"
          :class="{ active: filters.market === 'futures' }"
          @click="filters.market = filters.market === 'futures' ? '' : 'futures'"
        >
          <span class="mkt-dot dot-futures" />
          FUTURES
          <span class="mkt-count">{{ futuresCount }}</span>
        </button>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="filter-row">
        <input v-model="search" class="search-input" placeholder="Search..." />

        <div class="filter-group">
          <span class="filter-label">Rating</span>
          <select v-model="filters.min_rating">
            <option :value="0">Any</option>
            <option :value="4">4.0+</option>
            <option :value="4.5">4.5+</option>
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">DD Type</span>
          <select v-model="filters.drawdown_type">
            <option value="">Any</option>
            <option value="static">Static</option>
            <option value="trailing">Trailing</option>
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">Steps</span>
          <select v-model="filters.max_phases">
            <option :value="0">Any</option>
            <option :value="1">1-Step</option>
            <option :value="2">≤ 2-Step</option>
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">Split</span>
          <select v-model="filters.min_split">
            <option :value="0">Any</option>
            <option :value="80">80%+</option>
            <option :value="85">85%+</option>
            <option :value="90">90%+</option>
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">Copy</span>
          <select v-model="filters.copy_trading_allowed">
            <option :value="null">Any</option>
            <option :value="true">Allowed</option>
            <option :value="false">No</option>
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">News</span>
          <select v-model="filters.news_trading_allowed">
            <option :value="null">Any</option>
            <option :value="true">Allowed</option>
            <option :value="false">No</option>
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">Weekend</span>
          <select v-model="filters.weekend_holding">
            <option :value="null">Any</option>
            <option :value="true">Allowed</option>
            <option :value="false">No</option>
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">Consistency</span>
          <select v-model="filters.consistency_rule">
            <option :value="null">Any</option>
            <option :value="false">None</option>
            <option :value="true">Has Rule</option>
          </select>
        </div>

        <button
          class="btn-reset"
          :class="{ 'has-active': activeFiltersCount > 0 }"
          @click="resetFilters"
        >
          Reset<span v-if="activeFiltersCount > 0" class="reset-count">{{ activeFiltersCount }}</span>
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loading" class="empty-state">
        <span class="loading-dot" />
        <span class="loading-dot" />
        <span class="loading-dot" />
      </div>

      <div v-else-if="firms.length === 0" class="empty-state">
        <p class="empty-title">No prop firm data</p>
        <p class="empty-hint">Run <code>node scripts/scrape-propfirms.js</code> from the project root</p>
      </div>

      <div v-else-if="filtered.length === 0" class="empty-state">
        <p class="empty-title">No matches</p>
        <button class="link-btn" @click="resetFilters">Clear filters</button>
      </div>

      <table v-else class="firms-table">
        <thead>
          <tr>
            <th class="th-firm">
              <span @click="sortBy('name')" class="sortable">
                Firm
                <span v-if="sortKey === 'name'" class="sort-arr">{{ sortAsc ? '↑' : '↓' }}</span>
              </span>
            </th>
            <th class="th-num">
              <span @click="sortBy('rating')" class="sortable">
                Rating <span v-if="sortKey === 'rating'" class="sort-arr">{{ sortAsc ? '↑' : '↓' }}</span>
              </span>
            </th>
            <th class="th-num">
              <span @click="sortBy('phases')" class="sortable">
                Steps <span v-if="sortKey === 'phases'" class="sort-arr">{{ sortAsc ? '↑' : '↓' }}</span>
              </span>
            </th>
            <th>
              <span @click="sortBy('drawdown_type')" class="sortable">
                DD <span v-if="sortKey === 'drawdown_type'" class="sort-arr">{{ sortAsc ? '↑' : '↓' }}</span>
              </span>
            </th>
            <th class="th-num">
              <span @click="sortBy('max_daily_loss_pct')" class="sortable">
                Daily DD <span v-if="sortKey === 'max_daily_loss_pct'" class="sort-arr">{{ sortAsc ? '↑' : '↓' }}</span>
              </span>
            </th>
            <th class="th-num">
              <span @click="sortBy('max_total_loss_pct')" class="sortable">
                Max DD <span v-if="sortKey === 'max_total_loss_pct'" class="sort-arr">{{ sortAsc ? '↑' : '↓' }}</span>
              </span>
            </th>
            <th class="th-num">
              <span @click="sortBy('profit_target_p1')" class="sortable">
                Target <span v-if="sortKey === 'profit_target_p1'" class="sort-arr">{{ sortAsc ? '↑' : '↓' }}</span>
              </span>
            </th>
            <th class="th-num">
              <span @click="sortBy('profit_split_pct')" class="sortable">
                Split <span v-if="sortKey === 'profit_split_pct'" class="sort-arr">{{ sortAsc ? '↑' : '↓' }}</span>
              </span>
            </th>
            <th class="th-bool">Copy</th>
            <th class="th-bool">News</th>
            <th class="th-bool">Wknd</th>
            <th class="th-bool">Consistency</th>
            <th>Platforms</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(firm, i) in filtered"
            :key="firm.id"
            :class="['data-row', rowClass(firm)]"
            :style="{ animationDelay: `${i * 18}ms` }"
          >
            <!-- Firm name + market tags -->
            <td class="td-firm">
              <div class="firm-cell">
                <div class="firm-tags">
                  <span
                    v-for="tag in marketTags(firm)"
                    :key="tag.label"
                    :class="['mkt-tag', tag.cls]"
                  >{{ tag.label }}</span>
                </div>
                <a v-if="firm.website" :href="firm.website" target="_blank" class="firm-link">
                  {{ firm.name }}
                </a>
                <span v-else class="firm-name">{{ firm.name }}</span>
              </div>
            </td>

            <!-- Rating -->
            <td class="td-num">
              <span v-if="firm.rating != null" :class="['rating-val', firm.rating >= 4.5 ? 'rating-top' : firm.rating >= 4 ? 'rating-good' : '']">
                {{ firm.rating.toFixed(1) }}
              </span>
              <span v-else class="ghost">—</span>
            </td>

            <!-- Steps -->
            <td class="td-num mono">
              <span v-if="firm.phases != null">{{ firm.phases }}</span>
              <span v-else class="ghost">—</span>
            </td>

            <!-- DD Type -->
            <td>
              <span v-if="firm.drawdown_type" :class="['dd-chip', firm.drawdown_type === 'trailing' ? 'dd-trail' : 'dd-static']">
                {{ firm.drawdown_type === 'trailing' ? 'TRAIL' : 'STATIC' }}
              </span>
              <span v-else class="ghost">—</span>
            </td>

            <!-- Daily DD -->
            <td class="td-num mono loss-val">{{ pct(firm.max_daily_loss_pct) }}</td>

            <!-- Max DD -->
            <td class="td-num mono loss-val">{{ pct(firm.max_total_loss_pct) }}</td>

            <!-- Target -->
            <td class="td-num mono target-val">{{ pct(firm.profit_target_p1) }}</td>

            <!-- Split -->
            <td class="td-num">
              <span v-if="firm.profit_split_pct != null" :class="['split-val', firm.profit_split_pct >= 90 ? 'split-top' : '']">
                {{ firm.profit_split_pct }}%
              </span>
              <span v-else class="ghost">—</span>
            </td>

            <!-- Copy -->
            <td class="td-bool">
              <span :class="['bool-icon', boolClass(firm.copy_trading_allowed)]">{{ boolIcon(firm.copy_trading_allowed) }}</span>
            </td>

            <!-- News -->
            <td class="td-bool">
              <span :class="['bool-icon', boolClass(firm.news_trading_allowed)]">{{ boolIcon(firm.news_trading_allowed) }}</span>
            </td>

            <!-- Weekend -->
            <td class="td-bool">
              <span :class="['bool-icon', boolClass(firm.weekend_holding)]">{{ boolIcon(firm.weekend_holding) }}</span>
            </td>

            <!-- Consistency (inverted: ✓ means no rule = good) -->
            <td class="td-bool">
              <span v-if="firm.consistency_rule === false" class="bool-icon yes" title="No consistency rule">✓</span>
              <span v-else-if="firm.consistency_rule === true" class="bool-icon no" title="Has consistency rule">✗</span>
              <span v-else class="bool-icon unknown">—</span>
            </td>

            <!-- Platforms -->
            <td class="td-plat">
              <span v-if="firm.mt4"     class="plat-chip">MT4</span>
              <span v-if="firm.mt5"     class="plat-chip">MT5</span>
              <span v-if="firm.ctrader" class="plat-chip">cT</span>
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
  animation: fadeInUp 0.3s var(--ease-out);
}

/* ── Header ── */
.page-header { margin-bottom: 16px; }

.header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.page-title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-primary);
  margin: 0;
}

.page-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 3px 0 0;
}

.sub-of { opacity: 0.6; }

.no-data-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.no-data-hint code {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--accent);
}

/* ── Market toggle ── */
.market-toggle {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 0;
}

.market-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}

.market-btn:hover { color: var(--text-secondary); }

.market-btn.active { color: var(--text-primary); border-bottom-color: var(--accent); }

.market-forex.active  { color: var(--cyan); border-bottom-color: var(--cyan); }
.market-futures.active { color: var(--orange); border-bottom-color: var(--orange); }

.mkt-count {
  font-size: 9px;
  font-weight: 400;
  opacity: 0.6;
  margin-left: 2px;
}

.mkt-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.dot-forex   { background: var(--cyan); }
.dot-futures { background: var(--orange); }

/* ── Filter bar ── */
.filter-bar {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin-bottom: 12px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.search-input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  width: 160px;
  transition: border-color 0.15s;
}

.search-input:focus { outline: none; border-color: var(--accent); }

.filter-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

.filter-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.filter-group select {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 7px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.btn-reset {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  padding: 4px 11px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-reset:hover { color: var(--text-primary); border-color: var(--border); }

.btn-reset.has-active { border-color: var(--accent); color: var(--accent); }

.reset-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  color: #000;
  font-size: 9px;
  font-weight: 700;
}

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

.th-num { text-align: right; }
.th-bool { text-align: center; }

.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.12s;
}

.sortable:hover { color: var(--text-secondary); }
.sort-arr { color: var(--accent); margin-left: 2px; }

.firms-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  white-space: nowrap;
}

.firms-table tbody tr {
  animation: fadeInUp 0.28s var(--ease-out) both;
  transition: background 0.1s;
  border-left: 2px solid transparent;
}

.firms-table tbody tr:hover { background: var(--surface-hover); }
.firms-table tbody tr:last-child td { border-bottom: none; }

/* Row market tint + left border */
.row-forex {
  border-left-color: rgba(24, 220, 255, 0.4) !important;
}

.row-futures {
  border-left-color: rgba(255, 159, 67, 0.4) !important;
}

/* ── Firm cell ── */
.td-firm { min-width: 200px; }

.firm-cell {
  display: flex;
  align-items: center;
  gap: 7px;
}

.firm-tags {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.mkt-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 4px;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.tag-forex {
  background: rgba(24, 220, 255, 0.1);
  color: var(--cyan);
  border: 1px solid rgba(24, 220, 255, 0.2);
}

.tag-futures {
  background: rgba(255, 159, 67, 0.1);
  color: var(--orange);
  border: 1px solid rgba(255, 159, 67, 0.2);
}

.tag-crypto {
  background: rgba(160, 120, 255, 0.08);
  color: #a078ff;
  border: 1px solid rgba(160, 120, 255, 0.15);
}

.tag-indices {
  background: rgba(100, 210, 140, 0.08);
  color: rgba(100, 210, 140, 0.9);
  border: 1px solid rgba(100, 210, 140, 0.15);
}

.firm-link {
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 600;
  font-size: 12px;
  transition: color 0.12s;
}

.firm-link:hover { color: var(--accent); }

.firm-name {
  font-weight: 600;
  font-size: 12px;
}

/* ── Data cells ── */
.td-num  { text-align: right; }
.td-bool { text-align: center; }
.td-plat { display: flex; gap: 4px; flex-wrap: nowrap; min-width: 80px; }

.mono { font-family: var(--font-mono); }
.ghost { color: var(--text-tertiary); }

.rating-val {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-secondary);
}
.rating-good { color: var(--accent); }
.rating-top  { color: var(--green); }

.dd-chip {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.dd-trail {
  background: rgba(255, 159, 67, 0.1);
  color: var(--orange);
  border: 1px solid rgba(255, 159, 67, 0.2);
}

.dd-static {
  background: rgba(24, 220, 255, 0.07);
  color: var(--cyan);
  border: 1px solid rgba(24, 220, 255, 0.14);
}

.loss-val   { color: rgba(255, 71, 87, 0.65); }
.target-val { color: rgba(240, 180, 41, 0.75); }

.split-val {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--green);
}

.split-top { color: #2ecc71; }

.bool-icon {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
}

.bool-icon.yes     { color: var(--green); }
.bool-icon.no      { color: var(--red); opacity: 0.65; }
.bool-icon.unknown { color: var(--text-tertiary); }

.plat-chip {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  background: rgba(240, 180, 41, 0.08);
  color: var(--accent);
  border: 1px solid rgba(240, 180, 41, 0.12);
}

/* ── Empty / Loading ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 56px 20px;
  color: var(--text-tertiary);
}

.empty-title {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

.empty-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}

.empty-hint code {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--accent);
}

/* Loading dots */
.loading-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: dot-pulse 1.2s ease-in-out infinite;
  flex-direction: row;
}

.empty-state { flex-direction: row; gap: 5px; }

.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
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
  .filter-row { gap: 6px; }
  .search-input { width: 100%; }
  .market-btn { padding: 7px 10px; font-size: 10px; }
}
</style>
