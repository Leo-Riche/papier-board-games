// client/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'

import TimeBombLobby from '../views/TimeBomb/TimeBombLobby.vue'
import TimeBombBoard from '../views/TimeBomb/TimeBombBoard.vue'
import TimeBombJoin from '../views/TimeBomb/TimeBombJoin.vue'

import LoupGarouLobby from '../views/LoupGarou/LoupGarouLobby.vue'
import LoupGarouBoard from '../views/LoupGarou/LoupGarouBoard.vue'
import LoupGarouJoin from '../views/LoupGarou/LoupGarouJoin.vue'

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
    path: '/timebomb/:id',
    name: 'TimeBombBoard',
    component: TimeBombBoard,
    props: true
  },
  {
    path: '/timebomb/join/:id',
    name: 'TimeBombJoin',
    component: TimeBombJoin,
    props: true
  },
  {
    path: '/loupgarou/lobby',
    name: 'LoupGarouLobby',
    component: LoupGarouLobby
  },
  {
    path: '/loupgarou/game/:id',
    name: 'LoupGarouBoard',
    component: LoupGarouBoard
  },
  {
    path: '/loupgarou/join/:id',
    name: 'LoupGarouJoin',
    component: LoupGarouJoin,
    props: true
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router