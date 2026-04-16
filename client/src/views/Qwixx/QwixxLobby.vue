<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <div class="engraved-panel">
        <h1 class="game-title">QWIXX 🎲</h1>
        <p class="subtitle">Prenez des risques, marquez des points</p>
      </div>
    </header>

    <main class="lobby-main">
      <div class="investigation-desk">
        <div class="setup-form create-form">
          <h2>Créer un salon</h2>
          <div class="input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
            <div class="blueprint-line"></div>
          </div>
          <button class="action-btn primary" @click="createRoom">Créer la partie</button>
        </div>

        <div class="setup-form join-form">
          <h2>Rejoindre un salon</h2>
          <div class="input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
            <div class="blueprint-line"></div>
          </div>
          <div class="input-group">
            <input type="text" v-model="roomCode" placeholder="Code (ex: A4X9P)" />
            <div class="blueprint-line"></div>
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

// Use the exact same standard as the other games
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const socket = io(socketUrl)

const playerName = ref('')
const roomCode = ref('')

const generateRoomCode = (length = 5) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const createRoom = () => {
  if (!playerName.value) return alert("Choisis un pseudo !")
  
  const newCode = generateRoomCode();

  localStorage.setItem('temp_player_name', playerName.value);
  
  socket.emit('set_player_name', { 
    name: playerName.value, 
    roomCode: newCode 
  })

  router.push(`/qwixx/game/${newCode}`)
}

const joinRoom = () => {
  if (!playerName.value || !roomCode.value) {
    return alert("Pseudo et Code requis !")
  }

  localStorage.setItem('temp_player_name', playerName.value);
  socket.emit('set_player_name', { name: playerName.value, roomCode: roomCode.value });
  router.push(`/qwixx/game/${roomCode.value}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.lobby-wrapper {
  min-height: 100vh; display: flex; flex-direction: column;
  background: #121212; color: #ecf0f1; font-family: 'Outfit', sans-serif;
}

.lobby-header {
  padding: 40px 20px;
  background: #1e1e1e;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  text-align: center;
  margin-bottom: 40px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.game-title {
  font-size: 3.5rem; font-weight: 900; margin: 0;
  background: linear-gradient(135deg, #e74c3c, #3498db, #f1c40f, #2ecc71);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle { color: #7f8c8d; font-size: 1.1rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; }

.lobby-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }

.investigation-desk {
  display: flex; align-items: stretch; gap: 40px;
  background: #1e1e1e; padding: 40px; border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.05);
}

.setup-form { display: flex; flex-direction: column; align-items: center; gap: 30px; min-width: 280px;}
.setup-form h2 { 
  color: #ecf0f1; font-size: 1.8rem; font-weight: 700; 
  padding-bottom: 10px; width: 100%; text-align: center;
}

.input-group { position: relative; width: 100%; }
.input-group input {
  width: 100%; padding: 15px; background: #2b2b2b; border: 2px solid transparent; border-radius: 10px;
  color: #ecf0f1; font-family: 'Outfit', sans-serif; font-size: 1.1rem; text-align: center; outline: none; transition: 0.3s;
  box-sizing: border-box;
}
.input-group input::placeholder { color: #7f8c8d; }
.input-group input:focus { border-color: #3498db; background: #1e1e1e; }

.action-btn { 
  width: 100%; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; padding: 15px; 
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px;
  box-sizing: border-box;
}
.action-btn.primary { background: #3498db; color: white; }
.action-btn.primary:hover { background: #2980b9; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4); }
.action-btn.secondary { background: #2b2b2b; color: #bdc3c7; border: 2px solid #7f8c8d; }
.action-btn.secondary:hover { background: #34495e; color: white; transform: translateY(-2px); border-color: #34495e;}

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
  
  /* Add visual separator on mobile between forms */
  .setup-form:first-child {
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 40px;
  }
}
</style>
