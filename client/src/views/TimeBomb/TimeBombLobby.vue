<template>
  <div class="lobby-container">
    <div class="back-wrapper">
      <BaseButton @click="$router.push('/')" variant="secondary">
        ← Accueil
      </BaseButton>
    </div>
    
    <div class="lobby-box">
      <h2>Lobby - Time Bomb 💣</h2>
      
      <div class="setup-section">
        <BaseInput 
          v-model="playerName" 
          label="Ton Pseudo" 
          placeholder="Ex: Sherlock_Holmes" 
        />
        
        <div class="actions">
          <BaseButton @click="createRoom" variant="primary">
            Créer un salon
          </BaseButton>
          
          <div class="separator">
            <span class="line"></span>
            <span class="text">OU</span>
            <span class="line"></span>
          </div>
          
          <div class="join-group">
            <BaseInput 
              v-model="roomCode" 
              label="Code du salon" 
              placeholder="Ex: ABCD" 
            />
            <BaseButton @click="joinRoom" variant="secondary">
              Rejoindre
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
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
.lobby-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  background-color: #121212;
  position: relative;
  padding: 20px;
}

.back-wrapper {
  position: absolute;
  top: 20px;
  left: 20px;
}

.lobby-box {
  background: #1a1a1a;
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-width: 450px;
  text-align: center;
}

h2 {
  margin-bottom: 30px;
  color: #ffde59;
}

.setup-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.separator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
}
.line { flex: 1; height: 1px; background: #333; }
.text { font-size: 0.8rem; color: #666; font-weight: bold; }

.join-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(255, 255, 255, 0.03);
  padding: 15px;
  border-radius: 10px;
}
</style>