<template>
  <div class="lg-board-container">
    <div v-if="!myName" class="loading-screen">
      🌕 Connexion au village en cours...
    </div>

    <LoupGarouLobbyWait 
      v-else-if="gameStatus === 'waiting'"
      :roomCode="roomCode"
      :players="players"
      :socketId="socketId"
      :amIHost="amIHost"
      :roleComposition="roleComposition"
      @start="handleStartGame"
      @update-composition="handleUpdateComposition"
    />

    <LoupGarouActiveBoard
      v-else-if="gameStatus === 'playing'"
      :roomCode="roomCode"
      :status="gameState.status"
      :phase="gameState.phase"
      :turn="gameState.turn"
      :winner="gameState.winner"
      :myName="myName"
      :myRole="gameState.myRole"
      :isAlive="gameState.isAlive"
      :isMayor="gameState.isMayor"
      :isLover="gameState.isLover"
      :potions="gameState.potions"
      :nightVictims="gameState.nightVictims"
      :players="gameState.players"
      :votes="gameState.votes"
      :centerCards="gameState.centerCards"
      :logs="gameState.logs"
      :timeLeft="gameState.timeLeft"
      @action="handleGameAction"
    />

    <div v-else-if="gameStatus === 'finished'" class="game-over-screen">
      <div v-if="showResultsPopup" class="results-box">
        <button class="close-popup-btn" @click="showResultsPopup = false">&times;</button>
        <h2>Partie Terminée !</h2>
        
        <h3 v-if="gameState.winner === 'village'" class="village">Victoire du Village ! 🧑‍🌾</h3>
        <h3 v-else-if="gameState.winner === 'loups'" class="loups">Victoire des Loups-Garous ! 🐺</h3>
        <h3 v-else-if="gameState.winner === 'lovers'" class="lovers">Victoire des Amoureux ! 💕</h3>
        <h3 v-else-if="gameState.winner === 'draw'">Match Nul ! 💀</h3>
        <h3 v-else>Terminé !</h3>

        <p class="reason">{{ getWinReason(gameState.winner) }}</p>

        <div class="revealed-roles">
          <h4>Identités Révélées :</h4>
          <ul>
            <li v-for="p in gameState.players" :key="p.name" :class="{ 'is-dead': !p.isAlive }">
              👤 <strong>{{ p.name }}</strong> était {{ p.role }}
              <span v-if="!p.isAlive">💀</span>
              <span v-if="p.isLover">💕</span>
            </li>
          </ul>
        </div>

        <div v-if="amIHost" class="host-actions">
          <button class="btn-primary" @click="handleStartGame(roleComposition)">
            RELANCER UNE PARTIE 🔄
          </button>
          <button class="btn-secondary" @click="gameStatus = 'waiting'">
            Retourner au Lobby
          </button>
        </div>
        <div v-else class="host-actions">
          <p>En attente du chef de village...</p>
        </div>
      </div>

      <button v-if="!showResultsPopup" class="reopen-popup-btn" @click="showResultsPopup = true">
        🏆 Résultats
      </button>

      <div class="board-background" :class="{ dimmed: showResultsPopup }">
        <LoupGarouActiveBoard
          :roomCode="roomCode"
          :status="gameState.status"
          :phase="gameState.phase"
          :turn="gameState.turn"
          :winner="gameState.winner"
          :myName="myName"
          :myRole="gameState.myRole"
          :isAlive="gameState.isAlive"
          :isMayor="gameState.isMayor"
          :isLover="gameState.isLover"
          :potions="gameState.potions"
          :nightVictims="gameState.nightVictims"
          :players="gameState.players"
          :votes="gameState.votes"
          :centerCards="gameState.centerCards"
          :logs="gameState.logs"
          :timeLeft="gameState.timeLeft"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import LoupGarouLobbyWait from './LoupGarouLobbyWait.vue'
import LoupGarouActiveBoard from './LoupGarouActiveBoard.vue'

const route = useRoute()
const router = useRouter()

const roomCode = route.params.id
const myName = ref('')
const players = ref([])
const gameStatus = ref('waiting')
const socketId = ref('')
const roleComposition = ref([])
const showResultsPopup = ref(true)

const gameState = ref({
  status: 'playing',
  phase: 'lobby',
  turn: 0,
  winner: null,
  myRole: '',
  isAlive: true,
  isMayor: false,
  isLover: false,
  potions: { heal: true, kill: true },
  nightVictims: [],
  players: [],
  votes: {},
  centerCards: [],
  logs: [],
  timeLeft: 0
})

const amIHost = computed(() => {
  return players.value.length > 0 && players.value[0].id === socketId.value;
})

let socket = null;

onMounted(() => {
  const savedName = localStorage.getItem('temp_player_name');
  if (!savedName) {
    alert("Pseudo introuvable, retour à l'accueil !");
    router.push('/loupgarou');
    return;
  }
  myName.value = savedName;

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  socket = io(apiUrl);

  socket.on('connect', () => {
    socketId.value = socket.id;
    socket.emit('set_player_name', { name: myName.value, roomCode: roomCode });
  });

  socket.on('update_players_list', (serverPlayers) => {
    players.value = serverPlayers.map((p, index) => ({
      ...p,
      isHost: index === 0
    }));
  });

  socket.on('room_full', (msg) => {
    alert(msg);
    socket.disconnect();
    router.push('/loupgarou');
  });

  socket.on('game_started', () => {
    gameStatus.value = 'playing';
    showResultsPopup.value = true;
  });

  // Synchronisation de la composition de rôles (pour les non-host)
  socket.on('role_composition_updated', (composition) => {
    roleComposition.value = composition;
  });

  // État du jeu LoupGarou
  socket.on('update_loupgarou_state', (state) => {
    gameState.value = state;
    if (state.status === 'finished' && gameStatus.value === 'playing') {
      gameStatus.value = 'finished';
      showResultsPopup.value = true;
    }
  });

  socket.on('voyante_result', (data) => {
    const target = gameState.value.players.find(p => p.id === data.targetId);
    if (target) {
      alert(`🔮 La Voyante a vu : ${target.name} est ${data.role}`);
    }
  });

  socket.on('timer_update', (timeLeft) => {
    gameState.value.timeLeft = timeLeft;
  });
})

onUnmounted(() => {
  if (socket) socket.disconnect();
})

const handleStartGame = (composition) => {
  if (gameStatus.value === 'finished') {
     gameStatus.value = 'playing';
     showResultsPopup.value = true;
  }
  socket.emit('start_loupgarou', { roomCode, roleComposition: composition });
}

const getWinReason = (winner) => {
  if (winner === 'village') return "Tous les loups ont été éliminés !";
  if (winner === 'loups') return "Les loups sont désormais majoritaires dans le village !";
  if (winner === 'lovers') return "Les amoureux sont les seuls survivants !";
  if (winner === 'draw') return "Il n'y a plus aucun survivant !";
  return "";
}

const handleUpdateComposition = (composition) => {
  roleComposition.value = composition;
  socket.emit('update_role_composition', { roomCode, roleComposition: composition });
}

const handleGameAction = ({ actionType, targetId }) => {
  socket.emit('loupgarou_action', { roomCode, actionType, targetId });
}
</script>

<style scoped>
.lg-board-container {
  min-height: 100vh;
  background: radial-gradient(circle at center bottom, #2a1a12 0%, #121110 60%, #0a0a0a 100%);
  color: #d6c9b3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
  overflow: hidden;
  position: relative;
}

/* Subtile animation de particules/braises (très sobre) */
.lg-board-container::before {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background-image: 
    radial-gradient(circle at 15% 85%, rgba(211, 84, 0, 0.05) 1%, transparent 1%),
    radial-gradient(circle at 85% 90%, rgba(230, 126, 34, 0.04) 1%, transparent 1%),
    radial-gradient(circle at 50% 95%, rgba(211, 84, 0, 0.06) 2%, transparent 2%);
  background-size: 100px 100px;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

.loading-screen {
  font-size: 1.5rem;
  font-style: italic;
  color: #a89a8e;
  animation: pulse 2s infinite;
  z-index: 1;
}

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

/* Styles pour l'écran de fin */
.game-over-screen { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.board-background { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 1; transition: opacity 0.3s ease; opacity: 1; }
.board-background.dimmed { opacity: 0.15; }

.results-box { 
  background: rgba(18, 17, 16, 0.95); padding: 40px; text-align: center; z-index: 10; 
  border: 1px solid rgba(230, 126, 34, 0.6); max-width: 600px; width: 90%;
  border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
  position: relative; animation: fadeIn 0.3s ease;
  backdrop-filter: blur(10px);
}

.close-popup-btn {
  position: absolute; top: 10px; right: 15px;
  background: none; border: none; color: #8a8277; font-size: 1.8rem;
  cursor: pointer; transition: color 0.2s;
}
.close-popup-btn:hover { color: #dfd3c3; }

.reopen-popup-btn {
  position: fixed; bottom: 25px; right: 25px; z-index: 100;
  background: rgba(230, 126, 34, 0.8); color: #121110; border: none;
  padding: 12px 22px; font-family: 'Space Mono', monospace; font-weight: bold;
  font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;
  cursor: pointer; box-shadow: 0 4px 15px rgba(230, 126, 34, 0.3);
  transition: all 0.2s; border-radius: 8px;
}
.reopen-popup-btn:hover { background: #dfd3c3; transform: translateY(-2px); }

@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

.results-box h2 { font-family: 'Cormorant Garamond', serif; font-size: 2.5rem; margin-bottom: 5px; font-weight: normal; color: #dfd3c3; }
.results-box h3 { font-size: 1.3rem; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 2px; }
.results-box h3.village { color: #2ecc71; text-shadow: 0 0 10px rgba(46, 204, 113, 0.4); }
.results-box h3.loups { color: #e74c3c; text-shadow: 0 0 10px rgba(231, 76, 60, 0.4); }
.results-box h3.lovers { color: #fd79a8; text-shadow: 0 0 10px rgba(253, 121, 168, 0.4); }
.reason { font-size: 1rem; margin-bottom: 25px; color: #a89a8e; font-style: italic;}

.revealed-roles { margin: 25px 0; border-top: 1px dashed rgba(230, 126, 34, 0.3); border-bottom: 1px dashed rgba(230, 126, 34, 0.3); padding: 20px 0; overflow-y: auto; max-height: 200px;}
.revealed-roles h4 { margin: 0 0 15px 0; color: #dfd3c3; font-size: 1rem; text-transform: uppercase; font-weight: normal; letter-spacing: 1px;}
.revealed-roles ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; align-items: stretch; margin: 0;}
.revealed-roles li { font-size: 0.95rem; color: #d6c9b3; padding: 6px; border-radius: 4px; background: rgba(255,255,255,0.03); display: flex; justify-content: center; align-items: center; gap: 8px;}
.revealed-roles li.is-dead { opacity: 0.6; color: #a89a8e; text-decoration: line-through;}

.host-actions { display: flex; flex-direction: column; gap: 12px; margin-top: 25px; align-items: center;}
.btn-primary { background: #e67e22; color: #121110; border: none; padding: 12px 24px; font-family: 'Space Mono', monospace; text-transform: uppercase; font-size: 0.9rem; font-weight: bold; cursor: pointer; border-radius: 6px; transition: background 0.2s, transform 0.1s;}
.btn-primary:hover { background: #d35400; transform: translateY(-1px);}
.btn-secondary { background: transparent; color: #a89a8e; border: 1px solid #a89a8e; padding: 10px 20px; font-family: 'Space Mono', monospace; text-transform: uppercase; font-size: 0.8rem; cursor: pointer; border-radius: 6px; transition: all 0.2s;}
.btn-secondary:hover { background: rgba(168, 154, 142, 0.1); color: #dfd3c3;}
</style>