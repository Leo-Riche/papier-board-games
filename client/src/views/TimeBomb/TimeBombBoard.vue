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
      :cutsLeft="cutsLeft"
      :announcements="announcements"
      :myName="myName"
      :myRole="myRole"
      :myRoleCard="myRoleCard"
      :myHand="myHand"
      :hasScissors="hasScissors"
      :otherPlayers="otherPlayers"
      :gameMessages="gameMessages"
      :isRedistributing="isRedistributing"
      :protectedPlayerId="protectedPlayerId"
      :allAnnounced="allAnnounced"
      @cut="handleCut"
      @announce="handleAnnounce"
      @chatSend="handleChatSend" 
    />

    <div v-else-if="gameStatus === 'finished'" class="game-over-screen">
      <div class="results-box">
        <h2>Partie Terminée !</h2>
        <h3 :class="winner.toLowerCase()">Victoire de l'équipe {{ winner }} 🏆</h3>
        <p class="reason">{{ winReason }}</p>

        <div class="revealed-roles">
          <h4>Identités Révélées :</h4>
          <ul>
            <li v-for="p in finalPlayers" :key="p.name" :class="p.role.toLowerCase()">
              👤 <strong>{{ p.name }}</strong> était {{ p.role }}
            </li>
          </ul>
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
          :cutsLeft="cutsLeft"
          :announcements="announcements"
          :myName="myName" 
          :myRole="myRole"
          :myRoleCard="myRoleCard"
          :myHand="myHand" 
          :hasScissors="false" 
          :otherPlayers="otherPlayers"
          :gameMessages="gameMessages"
          :isRedistributing="false"
          :protectedPlayerId="null"
          :allAnnounced="allAnnounced"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import TimeBombLobbyWait from './TimeBombLobbyWait.vue'
import TimeBombActiveBoard from './TimeBombActiveBoard.vue' 
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

const gameStatus = ref('waiting')
const allConnectedPlayers = ref([])
const amIHost = ref(false)

const round = ref(1)
const defusesLeft = ref(0)
const cutsLeft = ref(0)
const announcements = ref({})
const myName = ref('')
const myRole = ref(null)
const myRoleCard = ref('')
const myHand = ref([])
const hasScissors = ref(false)
const otherPlayers = ref([])
const gameMessages = ref([])
const isRedistributing = ref(false)
const protectedPlayerId = ref(null)
const allAnnounced = ref(false)

const winner = ref('')
const winReason = ref('')
const finalPlayers = ref([]) 

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
    protectedPlayerId.value = null;
    finalPlayers.value = [];
  });

  socket.on('update_board_state', (data) => {
    round.value = data.round;
    defusesLeft.value = data.defusesLeft;
    cutsLeft.value = data.cutsLeft;
    announcements.value = data.announcements || {};
    myRole.value = data.myRole;
    myRoleCard.value = data.myRoleCard;
    myHand.value = data.myHand;
    hasScissors.value = data.hasScissors;
    otherPlayers.value = data.opponents;
    isRedistributing.value = data.isRedistributing;
    protectedPlayerId.value = data.protectedPlayerId;
    allAnnounced.value = data.allAnnounced;
  });

  socket.on('action_log', (msg) => { 
    gameMessages.value.push({ type: 'system', text: msg, timestamp: new Date() });
  });

  socket.on('player_chat_message', (msgData) => {
    gameMessages.value.push({ type: 'player', sender: msgData.sender, text: msgData.text, timestamp: new Date() });
  });

  socket.on('game_over', (data) => {
    gameStatus.value = 'finished';
    winner.value = data.winner;
    winReason.value = data.reason;
    finalPlayers.value = data.players;
    gameMessages.value.push({ type: 'system', text: `${data.reason} Les ${data.winner} gagnent !`, timestamp: new Date() });
  });
});

const startGame = () => socket.emit('start_timebomb', roomCode);

const handleAnnounce = ({ defuses, hasBomb }) => {
  socket.emit('announce_cards', { roomCode, playerName: myName.value, defuses, hasBomb });
}

const handleCut = ({ targetId, cardIndex }) => {
  if (!hasScissors.value) return alert("Ce n'est pas ton tour !");
  if (isRedistributing.value) return; 
  socket.emit('cut_wire', { roomCode, targetId, cardIndex, shooterName: myName.value });
}

const handleChatSend = (text) => {
  if (!text.trim()) return;
  socket.emit('send_player_chat', { roomCode, text: text, sender: myName.value });
}
</script>

<style scoped>
.board-wrapper { height: 100vh; display: flex; flex-direction: column; background: #161514; color: #dfd3c3; padding: 20px; font-family: 'Space Mono', monospace; }
.game-over-screen { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; }
.board-background { position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.15; pointer-events: none; z-index: 1; }

.results-box { 
  background: #1c1a19; padding: 50px; text-align: center; z-index: 10; 
  border: 1px solid #cda434; max-width: 600px; width: 100%;
}
.results-box h2 { font-family: 'Cormorant Garamond', serif; font-size: 2.5rem; margin-bottom: 10px; font-weight: normal; color: #dfd3c3; }
.results-box h3 { font-size: 1.2rem; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; }
.results-box h3.sherlock { color: #4b6b78; }
.results-box h3.moriarty { color: #8c3b3b; }
.reason { font-size: 0.9rem; margin-bottom: 30px; color: #8a8277; }

.revealed-roles { margin: 30px 0; border-top: 1px dashed rgba(205, 164, 52, 0.3); border-bottom: 1px dashed rgba(205, 164, 52, 0.3); padding: 25px 0; }
.revealed-roles h4 { margin-bottom: 20px; color: #8a8277; font-size: 0.8rem; text-transform: uppercase; font-weight: normal;}
.revealed-roles ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; }
.revealed-roles li { font-size: 0.9rem; }
.revealed-roles li.sherlock { color: #4b6b78; }
.revealed-roles li.moriarty { color: #8c3b3b; }

.host-actions { display: flex; flex-direction: column; gap: 15px; margin-top: 30px; align-items: center;}
</style>