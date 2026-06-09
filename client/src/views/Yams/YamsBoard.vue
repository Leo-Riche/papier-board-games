<template>
  <div class="yams-board-wrapper">
    <!-- ============ WAITING SCREEN ============ -->
    <div v-if="gameStatus === 'waiting'" class="waiting-screen">
      <h1>En attente de la partie...</h1>
      <div class="share-box">
        <p>Partage ce code avec tes amis : <strong>{{ roomCode }}</strong></p>
        <button class="btn-secondary" @click="copyLink">📋 Copier le lien d'invitation</button>
      </div>
      <ul class="player-list">
        <li v-for="p in allConnectedPlayers" :key="p.id">👤 {{ p.name }}</li>
      </ul>
      <button v-if="amIHost" class="btn-primary" @click="startGame">
        LANCER LA PARTIE
      </button>
      <p v-else class="waiting-msg">En attente du chef de salle...</p>
    </div>

    <!-- ============ PLAYING SCREEN ============ -->
    <div v-else-if="gameStatus === 'playing'" class="playing-screen">
      
      <!-- Top Bar (compact) -->
      <div class="top-bar">
        <h2>YAMS 🎲</h2>
        <p class="turn-indicator">
          <span v-if="isActivePlayer">⭐️ C'est ton tour !</span>
          <span v-else>Tour de <strong>{{ activePlayerName }}</strong></span>
        </p>
        <span v-if="isActivePlayer" class="rolls-badge" :class="{ empty: rollsLeft === 0 }">
          {{ rollsLeft }}/3 lancers
        </span>
      </div>

      <!-- Main 2-panel layout -->
      <div class="main-content">

        <!-- LEFT PANEL: Dice + Actions + Opponents -->
        <div class="left-panel">
          <!-- Dice Tray -->
          <div class="dice-tray">
            <div 
              v-for="(die, idx) in dice" 
              :key="idx"
              class="die-container"
              @click="toggleLock(idx)"
              :class="{ locked: die.locked, clickable: canToggleLock }"
            >
              <div class="die" :class="{ 'die-roll': animatingDice, locked: die.locked }">
                <div class="die-face">
                  <div class="dot-pattern" :class="'dots-' + die.value">
                    <span v-for="n in die.value" :key="n" class="dot"></span>
                  </div>
                </div>
              </div>
              <div v-if="die.locked" class="lock-badge">🔒</div>
            </div>
          </div>

          <!-- Roll Button -->
          <div class="roll-actions">
            <button 
              v-if="isActivePlayer && rollsLeft > 0" 
              class="btn-roll" 
              @click="rollDice"
            >
              <span v-if="rollsLeft === 3">LANCER 🎲</span>
              <span v-else>RELANCER ({{ rollsLeft }}/3) 🎲</span>
            </button>
            <p v-else-if="isActivePlayer && rollsLeft === 0" class="hint-msg">👆 Choisis une catégorie</p>
            <p v-else class="wait-msg">En attente de {{ activePlayerName }}...</p>
          </div>

          <!-- Opponents (compact) -->
          <div class="opponents-section" v-if="opponents.length > 0">
            <h4>Adversaires</h4>
            <div v-for="opp in opponents" :key="opp.id" class="opp-row" @click="toggleOpponentDetail(opp.id)">
              <div class="opp-summary">
                <span class="opp-name">{{ opp.name }}</span>
                <span class="opp-score">{{ opp.totalScore }} pts</span>
                <span v-if="opp.hasBonus" class="opp-bonus-tag">+35</span>
                <span class="opp-expand">{{ expandedOpponents.includes(opp.id) ? '▲' : '▼' }}</span>
              </div>
              <div v-if="expandedOpponents.includes(opp.id)" class="opp-detail" @click.stop>
                <div class="opp-detail-grid">
                  <div class="opp-col">
                    <div v-for="cat in upperCategories" :key="cat.key" class="opp-cat" :class="{ scored: opp.scoreSheet[cat.key] !== null }">
                      <span>{{ cat.icon }} {{ cat.shortLabel }}</span>
                      <span>{{ opp.scoreSheet[cat.key] !== null ? opp.scoreSheet[cat.key] : '—' }}</span>
                    </div>
                  </div>
                  <div class="opp-col">
                    <div v-for="cat in lowerCategories" :key="cat.key" class="opp-cat" :class="{ scored: opp.scoreSheet[cat.key] !== null }">
                      <span>{{ cat.icon }} {{ cat.shortLabel }}</span>
                      <span>{{ opp.scoreSheet[cat.key] !== null ? opp.scoreSheet[cat.key] : '—' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT PANEL: Score Sheet (2 columns) -->
        <div class="right-panel">
          <div class="score-sheet-container">
            <div class="sheet-header">
              <span class="sheet-title">Ma feuille de score</span>
              <span class="sheet-total">Total : <strong>{{ myTotalScore }}</strong></span>
            </div>

            <div class="sheet-grid">
              <!-- Upper Section Column -->
              <div class="sheet-col">
                <div class="col-header">Section Haute</div>
                <div 
                  v-for="cat in upperCategories" 
                  :key="cat.key"
                  class="score-cell"
                  :class="{ 
                    scored: myScoreSheet[cat.key] !== null, 
                    available: canScore(cat.key),
                    zero: canScore(cat.key) && previewScores[cat.key] === 0
                  }"
                  @click="scoreCategory(cat.key)"
                >
                  <span class="cell-label">{{ cat.icon }} {{ cat.label }}</span>
                  <span class="cell-value">
                    <span v-if="myScoreSheet[cat.key] !== null" class="final">{{ myScoreSheet[cat.key] }}</span>
                    <span v-else-if="canScore(cat.key)" class="preview">{{ previewScores[cat.key] }}</span>
                    <span v-else class="empty">—</span>
                  </span>
                </div>
                <!-- Subtotal + Bonus -->
                <div class="subtotal-cell">
                  <span>Sous-total</span>
                  <span>{{ myUpperTotal }} / 63</span>
                </div>
                <div class="bonus-cell" :class="{ earned: myHasBonus }">
                  <span>🏆 Bonus</span>
                  <span>{{ myHasBonus ? '+35' : '—' }}</span>
                </div>
              </div>

              <!-- Lower Section Column -->
              <div class="sheet-col">
                <div class="col-header">Section Basse</div>
                <div 
                  v-for="cat in lowerCategories" 
                  :key="cat.key"
                  class="score-cell"
                  :class="{ 
                    scored: myScoreSheet[cat.key] !== null, 
                    available: canScore(cat.key),
                    zero: canScore(cat.key) && previewScores[cat.key] === 0
                  }"
                  @click="scoreCategory(cat.key)"
                >
                  <span class="cell-label">{{ cat.icon }} {{ cat.label }}</span>
                  <span class="cell-value">
                    <span v-if="myScoreSheet[cat.key] !== null" class="final">{{ myScoreSheet[cat.key] }}</span>
                    <span v-else-if="canScore(cat.key)" class="preview">{{ previewScores[cat.key] }}</span>
                    <span v-else class="empty">—</span>
                  </span>
                </div>
                <!-- Total -->
                <div class="total-cell">
                  <span>TOTAL</span>
                  <span>{{ myTotalScore }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Logs (single line) -->
      <div class="logs-bar" v-if="gameLogs.length > 0">
        <span class="log-latest">{{ gameLogs[0] }}</span>
      </div>
    </div>

    <!-- ============ GAME OVER SCREEN ============ -->
    <div v-else-if="gameStatus === 'finished'" class="game-over-screen">
      <div class="results-box">
        <h2>🏆 Partie Terminée !</h2>
        <p class="reason">{{ winReason }}</p>

        <div class="scoreboard">
          <div v-for="(p, index) in finalPlayers" :key="p.id" class="score-line" :class="{ first: index===0 }">
            <span class="rank">#{{ index + 1 }}</span>
            <span class="name">{{ p.name }}</span>
            <span class="score-detail">
              <span v-if="p.hasBonus" class="bonus-tag">+35</span>
              {{ p.score }} pts
            </span>
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

// Waiting
const allConnectedPlayers = ref([])
const amIHost = ref(false)

// Game
const gameStatus = ref('waiting')
const dice = ref([
  { value: 1, locked: false },
  { value: 1, locked: false },
  { value: 1, locked: false },
  { value: 1, locked: false },
  { value: 1, locked: false }
])
const rollsLeft = ref(3)
const players = ref([])
const activePlayerId = ref(null)
const myId = ref(null)
const gameLogs = ref([])
const animatingDice = ref(false)
const expandedOpponents = ref([])

// End Game
const winReason = ref('')
const finalPlayers = ref([])

// ============ CATEGORIES ============

const upperCategories = [
  { key: 'ones', label: 'As', shortLabel: 'As', icon: '⚀' },
  { key: 'twos', label: 'Deux', shortLabel: 'Deux', icon: '⚁' },
  { key: 'threes', label: 'Trois', shortLabel: 'Trois', icon: '⚂' },
  { key: 'fours', label: 'Quatre', shortLabel: 'Quatre', icon: '⚃' },
  { key: 'fives', label: 'Cinq', shortLabel: 'Cinq', icon: '⚄' },
  { key: 'sixes', label: 'Six', shortLabel: 'Six', icon: '⚅' }
]

const lowerCategories = [
  { key: 'threeOfAKind', label: 'Brelan', shortLabel: 'Brelan', icon: '🎯' },
  { key: 'fourOfAKind', label: 'Carré', shortLabel: 'Carré', icon: '💎' },
  { key: 'fullHouse', label: 'Full', shortLabel: 'Full', icon: '🏠' },
  { key: 'smallStraight', label: 'P. Suite', shortLabel: 'P. Suite', icon: '📐' },
  { key: 'largeStraight', label: 'G. Suite', shortLabel: 'G. Suite', icon: '📏' },
  { key: 'yams', label: 'Yams !', shortLabel: 'Yams', icon: '🎲' },
  { key: 'chance', label: 'Chance', shortLabel: 'Chance', icon: '🍀' }
]

const allCategories = [...upperCategories, ...lowerCategories]

// ============ COMPUTED ============

const myPlayer = computed(() => players.value.find(p => p.id === myId.value))
const myScoreSheet = computed(() => myPlayer.value ? myPlayer.value.scoreSheet : {})
const myTotalScore = computed(() => myPlayer.value ? myPlayer.value.totalScore : 0)
const myUpperTotal = computed(() => myPlayer.value ? myPlayer.value.upperTotal : 0)
const myHasBonus = computed(() => myPlayer.value ? myPlayer.value.hasBonus : false)

const myName = computed(() => {
  const me = myPlayer.value || allConnectedPlayers.value.find(p => p.id === socket.id);
  return me ? me.name : '';
})

const opponents = computed(() => players.value.filter(p => p.id !== myId.value))

const isActivePlayer = computed(() => myId.value === activePlayerId.value)

const activePlayerName = computed(() => {
  const p = players.value.find(p => p.id === activePlayerId.value);
  return p ? p.name : '';
})

const canToggleLock = computed(() => {
  return isActivePlayer.value && rollsLeft.value > 0 && rollsLeft.value < 3;
})

// Preview scores for each unscored category
const previewScores = computed(() => {
  if (!isActivePlayer.value || rollsLeft.value === 3) return {};
  
  const diceValues = dice.value.map(d => d.value);
  const previews = {};
  
  for (const cat of allCategories) {
    if (myScoreSheet.value[cat.key] === null) {
      previews[cat.key] = calculatePreviewScore(diceValues, cat.key);
    }
  }
  
  return previews;
})

// ============ METHODS ============

function calculatePreviewScore(diceVals, category) {
  const counts = [0, 0, 0, 0, 0, 0];
  diceVals.forEach(v => counts[v - 1]++);
  const sum = diceVals.reduce((a, b) => a + b, 0);

  switch (category) {
    case 'ones': return counts[0] * 1;
    case 'twos': return counts[1] * 2;
    case 'threes': return counts[2] * 3;
    case 'fours': return counts[3] * 4;
    case 'fives': return counts[4] * 5;
    case 'sixes': return counts[5] * 6;
    case 'threeOfAKind': return counts.some(c => c >= 3) ? sum : 0;
    case 'fourOfAKind': return counts.some(c => c >= 4) ? sum : 0;
    case 'fullHouse': return (counts.includes(3) && counts.includes(2)) ? 25 : 0;
    case 'smallStraight': {
      const unique = [...new Set(diceVals)].sort((a, b) => a - b);
      const straights = [[1,2,3,4], [2,3,4,5], [3,4,5,6]];
      return straights.some(s => s.every(v => unique.includes(v))) ? 30 : 0;
    }
    case 'largeStraight': {
      const sorted = [...diceVals].sort((a, b) => a - b);
      const isLarge = (sorted[0]===1 && sorted[1]===2 && sorted[2]===3 && sorted[3]===4 && sorted[4]===5) ||
                      (sorted[0]===2 && sorted[1]===3 && sorted[2]===4 && sorted[3]===5 && sorted[4]===6);
      return isLarge ? 40 : 0;
    }
    case 'yams': return counts.some(c => c === 5) ? 50 : 0;
    case 'chance': return sum;
    default: return 0;
  }
}

function canScore(categoryKey) {
  return isActivePlayer.value && rollsLeft.value < 3 && myScoreSheet.value[categoryKey] === null;
}

function scoreCategory(categoryKey) {
  if (!canScore(categoryKey)) return;
  
  socket.emit('yams_action', {
    roomCode,
    actionType: 'score',
    payload: { category: categoryKey }
  });
}

function toggleLock(index) {
  if (!canToggleLock.value) return;
  
  socket.emit('yams_action', {
    roomCode,
    actionType: 'toggle_lock',
    payload: { index }
  });
}

function toggleOpponentDetail(oppId) {
  const index = expandedOpponents.value.indexOf(oppId);
  if (index > -1) {
    expandedOpponents.value.splice(index, 1);
  } else {
    expandedOpponents.value.push(oppId);
  }
}

function rollDice() {
  socket.emit('yams_action', { roomCode, actionType: 'roll' });
}

function startGame() {
  socket.emit('start_yams', roomCode);
}

function copyLink() {
  const link = `${window.location.origin}/yams/join/${roomCode}`;
  navigator.clipboard.writeText(link).then(() => {
    alert("Lien d'invitation copié dans le presse-papier !");
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
}

// ============ SOCKET EVENTS ============

onMounted(() => {
  socket.on('connect', () => {
    const savedName = localStorage.getItem('temp_player_name');
    if (savedName) socket.emit('set_player_name', { name: savedName, roomCode });
    else socket.emit('join_room', roomCode);
  });

  socket.on('room_full', (message) => {
    alert(message);
    socket.disconnect();
    router.push('/');
  });

  socket.on('update_players_list', (pls) => {
    allConnectedPlayers.value = pls;
    const me = pls.find(p => p.id === socket.id);
    if (me) {
      amIHost.value = me.isHost;
      myId.value = me.id;
    }
  });

  socket.on('name_set', () => {
    // waiting for update_players_list
  });

  socket.on('game_started', () => { 
    gameStatus.value = 'playing';
    gameLogs.value = [];
  });

  socket.on('update_board_state', (data) => {
    if (data.status !== 'finished') {
      gameStatus.value = 'playing';
    }

    // Detect dice change for animation
    const oldRolls = rollsLeft.value;
    if (data.rollsLeft < oldRolls && oldRolls <= 3) {
      animatingDice.value = true;
      setTimeout(() => { animatingDice.value = false; }, 600);
    }

    dice.value = data.dice;
    rollsLeft.value = data.rollsLeft;
    players.value = data.players;
    activePlayerId.value = data.activePlayerId;
    myId.value = data.myId;
  });

  socket.on('action_log', (msg) => { 
    gameLogs.value.unshift(msg);
    if(gameLogs.value.length > 5) gameLogs.value.pop();
  });

  socket.on('game_over', (data) => {
    gameStatus.value = 'finished';
    winReason.value = data.reason;
    finalPlayers.value = data.players;
  });
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

/* ============ BASE ============ */
.yams-board-wrapper {
  height: 100vh; background: #0f1a0f; color: #ecf0f1; font-family: 'Outfit', sans-serif;
  display: flex; flex-direction: column; overflow: hidden;
}

/* ============ WAITING & GAME OVER ============ */
.waiting-screen, .game-over-screen {
  flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;
  padding: 20px; overflow-y: auto;
}
.waiting-screen h1 { font-size: 2.5rem; color: #d4af37; margin-bottom: 20px; }
.waiting-msg { font-size: 1.1rem; color: #7a9a7a; font-style: italic; }
.share-box { background: #1a2e1a; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(212, 175, 55, 0.15); }
.share-box p { margin-bottom: 15px; font-size: 1.2rem; color: #bdc3c7; }
.share-box strong { color: #d4af37; font-size: 1.5rem; }
.btn-secondary { background: #243524; color: #ecf0f1; border: 1px solid #7a9a7a; padding: 10px 20px; border-radius: 8px; font-family: 'Outfit', sans-serif; cursor: pointer; transition: 0.2s; font-weight: bold; }
.btn-secondary:hover { background: #2d4a2d; border-color: #d4af37; }
.player-list { list-style: none; padding: 0; margin: 20px 0; font-size: 1.2rem; display: flex; flex-direction: column; gap: 10px; }

/* ============ PLAYING SCREEN ============ */
.playing-screen { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* ============ TOP BAR ============ */
.top-bar { 
  display: flex; align-items: center; gap: 20px;
  background: linear-gradient(180deg, #1a2e1a 0%, #152615 100%); 
  padding: 10px 24px; 
  border-bottom: 1px solid rgba(212, 175, 55, 0.15); 
  flex-shrink: 0;
}
.top-bar h2 { font-size: 1.4rem; font-weight: 900; margin: 0; color: #d4af37; white-space: nowrap; }
.turn-indicator { font-size: 0.95rem; color: #bdc3c7; margin: 0; flex: 1; }
.turn-indicator span { display: inline-flex; align-items: center; gap: 5px; }

.rolls-badge {
  background: linear-gradient(135deg, #d4af37, #b8962e); color: #1a1a1a;
  padding: 5px 14px; border-radius: 15px; font-weight: 700; font-size: 0.85rem;
  letter-spacing: 0.5px; white-space: nowrap; flex-shrink: 0;
}
.rolls-badge.empty { background: #3a1a1a; color: #e74c3c; }

/* ============ MAIN 2-PANEL LAYOUT ============ */
.main-content { display: flex; flex: 1; overflow: hidden; min-height: 0; position: relative; }

/* ============ LEFT PANEL ============ */
.left-panel {
  width: 360px; min-width: 300px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 12px;
  padding: 14px; overflow-y: auto;
  background: #121f12; border-right: 1px solid rgba(212, 175, 55, 0.1);
}

/* Dice Tray */
.dice-tray {
  display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
  padding: 18px 22px; background: #1a2e1a; border-radius: 14px;
  border: 2px dashed rgba(212, 175, 55, 0.15);
  margin: 0 auto; /* center horizontally */
  max-width: 420px;
  z-index: 2;
  align-self: center; /* center within flex column */
  order: 1;
}

.die-container { position: relative; cursor: default; transition: transform 0.15s; }
.die-container.clickable { cursor: pointer; }
.die-container.clickable:hover { transform: translateY(-3px); }
.die-container.locked { transform: translateY(-4px); }

.die {
  width: 72px; height: 72px; border-radius: 12px; 
  background: linear-gradient(145deg, #ffffff, #e8e8e8);
  box-shadow: 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}

.die.locked {
  background: linear-gradient(145deg, #f5d670, #d4af37);
  box-shadow: 0 4px 15px rgba(212, 175, 55, 0.5), inset 0 1px 0 rgba(255,255,255,0.4);
}

.lock-badge {
  position: absolute; bottom: -4px; right: -4px;
  font-size: 0.7rem; background: #1a1a1a; border-radius: 50%;
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  border: 2px solid #d4af37;
}

/* Dot patterns */
.die-face { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.dot-pattern { display: grid; width: 46px; height: 46px; padding: 3px; }
.dot {
  width: 12px; height: 12px; background: #1a1a1a; border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
}
.die.locked .dot { background: #1a1a1a; }

.dots-1 { grid-template: 1fr / 1fr; place-items: center; }
.dots-2 { grid-template: 1fr 1fr / 1fr; }
.dots-2 .dot:nth-child(1) { justify-self: end; align-self: start; }
.dots-2 .dot:nth-child(2) { justify-self: start; align-self: end; }
.dots-3 { grid-template: 1fr 1fr 1fr / 1fr; }
.dots-3 .dot:nth-child(1) { justify-self: end; align-self: start; }
.dots-3 .dot:nth-child(2) { justify-self: center; align-self: center; }
.dots-3 .dot:nth-child(3) { justify-self: start; align-self: end; }
.dots-4 { grid-template: 1fr 1fr / 1fr 1fr; place-items: center; }
.dots-5 { grid-template: 1fr 1fr 1fr / 1fr 1fr 1fr; place-items: center; }
.dots-5 .dot:nth-child(1) { grid-area: 1 / 1; }
.dots-5 .dot:nth-child(2) { grid-area: 1 / 3; }
.dots-5 .dot:nth-child(3) { grid-area: 2 / 2; }
.dots-5 .dot:nth-child(4) { grid-area: 3 / 1; }
.dots-5 .dot:nth-child(5) { grid-area: 3 / 3; }
.dots-6 { grid-template: 1fr 1fr 1fr / 1fr 1fr; place-items: center; }

.die-roll { animation: diceRoll 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94); }

@keyframes diceRoll {
  0% { transform: translateY(0) rotate(0deg) scale(1); }
  15% { transform: translateY(-20px) rotate(60deg) scale(1.08); }
  30% { transform: translateY(-10px) rotate(120deg) scale(1.04); }
  50% { transform: translateY(-15px) rotate(200deg) scale(1.06); }
  70% { transform: translateY(-6px) rotate(300deg) scale(1.02); }
  85% { transform: translateY(-2px) rotate(340deg) scale(1); }
  100% { transform: translateY(0) rotate(360deg) scale(1); }
}

/* Desktop: position dice tray centered in the main content area */
@media (min-width: 769px) {
  .dice-tray {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
  }
  .left-panel { align-items: flex-start; }
  .roll-actions {
    position: absolute;
    left: 50%;
    top: calc(50% + 70px);
    transform: translateX(-50%);
    margin-top: 0;
    order: initial;
    width: auto;
    z-index: 3;
  }
  .btn-roll {
    width: 4600px;
  }
}

.btn-roll {
  width: 100%; padding: 18px; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 700;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px;
  background: linear-gradient(135deg, #2ecc71, #27ae60); color: white;
  box-shadow: 0 3px 10px rgba(46, 204, 113, 0.3);
}
.btn-roll:hover { 
  background: linear-gradient(135deg, #3ddc84, #2ecc71); 
  transform: translateY(-1px); box-shadow: 0 5px 15px rgba(46, 204, 113, 0.4); 
}

.wait-msg { font-size: 0.9rem; color: #7a9a7a; font-weight: 600; font-style: italic; text-align: center; margin: 0; }
.hint-msg { font-size: 0.9rem; color: #d4af37; font-weight: 600; text-align: center; margin: 0; animation: pulse 2s infinite; }

/* Opponents */
.opponents-section { flex: 0 1 auto; min-height: 0; overflow-y: auto; width: 100%; }
.opponents-section h4 { 
  font-size: 0.8rem; color: #7a9a7a; text-transform: uppercase; letter-spacing: 2px; 
  margin: 0 0 8px 0; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); 
}

.opp-row {
  background: #1a2e1a; border-radius: 8px; margin-bottom: 6px;
  border: 1px solid rgba(212, 175, 55, 0.08); cursor: pointer;
  transition: 0.15s;
}
.opp-row:hover { border-color: rgba(212, 175, 55, 0.25); }

.opp-summary { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
.opp-name { font-weight: 700; font-size: 1.05rem; flex: 1; }
.opp-score { font-weight: 900; color: #d4af37; font-size: 1.1rem; }
.opp-bonus-tag { background: #2ecc71; color: white; padding: 2px 8px; border-radius: 8px; font-size: 0.85rem; font-weight: 800; }
.opp-expand { font-size: 0.65rem; color: #7a9a7a; }

.opp-detail {
  padding: 8px 14px 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.opp-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; width: 100%; }
.opp-cat { display: flex; justify-content: space-between; font-size: 0.95rem; color: #6b8b6b; padding: 2px 0; }
.opp-cat.scored { color: #e0e6e3; }

.opp-col { display: flex; flex-direction: column; gap: 2px; }

/* ============ RIGHT PANEL: SCORE SHEET ============ */
.right-panel {
  flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column;
}

.score-sheet-container {
  flex: 1; background: #1a2e1a; border-radius: 12px; padding: 12px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  display: flex; flex-direction: column;
  max-width: 760px; /* slightly larger so sheet appears a bit bigger */
  margin: 0 0 0 auto; /* keep it aligned to the right panel but constrained */
}

.sheet-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 10px; margin-bottom: 10px;
  border-bottom: 2px solid rgba(212, 175, 55, 0.2);
}
.sheet-title { color: #d4af37; font-size: 1.15rem; font-weight: 700; }
.sheet-total { color: #ecf0f1; font-size: 1.05rem; }
.sheet-total strong { color: #d4af37; font-size: 1.35rem; }

/* 2-Column Grid */
.sheet-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px;
  flex: 1;
}

.sheet-col { display: flex; flex-direction: column; }

.col-header {
  font-size: 0.85rem; font-weight: 900; color: #d4af37; text-transform: uppercase;
  letter-spacing: 2px; padding: 6px 10px; margin-bottom: 4px;
  background: rgba(212, 175, 55, 0.06); border-radius: 6px;
}

/* Score Cells */
.score-cell {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 8px; border-radius: 6px; margin-bottom: 2px;
  transition: all 0.12s;
}

.score-cell.available {
  cursor: pointer; background: rgba(212, 175, 55, 0.04);
}
.score-cell.available:hover {
  background: rgba(212, 175, 55, 0.15);
  transform: scale(1.015);
  box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.3);
}
.score-cell.available.zero:hover {
  background: rgba(231, 76, 60, 0.1);
  box-shadow: 0 0 0 1px rgba(231, 76, 60, 0.3);
}

.score-cell.scored { opacity: 0.55; }

.cell-label { 
  font-weight: 600; font-size: 1.05rem;
  display: flex; align-items: center; gap: 6px;
}

.cell-value { font-weight: 800; font-size: 1.12rem; min-width: 38px; text-align: right; }
.cell-value .final { color: #ecf0f1; }
.cell-value .preview { color: #d4af37; opacity: 0.75; font-style: italic; }
.cell-value .empty { color: #2d4a2d; }

/* Subtotal, Bonus, Total */
.subtotal-cell, .bonus-cell, .total-cell {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 10px; margin-top: 4px;
}


.subtotal-cell {
  font-size: 0.98rem; font-weight: 800; color: #7a9a7a;
  border-top: 1px solid rgba(212, 175, 55, 0.14);
}

.bonus-cell {
  font-size: 0.9rem; font-weight: 800; color: #3a5a3a;
}
.bonus-cell.earned { color: #2ecc71; }

.total-cell {
  font-size: 1.22rem; font-weight: 900; color: #d4af37;
  border-top: 2px solid #d4af37; margin-top: auto;
  background: rgba(212, 175, 55, 0.06); border-radius: 6px;
  padding: 10px 12px;
}

/* ============ LOGS BAR ============ */
.logs-bar { 
  background: #0a120a; padding: 6px 24px; text-align: center;
  border-top: 1px solid rgba(212, 175, 55, 0.08); flex-shrink: 0;
}
.log-latest { 
  font-size: 0.85rem; font-weight: 600; color: #d4af37;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: block;
}

/* ============ BUTTONS ============ */
.btn-primary { 
  background: linear-gradient(135deg, #d4af37, #b8962e); color: #1a1a1a; border: none; 
  padding: 15px 30px; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: 0.2s;
  text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
}
.btn-primary:hover { 
  background: linear-gradient(135deg, #f5d670, #d4af37); 
  transform: translateY(-2px); box-shadow: 0 6px 20px rgba(212, 175, 55, 0.5); 
}

/* ============ GAME OVER ============ */
.results-box { 
  background: #1a2e1a; padding: 40px; border-radius: 20px; 
  box-shadow: 0 10px 40px rgba(0,0,0,0.5); max-width: 600px; width: 100%; 
  border: 1px solid rgba(212, 175, 55, 0.2); 
}
.results-box h2 { font-size: 3rem; margin-bottom: 10px; color: #d4af37; }
.results-box .reason { font-size: 1.2rem; color: #bdc3c7; margin-bottom: 30px; }

.score-line { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 1.2rem; color: #ecf0f1; }
.score-line.first { background: rgba(212, 175, 55, 0.15); font-weight: 900; color: #d4af37; border-radius: 10px; border: 1px solid rgba(212, 175, 55, 0.3); font-size: 1.5rem; }
.score-line .rank { min-width: 40px; }
.score-line .name { flex: 1; }
.score-detail { font-weight: 700; display: flex; align-items: center; gap: 8px; }
.bonus-tag { background: #2ecc71; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; }
.host-actions { margin-top: 30px; }

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

/* ============ RESPONSIVE ============ */
@media (max-width: 768px) {
  .yams-board-wrapper { height: auto; min-height: 100vh; overflow-y: auto; }
  .playing-screen { height: auto; min-height: 100vh; overflow: visible; }
  .main-content { flex-direction: column; overflow: visible; }
  .left-panel { 
    width: 100%; min-width: 0; border-right: none; 
    border-bottom: 1px solid rgba(212, 175, 55, 0.1);
    overflow: visible;
  }
  .right-panel { overflow: visible; }
  .dice-tray { gap: 8px; padding: 10px; }
  .die { width: 62px; height: 62px; }
  .dot-pattern { width: 40px; height: 40px; }
  .dot { width: 11px; height: 11px; }
  .top-bar { padding: 8px 16px; gap: 12px; flex-wrap: wrap; }
  .top-bar h2 { font-size: 1.2rem; }
  .sheet-grid { gap: 0 12px; }
  .score-cell { padding: 5px 8px; }
  .cell-label { font-size: 0.95rem; }
  .cell-value { font-size: 1rem; }

  .waiting-screen h1 { font-size: 1.8rem; }
  .results-box { padding: 20px; }
  .results-box h2 { font-size: 2rem; }
  .score-line { font-size: 1rem; padding: 10px; }
  .score-line.first { font-size: 1.2rem; }
}
</style>
