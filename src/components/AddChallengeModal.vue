<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MetaCopierAccount, PropFirmConfig } from '@/types'
import { useChallenges } from '@/composables/useChallenges'

const props = defineProps<{
  show: boolean
  unlinkedAccounts: MetaCopierAccount[]
}>()

const emit = defineEmits<{
  close: []
  added: []
}>()

const { addChallenge, guessProFirm, guessPlatform } = useChallenges()

const selectedAccountId = ref('')
const alias = ref('')
const propFirm = ref('')
const phase = ref<'Phase 1' | 'Phase 2' | 'Funded'>('Phase 1')
const targetPct = ref(8)
const owner = ref('')
const isMaster = ref(false)
const cost = ref(0)
const saving = ref(false)
const errorMsg = ref('')

const propFirms: PropFirmConfig[] = [
  { id: '1', name: 'FTMO', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '2', name: 'The 5%ers', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '3', name: 'FundedHive', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 8 },
  ]},
  { id: '4', name: 'FundedNext', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '5', name: 'MyFundedFX', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 12 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 12 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 12 },
  ]},
  { id: '6', name: 'E8 Funding', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 8 },
  ]},
  { id: '7', name: 'Alpha Capital', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
]

const selectedAccount = computed(() =>
  props.unlinkedAccounts.find(a => a.id === selectedAccountId.value)
)

watch(selectedAccountId, (id) => {
  const acc = props.unlinkedAccounts.find(a => a.id === id)
  if (!acc) return
  alias.value = acc.name || acc.login
  const guessed = guessProFirm(acc.server)
  if (guessed !== 'Unknown') propFirm.value = guessed
  const firm = propFirms.find(f => f.name === propFirm.value)
  if (firm) {
    const phaseConfig = firm.phases.find(p => p.name === phase.value)
    if (phaseConfig) targetPct.value = phaseConfig.target_pct
  }
})

watch([propFirm, phase], () => {
  const firm = propFirms.find(f => f.name === propFirm.value)
  if (firm) {
    const phaseConfig = firm.phases.find(p => p.name === phase.value)
    if (phaseConfig) targetPct.value = phaseConfig.target_pct
  }
})

async function handleSubmit() {
  if (!selectedAccountId.value) { errorMsg.value = 'Select an account'; return }
  if (!isMaster.value && !propFirm.value) { errorMsg.value = 'Select a prop firm'; return }
  const acc = selectedAccount.value!
  saving.value = true
  errorMsg.value = ''
  try {
    await addChallenge({
      metacopier_account_id: acc.id,
      alias: alias.value,
      prop_firm: isMaster.value ? 'Master' : propFirm.value,
      phase: isMaster.value ? 'Funded' : phase.value,
      platform: guessPlatform(acc),
      target_pct: isMaster.value ? 0 : targetPct.value,
      owner: owner.value,
      login_number: acc.login,
      login_server: acc.server,
      is_master: isMaster.value,
      cost: cost.value,
    })
    emit('added')
    emit('close')
    resetForm()
  } catch (e: any) {
    errorMsg.value = e.message
  } finally {
    saving.value = false
  }
}

function resetForm() {
  selectedAccountId.value = ''
  alias.value = ''
  propFirm.value = ''
  phase.value = 'Phase 1'
  targetPct.value = 8
  owner.value = ''
  isMaster.value = false
  cost.value = 0
  errorMsg.value = ''
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="emit('close')">
        <div class="modal">
          <div class="modal-accent" />
          <div class="modal-header">
            <div class="modal-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <h2>Add Challenge</h2>
            </div>
            <button class="btn-close" @click="emit('close')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <form class="modal-body" @submit.prevent="handleSubmit">
            <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

            <div class="form-group">
              <label>MetaCopier Account</label>
              <select v-model="selectedAccountId" class="form-input">
                <option value="" disabled>Select an account...</option>
                <option v-for="acc in unlinkedAccounts" :key="acc.id" :value="acc.id">
                  {{ acc.name || acc.login }} / {{ acc.server }} ({{ acc.platform }})
                </option>
              </select>
              <p v-if="unlinkedAccounts.length === 0" class="form-hint">
                All MetaCopier accounts are already tracked.
              </p>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Alias</label>
                <input v-model="alias" type="text" class="form-input" placeholder="e.g. FTMO 100k #1" />
              </div>
              <div class="form-group">
                <label>Owner</label>
                <input v-model="owner" type="text" class="form-input" placeholder="Trader name" />
              </div>
            </div>

            <label class="toggle-row">
              <input type="checkbox" v-model="isMaster" class="toggle-input" />
              <span class="toggle-switch" />
              <span class="toggle-label">Master Account</span>
              <span class="toggle-hint">Demo / copier source — excluded from analytics</span>
            </label>

            <template v-if="!isMaster">
              <div class="form-row">
                <div class="form-group">
                  <label>Prop Firm</label>
                  <select v-model="propFirm" class="form-input">
                    <option value="" disabled>Select...</option>
                    <option v-for="f in propFirms" :key="f.id" :value="f.name">{{ f.name }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Phase</label>
                  <select v-model="phase" class="form-input">
                    <option value="Phase 1">Phase 1</option>
                    <option value="Phase 2">Phase 2</option>
                    <option value="Funded">Funded</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Target %</label>
                  <input v-model.number="targetPct" type="number" step="0.5" min="0" class="form-input" />
                </div>
                <div class="form-group">
                  <label>Cost ($)</label>
                  <input v-model.number="cost" type="number" step="1" min="0" class="form-input" placeholder="0" />
                </div>
              </div>
            </template>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" @click="emit('close')">Cancel</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Adding...' : 'Add Challenge' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ─── Overlay ─── */
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

/* ─── Transitions ─── */
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal { animation: slideDown 0.3s var(--ease-out); }

/* ─── Modal ─── */
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
  background: linear-gradient(90deg, var(--accent) 0%, transparent 100%);
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
  color: var(--accent);
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

/* ─── Form ─── */
.modal-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-muted);
}

.form-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}

.form-row {
  display: flex;
  gap: 12px;
}

/* ─── Master toggle ─── */
.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.15s;
  flex-wrap: wrap;
}

.toggle-row:hover {
  border-color: var(--border);
}

.toggle-input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 34px;
  height: 18px;
  background: var(--border);
  border-radius: 9px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: var(--text-tertiary);
  border-radius: 50%;
  transition: transform 0.2s, background 0.2s;
}

.toggle-input:checked + .toggle-switch {
  background: var(--orange-muted);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(16px);
  background: var(--orange);
}

.toggle-label {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-hint {
  font-family: var(--font-ui);
  font-size: 11px;
  color: var(--text-tertiary);
  width: 100%;
  padding-left: 44px;
  margin-top: -4px;
}

/* ─── Footer ─── */
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
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--bg);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}

.btn-primary:hover {
  background: var(--accent-bright);
  box-shadow: 0 2px 12px var(--accent-muted);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ─── Mobile ─── */
@media (max-width: 768px) {
  .modal {
    width: 100%;
    max-width: 100%;
    max-height: 100%;
    height: 100%;
    border-radius: 0;
    border: none;
  }

  .modal-accent {
    border-radius: 0;
  }

  .modal-body {
    padding: 16px;
  }

  .form-row {
    flex-direction: column;
    gap: 14px;
  }

  .modal-header {
    padding: 14px 16px;
  }
}
</style>
