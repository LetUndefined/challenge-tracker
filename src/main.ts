import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import ChallengesView from './views/ChallengesView.vue'
import NotificationsView from './views/NotificationsView.vue'
import PropFirmsView from './views/PropFirmsView.vue'
import OwnersView from './views/OwnersView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: ChallengesView },
    { path: '/notifications', component: NotificationsView },
    { path: '/prop-firms', component: PropFirmsView },
    { path: '/owners', component: OwnersView },
  ],
})

createApp(App).use(router).mount('#app')
