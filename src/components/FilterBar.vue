<script setup lang="ts">
import { computed } from 'vue'
import type { ChallengeRow } from '@/types'

const props = defineProps<{
  rows: ChallengeRow[]
}>()

const search = defineModel<string>('search', { default: '' })
const ownerFilter = defineModel<string>('owner', { default: '' })
const statusFilter = defineModel<string>('status', { default: '' })

const emit = defineEmits<{
  addChallenge: []
}>()

const owners = computed(() => {
  const set = new Set(props.rows.map(r => r.owner).filter(Boolean))
  return Array.from(set).sort()
})
</script>

<template>
  <div class="filter-bar">
    <div class="filters">
      <div class="input-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search accounts..."
          class="search-input"
        />
      </div>
      <select v-model="ownerFilter" class="filter-select">
        <option value="">All Owners</option>
        <option v-for="o in owners" :key="o" :value="o">{{ o }}</option>
      </select>
      <select v-model="statusFilter" class="filter-select">
        <option value="">All Status</option>
        <option value="Connected">Connected</option>
        <option value="Disconnected">Disconnected</option>
      </select>
    </div>
    <button class="btn-add" @click="emit('addChallenge')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add Challenge
    </button>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0 16px;
}

.filters {
  display: flex;
  gap: 8px;
  flex: 1;
}

.input-wrap {
  position: relative;
  flex: 1;
  max-width: 280px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 34px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent-muted);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.filter-select {
  padding: 8px 12px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  min-width: 130px;
  transition: border-color 0.15s;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%234e4e6a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.filter-select:focus {
  border-color: var(--accent);
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s var(--ease-out);
}

.btn-add:hover {
  background: var(--accent-bright);
  box-shadow: 0 2px 12px var(--accent-muted);
}

/* ─── Mobile ─── */
@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    gap: 10px;
    padding: 8px 0 12px;
  }

  .filters {
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .input-wrap {
    max-width: 100%;
  }

  .filter-select {
    min-width: 0;
    width: 100%;
  }

  .btn-add {
    width: 100%;
    justify-content: center;
    padding: 10px;
  }
}
</style>
