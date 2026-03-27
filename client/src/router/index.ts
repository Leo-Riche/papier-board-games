// client/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import TimeBombLobby from '../views/TimeBomb/TimeBombLobby.vue'
import TimeBombBoard from '../views/TimeBomb/TimeBombBoard.vue'
import TimeBombJoin from '../views/TimeBomb/TimeBombJoin.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/timebomb/lobby',
    name: 'TimeBombLobby',
    component: TimeBombLobby
  },
  {
    path: '/timebomb/game/:id',
    name: 'TimeBombBoard',
    component: TimeBombBoard,
    props: true
  },
  {
    path: '/join/:id',
    name: 'TimeBombJoin',
    component: TimeBombJoin,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router