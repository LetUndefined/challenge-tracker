<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNotifications } from '@/composables/useNotifications'

const route = useRoute()
const { unreadCount } = useNotifications()
const mobileOpen = ref(false)

const navItems = [
  { path: '/', label: 'Challenges' },
  { path: '/notifications', label: 'Notifications' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/payouts', label: 'Payouts' },
  { path: '/history', label: 'History' },
  { path: '/compare', label: 'Compare' },
  { path: '/prop-firms', label: 'Prop Firms' },
]
</script>

<template>
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

      <div class="navbar-links" :class="{ open: mobileOpen }">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: route.path === item.path }"
          @click="mobileOpen = false"
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
        <button class="hamburger" @click="mobileOpen = !mobileOpen" :class="{ open: mobileOpen }">
          <span /><span /><span />
        </button>
      </div>
    </div>
    <div class="navbar-border" />
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

/* ─── Hamburger ─── */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 7px;
  margin-left: 8px;
}

.hamburger span {
  display: block;
  height: 1.5px;
  background: var(--text-secondary);
  border-radius: 1px;
  transition: transform 0.2s, opacity 0.2s;
}

.hamburger.open span:nth-child(1) {
  transform: translateY(5.5px) rotate(45deg);
}

.hamburger.open span:nth-child(2) {
  opacity: 0;
}

.hamburger.open span:nth-child(3) {
  transform: translateY(-5.5px) rotate(-45deg);
}

@media (max-width: 640px) {
  .navbar-inner {
    padding: 0 16px;
  }

  .brand-text {
    font-size: 11px;
  }

  .hamburger {
    display: flex;
  }

  .navbar-links {
    display: none;
    position: absolute;
    top: 52px;
    left: 0;
    right: 0;
    flex-direction: column;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
    padding: 8px 16px;
    gap: 0;
    z-index: 99;
  }

  .navbar-links.open {
    display: flex;
  }

  .nav-link {
    padding: 12px 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .nav-link:last-child {
    border-bottom: none;
  }

  .nav-indicator {
    display: none;
  }

  .nav-link.active {
    color: var(--accent);
  }

  .live-indicator {
    padding: 3px 8px;
  }
}
</style>
