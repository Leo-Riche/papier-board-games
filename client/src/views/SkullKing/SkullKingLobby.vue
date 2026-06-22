<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <div class="engraved-panel">
        <h1 class="game-title">SKULL KING 💀👑</h1>
        <p class="subtitle">Jeu de plis · Mises de pirates · 3–8 joueurs</p>
      </div>
    </header>

    <main class="lobby-main">
      <div class="investigation-desk">
        <div class="setup-form create-form">
          <h2>Créer un salon</h2>
          <div class="input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" @keyup.enter="createRoom" />
          </div>
          <button class="action-btn primary" @click="createRoom">Créer la partie</button>
        </div>

        <div class="setup-form join-form">
          <h2>Rejoindre un salon</h2>
          <div class="input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
          </div>
          <div class="input-group">
            <input type="text" v-model="roomCode" placeholder="Code (ex: A4X9P)" @keyup.enter="joinRoom" style="text-transform:uppercase" />
          </div>
          <button class="action-btn secondary" @click="joinRoom">Rejoindre</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { io } from 'socket.io-client'

const router = useRouter()
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)

const playerName = ref('')
const roomCode = ref('')

const generateRoomCode = (length = 5) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length))
  return result
}

const createRoom = () => {
  if (!playerName.value) return alert('Choisis un pseudo !')
  const newCode = generateRoomCode()
  localStorage.setItem('temp_player_name', playerName.value)
  socket.emit('set_player_name', { name: playerName.value, roomCode: newCode })
  router.push(`/skullking/game/${newCode}`)
}

const joinRoom = () => {
  if (!playerName.value || !roomCode.value) return alert('Pseudo et Code requis !')
  localStorage.setItem('temp_player_name', playerName.value)
  socket.emit('set_player_name', { name: playerName.value, roomCode: roomCode.value.toUpperCase() })
  router.push(`/skullking/game/${roomCode.value.toUpperCase()}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.lobby-wrapper {
  min-height: 100vh; display: flex; flex-direction: column;
  background: #07101a; color: #ecf0f1; font-family: 'Outfit', sans-serif;
}

.lobby-header {
  padding: 40px 20px;
  background: linear-gradient(180deg, #0a1c2e 0%, #07101a 100%);
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  text-align: center;
  margin-bottom: 40px;
  border-bottom: 1px solid rgba(212, 172, 13, 0.25);
}

.game-title {
  font-size: 3.5rem; font-weight: 900; margin: 0;
  background: linear-gradient(135deg, #f1c40f, #f39c12, #e67e22);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 4px rgba(241, 196, 15, 0.3));
}

.subtitle { color: #5d7a92; font-size: 1.1rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; }

.lobby-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }

.investigation-desk {
  display: flex; align-items: stretch; gap: 40px;
  background: #0c1825; padding: 40px; border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  border: 1px solid rgba(212, 172, 13, 0.15);
}

.setup-form { display: flex; flex-direction: column; align-items: center; gap: 30px; min-width: 280px; }
.setup-form h2 {
  color: #f1c40f; font-size: 1.8rem; font-weight: 700;
  padding-bottom: 10px; width: 100%; text-align: center;
}

.input-group { position: relative; width: 100%; }
.input-group input {
  width: 100%; padding: 15px; background: #122436; border: 2px solid transparent; border-radius: 10px;
  color: #ecf0f1; font-family: 'Outfit', sans-serif; font-size: 1.1rem; text-align: center; outline: none; transition: 0.3s;
  box-sizing: border-box;
}
.input-group input::placeholder { color: #5d7a92; }
.input-group input:focus { border-color: #f1c40f; background: #0c1825; }

.action-btn {
  width: 100%; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; padding: 15px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px;
  box-sizing: border-box;
}
.action-btn.primary { background: linear-gradient(135deg, #f39c12, #e67e22); color: #1a1205; }
.action-btn.primary:hover { background: linear-gradient(135deg, #f1c40f, #f39c12); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(241, 196, 15, 0.4); }
.action-btn.secondary { background: #122436; color: #bdc3c7; border: 2px solid #2c4a63; }
.action-btn.secondary:hover { background: #16314a; color: white; transform: translateY(-2px); border-color: #f1c40f; }

@media (max-width: 480px) {
  .lobby-wrapper { padding-bottom: 20px; padding-left: 10px; padding-right: 10px; }
  .lobby-header { margin-left: -10px; margin-right: -10px; padding: 30px 10px; }
  .investigation-desk { padding: 30px 20px; gap: 30px; }
  .setup-form { min-width: 0; width: 100%; }
}

@media (max-width: 768px) {
  .game-title { font-size: 2.5rem; }
  .investigation-desk { flex-direction: column; align-items: stretch; padding: 20px; gap: 40px; }
  .setup-form { min-width: 100%; }
  .setup-form:first-child {
    border-bottom: 1px solid rgba(212, 172, 13, 0.15);
    padding-bottom: 40px;
  }
}
</style>
