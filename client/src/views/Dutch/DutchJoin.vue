<template>
  <div class="join-wrapper">
    <div class="join-box">
      <h1>Dutch 🃏</h1>
      <p>Tu as été invité(e) à rejoindre la table <strong>{{ roomCode }}</strong> !</p>

      <div class="input-group">
        <label>Quel est ton pseudo ?</label>
        <input type="text" v-model="pseudo" placeholder="Ex: Alice" @keyup.enter="joinGame" autofocus />
      </div>

      <button class="join-btn" @click="joinGame" :disabled="!pseudo.trim()">
        REJOINDRE LA TABLE 🃏
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
const pseudo = ref(localStorage.getItem('temp_player_name') || '')

const joinGame = () => {
  if (!pseudo.value.trim()) return
  localStorage.setItem('temp_player_name', pseudo.value.trim())
  router.push(`/dutch/game/${roomCode}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.join-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b1424; color: #e8eef7; font-family: 'Outfit', sans-serif; padding: 20px; box-sizing: border-box; }
.join-box { background: #13223a; padding: 40px; text-align: center; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); width: 100%; max-width: 400px; border: 1px solid rgba(255,154,60,0.25); box-sizing: border-box; }

h1 { color: #ff9a3c; margin-bottom: 10px; font-size: 2.5rem; font-weight: 900; }
p { font-size: 1rem; margin-bottom: 40px; color: #a9bfdc; }
p strong { color: #ff9a3c; }

.input-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px; text-align: left; }
label { font-size: 0.8rem; color: #5f7899; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
input {
  padding: 10px 0; background: transparent; border: none; border-bottom: 2px solid #2a3f5f;
  color: #e8eef7; font-family: 'Outfit', sans-serif; font-size: 1.2rem; outline: none; transition: 0.3s;
}
input::placeholder { color: #3a5072; }
input:focus { border-bottom-color: #ff9a3c; }

.join-btn {
  width: 100%; background: linear-gradient(135deg, #f07c22, #c95a12); color: #fff7ee; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 700; padding: 15px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px;
}
.join-btn:hover:not(:disabled) { background: linear-gradient(135deg, #ff8f3a, #db6618); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(240,124,34,0.4); }
.join-btn:disabled { background: #1c2c46; color: #3a5072; cursor: not-allowed; }
</style>
