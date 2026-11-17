<template>
  <div class="join-wrapper">
    <div class="join-box">
      <h1>🃏 Dutch</h1>
      <p>Tu as été invité(e) à la table <strong>{{ roomCode }}</strong> !</p>

      <div class="input-group">
        <label>Quel est ton pseudo ?</label>
        <input
          type="text"
          v-model="pseudo"
          placeholder="Ex: RoiDeCoeur"
          @keyup.enter="joinGame"
          autofocus
        />
      </div>

      <button class="join-btn" @click="joinGame" :disabled="!pseudo.trim()">
        S'ASSEOIR À LA TABLE 🃏
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
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Space+Mono&display=swap');

.join-wrapper {
  min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
  background: radial-gradient(circle at 50% 0%, #1e6b4c 0%, #0b2e21 75%);
  color: #f1e3c0; font-family: 'Space Mono', monospace;
}
.join-box {
  padding: 40px; text-align: center; border: 1px solid rgba(241, 196, 15, 0.3); box-sizing: border-box;
  border-radius: 16px; background: rgba(6, 30, 21, 0.6); width: 100%; max-width: 400px;
}
h1 { font-family: 'Playfair Display', serif; color: #f1c40f; margin: 0 0 10px; font-size: 2.2rem; }
p { font-size: 0.9rem; margin-bottom: 36px; color: #a8d5ba; }
p strong { color: #f1e3c0; letter-spacing: 2px; }

.input-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px; text-align: left; }
label { font-size: 0.75rem; color: #a8d5ba; text-transform: uppercase; letter-spacing: 1px; }
input {
  padding: 12px; background: rgba(3, 20, 14, 0.6); border: 1px solid rgba(241, 196, 15, 0.3);
  border-radius: 8px; color: #f1e3c0; font-family: 'Space Mono', monospace; font-size: 1rem; outline: none; transition: 0.2s;
}
input::placeholder { color: #5f8a74; }
input:focus { border-color: #f1c40f; }

.join-btn {
  width: 100%; background: #f1c40f; color: #0b2e21; border: none; border-radius: 8px;
  font-family: 'Space Mono', monospace; font-size: 0.9rem; padding: 14px; cursor: pointer;
  transition: 0.2s; letter-spacing: 1px; font-weight: bold;
}
.join-btn:hover:not(:disabled) { background: #f7dc6f; }
.join-btn:disabled { background: #2f4a3d; color: #5f8a74; cursor: not-allowed; }

@media (max-width: 480px) {
  .join-box { padding: 30px 20px; }
  h1 { font-size: 1.8rem; }
}
</style>
