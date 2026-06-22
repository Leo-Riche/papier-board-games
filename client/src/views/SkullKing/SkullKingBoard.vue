<template>
  <div class="sk-wrapper">

    <!-- ============ WAITING SCREEN ============ -->
    <div v-if="gameStatus === 'waiting'" class="waiting-screen">
      <h1>SKULL KING 💀👑</h1>
      <div class="share-box">
        <p>Partage ce code avec ton équipage :</p>
        <strong class="room-code">{{ roomCode }}</strong>
        <button class="btn-secondary" @click="copyLink">📋 Copier le lien</button>
      </div>

      <ul class="player-list">
        <li v-for="p in allConnectedPlayers" :key="p.id">
          <span class="player-icon">{{ p.id === socket.id ? '⭐' : '🏴‍☠️' }}</span>
          <span class="player-name-txt">{{ p.name }}</span>
          <span v-if="p.isHost" class="host-tag">Capitaine</span>
        </li>
      </ul>

      <div class="player-count-info" :class="{ ok: canStart, warn: !canStart }">
        {{ allConnectedPlayers.length }}/8 joueurs
        <span v-if="allConnectedPlayers.length < 3"> — encore {{ 3 - allConnectedPlayers.length }} requis</span>
      </div>

      <div class="ext-toggle" :class="{ active: withExtensions }">
        <div class="ext-toggle-info">
          <span class="ext-label">EXTENSIONS</span>
          <span class="ext-desc">{{ withExtensions ? '🐙 Kraken · 🐋 Baleine · 💰 Butin · 🃏 cartes d\'extension' : 'Jeu de base uniquement' }}</span>
        </div>
        <button class="ext-btn" :class="{ on: withExtensions }" :disabled="!amIHost"
                @click="toggleExtensions" :title="amIHost ? '' : 'Seul le capitaine peut changer ce mode'">
          <span class="ext-switch-knob"></span>
        </button>
      </div>

      <button v-if="amIHost" class="btn-primary" :disabled="!canStart" @click="startGame">
        LEVER L'ANCRE 🏴‍☠️
      </button>
      <p v-else class="waiting-msg">En attente du capitaine...</p>

      <div class="rules-reminder">
        <h3>Rappel des règles</h3>
        <ul>
          <li>🎯 À chaque manche, misez le nombre <strong>exact</strong> de plis que vous ferez</li>
          <li>🃏 Manche N = N cartes distribuées (10 manches)</li>
          <li>🏴‍☠️ Le <strong>noir (Drapeau pirate)</strong> est l'atout</li>
          <li>💀 Skull King &gt; Pirates &gt; Sirènes &gt; Skull King</li>
          <li>✅ Mise exacte = 20 pts/pli · ❌ Erreur = -10 par écart</li>
        </ul>
      </div>
    </div>

    <!-- ============ GAME SCREENS ============ -->
    <div v-else class="play-screen">

      <!-- TOP BAR -->
      <div class="top-bar">
        <h2>SKULL KING</h2>
        <div class="round-pill">Manche <strong>{{ roundNumber }}</strong>/{{ totalRounds }}
          <span class="round-cards">· {{ cardsThisRound }} carte{{ cardsThisRound > 1 ? 's' : '' }}</span>
        </div>
        <div class="phase-pill" :class="phase">
          {{ phase === 'bidding' ? '🎯 Mises' : phase === 'playing' ? '🏴‍☠️ Plis' : phase === 'roundEnd' ? '📊 Décompte' : '👑 Fin' }}
        </div>
        <div class="my-score">Mon score : <strong>{{ myScore }}</strong></div>
        <button class="btn-help" @click="showHelp = true" title="Aide">❓</button>
      </div>

      <!-- ============ BODY : colonne joueurs + zone principale ============ -->
      <div class="play-body">

        <!-- LEFT : colonne des joueurs -->
        <aside class="players-column">
          <div class="players-col-title">JOUEURS</div>
          <div v-for="p in players" :key="p.id" class="player-box"
               :class="{ me: p.name === myName, turn: p.isCurrentTurn, leader: phase === 'bidding' && p.isLeader }">
            <span v-if="p.isCurrentTurn" class="pb-turn-tag">à son tour</span>
            <span v-else-if="phase === 'bidding' && p.isLeader" class="pb-turn-tag starter">🚩 commence</span>
            <div class="pb-row">
              <span class="pb-name">
                <span v-if="p.isDealer" class="pb-dealer" title="Donneur">🎴</span>{{ p.name }}
              </span>
              <span class="pb-score">{{ p.score }}</span>
            </div>
            <div class="pb-meta">
              <template v-if="phase !== 'bidding'">
                <span class="pb-stat">Plis <strong>{{ p.tricksWon }}</strong></span>
                <span class="pb-sep">·</span>
                <span class="pb-stat">Mise <strong class="pb-bid">{{ p.bid ?? '–' }}</strong></span>
              </template>
              <template v-else>
                <span :class="p.hasBid ? 'bid-done' : 'bid-wait'">{{ p.hasBid ? '✓ a misé' : '⏳ réfléchit…' }}</span>
              </template>
            </div>
          </div>
        </aside>

        <!-- RIGHT : zone de jeu principale -->
        <div class="main-column">

      <!-- ============ BIDDING ============ -->
      <div v-if="phase === 'bidding'" class="bidding-zone">
        <div class="bid-panel">
          <h3>Combien de plis vas-tu remporter ?</h3>
          <p class="bid-hint">Mise un nombre entre 0 et {{ cardsThisRound }}.</p>

          <div v-if="timerType === 'bid'" class="timer-row">
            <div class="timer-bar">
              <div class="timer-fill" :class="{ urgent: timerSecondsLeft <= 5 }" :style="{ width: timerPct + '%' }"></div>
            </div>
            <span class="timer-text" :class="{ urgent: timerSecondsLeft <= 5 }">⏱️ {{ timerSecondsLeft }}s</span>
          </div>
          <p v-if="timerType === 'bid'" class="timer-warn">Sans mise dans les temps, tu miseras automatiquement <strong>0</strong>.</p>

          <div class="bid-grid">
            <button v-for="n in (cardsThisRound + 1)" :key="n - 1"
                    class="bid-num" :class="{ selected: myBid === (n - 1) }"
                    @click="submitBid(n - 1)">
              {{ n - 1 }}
            </button>
          </div>
          <div v-if="myBid !== null" class="bid-confirmed">
            ✅ Tu as misé <strong>{{ myBid }}</strong>.
            <button class="btn-link" @click="cancelBid">Changer</button>
          </div>
          <div class="bid-waiting">
            {{ players.filter(p => p.hasBid).length }}/{{ players.length }} pirates ont misé
          </div>
        </div>

        <div class="my-hand-preview">
          <div class="zone-label">TES CARTES</div>
          <div class="hand-cards">
            <div v-for="card in sortedHand" :key="card.id" class="hand-card-wrap">
              <SkullKingCard :card="card" />
            </div>
          </div>
        </div>
      </div>

      <!-- ============ PLAYING ============ -->
      <div v-else-if="phase === 'playing'" class="playing-zone">

        <!-- TABLE -->
        <div class="table-area">
          <div class="table-info">
            <span v-if="leadSuit" class="lead-suit">Couleur demandée : <strong>{{ suitLabel(leadSuit) }} {{ suitIcon(leadSuit) }}</strong></span>
            <span v-else class="lead-suit muted">Aucune couleur demandée</span>
            <span class="turn-indicator" :class="{ mine: isMyTurn, resolving }">
              <template v-if="resolving">⏳ Résolution du pli...</template>
              <template v-else>{{ isMyTurn ? '👉 À toi de jouer !' : `Au tour de ${currentTurnName || '...'}` }}</template>
              <span v-if="timerType === 'turn' && !resolving" class="turn-timer" :class="{ urgent: timerSecondsLeft <= 5, mine: isMyTurn }">
                ⏱️ {{ timerSecondsLeft }}s
              </span>
            </span>
          </div>

          <div class="trick-area">
            <div v-if="trick.length === 0 && !lastTrick" class="trick-empty">
              En attente de la première carte du pli...
            </div>

            <!-- Pli en cours -->
            <div v-if="trick.length > 0" class="trick-cards">
              <div v-for="(pl, i) in trick" :key="i" class="trick-card-wrap">
                <SkullKingCard :card="pl.card" :tigress-as-pirate="pl.tigressAsPirate" />
                <span class="trick-player">{{ pl.name }}</span>
              </div>
            </div>

            <!-- Dernier pli résolu -->
            <div v-else-if="lastTrick" class="trick-cards resolved">
              <div v-for="(pl, i) in lastTrick.plays" :key="i" class="trick-card-wrap"
                   :class="pl.name === lastTrick.winnerName ? 'winner' : 'loser'">
                <SkullKingCard :card="pl.card" :tigress-as-pirate="pl.tigressAsPirate" />
                <span class="trick-player">{{ pl.name }}</span>
                <span v-if="pl.name === lastTrick.winnerName" class="winner-badge">🏆</span>
              </div>
            </div>
            <div v-if="lastTrick && trick.length === 0" class="last-trick-banner">
              <span v-if="lastTrick.destroyed">🐙 Pli détruit !</span>
              <span v-else>🏆 <strong>{{ lastTrick.winnerName }}</strong> remporte le pli
                <span v-if="lastTrick.bonusDetails && lastTrick.bonusDetails.length" class="bonus-recap">
                  ({{ lastTrick.bonusDetails.join(', ') }})
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- MY HAND -->
        <div class="my-hand-zone">
          <div class="zone-label">
            TES CARTES
            <span class="my-bid-badge">Mise : <strong>{{ myBid }}</strong> · Plis gagnés : <strong>{{ myTricksWon }}</strong></span>
          </div>
          <div class="hand-cards">
            <div v-for="card in sortedHand" :key="card.id"
                 class="hand-card-wrap"
                 :class="{ playable: isMyTurn && legalCardIds.includes(card.id), unplayable: isMyTurn && !legalCardIds.includes(card.id) }"
                 @click="onCardClick(card)">
              <SkullKingCard :card="card" />
            </div>
          </div>
          <p v-if="isMyTurn" class="hand-help">Clique sur une carte pour la jouer. Les cartes grisées ne respectent pas la couleur demandée.</p>
        </div>
      </div>

      <!-- ============ ROUND END ============ -->
      <div v-else-if="phase === 'roundEnd'" class="roundend-zone">
        <div class="roundend-panel">
          <h3>📊 Fin de la manche {{ roundResults?.round }}</h3>
          <p class="roundend-hint">Scores mis à jour au niveau des pseudos.</p>
          <div class="roundend-spinner">⚓</div>
          <p class="roundend-next">Manche suivante dans un instant…</p>
        </div>
      </div>

      <!-- ============ FINISHED ============ -->
      <div v-else-if="phase === 'finished'" class="finished-zone">
        <div class="finished-panel">
          <div class="crown-icon">👑</div>
          <h2>CAPITAINE DES SEPT MERS</h2>
          <div class="podium">
            <div v-for="(p, i) in finalRanking" :key="p.id" class="podium-row" :class="['rank-' + (i + 1), { me: p.name === myName }]">
              <span class="podium-rank">{{ medal(i) }}</span>
              <span class="podium-name">{{ p.name }}</span>
              <span class="podium-score">{{ p.score }} pts</span>
            </div>
          </div>

          <div v-if="amIHost" class="host-actions">
            <button class="btn-primary" @click="startGame">REJOUER 🔄</button>
          </div>
          <p v-else class="waiting-msg">En attente du capitaine...</p>
        </div>
      </div>

        </div><!-- /main-column -->
      </div><!-- /play-body -->

      <!-- LOG BAR -->
      <div class="logs-bar" v-if="gameLogs.length > 0">
        <span class="log-latest">{{ gameLogs[0] }}</span>
      </div>
    </div>

    <!-- ============ TIGRESS MODAL ============ -->
    <Transition name="modal-fade">
      <div v-if="tigressCard" class="modal-overlay" @click.self="tigressCard = null">
        <div class="tigress-modal">
          <h3>🐯 Comment jouer la Tigresse ?</h3>
          <p>La Tigresse peut être jouée comme un Pirate (gagne) ou comme une Fuite (perd).</p>
          <div class="tigress-choices">
            <button class="tigress-choice pirate" @click="playTigress(true)">⚔️ Pirate</button>
            <button class="tigress-choice escape" @click="playTigress(false)">🏳️ Fuite</button>
          </div>
          <button class="btn-link" @click="tigressCard = null">Annuler</button>
        </div>
      </div>
    </Transition>

    <!-- ============ 0/14 MODAL ============ -->
    <Transition name="modal-fade">
      <div v-if="zeroFourteenCard" class="modal-overlay" @click.self="zeroFourteenCard = null">
        <div class="tigress-modal">
          <h3>0 / 14 — Quelle valeur ?</h3>
          <p>Choisis si cette carte vaut <strong>0</strong> (la plus faible) ou <strong>14</strong> (la plus forte de sa couleur). Elle ne rapporte aucun bonus.</p>
          <div class="tigress-choices">
            <button class="tigress-choice escape" @click="playZeroFourteen(0)">0</button>
            <button class="tigress-choice pirate" @click="playZeroFourteen(14)">14</button>
          </div>
          <button class="btn-link" @click="zeroFourteenCard = null">Annuler</button>
        </div>
      </div>
    </Transition>

    <!-- ============ 15 JOKER MODAL ============ -->
    <Transition name="modal-fade">
      <div v-if="jokerCard" class="modal-overlay" @click.self="jokerCard = null">
        <div class="tigress-modal">
          <h3>🃏 15 Joker — Quelle couleur ?</h3>
          <p>Tu entames le pli : choisis la couleur de ce 15 (jamais noir).</p>
          <div class="joker-choices">
            <button class="joker-choice green" @click="playJoker('green')">🦜 Perroquet</button>
            <button class="joker-choice yellow" @click="playJoker('yellow')">🪙 Coffre</button>
            <button class="joker-choice purple" @click="playJoker('purple')">💎 Trésor</button>
          </div>
          <button class="btn-link" @click="jokerCard = null">Annuler</button>
        </div>
      </div>
    </Transition>

    <!-- ============ HELP MODAL ============ -->
    <Transition name="modal-fade">
      <div v-if="showHelp" class="modal-overlay" @click.self="showHelp = false">
        <div class="help-modal">
          <div class="help-header">
            <span class="help-title">📜 AIDE — SKULL KING</span>
            <button class="help-close" @click="showHelp = false">✕</button>
          </div>
          <div class="help-body">
            <h4>Hiérarchie des cartes</h4>
            <ul>
              <li>🏴‍☠️ <strong>Noir (Drapeau pirate)</strong> = atout, bat les autres couleurs</li>
              <li>Sinon la plus haute carte de la couleur demandée gagne</li>
              <li>💀 <strong>Skull King</strong> bat les pirates et les chiffres</li>
              <li>⚔️ <strong>Pirates</strong> battent sirènes et chiffres (1ᵉʳ joué gagne)</li>
              <li>🧜‍♀️ <strong>Sirènes</strong> battent les chiffres et le Skull King</li>
              <li>🏳️ <strong>Fuite / Butin</strong> perdent toujours</li>
              <li>🐯 <strong>Tigresse</strong> : pirate ou fuite au choix</li>
            </ul>
            <h4 v-if="withExtensions">Extensions</h4>
            <ul v-if="withExtensions">
              <li>🐙 <strong>Kraken</strong> : détruit le pli, personne ne gagne</li>
              <li>🐋 <strong>Baleine blanche</strong> : détruit les spéciales, le plus haut chiffre gagne</li>
              <li>💰 <strong>Butin</strong> : alliance avec le gagnant (+20 chacun si les 2 misent juste)</li>
            </ul>
            <h4 v-if="withExtensions">Cartes d'extension</h4>
            <ul v-if="withExtensions">
              <li><strong>7 / 8 bonus</strong> : capturé → -5 / +5 pts, seulement si ton pari est juste</li>
              <li><strong>0 / 14</strong> : tu choisis sa valeur en la jouant · aucun bonus</li>
              <li>🃏 <strong>15 Joker</strong> : un 15 vert/jaune/violet (tu choisis la couleur si tu entames)</li>
              <li>⚔️ <strong>Mary Throne</strong> : une pirate supplémentaire</li>
            </ul>
            <h4>Score</h4>
            <ul>
              <li>Mise réussie (&gt;0) : <strong>+20 par pli</strong></li>
              <li>Mauvaise mise : <strong>-10 par écart</strong></li>
              <li>Mise 0 réussie : <strong>+10 × nb cartes</strong> · ratée : <strong>-10 × nb cartes</strong></li>
              <li>Bonus 14 capturé : +10 (couleur) / +20 (noir)</li>
              <li>Captures : sirène→pirate +20 · pirate→SK +30 · SK→sirène +40</li>
            </ul>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import SkullKingCard from './SkullKingCard.vue'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

// ── State ──────────────────────────────────────
const gameStatus = ref('waiting')   // 'waiting' | 'playing' | 'roundEnd' | 'finished'
const allConnectedPlayers = ref([])
const amIHost = ref(false)
const myName = ref('')
const withExtensions = ref(true)

const phase = ref('bidding')
const roundNumber = ref(0)
const totalRounds = ref(10)
const cardsThisRound = ref(0)
const myHand = ref([])
const myBid = ref(null)
const myTricksWon = ref(0)
const myScore = ref(0)
const legalCardIds = ref([])
const isMyTurn = ref(false)
const players = ref([])
const trick = ref([])
const leadSuit = ref(null)
const currentTurnName = ref(null)
const lastTrick = ref(null)
const resolving = ref(false)
const roundResults = ref(null)
const history = ref([])

const gameLogs = ref([])
const showHelp = ref(false)
const tigressCard = ref(null)
const zeroFourteenCard = ref(null)
const jokerCard = ref(null)

// ── Minuteur ───────────────────────────────────
const timerType = ref(null)   // 'bid' | 'turn' | null
const timerEnd = ref(0)
const timerTotal = ref(0)
const nowTick = ref(Date.now())
let tickInterval = null

const timerSecondsLeft = computed(() => {
  if (!timerType.value) return null
  return Math.max(0, Math.ceil((timerEnd.value - nowTick.value) / 1000))
})
const timerPct = computed(() => {
  if (!timerType.value || !timerTotal.value) return 0
  return Math.max(0, Math.min(100, ((timerEnd.value - nowTick.value) / timerTotal.value) * 100))
})

// ── Computed ───────────────────────────────────
const canStart = computed(() => allConnectedPlayers.value.length >= 3 && allConnectedPlayers.value.length <= 8)

const SUIT_ORDER = { green: 0, yellow: 1, purple: 2, black: 3 }
const TYPE_ORDER = { number: 0, joker15: 0.5, escape: 1, loot: 2, tigress: 3, mermaid: 4, pirate: 5, skullking: 6, kraken: 7, whale: 8 }

const sortedHand = computed(() => {
  return [...myHand.value].sort((a, b) => {
    if (a.type !== b.type) {
      if (a.type === 'number' && b.type === 'number') return 0
      if (a.type === 'number') return -1
      if (b.type === 'number') return 1
      return (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)
    }
    if (a.type === 'number') {
      if (a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]
      return (a.value ?? 0) - (b.value ?? 0)
    }
    return 0
  })
})

const finalRanking = computed(() => [...players.value].sort((a, b) => b.score - a.score))

// ── Helpers ────────────────────────────────────
const SUIT_ICONS = { green: '🦜', yellow: '🪙', purple: '💎', black: '🏴‍☠️' }
const SUIT_LABELS = { green: 'Perroquet', yellow: 'Coffre', purple: 'Trésor', black: 'Drapeau pirate' }
const suitIcon = (s) => SUIT_ICONS[s] || ''
const suitLabel = (s) => SUIT_LABELS[s] || s
const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`

// ── Actions ────────────────────────────────────
const startGame = () => socket.emit('start_skullking', { roomCode, options: { withExtensions: withExtensions.value } })
const toggleExtensions = () => {
  if (!amIHost.value) return
  withExtensions.value = !withExtensions.value
  socket.emit('skullking_sync_option', { roomCode, key: 'withExtensions', value: withExtensions.value })
}
const submitBid = (n) => socket.emit('skullking_action', { roomCode, actionType: 'bid', payload: { bid: n } })
const cancelBid = () => socket.emit('skullking_action', { roomCode, actionType: 'cancel_bid', payload: {} })

const emitPlay = (cardId, extra = {}) =>
  socket.emit('skullking_action', { roomCode, actionType: 'play_card', payload: { cardId, ...extra } })

const onCardClick = (card) => {
  if (!isMyTurn.value) return
  if (!legalCardIds.value.includes(card.id)) return
  if (card.type === 'tigress') { tigressCard.value = card; return }
  if (card.type === 'number' && card.zeroFourteen) { zeroFourteenCard.value = card; return }
  if (card.type === 'joker15') {
    // Choix de la couleur uniquement si aucune couleur n'est encore demandée.
    if (!leadSuit.value) { jokerCard.value = card; return }
    emitPlay(card.id, { jokerColor: leadSuit.value })
    return
  }
  emitPlay(card.id)
}
const playTigress = (asPirate) => {
  if (!tigressCard.value) return
  emitPlay(tigressCard.value.id, { tigressAsPirate: asPirate })
  tigressCard.value = null
}
const playZeroFourteen = (val) => {
  if (!zeroFourteenCard.value) return
  emitPlay(zeroFourteenCard.value.id, { zeroFourteenValue: val })
  zeroFourteenCard.value = null
}
const playJoker = (color) => {
  if (!jokerCard.value) return
  emitPlay(jokerCard.value.id, { jokerColor: color })
  jokerCard.value = null
}

const copyLink = () => {
  const link = `${window.location.origin}/skullking/join/${roomCode}`
  navigator.clipboard.writeText(link).then(() => alert("Lien d'invitation copié !"))
}

// ── Socket ─────────────────────────────────────
onMounted(() => {
  socket.on('connect', () => {
    const savedName = localStorage.getItem('temp_player_name')
    if (savedName) socket.emit('set_player_name', { name: savedName, roomCode })
    else socket.emit('join_room', roomCode)
  })

  socket.on('room_full', (msg) => { alert(msg); socket.disconnect(); router.push('/') })
  socket.on('skullking_error', (msg) => alert(msg))

  socket.on('update_players_list', (list) => {
    allConnectedPlayers.value = list
    const me = list.find(p => p.id === socket.id)
    if (me) {
      amIHost.value = me.isHost
      if (me.name && me.name !== 'Anonyme') myName.value = me.name
    }
  })

  socket.on('name_set', (data) => { myName.value = data.name })

  socket.on('skullking_option_updated', ({ key, value }) => {
    if (key === 'withExtensions') withExtensions.value = value
  })

  socket.on('game_started', () => {
    gameStatus.value = 'playing'
    gameLogs.value = []
  })

  socket.on('skullking_state', (data) => {
    gameStatus.value = data.status === 'finished' ? 'finished'
      : data.status === 'roundEnd' ? 'roundEnd' : 'playing'
    phase.value = data.phase
    roundNumber.value = data.roundNumber
    totalRounds.value = data.totalRounds
    cardsThisRound.value = data.cardsThisRound
    if (data.isHost !== undefined) amIHost.value = data.isHost
    myHand.value = data.myHand
    myBid.value = data.myBid
    myTricksWon.value = data.myTricksWon
    myScore.value = data.myScore
    legalCardIds.value = data.legalCardIds || []
    isMyTurn.value = data.isMyTurn
    players.value = data.players
    trick.value = data.trick
    leadSuit.value = data.leadSuit
    currentTurnName.value = data.currentTurnName
    lastTrick.value = data.lastTrick
    resolving.value = !!data.resolving
    roundResults.value = data.roundResults
    history.value = data.history || []
    if (data.withExtensions !== undefined) withExtensions.value = data.withExtensions

    if (data.timer) {
      timerType.value = data.timer.type
      timerTotal.value = data.timer.totalMs
      timerEnd.value = Date.now() + data.timer.remainingMs
      nowTick.value = Date.now()
    } else {
      timerType.value = null
    }
  })

  socket.on('action_log', (msg) => {
    gameLogs.value.unshift(msg)
    if (gameLogs.value.length > 6) gameLogs.value.pop()
  })

  tickInterval = setInterval(() => { nowTick.value = Date.now() }, 250)
})

onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&display=swap');

.sk-wrapper {
  min-height: 100vh;
  background: #07101a;
  color: #ecf0f1;
  font-family: 'Outfit', sans-serif;
  display: flex;
  flex-direction: column;
}

/* ── WAITING ─────────────────────────────────── */
.waiting-screen {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 22px; padding: 40px 20px; overflow-y: auto;
}
.waiting-screen h1 { font-size: 2.8rem; font-weight: 900; color: #f1c40f; margin: 0; letter-spacing: 2px; }
.share-box {
  background: #0c1825; padding: 24px 32px; border-radius: 12px;
  border: 1px solid rgba(241, 196, 15, 0.2); text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 400px; width: 100%;
}
.share-box p { margin: 0; color: #bdc3c7; }
.room-code { font-size: 2.4rem; font-weight: 900; color: #f1c40f; letter-spacing: 8px; }
.btn-secondary {
  background: #122436; color: #bdc3c7; border: 1px solid #2c4a63; border-radius: 8px;
  padding: 8px 16px; cursor: pointer; font-family: inherit; font-weight: 600; transition: 0.2s;
}
.btn-secondary:hover { background: #16314a; color: #fff; }

.player-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; max-width: 360px; width: 100%; }
.player-list li { display: flex; align-items: center; gap: 10px; background: #0c1825; padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
.player-name-txt { flex: 1; font-weight: 600; }
.host-tag { font-size: 0.7rem; background: rgba(241,196,15,0.15); color: #f1c40f; border: 1px solid rgba(241,196,15,0.35); padding: 2px 10px; border-radius: 10px; font-weight: 700; }

.player-count-info { font-weight: 700; padding: 8px 24px; border-radius: 20px; }
.player-count-info.ok { background: rgba(46,204,113,0.12); color: #2ecc71; border: 1px solid rgba(46,204,113,0.25); }
.player-count-info.warn { background: rgba(241,196,15,0.1); color: #f1c40f; border: 1px solid rgba(241,196,15,0.2); }

.ext-toggle {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: #0c1825; padding: 14px 20px; border-radius: 12px; max-width: 420px; width: 100%;
  border: 1px solid rgba(255,255,255,0.06);
}
.ext-toggle.active { border-color: rgba(241,196,15,0.3); }
.ext-toggle-info { display: flex; flex-direction: column; gap: 3px; }
.ext-label { font-size: 0.7rem; font-weight: 900; letter-spacing: 2px; color: #f1c40f; }
.ext-desc { font-size: 0.82rem; color: #bdc3c7; }
.ext-btn { width: 52px; height: 28px; border-radius: 14px; background: #2c3e50; border: none; cursor: pointer; position: relative; transition: 0.25s; flex-shrink: 0; }
.ext-btn.on { background: #f39c12; }
.ext-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ext-switch-knob { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: 0.25s; }
.ext-btn.on .ext-switch-knob { left: 27px; }

.btn-primary {
  background: linear-gradient(135deg, #f39c12, #e67e22); color: #1a1205; border: none; border-radius: 10px;
  padding: 14px 32px; font-family: inherit; font-size: 1.05rem; font-weight: 800; cursor: pointer;
  text-transform: uppercase; letter-spacing: 1px; transition: 0.2s;
}
.btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #f1c40f, #f39c12); transform: translateY(-2px); box-shadow: 0 6px 18px rgba(241,196,15,0.4); }
.btn-primary:disabled { background: #2c3e50; color: #5d7a92; cursor: not-allowed; }
.waiting-msg { color: #5d7a92; font-style: italic; }

.rules-reminder { background: #0c1825; padding: 20px 24px; border-radius: 12px; border: 1px dashed rgba(241,196,15,0.15); max-width: 480px; width: 100%; text-align: left; }
.rules-reminder h3 { color: #f1c40f; font-size: 1rem; margin: 0 0 14px; }
.rules-reminder ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.rules-reminder li { font-size: 0.9rem; color: #bdc3c7; line-height: 1.5; }
.rules-reminder li strong { color: #ecf0f1; }

/* ── PLAY SCREEN ─────────────────────────────── */
.play-screen { display: flex; flex-direction: column; min-height: 100vh; }

.top-bar {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  background: #0a1722; padding: 10px 20px; border-bottom: 2px solid rgba(241,196,15,0.2);
}
.top-bar h2 { font-size: 1.3rem; font-weight: 900; margin: 0; color: #f1c40f; letter-spacing: 2px; white-space: nowrap; }
.round-pill { background: #122436; padding: 5px 14px; border-radius: 20px; font-size: 0.9rem; color: #bdc3c7; }
.round-pill strong { color: #fff; }
.round-cards { color: #5d7a92; }
.phase-pill { padding: 5px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; }
.phase-pill.bidding { background: rgba(52,152,219,0.15); color: #5dade2; }
.phase-pill.playing { background: rgba(241,196,15,0.15); color: #f1c40f; }
.phase-pill.roundEnd, .phase-pill.finished { background: rgba(155,89,182,0.15); color: #bb8fce; }
.my-score { margin-left: auto; font-size: 0.9rem; color: #bdc3c7; }
.my-score strong { color: #f1c40f; font-size: 1.1rem; }
.btn-help { background: #122436; color: #bdc3c7; border: 1px solid #2c4a63; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; font-size: 1rem; }
.btn-help:hover { background: #16314a; color: #fff; }

/* ── BODY : colonne joueurs + zone principale ── */
.play-body { flex: 1; display: flex; min-height: 0; }

.players-column {
  width: 250px; flex-shrink: 0; background: #081320;
  border-right: 1px solid rgba(255,255,255,0.06);
  padding: 16px 12px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;
}
.players-col-title { font-size: 0.7rem; font-weight: 900; letter-spacing: 3px; color: #f1c40f; text-transform: uppercase; padding: 0 4px 4px; }
.main-column { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow-y: auto; }

.player-box {
  position: relative; background: #0c1825; border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 9px; transition: 0.2s;
}
.player-box.me { border-color: rgba(241,196,15,0.4); background: rgba(241,196,15,0.06); }
.player-box.turn { border-color: #f1c40f; box-shadow: 0 0 16px rgba(241,196,15,0.35); }
.player-box.leader { border-color: rgba(93,173,226,0.5); box-shadow: 0 0 14px rgba(93,173,226,0.25); }
.pb-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pb-name { font-size: 1.08rem; font-weight: 800; color: #ecf0f1; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pb-dealer { font-size: 0.9rem; flex-shrink: 0; }
.pb-score { font-size: 1.7rem; font-weight: 900; color: #f1c40f; line-height: 1; flex-shrink: 0; }
.pb-meta { font-size: 0.86rem; color: #bdc3c7; display: flex; align-items: center; gap: 7px; }
.pb-stat strong { color: #ecf0f1; }
.pb-bid { color: #5dade2 !important; }
.pb-sep { color: #5d7a92; }
.pb-turn-tag {
  position: absolute; top: -9px; right: 14px; font-size: 0.62rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.5px; background: #f1c40f; color: #1a1205;
  padding: 2px 9px; border-radius: 8px;
}
.pb-turn-tag.starter { background: #5dade2; color: #06121c; }
.bid-done { color: #2ecc71; font-weight: 700; }
.bid-wait { color: #5d7a92; }

/* Zone labels */
.zone-label { font-size: 0.68rem; font-weight: 900; letter-spacing: 3px; color: #5d7a92; text-transform: uppercase; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }

/* ── BIDDING ─────────────────────────────────── */
.bidding-zone { flex: 1; display: flex; flex-direction: column; gap: 24px; padding: 24px 20px; align-items: center; }
.bid-panel { background: #0c1825; border: 1px solid rgba(241,196,15,0.2); border-radius: 16px; padding: 28px; text-align: center; max-width: 560px; width: 100%; }
.bid-panel h3 { margin: 0 0 6px; color: #f1c40f; font-size: 1.3rem; }
.bid-hint { color: #bdc3c7; margin: 0 0 20px; font-size: 0.9rem; }
.bid-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.bid-num {
  width: 54px; height: 54px; border-radius: 12px; border: 2px solid #2c4a63; background: #122436;
  color: #ecf0f1; font-family: inherit; font-size: 1.3rem; font-weight: 800; cursor: pointer; transition: 0.15s;
}
.bid-num:hover { border-color: #f1c40f; transform: translateY(-2px); }
.bid-num.selected { background: linear-gradient(135deg, #f39c12, #e67e22); color: #1a1205; border-color: #f1c40f; }
.bid-confirmed { margin-top: 18px; color: #2ecc71; font-size: 1rem; }
.bid-confirmed strong { font-size: 1.2rem; }
.btn-link { background: none; border: none; color: #5dade2; cursor: pointer; text-decoration: underline; font-family: inherit; font-size: 0.9rem; margin-left: 8px; }
.bid-waiting { margin-top: 14px; color: #5d7a92; font-size: 0.85rem; }

/* ── Minuteur ────────────────────────────────── */
.timer-row { display: flex; align-items: center; gap: 12px; margin: 4px 0 14px; }
.timer-bar { flex: 1; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
.timer-fill { height: 100%; background: linear-gradient(90deg, #5dade2, #3498db); border-radius: 4px; transition: width 0.25s linear; }
.timer-fill.urgent { background: linear-gradient(90deg, #e74c3c, #c0392b); }
.timer-text { font-size: 1rem; font-weight: 800; color: #5dade2; min-width: 46px; text-align: right; }
.timer-text.urgent { color: #e74c3c; }
.timer-warn { color: #5d7a92; font-size: 0.78rem; margin: 0 0 4px; }
.timer-warn strong { color: #f1c40f; }

.turn-timer {
  margin-left: 10px; padding: 3px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 800;
  background: rgba(93,173,226,0.15); color: #5dade2; border: 1px solid rgba(93,173,226,0.3);
}
.turn-timer.mine { background: rgba(46,204,113,0.15); color: #2ecc71; border-color: rgba(46,204,113,0.3); }
.turn-timer.urgent { background: rgba(231,76,60,0.18); color: #e74c3c; border-color: rgba(231,76,60,0.4); animation: timerPulse 0.8s ease-in-out infinite; }
@keyframes timerPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }

.my-hand-preview { width: 100%; max-width: 900px; }

/* ── PLAYING ─────────────────────────────────── */
.playing-zone { flex: 1; display: flex; flex-direction: column; }
.table-area {
  background: linear-gradient(180deg, #0b2018 0%, #07140f 100%);
  border-bottom: 1px solid rgba(241,196,15,0.1); padding: 18px 20px 36px; min-height: 300px;
  display: flex; flex-direction: column; gap: 14px;
}
.table-info { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.lead-suit { font-size: 0.9rem; color: #bdc3c7; }
.lead-suit strong { color: #f1c40f; }
.lead-suit.muted { color: #5d7a92; }
.turn-indicator { font-size: 0.95rem; font-weight: 700; color: #bdc3c7; }
.turn-indicator.mine { color: #2ecc71; }

.trick-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 12px; padding-top: 20px; }
.trick-empty { color: #5d7a92; font-style: italic; }
.trick-cards { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
.trick-card-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; transition: 0.2s; }
.trick-card-wrap .sk-card-host, .trick-card-wrap :deep(.sk-card) { width: 104px; height: 146px; }
.trick-player { font-size: 0.78rem; color: #bdc3c7; font-weight: 600; }
.winner-badge { position: absolute; top: -14px; right: -8px; font-size: 1.4rem; z-index: 6; animation: badgePop 0.6s cubic-bezier(0.34,1.56,0.64,1); }

/* ── Animation de résolution du pli ──────────── */
.trick-cards.resolved { gap: 30px; align-items: center; }
.trick-cards.resolved .trick-card-wrap { transition: all 0.45s cubic-bezier(0.34,1.56,0.64,1); }

/* Carte gagnante : agrandie + surbrillance dorée */
.trick-cards.resolved .trick-card-wrap.winner {
  transform: scale(1.3);
  z-index: 5;
  animation: winnerReveal 0.6s cubic-bezier(0.34,1.56,0.64,1);
}
.trick-cards.resolved .trick-card-wrap.winner :deep(.sk-card) {
  box-shadow: 0 0 0 3px #f1c40f, 0 0 24px rgba(241,196,15,0.75), 0 8px 26px rgba(0,0,0,0.6);
}
.trick-cards.resolved .trick-card-wrap.winner .trick-player { color: #f1c40f; font-weight: 800; }

/* Cartes perdantes : noir & blanc + rétrécies */
.trick-cards.resolved .trick-card-wrap.loser {
  transform: scale(0.7);
  opacity: 0.55;
  animation: loserFade 0.5s ease both;
}
.trick-cards.resolved .trick-card-wrap.loser :deep(.sk-card) {
  filter: grayscale(1) brightness(0.85);
  transition: filter 0.5s ease;
}

@keyframes winnerReveal {
  0%   { transform: scale(1); }
  55%  { transform: scale(1.42); }
  100% { transform: scale(1.3); }
}
@keyframes loserFade {
  0%   { transform: scale(1); opacity: 0.9; }
  100% { transform: scale(0.7); opacity: 0.55; }
}
@keyframes badgePop {
  0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
  60%  { transform: scale(1.3) rotate(8deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
.last-trick-banner { font-size: 0.95rem; color: #ecf0f1; text-align: center; }
.last-trick-banner strong { color: #f1c40f; }
.bonus-recap { color: #2ecc71; font-size: 0.85rem; }

.my-hand-zone { padding: 34px 20px 28px; }
.my-bid-badge { color: #bdc3c7; font-weight: 600; font-size: 0.8rem; }
.my-bid-badge strong { color: #f1c40f; }
.hand-cards { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.hand-card-wrap { width: 120px; height: 168px; transition: transform 0.15s; }
.hand-card-wrap :deep(.sk-card) { width: 100%; height: 100%; }
.playing-zone .hand-card-wrap.playable { cursor: pointer; }
.playing-zone .hand-card-wrap.playable:hover { transform: translateY(-10px); }
.playing-zone .hand-card-wrap.playable :deep(.sk-card) { box-shadow: 0 0 0 2px rgba(46,204,113,0.5), 0 6px 16px rgba(0,0,0,0.5); }
.playing-zone .hand-card-wrap.unplayable { opacity: 0.4; filter: grayscale(0.6); cursor: not-allowed; }
.hand-help { text-align: center; color: #5d7a92; font-size: 0.82rem; margin-top: 12px; }

/* ── ROUND END ───────────────────────────────── */
.roundend-zone { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 24px 16px; }
.roundend-panel { background: #0c1825; border: 1px solid rgba(155,89,182,0.25); border-radius: 16px; padding: 24px; max-width: 720px; width: 100%; text-align: center; }
.roundend-panel h3 { color: #bb8fce; margin: 0 0 8px; }
.roundend-hint { color: #5d7a92; font-size: 0.9rem; margin: 0 0 18px; }
.roundend-spinner { font-size: 2.4rem; animation: anchorSpin 1.6s ease-in-out infinite; }
.roundend-next { color: #bb8fce; font-size: 0.95rem; font-weight: 700; margin: 10px 0 0; }
@keyframes anchorSpin { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } }

/* ── FINISHED ────────────────────────────────── */
.finished-zone { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
.finished-panel { background: #0c1825; border: 1px solid rgba(241,196,15,0.3); border-radius: 18px; padding: 36px; max-width: 460px; width: 100%; text-align: center; }
.crown-icon { font-size: 3.5rem; }
.finished-panel h2 { color: #f1c40f; font-size: 1.4rem; letter-spacing: 1px; margin: 8px 0 24px; }
.podium { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
.podium-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #122436; border: 1px solid rgba(255,255,255,0.05); }
.podium-row.rank-1 { background: rgba(241,196,15,0.12); border-color: rgba(241,196,15,0.4); }
.podium-row.me { box-shadow: 0 0 0 2px rgba(46,204,113,0.4); }
.podium-rank { font-size: 1.3rem; min-width: 32px; }
.podium-name { flex: 1; text-align: left; font-weight: 700; }
.podium-score { font-weight: 900; color: #f1c40f; }

/* ── LOG BAR ─────────────────────────────────── */
.logs-bar { background: #081320; padding: 8px 20px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; color: #bdc3c7; }

/* ── MODALS ──────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
.tigress-modal, .help-modal { background: #0c1825; border: 1px solid rgba(241,196,15,0.3); border-radius: 16px; padding: 28px; max-width: 480px; width: 100%; text-align: center; }
.tigress-modal h3 { color: #e67e22; margin: 0 0 10px; }
.tigress-modal p { color: #bdc3c7; font-size: 0.9rem; margin: 0 0 20px; }
.tigress-choices { display: flex; gap: 14px; justify-content: center; margin-bottom: 16px; }
.tigress-choice { flex: 1; padding: 16px; border-radius: 12px; border: 2px solid; font-family: inherit; font-size: 1rem; font-weight: 800; cursor: pointer; transition: 0.15s; }
.tigress-choice.pirate { background: rgba(212,172,13,0.12); border-color: #d4ac0d; color: #f1c40f; }
.tigress-choice.pirate:hover { background: rgba(212,172,13,0.25); }
.tigress-choice.escape { background: rgba(149,165,166,0.12); border-color: #95a5a6; color: #d5dbdb; }
.tigress-choice.escape:hover { background: rgba(149,165,166,0.25); }

.joker-choices { display: flex; gap: 10px; justify-content: center; margin-bottom: 16px; flex-wrap: wrap; }
.joker-choice { flex: 1; min-width: 110px; padding: 14px 10px; border-radius: 12px; border: 2px solid; font-family: inherit; font-size: 0.95rem; font-weight: 800; cursor: pointer; transition: 0.15s; }
.joker-choice.green { background: rgba(39,174,96,0.14); border-color: #27ae60; color: #82e0aa; }
.joker-choice.green:hover { background: rgba(39,174,96,0.28); }
.joker-choice.yellow { background: rgba(224,168,0,0.14); border-color: #e0a800; color: #f7dc6f; }
.joker-choice.yellow:hover { background: rgba(224,168,0,0.28); }
.joker-choice.purple { background: rgba(155,89,182,0.14); border-color: #9b59b6; color: #d2b4de; }
.joker-choice.purple:hover { background: rgba(155,89,182,0.28); }

.help-modal { max-width: 560px; text-align: left; max-height: 85vh; overflow-y: auto; }
.help-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.help-title { font-weight: 900; color: #f1c40f; letter-spacing: 1px; }
.help-close { background: none; border: none; color: #bdc3c7; font-size: 1.2rem; cursor: pointer; }
.help-body h4 { color: #f1c40f; margin: 18px 0 8px; font-size: 0.95rem; }
.help-body h4:first-child { margin-top: 0; }
.help-body ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.help-body li { font-size: 0.88rem; color: #bdc3c7; line-height: 1.5; }
.help-body li strong { color: #ecf0f1; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* Colonne joueurs → bandeau horizontal sur petit écran */
@media (max-width: 760px) {
  .play-body { flex-direction: column; }
  .players-column {
    width: auto; flex-direction: row; gap: 10px;
    overflow-x: auto; overflow-y: hidden;
    border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 12px;
  }
  .players-col-title { display: none; }
  .player-box { min-width: 150px; flex-shrink: 0; padding: 12px 14px; }
  .pb-turn-tag { display: none; }
  .pb-score { font-size: 1.4rem; }
}

@media (max-width: 600px) {
  .top-bar { gap: 8px; padding: 8px 12px; }
  .top-bar h2 { font-size: 1.1rem; }
  .my-score { width: 100%; margin-left: 0; order: 5; }
  .hand-card-wrap { width: 92px; height: 129px; }
  .trick-card-wrap .sk-card-host, .trick-card-wrap :deep(.sk-card) { width: 82px; height: 115px; }
  .bid-num { width: 46px; height: 46px; font-size: 1.1rem; }
}
</style>
