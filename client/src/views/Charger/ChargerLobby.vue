<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <div class="engraved-panel">
        <h1 class="game-title">CHARGER 🛡️</h1>
        <p class="subtitle">Le jeu de cartes stratégique et aléatoire</p>
      </div>
    </header>

    <main class="lobby-main">
      <div class="desk">
        <div class="setup-form create-form">
          <h2>Créer un salon</h2>
          <div class="input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" @keyup.enter="createRoom" />
          </div>
          <button class="action-btn primary" @click="createRoom">Créer la partie</button>
        </div>

        <div class="divider"></div>

        <div class="setup-form join-form">
          <h2>Rejoindre un salon</h2>
          <div class="input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
          </div>
          <div class="input-group">
            <input type="text" v-model="roomCode" placeholder="Code (ex: A4X9P)" @keyup.enter="joinRoom" />
          </div>
          <button class="action-btn secondary" @click="joinRoom">Rejoindre</button>
        </div>
      </div>

      <div class="rules-box">
        <h3>📜 Règles rapides</h3>
        <p>Chaque joueur reçoit <strong>3 cartes</strong> : les 2 plus hautes sont vos <strong>PV</strong>, la plus basse votre <strong>bouclier</strong>.</p>
        <p>À votre tour, piochez une carte et choisissez : <strong>Attaquer</strong>, <strong>Changer un bouclier</strong>, ou <strong>Charger</strong> quelqu'un (max 2 cartes stockées).</p>
        <p>Le dernier survivant remporte la partie ! 🏆</p>
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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

const createRoom = () => {
  if (!playerName.value.trim()) return alert('Choisis un pseudo !')
  const code = generateRoomCode()
  localStorage.setItem('temp_player_name', playerName.value.trim())
  socket.emit('set_player_name', { name: playerName.value.trim(), roomCode: code })
  router.push(`/charger/game/${code}`)
}

const joinRoom = () => {
  if (!playerName.value.trim() || !roomCode.value.trim()) return alert('Pseudo et Code requis !')
  localStorage.setItem('temp_player_name', playerName.value.trim())
  socket.emit('set_player_name', { name: playerName.value.trim(), roomCode: roomCode.value.trim() })
  router.push(`/charger/game/${roomCode.value.trim()}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.lobby-wrapper {
  min-height: 100vh; display: flex; flex-direction: column;
  background: #080e1a; color: #e8eef8; font-family: 'Outfit', sans-serif;
}

.lobby-header {
  padding: 40px 20px; text-align: center;
  background: linear-gradient(180deg, #0d1829 0%, #080e1a 100%);
  border-bottom: 1px solid rgba(60,120,220,0.2);
  margin-bottom: 40px;
}

.game-title {
  font-size: 3.5rem; font-weight: 900; margin: 0;
  background: linear-gradient(135deg, #3a70d0, #7ab8ff, #3a70d0);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 8px rgba(91,163,245,0.4));
}

.subtitle { color: #3a5a8a; font-size: 1.1rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; }

.lobby-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 30px; }

.desk {
  display: flex; align-items: stretch; gap: 0;
  background: #0d1829; padding: 40px; border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.6);
  border: 1px solid rgba(60,120,220,0.2);
}

.divider { width: 1px; background: rgba(60,120,220,0.15); margin: 0 40px; }

.setup-form { display: flex; flex-direction: column; align-items: center; gap: 24px; min-width: 260px; }
.setup-form h2 { color: #5ba3f5; font-size: 1.6rem; font-weight: 700; text-align: center; margin: 0; }

.input-group { width: 100%; }
.input-group input {
  width: 100%; padding: 14px; background: #060c16; border: 2px solid transparent; border-radius: 10px;
  color: #e8eef8; font-family: 'Outfit', sans-serif; font-size: 1.05rem; text-align: center;
  outline: none; transition: 0.3s; box-sizing: border-box;
}
.input-group input::placeholder { color: #1e3a6a; }
.input-group input:focus { border-color: #2456b0; background: #0d1829; }

.action-btn {
  width: 100%; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; padding: 14px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; box-sizing: border-box;
}
.action-btn.primary { background: linear-gradient(135deg, #2456b0, #1a3a80); color: #a8d0ff; }
.action-btn.primary:hover { background: linear-gradient(135deg, #3a70d0, #2456b0); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(36,86,176,0.5); }
.action-btn.secondary { background: #060c16; color: #6a90b8; border: 2px solid #1e3a6a; }
.action-btn.secondary:hover { background: #0d1829; color: #a8d0ff; border-color: #5ba3f5; transform: translateY(-2px); }

.rules-box {
  background: #0d1829; border: 1px solid rgba(60,120,220,0.15); border-radius: 14px;
  padding: 24px 30px; max-width: 620px; width: 100%;
}
.rules-box h3 { color: #5ba3f5; margin: 0 0 14px 0; font-size: 1.1rem; }
.rules-box p { color: #3a5a8a; font-size: 0.9rem; margin: 0 0 8px 0; line-height: 1.6; }
.rules-box p strong { color: #8ab0d8; }

@media (max-width: 768px) {
  .game-title { font-size: 2.5rem; }
  .desk { flex-direction: column; padding: 24px; gap: 30px; }
  .divider { width: 100%; height: 1px; margin: 0; }
  .setup-form { min-width: 0; width: 100%; }
}
</style>