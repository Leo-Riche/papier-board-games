<template>
  <div class="join-wrapper">
    <div class="join-box">
      <h1>💀👑 Skull King</h1>
      <p>Tu as été invité(e) à rejoindre l'équipage <strong>{{ roomCode }}</strong> !</p>

      <div class="input-group">
        <label>Quel est ton nom de pirate ?</label>
        <input
          type="text"
          v-model="pseudo"
          placeholder="Ex: Barbe Rousse"
          @keyup.enter="joinGame"
          autofocus
        />
      </div>

      <button class="join-btn" @click="joinGame" :disabled="!pseudo.trim()">
        MONTER À BORD 🏴‍☠️
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'

const route = useRoute()
const router = useRouter()

const roomCode = route.params.id
const pseudo = ref('')

const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const socket = io(socketUrl)

const joinGame = () => {
  if (!pseudo.value.trim()) return
  localStorage.setItem('temp_player_name', pseudo.value.trim())
  socket.emit('set_player_name', { name: pseudo.value.trim(), roomCode })
  router.push(`/skullking/game/${roomCode}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.join-wrapper { height: 100vh; display: flex; align-items: center; justify-content: center; background: #07101a; color: #ecf0f1; font-family: 'Outfit', sans-serif; }
.join-box { background: #0c1825; padding: 40px; text-align: center; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); width: 100%; max-width: 400px; border: 1px solid rgba(212, 172, 13, 0.2); }
h1 { color: #f1c40f; margin-bottom: 10px; font-size: 2.5rem; font-weight: 900; }
p { font-size: 1rem; margin-bottom: 40px; color: #bdc3c7; }
p strong { color: #f1c40f; font-weight: bold; }

.input-group { display: flex; flex-direction: column; gap: 15px; margin-bottom: 35px; text-align: left; }
label { font-size: 0.85rem; color: #5d7a92; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
input {
  padding: 10px 0; background: transparent; border: none; border-bottom: 2px solid #2c4a63;
  color: #ecf0f1; font-family: 'Outfit', sans-serif; font-size: 1.2rem; outline: none; transition: 0.3s;
}
input::placeholder { color: #5d7a92; }
input:focus { border-bottom-color: #f1c40f; }

.join-btn {
  width: 100%; background: linear-gradient(135deg, #f39c12, #e67e22); color: #1a1205; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 700; padding: 15px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px;
}
.join-btn:hover:not(:disabled) { background: linear-gradient(135deg, #f1c40f, #f39c12); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(241, 196, 15, 0.4); }
.join-btn:disabled { background: #122436; color: #5d7a92; cursor: not-allowed; }

@media (max-width: 480px) {
  .join-wrapper { padding: 20px; }
  .join-box { padding: 30px 20px; border-radius: 15px; }
  h1 { font-size: 2rem; }
}
</style>
