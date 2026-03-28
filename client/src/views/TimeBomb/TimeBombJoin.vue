<template>
  <div class="join-wrapper">
    <div class="join-box">
      <h1>💣 Time Bomb</h1>
      <p>Tu as été invité(e) à rejoindre la salle <strong>{{ roomCode }}</strong> !</p>
      
      <div class="input-group">
        <label>Quel est ton pseudo ?</label>
        <input 
          type="text" 
          v-model="pseudo" 
          placeholder="Ex: Sherlock99" 
          @keyup.enter="joinGame"
          autofocus
        />
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
  if (!pseudo.value.trim()) return;
  localStorage.setItem('temp_player_name', pseudo.value.trim());
  router.push(`/timebomb/game/${roomCode}`); 
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Space+Mono&display=swap');

.join-wrapper { height: 100vh; display: flex; align-items: center; justify-content: center; background: #161514; color: #dfd3c3; font-family: 'Space Mono', monospace; }
.join-box { background: transparent; padding: 40px; text-align: center; border: 1px solid rgba(205, 164, 52, 0.3); width: 100%; max-width: 400px; }
h1 { font-family: 'Cormorant Garamond', serif; color: #cda434; margin-bottom: 10px; font-size: 2.5rem; font-weight: normal; }
p { font-size: 0.9rem; margin-bottom: 40px; color: #8a8277; }
p strong { color: #dfd3c3; letter-spacing: 2px; }

.input-group { display: flex; flex-direction: column; gap: 15px; margin-bottom: 35px; text-align: left; }
label { font-size: 0.75rem; color: #8a8277; text-transform: uppercase; letter-spacing: 1px; }
input { 
  padding: 10px 0; background: transparent; border: none; border-bottom: 1px solid rgba(223, 211, 195, 0.3);
  color: #dfd3c3; font-family: 'Space Mono', monospace; font-size: 1rem; outline: none; transition: 0.3s;
}
input::placeholder { color: #5a554f; }
input:focus { border-bottom-color: #cda434; }

.join-btn { width: 100%; background: transparent; color: #cda434; border: 1px solid #cda434; font-family: 'Space Mono', monospace; font-size: 0.85rem; padding: 15px; cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; }
.join-btn:hover:not(:disabled) { background: rgba(205, 164, 52, 0.1); }
.join-btn:disabled { border-color: #5a554f; color: #5a554f; cursor: not-allowed; }

@media (max-width: 480px) {
  .join-box { padding: 30px 20px; }
  h1 { font-size: 2rem; }
}

</style>