import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import ChallengesView from './views/ChallengesView.vue'
import NotificationsView from './views/NotificationsView.vue'
import PropFirmsView from './views/PropFirmsView.vue'
import AnalyticsView from './views/AnalyticsView.vue'
import PayoutsView from './views/PayoutsView.vue'
import HistoryView from './views/HistoryView.vue'
import PropFirmCompareView from './views/PropFirmCompareView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: ChallengesView },
    { path: '/notifications', component: NotificationsView },
    { path: '/analytics', component: AnalyticsView },
    { path: '/payouts', component: PayoutsView },
    { path: '/history', component: HistoryView },
    { path: '/compare', component: PropFirmCompareView },
    { path: '/prop-firms', component: PropFirmsView },
  ],
})

createApp(App).use(router).mount('#app')
