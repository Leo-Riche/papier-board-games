// client/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'

import TimeBombLobby from '../views/TimeBomb/TimeBombLobby.vue'
import TimeBombBoard from '../views/TimeBomb/TimeBombBoard.vue'
import TimeBombJoin from '../views/TimeBomb/TimeBombJoin.vue'

import LoupGarouLobby from '../views/LoupGarou/LoupGarouLobby.vue'
import LoupGarouBoard from '../views/LoupGarou/LoupGarouBoard.vue'
import LoupGarouJoin from '../views/LoupGarou/LoupGarouJoin.vue'

import QwixxLobby from '../views/Qwixx/QwixxLobby.vue'
import QwixxBoard from '../views/Qwixx/QwixxBoard.vue'
import QwixxJoin from '../views/Qwixx/QwixxJoin.vue'

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
  {
    path: '/qwixx/lobby',
    name: 'QwixxLobby',
    component: QwixxLobby
  },
  {
    path: '/qwixx/game/:id',
    name: 'QwixxBoard',
    component: QwixxBoard
  },
  {
    path: '/qwixx/join/:id',
    name: 'QwixxJoin',
    component: QwixxJoin,
    props: true
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router