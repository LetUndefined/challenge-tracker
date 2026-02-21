<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useChallenges } from '@/composables/useChallenges'

interface HistoryEntry {
  id: string
  challenge_id: string | null
  alias: string
  prop_firm: string
  phase: string
  outcome: 'Passed' | 'Failed' | 'Abandoned'
  starting_balance: number
  final_balance: number
  payout_received: number
  started_at: string | null
  ended_at: string | null
  duration_days: number | null
  notes: string | null
  created_at: string
}

const { challengeRows, fetchChallenges } = useChallenges()

const entries = ref<HistoryEntry[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingEntry = ref<HistoryEntry | null>(null)
const suggestions = ref<HistoryEntry[]>([])

const form = ref({
  challenge_id: '',
  alias: '',
  prop_firm: '',
  phase: '',
  outcome: 'Passed' as 'Passed' | 'Failed' | 'Abandoned',
  starting_balance: '',
  final_balance: '',
  payout_received: '',
  started_at: '',
  ended_at: '',
  notes: '',
})

async function load() {
  loading.value = true
  const { data } = await supabase
    .from('challenge_history')
    .select('*')
    .order('ended_at', { ascending: false })
  entries.value = data ?? []
  loading.value = false
}

// Auto-detect suggestions from current challenges
function buildSuggestions() {
  const s: HistoryEntry[] = []
  for (const row of challengeRows.value) {
    if (row.is_master) continue
    if (row.target_pct > 0 && row.progress >= row.target_pct) {
      s.push({
        id: '',
        challenge_id: row.id,
        alias: row.alias,
        prop_firm: row.prop_firm,
        phase: row.phase,
        outcome: 'Passed',
        starting_balance: row.starting_balance,
        final_balance: row.balance,
        payout_received: 0,
        started_at: row.started_at ?? null,
        ended_at: new Date().toISOString().slice(0, 10),
        duration_days: null,
        notes: null,
        created_at: '',
      })
    }
  }
  // Filter out already logged ones
  const loggedIds = new Set(entries.value.map(e => e.challenge_id).filter(Boolean))
  suggestions.value = s.filter(s => !loggedIds.has(s.challenge_id))
}

function openAdd(prefill?: Partial<typeof form.value>) {
  editingEntry.value = null
  form.value = {
    challenge_id: prefill?.challenge_id ?? '',
    alias: prefill?.alias ?? '',
    prop_firm: prefill?.prop_firm ?? '',
    phase: prefill?.phase ?? '',
    outcome: (prefill?.outcome as any) ?? 'Passed',
    starting_balance: prefill?.starting_balance ?? '',
    final_balance: prefill?.final_balance ?? '',
    payout_received: prefill?.payout_received ?? '',
    started_at: prefill?.started_at ?? '',
    ended_at: prefill?.ended_at ?? new Date().toISOString().slice(0, 10),
    notes: prefill?.notes ?? '',
  }
  showModal.value = true
}

function openEdit(entry: HistoryEntry) {
  editingEntry.value = entry
  form.value = {
    challenge_id: entry.challenge_id ?? '',
    alias: entry.alias,
    prop_firm: entry.prop_firm,
    phase: entry.phase,
    outcome: entry.outcome,
    starting_balance: entry.starting_balance ? String(entry.starting_balance) : '',
    final_balance: entry.final_balance ? String(entry.final_balance) : '',
    payout_received: entry.payout_received ? String(entry.payout_received) : '',
    started_at: entry.started_at ?? '',
    ended_at: entry.ended_at ?? '',
    notes: entry.notes ?? '',
  }
  showModal.value = true
}

function onChallengeSelect() {
  const row = challengeRows.value.find(r => r.id === form.value.challenge_id)
  if (!row) return
  form.value.alias = row.alias
  form.value.prop_firm = row.prop_firm
  form.value.phase = row.phase
  form.value.starting_balance = String(row.starting_balance)
  form.value.final_balance = String(row.balance)
  if (row.started_at) form.value.started_at = row.started_at.slice(0, 10)
}

async function save() {
  const payload = {
    challenge_id: form.value.challenge_id || null,
    alias: form.value.alias,
    prop_firm: form.value.prop_firm,
    phase: form.value.phase,
    outcome: form.value.outcome,
    starting_balance: parseFloat(form.value.starting_balance) || 0,
    final_balance: parseFloat(form.value.final_balance) || 0,
    payout_received: parseFloat(form.value.payout_received) || 0,
    started_at: form.value.started_at || null,
    ended_at: form.value.ended_at || null,
    notes: form.value.notes || null,
  }

  if (editingEntry.value) {
    const { data } = await supabase
      .from('challenge_history')
      .update(payload)
      .eq('id', editingEntry.value.id)
      .select()
      .single()
    if (data) {
      const idx = entries.value.findIndex(e => e.id === editingEntry.value!.id)
      if (idx !== -1) entries.value[idx] = data
    }
  } else {
    const { data } = await supabase
      .from('challenge_history')
      .insert(payload)
      .select()
      .single()
    if (data) entries.value.unshift(data)
  }
  showModal.value = false
  buildSuggestions()
}

async function deleteEntry(id: string) {
  if (!confirm('Delete this history entry?')) return
  await supabase.from('challenge_history').delete().eq('id', id)
  entries.value = entries.value.filter(e => e.id !== id)
}

function outcomeClass(o: string) {
  if (o === 'Passed') return 'outcome-passed'
  if (o === 'Failed') return 'outcome-failed'
  return 'outcome-abandoned'
}

function fmt(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const stats = computed(() => {
  const passed   = entries.value.filter(e => e.outcome === 'Passed').length
  const failed   = entries.value.filter(e => e.outcome === 'Failed').length
  const total    = entries.value.length
  const payout   = entries.value.reduce((s, e) => s + (e.payout_received ?? 0), 0)
  const passRate = total > 0 ? Math.round(passed / total * 100) : 0
  const avgDur   = (() => {
    const valid = entries.value.filter(e => e.duration_days !== null)
    if (!valid.length) return null
    return Math.round(valid.reduce((s, e) => s + e.duration_days!, 0) / valid.length)
  })()
  return { passed, failed, total, payout, passRate, avgDur }
})

onMounted(async () => {
  await fetchChallenges()
  await load()
  buildSuggestions()
})
</script>

<template>
  <div class="history-view">
    <div class="page-header">
      <div class="page-title-row">
        <h1>Challenge History</h1>
        <button class="btn-add" @click="openAdd()">+ Log Outcome</button>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="stats-strip" v-if="entries.length > 0">
      <div class="stat-cell">
        <div class="stat-label">TOTAL</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-divider" />
      <div class="stat-cell">
        <div class="stat-label">PASSED</div>
        <div class="stat-value green">{{ stats.passed }}</div>
      </div>
      <div class="stat-divider" />
      <div class="stat-cell">
        <div class="stat-label">FAILED</div>
        <div class="stat-value red">{{ stats.failed }}</div>
      </div>
      <div class="stat-divider" />
      <div class="stat-cell">
        <div class="stat-label">PASS RATE</div>
        <div class="stat-value" :class="stats.passRate >= 50 ? 'green' : 'red'">{{ stats.passRate }}%</div>
      </div>
      <div class="stat-divider" />
      <div class="stat-cell">
        <div class="stat-label">TOTAL PAYOUT</div>
        <div class="stat-value cyan">{{ fmt(stats.payout) }}</div>
      </div>
      <div class="stat-divider" v-if="stats.avgDur !== null" />
      <div class="stat-cell" v-if="stats.avgDur !== null">
        <div class="stat-label">AVG DURATION</div>
        <div class="stat-value">{{ stats.avgDur }}d</div>
      </div>
    </div>

    <!-- Auto-detected suggestions -->
    <div class="suggestions" v-if="suggestions.length > 0">
      <div class="suggestions-header">
        <span class="suggest-icon">⚡</span>
        <span>Auto-detected outcomes — confirm to log</span>
      </div>
      <div
        v-for="s in suggestions"
        :key="s.challenge_id!"
        class="suggestion-row"
      >
        <span :class="['outcome-chip', outcomeClass(s.outcome)]">{{ s.outcome }}</span>
        <span class="suggest-alias">{{ s.alias }}</span>
        <span class="suggest-meta">{{ s.prop_firm }} · {{ s.phase }}</span>
        <span class="suggest-note">{{ s.notes }}</span>
        <button class="btn-confirm" @click="openAdd({
          challenge_id: s.challenge_id!,
          alias: s.alias,
          prop_firm: s.prop_firm,
          phase: s.phase,
          outcome: s.outcome,
          starting_balance: String(s.starting_balance),
          final_balance: String(s.final_balance),
          started_at: s.started_at ?? '',
          ended_at: s.ended_at ?? '',
          notes: s.notes ?? '',
        })">Log</button>
      </div>
    </div>

    <!-- History table -->
    <div class="table-wrap">
      <div v-if="loading" class="empty-state">Loading...</div>
      <div v-else-if="entries.length === 0" class="empty-state">
        No history yet. Log your first outcome above.
      </div>
      <table v-else class="history-table">
        <thead>
          <tr>
            <th>Outcome</th>
            <th>Account</th>
            <th>Prop Firm</th>
            <th>Phase</th>
            <th class="text-right">Starting</th>
            <th class="text-right">Final</th>
            <th class="text-right">Payout</th>
            <th>Started</th>
            <th>Ended</th>
            <th class="text-right">Days</th>
            <th>Notes</th>
            <th class="th-actions" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(entry, i) in entries"
            :key="entry.id"
            :style="{ 'animation-delay': `${i * 25}ms` }"
            class="data-row"
          >
            <td>
              <span :class="['outcome-chip', outcomeClass(entry.outcome)]">{{ entry.outcome }}</span>
            </td>
            <td class="alias-cell">{{ entry.alias }}</td>
            <td class="text-secondary">{{ entry.prop_firm }}</td>
            <td class="text-secondary">{{ entry.phase }}</td>
            <td class="text-right mono">{{ entry.starting_balance > 0 ? fmt(entry.starting_balance) : '—' }}</td>
            <td class="text-right mono">{{ entry.final_balance > 0 ? fmt(entry.final_balance) : '—' }}</td>
            <td class="text-right mono" :class="entry.payout_received > 0 ? 'text-green' : ''">
              {{ entry.payout_received > 0 ? fmt(entry.payout_received) : '—' }}
            </td>
            <td class="text-ghost mono-sm">{{ entry.started_at ?? '—' }}</td>
            <td class="text-ghost mono-sm">{{ entry.ended_at ?? '—' }}</td>
            <td class="text-right mono">{{ entry.duration_days ?? '—' }}</td>
            <td class="text-ghost notes-cell">{{ entry.notes ?? '' }}</td>
            <td>
              <div class="row-actions">
                <button class="btn-edit" @click="openEdit(entry)" title="Edit">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-delete" @click="deleteEntry(entry.id)" title="Delete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-header">
            <span>{{ editingEntry ? 'Edit Entry' : 'Log Outcome' }}</span>
            <button class="modal-close" @click="showModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>Link to Challenge (optional)</label>
              <select v-model="form.challenge_id" @change="onChallengeSelect">
                <option value="">— None —</option>
                <option v-for="row in challengeRows.filter(r => !r.is_master)" :key="row.id" :value="row.id">
                  {{ row.alias }} · {{ row.prop_firm }} · {{ row.phase }}
                </option>
              </select>
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>Account Alias *</label>
                <input v-model="form.alias" placeholder="e.g. FTMO-001" />
              </div>
              <div class="form-row">
                <label>Prop Firm *</label>
                <input v-model="form.prop_firm" placeholder="e.g. FTMO" />
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>Phase *</label>
                <input v-model="form.phase" placeholder="e.g. Phase 1" />
              </div>
              <div class="form-row">
                <label>Outcome *</label>
                <select v-model="form.outcome">
                  <option>Passed</option>
                  <option>Failed</option>
                  <option>Abandoned</option>
                </select>
              </div>
            </div>
            <div class="form-grid-3">
              <div class="form-row">
                <label>Starting Balance</label>
                <input v-model="form.starting_balance" type="number" placeholder="10000" />
              </div>
              <div class="form-row">
                <label>Final Balance</label>
                <input v-model="form.final_balance" type="number" placeholder="11000" />
              </div>
              <div class="form-row">
                <label>Payout Received</label>
                <input v-model="form.payout_received" type="number" placeholder="0" />
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-row">
                <label>Started</label>
                <input v-model="form.started_at" type="date" />
              </div>
              <div class="form-row">
                <label>Ended</label>
                <input v-model="form.ended_at" type="date" />
              </div>
            </div>
            <div class="form-row">
              <label>Notes</label>
              <textarea v-model="form.notes" rows="2" placeholder="Optional notes..." />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showModal = false">Cancel</button>
            <button class="btn-save" @click="save">{{ editingEntry ? 'Save' : 'Log' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.history-view {
  padding: 24px 28px;
  max-width: 1440px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

.page-header {
  margin-bottom: 16px;
}

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

.btn-add {
  padding: 7px 16px;
  background: var(--accent-muted);
  border: 1px solid rgba(240, 180, 41, 0.2);
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-add:hover {
  background: rgba(240, 180, 41, 0.15);
  border-color: rgba(240, 180, 41, 0.35);
}

/* ── Stats strip ── */
.stats-strip {
  display: flex;
  align-items: stretch;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: 14px;
  overflow: hidden;
}

.stat-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 14px 18px;
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
}

.stat-value.green  { color: var(--green); }
.stat-value.red    { color: var(--red); }
.stat-value.cyan   { color: var(--cyan); }

.stat-divider {
  width: 1px;
  background: var(--border-subtle);
  margin: 10px 0;
  flex-shrink: 0;
}

/* ── Suggestions ── */
.suggestions {
  background: var(--surface);
  border: 1px solid rgba(240, 180, 41, 0.15);
  border-radius: var(--radius-md);
  margin-bottom: 14px;
  overflow: hidden;
}

.suggestions-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--accent-muted);
}

.suggestion-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
}

.suggestion-row:last-child { border-bottom: none; }

.suggest-alias {
  font-weight: 600;
  color: var(--text-primary);
}

.suggest-meta {
  color: var(--text-secondary);
  font-size: 12px;
}

.suggest-note {
  color: var(--text-tertiary);
  font-size: 11px;
  font-family: var(--font-mono);
  flex: 1;
}

.btn-confirm {
  padding: 4px 12px;
  background: var(--accent-muted);
  border: 1px solid rgba(240, 180, 41, 0.2);
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

/* ── Table ── */
.table-wrap {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.history-table th {
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
}

.history-table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  white-space: nowrap;
}

.history-table tbody tr:last-child td { border-bottom: none; }
.history-table tbody tr { animation: fadeInUp 0.3s var(--ease-out) both; transition: background 0.12s; }
.history-table tbody tr:hover { background: var(--surface-hover); }

.text-right { text-align: right; }
.text-secondary { color: var(--text-secondary); }
.text-ghost { color: var(--text-tertiary); }
.text-green { color: var(--green); font-weight: 600; }
.mono { font-family: var(--font-mono); font-size: 12px; }
.mono-sm { font-family: var(--font-mono); font-size: 11px; }
.th-actions { width: 60px; }

.alias-cell { font-weight: 600; }
.notes-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }

/* ── Outcome chips ── */
.outcome-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.outcome-passed {
  background: rgba(0, 230, 118, 0.12);
  color: var(--green);
  border: 1px solid rgba(0, 230, 118, 0.25);
}

.outcome-failed {
  background: rgba(255, 71, 87, 0.1);
  color: var(--red);
  border: 1px solid rgba(255, 71, 87, 0.2);
}

.outcome-abandoned {
  background: rgba(255, 159, 67, 0.08);
  color: var(--orange);
  border: 1px solid rgba(255, 159, 67, 0.2);
}

/* ── Row actions ── */
.row-actions { display: flex; align-items: center; gap: 4px; }

.btn-edit, .btn-delete {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-edit:hover  { background: var(--purple-muted); border-color: rgba(165, 94, 234, 0.2); color: var(--purple); }
.btn-delete:hover { background: var(--red-muted); border-color: rgba(255, 71, 87, 0.2); color: var(--red); }

/* ── Empty ── */
.empty-state {
  text-align: center;
  padding: 52px 20px;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* ── Modal ── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  animation: fadeInUp 0.2s var(--ease-out);
}

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  background: none; border: none;
  color: var(--text-tertiary); cursor: pointer; font-size: 14px;
  padding: 2px 6px;
}

.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }

.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

.form-row label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

.form-row input,
.form-row select,
.form-row textarea {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.modal-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
}

.btn-cancel {
  padding: 7px 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
}

.btn-save {
  padding: 7px 20px;
  background: var(--accent-muted);
  border: 1px solid rgba(240, 180, 41, 0.25);
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-save:hover {
  background: rgba(240, 180, 41, 0.15);
}

@media (max-width: 640px) {
  .history-view { padding: 16px 12px; }
  .form-grid-2, .form-grid-3 { grid-template-columns: 1fr; }
  .stats-strip { flex-wrap: wrap; }
  .stat-cell { flex: 1 1 45%; border-bottom: 1px solid var(--border-subtle); }
  .stat-divider { display: none; }
}
</style>
