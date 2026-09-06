<template>
  <div class="join-wrapper">
    <div class="join-box">
      <h1>🏴‍☠️ Traître à bord</h1>
      <p>Tu as été invité(e) à monter à bord du salon <strong>{{ roomCode }}</strong> !</p>

      <div class="input-group">
        <label>Quel est ton pseudo ?</label>
        <input
          type="text"
          v-model="pseudo"
          placeholder="Ex: BarbeNoire"
          @keyup.enter="joinGame"
          autofocus
        />
      </div>

      <button class="join-btn" @click="joinGame" :disabled="!pseudo.trim()">
        MONTER À BORD ⚓
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
  router.push(`/traitre/${roomCode}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Space+Mono&display=swap');

.join-wrapper {
  height: 100vh; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 0%, #123146 0%, #08151f 70%);
  color: #f2e6cf; font-family: 'Space Mono', monospace;
}
.join-box {
  padding: 40px; text-align: center; border: 1px solid rgba(224, 176, 74, 0.3);
  border-radius: 16px; background: rgba(8, 24, 36, 0.6); width: 100%; max-width: 400px;
}
h1 { font-family: 'Cinzel', serif; color: #e0b04a; margin-bottom: 10px; font-size: 2.2rem; font-weight: normal; }
p { font-size: 0.9rem; margin-bottom: 36px; color: #9fb4c2; }
p strong { color: #f2e6cf; letter-spacing: 2px; }

.input-group { display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px; text-align: left; }
label { font-size: 0.75rem; color: #6fb7b0; text-transform: uppercase; letter-spacing: 1px; }
input {
  padding: 12px; background: rgba(4, 16, 25, 0.6); border: 1px solid rgba(224, 176, 74, 0.3);
  border-radius: 8px; color: #f2e6cf; font-family: 'Space Mono', monospace; font-size: 1rem; outline: none; transition: 0.2s;
}
input::placeholder { color: #5a7080; }
input:focus { border-color: #e0b04a; }

.join-btn {
  width: 100%; background: #e0b04a; color: #08151f; border: none; border-radius: 8px;
  font-family: 'Cinzel', serif; font-size: 0.95rem; padding: 14px; cursor: pointer;
  transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;
}
.join-btn:hover:not(:disabled) { background: #f5d179; }
.join-btn:disabled { background: #3a4a55; color: #5a7080; cursor: not-allowed; }

@media (max-width: 480px) {
  .join-box { padding: 30px 20px; }
  h1 { font-size: 1.8rem; }
}
</style>
