<template>
  <div class="card-container" :class="{ 'is-flipped': isRevealed }" @click="handleCardClick">
    <div class="card-inner">
      
      <div class="card-back">
        <div class="logo">💣</div>
        <div v-if="canBeCut" class="scissors-icon">✂️</div>
      </div>

      <div class="card-front" :class="cardTypeClass">
        <div class="card-label">{{ translatedType }}</div>
        <div class="card-icon">{{ cardIcon }}</div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: String,       // 'wire' (neutre), 'defuse' (succès), 'bomb' (défaite)
  isRevealed: Boolean, // Est-ce que la carte est retournée ?
  canBeCut: Boolean    // Est-ce que c'est le tour du joueur de couper ici ?
})

const emit = defineEmits(['cut'])

// Gestion des classes CSS selon le type de carte
const cardTypeClass = computed(() => {
  if (!props.isRevealed) return ''
  return `type-${props.type}`
})

// Traduction simple pour l'affichage
const translatedType = computed(() => {
  const types = { 'wire': 'FIL NEUTRE', 'defuse': 'DÉS AMORÇAGE', 'bomb': 'BOMBE !' }
  return types[props.type] || '?'
})

// Icône selon le type
const cardIcon = computed(() => {
  const icons = { 'wire': '⚪', 'defuse': '✂️✅', 'bomb': '💥' }
  return icons[props.type] || '❓'
})

const handleCardClick = () => {
  if (props.canBeCut && !props.isRevealed) {
    emit('cut')
  }
}
</script>

<style scoped>
.card-container {
  width: 100px;
  height: 150px;
  perspective: 1000px; /* Nécessaire pour l'effet 3D */
  cursor: pointer;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

/* Classe déclenchée quand la carte est révélée */
.is-flipped .card-inner {
  transform: rotateY(180deg);
}

.card-back, .card-front {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden; /* Cache le dos quand on retourne */
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  font-weight: bold;
}

/* Style Dos de carte */
.card-back {
  background: linear-gradient(135deg, #2c3e50 0%, #000000 100%);
}

.logo { font-size: 2rem; }
.scissors-icon { margin-top: 10px; font-size: 1.2rem; animation: bounce 1s infinite; }

/* Style Face de carte */
.card-front {
  background: white;
  color: black;
  transform: rotateY(180deg);
}

.type-wire { background: #bdc3c7; }
.type-defuse { background: #2ecc71; color: white; }
.type-bomb { background: #e74c3c; color: white; }

.card-icon { font-size: 2.5rem; margin-top: 10px; }

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
</style>