<template>
  <div class="lobby-waiting">
    <h2>Salle : {{ roomCode }}</h2>
    
    <div class="players-list-container">
      <h3>Joueurs connectés ({{ players.length }}) :</h3>
      <ul class="players-list">
        <li v-for="p in players" :key="p.id" :class="{ 'is-me': p.id === socketId }">
          👤 {{ p.name }} {{ p.id === socketId ? '(Moi)' : '' }}
        </li>
      </ul>
    </div>

    <div v-if="amIHost">
      <p v-if="players.length < 2" class="info-msg">
        Attends au moins un autre joueur...
      </p>
      <BaseButton 
        variant="primary" 
        :disabled="players.length < 2" 
        @click="$emit('start')"
      >
        LANCER LA PARTIE 🚀
      </BaseButton>
    </div>

    <div v-else class="info-msg">
      <p>En attente du chef de salle pour lancer la partie...</p>
    </div>
  </div>
</template>

<script setup>
import BaseButton from '@/components/BaseButton.vue'

defineProps({
  roomCode: String,
  players: Array,
  socketId: String,
  amIHost: Boolean
});

defineEmits(['start']);
</script>

<style scoped>
.lobby-waiting { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center; }
.players-list-container { background: rgba(0,0,0,0.3); padding: 25px; border-radius: 15px; min-width: 320px; }
.players-list { list-style: none; padding: 0; margin-top: 15px; text-align: left; }
.players-list li { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 1.1rem; }
.is-me { color: #ffde59; font-weight: bold; }
.info-msg { font-size: 0.9rem; color: #bdc3c7; font-style: italic; }
</style>