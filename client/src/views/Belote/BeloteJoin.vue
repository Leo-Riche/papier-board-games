<template>
  <div class="join-wrapper">
    <div class="join-box">
      <h1>Belote ♥</h1>
      <p>Tu as été invité(e) à rejoindre la table <strong>{{ roomCode }}</strong> !</p>

      <div class="input-group">
        <label>Quel est ton pseudo ?</label>
        <input type="text" v-model="pseudo" placeholder="Ex: Alice" @keyup.enter="joinGame" autofocus />
      </div>

      <button class="join-btn" @click="joinGame" :disabled="!pseudo.trim()">
        REJOINDRE LA TABLE ♥
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
  router.push(`/belote/${roomCode}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.join-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a1f16; color: #e8f5ee; font-family: 'Outfit', sans-serif; padding: 20px; box-sizing: border-box; }
.join-box { background: #0f2c20; padding: 40px; text-align: center; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); width: 100%; max-width: 400px; border: 1px solid rgba(80,200,140,0.2); box-sizing: border-box; }

h1 { color: #4fd08a; margin-bottom: 10px; font-size: 2.5rem; font-weight: 900; }
p { font-size: 1rem; margin-bottom: 40px; color: #6a9d84; }
p strong { color: #4fd08a; }

.input-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px; text-align: left; }
label { font-size: 0.8rem; color: #3f6b56; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
input {
  padding: 10px 0; background: transparent; border: none; border-bottom: 2px solid #2f5a44;
  color: #e8f5ee; font-family: 'Outfit', sans-serif; font-size: 1.2rem; outline: none; transition: 0.3s;
}
input::placeholder { color: #2f5a44; }
input:focus { border-bottom-color: #4fd08a; }

.join-btn {
  width: 100%; background: linear-gradient(135deg, #1f9c5f, #157a49); color: #eafff3; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 700; padding: 15px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px;
}
.join-btn:hover:not(:disabled) { background: linear-gradient(135deg, #27b06d, #1f9c5f); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(31,156,95,0.4); }
.join-btn:disabled { background: #123a2a; color: #2f5a44; cursor: not-allowed; }
</style>
