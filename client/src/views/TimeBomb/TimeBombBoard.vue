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
      :lastAction="lastAction"
      :myName="myName"
      :myRole="myRole"
      :myHand="myHand"
      :hasScissors="hasScissors"
      :otherPlayers="otherPlayers"
      @cut="handleCut"
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
          :roomCode="roomCode" :round="round" :defusesLeft="defusesLeft"
          :lastAction="lastAction" :myName="myName" :myRole="myRole"
          :myHand="myHand" :hasScissors="false" :otherPlayers="otherPlayers"
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
const socket = io('http://localhost:3000')
const roomCode = route.params.id

const gameStatus = ref('waiting')
const allConnectedPlayers = ref([])
const amIHost = ref(false)

const round = ref(1)
const defusesLeft = ref(0)
const lastAction = ref('Le jeu va commencer...')
const myName = ref('')
const myRole = ref(null)
const myHand = ref([])
const hasScissors = ref(false)
const otherPlayers = ref([])

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

  // Le jeu bascule sur le plateau actif
  socket.on('game_started', () => { 
    gameStatus.value = 'playing';
    winner.value = '';
    winReason.value = '';
  });

  // NOUVEAU : On reçoit l'état complet du plateau en temps réel
  socket.on('update_board_state', (data) => {
    round.value = data.round;
    defusesLeft.value = data.defusesLeft;
    myRole.value = data.myRole;
    myHand.value = data.myHand;
    hasScissors.value = data.hasScissors;
    otherPlayers.value = data.opponents;
  });

  socket.on('action_log', (msg) => { lastAction.value = msg; });

  socket.on('game_over', ({ winner, reason }) => {
    gameStatus.value = 'finished';
    winner.value = data.winner;
    winReason.value = data.reason;
    lastAction.value = `${reason} Les ${winner} gagnent la partie !`;
  });
});

const startGame = () => socket.emit('start_timebomb', roomCode);

const handleCut = ({ targetId, cardIndex }) => {
  if (!hasScissors.value) return alert("Ce n'est pas ton tour !");
  socket.emit('cut_wire', { roomCode, targetId, cardIndex, shooterName: myName.value });
}
</script>

<style scoped>
.board-wrapper {
  height: 100vh; display: flex; flex-direction: column;
  background: #111; color: white; padding: 20px;
}

/* === Écran de fin de partie === */
.game-over-screen { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; }
.board-background { position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.2; pointer-events: none; z-index: 1; filter: sepia(0.5); }

.results-box {
  background: linear-gradient(135deg, #0a1020, #000); padding: 40px;
  border-radius: 20px; text-align: center; z-index: 10;
  box-shadow: 0 10px 50px rgba(0,0,0,0.8);
  border: 5px double #a67c00; min-width: 400px;
}

.results-box h2 { font-size: 2.8rem; margin-bottom: 10px; color: white; font-family: serif;}
.results-box h3 { font-size: 2rem; margin-bottom: 15px; text-transform: uppercase; font-weight: bold; }
.results-box h3.sherlock { color: #3498db; text-shadow: 0 0 15px rgba(52,152,219,0.8);}
.results-box h3.moriarty { color: #e74c3c; text-shadow: 0 0 15px rgba(231,76,60,0.8);}

.reason { font-size: 1.3rem; margin-bottom: 25px; font-style: italic; color: #daa520; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 20px; }
.final-board-preview { background: rgba(0,0,0,0.3); padding: 10px; border-radius: 10px; margin-bottom: 25px; font-size: 1rem; color: #daa520; }
.host-actions { display: flex; flex-direction: column; gap: 15px; }
</style>