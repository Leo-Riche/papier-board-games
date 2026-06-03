<template>
  <div class="gang-board-wrapper">

    <!-- ============ WAITING SCREEN ============ -->
    <div v-if="gameStatus === 'waiting'" class="waiting-screen">
      <h1>THE GANG 🔫</h1>
      <div class="share-box">
        <p>Partage ce code avec tes complices :</p>
        <strong class="room-code">{{ roomCode }}</strong>
        <button class="btn-secondary" @click="copyLink">📋 Copier le lien</button>
      </div>

      <ul class="player-list">
        <li v-for="p in allConnectedPlayers" :key="p.id">
          <span class="player-icon">{{ p.id === socket.id ? '⭐' : '👤' }}</span>
          <span class="player-name-txt">{{ p.name }}</span>
          <span v-if="p.isHost" class="host-tag">Chef</span>
        </li>
      </ul>

      <div class="player-count-info" :class="{ ok: allConnectedPlayers.length >= 3, warn: allConnectedPlayers.length < 3 }">
        {{ allConnectedPlayers.length }}/6 joueurs
        <span v-if="allConnectedPlayers.length < 3"> — encore {{ 3 - allConnectedPlayers.length }} requis</span>
      </div>

      <button v-if="amIHost" class="btn-primary"
        :disabled="allConnectedPlayers.length < 3 || allConnectedPlayers.length > 6"
        @click="startGame">
        LANCER LE BRAQUAGE 🔫
      </button>
      <p v-else class="waiting-msg">En attente du chef de salle...</p>

      <div class="rules-reminder">
        <h3>Rappel des règles</h3>
        <ul>
          <li>🃏 2 cartes secrètes par joueur + 5 cartes communes</li>
          <li>📍 <strong>Tous</strong> doivent voter pour passer à la phase suivante</li>
          <li>🎰 Prenez un jeton pour indiquer la force de votre main (1 = plus faible)</li>
          <li>⚠️ <strong>Aucune communication verbale</strong> sur vos cartes !</li>
          <li>✅ Au River, tous valident → Showdown automatique</li>
          <li>🏦 Gagnez <strong>3 braquages</strong> avant 3 alarmes</li>
        </ul>
      </div>
    </div>

    <!-- ============ PLAYING SCREEN ============ -->
    <div v-else-if="gameStatus === 'playing' || gameStatus === 'showdown'" class="playing-screen">

      <!-- SHOWDOWN OVERLAY -->
      <Transition name="showdown-anim">
        <div v-if="gameStatus === 'showdown' && showdownResult" class="showdown-overlay">
          <div class="showdown-panel">
            <div class="showdown-banner" :class="showdownResult.success ? 'success' : 'fail'">
              {{ showdownResult.success ? '🏦 BRAQUAGE RÉUSSI !' : '🚨 ALARME DÉCLENCHÉE !' }}
            </div>

            <!-- Community cards replayed -->
            <div class="sd-section-label">CARTES COMMUNES</div>
            <div class="sd-community">
              <img v-for="card in showdownResult.communityCards" :key="card.suit + card.value"
                   :src="getCardUrl(card)" class="sd-comm-card" />
            </div>

            <!-- Results ordered by token -->
            <div class="sd-section-label">CLASSEMENT</div>
            <div class="sd-results">
              <div v-for="(p, idx) in showdownResult.playerResults" :key="idx">
                <div class="sd-player-row" :class="{ 'is-me': p.name === myName }">
                  <div class="sd-token" :class="p.nextCorrect === false ? 'token-bad' : ''">{{ p.tokenNumber }}</div>
                  <div class="sd-player-info">
                    <span class="sd-name">{{ p.name }}<span v-if="p.name === myName" class="me-label"> (vous)</span></span>
                    <span class="sd-hand">{{ p.handName }}</span>
                  </div>
                  <div class="sd-pocket">
                    <img v-for="card in p.pocketCards" :key="card.suit + card.value"
                         :src="getCardUrl(card)" class="sd-pocket-card" />
                  </div>
                </div>
                <div v-if="p.nextCorrect !== null" class="sd-connector" :class="p.nextCorrect ? 'ok' : 'bad'">
                  <span class="sd-connector-line"></span>
                  <span class="sd-connector-label">{{ p.nextCorrect ? '✓ ordre correct' : '✗ ordre incorrect' }}</span>
                  <span class="sd-connector-line"></span>
                </div>
              </div>
            </div>

            <div class="sd-score-recap">
              <div class="sd-score-item">
                <span class="sd-stars">{{ '★'.repeat(showdownResult.heists) }}{{ '☆'.repeat(3 - showdownResult.heists) }}</span>
                <span class="sd-score-label">{{ showdownResult.heists }}/3 coffres</span>
              </div>
              <div class="sd-divider"></div>
              <div class="sd-score-item alarms">
                <span class="sd-alarms-val">{{ showdownResult.alarms }}/3</span>
                <span class="sd-score-label">alarmes</span>
              </div>
            </div>

            <button class="btn-primary" @click="handleNextHeist">🔫 Prochain braquage</button>
          </div>
        </div>
      </Transition>

      <!-- TOP BAR -->
      <div class="top-bar">
        <h2>THE GANG</h2>

        <div class="phase-track">
          <div v-for="(ph, i) in PHASES" :key="ph" class="phase-item">
            <div class="phase-dot" :class="{ active: phase === ph, passed: isPhasePassedOrActive(ph) }"></div>
            <span class="phase-label" :class="{ active: phase === ph, passed: isPhasePassedOrActive(ph) }">
              {{ PHASE_LABELS[ph] }}
            </span>
            <div v-if="i < PHASES.length - 1" class="phase-line" :class="{ filled: PHASES.indexOf(phase) > i }"></div>
          </div>
        </div>

        <div class="score-display">
          <span class="score-heists" :title="`${heists} braquages`">
            <span v-for="i in 3" :key="i" :class="i <= heists ? 'star-on' : 'star-off'">★</span>
          </span>
          <span class="score-sep">|</span>
          <span class="score-alarms" :title="`${alarms} alarmes`">
            <span v-for="i in 3" :key="i" :class="i <= alarms ? 'alarm-on' : 'alarm-off'">!</span>
          </span>
        </div>
      </div>

      <!-- MAIN CONTENT: left panel + right panel -->
      <div class="main-content">

        <!-- LEFT PANEL: community cards + my hand + actions -->
        <div class="left-panel">

          <!-- POKER TABLE -->
          <div class="poker-table">

            <!-- Community cards - BIG and central -->
            <div class="community-zone">
              <div class="zone-label">CARTES COMMUNES</div>
              <div class="community-cards">
                <div v-for="i in 5" :key="i" class="comm-card-slot"
                     :class="{ revealed: !!communityCards[i-1], upcoming: isUpcoming(i) }">
                  <img v-if="communityCards[i-1]"
                       :src="getCardUrl(communityCards[i-1])" class="comm-card" />
                  <div v-else class="comm-card-placeholder">
                    <span v-if="isUpcoming(i)">?</span>
                  </div>
                </div>
              </div>
              <div class="community-hint">
                <span v-if="phase === 'preflop'">Pré-flop — les cartes communes ne sont pas encore révélées</span>
                <span v-else-if="phase === 'flop'">Flop — 3 cartes révélées</span>
                <span v-else-if="phase === 'turn'">Turn — 4ème carte</span>
                <span v-else-if="phase === 'river'">River — toutes les 5 cartes sont visibles</span>
              </div>
            </div>

            <!-- Separator -->
            <div class="table-divider"></div>

            <!-- My pocket cards - BIG -->
            <div class="my-hand-zone">
              <div class="zone-label">
                MES CARTES
                <span v-if="myTokenNumber !== null" class="my-token-inline">
                  — Jeton <strong>{{ myTokenNumber }}</strong>
                  <button class="btn-release-inline" @click="handleReleaseToken">✕</button>
                </span>
                <span v-else class="warn-inline">⚠️ Pas de jeton</span>
              </div>
              <div class="my-cards-row">
                <div v-for="card in myPocketCards" :key="card.suit + card.value" class="my-card-wrap">
                  <img :src="getCardUrl(card)" class="my-pocket-card" />
                </div>
              </div>
            </div>

          </div>

          <!-- ACTIONS SECTION -->
          <div class="actions-zone">

            <!-- Phase Vote (not at river) -->
            <div v-if="phase !== 'river'" class="action-block vote-block">
              <div class="action-block-header">
                <span class="action-title">Passer au {{ PHASE_LABELS[nextPhase] }}</span>
                <span class="vote-count-badge">{{ phaseVoteCount }}/{{ totalTokens }}</span>
              </div>

              <div class="vote-bar-row">
                <div class="vote-bar-bg">
                  <div class="vote-bar-fill" :style="{ width: (phaseVoteCount / totalTokens * 100) + '%' }"></div>
                </div>
              </div>

              <div class="vote-players">
                <div v-for="opp in opponents" :key="opp.id" class="vote-player-chip"
                     :class="{ voted: opp.hasPhaseVoted }">
                  {{ opp.name.split(' ')[0] }}
                  <span class="vote-chip-mark">{{ opp.hasPhaseVoted ? '✓' : '' }}</span>
                </div>
                <div class="vote-player-chip is-me" :class="{ voted: myHasPhaseVoted }">
                  Moi
                  <span class="vote-chip-mark">{{ myHasPhaseVoted ? '✓' : '' }}</span>
                </div>
              </div>

              <button v-if="!myHasPhaseVoted" class="btn-vote" @click="handlePhaseVote">
                👍 Voter pour passer au {{ PHASE_LABELS[nextPhase] }}
              </button>
              <button v-else class="btn-cancel-vote" @click="handleCancelPhaseVote">
                ↩️ Annuler mon vote
              </button>
            </div>

            <!-- River Validation -->
            <div v-if="phase === 'river'" class="action-block validate-block">
              <div class="action-block-header">
                <span class="action-title">Valider mon classement</span>
                <span class="vote-count-badge green">{{ validationCount }}/{{ totalTokens }}</span>
              </div>

              <div class="vote-bar-row">
                <div class="vote-bar-bg">
                  <div class="vote-bar-fill green" :style="{ width: (validationCount / totalTokens * 100) + '%' }"></div>
                </div>
              </div>

              <div class="vote-players">
                <div v-for="opp in opponents" :key="opp.id" class="vote-player-chip"
                     :class="{ 'voted-green': opp.hasValidated }">
                  {{ opp.name.split(' ')[0] }}
                  <span class="vote-chip-mark">{{ opp.hasValidated ? '✓' : '' }}</span>
                </div>
                <div class="vote-player-chip is-me" :class="{ 'voted-green': myHasValidated }">
                  Moi
                  <span class="vote-chip-mark">{{ myHasValidated ? '✓' : '' }}</span>
                </div>
              </div>

              <button class="btn-validate"
                      :class="{ validated: myHasValidated }"
                      :disabled="myHasValidated || !allHaveTokens"
                      @click="handleValidate">
                <span v-if="myHasValidated">✅ Validé</span>
                <span v-else-if="!allHaveTokens">⚠️ Tous les joueurs doivent avoir un jeton d'abord</span>
                <span v-else>✅ Valider mon classement</span>
              </button>
            </div>

          </div>

        </div>

        <!-- RIGHT PANEL: Tokens + Opponents -->
        <div class="right-panel">

          <!-- TOKENS -->
          <div class="tokens-container">
            <div class="panel-header">
              <span class="panel-title">JETONS</span>
              <span class="panel-subtitle">1 = plus faible · {{ totalTokens }} = plus fort</span>
            </div>

            <div class="tokens-grid">
              <div
                v-for="n in totalTokens"
                :key="n"
                class="token-wrap"
                :class="getTokenClass(n)"
                @click="handleTokenClick(n)"
                :title="getTokenTitle(n)"
              >
                <TokenChip :count="n" :size="72" />
                <div class="token-owner-label">{{ getTokenOwnerLabel(n) }}</div>
              </div>
            </div>

            <div class="token-legend">
              <span><span class="dot dot-free"></span> Libre</span>
              <span><span class="dot dot-mine"></span> Mon jeton</span>
              <span><span class="dot dot-taken"></span> Pris (clic = voler)</span>
            </div>
          </div>

          <!-- OPPONENTS -->
          <div class="opponents-container">
            <div class="panel-header">
              <span class="panel-title">JOUEURS</span>
            </div>
            <div class="opponents-list">
              <div v-for="opp in opponents" :key="opp.id" class="opp-card">
                <span class="opp-name">{{ opp.name }}</span>
                <span class="opp-token-badge" :class="{ 'has-token': opp.tokenNumber !== null }">
                  {{ opp.tokenNumber !== null ? `Jeton ${opp.tokenNumber}` : '–' }}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- LOG BAR -->
      <div class="logs-bar" v-if="gameLogs.length > 0">
        <span class="log-latest">{{ gameLogs[0] }}</span>
      </div>
    </div>

    <!-- ============ GAME OVER SCREEN ============ -->
    <div v-else-if="gameStatus === 'finished'" class="game-over-screen">
      <div class="results-box" :class="gameOverData?.outcome">
        <div class="go-icon">{{ gameOverData?.outcome === 'victory' ? '🏆' : '🚔' }}</div>
        <h2>{{ gameOverData?.outcome === 'victory' ? 'VICTOIRE !' : 'DÉFAITE' }}</h2>
        <p class="go-reason">{{ gameOverData?.reason }}</p>

        <div class="go-scores">
          <div class="go-score-item">
            <span class="go-stars">{{ '★'.repeat(gameOverData?.heists ?? 0) }}{{ '☆'.repeat(3 - (gameOverData?.heists ?? 0)) }}</span>
            <span>{{ gameOverData?.heists }}/3 braquages réussis</span>
          </div>
          <div class="go-score-item alarms">
            <span>{{ gameOverData?.alarms }}/3 alarmes déclenchées</span>
          </div>
        </div>

        <div class="go-final-hands" v-if="gameOverData?.playerResults">
          <div class="go-community">
            <img v-for="card in gameOverData.communityCards" :key="card.suit+card.value"
                 :src="getCardUrl(card)" class="go-comm-card" />
          </div>
          <div v-for="(p, i) in gameOverData.playerResults" :key="i">
            <div class="go-hand-row">
              <span class="go-token">{{ p.tokenNumber }}</span>
              <div class="go-hand-info">
                <span class="go-player-name">{{ p.name }}</span>
                <span class="go-hand-name">{{ p.handName }}</span>
              </div>
              <div class="go-pocket-cards">
                <img v-for="card in p.pocketCards" :key="card.suit+card.value"
                     :src="getCardUrl(card)" class="go-pocket-card" />
              </div>
            </div>
            <div v-if="p.nextCorrect !== null" class="go-arrow" :class="p.nextCorrect ? 'ok' : 'bad'">
              {{ p.nextCorrect ? '✓ correct' : '✗ incorrect' }}
            </div>
          </div>
        </div>

        <div v-if="amIHost" class="host-actions">
          <button class="btn-primary" @click="startGame">REJOUER 🔄</button>
        </div>
        <p v-else class="waiting-msg">En attente du chef de salle...</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import TokenChip from './TokenChip.vue'

// Card images
const cardImages = import.meta.glob('../../assets/images/Cards/*.png', { eager: true })
const getCardUrl = (card) => {
  if (!card) return ''
  const key = `../../assets/images/Cards/card_${card.suit}_${card.value}.png`
  return cardImages[key]?.default ?? ''
}

const PHASES = ['preflop', 'flop', 'turn', 'river']
const PHASE_LABELS = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' }

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

// ── State ──────────────────────────────────────
const gameStatus = ref('waiting')
const allConnectedPlayers = ref([])
const amIHost = ref(false)
const myName = ref('')

const phase = ref('preflop')
const heists = ref(0)
const alarms = ref(0)
const communityCards = ref([])
const myPocketCards = ref([])
const myTokenNumber = ref(null)
const myHasValidated = ref(false)
const myHasPhaseVoted = ref(false)
const opponents = ref([])
const takenTokens = ref({})
const totalTokens = ref(0)
const validationCount = ref(0)
const phaseVoteCount = ref(0)
const allHaveTokens = ref(false)
const showdownResult = ref(null)
const gameOverData = ref(null)
const gameLogs = ref([])

// ── Computed ───────────────────────────────────
const isPhasePassedOrActive = (ph) => PHASES.indexOf(phase.value) >= PHASES.indexOf(ph)
const nextPhase = computed(() => {
  const idx = PHASES.indexOf(phase.value)
  return idx < PHASES.length - 1 ? PHASES[idx + 1] : null
})

// Which community card slots are "upcoming" (will be revealed this phase)
const isUpcoming = (slotIdx) => {
  const n = communityCards.value?.length || 0
  if (phase.value === 'preflop') return false
  if (phase.value === 'flop') return slotIdx <= 3 && slotIdx > n
  if (phase.value === 'turn') return slotIdx === 4 && slotIdx > n
  if (phase.value === 'river') return slotIdx === 5 && slotIdx > n
  return false
}

// ── Token helpers ──────────────────────────────
const getTokenClass = (n) => {
  if (myTokenNumber.value === n) return 'token-mine'
  if (takenTokens.value?.[n]) return 'token-taken'
  return 'token-free'
}
const getTokenTitle = (n) => {
  if (myTokenNumber.value === n) return 'Mon jeton — cliquer pour libérer'
  if (takenTokens.value?.[n]) return `Pris par ${takenTokens.value[n]} — cliquer pour voler`
  return `Prendre le jeton ${n}`
}
const getTokenOwnerLabel = (n) => {
  if (myTokenNumber.value === n) return 'Moi'
  return takenTokens.value?.[n] ?? ''
}
const handleTokenClick = (n) => {
  if (myTokenNumber.value === n) handleReleaseToken()
  else socket.emit('thegang_action', { roomCode, actionType: 'take_token', payload: { tokenNumber: n } })
}

// ── Actions ────────────────────────────────────
const startGame = () => socket.emit('start_thegang', roomCode)
const handlePhaseVote = () => socket.emit('thegang_action', { roomCode, actionType: 'phase_vote', payload: {} })
const handleCancelPhaseVote = () => socket.emit('thegang_action', { roomCode, actionType: 'cancel_phase_vote', payload: {} })
const handleReleaseToken = () => socket.emit('thegang_action', { roomCode, actionType: 'release_token', payload: {} })
const handleValidate = () => socket.emit('thegang_action', { roomCode, actionType: 'validate', payload: {} })
const handleNextHeist = () => socket.emit('thegang_action', { roomCode, actionType: 'next_heist', payload: {} })

const copyLink = () => {
  const link = `${window.location.origin}/thegang/join/${roomCode}`
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
  socket.on('thegang_error', (msg) => alert(msg))

  socket.on('update_players_list', (players) => {
    allConnectedPlayers.value = players
    const me = players.find(p => p.id === socket.id)
    if (me) {
      amIHost.value = me.isHost
      if (me.name && me.name !== 'Anonyme') myName.value = me.name
    }
  })

  socket.on('name_set', (data) => { myName.value = data.name })

  socket.on('game_started', () => {
    gameStatus.value = 'playing'
    gameLogs.value = []
    gameOverData.value = null
    showdownResult.value = null
  })

  socket.on('update_board_state', (data) => {
    gameStatus.value = data.status === 'finished' ? 'finished' : data.status === 'showdown' ? 'showdown' : 'playing'
    phase.value = data.phase
    heists.value = data.heists
    alarms.value = data.alarms
    communityCards.value = data.communityCards
    myPocketCards.value = data.myPocketCards
    myTokenNumber.value = data.myTokenNumber
    myHasValidated.value = data.myHasValidated
    myHasPhaseVoted.value = data.myHasPhaseVoted
    opponents.value = data.opponents
    takenTokens.value = data.takenTokens
    totalTokens.value = data.totalTokens
    validationCount.value = data.validationCount
    phaseVoteCount.value = data.phaseVoteCount
    allHaveTokens.value = data.allHaveTokens
    showdownResult.value = data.showdownResult
  })

  socket.on('action_log', (msg) => {
    gameLogs.value.unshift(msg)
    if (gameLogs.value.length > 5) gameLogs.value.pop()
  })

  socket.on('game_over', (data) => {
    gameStatus.value = 'finished'
    gameOverData.value = data
  })
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&display=swap');

/* ══════════════════════════════════════════════
   BASE
══════════════════════════════════════════════ */
.gang-board-wrapper {
  min-height: 100vh;
  background: #0f0a0a;
  color: #ecf0f1;
  font-family: 'Outfit', sans-serif;
  display: flex;
  flex-direction: column;
}

/* ══════════════════════════════════════════════
   WAITING SCREEN
══════════════════════════════════════════════ */
.waiting-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 40px 20px;
  overflow-y: auto;
}

.waiting-screen h1 {
  font-size: 2.8rem;
  font-weight: 900;
  color: #e74c3c;
  margin: 0;
  letter-spacing: 2px;
}

.share-box {
  background: #1e1010;
  padding: 24px 32px;
  border-radius: 12px;
  border: 1px solid rgba(231, 76, 60, 0.2);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 400px;
  width: 100%;
}
.share-box p { margin: 0; color: #bdc3c7; font-size: 1rem; }
.room-code { font-size: 2.4rem; font-weight: 900; color: #e74c3c; letter-spacing: 8px; }

.player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
  width: 100%;
}
.player-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #1e1010;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.05);
}
.player-icon { font-size: 1.1rem; }
.player-name-txt { flex: 1; font-size: 1rem; font-weight: 600; color: #ecf0f1; }
.host-tag {
  font-size: 0.7rem;
  background: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.35);
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 700;
}

.player-count-info {
  font-size: 1rem;
  font-weight: 700;
  padding: 8px 24px;
  border-radius: 20px;
}
.player-count-info.ok { background: rgba(231, 76, 60, 0.12); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.25); }
.player-count-info.warn { background: rgba(100, 30, 30, 0.12); color: #95a5a6; border: 1px solid rgba(100, 30, 30, 0.2); }

.waiting-msg { color: #95a5a6; font-style: italic; font-size: 1rem; margin: 0; }

.rules-reminder {
  background: #1e1010;
  padding: 20px 24px;
  border-radius: 12px;
  border: 1px dashed rgba(231, 76, 60, 0.15);
  max-width: 480px;
  width: 100%;
  text-align: left;
}
.rules-reminder h3 { color: #e74c3c; font-size: 1rem; margin: 0 0 14px; font-weight: 700; }
.rules-reminder ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.rules-reminder li { font-size: 0.9rem; color: #bdc3c7; line-height: 1.5; }
.rules-reminder li strong { color: #ecf0f1; }

/* ══════════════════════════════════════════════
   PLAYING SCREEN
══════════════════════════════════════════════ */
.playing-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ── SHOWDOWN OVERLAY ────────────────────────── */
.showdown-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.93);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
  overflow-y: auto;
}

.showdown-panel {
  background: #180d0d;
  border: 1px solid rgba(231, 76, 60, 0.35);
  border-radius: 16px;
  max-width: 580px;
  width: 100%;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 0 60px rgba(231, 76, 60, 0.08);
}

.showdown-banner {
  text-align: center;
  font-size: 1.5rem;
  font-weight: 900;
  padding: 14px;
  border-radius: 10px;
  letter-spacing: 1px;
}
.showdown-banner.success { background: rgba(39, 174, 96, 0.15); color: #2ecc71; border: 1px solid rgba(39, 174, 96, 0.3); }
.showdown-banner.fail    { background: rgba(231, 76, 60, 0.15); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); }

.sd-section-label {
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 3px;
  color: #7f8c8d;
  text-transform: uppercase;
}

.sd-community { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.sd-comm-card { height: 88px; border-radius: 5px; box-shadow: 0 4px 14px rgba(0,0,0,0.6); }

.sd-results { display: flex; flex-direction: column; }

.sd-player-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,0.04);
  background: rgba(255,255,255,0.02);
  transition: background 0.2s;
}
.sd-player-row.is-me { background: rgba(231, 76, 60, 0.06); border-color: rgba(231, 76, 60, 0.2); }

.sd-token {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 2.5px solid #e74c3c;
  color: #e74c3c;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; font-weight: 900; flex-shrink: 0;
}
.sd-token.token-bad { border-color: #e74c3c; background: rgba(231, 76, 60, 0.1); }

.sd-player-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.sd-name { font-size: 0.95rem; font-weight: 700; color: #ecf0f1; }
.me-label { color: #7f8c8d; font-weight: 400; font-size: 0.85rem; }
.sd-hand { font-size: 0.82rem; color: #bdc3c7; }

.sd-pocket { display: flex; gap: 5px; }
.sd-pocket-card { height: 60px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }

.sd-connector {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 16px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.sd-connector.ok  { color: #2ecc71; }
.sd-connector.bad { color: #e74c3c; }
.sd-connector-line { flex: 1; height: 1px; background: currentColor; opacity: 0.2; }
.sd-connector-label { white-space: nowrap; }

.sd-score-recap {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  padding: 14px;
  background: rgba(255,255,255,0.02);
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.05);
}
.sd-score-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.sd-stars { font-size: 1.3rem; letter-spacing: 3px; color: #e74c3c; }
.sd-alarms-val { font-size: 1.3rem; font-weight: 900; color: #95a5a6; }
.sd-score-label { font-size: 0.75rem; color: #7f8c8d; }
.sd-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.07); }
.sd-score-item.alarms .sd-alarms-val { color: #c0392b; }

.showdown-anim-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.showdown-anim-leave-active { transition: all 0.25s ease; }
.showdown-anim-enter-from  { opacity: 0; transform: scale(0.95) translateY(20px); }
.showdown-anim-leave-to    { opacity: 0; }

/* ── TOP BAR ──────────────────────────────────── */
.top-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  background: #150808;
  padding: 10px 20px;
  border-bottom: 2px solid rgba(231, 76, 60, 0.2);
  flex-shrink: 0;
}

.top-bar h2 {
  font-size: 1.3rem;
  font-weight: 900;
  margin: 0;
  color: #e74c3c;
  letter-spacing: 2px;
  white-space: nowrap;
}

/* Phase track */
.phase-track { display: flex; align-items: center; gap: 0; flex: 1; }
.phase-item { display: flex; align-items: center; gap: 6px; }
.phase-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  border: 2px solid #3a1a1a;
  background: #1a0a0a;
  transition: all 0.3s;
  flex-shrink: 0;
}
.phase-dot.passed { border-color: #7a2020; background: #7a2020; }
.phase-dot.active  { border-color: #e74c3c; background: #e74c3c; box-shadow: 0 0 8px rgba(231,76,60,0.5); }
.phase-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #4a2020;
  white-space: nowrap;
  transition: color 0.3s;
}
.phase-label.passed { color: #95a5a6; }
.phase-label.active  { color: #e74c3c; }
.phase-line {
  width: 24px; height: 2px;
  background: #2a1010;
  margin: 0 2px;
  transition: background 0.3s;
}
.phase-line.filled { background: #7a2020; }

/* Score */
.score-display { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.score-heists, .score-alarms { font-size: 1.2rem; letter-spacing: 2px; }
.star-on  { color: #e74c3c; text-shadow: 0 0 8px rgba(231,76,60,0.4); }
.star-off { color: #2a1010; }
.alarm-on  { color: #c0392b; font-weight: 900; }
.alarm-off { color: #2a1010; font-weight: 900; }
.score-sep { color: #2a1010; font-size: 1.2rem; }

/* ── MAIN 2-PANEL LAYOUT ───────────────────────── */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ── LEFT PANEL ─────────────────────────────────── */
.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: #120808;
  border-right: 1px solid rgba(231, 76, 60, 0.1);
}

/* ── POKER TABLE ─────────────────────────────────── */
.poker-table {
  background: linear-gradient(180deg, #1a0d0d 0%, #150a0a 100%);
  border-bottom: 1px solid rgba(231, 76, 60, 0.1);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.community-zone, .my-hand-zone { display: flex; flex-direction: column; gap: 12px; }

.zone-label {
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 3px;
  color: #7f8c8d;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Community Cards — big and central */
.community-cards {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.comm-card-slot {
  width: 88px;
  height: 124px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(100, 30, 30, 0.3);
  transition: border-color 0.3s;
  overflow: hidden;
}
.comm-card-slot.revealed {
  border-color: rgba(231, 76, 60, 0.25);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.comm-card-slot.upcoming { border-color: rgba(100, 30, 30, 0.5); border-style: solid; }

.comm-card {
  width: 88px;
  height: 124px;
  object-fit: contain;
  border-radius: 6px;
  animation: cardReveal 0.4s ease;
}

@keyframes cardReveal {
  from { opacity: 0; transform: rotateY(90deg) scale(0.9); }
  to   { opacity: 1; transform: rotateY(0deg) scale(1); }
}

.comm-card-placeholder {
  width: 88px;
  height: 124px;
  border-radius: 6px;
  background: rgba(100, 30, 30, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #3a1a1a;
  font-weight: 900;
}

.community-hint {
  text-align: center;
  font-size: 0.82rem;
  color: #7f8c8d;
  font-style: italic;
}

/* Table divider */
.table-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(231, 76, 60, 0.15), transparent);
}

/* My cards — big, prominent */
.my-token-inline { color: #bdc3c7; font-weight: 700; font-size: 0.85rem; }
.my-token-inline strong { color: #e74c3c; font-size: 1.1rem; }
.warn-inline { color: #95a5a6; font-size: 0.82rem; font-style: italic; }

.btn-release-inline {
  background: transparent;
  border: 1px solid rgba(231, 76, 60, 0.25);
  color: #7f8c8d;
  font-size: 0.65rem;
  padding: 1px 6px;
  cursor: pointer;
  border-radius: 4px;
  margin-left: 6px;
  transition: 0.15s;
}
.btn-release-inline:hover { border-color: #e74c3c; color: #e74c3c; }

.my-cards-row {
  display: flex;
  gap: 14px;
  justify-content: center;
}

.my-card-wrap {
  position: relative;
  transition: transform 0.2s;
  cursor: default;
}
.my-card-wrap:hover { transform: translateY(-6px) scale(1.03); }

.my-pocket-card {
  height: 148px;
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.7), 0 0 0 2px rgba(231, 76, 60, 0.15);
  display: block;
}

/* ── ACTIONS ZONE ────────────────────────────── */
.actions-zone {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-block {
  background: #1e1010;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(231, 76, 60, 0.12);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.validate-block { border-color: rgba(39, 174, 96, 0.15); background: #0f1e14; }

.action-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.action-title { font-size: 0.9rem; font-weight: 700; color: #ecf0f1; }

.vote-count-badge {
  font-size: 0.75rem;
  font-weight: 900;
  padding: 3px 10px;
  border-radius: 12px;
  background: rgba(231, 76, 60, 0.15);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.25);
}
.vote-count-badge.green {
  background: rgba(39, 174, 96, 0.12);
  color: #2ecc71;
  border-color: rgba(39, 174, 96, 0.25);
}

.vote-bar-row { }
.vote-bar-bg {
  height: 5px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
}
.vote-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #c0392b, #e74c3c);
  border-radius: 3px;
  transition: width 0.4s ease;
}
.vote-bar-fill.green { background: linear-gradient(90deg, #27ae60, #2ecc71); }

.vote-players {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.vote-player-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  color: #95a5a6;
  transition: all 0.2s;
}
.vote-player-chip.is-me { border-color: rgba(231, 76, 60, 0.2); color: #bdc3c7; }
.vote-player-chip.voted { background: rgba(231, 76, 60, 0.12); border-color: rgba(231, 76, 60, 0.35); color: #e74c3c; }
.vote-player-chip.voted-green { background: rgba(39, 174, 96, 0.1); border-color: rgba(39, 174, 96, 0.3); color: #2ecc71; }
.vote-chip-mark { font-size: 0.75rem; }

/* Vote / validate buttons */
.btn-vote {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(231, 76, 60, 0.45);
  background: rgba(231, 76, 60, 0.08);
  color: #ecf0f1;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 8px;
  transition: 0.2s;
  text-align: center;
}
.btn-vote:hover { background: rgba(231, 76, 60, 0.18); transform: translateY(-1px); }

.btn-cancel-vote {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(100, 100, 100, 0.2);
  background: rgba(100, 100, 100, 0.05);
  color: #95a5a6;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 8px;
  transition: 0.2s;
}
.btn-cancel-vote:hover { border-color: rgba(231, 76, 60, 0.3); color: #bdc3c7; }

.btn-validate {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid rgba(39, 174, 96, 0.45);
  background: rgba(39, 174, 96, 0.08);
  color: #ecf0f1;
  font-family: 'Outfit', sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 8px;
  transition: 0.2s;
}
.btn-validate:hover:not(:disabled) { background: rgba(39, 174, 96, 0.18); transform: translateY(-1px); }
.btn-validate.validated { color: #2ecc71; cursor: default; border-color: rgba(39, 174, 96, 0.2); }
.btn-validate:disabled:not(.validated) { border-color: rgba(100, 100, 100, 0.15); color: #4a4040; cursor: not-allowed; background: transparent; }

/* ── RIGHT PANEL ─────────────────────────────── */
.right-panel {
  width: 280px;
  min-width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #100808;
  overflow-y: auto;
}

.tokens-container, .opponents-container {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(231, 76, 60, 0.08);
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.panel-title { font-size: 0.68rem; font-weight: 900; letter-spacing: 3px; color: #e74c3c; text-transform: uppercase; }
.panel-subtitle { font-size: 0.7rem; color: #4a2020; }

/* Tokens grid */
.tokens-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.token-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border-radius: 12px;
  padding: 6px 4px;
  transition: all 0.2s;
  position: relative;
}
.token-wrap:hover { background: rgba(255,255,255,0.04); }

/* Mine: bright glow ring */
.token-wrap.token-mine {
  background: rgba(231, 76, 60, 0.1);
  box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.5), 0 0 14px rgba(231, 76, 60, 0.2);
}
.token-wrap.token-mine .token-chip-svg {
  filter: drop-shadow(0 0 8px rgba(231, 76, 60, 0.6)) brightness(1.1);
}

/* Taken: dimmed */
.token-wrap.token-taken {
  opacity: 0.55;
}
.token-wrap.token-taken:hover {
  opacity: 0.75;
  background: rgba(231, 76, 60, 0.06);
}
.token-wrap.token-taken:hover .token-chip-svg {
  filter: brightness(1.1) drop-shadow(0 0 6px rgba(231,76,60,0.3));
}

/* Free token */
.token-wrap.token-free .token-chip-svg { filter: brightness(0.9); }
.token-wrap.token-free:hover .token-chip-svg { filter: brightness(1.05) drop-shadow(0 0 6px rgba(255,255,255,0.15)); }

.token-owner-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #bdc3c7;
  text-align: center;
  max-width: 82px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-height: 14px;
}

.token-legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 0.68rem;
  color: #7f8c8d;
  align-items: center;
}
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 3px; }
.dot-free  { background: #4a2020; }
.dot-mine  { background: #e74c3c; }
.dot-taken { background: #2a1a1a; }

/* Opponents */
.opponents-list { display: flex; flex-direction: column; gap: 6px; }
.opp-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #180d0d;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.04);
}
.opp-name { font-size: 0.9rem; font-weight: 600; color: #ecf0f1; }
.opp-token-badge {
  font-size: 0.78rem;
  color: #4a2020;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(255,255,255,0.03);
}
.opp-token-badge.has-token { color: #e74c3c; background: rgba(231, 76, 60, 0.1); font-weight: 700; }

/* ── LOG BAR ──────────────────────────────────── */
.logs-bar {
  background: #0a0505;
  padding: 7px 24px;
  border-top: 1px solid rgba(231, 76, 60, 0.08);
  flex-shrink: 0;
}
.log-latest {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e74c3c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* ── GLOBAL BUTTONS ──────────────────────────── */
.btn-primary {
  background: linear-gradient(135deg, #c0392b, #96281b);
  color: #fff;
  border: none;
  padding: 15px 32px;
  border-radius: 10px;
  font-family: 'Outfit', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s;
  text-transform: uppercase;
  letter-spacing: 1px;
  box-shadow: 0 4px 16px rgba(192, 57, 43, 0.35);
}
.btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #e74c3c, #c0392b); transform: translateY(-2px); box-shadow: 0 6px 22px rgba(192, 57, 43, 0.5); }
.btn-primary:disabled { background: #2a1515; color: #4a2020; cursor: not-allowed; box-shadow: none; }

.btn-secondary {
  background: #2a1515;
  color: #bdc3c7;
  border: 1px solid rgba(231, 76, 60, 0.2);
  padding: 10px 20px;
  border-radius: 8px;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  transition: 0.2s;
  font-weight: 600;
}
.btn-secondary:hover { border-color: rgba(231, 76, 60, 0.5); color: #ecf0f1; }

/* ══════════════════════════════════════════════
   GAME OVER SCREEN
══════════════════════════════════════════════ */
.game-over-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

.results-box {
  background: #180d0d;
  padding: 36px 28px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.6);
  max-width: 600px;
  width: 100%;
  border: 1px solid rgba(231, 76, 60, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  animation: fadeUp 0.4s ease;
}

@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.go-icon { font-size: 3.5rem; }
.results-box h2 { font-size: 2.5rem; font-weight: 900; margin: 0; }
.results-box.victory h2 { color: #e74c3c; }
.results-box.defeat  h2 { color: #95a5a6; }
.go-reason { font-size: 1rem; color: #bdc3c7; margin: 0; }

.go-scores { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.go-score-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 8px; font-size: 1rem; font-weight: 600; }
.go-score-item:not(.alarms) { background: rgba(231, 76, 60, 0.1); color: #e74c3c; }
.go-stars { font-size: 1.3rem; letter-spacing: 3px; }
.go-score-item.alarms { background: rgba(100, 30, 30, 0.08); color: #95a5a6; }

.go-final-hands { width: 100%; display: flex; flex-direction: column; gap: 0; text-align: left; }
.go-community { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-bottom: 14px; }
.go-comm-card { height: 66px; border-radius: 4px; }

.go-hand-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
}
.go-token {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 2px solid #e74c3c;
  color: #e74c3c;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.95rem; font-weight: 900; flex-shrink: 0;
}
.go-hand-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.go-player-name { font-size: 0.9rem; font-weight: 700; color: #ecf0f1; }
.go-hand-name { font-size: 0.78rem; color: #bdc3c7; }
.go-pocket-cards { display: flex; gap: 4px; }
.go-pocket-card { height: 52px; border-radius: 3px; }

.go-arrow { padding: 4px 14px; font-size: 0.72rem; font-weight: 700; text-align: center; letter-spacing: 0.5px; }
.go-arrow.ok  { color: #2ecc71; background: rgba(39, 174, 96, 0.06); }
.go-arrow.bad { color: #e74c3c; background: rgba(231, 76, 60, 0.06); }

.host-actions { margin-top: 8px; }

/* ══════════════════════════════════════════════
   RESPONSIVE
══════════════════════════════════════════════ */
@media (max-width: 768px) {
  .gang-board-wrapper { height: auto; }
  .playing-screen { height: auto; overflow: visible; }
  .main-content { flex-direction: column; overflow: visible; }
  .left-panel { border-right: none; border-bottom: 1px solid rgba(231, 76, 60, 0.1); overflow: visible; }
  .right-panel { width: 100%; min-width: 0; overflow: visible; }
  .top-bar { padding: 8px 14px; gap: 10px; }
  .top-bar h2 { font-size: 1.1rem; }
  .phase-label { display: none; }
  .comm-card-slot { width: 64px; height: 90px; }
  .comm-card { width: 64px; height: 90px; }
  .comm-card-placeholder { width: 64px; height: 90px; }
  .my-pocket-card { height: 110px; }
  .poker-table { padding: 14px 16px; }
  .tokens-grid { grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 6px; }
  .token-cell { height: 60px; }
  .token-number { font-size: 1.4rem; }
  .waiting-screen { padding: 28px 16px; gap: 18px; }
  .waiting-screen h1 { font-size: 2rem; }
}

@media (min-width: 1200px) {
  .comm-card-slot { width: 100px; height: 140px; }
  .comm-card { width: 100px; height: 140px; }
  .comm-card-placeholder { width: 100px; height: 140px; }
  .my-pocket-card { height: 168px; }
  .right-panel { width: 320px; }
}
</style>
