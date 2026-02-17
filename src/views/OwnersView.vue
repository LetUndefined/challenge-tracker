<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'

interface OwnerRow {
  name: string
  challenges_count: number
  total_balance: number
}

const owners = ref<OwnerRow[]>([])
const newOwner = ref('')
const loading = ref(false)

async function fetchOwners() {
  loading.value = true
  try {
    const { data } = await supabase
      .from('challenges')
      .select('owner')

    if (data) {
      const counts = new Map<string, number>()
      for (const row of data) {
        if (row.owner) {
          counts.set(row.owner, (counts.get(row.owner) ?? 0) + 1)
        }
      }
      owners.value = Array.from(counts.entries()).map(([name, count]) => ({
        name,
        challenges_count: count,
        total_balance: 0,
      }))
    }
  } finally {
    loading.value = false
  }
}

onMounted(fetchOwners)

const colors = ['var(--accent)', 'var(--green)', 'var(--purple)', 'var(--cyan)', 'var(--orange)', 'var(--red)']
function avatarColor(index: number): string {
  return colors[index % colors.length]
}
</script>

<template>
  <div class="owners-view">
    <h1>Owners</h1>
    <p class="page-desc">Traders and account owners</p>

    <div v-if="owners.length === 0 && !loading" class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
      <p>No owners yet. Add a challenge with an owner to see them here.</p>
    </div>

    <div v-else class="owners-grid">
      <div
        v-for="(o, i) in owners"
        :key="o.name"
        class="owner-card"
        :style="{ 'animation-delay': `${i * 50}ms`, '--avatar-color': avatarColor(i) }"
      >
        <div class="owner-avatar">
          {{ o.name.charAt(0).toUpperCase() }}
        </div>
        <div class="owner-info">
          <h3>{{ o.name }}</h3>
          <div class="owner-meta">
            <span class="meta-value">{{ o.challenges_count }}</span>
            <span class="meta-label">challenge{{ o.challenges_count !== 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.owners-view {
  padding: 24px 28px;
  max-width: 900px;
  margin: 0 auto;
  animation: fadeInUp 0.35s var(--ease-out);
}

.owners-view h1 {
  font-family: var(--font-ui);
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.page-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 4px 0 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
}

.owners-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.owner-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  animation: fadeInUp 0.35s var(--ease-out) both;
  transition: border-color 0.15s;
}

.owner-card:hover {
  border-color: var(--border);
}

.owner-avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--avatar-color) 12%, transparent);
  color: var(--avatar-color);
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.owner-info h3 {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.owner-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.meta-value {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.meta-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 640px) {
  .owners-view {
    padding: 16px 12px;
  }

  .owners-view h1 {
    font-size: 18px;
  }

  .owners-grid {
    grid-template-columns: 1fr;
  }
}
</style>
