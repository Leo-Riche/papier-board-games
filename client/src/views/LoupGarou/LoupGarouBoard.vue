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
      @startGame="handleStartGame"
    />

    <div v-else-if="gameStatus === 'playing'" class="game-placeholder">
      <h1>La nuit tombe... 🐺</h1>
      <p>Le plateau de jeu du Loup-Garou arrivera ici !</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import LoupGarouLobbyWait from './LoupGarouLobbyWait.vue'

const route = useRoute()
const router = useRouter()

const roomCode = route.params.id
const myName = ref('')
const players = ref([])
const gameStatus = ref('waiting')
const socketId = ref('')

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
})

onUnmounted(() => {
  if (socket) socket.disconnect();
})

const handleStartGame = () => {
  socket.emit('start_loupgarou', roomCode);
}
</script>

<style scoped>
.lg-board-container {
  min-height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Georgia', serif;
}
.loading-screen {
  font-size: 1.5rem;
  font-style: italic;
  color: #c9ada7;
  animation: pulse 2s infinite;
}
.game-placeholder {
  text-align: center;
  background: rgba(0,0,0,0.8);
  padding: 50px;
  border-radius: 15px;
  border: 2px solid #8e1a10;
}
.game-placeholder h1 { color: #8e1a10; }
@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
</style>