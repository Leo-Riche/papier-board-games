<template>
  <div class="gang-board" :class="{ dimmed: showdownResult }">

    <!-- ═══════════════════════════════════════════════════════
         SHOWDOWN OVERLAY
    ════════════════════════════════════════════════════════ -->
    <Transition name="showdown-anim">
      <div v-if="showdownResult" class="showdown-overlay" @click.self="() => {}">
        <div class="showdown-panel">

          <div class="showdown-banner" :class="showdownResult.success ? 'success' : 'fail'">
            <span class="showdown-icon">{{ showdownResult.success ? '🏦' : '🚨' }}</span>
            <span class="showdown-text">{{ showdownResult.success ? 'BRAQUAGE RÉUSSI' : 'ALARME DÉCLENCHÉE !' }}</span>
          </div>

          <!-- Community cards at showdown -->
          <div class="showdown-community">
            <img v-for="card in showdownResult.communityCards" :key="card.suit + card.value"
                 :src="getCardUrl(card)" class="sd-comm-card" />
          </div>

          <!-- Player results -->
          <div class="showdown-results">
            <div v-for="(p, idx) in showdownResult.playerResults" :key="idx">
              <div class="sd-player-row" :class="{ 'is-me': p.name === myName }">
                <div class="sd-token" :class="phaseTokenClass">{{ p.tokenNumber }}</div>
                <div class="sd-player-info">
                  <span class="sd-name">{{ p.name }}</span>
                  <span class="sd-hand">{{ p.handName }}</span>
                </div>
                <div class="sd-pocket">
                  <img v-for="card in p.pocketCards" :key="card.suit + card.value"
                       :src="getCardUrl(card)" class="sd-pocket-card" />
                </div>
              </div>
              <!-- Arrow between players showing if ordering is correct -->
              <div v-if="p.nextCorrect !== null"
                   class="sd-arrow" :class="p.nextCorrect ? 'ok' : 'bad'">
                <span>{{ p.nextCorrect ? '✓ ordre correct' : '✗ ordre incorrect' }}</span>
                <span class="sd-arrow-icon">{{ p.nextCorrect ? '↓' : '✗' }}</span>
              </div>
            </div>
          </div>

          <!-- Score recap -->
          <div class="sd-score-recap">
            <div class="sd-score-item heists">
              <span class="score-icons">{{ '★'.repeat(showdownResult.heists) }}{{ '☆'.repeat(3 - showdownResult.heists) }}</span>
              <span>{{ showdownResult.heists }}/3 braquages</span>
            </div>
            <div class="sd-score-item alarms">
              <span class="score-icons">{{ '!'.repeat(showdownResult.alarms) }}{{ '○'.repeat(3 - showdownResult.alarms) }}</span>
              <span>{{ showdownResult.alarms }}/3 alarmes</span>
            </div>
          </div>

          <button class="btn-next-heist" @click="$emit('nextHeist')">
            🔫 Prochain braquage →
          </button>
        </div>
      </div>
    </Transition>

    <!-- ═══════════════════════════════════════════════════════
         HEADER — Phase + Score
    ════════════════════════════════════════════════════════ -->
    <div class="board-header">
      <div class="phase-track">
        <div v-for="ph in PHASES" :key="ph"
             class="phase-node"
             :class="{ active: phase === ph, passed: isPhasePassedOrActive(ph) }">
          <span class="phase-label">{{ PHASE_LABELS[ph] }}</span>
        </div>
        <div class="phase-connector" v-for="i in 3" :key="i"
             :class="{ filled: PHASES.indexOf(phase) >= i }"></div>
      </div>
      <div class="score-board">
        <div class="score-group heists-group">
          <span v-for="i in 3" :key="i" class="score-star" :class="{ earned: i <= heists }">★</span>
          <span class="score-label">Coffres</span>
        </div>
        <div class="score-sep">|</div>
        <div class="score-group alarms-group">
          <span v-for="i in 3" :key="i" class="score-alarm" :class="{ triggered: i <= alarms }">!</span>
          <span class="score-label">Alarmes</span>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════
         COMMUNITY CARDS
    ════════════════════════════════════════════════════════ -->
    <div class="section community-section">
      <div class="section-header">
        <h3 class="section-title">CARTES COMMUNES</h3>
        <button v-if="phase !== 'river'" class="btn-advance" @click="$emit('advancePhase')">
          → {{ PHASE_LABELS[nextPhase] }}
        </button>
      </div>

      <div class="community-cards">
        <div v-for="i in 5" :key="i" class="comm-slot"
             :class="{ revealed: !!communityCards[i - 1], upcoming: isUpcoming(i) }">
          <Transition name="card-flip">
            <img v-if="communityCards[i - 1]"
                 :src="getCardUrl(communityCards[i - 1])"
                 class="comm-card" :key="communityCards[i-1].suit + communityCards[i-1].value" />
            <div v-else class="comm-card-back">
              <img :src="cardBackUrl" class="comm-card" v-if="isUpcoming(i)" />
              <div v-else class="card-empty-slot"></div>
            </div>
          </Transition>
        </div>
      </div>

      <div class="phase-info-text">
        <span v-if="phase === 'preflop'">Pré-flop — les cartes communes ne sont pas encore révélées</span>
        <span v-if="phase === 'flop'">Flop — 3 cartes communes révélées</span>
        <span v-if="phase === 'turn'">Turn — 4ème carte révélée</span>
        <span v-if="phase === 'river'">River — toutes les cartes communes sont visibles</span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════
         TOKENS
    ════════════════════════════════════════════════════════ -->
    <div class="section tokens-section">
      <div class="section-header">
        <h3 class="section-title">JETONS DE CLASSEMENT <span class="token-legend">(1 = plus faible → {{ totalTokens }} = plus fort)</span></h3>
      </div>

      <div class="tokens-row">
        <div v-for="n in totalTokens" :key="n"
             class="token-chip" :class="getTokenClass(n)"
             @click="handleTokenClick(n)"
             :title="getTokenTitle(n)">
          <span class="token-number">{{ n }}</span>
          <span class="token-owner">{{ getTokenOwnerShort(n) }}</span>
        </div>
      </div>

      <div class="token-legend-row">
        <div class="legend-item">
          <div class="token-chip legend-chip available-chip"><span class="token-number">?</span></div>
          <span>Disponible</span>
        </div>
        <div class="legend-item">
          <div class="token-chip legend-chip mine-chip"><span class="token-number">?</span></div>
          <span>Mon jeton</span>
        </div>
        <div class="legend-item">
          <div class="token-chip legend-chip taken-chip"><span class="token-number">?</span></div>
          <span>Pris par un autre (cliquer pour voler)</span>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════
         MY HAND
    ════════════════════════════════════════════════════════ -->
    <div class="section my-hand-section">
      <div class="section-header">
        <h3 class="section-title">MES CARTES SECRÈTES</h3>
        <div class="my-token-display" v-if="myTokenNumber !== null">
          <span class="my-token-label">Mon jeton :</span>
          <div class="token-chip mine-chip my-token-badge">
            <span class="token-number">{{ myTokenNumber }}</span>
          </div>
          <button class="btn-release" @click="$emit('releaseToken')">✕ Libérer</button>
        </div>
        <div class="my-token-empty-warn" v-else>
          ⚠️ Prenez un jeton !
        </div>
      </div>

      <div class="my-pocket-cards">
        <div class="pocket-card-wrap" v-for="card in myPocketCards" :key="card.suit + card.value">
          <img :src="getCardUrl(card)" class="my-pocket-card" />
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════
         OTHER PLAYERS
    ════════════════════════════════════════════════════════ -->
    <div class="section opponents-section">
      <h3 class="section-title">AUTRES JOUEURS</h3>
      <div class="opponents-grid">
        <div v-for="opp in opponents" :key="opp.id" class="opp-card">
          <div class="opp-name">{{ opp.name }}</div>
          <div class="opp-token-display" :class="{ 'has-token': opp.tokenNumber !== null }">
            <span v-if="opp.tokenNumber !== null">{{ opp.tokenNumber }}</span>
            <span v-else class="no-token">–</span>
          </div>
          <div class="opp-validated" v-if="opp.hasValidated && phase === 'river'">✓ Validé</div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════
         VALIDATION (river only)
    ════════════════════════════════════════════════════════ -->
    <Transition name="fade">
      <div v-if="phase === 'river'" class="section validate-section">
        <div class="validation-status">
          <div class="val-progress">
            <div class="val-bar" :style="{ width: (validationCount / totalTokens * 100) + '%' }"></div>
          </div>
          <span class="val-text">{{ validationCount }} / {{ totalTokens }} joueurs ont validé</span>
        </div>

        <div class="validate-actions">
          <button class="btn-validate"
                  :class="{ validated: myHasValidated, disabled: !allHaveTokens }"
                  :disabled="myHasValidated || !allHaveTokens"
                  @click="$emit('validate')">
            <span v-if="myHasValidated">✅ Vous avez validé</span>
            <span v-else-if="!allHaveTokens">⚠️ Tous les joueurs doivent avoir un jeton</span>
            <span v-else>✅ Valider mon classement</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- ═══════════════════════════════════════════════════════
         GAME LOG
    ════════════════════════════════════════════════════════ -->
    <div class="game-log" ref="logEl">
      <div v-for="(msg, i) in gameMessages.slice(-6)" :key="i"
           class="log-entry" :class="msg.type">
        <span class="log-ts">{{ formatTime(msg.timestamp) }}</span>
        <span class="log-text">{{ msg.text }}</span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'

// Card images (eager glob import for Vite)
const cardImages = import.meta.glob('../../assets/images/Cards/*.png', { eager: true })

const getCardUrl = (card) => {
  if (!card) return ''
  const key = `../../assets/images/Cards/card_${card.suit}_${card.value}.png`
  return cardImages[key]?.default ?? ''
}

const cardBackUrl = cardImages['../../assets/images/Cards/card_back.png']?.default ?? ''

const PHASES = ['preflop', 'flop', 'turn', 'river']
const PHASE_LABELS = {
  preflop: 'Pré-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River'
}

const props = defineProps({
  phase: String,
  heists: Number,
  alarms: Number,
  communityCards: Array,
  myPocketCards: Array,
  myTokenNumber: { type: Number, default: null },
  myHasValidated: Boolean,
  myName: String,
  opponents: Array,
  availableTokens: Array,
  takenTokens: Object,
  totalTokens: Number,
  validationCount: Number,
  allHaveTokens: Boolean,
  showdownResult: { type: Object, default: null },
  status: String,
  gameMessages: Array
})

const emit = defineEmits(['advancePhase', 'takeToken', 'releaseToken', 'validate', 'nextHeist'])

const logEl = ref(null)

// Auto-scroll log
watch(() => props.gameMessages?.length, async () => {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
})

// Phase helpers
const isPhasePassedOrActive = (ph) => {
  return PHASES.indexOf(props.phase) >= PHASES.indexOf(ph)
}

const nextPhase = computed(() => {
  const idx = PHASES.indexOf(props.phase)
  return idx < PHASES.length - 1 ? PHASES[idx + 1] : null
})

// Token for upcoming community cards
const isUpcoming = (slotIdx) => {
  const n = props.communityCards?.length || 0
  if (props.phase === 'preflop') return false
  if (props.phase === 'flop') return slotIdx <= 3 && slotIdx > n
  if (props.phase === 'turn') return slotIdx === 4 && slotIdx > n
  if (props.phase === 'river') return slotIdx === 5 && slotIdx > n
  return false
}

// Token UI helpers
const getTokenClass = (n) => {
  if (props.myTokenNumber === n) return `mine-chip ${phaseTokenClass.value}`
  if (props.takenTokens?.[n]) return 'taken-chip'
  return 'available-chip'
}

const phaseTokenClass = computed(() => {
  const map = { preflop: 'token-white', flop: 'token-yellow', turn: 'token-orange', river: 'token-red' }
  return map[props.phase] || 'token-white'
})

const getTokenTitle = (n) => {
  if (props.myTokenNumber === n) return `Mon jeton — cliquer pour libérer`
  if (props.takenTokens?.[n]) return `Pris par ${props.takenTokens[n]} — cliquer pour voler`
  return `Prendre le jeton ${n}`
}

const getTokenOwnerShort = (n) => {
  if (props.myTokenNumber === n) return 'Moi'
  if (props.takenTokens?.[n]) return props.takenTokens[n].split(' ')[0]
  return ''
}

const handleTokenClick = (n) => {
  if (props.myTokenNumber === n) {
    emit('releaseToken')
  } else {
    emit('takeToken', n)
  }
}

const formatTime = (ts) => {
  const d = ts instanceof Date ? ts : new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

/* ── BASE ─────────────────────────────────────────── */
.gang-board {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #0f1a0f;
  color: #ecf0f1;
  font-family: 'Outfit', sans-serif;
  padding-bottom: 40px;
  transition: filter 0.3s;
}

.gang-board.dimmed { filter: brightness(0.3) blur(2px); pointer-events: none; }

.section {
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.section-title {
  font-size: 0.65rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #7a7265;
  margin: 0;
  font-weight: 400;
}

.token-legend { color: #4a4540; font-size: 0.6rem; margin-left: 8px; }

/* ── SHOWDOWN OVERLAY ─────────────────────────────── */
.showdown-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
  overflow-y: auto;
}

.showdown-panel {
  background: #0f0f14;
  border: 1px solid rgba(212, 175, 55, 0.35);
  max-width: 600px;
  width: 100%;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-shadow: 0 0 80px rgba(212, 175, 55, 0.08);
}

.showdown-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 16px 24px;
  font-family: 'Playfair Display', serif;
  font-size: 1.4rem;
  letter-spacing: 2px;
  font-weight: 900;
}

.showdown-banner.success {
  background: rgba(40, 160, 80, 0.1);
  border: 1px solid rgba(40, 160, 80, 0.4);
  color: #56c97e;
}

.showdown-banner.fail {
  background: rgba(180, 30, 30, 0.1);
  border: 1px solid rgba(180, 30, 30, 0.4);
  color: #e05555;
}

.showdown-icon { font-size: 2rem; }

.showdown-community {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.sd-comm-card { height: 80px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }

.showdown-results { display: flex; flex-direction: column; gap: 0; }

.sd-player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s;
}

.sd-player-row.is-me {
  background: rgba(212, 175, 55, 0.06);
  border-color: rgba(212, 175, 55, 0.2);
}

.sd-token {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700;
  flex-shrink: 0;
  border: 3px solid #d4af37;
  color: #d4af37;
  background: rgba(212, 175, 55, 0.1);
}

.sd-player-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.sd-name { font-size: 0.85rem; color: #e8e0d0; }
.sd-hand { font-size: 0.72rem; color: #9a8f7e; }

.sd-pocket { display: flex; gap: 4px; }
.sd-pocket-card { height: 54px; border-radius: 3px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }

.sd-arrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 20px;
  font-size: 0.7rem;
  letter-spacing: 1px;
}

.sd-arrow.ok { color: #56c97e; background: rgba(40, 160, 80, 0.05); }
.sd-arrow.bad { color: #e05555; background: rgba(180, 30, 30, 0.08); }
.sd-arrow-icon { font-size: 1rem; }

.sd-score-recap {
  display: flex;
  gap: 24px;
  justify-content: center;
  padding: 16px;
  border-top: 1px dashed rgba(212, 175, 55, 0.15);
  border-bottom: 1px dashed rgba(212, 175, 55, 0.15);
}

.sd-score-item { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 0.75rem; }
.sd-score-item .score-icons { font-size: 1rem; letter-spacing: 2px; }
.sd-score-item.heists .score-icons { color: #d4af37; }
.sd-score-item.alarms .score-icons { color: #e05555; }

.btn-next-heist {
  background: linear-gradient(135deg, #d4af37, #b8941e);
  color: #0a0a0e;
  border: none;
  padding: 14px 28px;
  font-family: 'Space Mono', monospace;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-next-heist:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(212, 175, 55, 0.3); }

/* Showdown transition */
.showdown-anim-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.showdown-anim-leave-active { transition: all 0.3s ease; }
.showdown-anim-enter-from { opacity: 0; transform: scale(0.95); }
.showdown-anim-leave-to { opacity: 0; transform: scale(1.02); }

/* ── HEADER ───────────────────────────────────────── */
.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(212, 175, 55, 0.12);
  flex-wrap: wrap;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.phase-track {
  display: flex;
  align-items: center;
  gap: 0;
  position: relative;
}

.phase-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  position: relative;
  z-index: 1;
}

.phase-label {
  font-size: 0.65rem;
  letter-spacing: 1px;
  color: #4a4540;
  text-transform: uppercase;
  transition: color 0.3s;
}

.phase-node.passed .phase-label { color: #7a7265; }
.phase-node.active .phase-label { color: #d4af37; font-weight: 700; }

.phase-node::before {
  content: '';
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #1e1e26;
  border: 2px solid #2a2a35;
  transition: all 0.3s;
  display: block;
}
.phase-node.passed::before { background: #4a4030; border-color: #d4af37; }
.phase-node.active::before { background: #d4af37; border-color: #f0cc5a; box-shadow: 0 0 12px rgba(212, 175, 55, 0.5); }

.phase-connector {
  width: 30px; height: 2px;
  background: #1e1e26;
  margin: 0 -4px;
  transition: background 0.3s;
  margin-bottom: 16px;
}
.phase-connector.filled { background: rgba(212, 175, 55, 0.4); }

.score-board {
  display: flex;
  align-items: center;
  gap: 10px;
}

.score-group { display: flex; align-items: center; gap: 4px; }
.score-sep { color: #2a2a35; }
.score-label { font-size: 0.6rem; color: #4a4540; letter-spacing: 1px; text-transform: uppercase; margin-left: 4px; }

.score-star { font-size: 1.1rem; color: #2a2a35; transition: all 0.3s; }
.score-star.earned { color: #d4af37; text-shadow: 0 0 10px rgba(212, 175, 55, 0.5); }

.score-alarm { font-size: 1rem; font-weight: 700; color: #2a2a35; transition: all 0.3s; }
.score-alarm.triggered { color: #e05555; text-shadow: 0 0 10px rgba(224, 85, 85, 0.5); }

/* ── COMMUNITY CARDS ──────────────────────────────── */
.community-section { background: rgba(10, 30, 20, 0.4); }

.btn-advance {
  background: transparent;
  border: 1px solid rgba(212, 175, 55, 0.4);
  color: #d4af37;
  font-family: 'Space Mono', monospace;
  font-size: 0.72rem;
  padding: 6px 14px;
  cursor: pointer;
  letter-spacing: 1px;
  transition: all 0.2s;
}
.btn-advance:hover { background: rgba(212, 175, 55, 0.1); transform: translateX(2px); }

.community-cards {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 10px;
}

.comm-slot {
  width: 80px;
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  overflow: hidden;
  transition: border-color 0.3s;
}
.comm-slot.revealed { border-color: rgba(212, 175, 55, 0.2); }

.comm-card { width: 80px; height: 112px; object-fit: contain; border-radius: 6px; }

.card-empty-slot {
  width: 80px; height: 112px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
}

.card-flip-enter-active { transition: all 0.4s ease; }
.card-flip-enter-from { opacity: 0; transform: rotateY(90deg) scale(0.8); }

.phase-info-text {
  font-size: 0.72rem;
  color: #5a5248;
  text-align: center;
  letter-spacing: 1px;
  font-style: italic;
}

/* ── TOKENS ───────────────────────────────────────── */
.tokens-section { background: rgba(212, 175, 55, 0.02); }

.tokens-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 14px;
}

.token-chip {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  position: relative;
  border: 3px dashed;
}

.token-chip:hover { transform: scale(1.12); }

.token-number { font-size: 1.3rem; font-weight: 700; line-height: 1; }
.token-owner {
  font-size: 0.5rem;
  letter-spacing: 0.5px;
  max-width: 54px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* Token color variants by phase */
.available-chip {
  border-color: rgba(212, 175, 55, 0.5);
  background: rgba(212, 175, 55, 0.06);
  color: #d4af37;
}
.available-chip:hover { background: rgba(212, 175, 55, 0.15); box-shadow: 0 0 20px rgba(212, 175, 55, 0.2); }

.mine-chip {
  border-color: #d4af37;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05));
  color: #d4af37;
  box-shadow: 0 0 16px rgba(212, 175, 55, 0.3), inset 0 0 16px rgba(212, 175, 55, 0.05);
}
.mine-chip:hover { box-shadow: 0 0 24px rgba(212, 175, 55, 0.4); }

.taken-chip {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
  color: #7a7265;
}
.taken-chip:hover { border-color: rgba(224, 85, 85, 0.6); color: #e05555; background: rgba(224, 85, 85, 0.06); }

.token-legend-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.65rem;
  color: #5a5248;
}

.legend-chip { width: 32px; height: 32px; cursor: default; pointer-events: none; }
.legend-chip .token-number { font-size: 0.8rem; }

/* ── MY HAND ──────────────────────────────────────── */
.my-hand-section { background: rgba(212, 175, 55, 0.02); border-top: 1px solid rgba(212, 175, 55, 0.08); }

.my-token-display { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.my-token-label { font-size: 0.72rem; color: #7a7265; }
.my-token-badge { width: 40px; height: 40px; cursor: default; }
.my-token-badge .token-number { font-size: 1rem; }

.btn-release {
  background: transparent;
  border: 1px solid rgba(224, 85, 85, 0.3);
  color: #e05555;
  font-family: 'Space Mono', monospace;
  font-size: 0.65rem;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-release:hover { background: rgba(224, 85, 85, 0.1); }

.my-token-empty-warn { font-size: 0.75rem; color: #8a5a2a; }

.my-pocket-cards {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}

.pocket-card-wrap {
  position: relative;
  transition: transform 0.2s;
}
.pocket-card-wrap:hover { transform: translateY(-6px); }

.my-pocket-card {
  height: 140px;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(212, 175, 55, 0.15);
  filter: drop-shadow(0 4px 12px rgba(212, 175, 55, 0.1));
}

/* ── OPPONENTS ────────────────────────────────────── */
.opponents-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.opp-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  min-width: 90px;
  transition: border-color 0.2s;
}

.opp-name { font-size: 0.75rem; color: #9a8f7e; }

.opp-token-display {
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 2px dashed rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 700;
  color: #4a4540;
  transition: all 0.3s;
}
.opp-token-display.has-token { border-color: rgba(212, 175, 55, 0.4); color: #d4af37; background: rgba(212, 175, 55, 0.06); }

.no-token { font-size: 0.7rem; }

.opp-validated { font-size: 0.62rem; color: #56c97e; letter-spacing: 1px; }

/* ── VALIDATION ───────────────────────────────────── */
.validate-section {
  background: rgba(40, 100, 60, 0.06);
  border-top: 1px solid rgba(40, 160, 80, 0.15);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.validation-status { display: flex; flex-direction: column; gap: 6px; }

.val-progress {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}
.val-bar {
  height: 100%;
  background: linear-gradient(90deg, #56c97e, #2ecc71);
  transition: width 0.4s ease;
}

.val-text { font-size: 0.72rem; color: #7a9e80; }

.btn-validate {
  padding: 12px 24px;
  font-family: 'Space Mono', monospace;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  border: 2px solid rgba(40, 160, 80, 0.5);
  background: rgba(40, 160, 80, 0.08);
  color: #56c97e;
  transition: all 0.2s;
  align-self: flex-start;
}
.btn-validate:hover:not(:disabled) { background: rgba(40, 160, 80, 0.18); transform: translateY(-1px); }
.btn-validate.validated { border-color: rgba(40, 160, 80, 0.3); color: #3d8a56; cursor: default; }
.btn-validate.disabled, .btn-validate:disabled { border-color: rgba(255, 255, 255, 0.08); color: #4a4540; cursor: not-allowed; background: transparent; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── GAME LOG ─────────────────────────────────────── */
.game-log {
  padding: 12px 24px;
  max-height: 120px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-entry {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-size: 0.7rem;
  animation: logIn 0.3s ease;
}
@keyframes logIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }

.log-ts { color: #3a3530; flex-shrink: 0; }
.log-text { color: #7a7265; }
.log-entry.system .log-text { color: #9a8f7e; }

/* ── RESPONSIVE ───────────────────────────────────── */
@media (max-width: 600px) {
  .section { padding: 14px 16px; }
  .board-header { padding: 10px 16px; }
  .phase-connector { width: 16px; }
  .comm-slot { width: 60px; height: 84px; }
  .comm-card { width: 60px; height: 84px; }
  .my-pocket-card { height: 110px; }
  .token-chip { width: 52px; height: 52px; }
  .token-number { font-size: 1.1rem; }
  .showdown-panel { padding: 20px 16px; }
  .sd-pocket-card { height: 44px; }
}
</style>
