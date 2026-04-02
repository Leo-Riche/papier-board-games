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
      :potions="gameState.potions"
      :nightVictims="gameState.nightVictims"
      :players="gameState.players"
      :votes="gameState.votes"
      :logs="gameState.logs"
      @action="handleGameAction"
    />
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

const gameState = ref({
  status: 'playing',
  phase: 'lobby',
  turn: 0,
  winner: null,
  myRole: '',
  isAlive: true,
  potions: { heal: true, kill: true },
  nightVictims: [],
  players: [],
  votes: {},
  logs: []
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
  });

  // Synchronisation de la composition de rôles (pour les non-host)
  socket.on('role_composition_updated', (composition) => {
    roleComposition.value = composition;
  });

  // État du jeu LoupGarou
  socket.on('update_loupgarou_state', (state) => {
    gameState.value = state;
  });

  socket.on('voyante_result', (data) => {
    const target = gameState.value.players.find(p => p.id === data.targetId);
    if (target) {
      alert(`🔮 La Voyante a vu : ${target.name} est ${data.role}`);
    }
  });
})

onUnmounted(() => {
  if (socket) socket.disconnect();
})

const handleStartGame = (composition) => {
  socket.emit('start_loupgarou', { roomCode, roleComposition: composition });
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
  background: #161514;
  color: #dfd3c3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
}
.loading-screen {
  font-size: 1.5rem;
  font-style: italic;
  color: #c9ada7;
  animation: pulse 2s infinite;
}
@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
</style>