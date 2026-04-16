<template>
  <div class="join-wrapper">
    <div class="join-box">
      <h1>🎲 Qwixx</h1>
      <p>Tu as été invité(e) à rejoindre la salle <strong>{{ roomCode }}</strong> !</p>
      
      <div class="input-group">
        <label>Quel est ton pseudo ?</label>
        <input 
          type="text" 
          v-model="pseudo" 
          placeholder="Ex: Alice" 
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
  router.push(`/qwixx/game/${roomCode}`); 
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.join-wrapper { height: 100vh; display: flex; align-items: center; justify-content: center; background: #121212; color: #ecf0f1; font-family: 'Outfit', sans-serif; }
.join-box { background: #1e1e1e; padding: 40px; text-align: center; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); width: 100%; max-width: 400px; border: 1px solid rgba(255,255,255,0.05); }
h1 { color: #ecf0f1; margin-bottom: 10px; font-size: 2.5rem; font-weight: 900; }
p { font-size: 1rem; margin-bottom: 40px; color: #bdc3c7; }
p strong { color: #e74c3c; font-weight: bold; }

.input-group { display: flex; flex-direction: column; gap: 15px; margin-bottom: 35px; text-align: left; }
label { font-size: 0.85rem; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
input { 
  padding: 10px 0; background: transparent; border: none; border-bottom: 2px solid #34495e;
  color: #ecf0f1; font-family: 'Outfit', sans-serif; font-size: 1.2rem; outline: none; transition: 0.3s;
}
input::placeholder { color: #7f8c8d; }
input:focus { border-bottom-color: #3498db; }

.join-btn { 
  width: 100%; background: #3498db; color: white; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 700; padding: 15px; 
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; 
}
.join-btn:hover:not(:disabled) { background: #2980b9; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4); }
.join-btn:disabled { background: #2c3e50; color: #7f8c8d; cursor: not-allowed; }

@media (max-width: 480px) {
  .join-wrapper { padding: 20px; }
  .join-box { padding: 30px 20px; border-radius: 15px; }
  h1 { font-size: 2rem; }
}

</style>
