<template>
  <div class="board-wrapper">

    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- ============ WAITING ============ -->
    <div v-if="gameStatus === 'waiting'" class="waiting-screen">
      <h1>CHARGER 🛡️</h1>
      <div class="share-box">
        <p>Code de la salle : <strong>{{ roomCode }}</strong></p>
        <button class="btn-secondary" @click="copyLink">📋 Copier le lien d'invitation</button>
      </div>
      <ul class="player-list">
        <li v-for="p in allConnectedPlayers" :key="p.id">👤 {{ p.name }}</li>
      </ul>
      <button v-if="amIHost" class="btn-primary" @click="startGame" :disabled="allConnectedPlayers.length < 2" :style="allConnectedPlayers.length < 2 ? {opacity: '0.4', cursor: 'not-allowed'} : {}">LANCER LA PARTIE</button>
      <p v-else class="waiting-msg">En attente du chef de salle...</p>
      <div class="rules-box">
        <h3>📜 Règles rapides</h3>
        <p>Chaque joueur reçoit <strong>3 cartes</strong> : les 2 plus hautes sont vos <strong>PV</strong>, la plus basse votre <strong>bouclier</strong>.</p>
        <p>À votre tour, piochez une carte et choisissez : <strong>Attaquer</strong>, <strong>Changer un bouclier</strong>, ou <strong>Charger</strong> quelqu'un (max 2 cartes stockées).</p>
        <p>Le dernier survivant remporte la partie ! 🏆</p>
      </div>
    </div>

    <!-- ============ PLAYING ============ -->
    <div v-else-if="gameStatus === 'playing'" class="playing-screen" :class="{ 'my-turn': isActivePlayer && !pendingAction }">

      <!-- Top bar -->
      <div class="top-bar">
        <h2>CHARGER 🛡️</h2>
        <p class="turn-indicator">
          <span v-if="isActivePlayer" class="my-turn-text">⭐ À TOI DE JOUER</span>
          <span v-else>Tour de <strong>{{ activePlayerName }}</strong></span>
        </p>
        <div class="deck-info">
          <div class="deck-pill">
            <span class="deck-pill-label">PIOCHE</span>
            <span class="deck-pill-value">🃏 {{ deckCount }}</span>
          </div>
          <div class="deck-pill discard-pill" v-if="discardTop">
            <span class="deck-pill-label">DÉFAUSSE</span>
            <span class="deck-pill-value" :class="suitColor(discardTop.suit)">{{ cardLabel(discardTop) }}</span>
          </div>
        </div>
      </div>

      <!-- Ordre du tour -->
      <div class="turn-order" v-if="players.length">
        <div
          v-for="p in players"
          :key="p.id"
          class="turn-chip"
          :class="{ active: p.id === activePlayerId, me: p.id === myId, dead: p.eliminated }"
        >
          <span class="turn-chip-dot"></span>
          <span class="turn-chip-name">{{ p.name }}</span>
          <span v-if="p.id === myId" class="turn-chip-you">moi</span>
        </div>
      </div>

      <!-- Main layout -->
      <div class="main-content">

        <!-- LEFT: My hand + actions -->
        <div class="left-panel">

          <!-- Éliminé : mode spectateur -->
          <div v-if="amEliminated" class="spectator-panel">
            <div class="spectator-skull">💀</div>
            <h3>Tu es éliminé</h3>
            <p>Tu observes la partie. Suis l'action et le journal en direct.</p>
          </div>

          <template v-else>
          <!-- My status -->
          <div class="my-status-card">
            <div class="my-name">{{ myName }} <span class="you-tag">moi</span></div>

            <div class="card-row">
              <!-- HP cards -->
              <div class="card-group">
                <div class="group-label">❤️ PV</div>
                <div class="cards-display">
                  <div v-for="(card, i) in myPlayer?.hp" :key="'hp'+i" class="card card-hp">
                    <span class="card-suit" :class="suitColor(card.suit)">{{ card.suit }}</span>
                    <span class="card-val">{{ cardVal(card.value) }}</span>
                  </div>
                </div>
                <div class="hp-sum">= {{ myHpSum }} PV</div>
              </div>

              <!-- Shield -->
              <div class="card-group">
                <div class="group-label">🛡️ Bouclier <span class="vis-icon">{{ myPlayer?.shieldPierced ? '👁' : '🔒' }}</span></div>
                <div class="cards-display">
                  <div
                    v-if="myPlayer?.shield && !myPlayer.shield.hidden"
                    class="card card-shield"
                    :class="{ 'shield-pulse': myShieldPulse, 'act act-shield': isArmed }"
                    :role="isArmed ? 'button' : null"
                    :tabindex="isArmed ? 0 : null"
                    :title="isArmed ? 'Changer ton bouclier' : null"
                    @click="askConfirm('change_shield', myId, myName)"
                    @keydown="onCardKey($event, 'change_shield', myId, myName)"
                  >
                    <span class="card-suit" :class="suitColor(myPlayer.shield.suit)">{{ myPlayer.shield.suit }}</span>
                    <span class="card-val">{{ cardVal(myPlayer.shield.value) }}</span>
                    <span class="act-hint" v-if="isArmed">🛡️</span>
                  </div>
                  <div class="card card-back" v-else>?</div>
                </div>
              </div>

              <!-- Charged cards (2 emplacements fixes) -->
              <div class="card-group">
                <div class="group-label">☢️ Chargeeer</div>
                <div class="cards-display">
                  <div
                    v-for="i in 2"
                    :key="'ch'+i"
                    class="card"
                    :class="[
                      i <= (myPlayer?.chargedCount || 0) ? 'card-back' : 'card-empty',
                      { 'act act-charge': isArmed && (myPlayer?.chargedCount || 0) < 2 }
                    ]"
                    :role="isArmed && (myPlayer?.chargedCount || 0) < 2 ? 'button' : null"
                    :tabindex="isArmed && (myPlayer?.chargedCount || 0) < 2 ? 0 : null"
                    :title="isArmed && (myPlayer?.chargedCount || 0) < 2 ? 'Charger' : null"
                    @click="askConfirm('charge', myId, myName)"
                    @keydown="onCardKey($event, 'charge', myId, myName)"
                  >
                    <template v-if="i <= (myPlayer?.chargedCount || 0)">?</template>
                    <span class="act-hint" v-if="isArmed && (myPlayer?.chargedCount || 0) < 2">☢️</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Zone de tour -->
            <div v-if="isActivePlayer && !pendingAction" class="turn-zone">
              <template v-if="!myPlayer?.hasDrawnCard">
                <div class="turn-zone-label">À toi de jouer</div>
                <div
                  class="card card-draw act"
                  role="button" tabindex="0" title="Piocher"
                  @click="drawCard"
                  @keydown="onCardKey($event, 'draw')"
                >
                  <span class="draw-icon" aria-hidden="true"></span>
                  <span class="draw-text">Piocher</span>
                </div>
              </template>
              <template v-else>
                <div class="turn-zone-label">Carte piochée</div>
                <div class="card card-drawn-back">?</div>
                <p class="turn-hint">Clique sur une carte : <b>ton bouclier</b> ou <b>tes charges</b> pour toi / les <b>PV</b> d'un adversaire pour l'attaquer, son <b>bouclier</b> ou <b>ses charges</b> pour l'aider.</p>
              </template>
            </div>
          </div>

          <div v-if="!isActivePlayer" class="waiting-turn">
            <p>En attente de <strong>{{ activePlayerName }}</strong>...</p>
          </div>
          </template>
        </div>

        <!-- RIGHT: Opponents -->
        <div class="right-panel">
          <h4 class="opponents-title">Adversaires</h4>
          <div class="opponents-list">
            <div
              v-for="opp in opponents"
              :key="opp.id"
              class="opp-card"
              :class="{
                eliminated: opp.eliminated,
                active: opp.id === activePlayerId,
                targeted: pendingAction?.targetId === opp.id,
                attacker: pendingAction?.attackerId === opp.id
              }"
            >
              <div class="opp-header">
                <span class="opp-name">
                  {{ opp.name }}
                  <span v-if="opp.id === activePlayerId && !opp.eliminated" class="active-tag">▶</span>
                  <span v-if="opp.eliminated" class="elim-tag">💀</span>
                  <span v-if="shieldChangedIds.has(opp.id)" class="shield-changed-badge">🛡️ Bouclier changé</span>
                </span>
                <span class="opp-hp-total" v-if="!opp.eliminated">{{ opp.hp.filter(c=>!c.hidden).reduce((s,c)=>s+c.value,0) }} PV</span>
              </div>

              <div class="opp-cards" v-if="!opp.eliminated">
                <!-- HP → attaquer -->
                <div class="opp-group opp-hp-group">
                  <span class="opp-group-label">❤️</span>
                  <div
                    v-for="(c, i) in opp.hp"
                    :key="i"
                    class="card card-sm card-hp"
                    :class="{ 'act act-attack': isArmed }"
                    :role="isArmed ? 'button' : null"
                    :tabindex="isArmed ? 0 : null"
                    :title="isArmed ? `Attaquer ${opp.name}` : null"
                    @click="askConfirm('attack', opp.id, opp.name)"
                    @keydown="onCardKey($event, 'attack', opp.id, opp.name)"
                  >
                    <span class="card-suit-sm" :class="suitColor(c.suit)">{{ c.suit }}</span>
                    <span class="card-val-sm">{{ cardVal(c.value) }}</span>
                    <span class="act-hint" v-if="isArmed">⚔️</span>
                  </div>
                </div>

                <!-- Shield → changer son bouclier -->
                <div class="opp-group">
                  <span class="opp-group-label">🛡️</span>
                  <div
                    v-if="opp.shield && !opp.shield.hidden"
                    class="card card-sm card-shield revealed"
                    :class="{ 'act act-shield': isArmed }"
                    :role="isArmed ? 'button' : null"
                    :tabindex="isArmed ? 0 : null"
                    :title="isArmed ? `Changer le bouclier de ${opp.name}` : null"
                    @click="askConfirm('change_shield', opp.id, opp.name)"
                    @keydown="onCardKey($event, 'change_shield', opp.id, opp.name)"
                  >
                    <span class="card-suit-sm" :class="suitColor(opp.shield.suit)">{{ opp.shield.suit }}</span>
                    <span class="card-val-sm">{{ cardVal(opp.shield.value) }}</span>
                    <span class="act-hint" v-if="isArmed">🛡️</span>
                  </div>
                  <div
                    v-else
                    class="card card-sm card-back"
                    :class="{ 'act act-shield': isArmed }"
                    :role="isArmed ? 'button' : null"
                    :tabindex="isArmed ? 0 : null"
                    :title="isArmed ? `Changer le bouclier de ${opp.name}` : null"
                    @click="askConfirm('change_shield', opp.id, opp.name)"
                    @keydown="onCardKey($event, 'change_shield', opp.id, opp.name)"
                  >?<span class="act-hint" v-if="isArmed">🛡️</span></div>
                </div>

                <!-- Charged (2 emplacements fixes) → charger -->
                <div class="opp-group">
                  <span class="opp-group-label">☢️</span>
                  <div
                    v-for="i in 2"
                    :key="i"
                    class="card card-sm"
                    :class="[
                      i <= opp.chargedCount ? 'card-back' : 'card-slot-empty',
                      { 'act act-charge': isArmed && opp.chargedCount < 2 }
                    ]"
                    :role="isArmed && opp.chargedCount < 2 ? 'button' : null"
                    :tabindex="isArmed && opp.chargedCount < 2 ? 0 : null"
                    :title="isArmed && opp.chargedCount < 2 ? `Charger ${opp.name}` : null"
                    @click="askConfirm('charge', opp.id, opp.name)"
                    @keydown="onCardKey($event, 'charge', opp.id, opp.name)"
                  >
                    <template v-if="i <= opp.chargedCount">?</template>
                    <span class="act-hint" v-if="isArmed && opp.chargedCount < 2">☢️</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- Attack modal (attaquant + spectateurs) -->
      <div v-if="pendingAction && pendingAction.targetId !== myId" class="attack-modal-overlay">
        <div class="attack-modal">
          <div class="attack-modal-title">
            Attaque de <strong>{{ players.find(p => p.id === pendingAction.attackerId)?.name }}</strong>
            sur <strong>{{ players.find(p => p.id === pendingAction.targetId)?.name }}</strong>
          </div>
          <div class="attack-face-off">
            <div class="face-off-side">
              <div class="face-off-label">⚔️ Attaque</div>
              <div class="face-off-cards">
                <div v-for="(c, i) in pendingAction.attackCards" :key="i" class="card card-sm card-hp card-reveal" :style="{ animationDelay: (i * 0.38) + 's' }">
                  <span class="card-suit-sm" :class="suitColor(c.suit)">{{ c.suit }}</span>
                  <span class="card-val-sm">{{ cardVal(c.value) }}</span>
                </div>
              </div>
              <div class="face-off-total attack-total">{{ displayedAttackTotal }}</div>
            </div>
            <div class="face-off-vs">vs</div>
            <div class="face-off-side">
              <div class="face-off-label">🛡️ Bouclier</div>
              <div class="face-off-cards">
                <template v-if="players.find(p => p.id === pendingAction.targetId)?.shield && !players.find(p => p.id === pendingAction.targetId)?.shield.hidden">
                  <div class="card card-sm card-shield">
                    <span class="card-suit-sm" :class="suitColor(players.find(p => p.id === pendingAction.targetId).shield.suit)">{{ players.find(p => p.id === pendingAction.targetId).shield.suit }}</span>
                    <span class="card-val-sm">{{ cardVal(players.find(p => p.id === pendingAction.targetId).shield.value) }}</span>
                  </div>
                </template>
                <div v-else class="card card-sm card-back">?</div>
              </div>
              <div class="face-off-total shield-total">{{ players.find(p => p.id === pendingAction.targetId)?.shield?.value ?? '?' }}</div>
            </div>
          </div>
          <div class="verdict-slot">
            <template v-if="verdictVisible">
              <div v-if="pendingAction.attackTotal > (players.find(p => p.id === pendingAction.targetId)?.shield?.value ?? 0)" class="dmg-text verdict-pop">
                − {{ pendingAction.attackTotal - (players.find(p => p.id === pendingAction.targetId)?.shield?.value ?? 0) }} PV
              </div>
              <div v-else class="blocked-text verdict-pop">Bloqué !</div>
            </template>
          </div>
          <div class="attack-modal-waiting">En attente de {{ players.find(p => p.id === pendingAction.targetId)?.name }}...</div>
        </div>
      </div>

      <!-- Attack modal (cible) -->
      <div v-if="pendingAction && pendingAction.targetId === myId" class="attack-modal-overlay">
        <div class="attack-modal attack-modal-target">
          <div class="attack-modal-title target">
            ⚔️ <strong>{{ players.find(p => p.id === pendingAction.attackerId)?.name }}</strong> t'attaque !
          </div>
          <div class="attack-face-off">
            <div class="face-off-side">
              <div class="face-off-label">⚔️ Attaque</div>
              <div class="face-off-cards">
                <div v-for="(c, i) in pendingAction.attackCards" :key="i" class="card card-sm card-hp card-reveal" :style="{ animationDelay: (i * 0.38) + 's' }">
                  <span class="card-suit-sm" :class="suitColor(c.suit)">{{ c.suit }}</span>
                  <span class="card-val-sm">{{ cardVal(c.value) }}</span>
                </div>
              </div>
              <div class="face-off-total attack-total">{{ displayedAttackTotal }}</div>
            </div>
            <div class="face-off-vs">vs</div>
            <div class="face-off-side">
              <div class="face-off-label">🛡️ Ton bouclier</div>
              <div class="face-off-cards">
                <div v-if="myPlayer?.shield && !myPlayer.shield.hidden" class="card card-sm card-shield">
                  <span class="card-suit-sm" :class="suitColor(myPlayer.shield.suit)">{{ myPlayer.shield.suit }}</span>
                  <span class="card-val-sm">{{ cardVal(myPlayer.shield.value) }}</span>
                </div>
              </div>
              <div class="face-off-total shield-total">{{ myPlayer?.shield?.value }}</div>
            </div>
          </div>
          <div class="verdict-slot">
            <template v-if="verdictVisible">
              <div v-if="pendingAction.attackTotal > myPlayer?.shield?.value" class="dmg-text verdict-pop">− {{ pendingAction.attackTotal - myPlayer?.shield?.value }} PV</div>
              <div v-else class="blocked-text verdict-pop">Bloqué !</div>
            </template>
          </div>
          <button class="btn-resolve" @click="resolveAttack">OK</button>
        </div>
      </div>

      <!-- Confirmation d'action -->
      <div v-if="pendingConfirm && !pendingAction" class="confirm-overlay">
        <div class="confirm-modal">
          <div class="confirm-title">{{ pendingConfirm.title }}</div>
          <p class="confirm-recap">{{ pendingConfirm.recap }}</p>
          <div class="confirm-actions">
            <button class="btn-confirm-cancel" @click="cancelConfirm">Annuler</button>
            <button class="btn-confirm-ok" @click="confirmAction">Confirmer</button>
          </div>
        </div>
      </div>

      <!-- Journal -->
      <div class="log-panel" v-if="gameLogs.length">
        <div class="log-panel-title">Journal</div>
        <ul class="log-list">
          <li v-for="(line, i) in gameLogs" :key="i" :class="{ 'log-latest': i === 0 }">{{ line }}</li>
        </ul>
      </div>
    </div>

    <!-- ============ GAME OVER ============ -->
    <div v-else-if="gameStatus === 'finished'" class="game-over-screen">
      <div class="results-box">
        <h2>🏆 Partie Terminée !</h2>
        <p class="reason">{{ winReason }}</p>
        <div class="scoreboard">
          <div v-for="p in finalPlayers" :key="p.id" class="score-line" :class="{ winner: p.id === finalWinner?.id }">
            <span class="rank">{{ p.id === finalWinner?.id ? '🏆' : '💀' }}</span>
            <span class="name">{{ p.name }}</span>
            <span class="status">{{ p.id === finalWinner?.id ? 'Survivant !' : 'Éliminé' }}</span>
          </div>
        </div>
        <div class="host-actions">
          <button v-if="amIHost" class="btn-primary" @click="startGame">REJOUER</button>
          <p v-else class="waiting-msg">En attente que l'hôte relance la partie…</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

// ============ STATE ============
const allConnectedPlayers = ref([])
const amIHost = ref(false)
const gameStatus = ref('waiting')
const players = ref([])
const activePlayerId = ref(null)
const myId = ref(null)
const deckCount = ref(0)
const discardTop = ref(null)
const pendingAction = ref(null)
const gameLogs = ref([])
const winReason = ref('')
const finalPlayers = ref([])
const finalWinner = ref(null)
const shieldChangedIds = ref(new Set())
const toast = ref('')
let toastTimer = null
const pendingConfirm = ref(null)
const myShieldPulse = ref(false)
let myShieldPulseTimer = null

// Résolution d'attaque scénarisée
const displayedAttackTotal = ref(0)
const verdictVisible = ref(false)
let attackTween = null
let verdictTimer = null

// ============ COMPUTED ============
const myPlayer = computed(() => players.value.find(p => p.id === myId.value))
const myName = computed(() => myPlayer.value?.name || allConnectedPlayers.value.find(p => p.id === socket.id)?.name || '')
const myHpSum = computed(() => myPlayer.value?.hp?.reduce((s, c) => s + (c.value || 0), 0) ?? 0)
const isActivePlayer = computed(() => myId.value === activePlayerId.value)
const activePlayerName = computed(() => players.value.find(p => p.id === activePlayerId.value)?.name || '')
const opponents = computed(() => players.value.filter(p => p.id !== myId.value))
const amEliminated = computed(() => myPlayer.value?.eliminated === true)
// "Armé" = c'est mon tour, j'ai pioché, et aucune attaque en cours → les cartes deviennent cliquables
const isArmed = computed(() =>
  isActivePlayer.value && !pendingAction.value && !amEliminated.value && myPlayer.value?.hasDrawnCard === true
)

// ============ HELPERS ============
function cardVal(v) {
  const f = { 1: 'A', 11: 'V', 12: 'D', 13: 'R' }
  return f[v] || String(v)
}
function cardLabel(card) {
  if (!card) return ''
  return `${cardVal(card.value)}${card.suit}`
}
function suitColor(suit) {
  return (suit === '♥' || suit === '♦') ? 'red' : 'black'
}

// ============ ACTIONS ============
function drawCard() { socket.emit('charger_action', { roomCode, actionType: 'draw', payload: {} }) }
function attack(targetId) { socket.emit('charger_action', { roomCode, actionType: 'attack', payload: { targetId } }) }
function changeShield(targetId) { socket.emit('charger_action', { roomCode, actionType: 'change_shield', payload: { targetId } }) }
function charge(targetId) { socket.emit('charger_action', { roomCode, actionType: 'charge', payload: { targetId } }) }
function resolveAttack() { socket.emit('charger_action', { roomCode, actionType: 'resolve_attack', payload: {} }) }
function startGame() { socket.emit('start_charger', roomCode) }

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

function copyLink() {
  const link = `${window.location.origin}/charger/join/${roomCode}`
  navigator.clipboard.writeText(link).then(() => showToast('Lien copié ✓'))
}

// ============ CONFIRMATION D'ACTION ============
const CONFIRM_LABELS = {
  attack: (name, n) => ({
    title: `⚔️ Attaquer ${name}`,
    recap: `Tu engages ${n} carte(s) de valeur inconnue. L'attaque est irréversible et met fin à ton tour.`
  }),
  change_shield_self: () => ({
    title: '🛡️ Changer ton bouclier',
    recap: `Ton bouclier actuel part à la défausse, remplacé par ta carte piochée (valeur inconnue). Fin de ton tour.`
  }),
  change_shield_other: (name) => ({
    title: `🛡️ Changer le bouclier de ${name}`,
    recap: `Le bouclier de ${name} est remplacé par ta carte piochée (valeur inconnue). Fin de ton tour.`
  }),
  charge_self: (name, n) => ({
    title: '☢️ Charger tes cartes',
    recap: `Ta carte piochée rejoint ta pile chargée (${n}/2). Tu n'en connaîtras pas la valeur. Fin de ton tour.`
  }),
  charge_other: (name, n) => ({
    title: `☢️ Charger ${name}`,
    recap: `Ta carte piochée rejoint la pile chargée de ${name} (${n}/2). Ni toi ni ${name} n'en connaîtrez la valeur. Fin de ton tour.`
  })
}

function askConfirm(kind, targetId, targetName) {
  if (!isArmed.value) return
  const isSelf = targetId === myId.value
  // Garde-fous : on n'attaque pas soi-même, on ne charge pas une pile déjà pleine
  if (kind === 'attack' && isSelf) return
  if (kind === 'charge' && (players.value.find(p => p.id === targetId)?.chargedCount || 0) >= 2) return

  let key = kind
  if (kind === 'change_shield') key = isSelf ? 'change_shield_self' : 'change_shield_other'
  if (kind === 'charge') key = isSelf ? 'charge_self' : 'charge_other'

  let n = 0
  if (kind === 'attack') n = (myPlayer.value?.chargedCount || 0) + 1
  else if (kind === 'charge') n = (players.value.find(p => p.id === targetId)?.chargedCount || 0) + 1

  const { title, recap } = CONFIRM_LABELS[key](targetName, n)
  pendingConfirm.value = { kind, targetId, title, recap }
}

function onCardKey(e, kind, targetId, targetName) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  if (kind === 'draw') drawCard()
  else askConfirm(kind, targetId, targetName)
}

function cancelConfirm() { pendingConfirm.value = null }

function confirmAction() {
  const pc = pendingConfirm.value
  if (!pc) return
  if (pc.kind === 'attack') attack(pc.targetId)
  else if (pc.kind === 'change_shield') changeShield(pc.targetId)
  else if (pc.kind === 'charge') charge(pc.targetId)
  pendingConfirm.value = null
}

// ============ SOCKET ============
onMounted(() => {
  const sendName = () => {
    const savedName = localStorage.getItem('temp_player_name')
    if (savedName) socket.emit('set_player_name', { name: savedName, roomCode })
  }
  if (socket.connected) { sendName() } else { socket.on('connect', sendName) }

  socket.on('room_full', (msg) => { showToast(msg); setTimeout(() => { socket.disconnect(); router.push('/') }, 1600) })

  socket.on('update_players_list', (pls) => {
    allConnectedPlayers.value = pls
    const me = pls.find(p => p.id === socket.id)
    if (me) { amIHost.value = me.isHost; myId.value = me.id }
  })

  socket.on('game_started', () => { gameStatus.value = 'playing'; gameLogs.value = [] })

  socket.on('update_board_state', (data) => {
    if (data.status !== 'finished') gameStatus.value = 'playing'
    players.value = data.players
    activePlayerId.value = data.activePlayerId
    myId.value = data.myId
    if (typeof data.isHost === 'boolean') amIHost.value = data.isHost
    deckCount.value = data.deckCount
    discardTop.value = data.discardTop
    pendingAction.value = data.pendingAction
    // Ferme une éventuelle confirmation devenue caduque (tour passé / attaque en cours)
    if (data.myId !== data.activePlayerId || data.pendingAction) pendingConfirm.value = null
  })

  socket.on('action_log', (msg) => {
    gameLogs.value.unshift(msg)
    if (gameLogs.value.length > 40) gameLogs.value.pop()
  })

  socket.on('shield_changed', ({ targetId }) => {
    if (targetId === myId.value) {
      showToast('🛡️ Ton bouclier a été changé')
      myShieldPulse.value = true
      clearTimeout(myShieldPulseTimer)
      myShieldPulseTimer = setTimeout(() => { myShieldPulse.value = false }, 700)
    }
    shieldChangedIds.value = new Set([...shieldChangedIds.value, targetId])
    setTimeout(() => {
      shieldChangedIds.value.delete(targetId)
      shieldChangedIds.value = new Set(shieldChangedIds.value)
    }, 5000) // aligné sur l'animation CSS fadeInOut (5s)
  })

  socket.on('game_over', (data) => {
    gameStatus.value = 'finished'
    pendingConfirm.value = null
    if (data.hostName) amIHost.value = (myName.value === data.hostName)
    winReason.value = data.reason
    // Gagnant toujours en premier
    const winner = data.players.find(p => p.id === data.winner?.id)
    const others = data.players.filter(p => p.id !== data.winner?.id)
    finalPlayers.value = winner ? [winner, ...others] : data.players
    finalWinner.value = data.winner
  })
})

// ============ RÉSOLUTION D'ATTAQUE SCÉNARISÉE ============
// À l'apparition d'une attaque : les cartes se retournent (CSS), le total
// grimpe progressivement, puis le verdict (dégâts / bloqué) apparaît.
watch(pendingAction, (pa) => {
  clearInterval(attackTween)
  clearTimeout(verdictTimer)
  verdictVisible.value = false

  if (!pa) { displayedAttackTotal.value = 0; return }

  const target = pa.attackTotal || 0
  displayedAttackTotal.value = 0
  const cardsDelay = 380 * (pa.attackCardCount || pa.attackCards?.length || 1) + 300
  const step = Math.max(1, Math.ceil(target / 24))

  verdictTimer = setTimeout(() => {
    attackTween = setInterval(() => {
      displayedAttackTotal.value = Math.min(target, displayedAttackTotal.value + step)
      if (displayedAttackTotal.value >= target) {
        clearInterval(attackTween)
        verdictTimer = setTimeout(() => { verdictVisible.value = true }, 900)
      }
    }, 110)
  }, cardsDelay)
}, { flush: 'post' })

onUnmounted(() => {
  clearInterval(attackTween)
  clearTimeout(verdictTimer)
  clearTimeout(toastTimer)
  clearTimeout(myShieldPulseTimer)
  socket.disconnect()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

/* ===== BASE ===== */
.board-wrapper, .board-wrapper *, .board-wrapper *::before, .board-wrapper *::after { box-sizing: border-box; }
.board-wrapper { height: 100vh; background: #080e1a; color: #e8eef8; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; overflow: hidden; }
button:focus-visible, [tabindex]:focus-visible { outline: 2px solid #7ab8ff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  /* Ce badge apparaît via une animation qui finit à opacity 0 : on le garde visible, c'est le JS qui le retire. */
  .shield-changed-badge { animation: none !important; opacity: 1 !important; }
}

/* ===== WAITING ===== */
.waiting-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; gap: 20px; }
.waiting-screen h1 { font-size: 2.5rem; color: #5ba3f5; margin: 0; }
.waiting-msg { color: #6f93c4; font-style: italic; font-size: 1rem; }
.share-box { background: #0d1829; padding: 20px 30px; border-radius: 12px; border: 1px solid rgba(60,120,220,0.25); }
.share-box p { margin: 0 0 12px 0; color: #8ab0d8; font-size: 1.1rem; }
.share-box strong { color: #5ba3f5; font-size: 1.4rem; }
.player-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 1.1rem; }
.rules-box {
  background: #0d1829; border: 1px solid rgba(60,120,220,0.15); border-radius: 14px;
  padding: 24px 30px; max-width: 620px; width: 100%;
}
.rules-box h3 { color: #5ba3f5; margin: 0 0 14px 0; font-size: 1.1rem; }
.rules-box p { color: #6f93c4; font-size: 0.9rem; margin: 0 0 8px 0; line-height: 1.6; }
.rules-box p strong { color: #8ab0d8; }

/* ===== TOP BAR ===== */
.playing-screen { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.top-bar { display: flex; align-items: center; gap: 16px; padding: 10px 20px; flex-shrink: 0; background: linear-gradient(180deg, #0d1829 0%, #080e1a 100%); border-bottom: 1px solid rgba(60,120,220,0.2); }
.top-bar h2 { font-size: 1.3rem; font-weight: 900; color: #5ba3f5; margin: 0; white-space: nowrap; }
.turn-indicator { flex: 1; font-size: 0.9rem; color: #6a90b8; margin: 0; }
.turn-indicator strong { color: #e8eef8; }
.deck-info { display: flex; gap: 8px; align-items: center; }
.deck-pill { display: flex; flex-direction: column; align-items: center; background: #0d1829; border: 1px solid #1e3a6a; border-radius: 10px; padding: 5px 14px; min-width: 64px; }
.deck-pill-label { font-size: 0.68rem; color: #6f93c4; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.deck-pill-value { font-size: 1.05rem; font-weight: 900; color: #8ab0d8; }
.discard-pill { border-color: rgba(91,163,245,0.35); background: #0d1a2e; }
.discard-pill .deck-pill-value { color: #5ba3f5; }

/* ===== ÉTAT "TON TOUR" ===== */
.my-turn-text { color: #7ab8ff; font-weight: 900; font-size: 1.05rem; letter-spacing: 1px; animation: turnPulse 1.6s ease-in-out infinite; }
.playing-screen.my-turn { box-shadow: inset 0 3px 0 #5ba3f5; }
.playing-screen.my-turn .top-bar { background: linear-gradient(180deg, #11253f 0%, #0a1526 100%); border-bottom-color: rgba(91,163,245,0.55); }
@keyframes turnPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

/* ===== ORDRE DU TOUR ===== */
.turn-order { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 20px; flex-shrink: 0; background: #060c16; border-bottom: 1px solid rgba(60,120,220,0.12); }
.turn-chip { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: #0d1829; border: 1px solid rgba(60,120,220,0.18); font-size: 0.8rem; font-weight: 700; color: #8ab0d8; transition: 0.2s; }
.turn-chip-dot { width: 7px; height: 7px; border-radius: 50%; background: #1e3a6a; flex-shrink: 0; }
.turn-chip.active { border-color: #5ba3f5; background: rgba(36,86,176,0.25); color: #dcecff; box-shadow: 0 0 12px rgba(91,163,245,0.25); }
.turn-chip.active .turn-chip-dot { background: #5ba3f5; }
.turn-chip.me .turn-chip-name { color: #7ab8ff; }
.turn-chip.dead { opacity: 0.4; text-decoration: line-through; }
.turn-chip-you { background: #2456b0; color: #a8d0ff; font-size: 0.6rem; padding: 1px 6px; border-radius: 6px; font-weight: 900; }

/* ===== RÉSOLUTION D'ATTAQUE (animée) ===== */
.card-reveal { animation: cardRevealIn 0.5s ease backwards; }
@keyframes cardRevealIn { from { opacity: 0; transform: rotateY(90deg) translateY(6px); } to { opacity: 1; transform: rotateY(0) translateY(0); } }
.verdict-slot { min-height: 1.7rem; display: flex; align-items: center; justify-content: center; }
.verdict-pop { animation: verdictPop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1); }
@keyframes verdictPop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }

/* ===== LAYOUT ===== */
.main-content { display: flex; flex: 1; overflow: hidden; min-height: 0; }

/* ===== LEFT PANEL ===== */
.left-panel { width: clamp(320px, 38vw, 580px); min-width: 0; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; padding: 16px; overflow-y: auto; background: #060c16; border-right: 1px solid rgba(60,120,220,0.12); }

/* ===== MODE SPECTATEUR (éliminé) ===== */
.spectator-panel { background: #0d1829; border: 1px solid rgba(60,120,220,0.25); border-radius: 16px; padding: 28px 20px; text-align: center; }
.spectator-skull { font-size: 3rem; line-height: 1; margin-bottom: 8px; filter: grayscale(0.3); }
.spectator-panel h3 { margin: 0 0 8px 0; color: #f0a0a0; font-size: 1.2rem; }
.spectator-panel p { margin: 0; color: #8ab0d8; font-size: 0.95rem; line-height: 1.5; }
.my-status-card { background: #0d1829; border-radius: 16px; padding: 16px; border: 1px solid rgba(60,120,220,0.25); }
.my-name { font-size: 1rem; font-weight: 700; color: #e8eef8; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.you-tag { background: #2456b0; color: #a8d0ff; font-size: 0.65rem; padding: 2px 7px; border-radius: 8px; font-weight: 900; }
.card-row { display: flex; gap: 16px; flex-wrap: wrap; }
.card-group { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.group-label { font-size: 0.74rem; color: #7ba7dc; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; display: flex; align-items: center; gap: 3px; min-height: 1.2em; }
.vis-icon { font-size: 0.75rem; opacity: 0.7; display: inline-block; width: 1em; text-align: center; }
.cards-display { display: flex; gap: 6px; }
.hp-sum { font-size: 0.8rem; color: #5ba3f5; font-weight: 700; }

/* ===== CARDS ===== */
.card { width: 96px; height: 136px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; gap: 4px; border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
.card-hp { background: linear-gradient(145deg, #ffffff, #e8f0ff); border-color: rgba(60,120,220,0.2); }
.card-shield { background: linear-gradient(145deg, #c8e0ff, #90b8f0); border-color: rgba(60,120,220,0.4); }
.card-shield.revealed { animation: shieldPulse 0.4s ease; border-color: #5ba3f5; box-shadow: 0 0 16px rgba(91,163,245,0.6); }
.card-shield.shield-pulse { animation: shieldPulse 0.45s ease; border-color: #5ba3f5; box-shadow: 0 0 18px rgba(91,163,245,0.7); }
.card-slot-empty { background: transparent; border: 2px dashed #1e3a6a; }
.card-empty { background: transparent; border: 2px dashed #35507f; color: #5b7db0; font-size: 1.2rem; }

/* ===== DOS DE CARTE (face cachée) ===== */
.card.card-back, .card.card-drawn-back {
  position: relative;
  font-weight: 900;
  color: rgba(122,184,255,0.32);          /* le "?" en filigrane */
  font-size: 1.9rem;
  text-shadow: 0 1px 0 rgba(0,0,0,0.45);
  border-color: #2c4a7a;
  background:
    repeating-linear-gradient(45deg,  rgba(122,184,255,0.08) 0 2px, transparent 2px 9px),
    repeating-linear-gradient(-45deg, rgba(122,184,255,0.08) 0 2px, transparent 2px 9px),
    linear-gradient(145deg, #0d1829, #1a2c4d);
}
/* Ta carte piochée : même dos, mais halo bleu pour ressortir */
.card.card-drawn-back { border-color: #5ba3f5; box-shadow: 0 0 16px rgba(91,163,245,0.4), 0 4px 12px rgba(0,0,0,0.4); }
.card-sm { width: 74px; height: 104px; border-radius: 11px; font-size: 0.75rem; gap: 3px; }
.card-suit { font-size: 2.1rem; line-height: 1; }
.card-val { font-size: 1.65rem; line-height: 1; color: #1a1a2e; font-weight: 900; }
.card-suit-sm { font-size: 1.55rem; line-height: 1; }
.card-val-sm { font-size: 1.3rem; line-height: 1; color: #1a1a2e; font-weight: 900; }
.red { color: #d63031; }
.black { color: #1a1a2e; }

/* ===== ZONE DE TOUR ===== */
.turn-zone { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(60,120,220,0.12); display: flex; flex-direction: column; align-items: center; gap: 10px; }
.turn-zone-label { font-size: 0.75rem; color: #93b4dc; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; align-self: flex-start; }
/* .turn-zone prefixe pour battre les règles .card des media queries */
.turn-zone .card-draw { width: 100%; max-width: 260px; height: 92px; background: linear-gradient(135deg, #2456b0, #1a3a80); border-color: #5ba3f5; color: #dcecff; flex-direction: row; gap: 14px; cursor: pointer; }
.card-draw .draw-icon { position: relative; width: 30px; height: 40px; flex-shrink: 0; }
.card-draw .draw-icon::before, .card-draw .draw-icon::after {
  content: ""; position: absolute; inset: 0; border-radius: 5px;
  background: #dcecff; border: 2px solid rgba(13,24,41,0.3);
}
.card-draw .draw-icon::before { transform: translate(-5px, -3px) rotate(-9deg); opacity: 0.55; }
.card-draw .draw-icon::after { transform: translate(3px, 2px) rotate(5deg); }
.card-draw .draw-text { font-size: 0.95rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.card-draw:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(36,86,176,0.55); }
.turn-hint { margin: 0; font-size: 0.82rem; line-height: 1.5; color: #93b4dc; text-align: center; }
.turn-hint b { color: #cfe3ff; }

/* ===== CARTES CLIQUABLES (actions) ===== */
.act { position: relative; cursor: pointer; transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s; }
.card.act { border-color: rgba(122,184,255,0.5); }   /* liseré discret quand la carte est actionnable */
.act:hover { transform: translateY(-3px); }
.act-attack:hover { box-shadow: 0 0 0 3px #f08080, 0 0 20px rgba(240,128,128,0.55); }
.act-shield:hover { box-shadow: 0 0 0 3px #5ba3f5, 0 0 20px rgba(91,163,245,0.55); }
.act-charge:hover { box-shadow: 0 0 0 3px #70d080, 0 0 20px rgba(112,208,128,0.55); }
/* Survoler une carte PV adverse met en évidence toutes ses cartes PV (on attaque le joueur) */
.opp-hp-group:hover .act-attack { box-shadow: 0 0 0 3px #f08080, 0 0 16px rgba(240,128,128,0.5); }
.act:focus-visible { outline: none; box-shadow: 0 0 0 3px #7ab8ff, 0 0 18px rgba(122,184,255,0.6); }
.act-hint { position: absolute; top: -12px; right: -12px; font-size: 1.05rem; background: #0d1829; border: 1px solid rgba(122,184,255,0.5); border-radius: 999px; width: 1.6em; height: 1.6em; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.7); transition: 0.15s; pointer-events: none; }
.act:hover .act-hint, .act:focus-visible .act-hint { opacity: 1; transform: scale(1); }

.waiting-turn { background: #0d1829; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid rgba(60,120,220,0.12); }
.waiting-turn p { margin: 0; font-size: 0.9rem; color: #6f93c4; }
.waiting-turn strong { color: #5ba3f5; }

/* ===== RIGHT PANEL ===== */
.right-panel { flex: 1; padding: 16px; overflow-y: auto; }
.opponents-title { font-size: 0.82rem; color: #8ab0d8; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0; }
.opponents-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; align-content: start; }
.opp-card { background: #0d1829; border-radius: 14px; padding: 14px 16px; border: 1px solid rgba(60,120,220,0.12); transition: 0.2s; position: relative; }
.opp-card.active { border-color: rgba(91,163,245,0.5); box-shadow: 0 0 14px rgba(91,163,245,0.12); }
.opp-card.eliminated { opacity: 0.35; }
.opp-card.targeted { border-color: #f08080; box-shadow: 0 0 16px rgba(240,128,128,0.25); }
.opp-card.attacker { border-color: #f08080; box-shadow: 0 0 14px rgba(240,128,128,0.15); }
.opp-header { margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
.opp-name { font-size: 1rem; font-weight: 700; color: #e8eef8; display: flex; align-items: center; gap: 6px; min-height: 1.6rem; }
.active-tag { color: #5ba3f5; font-size: 0.8rem; }
.opp-hp-total { font-size: 0.8rem; font-weight: 700; color: #5ba3f5; }
.elim-tag { font-size: 0.85rem; }
.opp-cards { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.opp-group { display: flex; align-items: center; gap: 5px; }
.opp-group-label { font-size: 0.85rem; margin-right: 2px; }
.shield-changed-badge { display: inline-flex; align-items: center; background: rgba(91,163,245,0.25); color: #a8d0ff; border: 1px solid rgba(91,163,245,0.6); border-radius: 8px; font-size: 0.9rem; font-weight: 700; padding: 4px 12px; white-space: nowrap; line-height: 1; animation: fadeInOut 5s ease forwards; }

/* ===== ATTACK MODAL ===== */
.attack-modal-overlay { position: fixed; inset: 0; background: rgba(4,8,16,0.75); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
.attack-modal { background: #0d1829; border: 1px solid rgba(240,128,128,0.3); border-radius: 18px; padding: 28px 32px; min-width: 300px; max-width: 420px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
.attack-modal-title { font-size: 0.85rem; color: #6a90b8; text-align: center; }
.attack-modal-title strong { color: #e8eef8; }
.attack-modal-waiting { font-size: 0.75rem; color: #6f93c4; font-style: italic; }

/* ===== ATTACK SHARED ===== */
.attack-face-off { display: flex; align-items: center; justify-content: center; gap: 16px; width: 100%; }
.face-off-side { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.face-off-label { font-size: 0.7rem; color: #6a90b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.face-off-cards { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
.face-off-total { font-size: 1.3rem; font-weight: 900; }
.face-off-vs { font-size: 0.9rem; color: #6f93c4; font-weight: 700; flex-shrink: 0; }
.attack-total { color: #f08080; }
.shield-total { color: #5ba3f5; }
.dmg-text { color: #f08080; font-size: 1.3rem; font-weight: 900; }
.blocked-text { color: #5ba3f5; font-size: 1.1rem; font-weight: 700; }

/* ===== ATTACK MODAL — CIBLE ===== */
.attack-modal-target { border-color: rgba(176,48,80,0.65); box-shadow: 0 0 0 1px rgba(176,48,80,0.35), 0 20px 60px rgba(0,0,0,0.7); }
.attack-modal-title.target { font-size: 1rem; color: #f0a0a0; }
.attack-modal-title.target strong { color: #ffd0d0; }
.btn-resolve { background: #b03050; color: white; border: none; border-radius: 8px; padding: 10px 32px; font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: 0.15s; margin-top: 4px; }
.btn-resolve:hover { background: #d04060; }

/* ===== JOURNAL ===== */
.log-panel { background: #040810; border-top: 1px solid rgba(60,120,220,0.12); flex-shrink: 0; max-height: 19vh; min-height: 76px; display: flex; flex-direction: column; }
.log-panel-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 2px; color: #8ab0d8; font-weight: 700; padding: 6px 20px 2px; flex-shrink: 0; }
.log-list { list-style: none; margin: 0; padding: 0 20px 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.log-list li { font-size: 0.85rem; color: #8ab0d8; line-height: 1.4; }
.log-list li.log-latest { color: #7ab8ff; font-weight: 700; }

/* ===== TOAST ===== */
.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: #0d1829; border: 1px solid rgba(91,163,245,0.5); color: #a8d0ff; padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 0.9rem; z-index: 200; box-shadow: 0 10px 30px rgba(0,0,0,0.6); animation: toastIn 0.2s ease; }
@keyframes toastIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* ===== CONFIRM ===== */
.confirm-overlay { position: fixed; inset: 0; background: rgba(4,8,16,0.75); z-index: 150; display: flex; align-items: center; justify-content: center; padding: 20px; }
.confirm-modal { background: #0d1829; border: 1px solid rgba(60,120,220,0.35); border-radius: 18px; padding: 26px 28px; max-width: 400px; width: 100%; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
.confirm-title { font-size: 1.1rem; font-weight: 900; color: #5ba3f5; }
.confirm-recap { font-size: 0.9rem; color: #8ab0d8; line-height: 1.55; margin: 0; }
.confirm-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
.btn-confirm-ok, .btn-confirm-cancel { border: none; border-radius: 9px; padding: 10px 20px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: 0.15s; }
.btn-confirm-ok { background: linear-gradient(135deg, #2456b0, #1a3a80); color: #a8d0ff; }
.btn-confirm-ok:hover { background: linear-gradient(135deg, #3a70d0, #2456b0); }
.btn-confirm-cancel { background: #060c16; color: #6a90b8; border: 1px solid #1e3a6a; }
.btn-confirm-cancel:hover { color: #a8d0ff; border-color: #5ba3f5; }

/* ===== BUTTONS ===== */
.btn-primary { background: linear-gradient(135deg, #2456b0, #1a3a80); color: #a8d0ff; border: none; padding: 14px 28px; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; }
.btn-primary:hover { background: linear-gradient(135deg, #3a70d0, #2456b0); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(36,86,176,0.5); }
.btn-secondary { background: #0d1829; color: #6a90b8; border: 1px solid #1e3a6a; padding: 10px 18px; border-radius: 8px; font-family: 'Outfit', sans-serif; cursor: pointer; transition: 0.2s; font-weight: 700; }
.btn-secondary:hover { background: #162340; border-color: #5ba3f5; color: #a8d0ff; }

/* ===== GAME OVER ===== */
.game-over-screen { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }
.results-box { background: #0d1829; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.7); max-width: 500px; width: 100%; border: 1px solid rgba(60,120,220,0.25); text-align: center; }
.results-box h2 { font-size: 2.5rem; margin-bottom: 10px; color: #5ba3f5; }
.results-box .reason { font-size: 1.1rem; color: #7ba0cf; margin-bottom: 30px; }
.scoreboard { display: flex; flex-direction: column; gap: 8px; margin-bottom: 30px; }
.score-line { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #060c16; }
.score-line.winner { background: rgba(36,86,176,0.2); border: 1px solid rgba(91,163,245,0.35); }
.score-line .rank { font-size: 1.2rem; }
.score-line .name { flex: 1; font-weight: 700; color: #e8eef8; }
.score-line .status { font-size: 0.85rem; color: #6f93c4; }
.score-line.winner .status { color: #5ba3f5; font-weight: 700; }
.host-actions { margin-top: 10px; }

@keyframes shieldPulse { 0%{transform:scale(1)} 50%{transform:scale(1.1)} 100%{transform:scale(1)} }
@keyframes fadeInOut { 0%{opacity:0} 10%{opacity:1} 80%{opacity:1} 100%{opacity:0} }

/* ===== RESPONSIVE ===== */
@media (max-width: 1180px) {
  .left-panel { width: clamp(300px, 34vw, 420px); }
  .card { width: 74px; height: 104px; }
  .card-suit { font-size: 1.7rem; }
  .card-val { font-size: 1.35rem; }
  .card-sm { width: 58px; height: 82px; }
  .card-suit-sm { font-size: 1.3rem; }
  .card-val-sm { font-size: 1.1rem; }
  .opponents-list { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
}

@media (max-width: 768px) {
  .board-wrapper { height: auto; min-height: 100vh; overflow-y: auto; overflow-x: hidden; }
  .playing-screen { height: auto; min-height: 100vh; overflow: visible; }
  .main-content { flex-direction: column; overflow: visible; }
  .left-panel { width: 100%; min-width: 0; border-right: none; border-bottom: 1px solid rgba(60,120,220,0.1); overflow: visible; }
  .right-panel { overflow: visible; }
  .top-bar { flex-wrap: wrap; gap: 8px; }
  .card { width: 60px; height: 86px; }
  .card-suit { font-size: 1.5rem; }
  .card-val { font-size: 1.2rem; }
  .card-sm { width: 46px; height: 66px; }
  .card-suit-sm { font-size: 1.15rem; }
  .card-val-sm { font-size: 0.95rem; }
  .turn-zone .card-draw { max-width: none; height: 72px; gap: 12px; }
  .card-draw .draw-icon { width: 24px; height: 32px; }
  .attack-modal { padding: 20px 18px; }
  .turn-order { padding: 6px 12px; }
  .turn-chip { font-size: 0.74rem; padding: 3px 8px; }
  .log-panel { max-height: none; min-height: 0; }
  .log-list { max-height: 40vh; }
  .opponents-list { grid-template-columns: 1fr; }
}

@media (max-width: 460px) {
  .top-bar { padding: 8px 12px; }
  .top-bar h2 { font-size: 1.1rem; }
  .card-row { gap: 10px; justify-content: center; }
  .act-hint { top: -8px; right: -8px; font-size: 0.9rem; }
  .turn-hint { font-size: 0.78rem; }
  .turn-zone .card-draw { height: 62px; gap: 10px; }
  .card-draw .draw-icon { width: 22px; height: 30px; }
  .card-draw .draw-text { font-size: 0.85rem; }
}
</style>