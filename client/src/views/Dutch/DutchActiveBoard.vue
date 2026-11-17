<template>
  <div class="table">
    <!-- ── Bandeau d'état ─────────────────────────────────────── -->
    <header class="status-bar">
      <div class="headline">{{ headline }}</div>
      <div v-if="state.dutchPlayerName && state.status === 'playing'" class="dutch-banner">
        📣 {{ state.dutchPlayerName }} a annoncé DUTCH — dernier tour !
      </div>
      <div v-if="state.phase === 'snap'" class="snap-bar">
        <div class="snap-fill" :style="{ width: snapPct + '%' }"></div>
        <span class="snap-text">⚡ Snap ouvert · {{ snapSeconds }}s</span>
      </div>
    </header>

    <!-- ── Adversaires ────────────────────────────────────────── -->
    <section class="opponents">
      <div
        v-for="p in opponents"
        :key="p.id"
        class="seat"
        :class="{ current: p.isCurrent, dutch: p.isDutch }"
      >
        <div class="seat-name">
          <span>{{ p.name }}</span>
          <span v-if="p.isDutch" title="A annoncé Dutch">📣</span>
          <span v-if="state.phase === 'peek'">{{ p.ready ? '✅' : '👀' }}</span>
          <span v-if="p.wins" class="wins">🏆{{ p.wins }}</span>
        </div>
        <div class="hand">
          <template v-for="(s, i) in p.slots" :key="i">
            <DutchCard
              v-if="s"
              :card="s.card"
              size="sm"
              :selectable="canTargetAny"
              :selected="isSelected(p.id, s.slot)"
              :highlight="isPeekTarget(p.id, s.slot)"
              @select="onTarget(p.id, s.slot)"
            />
            <div v-else class="slot-empty sm"></div>
          </template>
        </div>
        <div class="seat-score" v-if="state.status === 'finished'">{{ scoreOf(p) }} pts</div>
      </div>
    </section>

    <!-- ── Centre de la table ─────────────────────────────────── -->
    <section class="center">
      <div class="pile">
        <DutchCard :card="null" size="lg" :selectable="canDraw" :highlight="canDraw" @select="emit('action', 'draw')" />
        <span class="pile-label">Pioche ({{ state.deckCount }})</span>
      </div>
      <div class="pile">
        <DutchCard v-if="state.topDiscard" :card="state.topDiscard" size="lg" />
        <div v-else class="slot-empty lg"></div>
        <span class="pile-label">Défausse</span>
      </div>
      <div v-if="state.hasDrawn" class="pile drawn">
        <DutchCard :card="state.drawnCard" size="lg" :highlight="state.isMyTurn" />
        <span class="pile-label">{{ state.isMyTurn ? 'Ta carte piochée' : `Carte de ${state.currentPlayerName}` }}</span>
      </div>
    </section>

    <!-- ── Instructions & actions ─────────────────────────────── -->
    <section class="actions">
      <p class="hint">{{ hint }}</p>
      <div class="buttons">
        <BaseButton v-if="state.phase === 'peek' && !state.myReady" variant="primary"
          :disabled="state.myPeekedCount < 2" @click="emit('action', 'ready')">
          J'ai mémorisé ✅
        </BaseButton>

        <BaseButton v-if="state.phase === 'decide' && state.isMyTurn" variant="secondary" @click="emit('action', 'discard_drawn')">
          {{ discardLabel }}
        </BaseButton>

        <template v-if="state.phase === 'power' && state.isMyTurn">
          <BaseButton v-if="state.powerType === 'queen_seen'" variant="primary" @click="emit('action', 'ack_peek')">
            OK, c'est noté 👍
          </BaseButton>
          <BaseButton v-else variant="secondary" @click="emit('action', 'skip_power')">Passer le pouvoir</BaseButton>
        </template>

        <BaseButton v-if="canDeclareDutch" variant="primary" @click="emit('action', 'dutch')">
          Annoncer DUTCH 📣
        </BaseButton>
      </div>
    </section>

    <!-- ── Ma main ────────────────────────────────────────────── -->
    <section v-if="me" class="my-zone" :class="{ current: me.isCurrent, snapping: state.phase === 'snap' }">
      <div class="seat-name">
        <span>{{ me.name }} (moi)</span>
        <span v-if="me.isDutch">📣</span>
        <span v-if="me.wins" class="wins">🏆{{ me.wins }}</span>
        <span v-if="state.status === 'finished'" class="my-score">· {{ scoreOf(me) }} pts</span>
      </div>
      <div class="hand my-hand">
        <template v-for="(s, i) in me.slots" :key="i">
          <DutchCard
            v-if="s"
            :card="s.card"
            size="lg"
            :label="`n°${i + 1}`"
            :selectable="myCardClickable(s)"
            :selected="isSelected(me.id, s.slot)"
            :highlight="isPeekTarget(me.id, s.slot)"
            @select="onMyCard(s)"
          />
          <div v-else class="slot-empty lg"></div>
        </template>
      </div>
    </section>

    <!-- ── Journal ────────────────────────────────────────────── -->
    <aside class="log">
      <h4>Journal</h4>
      <ul>
        <li v-for="m in recentMessages" :key="m.timestamp + m.text">{{ m.text }}</li>
      </ul>
    </aside>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import DutchCard from './DutchCard.vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps({
  state: { type: Object, required: true },
  messages: { type: Array, default: () => [] },
})
const emit = defineEmits(['action'])

const me = computed(() => props.state.players.find(p => p.id === props.state.myId))
const opponents = computed(() => props.state.players.filter(p => p.id !== props.state.myId))
const recentMessages = computed(() => props.messages.slice(-40).reverse())

// ── Compte à rebours du snap ─────────────────────────────────────
const now = ref(Date.now())
const snapDeadline = ref(0)
let ticker = null
onMounted(() => { ticker = setInterval(() => { now.value = Date.now() }, 100) })
onUnmounted(() => clearInterval(ticker))

watch(() => [props.state.phase, props.state.snapRemainingMs], () => {
  if (props.state.phase === 'snap') snapDeadline.value = Date.now() + props.state.snapRemainingMs
}, { immediate: true })

const snapLeftMs = computed(() => Math.max(0, snapDeadline.value - now.value))
const snapSeconds = computed(() => Math.ceil(snapLeftMs.value / 1000))
const snapPct = computed(() => (snapLeftMs.value / (props.state.snapWindowMs || 5000)) * 100)

// ── Sélection des cibles (Valet / Dame) ──────────────────────────
const jackSelection = ref([])
watch(() => [props.state.phase, props.state.powerType], () => { jackSelection.value = [] })

const choosingTarget = computed(() =>
  props.state.phase === 'power' && props.state.isMyTurn
  && (props.state.powerType === 'jack' || props.state.powerType === 'queen'))
const canTargetAny = computed(() => choosingTarget.value)

const isSelected = (playerId, slot) => jackSelection.value.some(t => t.playerId === playerId && t.slot === slot)
const isPeekTarget = (playerId, slot) => {
  const t = props.state.peekTarget
  return !!t && t.playerId === playerId && t.slot === slot
}

const onTarget = (playerId, slot) => {
  if (!choosingTarget.value) return
  if (props.state.powerType === 'queen') {
    emit('action', 'queen_peek', { target: { playerId, slot } })
    return
  }
  // Valet : on sélectionne 2 cartes, puis on envoie l'échange.
  if (isSelected(playerId, slot)) {
    jackSelection.value = jackSelection.value.filter(t => !(t.playerId === playerId && t.slot === slot))
    return
  }
  jackSelection.value = [...jackSelection.value, { playerId, slot }]
  if (jackSelection.value.length === 2) {
    const [a, b] = jackSelection.value
    emit('action', 'jack_swap', { a, b })
  }
}

// ── Mes cartes ───────────────────────────────────────────────────
const canDraw = computed(() => props.state.phase === 'draw' && props.state.isMyTurn)
const canDeclareDutch = computed(() =>
  props.state.phase === 'snap' && props.state.isMyTurn && !props.state.dutchPlayerName)

const myCardClickable = (s) => {
  const { phase, isMyTurn, myReady, myPeekedCount } = props.state
  if (phase === 'peek') return !myReady && myPeekedCount < 2 && !s.card
  if (phase === 'decide') return isMyTurn
  if (phase === 'snap') return true
  return choosingTarget.value
}

const onMyCard = (s) => {
  const { phase } = props.state
  if (phase === 'peek') return emit('action', 'peek_initial', { slot: s.slot })
  if (phase === 'decide') return emit('action', 'swap', { slot: s.slot })
  if (phase === 'snap') return emit('action', 'snap', { slot: s.slot })
  if (choosingTarget.value) return onTarget(me.value.id, s.slot)
}

// ── Textes ───────────────────────────────────────────────────────
const powerName = computed(() => {
  const t = props.state.powerType
  if (t === 'jack') return 'du Valet'
  if (t === 'queen' || t === 'queen_seen') return 'de la Dame'
  return ''
})

const discardLabel = computed(() => {
  const rank = props.state.drawnCard && props.state.drawnCard.rank
  if (rank === 'J') return 'Défausser (pouvoir du Valet 🔄)'
  if (rank === 'Q') return 'Défausser (pouvoir de la Dame 👁️)'
  return 'Défausser la carte piochée'
})

const headline = computed(() => {
  const s = props.state
  if (s.status === 'finished') return '🏁 Manche terminée — toutes les cartes sont révélées'
  if (s.phase === 'peek') return '👀 Découverte des cartes'
  return s.isMyTurn ? '🎯 C\'est ton tour !' : `Tour de ${s.currentPlayerName}`
})

const hint = computed(() => {
  const s = props.state
  if (s.status === 'finished') return 'Les scores sont affichés sous chaque joueur.'
  switch (s.phase) {
    case 'peek':
      if (s.myReady) return 'En attente des autres joueurs…'
      return s.myPeekedCount < 2
        ? `Clique sur ${2 - s.myPeekedCount} de tes cartes pour les regarder.`
        : 'Mémorise bien tes 2 cartes, elles seront recachées ensuite !'
    case 'draw':
      return s.isMyTurn ? 'Clique sur la pioche pour tirer une carte.' : `${s.currentPlayerName} pioche…`
    case 'decide':
      return s.isMyTurn
        ? 'Clique sur une de tes cartes pour l\'échanger, ou défausse directement la carte piochée.'
        : `${s.currentPlayerName} réfléchit à sa carte…`
    case 'power':
      if (!s.isMyTurn) return `${s.currentPlayerName} utilise le pouvoir ${powerName.value}…`
      if (s.powerType === 'jack') return `Valet : sélectionne 2 cartes à échanger (${jackSelection.value.length}/2), chez n'importe qui.`
      if (s.powerType === 'queen') return 'Dame : clique sur n\'importe quelle carte pour la regarder.'
      return 'Voici la carte (en surbrillance verte). Mémorise-la !'
    case 'snap':
      return `Snap ! Clique une de tes cartes de même valeur que la défausse (${s.topDiscard ? s.topDiscard.rank : '?'}). Erreur = pénalité.`
    default:
      return ''
  }
})

const scoreOf = (p) => {
  const r = props.state.results && props.state.results.players.find(x => x.id === p.id)
  return r ? r.score : '–'
}
</script>

<style scoped>
.table {
  flex: 1; display: grid; gap: 14px; padding: 16px; box-sizing: border-box; width: 100%; max-width: 1200px; margin: 0 auto;
  grid-template-columns: 1fr 260px;
  grid-template-areas:
    'status status'
    'opponents log'
    'center log'
    'actions log'
    'me log';
}
.status-bar { grid-area: status; display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; }
.headline { font-family: 'Playfair Display', serif; font-size: 1.5rem; color: #f1c40f; }
.dutch-banner {
  background: rgba(231, 76, 60, 0.18); border: 1px solid #e74c3c; color: #ffb3a7; border-radius: 8px;
  padding: 6px 14px; font-size: 0.85rem; animation: pulse 1.4s infinite;
}
.snap-bar {
  position: relative; width: 100%; max-width: 420px; height: 24px; border-radius: 12px; overflow: hidden;
  background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(241, 196, 15, 0.4);
}
.snap-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #f39c12, #f1c40f); transition: width 0.1s linear; }
.snap-text { position: relative; font-size: 0.78rem; line-height: 24px; color: #0b2e21; font-weight: bold; }

.opponents { grid-area: opponents; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
.seat, .my-zone {
  background: rgba(6, 30, 21, 0.55); border: 1px solid rgba(241, 227, 192, 0.15); border-radius: 12px;
  padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; align-items: center;
}
.seat.current, .my-zone.current { border-color: #f1c40f; box-shadow: 0 0 12px rgba(241, 196, 15, 0.25); }
.seat.dutch { border-color: #e74c3c; }
.seat-name { font-size: 0.8rem; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: center; }
.wins { color: #f1c40f; font-size: 0.75rem; }
.seat-score, .my-score { color: #f1c40f; font-weight: bold; font-size: 0.85rem; }
.hand { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.my-hand { gap: 12px; padding-bottom: 18px; }

.slot-empty { border: 1px dashed rgba(241, 227, 192, 0.25); border-radius: 8px; box-sizing: border-box; flex-shrink: 0; }
.slot-empty.sm { width: 44px; height: 64px; }
.slot-empty.lg { width: 78px; height: 112px; }

.center { grid-area: center; display: flex; gap: 28px; justify-content: center; align-items: flex-end; padding: 8px 0; }
.pile { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.pile-label { font-size: 0.72rem; color: #a8d5ba; }
.pile.drawn { padding-left: 24px; border-left: 1px dashed rgba(241, 227, 192, 0.25); }

.actions { grid-area: actions; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.hint { margin: 0; font-size: 0.85rem; color: #d6e8dc; max-width: 560px; }
.buttons { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.my-zone { grid-area: me; }
.my-zone.snapping { border-style: dashed; border-color: #f39c12; }

.log {
  grid-area: log; background: rgba(3, 20, 14, 0.55); border: 1px solid rgba(241, 227, 192, 0.12); border-radius: 12px;
  padding: 12px; max-height: calc(100vh - 140px); overflow-y: auto; position: sticky; top: 16px; align-self: start;
}
.log h4 { margin: 0 0 8px; font-size: 0.75rem; text-transform: uppercase; color: #a8d5ba; font-weight: normal; letter-spacing: 1px; }
.log ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.log li { font-size: 0.74rem; line-height: 1.4; color: #d6e8dc; border-bottom: 1px dashed rgba(241, 227, 192, 0.08); padding-bottom: 5px; }

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.65; } }

@media (max-width: 860px) {
  .table {
    grid-template-columns: 1fr;
    grid-template-areas: 'status' 'opponents' 'center' 'actions' 'me' 'log';
    padding: 12px 16px;
  }
  .log { position: static; max-height: 220px; }
}
@media (max-width: 480px) {
  .center { gap: 14px; }
  .pile.drawn { padding-left: 12px; }
  .my-hand { gap: 8px; }
  .headline { font-size: 1.2rem; }
}
</style>
