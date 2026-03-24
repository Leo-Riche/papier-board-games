<template>
  <div class="board-wrapper">
    <TimeBombLobbyWait 
      v-if="gameStatus === 'waiting'"
      :roomCode="roomCode"
      :players="allConnectedPlayers"
      :socketId="socket.id"
      :amIHost="amIHost"
      @start="startGame"
    />

    <TimeBombActiveBoard 
      v-else
      :roomCode="roomCode"
      :round="round"
      :defusesLeft="defusesLeft"
      :lastAction="lastAction"
      :myName="myName"
      :myRole="myRole"
      :myHand="myHand"
      :hasScissors="hasScissors"
      :otherPlayers="otherPlayers"
      @cut="handleCut"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { io } from 'socket.io-client'

// Import des sous-composants
import TimeBombLobbyWait from './TimeBombLobbyWait.vue'
import TimeBombActiveBoard from './TimeBombActiveBoard.vue' 

const route = useRoute()
const socket = io('http://localhost:3000')
const roomCode = route.params.id

// --- États globaux ---
const gameStatus = ref('waiting')
const allConnectedPlayers = ref([])
const amIHost = ref(false)

// --- États du jeu ---
const round = ref(1)
const defusesLeft = ref(0)
const lastAction = ref('Le jeu va commencer...')
const myName = ref('')
const myRole = ref(null)
const myHand = ref([])
const hasScissors = ref(false)
const otherPlayers = ref([])

onMounted(() => {
  // 1. Connexion et identification
  socket.on('connect', () => {
    const savedName = localStorage.getItem('temp_player_name');
    if (savedName) socket.emit('set_player_name', { name: savedName, roomCode });
    else socket.emit('join_room', roomCode);
  });

  // 2. Mise à jour du Lobby
  socket.on('update_players_list', (players) => {
    allConnectedPlayers.value = players;
    const me = players.find(p => p.id === socket.id);
    if (me) {
      if (me.name !== "En attente..." && me.name !== "Anonyme") myName.value = me.name;
      amIHost.value = me.isHost;
    }
  });

  socket.on('name_set', (data) => myName.value = data.name);

  // 3. Démarrage du jeu
  socket.on('init_player_data', (data) => {
    myRole.value = data.role;
    myHand.value = data.hand;
    hasScissors.value = data.hasScissors;
    otherPlayers.value = data.allPlayers.filter(p => p.id !== socket.id);
    defusesLeft.value = data.allPlayers.length;
    gameStatus.value = 'playing';
  });

  socket.on('wire_cut_update', (data) => {
    lastAction.value = `${data.shooterName} a coupé chez un joueur !`;
  });
});

// --- Actions renvoyées au serveur ---
const startGame = () => socket.emit('start_timebomb', roomCode);

const handleCut = ({ targetId, cardIndex }) => {
  if (!hasScissors.value) return alert("Ce n'est pas ton tour !");
  socket.emit('cut_wire', { roomCode, targetId, cardIndex, shooterName: myName.value });
}
</script>

<style scoped>
.board-wrapper { height: 100vh; display: flex; flex-direction: column; background: #2c3e50; color: white; padding: 20px; }
</style>