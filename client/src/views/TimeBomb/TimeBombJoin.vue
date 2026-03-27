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
.join-wrapper { height: 100vh; display: flex; align-items: center; justify-content: center; background: #2c3e50; color: white; font-family: sans-serif;}
.join-box { background: rgba(0,0,0,0.4); padding: 40px; border-radius: 15px; text-align: center; border: 2px solid #ffde59; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 100%; max-width: 400px;}
h1 { color: #ffde59; margin-bottom: 10px; font-size: 2.5rem; }
p { font-size: 1.1rem; margin-bottom: 30px; color: #bdc3c7;}
.input-group { display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px; text-align: left;}
label { font-weight: bold; color: #ffde59; }
input { padding: 12px; font-size: 1.1rem; border-radius: 5px; border: none; outline: none; }
.join-btn { width: 100%; background: #daa520; color: #111; font-weight: bold; font-size: 1.1rem; padding: 15px; border: none; border-radius: 5px; cursor: pointer; transition: 0.2s; text-transform: uppercase;}
.join-btn:hover:not(:disabled) { background: #ffde59; transform: translateY(-2px);}
.join-btn:disabled { background: #7f8c8d; cursor: not-allowed; opacity: 0.7;}
</style>