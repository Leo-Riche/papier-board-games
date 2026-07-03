<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <h1 class="game-title">TRAÎTRE À BORD</h1>
      <p class="subtitle">Pirates 🏴‍☠️ contre Mutins 🗡️</p>
    </header>

    <main class="lobby-main">
      <div class="deck">
        <div class="setup-form">
          <h2>Créer un salon</h2>
          <div class="tr-input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
          </div>
          <BaseButton variant="primary" @click="createRoom">Hisser les voiles ⚓</BaseButton>
        </div>

        <div class="separator"></div>

        <div class="setup-form">
          <h2>Rejoindre un salon</h2>
          <div class="tr-input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
          </div>
          <div class="tr-input-group">
            <input type="text" v-model="roomCode" placeholder="Code (ex: A4X9P)" />
          </div>
          <BaseButton variant="secondary" @click="joinRoom">Monter à bord</BaseButton>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import BaseButton from '@/components/BaseButton.vue'

const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)

const playerName = ref('')
const roomCode = ref('')

const generateRoomCode = (length = 5) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

const createRoom = () => {
  if (!playerName.value) return alert('Choisis un pseudo !')
  const newCode = generateRoomCode()
  localStorage.setItem('temp_player_name', playerName.value)
  socket.emit('set_player_name', { name: playerName.value, roomCode: newCode })
  router.push(`/traitre/${newCode}`)
}

const joinRoom = () => {
  if (!playerName.value || !roomCode.value) return alert('Pseudo et Code requis !')
  localStorage.setItem('temp_player_name', playerName.value)
  socket.emit('set_player_name', { name: playerName.value, roomCode: roomCode.value })
  router.push(`/traitre/${roomCode.value}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Space+Mono&display=swap');

.lobby-wrapper {
  min-height: 100vh; display: flex; flex-direction: column;
  background: radial-gradient(circle at 50% 0%, #123146 0%, #08151f 70%);
  color: #f2e6cf; font-family: 'Space Mono', monospace;
}
.lobby-header { text-align: center; padding: 50px 20px 20px; }
.game-title { font-family: 'Cinzel', serif; font-size: 3rem; color: #e0b04a; letter-spacing: 4px; margin: 0; }
.subtitle { color: #6fb7b0; letter-spacing: 2px; text-transform: uppercase; margin-top: 12px; font-size: 0.9rem; }

.lobby-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }
.deck {
  display: flex; align-items: stretch; gap: 40px; padding: 40px;
  border: 1px solid rgba(224, 176, 74, 0.25); border-radius: 16px; background: rgba(8, 24, 36, 0.5);
}
.separator { width: 1px; background: rgba(224, 176, 74, 0.2); }
.setup-form { display: flex; flex-direction: column; align-items: center; gap: 24px; min-width: 260px; }
.setup-form h2 {
  font-family: 'Cinzel', serif; color: #f2e6cf; font-size: 1.4rem; font-weight: normal;
  border-bottom: 1px solid #e0b04a; padding-bottom: 10px; width: 100%; text-align: center;
}
.tr-input-group { width: 100%; }
.tr-input-group input {
  width: 100%; padding: 12px; background: rgba(4, 16, 25, 0.6); border: 1px solid rgba(224, 176, 74, 0.3);
  border-radius: 8px; color: #f2e6cf; font-family: 'Space Mono', monospace; font-size: 1rem;
  text-align: center; outline: none; transition: border-color 0.2s; box-sizing: border-box;
}
.tr-input-group input::placeholder { color: #5a7080; }
.tr-input-group input:focus { border-color: #e0b04a; }

@media (max-width: 768px) {
  .game-title { font-size: 2rem; }
  .deck { flex-direction: column; gap: 24px; padding: 24px; width: 100%; max-width: 400px; }
  .separator { width: 100%; height: 1px; }
  .setup-form { min-width: 100%; }
}
</style>
