<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <div class="engraved-panel">
        <h1 class="game-title">TIME BOMB</h1>
        <p class="subtitle">Enquêtes de Scotland Yard</p>
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
          <BaseButton variant="primary" @click="createRoom">Initialiser Room 🚀</BaseButton>
        </div>

        <div class="form-separator">
          <div class="tb-gear">⚙️</div>
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
          <BaseButton variant="secondary" @click="joinRoom">Rejoindre 🚪</BaseButton>
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

const socket = io('http://localhost:3000')

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
.lobby-wrapper {
  height: 100vh; display: flex; flex-direction: column;
  background: url('@/assets/textures/old_paper.jpg') #2c3e50; /* Idéalement une texture d'ancien papier */
  color: #4a3121;
}

.engraved-panel {
  text-align: center; padding: 30px;
  background: linear-gradient(135deg, #1f4068, #0a1020); /* Bleu Sherlock */
  border-bottom: 5px solid #a67c00;
  box-shadow: 0 5px 20px rgba(0,0,0,0.5);
}

.game-title {
  font-family: 'Times New Roman', serif;
  font-size: 3.5rem; color: #ffde59; text-shadow: 0 2px 0 #8b5a2b; margin: 0;
}

.subtitle { color: #bdc3c7; font-style: italic; margin-top: 5px; }

.lobby-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; }

.investigation-desk {
  display: flex; align-items: stretch; gap: 40px;
  background: rgba(255,255,255,0.05); padding: 50px;
  border-radius: 10px; border: 3px solid rgba(74,49,33,0.3);
  box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
}

.setup-form { display: flex; flex-direction: column; align-items: center; gap: 20px; min-width: 300px;}
.setup-form h2 { color: #8b1a10; font-family: serif; border-bottom: 2px solid #a67c00;}

.tb-input-group { position: relative; width: 100%; }
.tb-input-group input {
  width: 100%; padding: 12px 15px;
  background: #f1e7d0; /* Papier jauni */
  border: 2px solid #8b5a2b; color: black; font-weight: bold; font-size: 1.1rem;
}
.blueprint-line { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: #daa520; transform: scaleX(0); transition: transform 0.3s ease; }
.tb-input-group input:focus + .blueprint-line { transform: scaleX(1); }

.form-separator { display: flex; align-items: center; justify-content: center; }
.tb-gear { font-size: 3rem; color: #8b5a2b; animation: spin 10s linear infinite; opacity: 0.5; }

@keyframes spin { 100% { transform: rotate(360deg); } }
</style>