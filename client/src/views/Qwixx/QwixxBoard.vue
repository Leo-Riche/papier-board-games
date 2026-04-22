<template>
  <div class="qwixx-board-wrapper">
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
      <p v-else>En attente du chef de salle...</p>
    </div>

    <div v-else-if="gameStatus === 'playing'" class="playing-screen">
      
      <!-- Top Bar: Game Info & Dice -->
      <div class="top-bar">
        <div class="game-info">
          <h2>QWIXX 🎲</h2>
          <p class="turn-indicator">
            <span v-if="isActivePlayer">⭐️ C'est ton tour !</span>
            <span v-else>C'est au tour de <strong>{{ activePlayerName }}</strong></span>
          </p>
        </div>

        <div class="dice-area" v-if="phase === 'deciding'">
          <div class="die w" :class="{ 'die-roll': animatingDice }">{{ dice.w1 }}</div>
          <div class="die w" :class="{ 'die-roll': animatingDice }">{{ dice.w2 }}</div>
          <div class="die r" :class="{ 'die-roll': animatingDice, hidden: dice.red === 0 }">{{ dice.red !== 0 ? dice.red : '' }}</div>
          <div class="die y" :class="{ 'die-roll': animatingDice, hidden: dice.yellow === 0 }">{{ dice.yellow !== 0 ? dice.yellow : '' }}</div>
          <div class="die g" :class="{ 'die-roll': animatingDice, hidden: dice.green === 0 }">{{ dice.green !== 0 ? dice.green : '' }}</div>
          <div class="die b" :class="{ 'die-roll': animatingDice, hidden: dice.blue === 0 }">{{ dice.blue !== 0 ? dice.blue : '' }}</div>
        </div>
      </div>

      <div class="main-content">
        <!-- Main Player Grid -->
        <div class="my-area">
          <QwixxScoreSheet
            :playerName="myName"
            :scoreSheet="myScoreSheet"
            :lockedColors="lockedColors"
            :readOnly="phase !== 'deciding' || hasSubmittedTurn"
            :dice="dice"
            :isActivePlayer="isActivePlayer"
            :selectedCells="selectedCells"
            :isMainPlayer="true"
            @toggle-cell="onToggleCell"
          />

          <!-- Action Buttons -->
          <div class="action-panel" v-if="phase === 'deciding' && !hasSubmittedTurn">
            <button class="btn-action submit" @click="submitTurn(false)">
              <span v-if="selectedCells.length > 0">VALIDER MON CHOIX ({{ selectedCells.length }})</span>
              <span v-else>PASSER MON TOUR</span>
            </button>
            <button v-if="isActivePlayer && selectedCells.length === 0" class="btn-action penalty" @click="submitTurn(true)">
              PRENDRE UNE PÉNALITÉ (-5)
            </button>
          </div>
          <div class="action-panel status" v-else-if="phase === 'deciding' && hasSubmittedTurn">
            <p>En attente des autres joueurs...</p>
          </div>
          <div class="action-panel" v-else>
             <button v-if="isActivePlayer" class="btn-action giant" @click="rollDice">TIRER LES DÉS 🎲</button>
             <p v-else style="font-size: 1.2rem; color: #bdc3c7; font-weight: 700;">En attente du lancer de dés...</p>
          </div>
        </div>

        <!-- Sidebar: Opponents -->
        <div class="opponents-sidebar" :class="{ 'multi-col': opponents.length >= 4 }">
           <h3>Adversaires</h3>
           <QwixxScoreSheet
              v-for="opp in opponents"
              :key="opp.id"
              :playerName="opp.name + (readyPlayers.includes(opp.name) ? ' ✅' : '')"
              :scoreSheet="opp.scoreSheet"
              :lockedColors="lockedColors"
              :readOnly="true"
              :class="{ 'compact-mode': opponents.length >= 4 }"
           />
        </div>
      </div>

      <!-- Live Logs -->
      <div class="logs-container">
        <ul>
          <li v-for="(log, idx) in gameLogs" :key="idx">{{ log }}</li>
        </ul>
      </div>

    </div>

    <!-- Game Over Screen -->
    <div v-else-if="gameStatus === 'finished'" class="game-over-screen">
      <div class="results-box">
        <h2>Partie Terminée !</h2>
        <p class="reason">{{ winReason }}</p>

        <div class="scoreboard">
          <div v-for="(p, index) in finalPlayers" :key="p.id" class="score-line" :class="{ first: index===0 }">
             <span class="rank">#{{ index + 1 }}</span>
             <span class="name">{{ p.name }}</span>
             <span class="score">{{ p.score }} pts</span>
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
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import QwixxScoreSheet from '@/components/QwixxScoreSheet.vue'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

// Waiting Room State
const allConnectedPlayers = ref([])
const amIHost = ref(false)

// Game State
const gameStatus = ref('waiting')
const phase = ref('rolling')
const dice = ref({ w1:0, w2:0, red:0, yellow:0, green:0, blue:0 })
const lockedColors = ref({ red:false, yellow:false, green:false, blue:false })
const players = ref([])
const activePlayerId = ref(null)
const readyPlayers = ref([])
const myId = ref(null)

const gameLogs = ref([])
const animatingDice = ref(false)
const selectedCells = ref([])

// End Game
const winReason = ref('')
const finalPlayers = ref([])

// Computed
const myName = computed(() => {
  const me = players.value.find(p => p.id === myId.value) || allConnectedPlayers.value.find(p => p.id === socket.id);
  return me ? me.name : '';
})

const myScoreSheet = computed(() => {
  const me = players.value.find(p => p.id === myId.value);
  return me ? me.scoreSheet : null;
})

const opponents = computed(() => {
  return players.value.filter(p => p.id !== myId.value);
})

const isActivePlayer = computed(() => {
  return myId.value === activePlayerId.value;
})

const activePlayerName = computed(() => {
  const p = players.value.find(p => p.id === activePlayerId.value);
  return p ? p.name : '';
})

const hasSubmittedTurn = computed(() => {
  return readyPlayers.value.includes(myName.value);
})

// Validation Logic for Selected Cells
const onToggleCell = ({ color, value }) => {
  // Check if cell is already selected
  const existingIdx = selectedCells.value.findIndex(c => c.color === color && c.value === value);
  if (existingIdx !== -1) {
    selectedCells.value.splice(existingIdx, 1);
    return;
  }

  // Determine allowed max selections
  const maxSelections = isActivePlayer.value ? 2 : 1;
  if (selectedCells.value.length >= maxSelections) {
    // Cannot select more. Maybe we could swap them, but for simplicity, do nothing or alert.
    return;
  }

  // Validation if it's a valid white sum or color sum
  const wSum = dice.value.w1 + dice.value.w2;
  const isWhiteValid = value === wSum;
  
  const cSum1 = dice.value.w1 + dice.value[color];
  const cSum2 = dice.value.w2 + dice.value[color];
  const isColorValid = value === cSum1 || value === cSum2;

  // We need to assign source: 'white' or 'color'.
  // If we only have 1 slot (non-active player), it MUST be white.
  if (!isActivePlayer.value) {
     if (isWhiteValid) {
        selectedCells.value.push({ color, value, source: 'white' });
     }
     return;
  }

  // Active player logic
  if (selectedCells.value.length === 0) {
    // First cell clicked. If it works as white, mark white (optimistic). Else color.
    if (isWhiteValid) selectedCells.value.push({ color, value, source: 'white' });
    else if (isColorValid) selectedCells.value.push({ color, value, source: 'color' });
  } else {
    // Second cell clicked. We must fulfill the constraint: ONE white, ONE color.
    const c1 = selectedCells.value[0];
    const c2 = { color, value };
    
    const isW1Valid = c1.value === wSum;
    const isW2Valid = c2.value === wSum;
    
    const isC1Valid = c1.value === (dice.value.w1 + dice.value[c1.color]) || c1.value === (dice.value.w2 + dice.value[c1.color]);
    const isC2Valid = c2.value === (dice.value.w1 + dice.value[c2.color]) || c2.value === (dice.value.w2 + dice.value[c2.color]);
    
    const checkOrder = (whiteCell, colorCell) => {
        if (whiteCell.color !== colorCell.color) return true;
        if (whiteCell.color === 'red' || whiteCell.color === 'yellow') return whiteCell.value < colorCell.value;
        return whiteCell.value > colorCell.value;
    };
    
    // Option 1: c1 is white, c2 is color
    if (isW1Valid && isC2Valid && checkOrder(c1, c2)) {
        c1.source = 'white';
        selectedCells.value.push({ color, value, source: 'color' });
        return;
    }
    
    // Option 2: c1 is color, c2 is white
    if (isC1Valid && isW2Valid && checkOrder(c2, c1)) {
        c1.source = 'color';
        selectedCells.value.push({ color, value, source: 'white' });
        return;
    }
  }
}

// Socket Events
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

  socket.on('name_set', (data) => {
    // nothing to do directly, waiting for update_players_list
  });

  socket.on('game_started', () => { 
    gameStatus.value = 'playing';
    gameLogs.value = [];
  });

  socket.on('update_board_state', (data) => {
    if (data.status === 'finished') {
       // game over logic handled in game_over event usually, but sync state
    } else {
       gameStatus.value = 'playing';
    }
    
    // Clear selections if phase changed
    if (phase.value !== data.phase) {
       selectedCells.value = [];
       if (data.phase === 'deciding') {
          animatingDice.value = true;
          setTimeout(() => { animatingDice.value = false; }, 500);
       }
    }

    phase.value = data.phase;
    dice.value = data.dice;
    lockedColors.value = data.lockedColors;
    players.value = data.players;
    activePlayerId.value = data.activePlayerId;
    readyPlayers.value = data.readyPlayers;
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

// Actions
const copyLink = () => {
  const link = `${window.location.origin}/qwixx/join/${roomCode}`;
  navigator.clipboard.writeText(link).then(() => {
    alert("Lien d'invitation copié dans le presse-papier !");
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
}

const startGame = () => socket.emit('start_qwixx', roomCode);

const rollDice = () => {
  socket.emit('qwixx_action', { roomCode, actionType: 'roll' });
}

const submitTurn = (takePenalty) => {
  if (takePenalty && !isActivePlayer.value) return; // Cannot take penalty if not active
  
  if (takePenalty) {
    socket.emit('qwixx_action', { 
       roomCode, actionType: 'submit_turn', payload: { actions: [], penalty: true } 
    });
  } else {
    // If active player passes without anything, they get a penalty? No, UI blocks it unless they press "PENALTY" explicitly.
    // Actually, passing your turn as active player with 0 checkboxes IS a penalty. 
    // They clicked "PASSER MON TOUR". If they are active, it's a penalty.
    const isPenalty = isActivePlayer.value && selectedCells.value.length === 0;

    socket.emit('qwixx_action', { 
      roomCode, actionType: 'submit_turn', payload: { actions: selectedCells.value.map(c => ({...c})), penalty: isPenalty } 
    });
  }
}

</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.qwixx-board-wrapper {
  min-height: 100vh; background: #121212; color: #ecf0f1; font-family: 'Outfit', sans-serif;
  display: flex; flex-direction: column; overflow-x: hidden;
}

/* WAITING SCREEN */
.waiting-screen, .game-over-screen {
  flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;
  padding: 20px;
}
.waiting-screen h1 { font-size: 2.5rem; color: #3498db; margin-bottom: 20px; }
.share-box { background: #1e1e1e; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05); }
.share-box p { margin-bottom: 15px; font-size: 1.2rem; color: #bdc3c7; }
.share-box strong { color: #f1c40f; font-size: 1.5rem; }
.btn-secondary { background: #2b2b2b; color: #ecf0f1; border: 1px solid #7f8c8d; padding: 10px 20px; border-radius: 8px; font-family: 'Outfit', sans-serif; cursor: pointer; transition: 0.2s; font-weight: bold; }
.btn-secondary:hover { background: #34495e; }
.player-list { list-style: none; padding: 0; margin: 20px 0; font-size: 1.2rem; display: flex; flex-direction: column; gap: 10px; }

/* LAYOUT */
.playing-screen { display: flex; flex-direction: column; height: 100vh; }
.top-bar { display: flex; justify-content: space-between; align-items: center; background: #1e1e1e; padding: 15px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.05); }
.main-content { display: flex; flex: 1; overflow: hidden; min-height: 0; }
.my-area { flex: 2; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; align-items: center; }
.opponents-sidebar { flex: 1; background: #181818; border-left: 2px solid #2b2b2b; padding: 20px; overflow-y: auto; height: 100%; min-width: 450px; max-width: 550px; overflow-x: auto; display: flex; flex-direction: column; align-items: stretch; }
.opponents-sidebar > h3 { align-self: center; width: 100%; }

.opponents-sidebar.multi-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-content: start;
  gap: 15px;
  max-width: 650px;
}
.opponents-sidebar.multi-col > h3 { grid-column: 1 / -1; margin-bottom: 5px; }

@media (max-width: 900px) {
  .main-content { flex-direction: column; overflow-y: visible; }
  .my-area, .opponents-sidebar { flex: none; width: 100%; max-width: 100%; min-width: 0; overflow-y: visible; padding: 10px; border-left: none; border-top: 2px solid #2b2b2b; }
  .qwixx-board-wrapper { height: auto; min-height: 100vh; }
  .playing-screen { height: auto; min-height: 100vh; }
  .opponents-sidebar.multi-col { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 600px) {
  .top-bar { flex-direction: column; gap: 15px; padding: 15px; }
  .dice-area { gap: 8px; padding: 10px; justify-content: center; flex-wrap: wrap;}
  .die { width: 40px; height: 40px; font-size: 1.5rem; }
  .btn-action.giant { font-size: 1.1rem; padding: 15px 20px; }
  .action-panel { flex-direction: column; gap: 10px; }
  .btn-action.submit, .btn-action.penalty { width: 100%; min-width: 0; padding: 15px; }
  .opponents-sidebar.multi-col { grid-template-columns: 1fr; }
  
  .waiting-screen h1 { font-size: 1.8rem; }
  .share-box { padding: 15px; }
  .share-box p { font-size: 1rem; }
  .share-box strong { font-size: 1.3rem; display: block; margin-top: 5px; }
  
  .results-box { padding: 20px; }
  .results-box h2 { font-size: 2rem; }
  .score-line { font-size: 1rem; padding: 10px; }
  .score-line.first { font-size: 1.2rem; }
}

/* TYPOGRAPHY */
h2 { font-size: 2rem; font-weight: 900; margin: 0; color: #ecf0f1; }
.turn-indicator { font-size: 1.1rem; color: #bdc3c7; margin-top: 5px; }
.turn-indicator span { display: inline-flex; align-items: center; gap: 5px; }
h3 { font-size: 1.5rem; color: #bdc3c7; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #2b2b2b; padding-bottom: 10px;}

/* DICE */
.dice-area { display: flex; gap: 15px; align-items: center; background: #2b2b2b; padding: 10px 20px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); }
.die { 
  width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-size: 1.8rem; font-weight: 900; box-shadow: inset 0 0 10px rgba(0,0,0,0.1), 0 5px 10px rgba(0,0,0,0.15);
  color: #2c3e50;
}
.die.w { background: white; }
.die.r { background: #ff4757; color: white; }
.die.y { background: #ffa502; color: white; }
.die.g { background: #2ed573; color: white; }
.die.b { background: #1e90ff; color: white; }
.die.hidden { opacity: 0.2; }
.die-roll { animation: roll 0.5s ease-in-out; }

@keyframes roll {
  0% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-20px) rotate(45deg); }
  50% { transform: translateY(0) rotate(90deg); }
  75% { transform: translateY(-10px) rotate(135deg); }
  100% { transform: translateY(0) rotate(180deg); }
}

/* ACTIONS */
.btn-primary, .btn-action { 
  background: #3498db; color: white; border: none; padding: 15px 30px; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; cursor: pointer; transition: 0.2s;
  text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
}
.btn-primary:hover, .btn-action:hover { background: #2980b9; transform: translateY(-2px); }
.btn-primary:disabled { background: #bdc3c7; box-shadow: none; cursor: not-allowed; transform: none; }

.btn-action.giant { font-size: 1.3rem; padding: 20px 40px; background: #e67e22; box-shadow: 0 4px 15px rgba(230, 126, 34, 0.3); }
.btn-action.giant:hover { background: #d35400; }

.action-panel { margin-top: 20px; display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; width: 100%; max-width: 650px;}
.btn-action.submit { background: #2ecc71; flex: 1; min-width: 250px; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3); }
.btn-action.submit:hover { background: #27ae60; }
.btn-action.penalty { background: #e74c3c; flex: 1; min-width: 250px; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3); }
.btn-action.penalty:hover { background: #c0392b; }
.action-panel.status p { font-size: 1.2rem; color: #e67e22; font-weight: 700; animation: pulse 2s infinite;}

/* LOGS */
.logs-container { 
  background: #101418; color: #bdc3c7; padding: 15px 30px; text-align: center;
  border-top: 1px solid #2b2b2b; font-size: 0.95rem; min-height: 80px; 
}
.logs-container ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 5px; }
.logs-container li:first-child { font-weight: 700; font-size: 1.1rem; color: #f1c40f; }

/* RESULTS */
.results-box { background: #1e1e1e; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); max-width: 600px; width: 100%; border: 1px solid rgba(255,255,255,0.05); }
.results-box h2 { font-size: 3rem; margin-bottom: 10px; color: #e74c3c; }
.results-box .reason { font-size: 1.2rem; color: #bdc3c7; margin-bottom: 30px; }

.score-line { display: flex; justify-content: space-between; padding: 15px; border-bottom: 1px solid #2b2b2b; font-size: 1.2rem; color: #ecf0f1; }
.score-line.first { background: rgba(243, 156, 18, 0.2); font-weight: 900; color: #f39c12; border-radius: 10px; border: 1px solid rgba(243, 156, 18, 0.5); font-size: 1.5rem; }
.score-line .score { font-weight: 700; }

.host-actions { margin-top: 30px; }

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
</style>
