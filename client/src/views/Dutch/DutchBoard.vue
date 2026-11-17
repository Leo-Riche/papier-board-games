<template>
  <div class="board-wrapper">
    <!-- ── Salle d'attente ─────────────────────────────────────── -->
    <div v-if="gameStatus === 'waiting'" class="lobby-waiting">
      <h2>Table : {{ roomCode }}</h2>
      <button class="share-btn" @click="copyJoinLink">{{ copyButtonText }}</button>

      <div class="players-list-container">
        <h3>Joueurs à table ({{ allConnectedPlayers.length }}) :</h3>
        <ul class="players-list">
          <li v-for="p in allConnectedPlayers" :key="p.id" :class="{ 'is-me': p.id === socket.id }">
            🃏 {{ p.name }} {{ p.id === socket.id ? '(Moi)' : '' }} {{ p.isHost ? '👑' : '' }}
          </li>
        </ul>
      </div>

      <p class="rules-hint">2 à 8 joueurs · Une partie = une manche. Le plus petit total de points l'emporte !</p>

      <div v-if="amIHost" class="host-zone">
        <p v-if="allConnectedPlayers.length < 2" class="info-msg">Il faut au moins 2 joueurs pour commencer...</p>
        <p v-else-if="allConnectedPlayers.length > 8" class="info-msg">Trop de joueurs (8 max) !</p>
        <BaseButton
          variant="primary"
          :disabled="allConnectedPlayers.length < 2 || allConnectedPlayers.length > 8"
          @click="startGame"
        >
          DISTRIBUER LES CARTES 🃏
        </BaseButton>
      </div>
      <p v-else class="info-msg">En attente de l'hôte pour lancer la partie...</p>
    </div>

    <!-- ── Partie en cours / révélation ────────────────────────── -->
    <template v-else-if="state">
      <DutchActiveBoard :state="state" :messages="gameMessages" @action="handleAction" />

      <div v-if="gameStatus === 'finished' && state.results && showResultsPopup" class="results-overlay">
        <div class="results-box">
          <button class="close-popup-btn" @click="showResultsPopup = false">&times;</button>
          <h2>Fin de la manche</h2>
          <h3 class="winners">
            🏆 {{ state.results.winnerNames.length > 1 ? 'Vainqueurs' : 'Vainqueur' }} :
            {{ state.results.winnerNames.join(', ') }}
          </h3>
          <p class="reason">{{ state.results.reason }}</p>
          <p v-if="state.results.dutchName" class="dutch-result" :class="{ ok: state.results.dutchSuccess }">
            {{ state.results.dutchSuccess ? '✅' : '💥' }} Dutch de {{ state.results.dutchName }}
            {{ state.results.dutchSuccess ? 'réussi' : 'raté' }} !
          </p>

          <table class="scores">
            <thead>
              <tr><th>Joueur</th><th>Points</th><th>Cartes</th><th>Manches gagnées</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in state.results.players" :key="p.name" :class="{ winner: p.isWinner }">
                <td>{{ p.isWinner ? '🏆 ' : '' }}{{ p.name }}{{ p.isDeclarer ? ' 📣' : '' }}</td>
                <td>{{ p.score }}</td>
                <td>{{ p.cardCount }}</td>
                <td>{{ p.wins }}</td>
              </tr>
            </tbody>
          </table>

          <div v-if="amIHost" class="host-actions">
            <BaseButton variant="primary" @click="startGame">NOUVELLE MANCHE 🔄</BaseButton>
            <BaseButton variant="secondary" @click="gameStatus = 'waiting'">Retour au salon</BaseButton>
          </div>
          <p v-else class="waiting-host">En attente de l'hôte pour relancer...</p>
        </div>
      </div>

      <button
        v-if="gameStatus === 'finished' && !showResultsPopup"
        class="reopen-popup-btn"
        @click="showResultsPopup = true"
      >
        🏆 Résultats
      </button>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import DutchActiveBoard from './DutchActiveBoard.vue'
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)
const roomCode = route.params.id

const gameStatus = ref('waiting') // 'waiting' | 'playing' | 'finished'
const allConnectedPlayers = ref([])
const amIHost = ref(false)
const state = ref(null)
const gameMessages = ref([])
const showResultsPopup = ref(true)

onMounted(() => {
  socket.on('connect', () => {
    const savedName = localStorage.getItem('temp_player_name')
    if (savedName) {
      socket.emit('set_player_name', { name: savedName, roomCode })
    } else {
      router.push(`/dutch/join/${roomCode}`)
    }
  })

  socket.on('room_full', (message) => {
    alert(message)
    socket.disconnect()
    router.push('/')
  })

  socket.on('dutch_error', (message) => alert(message))

  socket.on('update_players_list', (list) => {
    allConnectedPlayers.value = list
    const me = list.find(p => p.id === socket.id)
    if (me) amIHost.value = me.isHost
  })

  socket.on('game_started', () => {
    gameStatus.value = 'playing'
    gameMessages.value = []
    showResultsPopup.value = true
  })

  socket.on('dutch_state', (data) => {
    state.value = data
    gameStatus.value = data.status
  })

  socket.on('action_log', (msg) => {
    gameMessages.value.push({ text: msg, timestamp: Date.now() })
  })
})

onUnmounted(() => socket.disconnect())

const startGame = () => socket.emit('start_dutch', roomCode)

const handleAction = (actionType, payload = {}) => {
  socket.emit('dutch_action', { roomCode, actionType, payload })
}

const copyButtonText = ref('🔗 Copier le lien d\'invitation')
const copyJoinLink = async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/dutch/join/${roomCode}`)
    copyButtonText.value = '✅ Lien copié !'
  } catch {
    copyButtonText.value = '❌ Erreur de copie'
  }
  setTimeout(() => { copyButtonText.value = '🔗 Copier le lien d\'invitation' }, 2000)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Space+Mono&display=swap');

.board-wrapper {
  min-height: 100vh; display: flex; flex-direction: column;
  background: radial-gradient(circle at 50% 30%, #1e6b4c 0%, #0b2e21 80%);
  color: #f1e3c0; font-family: 'Space Mono', monospace;
}

/* Salle d'attente */
.lobby-waiting {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 26px; text-align: center; padding: 20px;
}
.lobby-waiting h2 { font-family: 'Playfair Display', serif; font-size: 2rem; color: #f1c40f; letter-spacing: 2px; margin: 0; }
.players-list-container {
  background: rgba(6, 30, 21, 0.7); border: 1px solid rgba(241, 196, 15, 0.3); border-radius: 12px;
  padding: 24px 36px; min-width: 320px; max-width: 100%; box-sizing: border-box;
}
.players-list-container h3 { color: #a8d5ba; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px; font-weight: normal; }
.players-list { list-style: none; padding: 0; margin: 0; }
.players-list li { padding: 8px 0; border-bottom: 1px dashed rgba(241, 227, 192, 0.12); text-align: left; }
.players-list li:last-child { border-bottom: none; }
.is-me { color: #f1c40f; font-weight: bold; }
.rules-hint { max-width: 460px; color: #a8d5ba; font-size: 0.82rem; line-height: 1.5; margin: 0; }
.host-zone { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.info-msg {
  font-size: 0.85rem; color: #f0b27a; border: 1px solid rgba(240, 178, 122, 0.3); padding: 10px 20px;
  border-radius: 8px; background: rgba(240, 178, 122, 0.06); margin: 0;
}
.share-btn {
  background: transparent; color: #f1e3c0; border: 1px solid #3f6b56; border-radius: 8px; padding: 8px 15px;
  cursor: pointer; font-family: 'Space Mono', monospace; font-size: 0.8rem; transition: all 0.2s; text-transform: uppercase;
}
.share-btn:hover { border-color: #f1c40f; color: #f1c40f; }

/* Résultats */
.results-overlay {
  position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
  background: rgba(3, 15, 10, 0.55); padding: 16px; box-sizing: border-box;
}
.results-box {
  position: relative; background: rgba(6, 30, 21, 0.97); border: 1px solid #f1c40f; border-radius: 16px;
  padding: 36px; max-width: 560px; width: 100%; box-sizing: border-box; text-align: center;
  max-height: 100%; overflow-y: auto; animation: fadeIn 0.3s ease;
}
.close-popup-btn { position: absolute; top: 8px; right: 14px; background: none; border: none; color: #a8d5ba; font-size: 1.6rem; cursor: pointer; }
.close-popup-btn:hover { color: #f1e3c0; }
.results-box h2 { font-family: 'Playfair Display', serif; font-size: 2rem; margin: 0 0 10px; color: #f1c40f; }
.winners { font-size: 1.1rem; margin: 0 0 8px; }
.reason { font-size: 0.82rem; color: #a8d5ba; margin: 0 0 10px; }
.dutch-result { font-size: 0.9rem; color: #e57368; margin: 0 0 18px; }
.dutch-result.ok { color: #58d68d; }

.scores { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin: 10px 0 20px; }
.scores th { color: #a8d5ba; font-weight: normal; font-size: 0.72rem; text-transform: uppercase; padding: 6px; border-bottom: 1px solid rgba(241, 196, 15, 0.3); }
.scores td { padding: 8px 6px; border-bottom: 1px dashed rgba(241, 227, 192, 0.12); }
.scores tr.winner td { color: #f1c40f; font-weight: bold; }

.host-actions { display: flex; flex-direction: column; gap: 12px; align-items: center; }
.waiting-host { color: #a8d5ba; font-size: 0.85rem; margin: 0; }

.reopen-popup-btn {
  position: fixed; bottom: 20px; right: 20px; z-index: 40; background: #f1c40f; color: #0b2e21; border: none;
  padding: 12px 20px; border-radius: 10px; font-family: 'Space Mono', monospace; font-weight: bold;
  cursor: pointer; box-shadow: 0 4px 15px rgba(241, 196, 15, 0.3);
}

@keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

@media (max-width: 600px) {
  .results-box { padding: 26px 16px; }
  .players-list-container { min-width: 100%; padding: 20px; }
  .scores th:last-child, .scores td:last-child { display: none; }
}
</style>
