<template>
  <div class="tr-board" :class="myRole">
    <!-- HEADER -->
    <div class="tr-header">
      <div class="tr-stats">
        <div class="stat">
          <label>Objectif du Coffre</label>
          <div class="value gold">{{ target }}</div>
        </div>
        <div class="stat">
          <label>Coffre 📦</label>
          <div class="value">{{ chestCount }}</div>
        </div>
        <div class="stat">
          <label>Pioche 🂠</label>
          <div class="value">{{ deckCount }}</div>
        </div>
        <div class="stat">
          <label>Défausse 🗑️</label>
          <div class="value">{{ discardCount }}</div>
        </div>
      </div>
      <div class="tr-identity">
        <div class="role-badge" :class="myRole">
          {{ myRole === 'pirate' ? '🏴‍☠️ PIRATE' : '🗡️ MUTIN' }}
        </div>
        <div class="room-code">Salon : <strong>{{ roomCode }}</strong></div>
      </div>
    </div>

    <!-- PLAYERS -->
    <div class="tr-players">
      <div
        v-for="p in players"
        :key="p.id"
        class="player-chip"
        :class="{
          current: p.isCurrent,
          eliminated: p.eliminated,
          me: p.id === myId,
          targetable: isTargeting && !p.eliminated && p.id !== myId,
        }"
        @click="onPlayerClick(p)"
      >
        <div class="player-top">
          <span class="player-name">{{ p.id === myId ? '🫵' : '🏴‍☠️' }} {{ p.name }}</span>
          <span v-if="p.isCurrent && !p.eliminated" class="turn-dot">🎯</span>
        </div>
        <div class="planches">
          <span
            v-for="n in 3"
            :key="n"
            class="plank-pip"
            :class="{ filled: n <= p.planches }"
          >🪵</span>
        </div>
        <div v-if="p.eliminated" class="elim-role" :class="p.role">
          🌊 {{ p.role === 'pirate' ? 'Pirate' : 'Mutin' }}
        </div>
        <div v-else class="hand-count">{{ p.handCount }} carte{{ p.handCount > 1 ? 's' : '' }}</div>
      </div>
    </div>

    <!-- CENTER : turn status + coffre -->
    <div class="tr-center">
      <div class="coffre">
        <div class="coffre-lid">📦</div>
        <div class="coffre-stack">
          <div
            v-for="n in Math.min(chestCount, 12)"
            :key="n"
            class="coffre-card"
            :style="{ bottom: (n - 1) * 6 + 'px' }"
          ></div>
        </div>
        <div class="coffre-label">{{ chestCount }} carte{{ chestCount > 1 ? 's' : '' }} dans le Coffre</div>
      </div>

      <div class="turn-banner" :class="{ mine: isMyTurn && !amIEliminated }">
        <template v-if="amIEliminated">🌊 Vous avez été poussé(e) à l'eau — conseillez votre équipe !</template>
        <template v-else-if="isMyTurn">⚓ À vous de jouer !</template>
        <template v-else>En attente de <strong>{{ currentPlayerName }}</strong>...</template>
      </div>
    </div>

    <!-- PENDING : Longue-vue -->
    <div v-if="pendingAction && pendingAction.type === 'longuevue'" class="action-panel pending">
      <h3>🔭 Longue-vue — réorganisez le dessus du Coffre</h3>
      <p class="hint">Cliquez les cartes dans l'ordre où elles seront remises, <strong>du dessus vers le dessous</strong> du Coffre.</p>
      <div class="card-row">
        <div v-for="c in pendingAction.cards" :key="c.id" class="pending-card-wrap">
          <span v-if="lvOrder.includes(c.id)" class="order-badge">{{ lvOrder.indexOf(c.id) + 1 }}</span>
          <TraitreCard :card="c" :selectable="true" :selected="lvOrder.includes(c.id)" @select="toggleLvCard(c)" />
        </div>
      </div>
      <div class="panel-actions">
        <button class="btn-ghost" @click="lvOrder = []">Réinitialiser</button>
        <button class="btn-primary" @click="validateLongueVue">Valider l'ordre</button>
      </div>
    </div>

    <!-- PENDING : Pêche miraculeuse -->
    <div v-else-if="pendingAction && pendingAction.type === 'pechemiraculeuse'" class="action-panel pending">
      <h3>🎣 Pêche miraculeuse — reposez {{ pecheReturnCount }} carte(s)</h3>
      <p class="hint">Choisissez les cartes à remettre sur la Pioche (la 1ère cliquée sera sur le dessus). Vous en gardez 3.</p>
      <div class="card-row">
        <div v-for="c in myHand" :key="c.id" class="pending-card-wrap">
          <span v-if="pecheReturn.includes(c.id)" class="order-badge">{{ pecheReturn.indexOf(c.id) + 1 }}</span>
          <TraitreCard :card="c" :selectable="true" :selected="pecheReturn.includes(c.id)" @select="togglePecheCard(c)" />
        </div>
      </div>
      <div class="panel-actions">
        <button class="btn-ghost" @click="pecheReturn = []">Réinitialiser</button>
        <button class="btn-primary" :disabled="pecheReturn.length !== pecheReturnCount" @click="validatePeche">Valider</button>
      </div>
    </div>

    <!-- MY TURN action bar -->
    <div v-else-if="isMyTurn && !amIEliminated" class="action-panel">
      <div v-if="isTargeting" class="targeting-banner">
        🎯 {{ targetingLabel }} — cliquez un joueur ci-dessus.
        <button class="btn-ghost" @click="cancelSelection">Annuler</button>
      </div>

      <template v-else>
        <div class="turn-help">Choisissez une carte de votre main, ou déclarez le Coffre.</div>

        <!-- butin selected: click the value to announce = place it -->
        <div v-if="selectedCard && selectedCard.kind === 'butin'" class="butin-actions">
          <span class="announce-label">Cliquez la valeur à annoncer (elle sera aussitôt placée) :</span>
          <button
            v-for="opt in [1, 0, -2]"
            :key="opt"
            class="announce-btn"
            @click="announceAndPlace(opt)"
          >📦 {{ opt > 0 ? '+' + opt : opt }}</button>
          <button class="btn-ghost" @click="cancelSelection">Annuler</button>
        </div>

        <!-- Longue-vue / Bon débarras / Pêche miraculeuse : bouton Jouer conservé -->
        <div
          v-else-if="selectedCard && selectedCard.kind === 'action' && selectedCard.action !== 'planche' && selectedCard.action !== 'videpoches'"
          class="action-card-actions"
        >
          <span class="announce-label">{{ actionLabel(selectedCard.action) }}</span>
          <button class="btn-primary" @click="playSelectedAction">Jouer</button>
          <button class="btn-ghost" @click="cancelSelection">Annuler</button>
        </div>

        <div v-if="myRole === 'pirate'" class="declare-wrap">
          <button class="btn-declare" @click="declareChest">🔎 Révéler le coffre</button>
        </div>
      </template>
    </div>

    <div v-else-if="!amIEliminated" class="action-panel muted">
      Patientez, ce n'est pas votre tour.
    </div>

    <!-- MY HAND -->
    <div v-if="!amIEliminated" class="my-hand-area">
      <div class="my-hand-title">Votre main</div>
      <div class="my-hand">
        <TraitreCard
          v-for="c in myHand"
          :key="c.id"
          :card="c"
          :selectable="isMyTurn && !pendingAction"
          :selected="c.id === selectedCardId && !pendingAction"
          @select="selectHandCard(c)"
        />
        <div v-if="myHand.length === 0" class="empty-hand">Aucune carte en main.</div>
      </div>
    </div>

    <!-- LOG / CHAT -->
    <div class="tr-log-wrap">
      <TraitreGameLog :messages="gameMessages" @send="$emit('chatSend', $event)" />
    </div>

    <!-- MODAL : confirmation de révélation du Coffre -->
    <Transition name="tr-modal">
      <div v-if="showDeclareConfirm" class="tr-modal-overlay" @click.self="cancelDeclare">
        <div class="tr-modal">
          <div class="tr-modal-icon">🔎📦</div>
          <h3 class="tr-modal-title">Révéler le Coffre ?</h3>
          <p class="tr-modal-text">
            En révélant le Coffre, vous dévoilez votre identité de
            <strong class="pirate-word">Pirate 🏴‍☠️</strong> et
            <strong>mettez fin à la partie</strong>.
          </p>
          <p class="tr-modal-sub">
            Si le Coffre atteint <strong>{{ target }}</strong>, les Pirates l'emportent.
            Sinon, ce sont les Mutins qui gagnent.
          </p>
          <div class="tr-modal-actions">
            <button class="btn-ghost" @click="cancelDeclare">Annuler</button>
            <button class="btn-declare-confirm" @click="confirmDeclare">🔎 Révéler le Coffre</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TraitreCard from './TraitreCard.vue'
import TraitreGameLog from './TraitreGameLog.vue'

const props = defineProps({
  roomCode: String,
  target: Number,
  deckCount: Number,
  chestCount: Number,
  discardCount: Number,
  currentPlayerName: String,
  isMyTurn: Boolean,
  myId: String,
  myRole: String,
  myHand: { type: Array, default: () => [] },
  myPlanches: Number,
  amIEliminated: Boolean,
  pendingAction: { type: Object, default: null },
  players: { type: Array, default: () => [] },
  gameMessages: { type: Array, default: () => [] },
})

const emit = defineEmits(['action', 'chatSend'])

const selectedCardId = ref(null)
const isTargeting = ref(false)
const targetingAction = ref(null) // { cardId, kind: 'planche'|'videpoches' }

const lvOrder = ref([])
const pecheReturn = ref([])

const selectedCard = computed(() => props.myHand.find(c => c.id === selectedCardId.value) || null)
const pecheReturnCount = computed(() => Math.max(0, props.myHand.length - (props.pendingAction?.keep ?? 3)))

const targetingLabel = computed(() =>
  targetingAction.value?.kind === 'planche' ? 'Poser une Planche' : 'Vider les poches'
)

const ACTION_LABELS = {
  longuevue: '🔭 Longue-vue',
  planche: '🪵 Planche',
  videpoches: '🫳 Vide tes poches',
  bondebarras: '🗑️ Bon débarras',
  pechemiraculeuse: '🎣 Pêche miraculeuse',
}
const actionLabel = (a) => ACTION_LABELS[a] || a

// Reset transient selections whenever the turn/hand changes.
watch(() => [props.isMyTurn, props.myHand], () => {
  if (!props.pendingAction) {
    selectedCardId.value = null
    isTargeting.value = false
    targetingAction.value = null
  }
})
watch(() => props.pendingAction, () => {
  lvOrder.value = []
  pecheReturn.value = []
  selectedCardId.value = null
  isTargeting.value = false
})

const cancelSelection = () => {
  selectedCardId.value = null
  isTargeting.value = false
  targetingAction.value = null
}

const selectHandCard = (card) => {
  if (!props.isMyTurn || props.pendingAction) return
  isTargeting.value = false
  targetingAction.value = null
  selectedCardId.value = card.id
  // Les cartes de ciblage passent directement en mode « choisir un joueur ».
  if (card.kind === 'action' && (card.action === 'planche' || card.action === 'videpoches')) {
    isTargeting.value = true
    targetingAction.value = { cardId: card.id, kind: card.action }
  }
}

// Carte Butin : cliquer une valeur l'annonce ET la pose dans le Coffre (le bluff reste possible).
const announceAndPlace = (opt) => {
  if (!selectedCard.value || selectedCard.value.kind !== 'butin') return
  emit('action', 'place_butin', { cardId: selectedCard.value.id, announcedValue: opt })
  cancelSelection()
}

// Utilisé uniquement pour Bon débarras / Pêche miraculeuse.
const playSelectedAction = () => {
  const card = selectedCard.value
  if (!card || card.kind !== 'action') return
  emit('action', 'play_action', { cardId: card.id })
  cancelSelection()
}

const onPlayerClick = (p) => {
  if (!isTargeting.value || !targetingAction.value) return
  if (p.eliminated || p.id === props.myId) return
  emit('action', 'play_action', { cardId: targetingAction.value.cardId, targetId: p.id })
  cancelSelection()
}

const showDeclareConfirm = ref(false)
const declareChest = () => { showDeclareConfirm.value = true }
const cancelDeclare = () => { showDeclareConfirm.value = false }
const confirmDeclare = () => {
  showDeclareConfirm.value = false
  emit('action', 'declare_chest', {})
  cancelSelection()
}

// Longue-vue ordering
const toggleLvCard = (c) => {
  const i = lvOrder.value.indexOf(c.id)
  if (i === -1) lvOrder.value.push(c.id)
  else lvOrder.value.splice(i, 1)
}
const validateLongueVue = () => {
  emit('action', 'resolve_action', { orderedIds: [...lvOrder.value] })
}

// Pêche miraculeuse selection
const togglePecheCard = (c) => {
  const i = pecheReturn.value.indexOf(c.id)
  if (i === -1) {
    if (pecheReturn.value.length < pecheReturnCount.value) pecheReturn.value.push(c.id)
  } else {
    pecheReturn.value.splice(i, 1)
  }
}
const validatePeche = () => {
  if (pecheReturn.value.length !== pecheReturnCount.value) return
  emit('action', 'resolve_action', { returnIds: [...pecheReturn.value] })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Space+Mono&display=swap');

.tr-board {
  flex: 1; display: flex; flex-direction: column; gap: 16px; padding: 16px;
  font-family: 'Space Mono', monospace; color: #f2e6cf; min-height: 100%;
}

/* Header */
.tr-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;
  border-bottom: 1px solid rgba(224, 176, 74, 0.2); padding-bottom: 14px; }
.tr-stats { display: flex; gap: 22px; flex-wrap: wrap; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.stat label { font-size: 0.6rem; color: #6fb7b0; text-transform: uppercase; letter-spacing: 1px; }
.stat .value { font-size: 1.4rem; }
.stat .value.gold { color: #e0b04a; }
.tr-identity { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.role-badge { padding: 6px 14px; border-radius: 20px; font-family: 'Cinzel', serif; font-size: 0.9rem; letter-spacing: 1px; }
.role-badge.pirate { background: rgba(224, 176, 74, 0.15); border: 1px solid #e0b04a; color: #f5d179; }
.role-badge.mutin { background: rgba(192, 57, 43, 0.15); border: 1px solid #c0392b; color: #e57368; }
.room-code { font-size: 0.75rem; color: #9fb4c2; }
.room-code strong { color: #f2e6cf; letter-spacing: 2px; }

/* Players */
.tr-players { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
.player-chip {
  background: rgba(8, 24, 36, 0.7); border: 1px solid rgba(224, 176, 74, 0.2); border-radius: 14px;
  padding: 18px 24px; min-width: 180px; transition: all 0.2s;
}
.player-chip.current { border-color: #e0b04a; box-shadow: 0 0 14px rgba(224, 176, 74, 0.25); }
.player-chip.me .player-name { color: #e0b04a; }
.player-chip.eliminated { opacity: 0.5; filter: grayscale(0.6); }
.player-chip.targetable { cursor: pointer; border-color: #c0392b; box-shadow: 0 0 12px rgba(192, 57, 43, 0.4); }
.player-chip.targetable:hover { transform: translateY(-4px); background: rgba(192, 57, 43, 0.15); }
.player-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.player-name { font-size: 1.1rem; }
.turn-dot { font-size: 1rem; }
.planches { display: flex; gap: 5px; margin-top: 12px; }
.plank-pip { font-size: 1.15rem; filter: grayscale(1) opacity(0.3); }
.plank-pip.filled { filter: none; }
.hand-count { font-size: 0.8rem; color: #6fb7b0; margin-top: 10px; }
.elim-role { font-size: 0.85rem; margin-top: 10px; }
.elim-role.pirate { color: #f5d179; }
.elim-role.mutin { color: #e57368; }

/* Center */
.tr-center { display: flex; align-items: center; justify-content: center; gap: 30px; flex-wrap: wrap; padding: 8px 0; }
.coffre { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.coffre-lid { font-size: 2.6rem; }
.coffre-stack { position: relative; width: 60px; height: 40px; }
.coffre-card {
  position: absolute; left: 50%; transform: translateX(-50%); width: 48px; height: 12px; border-radius: 3px;
  background: linear-gradient(160deg, #14344a, #0d2233); border: 1px solid rgba(224, 176, 74, 0.4);
}
.coffre-label { font-size: 0.7rem; color: #9fb4c2; }
.turn-banner {
  padding: 12px 22px; border-radius: 10px; background: rgba(8, 24, 36, 0.8);
  border: 1px solid rgba(224, 176, 74, 0.2); font-size: 0.9rem; text-align: center; max-width: 340px;
}
.turn-banner.mine { border-color: #e0b04a; color: #f5d179; animation: pulse 2s infinite; }
.turn-banner strong { color: #e0b04a; }

/* Action panel */
.action-panel {
  border: 1px dashed rgba(224, 176, 74, 0.4); border-radius: 12px; padding: 16px; text-align: center;
  background: rgba(8, 24, 36, 0.5); display: flex; flex-direction: column; gap: 12px; align-items: center;
}
.action-panel.muted { color: #6fb7b0; font-size: 0.85rem; border-style: solid; border-color: rgba(224, 176, 74, 0.15); }
.action-panel.pending { border-color: #6fb7b0; }
.action-panel h3 { margin: 0; font-family: 'Cinzel', serif; font-weight: normal; color: #f5d179; font-size: 1.05rem; }
.hint { font-size: 0.75rem; color: #9fb4c2; margin: 0; max-width: 520px; }
.turn-help { font-size: 0.8rem; color: #9fb4c2; }
.card-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
.pending-card-wrap { position: relative; }
.order-badge {
  position: absolute; top: -8px; left: -8px; z-index: 2; background: #e0b04a; color: #08151f;
  width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: bold;
}
.panel-actions { display: flex; gap: 12px; }

.butin-actions, .action-card-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
.announce-label { font-size: 0.8rem; color: #9fb4c2; }
.announce-btn {
  background: transparent; border: 1px solid #3a4a55; color: #f2e6cf; border-radius: 8px; padding: 6px 12px;
  cursor: pointer; font-family: 'Space Mono', monospace; transition: 0.2s;
}
.announce-btn:hover { border-color: #e0b04a; }
.announce-btn.active { background: rgba(224, 176, 74, 0.15); border-color: #e0b04a; color: #f5d179; }

.targeting-banner { display: flex; align-items: center; gap: 14px; color: #e57368; font-size: 0.9rem; flex-wrap: wrap; justify-content: center; }

.declare-wrap { margin-top: 4px; }
.btn-declare {
  background: transparent; border: 1px solid #e0b04a; color: #e0b04a; border-radius: 8px; padding: 8px 18px;
  cursor: pointer; font-family: 'Cinzel', serif; letter-spacing: 1px; transition: 0.2s;
}
.btn-declare:hover { background: rgba(224, 176, 74, 0.12); }

.btn-primary {
  background: #e0b04a; color: #08151f; border: none; border-radius: 8px; padding: 9px 18px; cursor: pointer;
  font-family: 'Cinzel', serif; font-weight: bold; letter-spacing: 0.5px; transition: 0.2s;
}
.btn-primary:hover:not(:disabled) { background: #f5d179; }
.btn-primary:disabled { background: #3a4a55; color: #6fb7b0; cursor: not-allowed; }
.btn-ghost {
  background: transparent; color: #9fb4c2; border: 1px solid #3a4a55; border-radius: 8px; padding: 8px 14px;
  cursor: pointer; font-family: 'Space Mono', monospace; transition: 0.2s;
}
.btn-ghost:hover { border-color: #e0b04a; color: #f2e6cf; }

/* My hand */
.my-hand-area { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.my-hand-title { font-size: 0.7rem; color: #6fb7b0; text-transform: uppercase; letter-spacing: 1px; }
.my-hand { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; min-height: 178px; }
.empty-hand { color: #6fb7b0; font-size: 0.85rem; align-self: center; }

/* Log */
.tr-log-wrap { height: 200px; margin-top: 4px; }

/* Modal : révélation du Coffre */
.tr-modal-overlay {
  position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
  background: rgba(4, 12, 20, 0.72); backdrop-filter: blur(3px); padding: 20px;
}
.tr-modal {
  background: linear-gradient(160deg, #123146, #08151f); border: 1px solid #e0b04a; border-radius: 16px;
  padding: 34px 36px; max-width: 440px; width: 100%; text-align: center;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6), inset 0 0 40px rgba(224, 176, 74, 0.06);
  font-family: 'Space Mono', monospace; color: #f2e6cf;
}
.tr-modal-icon { font-size: 2.6rem; margin-bottom: 10px; }
.tr-modal-title { font-family: 'Cinzel', serif; font-weight: normal; font-size: 1.5rem; color: #f5d179; margin: 0 0 16px; letter-spacing: 1px; }
.tr-modal-text { font-size: 0.9rem; line-height: 1.6; color: #f2e6cf; margin: 0 0 12px; }
.tr-modal-text .pirate-word { color: #f5d179; }
.tr-modal-sub { font-size: 0.78rem; line-height: 1.5; color: #9fb4c2; margin: 0 0 26px; }
.tr-modal-sub strong { color: #e0b04a; }
.tr-modal-actions { display: flex; gap: 14px; justify-content: center; }
.btn-declare-confirm {
  background: #e0b04a; color: #08151f; border: none; border-radius: 8px; padding: 11px 22px; cursor: pointer;
  font-family: 'Cinzel', serif; font-weight: bold; letter-spacing: 0.5px; transition: 0.2s;
}
.btn-declare-confirm:hover { background: #f5d179; transform: translateY(-2px); }

.tr-modal-enter-active, .tr-modal-leave-active { transition: opacity 0.2s ease; }
.tr-modal-enter-from, .tr-modal-leave-to { opacity: 0; }
.tr-modal-enter-active .tr-modal, .tr-modal-leave-active .tr-modal { transition: transform 0.2s ease, opacity 0.2s ease; }
.tr-modal-enter-from .tr-modal, .tr-modal-leave-to .tr-modal { transform: scale(0.94); opacity: 0; }

@keyframes pulse { 0% { opacity: 0.75; } 50% { opacity: 1; } 100% { opacity: 0.75; } }

@media (max-width: 700px) {
  .tr-header { flex-direction: column; align-items: center; }
  .tr-identity { align-items: center; }
  .tr-stats { gap: 14px; justify-content: center; }
  .tr-center { flex-direction: column; gap: 16px; }
}
</style>
