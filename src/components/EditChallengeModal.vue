<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ChallengeRow } from '@/types'
import { useChallenges } from '@/composables/useChallenges'
import { propFirms } from '@/lib/propFirms'

const props = defineProps<{
  show: boolean
  row: ChallengeRow | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { updateChallenge } = useChallenges()

const alias = ref('')
const owner = ref('')
const phase = ref<'Phase 1' | 'Phase 2' | 'Funded' | 'Master'>('Phase 1')
const propFirm = ref('')
const targetPct = ref(0)
const startingBalance = ref(0)
const cost = ref<number | ''>('')
const dailyDdPct = ref<number | ''>('')
const maxDdPct = ref<number | ''>('')
const saving = ref(false)
const errorMsg = ref('')

// Pre-fill when row changes or modal opens
watch(() => props.row, (row) => {
  if (!row) return
  alias.value = row.alias
  owner.value = row.owner
  phase.value = row.phase as any
  propFirm.value = row.prop_firm
  targetPct.value = row.target_pct
  startingBalance.value = row.starting_balance
  cost.value = row.cost > 0 ? row.cost : ''
  dailyDdPct.value = row.daily_dd_pct !== null ? row.daily_dd_pct : ''
  maxDdPct.value = row.max_dd_pct !== null ? row.max_dd_pct : ''
}, { immediate: true })

// Auto-fill target/DD when prop firm + phase changes
watch([propFirm, phase], () => {
  if (phase.value === 'Master') {
    targetPct.value = 0
    return
  }
  const firm = propFirms.find(f => f.name === propFirm.value)
  if (firm) {
    const phaseConfig = firm.phases.find(p => p.name === phase.value)
    if (phaseConfig) {
      targetPct.value = phaseConfig.target_pct
      dailyDdPct.value = phaseConfig.daily_dd_pct
      maxDdPct.value = phaseConfig.max_dd_pct
    }
  }
})

async function handleSubmit() {
  if (!props.row) return
  saving.value = true
  errorMsg.value = ''
  try {
    await updateChallenge(props.row.id, {
      alias: alias.value,
      owner: owner.value,
      phase: phase.value,
      prop_firm: phase.value === 'Master' ? 'Master' : propFirm.value,
      target_pct: targetPct.value,
      starting_balance: startingBalance.value > 0 ? startingBalance.value : undefined,
      cost: cost.value !== '' ? Number(cost.value) : 0,
      daily_dd_pct: dailyDdPct.value !== '' ? Number(dailyDdPct.value) : null,
      max_dd_pct: maxDdPct.value !== '' ? Number(maxDdPct.value) : null,
    })
    emit('saved')
    emit('close')
  } catch (e: any) {
    errorMsg.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show && row" class="modal-overlay" @click.self="emit('close')">
        <div class="modal">
          <div class="modal-accent" />
          <div class="modal-header">
            <div class="modal-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <h2>Edit Challenge</h2>
            </div>
            <button class="btn-close" @click="emit('close')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <form class="modal-body" @submit.prevent="handleSubmit">
            <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

            <div class="account-info">
              <span class="account-label">Account</span>
              <span class="account-value">{{ row.alias }} · {{ row.login_number }}</span>
            </div>

            <div class="form-group">
              <label>Alias</label>
              <input v-model="alias" type="text" class="form-input" placeholder="e.g. FTMO 100k #1" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Phase / Type</label>
                <select v-model="phase" class="form-input">
                  <option value="Phase 1">Phase 1</option>
                  <option value="Phase 2">Phase 2</option>
                  <option value="Funded">Funded</option>
                  <option value="Master">Master</option>
                </select>
              </div>
              <div class="form-group" v-if="phase !== 'Master'">
                <label>Prop Firm</label>
                <select v-model="propFirm" class="form-input">
                  <option value="" disabled>Select...</option>
                  <option v-for="f in propFirms" :key="f.id" :value="f.name">{{ f.name }}</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Starting Balance ($)</label>
                <input v-model.number="startingBalance" type="number" step="0.01" min="0" class="form-input" />
              </div>
              <div class="form-group">
                <label>Account Cost ($)</label>
                <input v-model="cost" type="number" step="0.01" min="0" class="form-input" placeholder="e.g. 549" />
              </div>
            </div>

            <div class="form-row" v-if="phase !== 'Master'">
              <div class="form-group">
                <label>Daily DD %</label>
                <input v-model="dailyDdPct" type="number" step="0.5" min="0" class="form-input" placeholder="e.g. 5" />
              </div>
              <div class="form-group">
                <label>Max DD %</label>
                <input v-model="maxDdPct" type="number" step="0.5" min="0" class="form-input" placeholder="e.g. 10" />
              </div>
            </div>

            <div class="form-row" v-if="phase !== 'Master'">
              <div class="form-group">
                <label>Target %</label>
                <input v-model.number="targetPct" type="number" step="0.5" min="0" class="form-input" />
              </div>
              <div class="form-group">
                <label>Owner</label>
                <input v-model="owner" type="text" class="form-input" placeholder="Trader name" />
              </div>
            </div>

            <div class="form-group" v-if="phase === 'Master'">
              <label>Owner</label>
              <input v-model="owner" type="text" class="form-input" placeholder="Trader name" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" @click="emit('close')">Cancel</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 1000;
}

.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal { animation: slideDown 0.3s var(--ease-out); }

.modal {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--purple) 0%, transparent 100%);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  opacity: 0.5;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--purple);
}

.modal-title h2 {
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.btn-close {
  width: 30px;
  height: 30px;
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

.btn-close:hover {
  background: var(--surface-hover);
  color: var(--text-secondary);
}

.modal-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.account-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.account-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  flex-shrink: 0;
}

.account-value {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.error-msg {
  padding: 8px 12px;
  background: var(--red-muted);
  border: 1px solid rgba(255, 71, 87, 0.2);
  border-radius: var(--radius-sm);
  color: var(--red);
  font-size: 12px;
  font-family: var(--font-mono);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.form-group label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.form-input {
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-input:focus {
  border-color: var(--purple);
  box-shadow: 0 0 0 1px var(--purple-muted);
}

.form-row {
  display: flex;
  gap: 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
}

.btn-secondary {
  padding: 8px 18px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn-primary {
  padding: 8px 20px;
  background: var(--purple);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-primary:hover {
  opacity: 0.9;
  box-shadow: 0 2px 12px var(--purple-muted);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .modal {
    width: 100%;
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
    height: 100vh;
  }

  .modal-accent {
    border-radius: 0;
  }

  .form-row {
    flex-direction: column;
    gap: 16px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-header {
    padding: 14px 16px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .modal-footer button {
    width: 100%;
    justify-content: center;
    padding: 12px;
  }
}
</style>
