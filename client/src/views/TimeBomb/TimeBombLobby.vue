<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <div class="engraved-panel">
        <h1 class="game-title">TIME BOMB</h1>
        <p class="subtitle">Moriarty VS Sherlock</p>
      </div>
    </header>

    <main class="lobby-main">
      <div class="investigation-desk">
        <div class="setup-form create-form">
          <h2>Créer un salon</h2>
          <div class="tb-input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
            <div class="blueprint-line"></div>
          </div>
          <BaseButton variant="primary" @click="createRoom">Initialiser le salon</BaseButton>
        </div>

        <div class="setup-form join-form">
          <h2>Rejoindre un salon</h2>
          <div class="tb-input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
            <div class="blueprint-line"></div>
          </div>
          <div class="tb-input-group">
            <input type="text" v-model="roomCode" placeholder="Code (ex: A4X9P)" />
            <div class="blueprint-line"></div>
          </div>
          <BaseButton variant="secondary" @click="joinRoom">Rejoindre</BaseButton>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import BaseInput from '@/components/BaseInput.vue'
import BaseButton from '@/components/BaseButton.vue'

const router = useRouter()

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

  router.push(`/timebomb/game/${newCode}`)
}

const joinRoom = () => {
  if (!playerName.value || !roomCode.value) {
    return alert("Pseudo et Code requis !")
  }

  localStorage.setItem('temp_player_name', playerName.value);
  socket.emit('set_player_name', { name: playerName.value, roomCode: roomCode.value });
  router.push(`/timebomb/game/${roomCode.value}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Space+Mono&display=swap');

.lobby-wrapper {
  min-height: 100vh; display: flex; flex-direction: column;
  background: #161514; color: #dfd3c3; font-family: 'Space Mono', monospace;
}

.engraved-panel {
  text-align: center; padding: 40px 20px; background: transparent;
  border-bottom: 1px solid rgba(205, 164, 52, 0.3); 
}

.game-title {
  font-family: 'Cormorant Garamond', serif; font-size: 3rem; color: #cda434; 
  letter-spacing: 4px; font-weight: normal; margin: 0;
}

.subtitle { color: #8a8277; font-size: 0.9rem; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; }

.lobby-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }

.investigation-desk {
  display: flex; align-items: stretch; gap: 60px;
  background: transparent; padding: 40px; border: 1px solid rgba(205, 164, 52, 0.2);
}

.setup-form { display: flex; flex-direction: column; align-items: center; gap: 30px; min-width: 280px;}
.setup-form h2 { 
  font-family: 'Cormorant Garamond', serif; color: #dfd3c3; font-size: 1.5rem; font-weight: normal; 
  border-bottom: 1px solid #cda434; padding-bottom: 10px; width: 100%; text-align: center;
}

.tb-input-group { position: relative; width: 100%; }
.tb-input-group input {
  width: 100%; padding: 10px 0; background: transparent; border: none; border-bottom: 1px solid rgba(223, 211, 195, 0.3);
  color: #dfd3c3; font-family: 'Space Mono', monospace; font-size: 1rem; text-align: center; outline: none; transition: border-color 0.3s;
}
.tb-input-group input::placeholder { color: #5a554f; }
.tb-input-group input:focus { border-bottom-color: #cda434; }

@keyframes spin { 100% { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .game-title { font-size: 2rem; }
  .investigation-desk { flex-direction: column; gap: 30px; padding: 20px; width: 100%; max-width: 400px; }
  .setup-form { min-width: 100%; }
  .form-separator { transform: rotate(90deg); margin: 10px 0; }
}
</style>