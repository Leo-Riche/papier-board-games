<template>
  <div class="join-wrapper">
    <div class="join-box">
      <h1>CHARGER 🛡️</h1>
      <p>Tu as été invité(e) à rejoindre la salle <strong>{{ roomCode }}</strong> !</p>

      <div class="input-group">
        <label>Quel est ton pseudo ?</label>
        <input type="text" v-model="pseudo" placeholder="Ex: Alice" @keyup.enter="joinGame" autofocus />
      </div>

      <button class="join-btn" @click="joinGame" :disabled="!pseudo.trim()">
        REJOINDRE LA PARTIE 🚀
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const roomCode = route.params.id
const pseudo = ref('')

const joinGame = () => {
  if (!pseudo.value.trim()) return
  localStorage.setItem('temp_player_name', pseudo.value.trim())
  router.push(`/charger/game/${roomCode}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.join-wrapper { height: 100vh; display: flex; align-items: center; justify-content: center; background: #080e1a; color: #e8eef8; font-family: 'Outfit', sans-serif; padding: 20px; box-sizing: border-box; }
.join-box { background: #0d1829; padding: 40px; text-align: center; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); width: 100%; max-width: 400px; border: 1px solid rgba(60,120,220,0.2); }

h1 { color: #5ba3f5; margin-bottom: 10px; font-size: 2.5rem; font-weight: 900; }
p { font-size: 1rem; margin-bottom: 40px; color: #3a5a8a; }
p strong { color: #5ba3f5; }

.input-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px; text-align: left; }
label { font-size: 0.8rem; color: #1e3a6a; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
input {
  padding: 10px 0; background: transparent; border: none; border-bottom: 2px solid #1e3a6a;
  color: #e8eef8; font-family: 'Outfit', sans-serif; font-size: 1.2rem; outline: none; transition: 0.3s;
}
input::placeholder { color: #1e3a6a; }
input:focus { border-bottom-color: #5ba3f5; }

.join-btn {
  width: 100%; background: linear-gradient(135deg, #2456b0, #1a3a80); color: #a8d0ff; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 700; padding: 15px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px;
}
.join-btn:hover:not(:disabled) { background: linear-gradient(135deg, #3a70d0, #2456b0); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(36,86,176,0.5); }
.join-btn:disabled { background: #060c16; color: #1e3a6a; cursor: not-allowed; }
</style>