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
      v-else-if="gameStatus === 'playing'"
      :roomCode="roomCode"
      :round="round"
      :defusesLeft="defusesLeft"
      :myName="myName"
      :myRole="myRole"
      :myRoleCard="myRoleCard"
      :myHand="myHand"
      :hasScissors="hasScissors"
      :otherPlayers="otherPlayers"
      :gameMessages="gameMessages"
      :isRedistributing="isRedistributing" @cut="handleCut"
      @chatSend="handleChatSend" 
    />

    <div v-else-if="gameStatus === 'finished'" class="game-over-screen">
      <div class="results-box">
        <h2>Partie Terminée !</h2>
        <h3 :class="winner.toLowerCase()">Victoire de l'équipe {{ winner }} 🏆</h3>
        <p class="reason">{{ winReason }}</p>

        <div class="final-board-preview">
          <p>Regardez le plateau derrière pour voir les rôles de chacun !</p>
        </div>

        <div v-if="amIHost" class="host-actions">
          <BaseButton variant="primary" @click="startGame">
            RELANCER UNE PARTIE 🔄
          </BaseButton>
          <BaseButton variant="secondary" @click="gameStatus = 'waiting'">
            Retourner au Lobby
          </BaseButton>
        </div>
        <div v-else class="host-actions">
          <p>En attente du chef de salle...</p>
        </div>
      </div>

      <div class="board-background">
        <TimeBombActiveBoard 
          :roomCode="roomCode" 
          :round="round" 
          :defusesLeft="defusesLeft"
          :myName="myName" 
          :myRole="myRole"
          :myRoleCard="myRoleCard"
          :myHand="myHand" 
          :hasScissors="false" 
          :otherPlayers="otherPlayers"
          :gameMessages="gameMessages"
          :isRedistributing="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { io } from 'socket.io-client'
import TimeBombLobbyWait from './TimeBombLobbyWait.vue'
import TimeBombActiveBoard from './TimeBombActiveBoard.vue' 
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

const gameStatus = ref('waiting')
const allConnectedPlayers = ref([])
const amIHost = ref(false)

const round = ref(1)
const defusesLeft = ref(0)
const myName = ref('')
const myRole = ref(null)
const myRoleCard = ref('')
const myHand = ref([])
const hasScissors = ref(false)
const otherPlayers = ref([])
const gameMessages = ref([])

// --- NOUVEAU : LA VARIABLE D'ÉTAT ---
const isRedistributing = ref(false)

const winner = ref('')
const winReason = ref('')

onMounted(() => {
  socket.on('connect', () => {
    const savedName = localStorage.getItem('temp_player_name');
    if (savedName) socket.emit('set_player_name', { name: savedName, roomCode });
    else socket.emit('join_room', roomCode);
  });

  socket.on('update_players_list', (players) => {
    allConnectedPlayers.value = players;
    const me = players.find(p => p.id === socket.id);
    if (me) {
      if (me.name !== "En attente..." && me.name !== "Anonyme") myName.value = me.name;
      amIHost.value = me.isHost;
    }
  });

  socket.on('name_set', (data) => myName.value = data.name);

  socket.on('game_started', () => { 
    gameStatus.value = 'playing';
    winner.value = '';
    winReason.value = '';
    gameMessages.value = [];
    isRedistributing.value = false;
  });

  socket.on('update_board_state', (data) => {
    round.value = data.round;
    defusesLeft.value = data.defusesLeft;
    myRole.value = data.myRole;
    myRoleCard.value = data.myRoleCard;
    myHand.value = data.myHand;
    hasScissors.value = data.hasScissors;
    otherPlayers.value = data.opponents;
    
    // --- NOUVEAU : MISE À JOUR DE L'ÉTAT ---
    isRedistributing.value = data.isRedistributing;
  });

  socket.on('action_log', (msg) => { 
    gameMessages.value.push({ type: 'system', text: msg, timestamp: new Date() });
  });

  socket.on('player_chat_message', (msgData) => {
    gameMessages.value.push({ type: 'player', sender: msgData.sender, text: msgData.text, timestamp: new Date() });
  });

  socket.on('game_over', ({ winner: winTeam, reason }) => {
    gameStatus.value = 'finished';
    winner.value = winTeam;
    winReason.value = reason;
    gameMessages.value.push({ type: 'system', text: `${reason} Les ${winTeam} gagnent la partie !`, timestamp: new Date() });
  });
});

const startGame = () => socket.emit('start_timebomb', roomCode);

const handleCut = ({ targetId, cardIndex }) => {
  if (!hasScissors.value) return alert("Ce n'est pas ton tour !");
  // Sécurité supplémentaire côté client pour éviter les clics frénétiques
  if (isRedistributing.value) return; 
  
  socket.emit('cut_wire', { roomCode, targetId, cardIndex, shooterName: myName.value });
}

const handleChatSend = (text) => {
  if (!text.trim()) return;
  socket.emit('send_player_chat', { roomCode, text: text, sender: myName.value });
}
</script>

<style scoped>
.board-wrapper { height: 100vh; display: flex; flex-direction: column; background: #2c3e50; color: white; padding: 20px; }
.game-over-screen { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; }
.board-background { position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.3; pointer-events: none; z-index: 1; }
.results-box { background: rgba(20, 20, 20, 0.95); padding: 40px; border-radius: 20px; text-align: center; z-index: 10; box-shadow: 0 10px 50px rgba(0,0,0,0.8); border: 2px solid #ffde59; }
.results-box h2 { font-size: 2.5rem; margin-bottom: 10px; }
.results-box h3 { font-size: 2rem; margin-bottom: 20px; text-transform: uppercase; }
.results-box h3.sherlock { color: #3498db; }
.results-box h3.moriarty { color: #e74c3c; }
.reason { font-size: 1.2rem; margin-bottom: 30px; font-style: italic; }
.host-actions { display: flex; flex-direction: column; gap: 15px; margin-top: 20px; }
</style>