<template>
  <div class="dutch-wrapper">
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- Animation « DUTCH ! » -->
    <div v-if="dutchFlash" class="dutch-flash">
      <div class="df-halo">📣</div>
      <div class="df-word">DUTCH&#8202;!</div>
      <div class="df-who">{{ dutchFlash }} · dernier tour pour les autres</div>
    </div>

    <!-- ============ SALLE D'ATTENTE ============ -->
    <div v-if="gameStatus === 'waiting'" class="waiting-screen">
      <h1>Dutch 🃏</h1>
      <div class="share-box">
        <p>Code de la table : <strong>{{ roomCode }}</strong></p>
        <button class="btn-secondary" @click="copyLink">{{ copyText }}</button>
      </div>

      <div class="lobby-cols">
        <div class="lobby-panel">
          <h3>Joueurs ({{ allConnectedPlayers.length }}/8)</h3>
          <ul class="player-list">
            <li v-for="p in allConnectedPlayers" :key="p.id" :class="{ me: p.id === socket.id }">
              👤 {{ p.name }} <span v-if="p.isHost" class="host-tag">hôte</span>
            </li>
          </ul>
        </div>
        <div class="lobby-panel">
          <h3>Rappel des règles</h3>
          <ul class="rules-list">
            <li>Regarde 2 de tes 4 cartes, puis mémorise-les.</li>
            <li>Pioche, puis échange ou défausse. Si un Valet part à la défausse : échange 2 cartes · une Dame : regarde 1 carte.</li>
            <li>Snap à tout moment sur la défausse (erreur = pénalité).</li>
            <li>Dutch : juste après avoir pioché. Le plus petit total gagne la manche.</li>
          </ul>
        </div>
      </div>

      <template v-if="amIHost">
        <p v-if="allConnectedPlayers.length < 2" class="waiting-msg">Il faut au moins 2 joueurs…</p>
        <button
          class="btn-primary"
          :disabled="allConnectedPlayers.length < 2 || allConnectedPlayers.length > 8"
          @click="startGame"
        >LANCER LA PARTIE</button>
      </template>
      <p v-else class="waiting-msg">En attente de l'hôte…</p>
    </div>

    <!-- ============ PARTIE ============ -->
    <div v-else-if="state" class="table-screen">
      <!-- Bandeau -->
      <div class="topbar">
        <div class="tb-left">
          <span class="tb-title">Dutch</span>
          <span class="tb-sub">Pioche : {{ state.deckCount }}</span>
        </div>
        <div class="tb-right">
          <span v-if="state.dutchPlayerName" class="tb-dutch">📣 {{ state.dutchPlayerName }} a annoncé Dutch</span>
          <span v-if="state.status === 'playing' && state.phase !== 'peek'" class="tb-turn">
            🎯 {{ state.isMyTurn ? 'À toi' : state.currentPlayerName }}
          </span>
        </div>
      </div>

      <!-- Tapis -->
      <div class="felt">
        <!-- Adversaires -->
        <div class="opponents">
          <div
            v-for="p in opponents"
            :key="p.id"
            class="seat"
            :class="{ turn: p.isCurrent && state.status === 'playing', dutch: p.isDutch }"
          >
            <div class="seat-head">
              <span class="seat-nom">{{ p.name }}</span>
              <span v-if="p.isDutch" class="dutch-badge">📣 Dutch</span>
              <span v-if="state.phase === 'peek'" class="ready-dot" :class="{ ok: p.ready }">{{ p.ready ? '✓' : '…' }}</span>
            </div>
            <div class="seat-sub">
              {{ p.cardCount }} carte{{ p.cardCount > 1 ? 's' : '' }}
              <span v-if="state.status === 'finished'" class="seat-score"> · {{ scoreOf(p.id) }} pts</span>
              <span v-if="p.wins" class="seat-wins"> · 🏆 {{ p.wins }}</span>
            </div>
            <div class="seat-cards">
              <template v-for="(s, i) in p.slots" :key="i">
                <div
                  v-if="s"
                  class="slot"
                  :class="{ target: choosingTarget, selected: isSelected(p.id, s.slot), peeked: isPeekTarget(p.id, s.slot) }"
                  @click="onTarget(p.id, s.slot)"
                >
                  <DutchCard :card="s.card" class="mini-card" />
                </div>
                <div v-else class="slot-empty mini"></div>
              </template>
            </div>
          </div>
        </div>

        <!-- Pioche / défausse / carte piochée -->
        <div class="center">
          <div class="pile">
            <div class="pile-wrap" :class="{ active: canDraw }" @click="canDraw && act('draw')">
              <DutchCard :card="null" class="pile-card" />
              <span class="pile-count">{{ state.deckCount }}</span>
            </div>
            <span class="pile-label">Pioche</span>
          </div>
          <div class="pile">
            <DutchCard v-if="state.topDiscard" :key="state.topDiscard.id" :card="state.topDiscard" class="pile-card discard-in" />
            <div v-else class="slot-empty pile-empty"></div>
            <span class="pile-label">Défausse</span>
          </div>
          <div v-if="state.hasDrawn" class="pile drawn">
            <DutchCard :card="state.drawnCard" class="pile-card" :class="{ mine: state.isMyTurn }" />
            <span class="pile-label">{{ state.isMyTurn ? 'Ta carte' : `Carte de ${state.currentPlayerName}` }}</span>
          </div>
          <div v-if="peekedCard" class="pile drawn">
            <DutchCard :card="peekedCard.card" class="pile-card peek-card" />
            <span class="pile-label">{{ peekedCard.label }}</span>
          </div>
        </div>

        <!-- À qui de jouer (+ actions) -->
        <div v-if="feltText" class="felt-panel" :class="{ you: feltMine }">
          <div class="fp-text">{{ feltText }}</div>
          <div v-if="feltSub" class="fp-sub">{{ feltSub }}</div>
          <div v-if="hasActions" class="fp-actions">
            <button v-if="state.phase === 'peek' && !state.myReady" class="btn-act take"
              :disabled="state.myPeekedCount < 2" @click="act('ready')">J'ai mémorisé ✓</button>

            <template v-if="state.phase === 'decide' && state.isMyTurn">
              <button v-if="!state.dutchPlayerName" class="btn-act dutch" @click="act('dutch')">📣 Annoncer Dutch</button>
              <button class="btn-act" @click="act('discard_drawn')">{{ discardLabel }}</button>
            </template>

            <template v-if="state.phase === 'power' && state.isMyTurn">
              <button v-if="state.powerType === 'queen_seen'" class="btn-act take" @click="act('ack_peek')">C'est noté 👍</button>
              <button v-else class="btn-act" @click="act('skip_power')">Passer le pouvoir</button>
            </template>
          </div>
        </div>
      </div>

      <!-- Zone du bas : moi -->
      <div v-if="me" class="my-zone" :class="{ turn: me.isCurrent && state.status === 'playing' }">
        <div class="my-head">
          <strong>{{ me.name }}</strong>
          <span v-if="me.isDutch" class="dutch-badge">📣 Dutch</span>
          <span class="my-sub">· {{ me.cardCount }} carte{{ me.cardCount > 1 ? 's' : '' }}</span>
          <span v-if="state.status === 'finished'" class="my-score">· {{ scoreOf(me.id) }} pts</span>
          <span v-if="snapOpen" class="snap-hint">⚡ Snap : clique une carte de valeur {{ rankLabel(state.topDiscard?.rank) }}</span>
        </div>
        <div class="my-hand">
          <template v-for="(s, i) in me.slots" :key="i">
            <div
              v-if="s"
              class="hand-card"
              :class="{
                playable: myCardAction(s) === 'peek' || myCardAction(s) === 'swap',
                target: myCardAction(s) === 'target',
                snappable: myCardAction(s) === 'snap',
                selected: isSelected(me.id, s.slot),
                peeked: isPeekTarget(me.id, s.slot) || (state.phase === 'peek' && s.card),
              }"
              @click="onMyCard(s)"
            >
              <DutchCard :card="s.card" class="hc" />
              <span class="hc-num">{{ i + 1 }}</span>
            </div>
            <div v-else class="slot-empty hand-empty"></div>
          </template>
        </div>
      </div>

      <!-- Manches gagnées (desktop large) -->
      <div class="score-sheet">
        <div class="ss-head">Manches gagnées</div>
        <div class="ss-scroll">
          <table class="ss-table">
            <tbody>
              <tr v-for="p in winsTable" :key="p.id" :class="{ mine: p.id === state.myId }">
                <td>{{ p.name }}</td>
                <td>{{ p.wins }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Journal -->
      <div class="log-panel" v-if="gameLogs.length">
        <ul class="log-list">
          <li v-for="(l, i) in gameLogs" :key="i" :class="{ latest: i === 0 }">{{ l }}</li>
        </ul>
      </div>

      <!-- Récap de manche -->
      <div v-if="state.status === 'finished' && state.results && showRecap" class="recap-overlay" @click.self="showRecap = false">
        <div class="recap-modal">
          <div class="recap-head">
            <span class="recap-hand">Manche terminée</span>
            <h2 :class="iWon ? 'ok' : 'ko'">
              {{ state.results.winnerNames.length > 1 ? 'Victoire partagée' : `Victoire de ${state.results.winnerNames[0]}` }}
            </h2>
            <p class="recap-line">{{ state.results.reason }}</p>
            <p v-if="state.results.dutchName" class="recap-line">
              Dutch de <strong>{{ state.results.dutchName }}</strong> :
              <span :class="state.results.dutchSuccess ? 'txt-ok' : 'txt-ko'">{{ state.results.dutchSuccess ? 'réussi ✅' : 'raté 💥' }}</span>
            </p>
          </div>

          <table class="recap-table">
            <thead>
              <tr><th>Joueur</th><th>Points</th><th>Cartes</th><th>Manches</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in state.results.players" :key="p.id" :class="{ win: p.isWinner, mine: p.id === state.myId }">
                <td>{{ p.isWinner ? '🏆 ' : '' }}{{ p.name }}<span v-if="p.isDeclarer" class="muted"> 📣</span></td>
                <td>{{ p.score }}</td>
                <td>{{ p.cardCount }}</td>
                <td>{{ p.wins }}</td>
              </tr>
            </tbody>
          </table>

          <div class="recap-actions">
            <template v-if="amIHost">
              <button class="btn-primary" @click="startGame">Nouvelle manche</button>
              <button class="btn-secondary" @click="gameStatus = 'waiting'">Retour au salon</button>
            </template>
            <p v-else class="waiting-msg">En attente de l'hôte…</p>
            <button class="btn-link" @click="showRecap = false">Voir la table</button>
          </div>
        </div>
      </div>
      <button v-if="state.status === 'finished' && !showRecap" class="reopen-btn" @click="showRecap = true">🏆 Résultats</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import DutchCard from './DutchCard.vue'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

const gameStatus = ref('waiting') // 'waiting' | 'playing' | 'finished'
const allConnectedPlayers = ref([])
const amIHost = ref(false)
const state = ref(null)
const gameLogs = ref([]) // le plus récent en premier
const showRecap = ref(true)

// ── Socket ───────────────────────────────────────────────────────
onMounted(() => {
  socket.on('connect', () => {
    const savedName = localStorage.getItem('temp_player_name')
    if (savedName) socket.emit('set_player_name', { name: savedName, roomCode })
    else router.push(`/dutch/join/${roomCode}`)
  })

  socket.on('room_full', (message) => {
    alert(message)
    socket.disconnect()
    router.push('/')
  })

  socket.on('dutch_error', (message) => showToast(message))

  socket.on('update_players_list', (list) => {
    allConnectedPlayers.value = list
    const me = list.find(p => p.id === socket.id)
    if (me) amIHost.value = me.isHost
  })

  socket.on('game_started', () => {
    gameStatus.value = 'playing'
    gameLogs.value = []
    showRecap.value = true
  })

  socket.on('dutch_state', (data) => {
    state.value = data
    gameStatus.value = data.status
  })

  socket.on('action_log', (msg) => {
    gameLogs.value.unshift(msg)
    if (gameLogs.value.length > 60) gameLogs.value.pop()
    if (msg.startsWith('⚡') || msg.startsWith('❌')) showToast(msg)
  })
})

onUnmounted(() => {
  socket.disconnect()
  clearTimeout(toastTimer)
  clearTimeout(flashTimer)
})

const startGame = () => socket.emit('start_dutch', roomCode)
const act = (actionType, payload = {}) => socket.emit('dutch_action', { roomCode, actionType, payload })

// ── Toast & animation Dutch ─────────────────────────────────────
const toast = ref('')
let toastTimer = null
const showToast = (msg) => {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

const dutchFlash = ref('')
let flashTimer = null
watch(() => state.value?.dutchPlayerName, (name, prev) => {
  if (name && !prev && state.value?.status === 'playing') {
    dutchFlash.value = name
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => { dutchFlash.value = '' }, 2600)
  }
})

const copyText = ref('📋 Copier le lien d\'invitation')
const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/dutch/join/${roomCode}`)
    copyText.value = '✅ Lien copié !'
  } catch {
    copyText.value = '❌ Erreur de copie'
  }
  setTimeout(() => { copyText.value = '📋 Copier le lien d\'invitation' }, 2000)
}

// ── Données dérivées ─────────────────────────────────────────────
const me = computed(() => state.value?.players.find(p => p.id === state.value.myId))
const opponents = computed(() => state.value?.players.filter(p => p.id !== state.value.myId) || [])
const winsTable = computed(() => [...(state.value?.players || [])].sort((a, b) => b.wins - a.wins))
const iWon = computed(() => !!state.value?.results?.players.find(p => p.id === state.value.myId)?.isWinner)

const RANK_LABELS = { A: 'As', J: 'Valet', Q: 'Dame', K: 'Roi' }
const rankLabel = (rank) => RANK_LABELS[rank] || rank || '?'

const scoreOf = (id) => state.value?.results?.players.find(p => p.id === id)?.score ?? '–'

const canDraw = computed(() => state.value?.phase === 'draw' && state.value?.isMyTurn && state.value?.status === 'playing')

// Le joueur actif qui doit jouer sa carte piochée (ou son pouvoir) clique pour ça, pas pour snapper.
const busyWithTurn = computed(() => state.value?.isMyTurn && ['decide', 'power'].includes(state.value?.phase))
const snapOpen = computed(() => !!state.value?.canSnap && !busyWithTurn.value)

// ── Cibles du Valet / de la Dame ─────────────────────────────────
const jackSelection = ref([])
// Clé texte : la sélection n'est remise à zéro que si la phase / le pouvoir / le joueur change,
// pas à chaque diffusion d'état (ex. : un adversaire qui snappe pendant qu'on choisit).
watch(() => `${state.value?.phase}|${state.value?.powerType}|${state.value?.currentPlayerId}`, () => { jackSelection.value = [] })

// Carte regardée avec la Dame : affichée en grand au centre de la table.
const peekedCard = computed(() => {
  const t = state.value?.peekTarget
  if (!t) return null
  const owner = state.value.players.find(p => p.id === t.playerId)
  const card = owner?.slots[t.slot]?.card
  if (!card) return null
  const whose = owner.id === state.value.myId ? 'Ta carte' : `Carte de ${owner.name}`
  return { card, label: `${whose} n°${t.slot + 1}` }
})

const choosingTarget = computed(() =>
  state.value?.phase === 'power' && state.value?.isMyTurn
  && (state.value?.powerType === 'jack' || state.value?.powerType === 'queen'))

const isSelected = (playerId, slot) => jackSelection.value.some(t => t.playerId === playerId && t.slot === slot)
const isPeekTarget = (playerId, slot) => {
  const t = state.value?.peekTarget
  return !!t && t.playerId === playerId && t.slot === slot
}

const onTarget = (playerId, slot) => {
  if (!choosingTarget.value) return
  if (state.value.powerType === 'queen') return act('queen_peek', { target: { playerId, slot } })

  if (isSelected(playerId, slot)) {
    jackSelection.value = jackSelection.value.filter(t => !(t.playerId === playerId && t.slot === slot))
    return
  }
  jackSelection.value = [...jackSelection.value, { playerId, slot }]
  if (jackSelection.value.length === 2) {
    const [a, b] = jackSelection.value
    act('jack_swap', { a, b })
  }
}

// ── Mes cartes ───────────────────────────────────────────────────
const myCardAction = (s) => {
  const st = state.value
  if (!st || st.status !== 'playing') return null
  if (st.phase === 'peek') return !st.myReady && st.myPeekedCount < 2 && !s.card ? 'peek' : null
  if (st.isMyTurn && st.phase === 'decide') return 'swap'
  if (choosingTarget.value) return 'target'
  if (snapOpen.value) return 'snap'
  return null
}

const onMyCard = (s) => {
  switch (myCardAction(s)) {
    case 'peek':   return act('peek_initial', { slot: s.slot })
    case 'swap':   return act('swap', { slot: s.slot })
    case 'target': return onTarget(me.value.id, s.slot)
    case 'snap':   return act('snap', { slot: s.slot })
  }
}

// ── Textes du panneau central ────────────────────────────────────
const discardLabel = computed(() => {
  const rank = state.value?.drawnCard?.rank
  if (rank === 'J') return 'Défausser · pouvoir du Valet'
  if (rank === 'Q') return 'Défausser · pouvoir de la Dame'
  return 'Défausser'
})

const feltMine = computed(() => {
  const st = state.value
  if (!st || st.status !== 'playing') return false
  if (st.phase === 'peek') return !st.myReady
  return st.isMyTurn
})

const feltText = computed(() => {
  const st = state.value
  if (!st) return ''
  if (st.status === 'finished') return '🏁 Manche terminée · toutes les cartes sont révélées'
  const name = st.currentPlayerName
  switch (st.phase) {
    case 'peek':
      if (st.myReady) return 'En attente des autres joueurs…'
      return st.myPeekedCount < 2 ? `Regarde ${2 - st.myPeekedCount} de tes cartes` : 'Mémorise bien tes 2 cartes !'
    case 'draw':
      return st.isMyTurn ? 'À toi : clique sur la pioche' : `${name} pioche…`
    case 'decide':
      return st.isMyTurn ? 'Échange avec une de tes cartes, ou défausse' : `${name} réfléchit…`
    case 'power':
      if (!st.isMyTurn) return `${name} utilise ${st.powerType === 'jack' ? 'le Valet' : 'la Dame'}…`
      if (st.powerType === 'jack') return `Valet : choisis 2 cartes à échanger (${jackSelection.value.length}/2)`
      if (st.powerType === 'queen') return 'Dame : choisis une carte à regarder'
      return 'Voici la carte (au centre) : mémorise-la !'
    default:
      return ''
  }
})

const feltSub = computed(() => {
  const st = state.value
  if (!st || st.status !== 'playing') return ''
  if (st.phase === 'peek' && !st.myReady) return 'Elles seront recachées quand tu valides.'
  if (st.phase === 'decide' && st.isMyTurn && !st.dutchPlayerName) return 'Tu peux annoncer Dutch maintenant (juste après la pioche).'
  if (st.phase === 'power' && st.isMyTurn && st.powerType === 'jack') return 'N\'importe quelles cartes, les tiennes comprises.'
  return ''
})

const hasActions = computed(() => {
  const st = state.value
  if (!st || st.status !== 'playing') return false
  if (st.phase === 'peek') return !st.myReady
  return st.isMyTurn && ['decide', 'power'].includes(st.phase)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
.dutch-wrapper, .dutch-wrapper *, .dutch-wrapper *::before, .dutch-wrapper *::after { box-sizing: border-box; }

.dutch-wrapper { min-height: 100vh; background: #0b1424; color: #e8eef7; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; }

/* toast */
.toast {
  position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 300; max-width: calc(100% - 32px);
  background: #13223a; border: 1px solid rgba(255,154,60,0.5); color: #ffe2c4;
  padding: 12px 22px; border-radius: 10px; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,0.6); text-align: center;
}

/* animation « DUTCH ! » */
.dutch-flash { position: fixed; inset: 0; z-index: 250; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(5,10,20,0.74); animation: dfFade 2.6s ease forwards; pointer-events: none; overflow: hidden; }
.df-halo { position: absolute; font-size: 42vmin; line-height: 1; opacity: 0.14; animation: dfHalo 2.6s ease-out forwards; }
.df-word { position: relative; font-size: clamp(2.8rem, 12vw, 5.4rem); font-weight: 900; color: #ff9a3c; letter-spacing: 6px; text-shadow: 0 6px 28px rgba(0,0,0,0.7); animation: dfPop 0.55s cubic-bezier(0.2,1.5,0.35,1); }
.df-who { position: relative; margin-top: 10px; font-size: 1.2rem; font-weight: 700; color: #ffe2c4; text-align: center; padding: 0 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.6); animation: dfPop 0.55s 0.1s cubic-bezier(0.2,1.5,0.35,1) backwards; }
@keyframes dfFade { 0%{opacity:0} 8%{opacity:1} 82%{opacity:1} 100%{opacity:0} }
@keyframes dfPop { from { transform: scale(0.45) rotate(-4deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes dfHalo { 0%{transform:scale(0.4); opacity:0} 20%{opacity:0.16} 100%{transform:scale(1.35); opacity:0} }
@media (prefers-reduced-motion: reduce) {
  .dutch-flash, .df-word, .df-who, .df-halo { animation: none !important; opacity: 1 !important; }
  .df-halo { opacity: 0.12 !important; }
}

/* ===== salle d'attente ===== */
.waiting-screen { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 30px 16px; }
.waiting-screen h1 { font-size: 2.4rem; color: #ff9a3c; margin: 0; }
.waiting-msg { color: #5f7899; font-style: italic; margin: 0; }
.share-box { background: #13223a; padding: 16px 24px; border-radius: 12px; border: 1px solid rgba(255,154,60,0.22); text-align: center; }
.share-box p { margin: 0 0 10px 0; color: #a9bfdc; }
.share-box strong { color: #ff9a3c; font-size: 1.3rem; }
.lobby-cols { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; width: 100%; max-width: 760px; }
.lobby-panel { background: #13223a; border: 1px solid rgba(255,154,60,0.15); border-radius: 14px; padding: 16px 18px; flex: 1 1 260px; min-width: 0; }
.lobby-panel h3 { margin: 0 0 12px 0; color: #ff9a3c; font-size: 1rem; }
.player-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.player-list li.me { color: #ffd28a; font-weight: 700; }
.host-tag { background: #c95a12; color: #fff7ee; font-size: 0.6rem; padding: 1px 6px; border-radius: 6px; font-weight: 900; }
.rules-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; color: #a9bfdc; font-size: 0.86rem; line-height: 1.45; }

.btn-primary { background: linear-gradient(135deg, #f07c22, #c95a12); color: #fff7ee; border: none; padding: 14px 28px; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: 0.2s; }
.btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #ff8f3a, #db6618); transform: translateY(-2px); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-secondary { background: #13223a; color: #a9bfdc; border: 1px solid #2a3f5f; padding: 10px 18px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-weight: 700; cursor: pointer; transition: 0.2s; }
.btn-secondary:hover { border-color: #ff9a3c; color: #fff7ee; }
.btn-link { background: none; border: none; color: #7f97b8; font-family: 'Outfit', sans-serif; font-size: 0.85rem; cursor: pointer; text-decoration: underline; }
.btn-link:hover { color: #e8eef7; }

/* ===== table ===== */
.table-screen { flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 18px; background: #13223a; border-bottom: 1px solid rgba(255,154,60,0.2); flex-wrap: wrap; }
.tb-left, .tb-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tb-title { font-weight: 900; color: #ff9a3c; }
.tb-sub { font-size: 0.85rem; color: #7f97b8; }
.tb-dutch {
  font-size: 0.85rem; font-weight: 800; color: #ffd28a; padding: 3px 10px; border-radius: 999px;
  background: rgba(255,154,60,0.14); border: 1px solid rgba(255,154,60,0.55);
}
.tb-turn { font-size: 0.85rem; font-weight: 700; color: #e8eef7; padding: 3px 10px; border-radius: 999px; background: #0b1424; border: 1px solid #2a3f5f; }

.felt {
  position: relative; flex: 1; min-height: 460px; margin: 14px; border-radius: 20px;
  display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 16px; padding: 14px;
  background: radial-gradient(ellipse at center, #1d4f86 0%, #143a66 65%, #0e2c50 100%);
  border: 2px solid #1d4f86; box-shadow: inset 0 0 60px rgba(0,0,0,0.4);
}

/* adversaires */
.opponents { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 14px; width: 100%; }
.seat { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 10px; border-radius: 12px; border: 1px solid transparent; transition: 0.2s; }
.seat.turn { background: rgba(255,154,60,0.14); box-shadow: 0 0 16px rgba(255,154,60,0.3); }
.seat.dutch { border-color: rgba(255,154,60,0.55); }
.seat-head { display: flex; align-items: center; gap: 6px; font-weight: 700; }
.seat-nom { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seat-sub { font-size: 0.72rem; color: #a9c3e6; }
.seat-score { color: #ffd28a; font-weight: 800; }
.seat-wins { color: #ffd28a; }
.seat-cards { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; justify-content: center; max-width: 280px; }
.mini-card { width: 46px; height: 66px; }
.slot { border-radius: 6px; transition: transform 0.12s ease, box-shadow 0.12s ease; }
/* cibles d'un pouvoir (Valet / Dame) : anneau qui pulse pour bien montrer qu'il faut cliquer */
.slot.target, .hand-card.target { cursor: pointer; animation: targetPulse 1.2s ease-in-out infinite; }
.slot.target:hover { transform: translateY(-4px); animation: none; box-shadow: 0 0 0 3px #ffd28a, 0 0 18px rgba(255,210,138,0.7); }
.hand-card.target:hover { transform: translateY(-12px); animation: none; box-shadow: 0 0 0 3px #ffd28a, 0 0 18px rgba(255,210,138,0.7); }
@keyframes targetPulse {
  0%,100% { box-shadow: 0 0 0 2px rgba(255,210,138,0.55), 0 0 6px rgba(255,210,138,0.2); }
  50%     { box-shadow: 0 0 0 3px rgba(255,210,138,1),    0 0 18px rgba(255,210,138,0.65); }
}
@media (prefers-reduced-motion: reduce) { .slot.target, .hand-card.target { animation: none; box-shadow: 0 0 0 3px #ffd28a; } }
.slot.selected, .slot.target.selected { transform: translateY(-4px); animation: none; box-shadow: 0 0 0 3px #ff9a3c, 0 0 16px rgba(255,154,60,0.6); }
.slot.peeked { box-shadow: 0 0 0 3px #5fe0a0, 0 0 16px rgba(95,224,160,0.55); }
.slot-empty { border: 1.5px dashed rgba(169,195,230,0.3); border-radius: 6px; flex-shrink: 0; }
.slot-empty.mini { width: 46px; height: 66px; }

.dutch-badge { background: rgba(255,154,60,0.16); border: 1px solid rgba(255,154,60,0.55); color: #ffb366; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.ready-dot { font-size: 0.7rem; font-weight: 900; color: #7f97b8; }
.ready-dot.ok { color: #5fe0a0; }

/* centre : pioche / défausse */
.center { display: flex; align-items: flex-end; justify-content: center; gap: 26px; }
.pile { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pile-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #a9c3e6; }
.pile-card { width: 96px; height: 140px; border-radius: 7px; }
.pile-empty { width: 96px; height: 140px; border-radius: 7px; }
.pile-wrap { position: relative; isolation: isolate; border-radius: 7px; transition: transform 0.15s ease, box-shadow 0.15s ease; }
.pile-wrap::before { content: ''; position: absolute; inset: 0; transform: translate(3px, 3px); border-radius: 7px; background: #0c2140; z-index: -1; }
.pile-wrap.active { cursor: pointer; animation: pilePulse 1.5s ease-in-out infinite; }
.pile-wrap.active:hover { transform: translateY(-6px); }
.pile-count {
  position: absolute; top: -8px; right: -8px; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 900;
  color: #0b1424; background: #ffd28a; border: 2px solid #0b1424;
}
.pile.drawn { padding-left: 22px; border-left: 1px dashed rgba(169,195,230,0.3); }
.pile-card.mine { box-shadow: 0 0 0 3px #ffd28a, 0 0 22px rgba(255,210,138,0.5); }
.pile-card.peek-card { box-shadow: 0 0 0 3px #5fe0a0, 0 0 22px rgba(95,224,160,0.55); animation: discardIn 0.3s cubic-bezier(0.2,0.75,0.3,1); }
.discard-in { animation: discardIn 0.3s cubic-bezier(0.2,0.75,0.3,1); }
@keyframes pilePulse {
  0%,100% { box-shadow: 0 0 0 3px rgba(255,210,138,0.75), 0 0 16px rgba(255,210,138,0.35); }
  50%     { box-shadow: 0 0 0 4px rgba(255,210,138,1),    0 0 30px rgba(255,210,138,0.7); }
}
@keyframes discardIn { from { opacity: 0; transform: translateY(-30px) rotate(-8deg) scale(0.85); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .pile-wrap.active, .discard-in { animation: none; } }

/* bandeau « à qui de jouer » */
.felt-panel {
  max-width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: rgba(5,12,24,0.8); border: 1px solid rgba(169,195,230,0.3);
  padding: 9px 20px; border-radius: 16px; box-shadow: 0 6px 22px rgba(0,0,0,0.55); text-align: center;
}
.felt-panel.you { border-color: rgba(255,210,138,0.6); box-shadow: 0 0 26px rgba(255,210,138,0.35); }
.fp-text { font-weight: 800; font-size: 1rem; color: #dbe7f7; }
.felt-panel.you .fp-text { color: #ffd28a; animation: youPulse 1.6s ease-in-out infinite; }
.fp-sub { font-size: 0.78rem; color: #a9c3e6; }
.fp-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; margin-top: 2px; }
@keyframes youPulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
@media (prefers-reduced-motion: reduce) { .felt-panel.you .fp-text { animation: none; } }

.btn-act { background: #1a3050; color: #dbe7f7; border: 1px solid #2f4b73; border-radius: 8px; padding: 8px 16px; font-family: 'Outfit', sans-serif; font-weight: 700; cursor: pointer; transition: 0.15s; font-size: 0.95rem; }
.btn-act:hover:not(:disabled) { border-color: #ff9a3c; background: #203a60; }
.btn-act:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-act.take { background: #2b6a4a; border-color: #3f8a64; }
.btn-act.dutch { background: linear-gradient(135deg, #f07c22, #c95a12); border-color: #ff9a3c; color: #fff7ee; }
.btn-act.dutch:hover { background: linear-gradient(135deg, #ff8f3a, #db6618); }

/* ma zone */
.my-zone { padding: 8px 14px 14px; background: #0e1a2e; border-top: 1px solid rgba(255,154,60,0.18); transition: 0.2s; }
.my-zone.turn { box-shadow: inset 0 3px 0 #ff9a3c; }
.my-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.9rem; }
.my-sub { color: #7f97b8; font-size: 0.82rem; }
.my-score { color: #ffd28a; font-weight: 800; font-size: 0.85rem; }
.snap-hint { margin-left: auto; font-size: 0.78rem; font-weight: 700; color: #ffb366; background: rgba(255,154,60,0.1); border: 1px solid rgba(255,154,60,0.35); padding: 3px 10px; border-radius: 999px; }

.my-hand { display: flex; align-items: flex-end; justify-content: safe center; gap: 12px; padding: 24px 6px 10px; overflow-x: auto; overflow-y: hidden; }
.hand-card { position: relative; flex-shrink: 0; border-radius: 7px; transition: transform 0.12s ease, box-shadow 0.12s ease; }
.hand-card .hc { width: 104px; height: 152px; }
.hc-num {
  position: absolute; bottom: -9px; left: 50%; transform: translateX(-50%); z-index: 3;
  min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900;
  color: #0b1424; background: #a9c3e6; border: 2px solid #0e1a2e;
}
.hand-card.playable { cursor: pointer; box-shadow: 0 0 0 2px rgba(255,210,138,0.6); }
.hand-card.playable:hover { transform: translateY(-14px); box-shadow: 0 0 0 2px #ffd28a, 0 12px 24px rgba(0,0,0,0.5); }
.hand-card.snappable { cursor: pointer; }
.hand-card.snappable:hover { transform: translateY(-10px); box-shadow: 0 0 0 2px #ff9a3c, 0 0 18px rgba(255,154,60,0.5); }
.hand-card.snappable:hover::after {
  content: '⚡ Snap'; position: absolute; top: -22px; left: 50%; transform: translateX(-50%);
  font-size: 0.72rem; font-weight: 800; color: #ffb366; white-space: nowrap;
}
.hand-card.selected, .hand-card.target.selected { transform: translateY(-14px); animation: none; box-shadow: 0 0 0 3px #ff9a3c, 0 0 18px rgba(255,154,60,0.6); }
.hand-card.peeked { box-shadow: 0 0 0 3px #5fe0a0, 0 0 18px rgba(95,224,160,0.55); }
.hand-empty { width: 104px; height: 152px; border-radius: 7px; }
@media (prefers-reduced-motion: reduce) { .hand-card, .slot { transform: none !important; } }

/* journal */
.log-panel { background: #08101d; border-top: 1px solid rgba(255,154,60,0.12); height: 92px; flex-shrink: 0; overflow: hidden; }
.log-list { list-style: none; margin: 0; padding: 6px 16px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.log-list li { font-size: 0.82rem; color: #7f97b8; }
.log-list li.latest { color: #ffb366; font-weight: 700; }

/* récap */
.recap-overlay { position: fixed; inset: 0; background: rgba(5,10,20,0.82); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.recap-modal { background: #13223a; border: 1px solid rgba(255,154,60,0.3); border-radius: 18px; padding: 24px 26px; max-width: 480px; width: 100%; max-height: 100%; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
.recap-head { text-align: center; }
.recap-hand { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1.5px; color: #7f97b8; font-weight: 700; }
.recap-modal h2 { margin: 4px 0 10px 0; font-size: 1.8rem; text-align: center; }
.recap-modal h2.ok { color: #5fe0a0; }
.recap-modal h2.ko { color: #ff9a3c; }
.recap-line { text-align: center; color: #a9bfdc; margin: 0 0 4px 0; font-size: 0.95rem; }
.recap-line strong { color: #fff7ee; }
.txt-ok { color: #5fe0a0; font-weight: 800; }
.txt-ko { color: #ff7b6b; font-weight: 800; }
.recap-table { width: 100%; border-collapse: collapse; margin: 16px 0 18px; }
.recap-table th, .recap-table td { padding: 8px 10px; text-align: right; font-size: 0.95rem; }
.recap-table thead th { color: #7f97b8; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,154,60,0.22); }
.recap-table td:first-child, .recap-table th:first-child { text-align: left; }
.recap-table tbody td { color: #dbe7f7; font-variant-numeric: tabular-nums; border-bottom: 1px solid rgba(169,195,230,0.08); }
.recap-table tbody tr.win td { color: #5fe0a0; font-weight: 800; }
.recap-table tbody tr.mine td:first-child { text-decoration: underline; text-decoration-color: rgba(255,210,138,0.6); text-underline-offset: 3px; }
.recap-table .muted { color: #7f97b8; font-weight: 400; }
.recap-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.reopen-btn {
  position: fixed; bottom: 20px; right: 20px; z-index: 150; background: linear-gradient(135deg, #f07c22, #c95a12); color: #fff7ee; border: none;
  padding: 12px 20px; border-radius: 10px; font-family: 'Outfit', sans-serif; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(240,124,34,0.35);
}

@media (max-width: 640px) {
  .felt { min-height: 380px; margin: 8px; padding: 10px 6px; }
  .mini-card, .slot-empty.mini { width: 34px; height: 49px; }
  .seat { padding: 4px 6px; }
  .seat-cards { gap: 3px; max-width: 170px; }
  .pile-card, .pile-empty { width: 66px; height: 96px; }
  .center { gap: 14px; }
  .pile.drawn { padding-left: 12px; }
  .my-hand { gap: 6px; }
  .hand-card .hc, .hand-empty { width: 60px; height: 88px; }
  .snap-hint { margin-left: 0; }
  .recap-table th, .recap-table td { padding: 7px 6px; font-size: 0.88rem; }
}

/* Manches gagnées : colonne de droite sur desktop large, comme la feuille de score de la Belote */
.score-sheet { display: none; }
@media (min-width: 900px) {
  .table-screen {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
  }
  .topbar    { grid-column: 1 / -1; grid-row: 1; }
  .felt      { grid-column: 1; grid-row: 2; margin: 14px 10px 8px 14px; }
  .my-zone   { grid-column: 1; grid-row: 3; }
  .log-panel { grid-column: 1 / -1; grid-row: 4; }

  .score-sheet {
    grid-column: 2; grid-row: 2 / 4; display: flex; flex-direction: column;
    width: clamp(200px, 18vw, 260px); background: #0e1a2e; border-left: 1px solid rgba(255,154,60,0.18); overflow: hidden;
  }
  .ss-head { flex-shrink: 0; padding: 12px 14px 9px; font-weight: 800; font-size: 0.82rem; color: #a9bfdc; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid rgba(255,154,60,0.18); }
  .ss-scroll { flex: 1; overflow: auto; }
  .ss-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  .ss-table td { padding: 8px 14px; color: #dbe7f7; border-bottom: 1px solid rgba(169,195,230,0.06); }
  .ss-table td:last-child { text-align: right; font-weight: 900; color: #ffd28a; font-variant-numeric: tabular-nums; }
  .ss-table tr.mine td:first-child { color: #ffd28a; font-weight: 700; }
  .ss-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.025); }
}
</style>
