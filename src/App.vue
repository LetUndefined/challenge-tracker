<script setup lang="ts">
import { onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import { useMetaCopier } from '@/composables/useMetaCopier'
import { useChallenges } from '@/composables/useChallenges'

const { startAutoRefresh } = useMetaCopier()
const { fetchChallenges } = useChallenges()

onMounted(() => {
  startAutoRefresh(30_000)
  fetchChallenges()
})
</script>

<template>
  <div class="app-shell">
    <div class="ambient-glow" />
    <NavBar />
    <main class="app-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

.ambient-glow {
  position: fixed;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 240px;
  background: radial-gradient(ellipse, var(--accent-glow) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

.app-content {
  flex: 1;
  position: relative;
  z-index: 1;
}
</style>
