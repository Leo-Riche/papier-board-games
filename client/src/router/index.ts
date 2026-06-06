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

import YamsLobby from '../views/Yams/YamsLobby.vue'
import YamsBoard from '../views/Yams/YamsBoard.vue'
import YamsJoin from '../views/Yams/YamsJoin.vue'

import TheGangLobby from '../views/TheGang/TheGangLobby.vue'
import TheGangBoard from '../views/TheGang/TheGangBoard.vue'
import TheGangJoin from '../views/TheGang/TheGangJoin.vue'

import ChargerLobby from '../views/Charger/ChargerLobby.vue'
import ChargerBoard from '../views/Charger/ChargerBoard.vue'
import ChargerJoin from '../views/Charger/ChargerJoin.vue'

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
  {
    path: '/yams/lobby',
    name: 'YamsLobby',
    component: YamsLobby
  },
  {
    path: '/yams/game/:id',
    name: 'YamsBoard',
    component: YamsBoard
  },
  {
    path: '/yams/join/:id',
    name: 'YamsJoin',
    component: YamsJoin,
    props: true
  },
  {
    path: '/thegang/lobby',
    name: 'TheGangLobby',
    component: TheGangLobby
  },
  {
    path: '/thegang/game/:id',
    name: 'TheGangBoard',
    component: TheGangBoard,
    props: true
  },
  {
    path: '/thegang/join/:id',
    name: 'TheGangJoin',
    component: TheGangJoin,
    props: true
  },
  {
    path: '/charger/lobby',
    name: 'ChargerLobby',
    component: ChargerLobby
  },
  {
    path: '/charger/game/:id',
    name: 'ChargerBoard',
    component: ChargerBoard
  },
  {
    path: '/charger/join/:id',
    name: 'ChargerJoin',
    component: ChargerJoin,
    props: true
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router