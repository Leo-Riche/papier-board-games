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
      <p v-if="players.length < 4" class="info-msg">
        Attends au moins un autre joueur...
      </p>
      <p v-if="players.length > 9" class="info-msg">
        Il y a trop de joueurs (max 8) ! Certains devront partir...
      </p>
      <BaseButton 
        variant="primary" 
        :disabled="players.length < 4 || players.length > 8" 
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
.lobby-waiting { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 30px; text-align: center; }

h2 { font-size: 2.5rem; color: #daa520; text-shadow: 0 2px black; font-family: serif;}

.players-list-container {
  background: url('@/assets/textures/blueprint.png') #0a1020; /* Idéalement texture blueprint bleu */
  border: 5px solid #a67c00; padding: 30px; border-radius: 10px;
  min-width: 350px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}

.players-list-container h3 { color: white; border-bottom: 2px solid rgba(255,222,89,0.3); padding-bottom: 10px;}

.players-list { list-style: none; padding: 0; margin-top: 15px; }
.players-list li {
  padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1);
  font-size: 1.2rem; color: #bdc3c7; display: flex; align-items: center; justify-content: center;
}
.players-list li .badge { margin-right: 10px; opacity: 0.7;}

.is-me {
  background: rgba(255,222,89,0.1);
  color: #ffde59; font-weight: bold; border-radius: 5px;
}

.info-msg { font-size: 1rem; color: #ffcc00; font-style: italic; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 20px;}
</style>