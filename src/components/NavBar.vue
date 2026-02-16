<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNotifications } from '@/composables/useNotifications'

const route = useRoute()
const { unreadCount } = useNotifications()

const navItems = [
  { path: '/', label: 'Challenges', icon: 'grid' },
  { path: '/notifications', label: 'Alerts', icon: 'bell' },
  { path: '/prop-firms', label: 'Firms', icon: 'building' },
  { path: '/owners', label: 'Owners', icon: 'users' },
]
</script>

<template>
  <!-- Desktop top nav -->
  <nav class="navbar">
    <div class="navbar-inner">
      <div class="navbar-brand">
        <div class="brand-mark">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L18 7V13L10 18L2 13V7L10 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M10 7L14 9.5V14.5L10 17L6 14.5V9.5L10 7Z" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
        <span class="brand-text">CHALLENGE<span class="brand-accent">TRACKER</span></span>
      </div>

      <div class="navbar-links">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: route.path === item.path }"
        >
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-indicator" />
          <span
            v-if="item.path === '/notifications' && unreadCount > 0"
            class="badge"
          >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </router-link>
      </div>

      <div class="navbar-right">
        <div class="live-indicator">
          <span class="live-dot" />
          <span class="live-text">LIVE</span>
        </div>
      </div>
    </div>
    <div class="navbar-border" />
  </nav>

  <!-- Mobile bottom nav -->
  <nav class="mobile-nav">
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="mobile-nav-item"
      :class="{ active: route.path === item.path }"
    >
      <!-- Grid icon -->
      <svg v-if="item.icon === 'grid'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <!-- Bell icon -->
      <svg v-if="item.icon === 'bell'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <!-- Building icon -->
      <svg v-if="item.icon === 'building'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/>
        <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01"/>
      </svg>
      <!-- Users icon -->
      <svg v-if="item.icon === 'users'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <span class="mobile-nav-label">{{ item.label }}</span>
      <span
        v-if="item.path === '/notifications' && unreadCount > 0"
        class="mobile-badge"
      />
    </router-link>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-elevated);
  backdrop-filter: blur(12px);
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  height: 52px;
}

.navbar-border {
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--accent) 20%, var(--accent) 80%, transparent 100%);
  opacity: 0.15;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  color: var(--accent);
  display: flex;
  align-items: center;
}

.brand-text {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}

.brand-accent {
  color: var(--accent);
}

.navbar-links {
  display: flex;
  gap: 2px;
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 18px;
  color: var(--text-tertiary);
  text-decoration: none;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: color 0.2s var(--ease-out);
}

.nav-link:hover {
  color: var(--text-secondary);
}

.nav-link.active {
  color: var(--text-primary);
}

.nav-indicator {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 24px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  transition: transform 0.25s var(--ease-out);
}

.nav-link.active .nav-indicator {
  transform: translateX(-50%) scaleX(1);
}

.badge {
  position: absolute;
  top: 0;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  background: var(--red);
  color: #fff;
}

.navbar-right {
  display: flex;
  align-items: center;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse-live 2s ease-in-out infinite;
}

.live-text {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--green);
}

/* ─── Mobile bottom nav ─── */
.mobile-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
  padding: env(safe-area-inset-bottom, 0) 0 0;
}

.mobile-nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0 10px;
  text-decoration: none;
  color: var(--text-tertiary);
  transition: color 0.15s;
}

.mobile-nav-item.active {
  color: var(--accent);
}

.mobile-nav-label {
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.mobile-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 14px);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--red);
}

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .navbar {
    position: relative;
  }

  .navbar-inner {
    padding: 0 16px;
    height: 48px;
  }

  .navbar-links {
    display: none;
  }

  .navbar-right {
    display: flex;
  }

  .mobile-nav {
    display: flex;
    justify-content: space-around;
  }
}
</style>
