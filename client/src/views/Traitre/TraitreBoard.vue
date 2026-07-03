<template>
  <div class="board-wrapper">
    <TraitreLobbyWait
      v-if="gameStatus === 'waiting'"
      :roomCode="roomCode"
      :players="allConnectedPlayers"
      :socketId="socket.id"
      :amIHost="amIHost"
      @start="startGame"
    />

    <TraitreActiveBoard
      v-else-if="gameStatus === 'playing'"
      :roomCode="roomCode"
      :target="target"
      :deckCount="deckCount"
      :chestCount="chestCount"
      :discardCount="discardCount"
      :currentPlayerName="currentPlayerName"
      :isMyTurn="isMyTurn"
      :myId="myId"
      :myRole="myRole"
      :myHand="myHand"
      :myPlanches="myPlanches"
      :amIEliminated="amIEliminated"
      :pendingAction="pendingAction"
      :players="players"
      :gameMessages="gameMessages"
      @action="handleAction"
      @chatSend="handleChatSend"
    />

    <div v-else-if="gameStatus === 'finished'" class="game-over-screen">
      <div v-if="showResultsPopup" class="results-box">
        <button class="close-popup-btn" @click="showResultsPopup = false">&times;</button>
        <h2>Partie Terminée !</h2>
        <h3 :class="winner">Victoire des {{ winner === 'pirate' ? 'Pirates 🏴‍☠️' : 'Mutins 🗡️' }}</h3>
        <p class="reason">{{ winReason }}</p>
        <p v-if="finalChest !== null" class="chest-total">
          Coffre final : <strong>{{ finalChest }}</strong> / {{ target }}
        </p>

        <div class="revealed-roles">
          <h4>Identités révélées :</h4>
          <ul>
            <li v-for="p in finalPlayers" :key="p.name" :class="p.role">
              {{ p.role === 'pirate' ? '🏴‍☠️' : '🗡️' }} <strong>{{ p.name }}</strong>
              était {{ p.role === 'pirate' ? 'Pirate' : 'Mutin' }}
              <span v-if="p.eliminated" class="drowned">🌊</span>
            </li>
          </ul>
        </div>

        <div v-if="amIHost" class="host-actions">
          <BaseButton variant="primary" @click="startGame">RELANCER UNE PARTIE 🔄</BaseButton>
          <BaseButton variant="secondary" @click="gameStatus = 'waiting'">Retourner au Lobby</BaseButton>
        </div>
        <div v-else class="host-actions">
          <p>En attente du Capitaine...</p>
        </div>
      </div>

      <button v-if="!showResultsPopup" class="reopen-popup-btn" @click="showResultsPopup = true">
        🏆 Résultats
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import TraitreLobbyWait from './TraitreLobbyWait.vue'
import TraitreActiveBoard from './TraitreActiveBoard.vue'
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

const gameStatus = ref('waiting')
const allConnectedPlayers = ref([])
const amIHost = ref(false)
const myName = ref('')

const target = ref(0)
const deckCount = ref(0)
const chestCount = ref(0)
const discardCount = ref(0)
const currentPlayerName = ref('')
const isMyTurn = ref(false)
const myId = ref('')
const myRole = ref('pirate')
const myHand = ref([])
const myPlanches = ref(0)
const amIEliminated = ref(false)
const pendingAction = ref(null)
const players = ref([])

const gameMessages = ref([])
const showResultsPopup = ref(true)
const winner = ref('')
const winReason = ref('')
const finalPlayers = ref([])
const finalChest = ref(null)

onMounted(() => {
  socket.on('connect', () => {
    const savedName = localStorage.getItem('temp_player_name')
    if (savedName) socket.emit('set_player_name', { name: savedName, roomCode })
  })

  socket.on('room_full', (message) => {
    alert(message)
    socket.disconnect()
    router.push('/')
  })

  socket.on('traitre_error', (message) => alert(message))

  socket.on('update_players_list', (list) => {
    allConnectedPlayers.value = list
    const me = list.find(p => p.id === socket.id)
    if (me) {
      if (me.name !== 'En attente...' && me.name !== 'Anonyme') myName.value = me.name
      amIHost.value = me.isHost
    }
  })

  socket.on('name_set', (data) => { myName.value = data.name })

  socket.on('game_started', () => {
    gameStatus.value = 'playing'
    winner.value = ''
    winReason.value = ''
    finalPlayers.value = []
    finalChest.value = null
    gameMessages.value = []
    showResultsPopup.value = true
  })

  socket.on('traitre_state', (data) => {
    target.value = data.target
    deckCount.value = data.deckCount
    chestCount.value = data.chestCount
    discardCount.value = data.discardCount
    currentPlayerName.value = data.currentPlayerName
    isMyTurn.value = data.isMyTurn
    myId.value = data.myId
    myRole.value = data.myRole
    myHand.value = data.myHand
    myPlanches.value = data.myPlanches
    amIEliminated.value = data.amIEliminated
    pendingAction.value = data.pendingAction
    players.value = data.players
    if (data.status === 'playing') gameStatus.value = 'playing'
  })

  socket.on('action_log', (msg) => {
    gameMessages.value.push({ type: 'system', text: msg, timestamp: new Date() })
  })

  socket.on('player_chat_message', (msgData) => {
    gameMessages.value.push({ type: 'player', sender: msgData.sender, text: msgData.text, timestamp: new Date() })
  })

  socket.on('game_over', (data) => {
    gameStatus.value = 'finished'
    winner.value = data.winner
    winReason.value = data.reason
    finalPlayers.value = data.players
    finalChest.value = data.chestTotal
    target.value = data.target
    showResultsPopup.value = true
  })
})

const startGame = () => socket.emit('start_traitre', roomCode)

const handleAction = (actionType, payload) => {
  socket.emit('traitre_action', { roomCode, actionType, payload })
}

const handleChatSend = (text) => {
  if (!text.trim()) return
  socket.emit('send_player_chat', { roomCode, text, sender: myName.value })
}
</script>

<style scoped>
.board-wrapper {
  min-height: 100vh; display: flex; flex-direction: column;
  background: radial-gradient(circle at 50% 0%, #123146 0%, #08151f 70%);
  color: #f2e6cf; font-family: 'Space Mono', monospace;
}
.game-over-screen { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }
.results-box {
  background: rgba(8, 24, 36, 0.96); padding: 44px; text-align: center; border: 1px solid #e0b04a;
  border-radius: 16px; max-width: 560px; width: 100%; position: relative; animation: fadeIn 0.3s ease;
}
.close-popup-btn {
  position: absolute; top: 10px; right: 16px; background: none; border: none; color: #6fb7b0;
  font-size: 1.6rem; cursor: pointer;
}
.close-popup-btn:hover { color: #f2e6cf; }
.reopen-popup-btn {
  position: fixed; bottom: 25px; right: 25px; z-index: 100; background: #e0b04a; color: #08151f; border: none;
  padding: 12px 22px; border-radius: 10px; font-family: 'Cinzel', serif; text-transform: uppercase; letter-spacing: 1px;
  cursor: pointer; box-shadow: 0 4px 15px rgba(224, 176, 74, 0.3);
}
.reopen-popup-btn:hover { background: #f5d179; }

.results-box h2 { font-family: 'Cinzel', serif; font-size: 2.2rem; margin-bottom: 8px; font-weight: normal; }
.results-box h3 { font-size: 1.2rem; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px; }
.results-box h3.pirate { color: #f5d179; }
.results-box h3.mutin { color: #e57368; }
.reason { font-size: 0.9rem; margin-bottom: 12px; color: #9fb4c2; }
.chest-total { font-size: 0.95rem; margin-bottom: 20px; color: #f2e6cf; }
.chest-total strong { color: #e0b04a; }

.revealed-roles { margin: 24px 0; border-top: 1px dashed rgba(224, 176, 74, 0.3); border-bottom: 1px dashed rgba(224, 176, 74, 0.3); padding: 20px 0; }
.revealed-roles h4 { margin-bottom: 16px; color: #6fb7b0; font-size: 0.8rem; text-transform: uppercase; font-weight: normal; }
.revealed-roles ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 9px; align-items: center; }
.revealed-roles li { font-size: 0.9rem; }
.revealed-roles li.pirate { color: #f5d179; }
.revealed-roles li.mutin { color: #e57368; }
.drowned { opacity: 0.8; }

.host-actions { display: flex; flex-direction: column; gap: 14px; margin-top: 26px; align-items: center; }

@keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

@media (max-width: 600px) {
  .results-box { padding: 28px 20px; }
  .results-box h2 { font-size: 1.8rem; }
}
</style>
