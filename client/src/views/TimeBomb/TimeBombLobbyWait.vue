<template>
  <div class="lobby-waiting">
    <h2>Salle : {{ roomCode }}</h2>
    <button class="share-btn" @click="copyJoinLink">
      {{ copyButtonText }}
    </button>
    
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
      <p v-if="players.length > 10" class="info-msg">
        Il y a trop de joueurs (max 10) ! Certains devront partir...
      </p>
      <BaseButton 
        variant="primary" 
        :disabled="players.length < 4 || players.length > 10" 
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
import { ref } from 'vue';

const copyButtonText = ref('🔗 Copier le lien d\'invitation')

const copyJoinLink = async () => {
  const joinUrl = `${window.location.origin}/join/${props.roomCode}`
  
  try {
    await navigator.clipboard.writeText(joinUrl)
    copyButtonText.value = '✅ Lien copié !'
    
    setTimeout(() => {
      copyButtonText.value = '🔗 Copier le lien d\'invitation'
    }, 2000)
  } catch (err) {
    console.error('Erreur lors de la copie :', err)
    copyButtonText.value = '❌ Erreur de copie'
  }
}

const props = defineProps({
  roomCode: String,
  players: Array,
  socketId: String,
  amIHost: Boolean
});

defineEmits(['start']);
</script>

<style scoped>
.lobby-waiting { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; text-align: center; font-family: 'Space Mono', monospace; }

h2 { font-family: 'Cormorant Garamond', serif; font-size: 2rem; color: #cda434; font-weight: normal; letter-spacing: 2px; margin: 0;}

.players-list-container {
  background: #1c1a19; border: 1px solid rgba(205, 164, 52, 0.3);
  padding: 30px 40px; min-width: 350px;
}

.players-list-container h3 { color: #8a8277; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; font-weight: normal; }

.players-list { list-style: none; padding: 0; margin: 0; }
.players-list li {
  padding: 10px 0; border-bottom: 1px dashed rgba(223, 211, 195, 0.1);
  font-size: 1rem; color: #dfd3c3; text-align: left;
}
.players-list li:last-child { border-bottom: none; }

.is-me { color: #cda434 !important; font-weight: bold; }

.info-msg { font-size: 0.85rem; color: #a96c3c; border: 1px solid rgba(169, 108, 60, 0.3); padding: 10px 20px; background: rgba(169, 108, 60, 0.05); }

.share-btn {
  background: transparent; color: #dfd3c3; border: 1px solid #5a554f;
  padding: 8px 15px; cursor: pointer; font-family: 'Space Mono', monospace; font-size: 0.8rem;
  transition: all 0.2s; text-transform: uppercase;
}
.share-btn:hover { border-color: #cda434; color: #cda434; }
</style>