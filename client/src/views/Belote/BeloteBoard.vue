<template>
  <div class="belote-wrapper">
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- Animation Belote / Rebelote -->
    <div v-if="beloteFlash" class="belote-flash" :class="beloteFlash.word.toLowerCase()">
      <div class="bf-halo" :class="suitColorName(beloteFlash.suit)">{{ suitSym(beloteFlash.suit) }}</div>
      <div class="belote-flash-word">{{ beloteFlash.word }} <span class="bf-suit" :class="suitColorName(beloteFlash.suit)">{{ suitSym(beloteFlash.suit) }}</span></div>
      <div class="belote-flash-who">{{ beloteFlash.playerName }}<span v-if="beloteFlash.word === 'Rebelote'"> · +20 pts</span></div>
    </div>

    <!-- ============ SALLE D'ATTENTE ============ -->
    <div v-if="gameStatus === 'waiting'" class="waiting-screen">
      <h1>Belote ♥</h1>
      <div class="share-box">
        <p>Code de la table : <strong>{{ roomCode }}</strong></p>
        <button class="btn-secondary" @click="copyLink">📋 Copier le lien d'invitation</button>
      </div>

      <div class="lobby-cols">
        <div class="lobby-panel">
          <h3>Joueurs ({{ allConnectedPlayers.length }}/4)</h3>
          <ul class="player-list">
            <li v-for="p in allConnectedPlayers" :key="p.id">
              👤 {{ p.name }} <span v-if="p.isHost" class="host-tag">hôte</span>
            </li>
          </ul>
        </div>

        <div class="lobby-panel">
          <h3>Table &amp; équipes</h3>
          <div class="seat-grid">
            <div v-for="(s, i) in [0,1,2,3]" :key="i" class="seat-row" :class="'team-' + (i % 2 === 0 ? 'a' : 'b')">
              <span class="seat-label">Siège {{ i + 1 }} · {{ teamLabel(i % 2 === 0 ? 'A' : 'B') }}</span>
              <select v-if="amIHost" v-model="seatOrder[i]" @change="pushSeating" class="seat-select">
                <option :value="null">—</option>
                <option v-for="p in allConnectedPlayers" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <span v-else class="seat-name">{{ nameById(seatOrder[i]) || '—' }}</span>
            </div>
          </div>
          <p v-if="amIHost && !seatingValid" class="seat-warn">Place les 4 joueurs (un par siège).</p>

          <div class="team-names" v-if="amIHost">
            <label>Nom éq. 1
              <input v-model="teamNames.A" maxlength="20" placeholder="Nous"
                     @input="pushOption('teamNameA', teamNames.A)" />
            </label>
            <label>Nom éq. 2
              <input v-model="teamNames.B" maxlength="20" placeholder="Eux"
                     @input="pushOption('teamNameB', teamNames.B)" />
            </label>
          </div>
          <p v-else-if="teamNames.A || teamNames.B" class="tn-readonly">
            Équipes : {{ teamNames.A || 'Équipe 1' }} / {{ teamNames.B || 'Équipe 2' }}
          </p>
        </div>

        <div class="lobby-panel" v-if="amIHost">
          <h3>Format de partie</h3>
          <label class="opt-row">
            <select v-model="scoreMode" @change="pushOption('scoreMode', scoreMode)">
              <option value="classic1000">Classique — 1000 pts</option>
              <option value="short501">Courte — 501 pts</option>
              <option value="endless">Infinie (l'hôte arrête)</option>
              <option value="single">Manche unique</option>
            </select>
          </label>
          <p class="opt-hint">La distribution (3-2 ou 2-3) est choisie par le donneur à chaque donne.</p>
        </div>
        <div class="lobby-panel" v-else>
          <h3>Format de partie</h3>
          <p class="opt-readonly">{{ modeLabel(scoreMode) }}</p>
        </div>
      </div>

      <button
        v-if="amIHost"
        class="btn-primary"
        :disabled="allConnectedPlayers.length !== 4 || !seatingValid"
        @click="startGame"
      >LANCER LA PARTIE</button>
      <p v-else class="waiting-msg">En attente de l'hôte…</p>
    </div>

    <!-- ============ PARTIE ============ -->
    <div v-else-if="['cutting','choosing_split','bidding','playing','hand_over'].includes(gameStatus)" class="table-screen">

      <!-- Bandeau -->
      <div class="topbar">
        <div class="tb-left">
          <span class="tb-title">Belote</span>
          <span class="tb-hand">Donne {{ handNumber }}</span>
          <span v-if="trump" class="tb-trump" :class="suitColorName(trump)">Atout {{ suitSym(trump) }}</span>
        </div>
        <div class="tb-scores">
          <span class="sc" :class="{ mine: myTeam === 'A' }">{{ teamLabel('A') }} : <b>{{ scores.A }}</b></span>
          <span class="sc" :class="{ mine: myTeam === 'B' }">{{ teamLabel('B') }} : <b>{{ scores.B }}</b></span>
          <span v-if="targetScore" class="sc-target">/ {{ targetScore }}</span>
        </div>
        <div class="tb-right">
          <span v-if="takerName" class="tb-taker">Preneur : {{ takerName }}</span>
          <button
            v-if="amIHost && gameStatus !== 'hand_over'"
            class="tb-stop"
            title="Arrêter la partie"
            @click="confirmStop"
          >⏹ Arrêter</button>
        </div>
      </div>

      <!-- Table -->
      <div class="felt">
        <div
          v-for="pos in ['top','left','right']"
          :key="pos"
          class="seat"
          :class="[pos, { turn: seatAtPos(pos)?.isTurn, partner: pos === 'top' }]"
        >
          <template v-if="seatAtPos(pos)">
            <div class="seat-head">
              <span class="seat-dot" :class="'team-' + seatAtPos(pos).team.toLowerCase()"></span>
              <span class="seat-nom">{{ seatAtPos(pos).name }}</span>
              <span v-if="seatAtPos(pos).isTaker" class="taker-badge" :class="suitColorName(trump)" title="Preneur">👑&#8202;{{ suitSym(trump) }}</span>
            </div>
            <div class="seat-sub">
              {{ seatAtPos(pos).tricksWon }} pli{{ seatAtPos(pos).tricksWon > 1 ? 's' : '' }}<span class="sub-count"> · {{ seatAtPos(pos).handCount }} carte{{ seatAtPos(pos).handCount > 1 ? 's' : '' }}</span>
            </div>
            <div v-if="beloteSeat === seatAtPos(pos).seat" class="belote-badge">
              ♥ {{ beloteTeam ? 'Belote-Rebelote' : 'Belote' }}
            </div>
            <div class="hidden-hand">
              <BeloteCard
                v-for="n in seatAtPos(pos).handCount"
                :key="n"
                face-down
                class="mini-card"
              />
            </div>
          </template>
        </div>

        <!-- Pli au centre -->
        <div class="trick-zone">
          <div
            v-for="t in currentTrick"
            :key="t.seat"
            class="trick-card"
            :class="[posClass(t.seat), { winning: t.seat === trickWinnerSeat }]"
          >
            <BeloteCard :card="t.card" class="tc" />
          </div>
        </div>

        <!-- Retourne (choix de l'atout) -->
        <div v-if="retourne && (gameStatus === 'bidding' || gameStatus === 'choosing_split')" class="retourne-zone">
          <span class="rz-label">Retourne</span>
          <BeloteCard :card="retourne" class="rz-card" />
        </div>

        <!-- À qui de jouer (+ actions) — sur le plateau -->
        <div v-if="feltTurnText" class="felt-panel" :class="{ you: feltTurnMine }">
          <div class="fp-text">{{ feltTurnText }}</div>
          <div v-if="feltTurnMine && gameStatus !== 'playing'" class="fp-actions">
            <template v-if="gameStatus === 'cutting'">
              <div class="fp-cut">
                <input type="range" min="3" max="29" step="1" v-model.number="cutIndex" class="cut-slider" />
                <span class="cut-val">{{ cutIndex }} / {{ 32 - cutIndex }}</span>
              </div>
              <button class="btn-act take" @click="act('cut', { index: cutIndex })">Couper</button>
            </template>
            <template v-else-if="gameStatus === 'choosing_split'">
              <button class="btn-act" @click="act('choose_split', { split: '3-2' })">3 puis 2</button>
              <button class="btn-act" @click="act('choose_split', { split: '2-3' })">2 puis 3</button>
            </template>
            <template v-else-if="phase === 'bid1'">
              <button class="btn-act take" @click="act('bid_take', {})">
                Prendre <span :class="suitColorName(retourne?.suit)">{{ suitSym(retourne?.suit) }}</span>
              </button>
              <button class="btn-act" @click="act('bid_pass', {})">Passer</button>
            </template>
            <template v-else-if="phase === 'bid2'">
              <button
                v-for="su in otherSuits"
                :key="su"
                class="btn-act take"
                :class="suitColorName(su)"
                @click="act('bid_take', { suit: su })"
              >{{ suitSym(su) }}</button>
              <button class="btn-act" @click="act('bid_pass', {})">Passer</button>
            </template>
          </div>
        </div>
      </div>

      <!-- Zone du bas : moi -->
      <div class="my-zone">
        <div class="my-head">
          <span class="seat-dot" :class="'team-' + (myTeam || 'a').toLowerCase()"></span>
          <strong>{{ myName }}</strong>
          <span v-if="me?.isTaker" class="taker-badge" :class="suitColorName(trump)" title="Preneur">👑&#8202;{{ suitSym(trump) }}</span>
          <span v-if="beloteSeat === mySeat" class="belote-badge inline">♥ {{ beloteTeam ? 'Belote-Rebelote' : 'Belote' }}</span>
          <span class="my-tricks">· {{ me?.tricksWon || 0 }} pli(s)</span>
        </div>

        <!-- Domination de la manche : barre compacte sur une ligne -->
        <div v-if="handMeterShown" class="hand-meter" :title="handMeterTitle">
          <span class="hm-cap a" :class="{ lead: handPoints.A > handPoints.B }">
            <span v-if="takerTeam === 'A'">👑</span>{{ teamLabel('A') }}
          </span>
          <div class="hm-bar">
            <div class="hm-seg a" :style="{ flexGrow: handPoints.A || 0.0001 }">
              <span v-if="handPoints.A">{{ handPoints.A }}</span>
            </div>
            <div class="hm-seg b" :style="{ flexGrow: handPoints.B || 0.0001 }">
              <span v-if="handPoints.B">{{ handPoints.B }}</span>
            </div>
          </div>
          <span class="hm-cap b" :class="{ lead: handPoints.B > handPoints.A }">
{{ teamLabel('B') }}<span v-if="takerTeam === 'B'">👑</span>
          </span>
        </div>

        <!-- Ma main -->
        <div class="my-hand" v-if="myHand.length">
          <div
            v-for="(c, i) in myHand"
            :key="cid(c)"
            class="hand-card"
            :class="{ playable: canPlay(c) }"
            :style="{ marginLeft: i > 0 ? handOverlap : '0' }"
            @click="playCard(c)"
          >
            <BeloteCard :card="c" class="hc" />
          </div>
        </div>
      </div>

      <!-- Journal -->
      <div class="log-panel" v-if="gameLogs.length">
        <ul class="log-list">
          <li v-for="(l, i) in gameLogs" :key="i" :class="{ latest: i === 0 }">{{ l }}</li>
        </ul>
      </div>

      <!-- Recap de donne -->
      <div v-if="gameStatus === 'hand_over' && handResult" class="recap-overlay">
        <div class="recap-modal">
          <div class="recap-head">
            <span class="recap-hand">Donne {{ handNumber }} terminée</span>
            <h2 :class="recapClass">{{ recapTitle }}</h2>
            <p class="recap-line">
              Preneur : <strong>{{ handResult.takerName }}</strong> · {{ teamLabel(handResult.takerTeam) }} ·
              atout <span class="recap-trump" :class="suitColorName(handResult.trump)">{{ suitSym(handResult.trump) }}</span>
            </p>
          </div>

          <p class="recap-summary">{{ recapSummary }}</p>

          <table class="recap-table">
            <thead>
              <tr>
                <th></th>
                <th :class="{ tk: handResult.takerTeam === 'A', win: (handResult.delta.A || 0) > (handResult.delta.B || 0) }">
                  {{ teamLabel('A') }} <span v-if="handResult.takerTeam === 'A'">👑</span>
                </th>
                <th :class="{ tk: handResult.takerTeam === 'B', win: (handResult.delta.B || 0) > (handResult.delta.A || 0) }">
                  {{ teamLabel('B') }} <span v-if="handResult.takerTeam === 'B'">👑</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Points des plis <span class="muted">(+ 10 de der)</span></td>
                <td>{{ handResult.trickPts.A }}</td><td>{{ handResult.trickPts.B }}</td>
              </tr>
              <tr v-if="handResult.beloteTeam">
                <td>Belote <span class="muted">(Roi + Dame d'atout)</span></td>
                <td>{{ handResult.beloteTeam === 'A' ? 20 : 0 }}</td>
                <td>{{ handResult.beloteTeam === 'B' ? 20 : 0 }}</td>
              </tr>
              <tr class="recap-delta">
                <td>Score de la donne</td>
                <td>+{{ handResult.delta.A || 0 }}</td><td>+{{ handResult.delta.B || 0 }}</td>
              </tr>
              <tr class="recap-total">
                <td>Score total</td>
                <td>{{ handResult.totals.A }}<span v-if="targetScore" class="muted"> / {{ targetScore }}</span></td>
                <td>{{ handResult.totals.B }}<span v-if="targetScore" class="muted"> / {{ targetScore }}</span></td>
              </tr>
            </tbody>
          </table>

          <div class="recap-actions">
            <button v-if="amIHost" class="btn-primary" @click="act('next_hand', {})">
              {{ matchOver ? 'Voir le résultat' : 'Donne suivante' }}
            </button>
            <button v-if="amIHost && scoreMode === 'endless' && !matchOver" class="btn-secondary" @click="act('end_match', {})">Arrêter la partie</button>
            <p v-if="!amIHost" class="waiting-msg">En attente de l'hôte…</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ FIN ============ -->
    <div v-else-if="gameStatus === 'finished'" class="end-screen">
      <div class="end-box">
        <h2>🏆 Partie terminée</h2>
        <p class="end-reason">{{ endReason }}</p>
        <div class="end-scores">
          <div class="end-team" :class="{ win: endWinner === 'A' }">
            <span class="et-name">{{ teamLabel('A') }}</span>
            <span class="et-players">{{ endTeams.A?.join(' & ') }}</span>
            <span class="et-score">{{ endScores.A }}</span>
          </div>
          <div class="end-team" :class="{ win: endWinner === 'B' }">
            <span class="et-name">{{ teamLabel('B') }}</span>
            <span class="et-players">{{ endTeams.B?.join(' & ') }}</span>
            <span class="et-score">{{ endScores.B }}</span>
          </div>
        </div>
        <button v-if="amIHost" class="btn-primary" @click="startGame">NOUVELLE PARTIE</button>
        <p v-else class="waiting-msg">En attente de l'hôte…</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import BeloteCard from './BeloteCard.vue'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

const SUIT_SYM = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
const suitSym = (s) => SUIT_SYM[s] || ''
const suitColorName = (s) => (s === 'hearts' || s === 'diamonds' ? 'red' : 'black')
const cid = (c) => `${c.suit}_${c.value}`

// force des cartes (pour déterminer le maître du pli en cours, côté client)
const TRUMP_RANK = Object.fromEntries(['07', '08', 'Q', 'K', '10', 'A', '09', 'J'].map((r, i) => [r, i]))
const PLAIN_RANK = Object.fromEntries(['07', '08', '09', 'J', 'Q', 'K', '10', 'A'].map((r, i) => [r, i]))
function cardStrength(card, trumpSuit, leadSuit) {
  if (card.suit === trumpSuit) return 200 + TRUMP_RANK[card.value]
  if (card.suit === leadSuit) return 100 + PLAIN_RANK[card.value]
  return 0
}

// ---- état lobby ----
const allConnectedPlayers = ref([])
const amIHost = ref(false)
const seatOrder = ref([null, null, null, null])
const scoreMode = ref('classic1000')
const DEFAULT_SPLIT = '3-2' // le donneur peut changer à chaque donne dans le jeu
const teamNames = ref({ A: '', B: '' }) // vide → "Nous" / "Eux" selon le point de vue

// ---- état partie ----
const gameStatus = ref('waiting')
const phase = ref(null)
const scores = ref({ A: 0, B: 0 })
const targetScore = ref(null)
const handNumber = ref(0)
const mySeat = ref(0)
const isDealer = ref(false)
const dealerSeat = ref(0)
const turnSeat = ref(0)
const resolving = ref(false)
const cutterSeat = ref(null)
const cutterName = ref(null)
const cutIndex = ref(16)
const trump = ref(null)
const takerName = ref(null)
const takerSeat = ref(null)
const retourne = ref(null)
const myHand = ref([])
const myLegalCards = ref([])
const currentTrick = ref([])
const handPoints = ref({ A: 0, B: 0 })
const seats = ref([])
const handResult = ref(null)
const matchOver = ref(false)
const beloteSeat = ref(null)
const beloteTeam = ref(null)

const gameLogs = ref([])
const toast = ref('')
let toastTimer = null
const beloteFlash = ref(null)
let beloteFlashTimer = null

// ---- fin ----
const endWinner = ref(null)
const endForced = ref(false)
const endScores = ref({ A: 0, B: 0 })
const endTeams = ref({ A: [], B: [] })

// ---- computed ----
const myName = computed(() =>
  seats.value.find((s) => s.seat === mySeat.value)?.name ||
  allConnectedPlayers.value.find((p) => p.id === socket.id)?.name || ''
)
const me = computed(() => seats.value.find((s) => s.seat === mySeat.value))
const myTeam = computed(() => me.value?.team || null)
const isMyTurn = computed(() => turnSeat.value === mySeat.value)
const legalSet = computed(() => new Set(myLegalCards.value))
const seatingValid = computed(() => {
  const v = seatOrder.value.filter(Boolean)
  return v.length === 4 && new Set(v).size === 4
})
const otherSuits = computed(() =>
  ['spades', 'hearts', 'diamonds', 'clubs'].filter((s) => s !== retourne.value?.suit)
)
const handOverlap = computed(() => (myHand.value.length > 8 ? '-28px' : '-18px'))

// Domination de la manche en cours
const takerTeam = computed(() => (takerSeat.value == null ? null : (takerSeat.value % 2 === 0 ? 'A' : 'B')))
const handMeterShown = computed(() =>
  gameStatus.value === 'hand_over' ||
  (gameStatus.value === 'playing' && handPoints.value.A + handPoints.value.B > 0)
)
const handMeterTitle = computed(() => {
  const { A, B } = handPoints.value
  let s = `Manche — ${teamLabel('A')} : ${A} · ${teamLabel('B')} : ${B}`
  if (takerTeam.value) {
    const d = A - B
    const lead = takerTeam.value === 'A' ? d : -d
    s += ` — preneur ${lead > 0 ? 'devant' : lead < 0 ? 'en retard' : 'à égalité'}`
  }
  return s
})

// Bandeau "à qui de jouer" affiché en bas du plateau
const feltTurnMine = computed(() =>
  !resolving.value && (
    (gameStatus.value === 'cutting' && mySeat.value === cutterSeat.value) ||
    (gameStatus.value === 'choosing_split' && isDealer.value) ||
    ((gameStatus.value === 'bidding' || gameStatus.value === 'playing') && isMyTurn.value)
  )
)
const feltTurnText = computed(() => {
  if (gameStatus.value === 'cutting') {
    return mySeat.value === cutterSeat.value
      ? '🔪 À toi de couper le paquet'
      : `${cutterName.value || nameOfSeat(cutterSeat.value)} coupe le paquet…`
  }
  // pendant le jeu, pas de bandeau : le joueur actif est déjà entouré de vert
  // (et tes cartes jouables ont un liseré) → on gagne la place en bas du plateau
  if (gameStatus.value === 'playing') {
    if (resolving.value && trickWinnerSeat.value != null) {
      return `✋ ${nameOfSeat(trickWinnerSeat.value)} remporte le pli`
    }
    // seulement pour moi, avant que je pose ma carte ; rien pour les autres
    return isMyTurn.value ? '⭐ À toi de jouer' : ''
  }
  if (gameStatus.value === 'bidding') {
    const s = phase.value === 'bid2' ? ' (2ᵉ tour)' : ''
    if (isMyTurn.value) {
      return phase.value === 'bid2' ? '⭐ À toi — choisis l\'atout (2ᵉ tour)' : '⭐ À toi — prends l\'atout ou passe'
    }
    return `Choix de l'atout — ${nameOfSeat(turnSeat.value)}${s}`
  }
  if (gameStatus.value === 'choosing_split') {
    return isDealer.value ? '⭐ Choisis la distribution' : `${nameOfSeat(dealerSeat.value)} distribue`
  }
  return ''
})

// Siège qui remporterait le pli en cours si le pli s'arrêtait maintenant
const trickWinnerSeat = computed(() => {
  const t = currentTrick.value
  if (gameStatus.value !== 'playing' || !t.length) return null
  const lead = t[0].card.suit
  let best = t[0]
  for (const x of t) {
    if (cardStrength(x.card, trump.value, lead) > cardStrength(best.card, trump.value, lead)) best = x
  }
  return best.seat
})

const recapTitle = computed(() => {
  const o = handResult.value?.outcome
  if (o === 'made') return 'Contrat réussi'
  if (o === 'chute') return 'Chute'
  if (o === 'capot_taker') return 'Capot du preneur'
  return 'Capot de la défense'
})
const recapClass = computed(() => {
  const o = handResult.value?.outcome
  if (o === 'made') return 'ok'
  if (o === 'chute') return 'ko'
  return o === 'capot_taker' ? 'capot ok' : 'capot ko'
})
const recapSummary = computed(() => {
  const r = handResult.value
  if (!r) return ''
  const defTeam = r.takerTeam === 'A' ? 'B' : 'A'
  const t = teamLabel(r.takerTeam)
  const d = teamLabel(defTeam)
  const bel = (tm) => (r.beloteTeam === tm ? 20 : 0)
  const takerPts = r.trickPts[r.takerTeam] + bel(r.takerTeam)
  const defPts = r.trickPts[defTeam] + bel(defTeam)
  if (r.outcome === 'capot_taker') return `Capot du preneur (${t}) — les 8 plis, 250 points.`
  if (r.outcome === 'capot_def') return `Capot de la défense (${d}) — les 8 plis, 250 points.`
  if (r.outcome === 'made') return `Contrat tenu — ${t} (preneur) ${takerPts}, ${d} ${defPts}.`
  return `Chute — ${t} (preneur) ${takerPts}, ${d} ${defPts} → 162 pour ${d}.`
})

function nameOfSeat(seat) { return seats.value.find((s) => s.seat === seat)?.name || '?' }
function nameById(id) { return allConnectedPlayers.value.find((p) => p.id === id)?.name || '' }
// Libellé d'équipe : nom personnalisé si défini, sinon "Nous"/"Eux" selon mon équipe,
// sinon "Équipe 1"/"Équipe 2" (avant d'être assis).
function teamLabel(t) {
  const custom = (teamNames.value[t] || '').trim()
  if (custom) return custom
  if (myTeam.value) return myTeam.value === t ? 'Nous' : 'Eux'
  return t === 'A' ? 'Équipe 1' : 'Équipe 2'
}
const endReason = computed(() => {
  if (endForced.value) return "Partie arrêtée par l'hôte."
  const w = endWinner.value
  if (!w) return `Égalité ${endScores.value.A}–${endScores.value.B} !`
  const l = w === 'A' ? 'B' : 'A'
  return `${teamLabel(w)} l'emporte ${endScores.value[w]}–${endScores.value[l]} !`
})
function modeLabel(m) {
  return { classic1000: '1000 pts', short501: '501 pts', endless: 'Infinie', single: 'Manche unique' }[m] || m
}

// position écran d'un siège absolu : 0=bas(moi) 1=gauche 2=haut(partenaire) 3=droite
function screenIdx(seat) { return (seat - mySeat.value + 4) % 4 }
function posClass(seat) { return ['bottom', 'left', 'top', 'right'][screenIdx(seat)] }
function seatAtPos(pos) {
  const idx = { bottom: 0, left: 1, top: 2, right: 3 }[pos]
  return seats.value.find((s) => screenIdx(s.seat) === idx)
}

function canPlay(c) {
  return gameStatus.value === 'playing' && isMyTurn.value && legalSet.value.has(cid(c))
}

// ---- actions ----
function act(actionType, payload) {
  socket.emit('belote_action', { roomCode, actionType, payload: payload || {} })
}
function playCard(c) {
  if (!canPlay(c)) return
  act('play_card', { cardId: cid(c) })
}
function confirmStop() {
  if (window.confirm('Arrêter la partie maintenant ? Le score actuel décidera du vainqueur.')) {
    act('end_match', {})
  }
}
function startGame() {
  socket.emit('start_belote', {
    roomCode,
    seatOrder: seatOrder.value,
    options: {
      scoreMode: scoreMode.value,
      defaultSplit: DEFAULT_SPLIT,
      teamNames: { A: teamNames.value.A.trim(), B: teamNames.value.B.trim() },
    },
  })
}
function pushSeating() {
  socket.emit('belote_set_seating', { roomCode, seatOrder: seatOrder.value })
}
function pushOption(key, value) {
  socket.emit('belote_sync_option', { roomCode, key, value })
}
function copyLink() {
  const link = `${window.location.origin}/belote/join/${roomCode}`
  navigator.clipboard.writeText(link).then(() => showToast('Lien copié ✓'))
}
function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

// initialise / répare le placement quand la liste change (hôte seulement)
watch(allConnectedPlayers, (list) => {
  if (!amIHost.value) return
  const ids = list.map((p) => p.id)
  const cur = seatOrder.value.filter((x) => x && ids.includes(x))
  if (cur.length !== Math.min(4, ids.length) || new Set(cur).size !== cur.length) {
    const next = [null, null, null, null]
    ids.slice(0, 4).forEach((id, i) => { next[i] = id })
    seatOrder.value = next
    pushSeating()
  }
})

// ---- socket ----
onMounted(() => {
  const sendName = () => {
    const saved = localStorage.getItem('temp_player_name')
    if (saved) socket.emit('set_player_name', { name: saved, roomCode, maxPlayers: 4 })
  }
  if (socket.connected) sendName()
  else socket.on('connect', sendName)

  socket.on('room_full', (msg) => { showToast(msg); setTimeout(() => { socket.disconnect(); router.push('/') }, 1600) })
  socket.on('belote_error', (msg) => showToast(msg))

  socket.on('update_players_list', (pls) => {
    allConnectedPlayers.value = pls
    const meRow = pls.find((p) => p.id === socket.id)
    if (meRow) amIHost.value = meRow.isHost
  })

  socket.on('belote_seating', (order) => {
    if (Array.isArray(order)) seatOrder.value = [order[0] ?? null, order[1] ?? null, order[2] ?? null, order[3] ?? null]
  })
  socket.on('belote_option_updated', ({ key, value }) => {
    if (key === 'scoreMode') scoreMode.value = value
    if (key === 'teamNameA') teamNames.value = { ...teamNames.value, A: value || '' }
    if (key === 'teamNameB') teamNames.value = { ...teamNames.value, B: value || '' }
  })

  socket.on('game_started', () => { gameLogs.value = [] })

  socket.on('update_board_state', (d) => {
    gameStatus.value = d.status
    phase.value = d.phase
    scores.value = d.scores
    targetScore.value = d.targetScore
    handNumber.value = d.handNumber
    mySeat.value = d.mySeat
    amIHost.value = d.isHost
    isDealer.value = d.isDealer
    dealerSeat.value = d.dealerSeat
    turnSeat.value = d.turnSeat
    resolving.value = !!d.resolving
    cutterSeat.value = d.cutterSeat ?? null
    cutterName.value = d.cutterName ?? null
    trump.value = d.trump
    takerName.value = d.takerName
    takerSeat.value = d.takerSeat ?? null
    retourne.value = d.retourne
    myHand.value = d.myHand || []
    myLegalCards.value = d.myLegalCards || []
    currentTrick.value = d.currentTrick || []
    handPoints.value = d.handPoints || { A: 0, B: 0 }
    seats.value = d.seats || []
    beloteSeat.value = d.beloteSeat ?? null
    beloteTeam.value = d.beloteTeam ?? null
    handResult.value = d.handResult || null
    matchOver.value = !!d.matchOver
    if (d.scoreMode) scoreMode.value = d.scoreMode
    if (d.teamNames) teamNames.value = { A: d.teamNames.A || '', B: d.teamNames.B || '' }
  })

  socket.on('action_log', (msg) => {
    gameLogs.value.unshift(msg)
    if (gameLogs.value.length > 30) gameLogs.value.pop()
  })

  socket.on('belote_announce', ({ word, playerName, suit }) => {
    beloteFlash.value = { word, playerName, suit }
    clearTimeout(beloteFlashTimer)
    beloteFlashTimer = setTimeout(() => { beloteFlash.value = null }, 2600)
  })

  socket.on('game_over', (d) => {
    gameStatus.value = 'finished'
    endWinner.value = d.winner
    endForced.value = !!d.forced
    endScores.value = d.scores
    endTeams.value = d.teams
    if (d.teamNames) teamNames.value = { A: d.teamNames.A || '', B: d.teamNames.B || '' }
  })
})

onUnmounted(() => {
  clearTimeout(toastTimer)
  clearTimeout(beloteFlashTimer)
  socket.disconnect()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
.belote-wrapper, .belote-wrapper *, .belote-wrapper *::before, .belote-wrapper *::after { box-sizing: border-box; }

.belote-wrapper { min-height: 100vh; background: #0a1f16; color: #e8f5ee; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; }

/* toast */
.toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); background: #0f2c20; border: 1px solid rgba(79,208,138,0.5); color: #d6f5e6; padding: 12px 22px; border-radius: 10px; font-weight: 700; z-index: 300; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }

/* belote flash */
.belote-flash { position: fixed; inset: 0; z-index: 250; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(6,20,14,0.72); animation: bfFade 2.6s ease forwards; pointer-events: none; overflow: hidden; }
.bf-halo { position: absolute; font-size: 46vmin; line-height: 1; opacity: 0.14; animation: bfHalo 2.6s ease-out forwards; }
.bf-halo.red { color: #ff4d5a; }
.bf-halo.black { color: #dfe9ff; }
.belote-flash-word { position: relative; font-size: clamp(2.6rem, 11vw, 5rem); font-weight: 900; color: #ffe08a; letter-spacing: 4px; text-shadow: 0 6px 28px rgba(0,0,0,0.7); animation: bfPop 0.55s cubic-bezier(0.2,1.5,0.35,1); }
.bf-suit { font-size: 0.9em; }
.bf-suit.red { color: #ff6b6b; }
.bf-suit.black { color: #fff; }
.belote-flash-who { position: relative; margin-top: 10px; font-size: 1.3rem; font-weight: 700; color: #eafff3; text-shadow: 0 2px 10px rgba(0,0,0,0.6); animation: bfPop 0.55s 0.1s cubic-bezier(0.2,1.5,0.35,1) backwards; }
@keyframes bfFade { 0%{opacity:0} 8%{opacity:1} 82%{opacity:1} 100%{opacity:0} }
@keyframes bfPop { from { transform: scale(0.45) rotate(-4deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes bfHalo { 0%{transform:scale(0.4); opacity:0} 20%{opacity:0.16} 100%{transform:scale(1.35); opacity:0} }
@media (prefers-reduced-motion: reduce) {
  .belote-flash, .belote-flash-word, .belote-flash-who, .bf-halo { animation: none !important; opacity: 1 !important; }
  .bf-halo { opacity: 0.12 !important; }
}

/* Badge persistant "belote" sur le joueur concerné */
.belote-badge { margin-top: 4px; background: rgba(255,224,138,0.16); border: 1px solid rgba(255,224,138,0.5); color: #ffe08a; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.belote-badge.inline { margin-top: 0; }
/* preneur : 👑 + couleur d'atout, aligné avec le pseudo */
.taker-badge { display: inline-flex; align-items: center; gap: 1px; font-size: 0.95em; line-height: 1; font-weight: 900; }
.taker-badge.red { color: #ff6b6b; }
.taker-badge.black { color: #eafff3; }

/* ===== salle d'attente ===== */
.waiting-screen { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 30px 16px; }
.waiting-screen h1 { font-size: 2.4rem; color: #4fd08a; margin: 0; }
.waiting-msg { color: #3f6b56; font-style: italic; }
.share-box { background: #0f2c20; padding: 16px 24px; border-radius: 12px; border: 1px solid rgba(79,208,138,0.22); text-align: center; }
.share-box p { margin: 0 0 10px 0; color: #a7d9c1; }
.share-box strong { color: #4fd08a; font-size: 1.3rem; }
.lobby-cols { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; width: 100%; max-width: 900px; }
.lobby-panel { background: #0f2c20; border: 1px solid rgba(79,208,138,0.15); border-radius: 14px; padding: 16px 18px; flex: 1 1 260px; min-width: 240px; }
.lobby-panel h3 { margin: 0 0 12px 0; color: #4fd08a; font-size: 1rem; }
.player-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.host-tag { background: #1f9c5f; color: #eafff3; font-size: 0.6rem; padding: 1px 6px; border-radius: 6px; font-weight: 900; }
.seat-grid { display: flex; flex-direction: column; gap: 8px; }
.seat-row { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; background: #0a1f16; border-left: 3px solid transparent; }
.seat-row.team-a { border-left-color: #4fd08a; }
.seat-row.team-b { border-left-color: #f0a24f; }
.seat-label { font-size: 0.72rem; color: #6a9d84; text-transform: uppercase; letter-spacing: 0.5px; }
.seat-select, .opt-row select { background: #0f2c20; color: #e8f5ee; border: 1px solid #2f5a44; border-radius: 7px; padding: 7px 9px; font-family: 'Outfit', sans-serif; font-size: 0.9rem; }
.seat-name { font-weight: 700; }
.seat-warn { color: #f0a24f; font-size: 0.8rem; margin: 8px 0 0 0; }
.team-names { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.team-names label { display: flex; flex-direction: column; gap: 4px; font-size: 0.72rem; color: #6a9d84; text-transform: uppercase; letter-spacing: 0.5px; }
.team-names input { background: #0f2c20; color: #e8f5ee; border: 1px solid #2f5a44; border-radius: 7px; padding: 7px 9px; font-family: 'Outfit', sans-serif; font-size: 0.92rem; }
.team-names input::placeholder { color: #4a7a63; }
.team-names input:focus { outline: none; border-color: #4fd08a; }
.tn-readonly { color: #a7d9c1; margin: 12px 0 0 0; font-size: 0.85rem; }
.opt-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 0.8rem; color: #6a9d84; text-transform: uppercase; letter-spacing: 0.5px; }
.opt-readonly { color: #a7d9c1; margin: 4px 0; font-size: 0.9rem; }
.opt-hint { color: #6a9d84; font-size: 0.78rem; margin: 8px 0 0 0; line-height: 1.4; }

.btn-primary { background: linear-gradient(135deg, #1f9c5f, #157a49); color: #eafff3; border: none; padding: 14px 28px; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: 0.2s; }
.btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #27b06d, #1f9c5f); transform: translateY(-2px); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-secondary { background: #0f2c20; color: #6a9d84; border: 1px solid #2f5a44; padding: 10px 18px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-weight: 700; cursor: pointer; transition: 0.2s; }
.btn-secondary:hover { border-color: #4fd08a; color: #eafff3; }

/* ===== table ===== */
.table-screen { flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 18px; background: #0f2c20; border-bottom: 1px solid rgba(79,208,138,0.2); flex-wrap: wrap; }
.tb-left, .tb-right { display: flex; align-items: center; gap: 10px; }
.tb-title { font-weight: 900; color: #4fd08a; }
.tb-hand { font-size: 0.85rem; color: #6a9d84; }
.tb-trump { font-weight: 900; padding: 2px 10px; border-radius: 999px; background: #0a1f16; border: 1px solid #2f5a44; }
.tb-trump.red { color: #ff6b6b; } .tb-trump.black { color: #cfe3ff; }
.tb-scores { display: flex; align-items: baseline; gap: 12px; font-size: 0.9rem; color: #a7d9c1; }
.sc.mine { color: #4fd08a; }
.sc-target { color: #3f6b56; font-size: 0.8rem; }
.tb-taker { font-size: 0.85rem; color: #ffe08a; }
.tb-stop { background: transparent; color: #7a9a8b; border: 1px solid #2f5a44; border-radius: 7px; padding: 4px 10px; font-family: 'Outfit', sans-serif; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: 0.15s; }
.tb-stop:hover { color: #ff8a8a; border-color: #ff8a8a; }

.felt {
  position: relative; flex: 1; min-height: 480px;
  margin: 14px; border-radius: 20px;
  background: radial-gradient(ellipse at center, #14563a 0%, #0d3a27 70%, #0a2c1e 100%);
  border: 2px solid #14563a;
  box-shadow: inset 0 0 60px rgba(0,0,0,0.4);
}
.seat { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 10px; border-radius: 12px; }
.seat.turn { background: rgba(79,208,138,0.16); box-shadow: 0 0 16px rgba(79,208,138,0.35); }
/* siège haut : cartes en main sur la 1re ligne, TOUTES les infos sur UNE ligne en dessous
   → bloc court, la zone du pli peut remonter */
.seat.top {
  top: 8px; left: 50%; transform: translateX(-50%);
  flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center;
  column-gap: 7px; row-gap: 3px; max-width: min(340px, 88vw);
}
.seat.top .hidden-hand { order: -1; flex-basis: 100%; justify-content: center; margin: 0 0 2px; }
.seat.top .seat-sub::before { content: "· "; }
.seat.left { left: 10px; top: 50%; transform: translateY(-50%); }
.seat.right { right: 10px; top: 50%; transform: translateY(-50%); }
.seat-head { display: flex; align-items: center; gap: 6px; font-weight: 700; }
.seat-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.seat-dot.team-a { background: #4fd08a; }
.seat-dot.team-b { background: #f0a24f; }
.seat-sub { font-size: 0.72rem; color: #8fc4ab; }
.sub-count { display: none; } /* visible seulement quand l'éventail face caché est masqué (mobile) */
.hidden-hand { display: flex; margin-top: 4px; }
.seat.top .hidden-hand { margin-top: 0; margin-bottom: 4px; }
.mini-card { width: 54px; height: 78px; }
.hidden-hand .mini-card + .mini-card { margin-left: -42px; }
/* sièges gauche/droite : cartes "couchées" (face au joueur latéral), empilées verticalement */
.seat.left .hidden-hand, .seat.right .hidden-hand { flex-direction: column; align-items: center; }
.seat.left .mini-card, .seat.right .mini-card { width: 78px; height: 54px; }
.seat.left .hidden-hand .mini-card + .mini-card,
.seat.right .hidden-hand .mini-card + .mini-card { margin-left: 0; margin-top: -40px; }
.seat.top .belote-badge { margin-top: 0; }

/* Boîte des cartes jouées : centrée et bornée en largeur pour rester groupée
   vers le milieu du tapis (sur desktop large, éviter que les cartes filent sur les côtés) */
.trick-zone { position: absolute; top: max(120px, 22%); bottom: 8%; left: 50%; width: min(52%, 440px); transform: translateX(-50%); }
.trick-card { position: absolute; }
.trick-card.top { top: 0; left: 50%; transform: translateX(-50%); }
.trick-card.bottom { bottom: 0; left: 50%; transform: translateX(-50%); }
.trick-card.left { left: 0; top: 50%; transform: translateY(-50%); }
.trick-card.right { right: 0; top: 50%; transform: translateY(-50%); }
.tc { width: 100px; height: 146px; border-radius: 7px; transition: box-shadow 0.2s ease; }
.trick-card.winning .tc { box-shadow: 0 0 0 3px #4fd08a, 0 0 20px rgba(79,208,138,0.55); }

/* Retourne au centre du plateau (choix de l'atout / distribution) */
.retourne-zone { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.rz-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: #a7d9c1; font-weight: 700; }
.rz-card { width: 116px; height: 168px; box-shadow: 0 8px 30px rgba(0,0,0,0.55); }

/* Bandeau "à qui de jouer" (+ actions) en bas du plateau */
.felt-panel {
  position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
  max-width: 94%;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  background: rgba(6,20,14,0.8); border: 1px solid rgba(79,208,138,0.35);
  padding: 9px 20px; border-radius: 16px;
  box-shadow: 0 6px 22px rgba(0,0,0,0.55);
}
.felt-panel.you { border-color: rgba(255,224,138,0.6); box-shadow: 0 0 26px rgba(255,224,138,0.4); }
.fp-text { font-weight: 800; font-size: 1rem; color: #d6f0e2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.felt-panel.you .fp-text { color: #ffe08a; animation: youPulse 1.6s ease-in-out infinite; }
.fp-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
.fp-cut { display: flex; align-items: center; gap: 8px; }
.cut-slider { width: 150px; accent-color: #4fd08a; }
.cut-val { font-size: 0.8rem; color: #a7d9c1; min-width: 3.2em; }
@media (prefers-reduced-motion: reduce) { .felt-panel.you .fp-text { animation: none; } }
@keyframes youPulse { 0%,100%{opacity:1} 50%{opacity:0.55} }

/* ma zone */
.my-zone { padding: 8px 14px 14px; background: #0c281c; border-top: 1px solid rgba(79,208,138,0.18); }
.my-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.9rem; margin-bottom: 8px; }
.my-tricks, .my-hp { color: #8fc4ab; font-size: 0.82rem; }

/* Domination de la manche — barre compacte 1 ligne */
.hand-meter { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.72rem; font-weight: 800; }
.hm-cap { flex-shrink: 0; display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
.hm-cap.a { color: #4fd08a; }
.hm-cap.b { color: #f0a24f; }
.hm-cap.lead { text-shadow: 0 0 7px currentColor; }
.hm-bar { flex: 1; display: flex; height: 15px; border-radius: 999px; overflow: hidden; background: #071811; border: 1px solid rgba(79,208,138,0.22); }
.hm-seg { display: flex; align-items: center; justify-content: center; min-width: 0; font-size: 0.64rem; font-weight: 900; color: #06140e; transition: flex-grow 0.4s ease; }
.hm-seg.a { background: linear-gradient(90deg, #2fae6e, #4fd08a); }
.hm-seg.b { background: linear-gradient(90deg, #e2953f, #f6b96e); }
.hm-seg span { padding: 0 5px; white-space: nowrap; }
.btn-act { background: #123a2a; color: #d6f5e6; border: 1px solid #2f5a44; border-radius: 8px; padding: 8px 16px; font-family: 'Outfit', sans-serif; font-weight: 700; cursor: pointer; transition: 0.15s; font-size: 0.95rem; }
.btn-act:hover { border-color: #4fd08a; background: #17452f; }
.btn-act.take { background: #1f6c44; }
.btn-act.red { color: #ff8a8a; }

.my-hand { display: flex; align-items: flex-end; padding: 28px 6px 10px; overflow-x: auto; overflow-y: hidden; }
.hand-card { flex-shrink: 0; border-radius: 7px; transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease; cursor: default; }
.hand-card .hc { width: 110px; height: 160px; }
/* jouables : légère mise en avant + anneau vert discret */
.hand-card.playable { cursor: pointer; box-shadow: 0 0 0 2px rgba(79,208,138,0.55); }
.hand-card.playable:hover { transform: translateY(-16px); box-shadow: 0 0 0 2px #4fd08a, 0 12px 24px rgba(0,0,0,0.5); }
@media (prefers-reduced-motion: reduce) { .hand-card, .hand-card.playable:hover { transform: none !important; } }

/* journal */
.log-panel { background: #071811; border-top: 1px solid rgba(79,208,138,0.12); height: 92px; flex-shrink: 0; overflow: hidden; }
.log-list { list-style: none; margin: 0; padding: 6px 16px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.log-list li { font-size: 0.82rem; color: #7fb99e; }
.log-list li.latest { color: #4fd08a; font-weight: 700; }

/* recap */
.recap-overlay { position: fixed; inset: 0; background: rgba(6,20,14,0.82); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.recap-modal { background: #0f2c20; border: 1px solid rgba(79,208,138,0.3); border-radius: 18px; padding: 24px 26px; max-width: 460px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
.recap-head { text-align: center; }
.recap-hand { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1.5px; color: #6a9d84; font-weight: 700; }
.recap-modal h2 { margin: 4px 0 10px 0; font-size: 1.9rem; text-align: center; letter-spacing: 0.5px; }
.recap-modal h2.ok { color: #4fd08a; }
.recap-modal h2.ko { color: #ff6b6b; }
.recap-modal h2.capot.ok { color: #7dffb0; }
.recap-modal h2.capot.ko { color: #ffb14f; }
.recap-line { text-align: center; color: #a7d9c1; margin: 0 0 4px 0; font-size: 0.95rem; }
.recap-line strong { color: #eafff3; }
.recap-trump { font-weight: 900; font-size: 1.15rem; }
.recap-trump.red { color: #ff6b6b; } .recap-trump.black { color: #eafff3; }
.recap-summary { text-align: center; color: #cfead9; background: #0a1f16; border: 1px solid rgba(79,208,138,0.15); border-radius: 10px; padding: 10px 14px; margin: 14px 0 16px; font-size: 0.92rem; line-height: 1.5; }

.recap-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
.recap-table th, .recap-table td { padding: 8px 12px; text-align: right; font-size: 0.95rem; }
.recap-table thead th { color: #8fc4ab; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(79,208,138,0.22); }
.recap-table thead th.tk { color: #ffe08a; }
.recap-table thead th.win { color: #4fd08a; }
.recap-table td:first-child, .recap-table th:first-child { text-align: left; color: #9ecdb8; font-size: 0.9rem; }
.recap-table .muted { color: #5f8c76; font-size: 0.82em; font-weight: 400; }
.recap-table tbody td:not(:first-child) { font-variant-numeric: tabular-nums; color: #e8f5ee; }
.recap-delta td { color: #ffe08a; font-weight: 800; border-top: 1px solid rgba(79,208,138,0.15); }
.recap-delta td:first-child { color: #ffe08a; }
.recap-total td { font-weight: 900; font-size: 1.05rem; color: #ffffff; border-top: 2px solid rgba(79,208,138,0.3); }
.recap-total td:first-child { color: #eafff3; font-size: 0.95rem; }
.recap-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; }

/* fin */
.end-screen { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }
.end-box { background: #0f2c20; border: 1px solid rgba(79,208,138,0.25); border-radius: 20px; padding: 36px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.7); }
.end-box h2 { color: #4fd08a; font-size: 2rem; margin: 0 0 8px 0; }
.end-reason { color: #a7d9c1; margin-bottom: 24px; }
.end-scores { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
.end-team { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; background: #0a1f16; }
.end-team.win { background: rgba(31,156,95,0.22); border: 1px solid rgba(79,208,138,0.4); }
.et-name { font-weight: 700; }
.et-players { flex: 1; text-align: left; color: #8fc4ab; font-size: 0.85rem; }
.et-score { font-weight: 900; font-size: 1.2rem; color: #4fd08a; }

@media (max-width: 640px) {
  .felt { min-height: 380px; margin: 8px; }
  /* pas de place pour les éventails face cachée : on affiche juste le nombre de cartes,
     et on décale les 3 sièges hors de la bande centrale où atterrit le pli */
  .seat .hidden-hand { display: none; }
  .sub-count { display: inline; }
  .seat.left  { left: 4px;  top: 22%; transform: none; max-width: 44%; }
  .seat.right { right: 4px; top: 22%; transform: none; max-width: 44%; align-items: flex-end; }
  .seat-nom { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .trick-zone { top: max(120px, 30%); bottom: 8%; width: min(92%, 320px); }
  .trick-card.top { top: 0; }
  .trick-card.left { left: 0; } .trick-card.right { right: 0; }
  .tc { width: 60px; height: 88px; }
  .rz-card { width: 84px; height: 122px; }
  .hand-card .hc { width: 74px; height: 108px; }

  .hm-cap { flex-shrink: 1; overflow: hidden; text-overflow: ellipsis; }
  .recap-table th, .recap-table td { padding: 7px 8px; font-size: 0.9rem; }
  .recap-table td:first-child, .recap-table th:first-child { font-size: 0.82rem; white-space: normal; }
}
</style>
