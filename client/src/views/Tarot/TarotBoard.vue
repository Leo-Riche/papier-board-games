<template>
  <div class="tarot-wrapper">
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- Annonce du preneur -->
    <div v-if="takerFlash" class="taker-flash">
      <div class="tf-crown">👑</div>
      <div class="tf-name">{{ takerFlash.name }}</div>
      <div class="tf-contract">{{ takerFlash.contract }}</div>
    </div>

    <!-- ============ SALLE D'ATTENTE ============ -->
    <div v-if="gameStatus === 'waiting'" class="waiting-screen">
      <h1>Tarot 🃏</h1>
      <div class="share-box">
        <p>Code de la table : <strong>{{ roomCode }}</strong></p>
        <button class="btn-secondary" @click="copyLink">📋 Copier le lien d'invitation</button>
      </div>

      <div class="lobby-cols">
        <div class="lobby-panel">
          <h3>Joueurs ({{ allConnectedPlayers.length }})</h3>
          <p class="panel-hint">De 3 à 5 joueurs</p>
          <ul class="player-list">
            <li v-for="p in allConnectedPlayers" :key="p.id">
              👤 {{ p.name }} <span v-if="p.isHost" class="host-tag">hôte</span>
            </li>
          </ul>
        </div>

        <div class="lobby-panel">
          <h3>Placement à table</h3>
          <div class="seat-grid">
            <div v-for="i in seatCount" :key="i" class="seat-row">
              <span class="seat-label">Siège {{ i }}</span>
              <select v-if="amIHost" v-model="seatOrder[i - 1]" @change="pushSeating" class="seat-select">
                <option :value="null">—</option>
                <option v-for="p in allConnectedPlayers" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <span v-else class="seat-name">{{ nameById(seatOrder[i - 1]) || '—' }}</span>
            </div>
          </div>
          <p v-if="amIHost && allConnectedPlayers.length < 3" class="seat-warn">Il faut au moins 3 joueurs.</p>
          <p v-else-if="amIHost && allConnectedPlayers.length > 5" class="seat-warn">5 joueurs maximum.</p>
          <p v-else-if="amIHost && !seatingValid" class="seat-warn">Place chaque joueur (un par siège).</p>
        </div>

        <div class="lobby-panel" v-if="amIHost">
          <h3>Format de partie</h3>
          <label class="opt-row">
            <select v-model="scoreMode" @change="pushOption('scoreMode', scoreMode)">
              <option value="fixed">Nombre de donnes fixe</option>
              <option value="target">Objectif de points</option>
              <option value="endless">Infinie (l'hôte arrête)</option>
              <option value="single">Donne unique</option>
            </select>
          </label>
          <label v-if="scoreMode === 'fixed'" class="opt-row">
            <span class="opt-lbl">Nombre de donnes</span>
            <select v-model.number="totalDeals" @change="pushOption('totalDeals', totalDeals)">
              <option v-for="n in [4,8,12,16,20]" :key="n" :value="n">{{ n }} donnes</option>
            </select>
          </label>
          <label v-if="scoreMode === 'target'" class="opt-row">
            <span class="opt-lbl">Points pour gagner</span>
            <input
              type="number" class="opt-num" min="50" max="5000" step="50"
              v-model.number="targetScore"
              @change="pushOption('targetScore', clampTarget())"
            />
          </label>
          <label class="opt-check">
            <input type="checkbox" v-model="allowSlam" @change="pushOption('allowSlam', allowSlam)" />
            <span>Chelem<br /><small>autoriser l'annonce du grand chelem (±400)</small></span>
          </label>
          <label class="opt-check">
            <input type="checkbox" v-model="allowHandful" @change="pushOption('allowHandful', allowHandful)" />
            <span>Poignée<br /><small>autoriser la présentation des poignées (10/13/15 atouts)</small></span>
          </label>
        </div>
        <div class="lobby-panel" v-else>
          <h3>Format de partie</h3>
          <p class="opt-readonly">{{ modeLabel }}</p>
          <p class="opt-readonly small">{{ allowSlam ? '🏆 Chelem autorisé' : '🚫 Sans chelem' }} · {{ allowHandful ? '✋ Poignées' : '🚫 Sans poignée' }}</p>
        </div>
      </div>

      <button
        v-if="amIHost"
        class="btn-primary"
        :disabled="!canStartGame"
        @click="startGame"
      >LANCER LA PARTIE</button>
      <p v-else class="waiting-msg">En attente de l'hôte…</p>
    </div>

    <!-- ============ PARTIE ============ -->
    <div v-else-if="['bidding','calling','ecart','playing','hand_over'].includes(gameStatus)" class="table-screen">

      <!-- Bandeau -->
      <div class="topbar">
        <div class="tb-left">
          <span class="tb-title">Tarot</span>
          <span class="tb-hand">Donne {{ handNumber }}<span v-if="scoreMode === 'fixed'"> / {{ totalDeals }}</span><span v-else-if="scoreMode === 'target'" class="tb-target"> · but {{ targetScore }} pts</span></span>
          <span v-if="contractLabel" class="tb-contract">{{ contractLabel }}</span>
        </div>
        <div class="tb-scores">
          <span
            v-for="s in seatsByScore"
            :key="s.seat"
            class="tb-sc"
            :class="{ mine: s.seat === mySeat, lead: s.seat === leaderSeat }"
          >{{ s.name }} <b>{{ s.score }}</b></span>
        </div>
        <div class="tb-right">
          <span v-if="calledCard" class="tb-called" :class="suitColorName(calledCard.suit)" title="Carte appelée">📣 {{ calledCardLabel }}</span>
          <span v-if="takerName" class="tb-taker">👑 {{ takerName }}</span>
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
          v-for="op in opponentSeats"
          :key="op.seat"
          class="seat"
          :class="[op.pos, { turn: op.isTurn }]"
        >
          <div class="seat-head">
            <span class="seat-nom">{{ op.name }}</span>
            <span v-if="op.isDealer" class="mini-badge dealer" title="Donneur">D</span>
            <span v-if="op.isTaker" class="mini-badge taker" title="Preneur">👑</span>
            <span v-if="op.isPartner" class="mini-badge partner" title="Partenaire">🤝</span>
          </div>
          <div class="seat-sub">
            <span class="seat-score">{{ op.score }} pts</span>
            <span class="sub-count"> · {{ op.tricksWon }} pli{{ op.tricksWon > 1 ? 's' : '' }}</span>
          </div>
          <div v-if="gameStatus === 'bidding' && op.bid" class="bid-bubble" :class="{ pass: op.bid === 'pass' }">
            {{ bidLabel(op.bid) }}
          </div>
          <div v-if="op.hasPoignee" class="poignee-badge">✋ Poignée</div>
          <div class="hidden-hand" :class="{ dealing }">
            <TarotCard
              v-for="n in Math.min(op.handCount, 12)"
              :key="n"
              face-down
              class="mini-card"
              :style="{ '--di': n - 1 }"
            />
          </div>
        </div>

        <!-- Chien dévoilé (pendant l'écart) -->
        <div v-if="gameStatus === 'ecart' && chienRevealed && chien" class="chien-zone">
          <div class="chien-tag">Le Chien</div>
          <div class="chien-cards">
            <TarotCard v-for="c in chien" :key="cid(c)" :card="c" class="chien-card" />
          </div>
        </div>

        <!-- Pli au centre -->
        <div class="trick-zone">
          <div
            v-for="t in currentTrick"
            :key="t.seat"
            class="trick-card"
            :class="[posClass(t.seat), { winning: t.seat === trickWinnerSeat }]"
          >
            <TarotCard :card="t.card" class="tc" />
            <span class="trick-name">{{ t.name }}</span>
          </div>
        </div>

        <!-- Revoir le dernier pli -->
        <button v-if="canReviewTrick" class="review-btn" @click="showLastTrick = !showLastTrick">
          {{ showLastTrick ? '✕ Fermer' : '↩ Revoir le pli' }}
        </button>
        <div v-if="canReviewTrick && showLastTrick" class="last-trick-view" @click.self="showLastTrick = false">
          <div class="ltv-tag">Dernier pli</div>
          <div class="ltv-row">
            <div v-for="(t, i) in lastTrick.cards" :key="t.seat" class="ltv-slot">
              <div class="ltv-card-wrap">
                <TarotCard :card="t.card" class="tc" :class="{ 'ltv-win': t.seat === lastTrick.winnerSeat }" />
                <span class="ltv-order" :class="{ first: i === 0 }">{{ i + 1 }}</span>
              </div>
              <span class="ltv-name">{{ t.name }}</span>
            </div>
          </div>
          <div class="ltv-caption">Pli pour {{ nameOfSeat(lastTrick.winnerSeat) }}</div>
        </div>
        <div v-if="reviewLocked && !showLastTrick" class="review-lock-banner">
          👀 {{ reviewers.join(', ') }} regarde{{ reviewers.length > 1 ? 'nt' : '' }} le dernier pli…
        </div>

        <!-- Bandeau d'action (enchères / entame) -->
        <div v-if="feltTurnText" class="felt-panel" :class="{ you: feltTurnMine }">
          <div class="fp-text">{{ feltTurnText }}</div>
          <div v-if="feltTurnMine && gameStatus === 'bidding'" class="fp-actions">
            <button class="btn-act pass" @click="act('bid', { contract: 'pass' })">Passe</button>
            <button
              v-for="c in myBidOptions"
              :key="c"
              class="btn-act take"
              @click="act('bid', { contract: c })"
            >{{ bidLabel(c) }}</button>
          </div>
          <div v-if="feltTurnMine && gameStatus === 'calling'" class="fp-actions">
            <button
              v-for="su in ['spades','hearts','diamonds','clubs']"
              :key="su"
              class="btn-act take call"
              :class="suitColorName(su)"
              @click="act('call_king', { suit: su })"
            >{{ callRankLabel }} <span class="call-suit">{{ suitSym(su) }}</span></button>
          </div>
        </div>
      </div>

      <!-- Zone du bas : moi -->
      <div class="my-zone">
        <div class="my-head">
          <strong>{{ myName }}</strong>
          <span v-if="me?.isDealer" class="mini-badge dealer">Donneur</span>
          <span v-if="me?.isTaker" class="mini-badge taker">👑 Preneur</span>
          <span v-if="iAmPartner || me?.isPartner" class="mini-badge partner">🤝 Partenaire</span>
          <span v-if="me?.hasPoignee" class="poignee-badge inline">✋ Poignée</span>
          <span class="my-score">· {{ me?.score ?? 0 }} pts</span>
          <span v-if="gameStatus === 'playing'" class="my-tricks">· {{ me?.tricksWon || 0 }} pli(s)</span>
        </div>

        <!-- Écart : consignes + validation -->
        <div v-if="gameStatus === 'ecart' && canEcart" class="ecart-bar">
          <span class="ecart-info">Choisis <strong>{{ ecartSize }} cartes</strong> à écarter ({{ ecartSel.size }}/{{ ecartSize }}) — ni Roi ni Bout.</span>
          <label v-if="allowSlam" class="slam-toggle">
            <input type="checkbox" :checked="!!slam" @change="toggleSlam" /> Annoncer un Chelem 🏆
          </label>
          <button class="btn-act take" :disabled="!ecartValid" @click="validateEcart">Valider l'écart</button>
        </div>
        <div v-else-if="gameStatus === 'ecart' && canStart" class="ecart-bar">
          <span class="ecart-info">{{ contractLabel }} — le Chien reste caché.</span>
          <label v-if="allowSlam" class="slam-toggle">
            <input type="checkbox" :checked="!!slam" @change="toggleSlam" /> Annoncer un Chelem 🏆
          </label>
          <button class="btn-act take" @click="act('start_play', {})">Commencer</button>
        </div>
        <div v-else-if="gameStatus === 'ecart'" class="ecart-bar waiting">
          {{ takerName }} constitue son jeu…
        </div>

        <!-- Poignée proposée -->
        <div v-if="showPoigneeOffer" class="poignee-bar">
          <span>Tu as {{ poigneeOffer.count }} atouts — présenter une poignée ?</span>
          <button v-for="k in poigneeOffer.kinds" :key="k" class="btn-act take small" @click="act('declare_poignee', { kind: k })">
            {{ poigneeKindLabel(k) }}
          </button>
          <button class="btn-act small" @click="poigneeDismissed = true">Non</button>
        </div>

        <!-- Ma main -->
        <div class="my-hand" :class="{ dealing }" v-if="myHand.length">
          <div
            v-for="(c, i) in myHand"
            :key="cid(c)"
            class="hand-card"
            :class="{
              playable: canPlay(c),
              selected: gameStatus === 'ecart' && ecartSel.has(cid(c)),
              forbidden: gameStatus === 'ecart' && canEcart && !isEcartable(c),
            }"
            :style="{ marginLeft: i > 0 ? handOverlap : '0', '--di': i }"
            @click="onCardClick(c)"
          >
            <TarotCard :card="c" class="hc" />
          </div>
        </div>
      </div>

      <!-- Feuille de score (desktop large) -->
      <div class="score-sheet">
        <div class="ss-head">Feuille de score</div>
        <div class="ss-scroll">
          <table class="ss-table">
            <thead>
              <tr>
                <th>Donne</th>
                <th v-for="s in seats" :key="s.seat" :class="{ mine: s.seat === mySeat }">{{ shortName(s.name) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(h, idx) in history" :key="idx">
                <td class="ss-hand">{{ h.hand }}<span class="ss-taker" :title="h.takerName">👑{{ h.takerSeat + 1 }}</span></td>
                <td v-for="s in seats" :key="s.seat" :class="{ taker: h.takerSeat === s.seat, neg: h.delta[s.seat] < 0 }">
                  {{ h.delta[s.seat] > 0 ? '+' : '' }}{{ h.delta[s.seat] }}
                </td>
              </tr>
              <tr v-if="!history.length"><td :colspan="seats.length + 1" class="ss-empty">Aucune donne terminée</td></tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td v-for="s in seats" :key="s.seat">{{ s.score }}</td>
              </tr>
            </tfoot>
          </table>
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
            <h2 :class="handResult.made ? 'ok' : 'ko'">{{ handResult.made ? 'Contrat réussi' : 'Chute' }}</h2>
            <p class="recap-line">
              Preneur : <strong>{{ handResult.takerName }}</strong> · {{ handResult.contractLabel }}
              <span class="mult">×{{ handResult.mult }}</span>
            </p>
            <p v-if="playerCount === 5" class="recap-line small">
              <template v-if="handResult.partnerName">🤝 Partenaire : <strong>{{ handResult.partnerName }}</strong></template>
              <template v-else>Preneur seul</template>
              <span v-if="handResult.calledCard"> · appel {{ RANK_FR[handResult.calledCard.value] }} {{ suitSym(handResult.calledCard.suit) }}</span>
            </p>
          </div>

          <table class="recap-table">
            <tbody>
              <tr>
                <td>Points du preneur</td>
                <td><b>{{ handResult.takerPts }}</b> / {{ handResult.target }}
                  <span class="muted">({{ handResult.oudlers }} bout{{ handResult.oudlers > 1 ? 's' : '' }})</span></td>
              </tr>
              <tr>
                <td>Écart au contrat</td>
                <td>{{ handResult.made ? '+' : '−' }}{{ handResult.diff }} → base {{ 25 + handResult.diff }}</td>
              </tr>
              <tr v-if="handResult.petitInLast">
                <td>Petit au Bout</td>
                <td :class="handResult.petitBout >= 0 ? 'pos' : 'neg'">{{ handResult.petitBout >= 0 ? '+' : '' }}{{ handResult.petitBout }}</td>
              </tr>
              <tr v-for="(p, i) in handResult.poignees" :key="i">
                <td>Poignée <span class="muted">({{ p.name }}, {{ p.count }} at.)</span></td>
                <td>{{ handResult.poigneeSigned >= 0 ? '+' : '−' }}{{ p.bonus }}</td>
              </tr>
              <tr v-if="handResult.slamLabel">
                <td>Chelem</td>
                <td :class="handResult.slamSigned >= 0 ? 'pos' : 'neg'">{{ handResult.slamLabel }}</td>
              </tr>
              <tr class="recap-delta">
                <td>Total par défenseur</td>
                <td>{{ handResult.perDefender >= 0 ? '+' : '' }}{{ handResult.perDefender }}</td>
              </tr>
            </tbody>
          </table>

          <div class="recap-players">
            <div v-for="s in seats" :key="s.seat" class="rp-row" :class="{ taker: s.seat === handResult.takerSeat || s.seat === handResult.partnerSeat, me: s.seat === mySeat }">
              <span class="rp-name">{{ s.name }}<span v-if="s.seat === handResult.takerSeat"> 👑</span><span v-if="s.seat === handResult.partnerSeat"> 🤝</span></span>
              <span class="rp-delta" :class="handResult.delta[s.seat] >= 0 ? 'pos' : 'neg'">
                {{ handResult.delta[s.seat] >= 0 ? '+' : '' }}{{ handResult.delta[s.seat] }}
              </span>
              <span class="rp-total">{{ handResult.totals[s.seat] }}</span>
            </div>
          </div>

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
        <div class="end-ranking">
          <div
            v-for="(r, i) in endRanking"
            :key="r.seat"
            class="end-rank"
            :class="{ win: endWinner === r.seat, me: r.seat === mySeat }"
          >
            <span class="er-pos">{{ i + 1 }}</span>
            <span class="er-name">{{ r.name }}</span>
            <span class="er-score">{{ r.score }}</span>
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
import TarotCard from './TarotCard.vue'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

const CONTRACTS = ['petite', 'garde', 'garde_sans', 'garde_contre']
const CONTRACT_LABEL = { petite: 'Petite', garde: 'Garde', garde_sans: 'Garde Sans', garde_contre: 'Garde Contre' }
const cid = (c) => `${c.suit}_${c.value}`
const isTrumpC = (c) => c.suit === 'trump'
const isExcuseC = (c) => c.suit === 'excuse'
const isOudlerC = (c) => isExcuseC(c) || (isTrumpC(c) && (c.value === '01' || c.value === '21'))
const isKingC = (c) => !isTrumpC(c) && !isExcuseC(c) && c.value === 'R'

const SUIT_RANK = Object.fromEntries(['01','02','03','04','05','06','07','08','09','10','V','C','D','R'].map((r,i)=>[r,i]))
function strength(card, leadSuit) {
  if (isExcuseC(card)) return -1
  if (isTrumpC(card)) return 300 + parseInt(card.value, 10)
  if (card.suit === leadSuit) return 100 + SUIT_RANK[card.value]
  return 0
}

// ---- lobby ----
const allConnectedPlayers = ref([])
const amIHost = ref(false)
const seatOrder = ref([])
const scoreMode = ref('fixed')
const totalDeals = ref(8)
const targetScore = ref(500)
const allowSlam = ref(true)
const allowHandful = ref(true)

// ---- partie ----
const gameStatus = ref('waiting')
const phase = ref(null)
const playerCount = ref(4)
const tricksTotal = ref(18)
const handNumber = ref(0)
const scores = ref([0, 0, 0, 0])
const mySeat = ref(0)
const dealerSeat = ref(0)
const turnSeat = ref(0)
const resolving = ref(false)
const takerSeat = ref(null)
const takerName = ref(null)
const contract = ref(null)
const contractLabel = ref(null)
const bids = ref([null, null, null, null])
const highestBid = ref(null)
const chienRevealed = ref(false)
const chien = ref(null)
const ecartCount = ref(0)
const ecartSize = ref(6)
const needEcart = ref(false)
const canEcart = ref(false)
const canStart = ref(false)
const calledCard = ref(null)
const canCall = ref(false)
const callRank = ref(null)
const partnerSeat = ref(null)
const iAmPartner = ref(false)
const slam = ref(null)
const poignees = ref([])
const myHand = ref([])
const myLegalCards = ref([])
const poigneeOffer = ref(null)
const currentTrick = ref([])
const leadSuit = ref(null)
const lastTrick = ref(null)
const showLastTrick = ref(false)
const reviewers = ref([])
const seats = ref([])
const history = ref([])
const handResult = ref(null)
const matchOver = ref(false)

const ecartSel = ref(new Set())
const poigneeDismissed = ref(false)

const gameLogs = ref([])
const toast = ref('')
let toastTimer = null
const takerFlash = ref(null)
let takerFlashTimer = null

// deal animation
const dealing = ref(false)
let dealTimer = null
function runDealSequence() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) { dealing.value = false; return }
  dealing.value = true
  clearTimeout(dealTimer)
  dealTimer = setTimeout(() => { dealing.value = false }, 1500)
}

// end
const endWinner = ref(null)
const endForced = ref(false)
const endRanking = ref([])

// ---- computed ----
const myName = computed(() =>
  seats.value.find((s) => s.seat === mySeat.value)?.name ||
  allConnectedPlayers.value.find((p) => p.id === socket.id)?.name || ''
)
const me = computed(() => seats.value.find((s) => s.seat === mySeat.value))
const isMyTurn = computed(() => turnSeat.value === mySeat.value)
const legalSet = computed(() => new Set(myLegalCards.value))
const seatCount = computed(() => allConnectedPlayers.value.length)
const seatingValid = computed(() => {
  const v = seatOrder.value.filter(Boolean)
  return v.length === seatCount.value && new Set(v).size === seatCount.value
})
const canStartGame = computed(() =>
  allConnectedPlayers.value.length >= 3 && allConnectedPlayers.value.length <= 5 && seatingValid.value
)
const modeLabel = computed(() => scoreMode.value === 'fixed' ? `${totalDeals.value} donnes`
  : scoreMode.value === 'target' ? `Objectif ${targetScore.value} pts`
  : scoreMode.value === 'endless' ? 'Infinie' : 'Donne unique')
const handOverlap = computed(() => (myHand.value.length > 14 ? '-34px' : myHand.value.length > 9 ? '-26px' : '-16px'))

const seatsByScore = computed(() => seats.value.slice().sort((a, b) => a.seat - b.seat))
const leaderSeat = computed(() => {
  if (!seats.value.length) return null
  let best = seats.value[0]
  for (const s of seats.value) if (s.score > best.score) best = s
  return best.score > 0 ? best.seat : null
})

const myBidOptions = computed(() => {
  const start = highestBid.value ? CONTRACTS.indexOf(highestBid.value) + 1 : 0
  return CONTRACTS.slice(start)
})

const trickWinnerSeat = computed(() => {
  const t = currentTrick.value
  if (gameStatus.value !== 'playing' || !t.length) return null
  const lead = leadSuit.value
  let best = t.find((x) => !isExcuseC(x.card)) || t[0]
  for (const x of t) if (strength(x.card, lead) > strength(best.card, lead)) best = x
  return best.seat
})

const canReviewTrick = computed(() =>
  gameStatus.value === 'playing' && !currentTrick.value.length && !!lastTrick.value
)
const reviewLocked = computed(() => reviewers.value.length > 0)
watch(showLastTrick, (v) => { act('review', { open: v }) })

const ecartValid = computed(() => {
  if (ecartSel.value.size !== ecartSize.value) return false
  for (const id of ecartSel.value) {
    const c = myHand.value.find((x) => cid(x) === id)
    if (!c || isKingC(c) || isOudlerC(c)) return false
  }
  return true
})

const showPoigneeOffer = computed(() =>
  gameStatus.value === 'playing' && poigneeOffer.value && !poigneeDismissed.value && !me.value?.hasPoignee
)

const SUIT_SYM = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
const RANK_FR = { R: 'Roi', D: 'Dame', C: 'Cavalier', V: 'Valet' }
const suitSym = (s) => SUIT_SYM[s] || ''
const suitColorName = (s) => (s === 'hearts' || s === 'diamonds' ? 'red' : 'black')
const calledCardLabel = computed(() => {
  if (!calledCard.value) return ''
  return `${RANK_FR[calledCard.value.value] || ''} ${SUIT_SYM[calledCard.value.suit] || ''}`
})
const callRankLabel = computed(() => RANK_FR[callRank.value] || 'Roi')

const feltTurnMine = computed(() =>
  !resolving.value && ((gameStatus.value === 'bidding' && isMyTurn.value) || (gameStatus.value === 'calling' && canCall.value))
)
const feltTurnText = computed(() => {
  if (gameStatus.value === 'bidding') {
    return isMyTurn.value ? '⭐ À toi d\'enchérir' : `Enchères — ${nameOfSeat(turnSeat.value)}`
  }
  if (gameStatus.value === 'calling') {
    return canCall.value ? `⭐ Appelle un ${callRankLabel.value}` : `${takerName.value} appelle un Roi…`
  }
  if (gameStatus.value === 'playing') {
    if (resolving.value && trickWinnerSeat.value != null) return `✋ ${nameOfSeat(trickWinnerSeat.value)} remporte le pli`
    return isMyTurn.value ? '⭐ À toi de jouer' : ''
  }
  return ''
})

const endReason = computed(() => {
  if (endForced.value) return "Partie arrêtée par l'hôte."
  const w = endRanking.value[0]
  if (!w) return ''
  if (endWinner.value == null) return `Égalité en tête à ${w.score} points !`
  return `${w.name} l'emporte avec ${w.score} points !`
})

// ---- helpers ----
function nameOfSeat(seat) { return seats.value.find((s) => s.seat === seat)?.name || '?' }
function nameById(id) { return allConnectedPlayers.value.find((p) => p.id === id)?.name || '' }
function shortName(n) { return (n || '').length > 6 ? n.slice(0, 5) + '…' : n }
function bidLabel(b) { return b === 'pass' ? 'Passe' : (CONTRACT_LABEL[b] || b) }
function poigneeKindLabel(k) { return { simple: 'Simple (+20)', double: 'Double (+30)', triple: 'Triple (+40)' }[k] || k }

// index d'écran : 0 = moi (bas), puis dans le sens du jeu
function screenIdx(seat) { return (seat - mySeat.value + playerCount.value) % playerCount.value }
// disposition des places selon le nombre de joueurs (screenIdx → position sur le tapis)
const POS_LAYOUT = {
  3: ['bottom', 'topleft', 'topright'],
  4: ['bottom', 'left', 'top', 'right'],
  5: ['bottom', 'left', 'topleft', 'topright', 'right'],
}
function posClass(seat) {
  const layout = POS_LAYOUT[playerCount.value] || POS_LAYOUT[4]
  return layout[screenIdx(seat)] || 'top'
}
// sièges adverses (tous sauf moi), avec leur position
const opponentSeats = computed(() =>
  seats.value.filter((s) => s.seat !== mySeat.value).map((s) => ({ ...s, pos: posClass(s.seat) }))
)

function isEcartable(c) { return !isKingC(c) && !isOudlerC(c) }
function canPlay(c) {
  return gameStatus.value === 'playing' && isMyTurn.value && !reviewLocked.value && legalSet.value.has(cid(c))
}
function onCardClick(c) {
  if (gameStatus.value === 'ecart' && canEcart.value) {
    const id = cid(c)
    if (ecartSel.value.has(id)) { ecartSel.value.delete(id); ecartSel.value = new Set(ecartSel.value); return }
    if (!isEcartable(c)) { showToast('Un Roi ou un Bout ne peut pas être écarté.'); return }
    if (ecartSel.value.size >= 6) { showToast('6 cartes maximum.'); return }
    ecartSel.value.add(id); ecartSel.value = new Set(ecartSel.value)
    return
  }
  if (canPlay(c)) act('play_card', { cardId: cid(c) })
}
function validateEcart() {
  if (!ecartValid.value) return
  act('ecart', { cardIds: [...ecartSel.value] })
  ecartSel.value = new Set()
}
function toggleSlam(e) {
  act(e.target.checked ? 'declare_slam' : 'cancel_slam', {})
}

// ---- actions ----
function act(actionType, payload) {
  socket.emit('tarot_action', { roomCode, actionType, payload: payload || {} })
}
function confirmStop() {
  if (window.confirm('Arrêter la partie maintenant ? Le classement actuel décidera du vainqueur.')) act('end_match', {})
}
function startGame() {
  socket.emit('start_tarot', {
    roomCode,
    seatOrder: seatOrder.value,
    options: {
      scoreMode: scoreMode.value,
      totalDeals: totalDeals.value,
      targetScore: clampTarget(),
      allowSlam: allowSlam.value,
      allowHandful: allowHandful.value,
    },
  })
}
function clampTarget() {
  let v = Math.round(Number(targetScore.value) || 0)
  v = Math.max(50, Math.min(5000, v))
  targetScore.value = v
  return v
}
function pushSeating() { socket.emit('tarot_set_seating', { roomCode, seatOrder: seatOrder.value }) }
function pushOption(key, value) { socket.emit('tarot_sync_option', { roomCode, key, value }) }
function copyLink() {
  const link = `${window.location.origin}/tarot/join/${roomCode}`
  navigator.clipboard.writeText(link).then(() => showToast('Lien copié ✓'))
}
function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

watch(allConnectedPlayers, (list) => {
  if (!amIHost.value) return
  const ids = list.map((p) => p.id)
  const n = ids.length
  const cur = seatOrder.value.filter((x) => x && ids.includes(x))
  if (cur.length !== n || new Set(cur).size !== cur.length || seatOrder.value.length !== n) {
    const next = new Array(n).fill(null)
    ids.forEach((id, i) => { next[i] = id })
    seatOrder.value = next
    pushSeating()
  }
})

// rejoue l'animation de distribution à chaque nouvelle donne
watch(() => `${gameStatus.value}|${handNumber.value}`, (now, prev) => {
  if (gameStatus.value === 'bidding' && (!prev || !prev.startsWith('bidding'))) runDealSequence()
})

// ---- socket ----
onMounted(() => {
  const sendName = () => {
    const saved = localStorage.getItem('temp_player_name')
    if (saved) socket.emit('set_player_name', { name: saved, roomCode, maxPlayers: 5 })
  }
  if (socket.connected) sendName()
  else socket.on('connect', sendName)

  socket.on('room_full', (msg) => { showToast(msg); setTimeout(() => { socket.disconnect(); router.push('/') }, 1600) })
  socket.on('tarot_error', (msg) => showToast(msg))

  socket.on('update_players_list', (pls) => {
    allConnectedPlayers.value = pls
    const meRow = pls.find((p) => p.id === socket.id)
    if (meRow) amIHost.value = meRow.isHost
  })

  socket.on('tarot_seating', (order) => {
    if (Array.isArray(order)) seatOrder.value = order.map((x) => x ?? null)
  })
  socket.on('tarot_option_updated', ({ key, value }) => {
    if (key === 'scoreMode') scoreMode.value = value
    if (key === 'totalDeals') totalDeals.value = value
    if (key === 'targetScore') targetScore.value = value
    if (key === 'allowSlam') allowSlam.value = !!value
    if (key === 'allowHandful') allowHandful.value = !!value
  })

  socket.on('game_started', () => { gameLogs.value = [] })

  socket.on('update_board_state', (d) => {
    const prevStatus = gameStatus.value
    const prevTaker = takerSeat.value
    gameStatus.value = d.status
    phase.value = d.phase
    if (d.playerCount) playerCount.value = d.playerCount
    if (d.tricksTotal) tricksTotal.value = d.tricksTotal
    handNumber.value = d.handNumber
    scores.value = d.scores
    mySeat.value = d.mySeat
    amIHost.value = d.isHost
    dealerSeat.value = d.dealerSeat
    turnSeat.value = d.turnSeat
    resolving.value = !!d.resolving
    takerSeat.value = d.takerSeat ?? null
    takerName.value = d.takerName
    contract.value = d.contract
    contractLabel.value = d.contractLabel
    bids.value = d.bids || [null, null, null, null]
    highestBid.value = d.highestBid || null
    chienRevealed.value = !!d.chienRevealed
    chien.value = d.chien || null
    ecartCount.value = d.ecartCount || 0
    if (d.ecartSize) ecartSize.value = d.ecartSize
    needEcart.value = !!d.needEcart
    canEcart.value = !!d.canEcart
    canStart.value = !!d.canStart
    calledCard.value = d.calledCard || null
    canCall.value = !!d.canCall
    callRank.value = d.callRank || null
    partnerSeat.value = d.partnerSeat ?? null
    iAmPartner.value = !!d.iAmPartner
    slam.value = d.slam || null
    poignees.value = d.poignees || []
    myHand.value = d.myHand || []
    myLegalCards.value = d.myLegalCards || []
    poigneeOffer.value = d.poigneeOffer || null
    currentTrick.value = d.currentTrick || []
    leadSuit.value = d.leadSuit
    lastTrick.value = d.lastTrick || null
    reviewers.value = d.reviewers || []
    if (currentTrick.value.length || !lastTrick.value) showLastTrick.value = false
    seats.value = d.seats || []
    history.value = d.history || []
    handResult.value = d.handResult || null
    matchOver.value = !!d.matchOver
    if (d.scoreMode) scoreMode.value = d.scoreMode
    if (d.totalDeals) totalDeals.value = d.totalDeals
    if (d.targetScore) targetScore.value = d.targetScore

    if (d.status === 'bidding') { ecartSel.value = new Set(); poigneeDismissed.value = false }
    // flash preneur quand il vient d'être désigné
    if (d.takerSeat != null && d.takerSeat !== prevTaker && (d.status === 'ecart' || d.status === 'calling')) {
      takerFlash.value = { name: d.takerName, contract: d.contractLabel }
      clearTimeout(takerFlashTimer)
      takerFlashTimer = setTimeout(() => { takerFlash.value = null }, 2400)
    }
  })

  socket.on('action_log', (msg) => {
    gameLogs.value.unshift(msg)
    if (gameLogs.value.length > 30) gameLogs.value.pop()
  })

  socket.on('game_over', (d) => {
    gameStatus.value = 'finished'
    endWinner.value = d.winner
    endForced.value = !!d.forced
    endRanking.value = d.ranking || []
  })
})

onUnmounted(() => {
  clearTimeout(toastTimer)
  clearTimeout(takerFlashTimer)
  clearTimeout(dealTimer)
  if (showLastTrick.value) act('review', { open: false })
  socket.disconnect()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
.tarot-wrapper, .tarot-wrapper *, .tarot-wrapper *::before, .tarot-wrapper *::after { box-sizing: border-box; }

.tarot-wrapper { min-height: 100vh; background: #150e26; color: #efe8f7; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; }

/* toast */
.toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); background: #221739; border: 1px solid rgba(196,160,80,0.5); color: #efe8f7; padding: 12px 22px; border-radius: 10px; font-weight: 700; z-index: 300; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }

/* flash preneur */
.taker-flash { position: fixed; inset: 0; z-index: 250; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(21,14,38,0.72); animation: tfFade 2.4s ease forwards; pointer-events: none; }
.tf-crown { font-size: 15vmin; animation: tfPop 0.5s cubic-bezier(0.2,1.5,0.35,1); }
.tf-name { font-size: clamp(2rem, 9vw, 4rem); font-weight: 900; color: #e8c46a; text-shadow: 0 6px 28px rgba(0,0,0,0.7); animation: tfPop 0.5s cubic-bezier(0.2,1.5,0.35,1); }
.tf-contract { margin-top: 6px; font-size: 1.4rem; font-weight: 800; color: #cdb3e8; text-transform: uppercase; letter-spacing: 2px; }
@keyframes tfFade { 0%{opacity:0} 8%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
@keyframes tfPop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .taker-flash, .tf-crown, .tf-name { animation: none !important; opacity: 1 !important; } }

/* ===== salle d'attente ===== */
.waiting-screen { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 30px 16px; }
.waiting-screen h1 { font-size: 2.4rem; color: #e8c46a; margin: 0; }
.waiting-msg { color: #7a63a3; font-style: italic; }
.share-box { background: #221739; padding: 16px 24px; border-radius: 12px; border: 1px solid rgba(196,160,80,0.22); text-align: center; }
.share-box p { margin: 0 0 10px 0; color: #a690c9; }
.share-box strong { color: #e8c46a; font-size: 1.3rem; }
.lobby-cols { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; width: 100%; max-width: 900px; }
.lobby-panel { background: #221739; border: 1px solid rgba(196,160,80,0.15); border-radius: 14px; padding: 16px 18px; flex: 1 1 260px; min-width: 240px; }
.lobby-panel h3 { margin: 0 0 12px 0; color: #e8c46a; font-size: 1rem; }
.panel-hint { margin: -8px 0 10px 0; font-size: 0.76rem; color: #7a63a3; }
.player-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.host-tag { background: #7c5cc4; color: #fff7e6; font-size: 0.6rem; padding: 1px 6px; border-radius: 6px; font-weight: 900; }
.seat-grid { display: flex; flex-direction: column; gap: 8px; }
.seat-row { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; background: #150e26; border-left: 3px solid #7c5cc4; }
.seat-label { font-size: 0.72rem; color: #7a63a3; text-transform: uppercase; letter-spacing: 0.5px; }
.seat-select, .opt-row select, .opt-num { background: #221739; color: #efe8f7; border: 1px solid #453466; border-radius: 7px; padding: 7px 9px; font-family: 'Outfit', sans-serif; font-size: 0.9rem; }
.opt-num { width: 120px; }
.tb-target { color: #e8c46a; }
.seat-name { font-weight: 700; }
.seat-warn { color: #e8c46a; font-size: 0.8rem; margin: 8px 0 0 0; }
.opt-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 0.8rem; color: #7a63a3; }
.opt-lbl { text-transform: uppercase; letter-spacing: 0.5px; }
.opt-check { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px; font-size: 0.82rem; color: #a690c9; cursor: pointer; }
.opt-check input { margin-top: 2px; accent-color: #7c5cc4; flex-shrink: 0; }
.opt-check small { color: #7a63a3; font-size: 0.74rem; }
.opt-readonly { color: #a690c9; margin: 4px 0; font-size: 0.9rem; }
.opt-readonly.small { font-size: 0.8rem; color: #cdb3e8; }

.btn-primary { background: linear-gradient(135deg, #7c5cc4, #5b3fa0); color: #fff7e6; border: none; padding: 14px 28px; border-radius: 10px; font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: 0.2s; }
.btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #8f6fd6, #6b4bb5); transform: translateY(-2px); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-secondary { background: #221739; color: #a690c9; border: 1px solid #453466; padding: 10px 18px; border-radius: 8px; font-family: 'Outfit', sans-serif; font-weight: 700; cursor: pointer; transition: 0.2s; }
.btn-secondary:hover { border-color: #e8c46a; color: #efe8f7; }

/* ===== table ===== */
.table-screen { flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 18px; background: #221739; border-bottom: 1px solid rgba(196,160,80,0.2); flex-wrap: wrap; }
.tb-left, .tb-right { display: flex; align-items: center; gap: 10px; }
.tb-title { font-weight: 900; color: #e8c46a; }
.tb-hand { font-size: 0.85rem; color: #7a63a3; }
.tb-contract { font-weight: 900; padding: 2px 10px; border-radius: 999px; background: #150e26; border: 1px solid #453466; color: #cdb3e8; }
.tb-scores { display: flex; align-items: baseline; gap: 10px; font-size: 0.82rem; color: #a690c9; flex-wrap: wrap; justify-content: center; }
.tb-sc.mine { color: #efe8f7; }
.tb-sc.lead b { color: #e8c46a; }
.tb-taker { font-size: 0.85rem; color: #e8c46a; }
.tb-called { font-size: 0.82rem; font-weight: 800; padding: 2px 9px; border-radius: 999px; background: #150e26; border: 1px solid #453466; }
.tb-called.red { color: #ff8a8a; } .tb-called.black { color: #cdb3e8; }
.tb-stop { background: transparent; color: #8a76ad; border: 1px solid #453466; border-radius: 7px; padding: 4px 10px; font-family: 'Outfit', sans-serif; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: 0.15s; }
.tb-stop:hover { color: #ff8a8a; border-color: #ff8a8a; }

.felt {
  position: relative; flex: 1; min-height: 480px; margin: 14px; border-radius: 20px;
  background: radial-gradient(ellipse at center, #3a2a5c 0%, #281a44 70%, #1f1436 100%);
  border: 2px solid #3a2a5c; box-shadow: inset 0 0 60px rgba(0,0,0,0.45);
}
.seat { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 10px; border-radius: 12px; }
.seat.turn { background: rgba(124,92,196,0.2); box-shadow: 0 0 16px rgba(124,92,196,0.45); }
.seat.top { top: 8px; left: 50%; transform: translateX(-50%); flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center; column-gap: 7px; row-gap: 3px; max-width: min(360px, 90vw); }
.seat.top .hidden-hand { order: -1; flex-basis: 100%; justify-content: center; margin: 0 0 2px; }
.seat.top .seat-sub::before { content: "· "; }
.seat.left { left: 10px; top: 50%; transform: translateY(-50%); }
.seat.right { right: 10px; top: 50%; transform: translateY(-50%); }
.seat.topleft { top: 10px; left: 16%; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center; column-gap: 7px; row-gap: 3px; max-width: min(300px, 40vw); }
.seat.topright { top: 10px; right: 16%; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center; column-gap: 7px; row-gap: 3px; max-width: min(300px, 40vw); }
.seat.topleft .hidden-hand, .seat.topright .hidden-hand { order: -1; flex-basis: 100%; justify-content: center; margin: 0 0 2px; }
.seat.topleft .seat-sub::before, .seat.topright .seat-sub::before { content: "· "; }
.seat-head { display: flex; align-items: center; gap: 6px; font-weight: 700; }
.mini-badge { font-size: 0.62rem; font-weight: 900; padding: 1px 6px; border-radius: 6px; white-space: nowrap; }
.mini-badge.dealer { background: rgba(124,92,196,0.25); color: #cdb3e8; border: 1px solid rgba(124,92,196,0.5); }
.mini-badge.taker { background: rgba(232,196,106,0.2); color: #e8c46a; border: 1px solid rgba(232,196,106,0.5); }
.mini-badge.partner { background: rgba(125,214,160,0.18); color: #7dd6a0; border: 1px solid rgba(125,214,160,0.5); }
.seat-sub { font-size: 0.72rem; color: #a690c9; }
.seat-score { color: #cdb3e8; font-weight: 700; }
.bid-bubble { background: rgba(124,92,196,0.25); border: 1px solid rgba(124,92,196,0.6); color: #e6dcff; font-size: 0.72rem; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
.bid-bubble.pass { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); color: #8a76ad; }
.poignee-badge { background: rgba(232,196,106,0.16); border: 1px solid rgba(232,196,106,0.5); color: #e8c46a; font-size: 0.66rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.poignee-badge.inline { margin: 0; }
.hidden-hand { display: flex; margin-top: 4px; }
.seat.top .hidden-hand { margin-top: 0; margin-bottom: 4px; }
.mini-card { width: 48px; height: 72px; }
.hidden-hand .mini-card + .mini-card { margin-left: -38px; }
.seat.left .hidden-hand, .seat.right .hidden-hand { flex-direction: column; align-items: center; }
.seat.left .mini-card, .seat.right .mini-card { width: 72px; height: 48px; }
.seat.left .hidden-hand .mini-card + .mini-card, .seat.right .hidden-hand .mini-card + .mini-card { margin-left: 0; margin-top: -36px; }

/* chien */
.chien-zone { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 6px; background: rgba(21,14,38,0.72); padding: 10px 16px; border-radius: 14px; border: 1px solid rgba(196,160,80,0.4); }
.chien-tag { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; color: #e8c46a; }
.chien-cards { display: flex; gap: 5px; }
.chien-card { width: 62px; height: 96px; }

/* pli */
.trick-zone { position: absolute; top: max(120px, 24%); bottom: 8%; left: 50%; width: min(52%, 440px); transform: translateX(-50%); }
.trick-card { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.trick-card.top { top: 0; left: 50%; transform: translateX(-50%); }
.trick-card.bottom { bottom: 0; left: 50%; transform: translateX(-50%); }
.trick-card.left { left: 0; top: 50%; transform: translateY(-50%); }
.trick-card.right { right: 0; top: 50%; transform: translateY(-50%); }
.trick-card.topleft { top: 2%; left: 8%; }
.trick-card.topright { top: 2%; right: 8%; }
.tc { width: 92px; height: 142px; border-radius: 7px; transition: box-shadow 0.2s ease; }
.trick-card.winning .tc { box-shadow: 0 0 0 3px #e8c46a, 0 0 20px rgba(232,196,106,0.55); }
.trick-name { font-size: 0.68rem; color: #cdb3e8; font-weight: 700; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* revoir pli */
.review-btn { position: absolute; left: 10px; top: 10px; z-index: 7; background: rgba(21,14,38,0.85); color: #e6dcff; border: 1px solid rgba(124,92,196,0.5); border-radius: 999px; padding: 7px 14px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 0.82rem; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.45); transition: 0.15s; }
.review-btn:hover { border-color: #e8c46a; }
.last-trick-view { position: absolute; inset: 0; z-index: 6; overflow: hidden; container-type: size; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 14px 10px; background: rgba(15,9,28,0.82); backdrop-filter: blur(2px); animation: tfPop 0.22s ease; }
.ltv-tag, .ltv-caption { flex-shrink: 0; text-align: center; }
.ltv-tag { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; color: #a690c9; }
.ltv-caption { font-size: 0.95rem; font-weight: 800; color: #e6dcff; }
.ltv-row { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 10px; justify-content: center; align-items: flex-end; flex-shrink: 1; min-height: 0; overflow: auto; }
.ltv-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.ltv-card-wrap { position: relative; }
.ltv-row .tc { width: auto; aspect-ratio: 92 / 142; height: clamp(70px, 14cqh, 150px); }
.ltv-row .tc.ltv-win { box-shadow: 0 0 0 3px #e8c46a, 0 0 18px rgba(232,196,106,0.55); }
.ltv-order { position: absolute; top: -9px; left: -9px; z-index: 3; min-width: 22px; height: 22px; padding: 0 5px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 0.76rem; font-weight: 900; color: #150e26; background: #cdb3e8; border: 2px solid #150e26; box-shadow: 0 2px 6px rgba(0,0,0,0.55); }
.ltv-order.first { background: #e8c46a; }
.ltv-name { font-size: 0.72rem; font-weight: 700; color: #cdb3e8; white-space: nowrap; max-width: 92px; overflow: hidden; text-overflow: ellipsis; }
.review-lock-banner { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 7; background: rgba(21,14,38,0.9); border: 1px solid rgba(232,196,106,0.5); color: #e8c46a; border-radius: 999px; padding: 6px 16px; font-size: 0.82rem; font-weight: 700; white-space: nowrap; max-width: 92%; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 4px 16px rgba(0,0,0,0.45); }

/* bandeau action */
.felt-panel { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); max-width: 94%; display: flex; flex-direction: column; align-items: center; gap: 8px; background: rgba(21,14,38,0.82); border: 1px solid rgba(124,92,196,0.4); padding: 9px 20px; border-radius: 16px; box-shadow: 0 6px 22px rgba(0,0,0,0.55); }
.felt-panel.you { border-color: rgba(232,196,106,0.6); box-shadow: 0 0 26px rgba(232,196,106,0.35); }
.fp-text { font-weight: 800; font-size: 1rem; color: #e6dcff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.felt-panel.you .fp-text { color: #e8c46a; animation: youPulse 1.6s ease-in-out infinite; }
.fp-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
@media (prefers-reduced-motion: reduce) { .felt-panel.you .fp-text { animation: none; } }
@keyframes youPulse { 0%,100%{opacity:1} 50%{opacity:0.55} }

/* ma zone */
.my-zone { padding: 8px 14px 14px; background: #1c1233; border-top: 1px solid rgba(196,160,80,0.18); }
.my-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.9rem; margin-bottom: 8px; }
.my-score, .my-tricks { color: #a690c9; font-size: 0.82rem; }

.ecart-bar, .poignee-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 8px; padding: 8px 12px; border-radius: 10px; background: #150e26; border: 1px solid rgba(196,160,80,0.2); font-size: 0.85rem; color: #cdb3e8; }
.ecart-bar.waiting { color: #7a63a3; font-style: italic; }
.ecart-info strong { color: #e8c46a; }
.slam-toggle { display: flex; align-items: center; gap: 6px; color: #a690c9; cursor: pointer; }
.slam-toggle input { accent-color: #e8c46a; }

.btn-act { background: #2c2044; color: #e6dcff; border: 1px solid #453466; border-radius: 8px; padding: 8px 16px; font-family: 'Outfit', sans-serif; font-weight: 700; cursor: pointer; transition: 0.15s; font-size: 0.95rem; }
.btn-act:hover:not(:disabled) { border-color: #7c5cc4; background: #35275a; }
.btn-act:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-act.take { background: #5b3fa0; border-color: #7c5cc4; }
.btn-act.take:hover:not(:disabled) { background: #6b4bb5; }
.btn-act.pass { color: #a690c9; }
.btn-act.call .call-suit { font-size: 1.15em; }
.btn-act.call.red .call-suit { color: #ff8a8a; }
.btn-act.call.black .call-suit { color: #efe8f7; }
.btn-act.small { padding: 6px 12px; font-size: 0.85rem; }

.my-hand { display: flex; align-items: flex-end; padding: 28px 6px 10px; overflow-x: auto; overflow-y: hidden; }
.hand-card { flex-shrink: 0; border-radius: 7px; transition: transform 0.12s ease, box-shadow 0.12s ease; cursor: default; }
.hand-card .hc { width: 96px; height: 148px; }
.hand-card.playable { cursor: pointer; box-shadow: 0 0 0 2px rgba(124,92,196,0.7); }
.hand-card.playable:hover { transform: translateY(-16px); box-shadow: 0 0 0 2px #7c5cc4, 0 12px 24px rgba(0,0,0,0.5); }
.hand-card.selected { transform: translateY(-22px); box-shadow: 0 0 0 3px #e8c46a, 0 12px 24px rgba(0,0,0,0.5); cursor: pointer; }
.hand-card.forbidden { opacity: 0.5; }
.hand-card.forbidden:not(.selected) { cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .hand-card, .hand-card.playable:hover { transform: none !important; } }

.my-hand.dealing .hand-card { animation: cardDeal 0.4s cubic-bezier(0.2,0.75,0.3,1) backwards; animation-delay: calc(var(--di, 0) * 45ms); }
.hidden-hand.dealing .mini-card { animation: miniDeal 0.32s ease backwards; animation-delay: calc(var(--di, 0) * 35ms + 100ms); }
@keyframes cardDeal { from { opacity: 0; transform: translate(-24px, -120px) rotate(-14deg) scale(0.72); } to { opacity: 1; transform: none; } }
@keyframes miniDeal { from { opacity: 0; transform: scale(0.35); } to { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .my-hand.dealing .hand-card, .hidden-hand.dealing .mini-card { animation: none !important; } }

/* journal */
.log-panel { background: #120b21; border-top: 1px solid rgba(196,160,80,0.12); height: 92px; flex-shrink: 0; overflow: hidden; }
.log-list { list-style: none; margin: 0; padding: 6px 16px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.log-list li { font-size: 0.82rem; color: #9d84c4; }
.log-list li.latest { color: #e8c46a; font-weight: 700; }

/* recap */
.recap-overlay { position: fixed; inset: 0; background: rgba(15,9,28,0.85); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.recap-modal { background: #221739; border: 1px solid rgba(196,160,80,0.3); border-radius: 18px; padding: 24px 26px; max-width: 480px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.7); max-height: 92vh; overflow-y: auto; }
.recap-head { text-align: center; }
.recap-hand { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1.5px; color: #7a63a3; font-weight: 700; }
.recap-modal h2 { margin: 4px 0 10px 0; font-size: 1.9rem; text-align: center; }
.recap-modal h2.ok { color: #7dd6a0; } .recap-modal h2.ko { color: #ff6b6b; }
.recap-line { text-align: center; color: #a690c9; margin: 0 0 4px 0; font-size: 0.95rem; }
.recap-line strong { color: #efe8f7; }
.recap-line.small { font-size: 0.85rem; color: #7dd6a0; margin-top: 2px; }
.recap-line .mult { color: #e8c46a; font-weight: 800; margin-left: 4px; }
.recap-table { width: 100%; border-collapse: collapse; margin: 14px 0; }
.recap-table td { padding: 7px 12px; font-size: 0.92rem; border-bottom: 1px solid rgba(196,160,80,0.1); }
.recap-table td:first-child { color: #a690c9; }
.recap-table td:last-child { text-align: right; color: #efe8f7; font-variant-numeric: tabular-nums; }
.recap-table .muted { color: #7a63a3; font-size: 0.82em; }
.recap-table .pos { color: #7dd6a0; } .recap-table .neg { color: #ff8a8a; }
.recap-table .recap-delta td { font-weight: 900; color: #e8c46a; border-top: 1px solid rgba(196,160,80,0.3); border-bottom: none; font-size: 1rem; }
.recap-table .recap-delta td:first-child { color: #e8c46a; }
.recap-players { display: flex; flex-direction: column; gap: 5px; margin-bottom: 18px; }
.rp-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; background: #150e26; }
.rp-row.taker { border: 1px solid rgba(232,196,106,0.4); }
.rp-row.me .rp-name { color: #e8c46a; }
.rp-name { flex: 1; font-weight: 700; }
.rp-delta { font-weight: 900; font-variant-numeric: tabular-nums; min-width: 4em; text-align: right; }
.rp-delta.pos { color: #7dd6a0; } .rp-delta.neg { color: #ff8a8a; }
.rp-total { min-width: 4em; text-align: right; color: #cdb3e8; font-weight: 700; font-variant-numeric: tabular-nums; }
.recap-actions { display: flex; flex-direction: column; align-items: center; gap: 8px; }

/* fin */
.end-screen { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }
.end-box { background: #221739; border: 1px solid rgba(196,160,80,0.25); border-radius: 20px; padding: 36px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.7); }
.end-box h2 { color: #e8c46a; font-size: 2rem; margin: 0 0 8px 0; }
.end-reason { color: #a690c9; margin-bottom: 24px; }
.end-ranking { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
.end-rank { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #150e26; }
.end-rank.win { background: rgba(232,196,106,0.16); border: 1px solid rgba(232,196,106,0.45); }
.end-rank.me .er-name { color: #e8c46a; }
.er-pos { font-weight: 900; color: #7a63a3; width: 1.5em; }
.er-name { flex: 1; text-align: left; font-weight: 700; }
.er-score { font-weight: 900; font-size: 1.2rem; color: #cdb3e8; }

@media (max-width: 640px) {
  .felt { min-height: 400px; margin: 8px; }
  .seat .hidden-hand { display: none; }
  .seat.left { left: 4px; top: 20%; transform: none; max-width: 44%; }
  .seat.right { right: 4px; top: 20%; transform: none; max-width: 44%; align-items: flex-end; }
  .seat-nom { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .trick-zone { top: max(110px, 30%); bottom: 8%; width: min(92%, 320px); }
  .tc { width: 62px; height: 96px; }
  .chien-card { width: 44px; height: 68px; }
  .hand-card .hc { width: 66px; height: 102px; }
  .ltv-cross .tc { height: clamp(48px, calc((100cqh - 150px) / 3), 116px); }
}

.score-sheet { display: none; }
@media (min-width: 980px) {
  .table-screen { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto minmax(0, 1fr) auto auto; }
  .topbar { grid-column: 1 / -1; grid-row: 1; }
  .felt { grid-column: 1; grid-row: 2; margin: 14px 10px 8px 14px; }
  .my-zone { grid-column: 1; grid-row: 3; }
  .log-panel { grid-column: 1 / -1; grid-row: 4; }
  .score-sheet { grid-column: 2; grid-row: 2 / 4; display: flex; flex-direction: column; width: clamp(260px, 22vw, 340px); background: #1c1233; border-left: 1px solid rgba(196,160,80,0.18); overflow: hidden; }
  .ss-head { flex-shrink: 0; padding: 12px 14px 9px; font-weight: 800; font-size: 0.82rem; color: #cdb3e8; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid rgba(196,160,80,0.18); }
  .ss-scroll { flex: 1; overflow: auto; }
  .ss-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .ss-table th, .ss-table td { padding: 6px 8px; text-align: right; white-space: nowrap; }
  .ss-table th:first-child, .ss-table td:first-child { text-align: left; }
  .ss-table thead th { position: sticky; top: 0; z-index: 1; background: #1c1233; color: #a690c9; font-weight: 700; font-size: 0.72rem; text-transform: uppercase; border-bottom: 1px solid rgba(196,160,80,0.25); }
  .ss-table thead th.mine { color: #e8c46a; }
  .ss-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.025); }
  .ss-table tbody td { color: #cdb3e8; border-bottom: 1px solid rgba(196,160,80,0.06); font-variant-numeric: tabular-nums; }
  .ss-hand { color: #9d84c4; font-weight: 700; }
  .ss-taker { margin-left: 4px; font-size: 0.85em; color: #e8c46a; }
  .ss-table tbody td.neg { color: #ff8a8a; }
  .ss-table tbody td.taker { font-weight: 800; color: #efe8f7; }
  .ss-empty { text-align: center; color: #7a63a3; padding: 16px; }
  .ss-table tfoot td { position: sticky; bottom: 0; background: #221739; color: #efe8f7; font-weight: 900; font-size: 0.9rem; border-top: 1px solid rgba(196,160,80,0.35); }
}
</style>
