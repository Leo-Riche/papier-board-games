<template>
  <div class="board-wrapper">

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
    <div v-else-if="gameStatus === 'playing'" class="playing-screen">

      <!-- Top bar -->
      <div class="top-bar">
        <h2>CHARGER 🛡️</h2>
        <p class="turn-indicator">
          <span v-if="isActivePlayer">⭐ C'est ton tour !</span>
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

      <!-- Main layout -->
      <div class="main-content">

        <!-- LEFT: My hand + actions -->
        <div class="left-panel">

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
                  <div class="card card-shield" v-if="myPlayer?.shield && !myPlayer.shield.hidden">
                    <span class="card-suit" :class="suitColor(myPlayer.shield.suit)">{{ myPlayer.shield.suit }}</span>
                    <span class="card-val">{{ cardVal(myPlayer.shield.value) }}</span>
                  </div>
                  <div class="card card-back" v-else>?</div>
                </div>
              </div>

              <!-- Charged cards -->
              <div class="card-group">
                <div class="group-label">☢️ Chargeeer</div>
                <div class="cards-display">
                  <div v-for="i in myPlayer?.chargedCount || 0" :key="'ch'+i" class="card card-back">?</div>
                  <div v-if="!myPlayer?.chargedCount" class="card card-empty">—</div>
                </div>
              </div>
            </div>

            <!-- Drawn card -->
            <div v-if="myPlayer?.hasDrawnCard" class="drawn-card-section">
              <div class="drawn-label">Carte piochée :</div>
              <div class="card card-drawn-back">🃏</div>
            </div>
          </div>

          <!-- Action buttons -->
          <div v-if="isActivePlayer && !pendingAction" class="actions-section">

            <!-- Step 1: Draw -->
            <div v-if="!myPlayer?.hasDrawnCard" class="step">
              <p class="step-hint">Pioche une carte pour commencer ton tour.</p>
              <button class="btn-action btn-draw" @click="drawCard">PIOCHER</button>
            </div>

            <!-- Step 2: Choose action -->
            <div v-else-if="myPlayer?.hasDrawnCard" class="step">
              <p class="step-hint">Que fais-tu avec cette carte ?</p>

              <!-- Attack -->
              <div class="action-block">
                <p class="action-title">⚔️ Attaquer</p>
                <p class="action-desc" v-if="myPlayer?.chargedCount">
                  Tu attaqueras avec {{ (myPlayer.chargedCount || 0) + 1 }} carte(s) (obligatoire).
                </p>
                <div class="target-buttons">
                  <button v-for="t in aliveOpponents" :key="t.id" class="btn-target btn-attack" @click="attack(t.id)">{{ t.name }}</button>
                </div>
              </div>

              <!-- Change shield -->
              <div class="action-block">
                <p class="action-title">🛡️ Changer un bouclier</p>
                <div class="target-buttons">
                  <button class="btn-target btn-shield-self" @click="changeShield(myId)">Mon bouclier</button>
                  <button v-for="t in aliveOpponents" :key="t.id" class="btn-target btn-shield" @click="changeShield(t.id)">{{ t.name }}</button>
                </div>
              </div>

              <!-- Charge -->
              <div class="action-block">
                <p class="action-title">☢️ Chargeeer</p>
                <div class="target-buttons">
                  <button class="btn-target btn-charge" :disabled="myPlayer?.chargedCount >= 2" @click="charge(myId)">
                    Moi <span class="charged-count">({{ myPlayer?.chargedCount || 0 }}/2)</span>
                  </button>
                  <button v-for="t in aliveOpponents" :key="t.id" class="btn-target btn-charge" :disabled="t.chargedCount >= 2" @click="charge(t.id)">
                    {{ t.name }} <span class="charged-count">({{ t.chargedCount }}/2)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="!isActivePlayer" class="waiting-turn">
            <p>En attente de <strong>{{ activePlayerName }}</strong>...</p>
          </div>
        </div>

        <!-- RIGHT: Opponents -->
        <div class="right-panel">
          <h4 class="opponents-title">Adversaires</h4>
          <div class="opponents-list" :class="opponents.length >= 4 ? 'opponents-grid' : ''">
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
                <!-- HP -->
                <div class="opp-group">
                  <span class="opp-group-label">❤️</span>
                  <div v-for="(c, i) in opp.hp" :key="i" class="card card-sm card-hp">
                    <span class="card-suit-sm" :class="suitColor(c.suit)">{{ c.suit }}</span>
                    <span class="card-val-sm">{{ cardVal(c.value) }}</span>
                  </div>
                </div>

                <!-- Shield -->
                <div class="opp-group">
                  <span class="opp-group-label">🛡️</span>
                  <div v-if="opp.shield && !opp.shield.hidden" class="card card-sm card-shield revealed">
                    <span class="card-suit-sm" :class="suitColor(opp.shield.suit)">{{ opp.shield.suit }}</span>
                    <span class="card-val-sm">{{ cardVal(opp.shield.value) }}</span>
                  </div>
                  <div v-else class="card card-sm card-back">?</div>
                </div>

                <!-- Charged -->
                <div class="opp-group" v-if="opp.chargedCount > 0">
                  <span class="opp-group-label">☢️</span>
                  <div v-for="i in opp.chargedCount" :key="i" class="card card-sm card-back">?</div>
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
                <div v-for="(c, i) in pendingAction.attackCards" :key="i" class="card card-sm card-hp">
                  <span class="card-suit-sm" :class="suitColor(c.suit)">{{ c.suit }}</span>
                  <span class="card-val-sm">{{ cardVal(c.value) }}</span>
                </div>
              </div>
              <div class="face-off-total attack-total">{{ pendingAction.attackTotal }}</div>
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
          <div v-if="pendingAction.attackTotal > (players.find(p => p.id === pendingAction.targetId)?.shield?.value ?? 0)" class="dmg-text">
            − {{ pendingAction.attackTotal - (players.find(p => p.id === pendingAction.targetId)?.shield?.value ?? 0) }} PV
          </div>
          <div v-else class="blocked-text">Bloqué !</div>
          <div class="attack-modal-waiting">En attente de {{ players.find(p => p.id === pendingAction.targetId)?.name }}...</div>
        </div>
      </div>

      <!-- Attack banner (cible) -->
      <div v-if="pendingAction && pendingAction.targetId === myId" class="attack-banner">
        <div class="attack-face-off">
          <div class="face-off-side">
            <div class="face-off-label">⚔️ Attaque</div>
            <div class="face-off-cards">
              <div v-for="(c, i) in pendingAction.attackCards" :key="i" class="card card-sm card-hp">
                <span class="card-suit-sm" :class="suitColor(c.suit)">{{ c.suit }}</span>
                <span class="card-val-sm">{{ cardVal(c.value) }}</span>
              </div>
            </div>
            <div class="face-off-total attack-total">{{ pendingAction.attackTotal }}</div>
          </div>
          <div class="face-off-vs">vs</div>
          <div class="face-off-side">
            <div class="face-off-label">🛡️ Bouclier</div>
            <div class="face-off-cards">
              <div v-if="myPlayer?.shield && !myPlayer.shield.hidden" class="card card-sm card-shield">
                <span class="card-suit-sm" :class="suitColor(myPlayer.shield.suit)">{{ myPlayer.shield.suit }}</span>
                <span class="card-val-sm">{{ cardVal(myPlayer.shield.value) }}</span>
              </div>
            </div>
            <div class="face-off-total shield-total">{{ myPlayer?.shield?.value }}</div>
          </div>
        </div>
        <div v-if="pendingAction.attackTotal > myPlayer?.shield?.value" class="dmg-text">− {{ pendingAction.attackTotal - myPlayer?.shield?.value }} PV</div>
        <div v-else class="blocked-text">Bloqué !</div>
        <button class="btn-resolve" @click="resolveAttack">OK</button>
      </div>

      <!-- Logs -->
      <div class="logs-bar" v-if="gameLogs.length">
        <span class="log-latest">{{ gameLogs[0] }}</span>
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
        <div v-if="amIHost" class="host-actions">
          <button class="btn-primary" @click="startGame">REJOUER</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
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

// ============ COMPUTED ============
const myPlayer = computed(() => players.value.find(p => p.id === myId.value))
const myName = computed(() => myPlayer.value?.name || allConnectedPlayers.value.find(p => p.id === socket.id)?.name || '')
const myHpSum = computed(() => myPlayer.value?.hp?.reduce((s, c) => s + (c.value || 0), 0) ?? 0)
const isActivePlayer = computed(() => myId.value === activePlayerId.value)
const activePlayerName = computed(() => players.value.find(p => p.id === activePlayerId.value)?.name || '')
const opponents = computed(() => players.value.filter(p => p.id !== myId.value))
const aliveOpponents = computed(() => opponents.value.filter(p => !p.eliminated))

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
function copyLink() {
  const link = `${window.location.origin}/charger/join/${roomCode}`
  navigator.clipboard.writeText(link).then(() => alert("Lien copié !"))
}

// ============ SOCKET ============
onMounted(() => {
  const sendName = () => {
    const savedName = localStorage.getItem('temp_player_name')
    if (savedName) socket.emit('set_player_name', { name: savedName, roomCode })
  }
  if (socket.connected) { sendName() } else { socket.on('connect', sendName) }

  socket.on('room_full', (msg) => { alert(msg); socket.disconnect(); router.push('/') })

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
    deckCount.value = data.deckCount
    discardTop.value = data.discardTop
    pendingAction.value = data.pendingAction
  })

  socket.on('action_log', (msg) => {
    gameLogs.value.unshift(msg)
    if (gameLogs.value.length > 6) gameLogs.value.pop()
  })

  socket.on('shield_changed', ({ targetId }) => {
    shieldChangedIds.value = new Set([...shieldChangedIds.value, targetId])
    setTimeout(() => {
      shieldChangedIds.value.delete(targetId)
      shieldChangedIds.value = new Set(shieldChangedIds.value)
    }, 3000)
  })

  socket.on('game_over', (data) => {
    gameStatus.value = 'finished'
    winReason.value = data.reason
    // Gagnant toujours en premier
    const winner = data.players.find(p => p.id === data.winner?.id)
    const others = data.players.filter(p => p.id !== data.winner?.id)
    finalPlayers.value = winner ? [winner, ...others] : data.players
    finalWinner.value = data.winner
  })
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

/* ===== BASE ===== */
.board-wrapper { height: 100vh; background: #080e1a; color: #e8eef8; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; overflow: hidden; }

/* ===== WAITING ===== */
.waiting-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; gap: 20px; }
.waiting-screen h1 { font-size: 2.5rem; color: #5ba3f5; margin: 0; }
.waiting-msg { color: #3a5a8a; font-style: italic; font-size: 1rem; }
.share-box { background: #0d1829; padding: 20px 30px; border-radius: 12px; border: 1px solid rgba(60,120,220,0.25); }
.share-box p { margin: 0 0 12px 0; color: #8ab0d8; font-size: 1.1rem; }
.share-box strong { color: #5ba3f5; font-size: 1.4rem; }
.player-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; font-size: 1.1rem; }
.rules-box {
  background: #0d1829; border: 1px solid rgba(60,120,220,0.15); border-radius: 14px;
  padding: 24px 30px; max-width: 620px; width: 100%;
}
.rules-box h3 { color: #5ba3f5; margin: 0 0 14px 0; font-size: 1.1rem; }
.rules-box p { color: #3a5a8a; font-size: 0.9rem; margin: 0 0 8px 0; line-height: 1.6; }
.rules-box p strong { color: #8ab0d8; }

/* ===== TOP BAR ===== */
.playing-screen { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.top-bar { display: flex; align-items: center; gap: 16px; padding: 10px 20px; flex-shrink: 0; background: linear-gradient(180deg, #0d1829 0%, #080e1a 100%); border-bottom: 1px solid rgba(60,120,220,0.2); }
.top-bar h2 { font-size: 1.3rem; font-weight: 900; color: #5ba3f5; margin: 0; white-space: nowrap; }
.turn-indicator { flex: 1; font-size: 0.9rem; color: #6a90b8; margin: 0; }
.turn-indicator strong { color: #e8eef8; }
.deck-info { display: flex; gap: 8px; align-items: center; }
.deck-pill { display: flex; flex-direction: column; align-items: center; background: #0d1829; border: 1px solid #1e3a6a; border-radius: 10px; padding: 5px 14px; min-width: 64px; }
.deck-pill-label { font-size: 0.55rem; color: #3a5a8a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.deck-pill-value { font-size: 1.05rem; font-weight: 900; color: #8ab0d8; }
.discard-pill { border-color: rgba(91,163,245,0.35); background: #0d1a2e; }
.discard-pill .deck-pill-value { color: #5ba3f5; }

/* ===== LAYOUT ===== */
.main-content { display: flex; flex: 1; overflow: hidden; min-height: 0; }

/* ===== LEFT PANEL ===== */
.left-panel { width: 600px; min-width: 540px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; padding: 16px; overflow-y: auto; background: #060c16; border-right: 1px solid rgba(60,120,220,0.12); }
.my-status-card { background: #0d1829; border-radius: 16px; padding: 16px; border: 1px solid rgba(60,120,220,0.25); }
.my-name { font-size: 1rem; font-weight: 700; color: #e8eef8; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.you-tag { background: #2456b0; color: #a8d0ff; font-size: 0.65rem; padding: 2px 7px; border-radius: 8px; font-weight: 900; }
.card-row { display: flex; gap: 16px; flex-wrap: wrap; }
.card-group { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.group-label { font-size: 0.7rem; color: #3a5a8a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; display: flex; align-items: center; gap: 3px; min-height: 1.2em; }
.vis-icon { font-size: 0.75rem; opacity: 0.7; display: inline-block; width: 1em; text-align: center; }
.cards-display { display: flex; gap: 6px; }
.hp-sum { font-size: 0.8rem; color: #5ba3f5; font-weight: 700; }

/* ===== CARDS ===== */
.card { width: 96px; height: 136px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; gap: 4px; border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
.card-hp { background: linear-gradient(145deg, #ffffff, #e8f0ff); border-color: rgba(60,120,220,0.2); }
.card-shield { background: linear-gradient(145deg, #c8e0ff, #90b8f0); border-color: rgba(60,120,220,0.4); }
.card-shield.revealed { animation: shieldPulse 0.4s ease; border-color: #5ba3f5; box-shadow: 0 0 16px rgba(91,163,245,0.6); }
.card-back { background: linear-gradient(145deg, #0d1829, #162340); border-color: #1e3a6a; font-size: 1.1rem; color: #4a7aaa; font-weight: 900; }
.card-drawn-back { background: linear-gradient(145deg, #162340, #1e3a6a); border-color: #5ba3f5; font-size: 1.8rem; font-weight: 900; color: #5ba3f5; box-shadow: 0 0 14px rgba(91,163,245,0.35); }
.card-empty { background: transparent; border: 2px dashed #1e3a6a; color: #1e3a6a; font-size: 1.2rem; }
.card-sm { width: 74px; height: 104px; border-radius: 11px; font-size: 0.75rem; gap: 3px; }
.card-suit { font-size: 2.1rem; line-height: 1; }
.card-val { font-size: 1.65rem; line-height: 1; color: #1a1a2e; font-weight: 900; }
.card-suit-sm { font-size: 1.55rem; line-height: 1; }
.card-val-sm { font-size: 1.3rem; line-height: 1; color: #1a1a2e; font-weight: 900; }
.red { color: #d63031; }
.black { color: #1a1a2e; }

.drawn-card-section { margin-top: 14px; display: flex; align-items: center; gap: 14px; padding-top: 14px; border-top: 1px solid rgba(60,120,220,0.12); }
.drawn-label { font-size: 0.75rem; color: #3a5a8a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }

/* ===== ACTIONS ===== */
.actions-section { display: flex; flex-direction: column; gap: 10px; }
.step-hint { font-size: 0.85rem; color: #4a7aaa; margin: 0 0 8px 0; }
.btn-draw { width: 100%; padding: 14px; border: none; border-radius: 10px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; transition: 0.2s; background: linear-gradient(135deg, #2456b0, #1a3a80); color: #a8d0ff; }
.btn-draw:hover { background: linear-gradient(135deg, #3a70d0, #2456b0); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(36,86,176,0.5); }
.action-block { background: #060c16; border-radius: 10px; padding: 10px 12px; border: 1px solid rgba(60,120,220,0.1); }
.action-title { font-size: 0.8rem; font-weight: 700; color: #5ba3f5; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 1px; }
.action-desc { font-size: 0.75rem; color: #3a5a8a; margin: 0 0 6px 0; }
.target-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.btn-target { padding: 7px 14px; border: none; border-radius: 8px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 0.85rem; font-weight: 700; transition: 0.15s; white-space: nowrap; }
.btn-target:disabled { opacity: 0.3; cursor: not-allowed; }
.btn-attack { background: #2a0e1a; color: #f08080; border: 1px solid #6a2030; }
.btn-attack:hover { background: #3a1020; border-color: #f08080; transform: translateY(-1px); }
.btn-shield-self { background: #0e2040; color: #70c0f8; border: 1px solid #1e4080; }
.btn-shield-self:hover { background: #142a50; border-color: #70c0f8; }
.btn-shield { background: #0e1a30; color: #90a8e0; border: 1px solid #1a2a50; }
.btn-shield:hover { background: #142240; border-color: #90a8e0; }
.btn-charge { background: #0e1e10; color: #70d080; border: 1px solid #1a4020; }
.btn-charge:hover:not(:disabled) { background: #142818; border-color: #70d080; }
.charged-count { font-size: 0.7rem; opacity: 0.7; margin-left: 2px; }
.waiting-turn { background: #0d1829; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid rgba(60,120,220,0.12); }
.waiting-turn p { margin: 0; font-size: 0.9rem; color: #3a5a8a; }
.waiting-turn strong { color: #5ba3f5; }

/* ===== RIGHT PANEL ===== */
.right-panel { flex: 1; padding: 16px; overflow-y: auto; }
.opponents-title { font-size: 0.75rem; color: #3a5a8a; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0; }
.opponents-list { display: flex; flex-direction: column; gap: 10px; }
.opponents-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
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
.attack-modal-waiting { font-size: 0.75rem; color: #3a5a8a; font-style: italic; }

/* ===== ATTACK SHARED ===== */
.attack-face-off { display: flex; align-items: center; justify-content: center; gap: 16px; width: 100%; }
.face-off-side { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.face-off-label { font-size: 0.7rem; color: #6a90b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.face-off-cards { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
.face-off-total { font-size: 1.3rem; font-weight: 900; }
.face-off-vs { font-size: 0.9rem; color: #3a5a8a; font-weight: 700; flex-shrink: 0; }
.attack-total { color: #f08080; }
.shield-total { color: #5ba3f5; }
.dmg-text { color: #f08080; font-size: 1.3rem; font-weight: 900; }
.blocked-text { color: #5ba3f5; font-size: 1.1rem; font-weight: 700; }

/* ===== ATTACK BANNER ===== */
.attack-banner { background: #100818; border-top: 2px solid #b03050; padding: 14px 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; flex-shrink: 0; }
.btn-resolve { background: #b03050; color: white; border: none; border-radius: 8px; padding: 8px 24px; font-family: 'Outfit', sans-serif; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: 0.15s; }
.btn-resolve:hover { background: #d04060; }

/* ===== LOGS ===== */
.logs-bar { background: #040810; padding: 7px 20px; border-top: 1px solid rgba(60,120,220,0.08); flex-shrink: 0; }
.log-latest { font-size: 0.82rem; font-weight: 600; color: #5ba3f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

/* ===== BUTTONS ===== */
.btn-primary { background: linear-gradient(135deg, #2456b0, #1a3a80); color: #a8d0ff; border: none; padding: 14px 28px; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; }
.btn-primary:hover { background: linear-gradient(135deg, #3a70d0, #2456b0); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(36,86,176,0.5); }
.btn-secondary { background: #0d1829; color: #6a90b8; border: 1px solid #1e3a6a; padding: 10px 18px; border-radius: 8px; font-family: 'Outfit', sans-serif; cursor: pointer; transition: 0.2s; font-weight: 700; }
.btn-secondary:hover { background: #162340; border-color: #5ba3f5; color: #a8d0ff; }

/* ===== GAME OVER ===== */
.game-over-screen { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }
.results-box { background: #0d1829; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.7); max-width: 500px; width: 100%; border: 1px solid rgba(60,120,220,0.25); text-align: center; }
.results-box h2 { font-size: 2.5rem; margin-bottom: 10px; color: #5ba3f5; }
.results-box .reason { font-size: 1.1rem; color: #4a7aaa; margin-bottom: 30px; }
.scoreboard { display: flex; flex-direction: column; gap: 8px; margin-bottom: 30px; }
.score-line { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #060c16; }
.score-line.winner { background: rgba(36,86,176,0.2); border: 1px solid rgba(91,163,245,0.35); }
.score-line .rank { font-size: 1.2rem; }
.score-line .name { flex: 1; font-weight: 700; color: #e8eef8; }
.score-line .status { font-size: 0.85rem; color: #3a5a8a; }
.score-line.winner .status { color: #5ba3f5; font-weight: 700; }
.host-actions { margin-top: 10px; }

@keyframes shieldPulse { 0%{transform:scale(1)} 50%{transform:scale(1.1)} 100%{transform:scale(1)} }
@keyframes fadeInOut { 0%{opacity:0} 10%{opacity:1} 80%{opacity:1} 100%{opacity:0} }

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .board-wrapper { height: auto; min-height: 100vh; overflow-y: auto; }
  .playing-screen { height: auto; min-height: 100vh; overflow: visible; }
  .main-content { flex-direction: column; overflow: visible; }
  .left-panel { width: 100%; min-width: 0; border-right: none; border-bottom: 1px solid rgba(60,120,220,0.1); overflow: visible; }
  .right-panel { overflow: visible; }
  .top-bar { flex-wrap: wrap; gap: 8px; }
  .card { width: 48px; height: 68px; }
  .card-sm { width: 36px; height: 50px; }
  .attack-banner { padding: 12px 16px; }
}
</style>