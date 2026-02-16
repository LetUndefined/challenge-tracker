<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMetaCopier } from '@/composables/useMetaCopier'
import { useChallenges } from '@/composables/useChallenges'
import StatsBar from '@/components/StatsBar.vue'
import FilterBar from '@/components/FilterBar.vue'
import ChallengeTable from '@/components/ChallengeTable.vue'
import AddChallengeModal from '@/components/AddChallengeModal.vue'

const { startAutoRefresh, stopAutoRefresh, loading: mcLoading, error: mcError } = useMetaCopier()
const {
  challengeRows,
  unlinkedAccounts,
  fetchChallenges,
  deleteChallenge,
  captureSnapshots,
  loading: chLoading,
} = useChallenges()

const search = ref('')
const ownerFilter = ref('')
const statusFilter = ref('')
const showModal = ref(false)

let snapshotInterval: ReturnType<typeof setInterval> | null = null

const filteredRows = computed(() => {
  return challengeRows.value.filter(row => {
    if (search.value) {
      const q = search.value.toLowerCase()
      const matchesSearch =
        row.alias.toLowerCase().includes(q) ||
        row.login_number.toLowerCase().includes(q) ||
        row.prop_firm.toLowerCase().includes(q) ||
        row.owner.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    if (ownerFilter.value && row.owner !== ownerFilter.value) return false
    if (statusFilter.value && row.state !== statusFilter.value) return false
    return true
  })
})

async function handleDelete(id: string) {
  if (confirm('Remove this challenge?')) {
    await deleteChallenge(id)
  }
}

onMounted(async () => {
  startAutoRefresh(30_000)
  await fetchChallenges()
  snapshotInterval = setInterval(captureSnapshots, 5 * 60_000)
})

onUnmounted(() => {
  stopAutoRefresh()
  if (snapshotInterval) clearInterval(snapshotInterval)
})
</script>

<template>
  <div class="challenges-view">
    <div class="page-header">
      <div class="page-title-row">
        <h1>Challenges</h1>
        <div v-if="mcLoading || chLoading" class="refresh-indicator">
          <div class="refresh-spinner" />
          <span>Syncing</span>
        </div>
      </div>
      <div v-if="mcError" class="api-error">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        MetaCopier: {{ mcError }}
      </div>
    </div>

    <StatsBar :rows="challengeRows" />

    <FilterBar
      v-model:search="search"
      v-model:owner="ownerFilter"
      v-model:status="statusFilter"
      :rows="challengeRows"
      @add-challenge="showModal = true"
    />

    <ChallengeTable :rows="filteredRows" @delete="handleDelete" />

    <AddChallengeModal
      :show="showModal"
      :unlinked-accounts="unlinkedAccounts"
      @close="showModal = false"
      @added="fetchChallenges()"
    />
  </div>
</template>

<style scoped>
.challenges-view {
  padding: 24px 28px;
  max-width: 1440px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-title-row {
  display: flex;
  align-items: center;
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

.refresh-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
}

.refresh-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.api-error {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--red-muted);
  border: 1px solid rgba(255, 71, 87, 0.15);
  border-radius: var(--radius-sm);
  color: var(--red);
}

@media (max-width: 768px) {
  .challenges-view {
    padding: 16px;
  }

  .page-title-row h1 {
    font-size: 18px;
  }
}
</style>
