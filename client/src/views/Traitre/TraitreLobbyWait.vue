<template>
  <div class="lobby-waiting">
    <h2>Salon : {{ roomCode }}</h2>
    <button class="share-btn" @click="copyJoinLink">{{ copyButtonText }}</button>

    <div class="players-list-container">
      <h3>Équipage à bord ({{ players.length }}) :</h3>
      <ul class="players-list">
        <li v-for="p in players" :key="p.id" :class="{ 'is-me': p.id === socketId }">
          🏴‍☠️ {{ p.name }} {{ p.id === socketId ? '(Moi)' : '' }} {{ p.isHost ? '👑' : '' }}
        </li>
      </ul>
    </div>

    <div class="rules-hint">
      <p>3 à 8 joueurs · Des Mutins se cachent parmi l'équipage. Remplissez le Coffre… ou sabotez la collecte !</p>
    </div>

    <div v-if="amIHost">
      <p v-if="players.length < 3" class="info-msg">Il faut au moins 3 joueurs pour appareiller...</p>
      <p v-else-if="players.length > 8" class="info-msg">Trop de monde à bord (8 max) !</p>
      <BaseButton
        variant="primary"
        :disabled="players.length < 3 || players.length > 8"
        @click="$emit('start')"
      >
        LANCER LA PARTIE 🏴‍☠️
      </BaseButton>
    </div>
    <div v-else class="info-msg">
      <p>En attente du Capitaine pour lancer la partie...</p>
    </div>
  </div>
</template>

<script setup>
import BaseButton from '@/components/BaseButton.vue'
import { ref } from 'vue'

const props = defineProps({
  roomCode: String,
  players: Array,
  socketId: String,
  amIHost: Boolean,
})
defineEmits(['start'])

const copyButtonText = ref('🔗 Copier le lien d\'invitation')
const copyJoinLink = async () => {
  const joinUrl = `${window.location.origin}/traitre/join/${props.roomCode}`
  try {
    await navigator.clipboard.writeText(joinUrl)
    copyButtonText.value = '✅ Lien copié !'
    setTimeout(() => { copyButtonText.value = '🔗 Copier le lien d\'invitation' }, 2000)
  } catch (err) {
    console.error('Erreur lors de la copie :', err)
    copyButtonText.value = '❌ Erreur de copie'
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Space+Mono&display=swap');

.lobby-waiting {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 30px; text-align: center; font-family: 'Space Mono', monospace; padding: 20px;
}
h2 { font-family: 'Cinzel', serif; font-size: 2rem; color: #e0b04a; font-weight: normal; letter-spacing: 2px; margin: 0; }

.players-list-container {
  background: rgba(8, 24, 36, 0.7); border: 1px solid rgba(224, 176, 74, 0.3); border-radius: 12px;
  padding: 26px 40px; min-width: 340px; max-width: 100%; box-sizing: border-box;
}
.players-list-container h3 { color: #6fb7b0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; font-weight: normal; }
.players-list { list-style: none; padding: 0; margin: 0; }
.players-list li { padding: 9px 0; border-bottom: 1px dashed rgba(242, 230, 207, 0.12); font-size: 1rem; color: #f2e6cf; text-align: left; }
.players-list li:last-child { border-bottom: none; }
.is-me { color: #e0b04a !important; font-weight: bold; }

.rules-hint { max-width: 480px; color: #9fb4c2; font-size: 0.82rem; line-height: 1.5; }

.info-msg { font-size: 0.85rem; color: #d98c4a; border: 1px solid rgba(217, 140, 74, 0.3); padding: 10px 20px; border-radius: 8px; background: rgba(217, 140, 74, 0.05); margin-bottom: 14px; }

.share-btn {
  background: transparent; color: #f2e6cf; border: 1px solid #3a4a55; border-radius: 8px; padding: 8px 15px;
  cursor: pointer; font-family: 'Space Mono', monospace; font-size: 0.8rem; transition: all 0.2s; text-transform: uppercase;
}
.share-btn:hover { border-color: #e0b04a; color: #e0b04a; }

@media (max-width: 480px) {
  .players-list-container { min-width: 100%; padding: 20px; }
  h2 { font-size: 1.5rem; }
}
</style>
