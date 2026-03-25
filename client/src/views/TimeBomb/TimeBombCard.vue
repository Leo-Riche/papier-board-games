<template>
  <div 
    class="tb-card-wrapper" 
    :class="{ 'revealed': isRevealed, 'can-be-cut': canBeCut }" 
    @click="onCut"
  >
    <div class="card-face card-back">
      <div class="image-container">
        <img src="@/assets/images/BackCard.svg" alt="Dos de Carte" />
      </div>
    </div>

    <div class="card-face card-front" :class="type">
      <div class="image-container">
        <img v-if="type === 'bomb'" src="@/assets/images/Bombe.svg" alt="💥" />
        <img v-else-if="type === 'defuse'" src="@/assets/images/Desamorceur.svg" alt="✂️✅" />
        <img v-else-if="type === 'wire'" src="@/assets/images/FilNeutre.svg" alt="⚪" />
        
        <div v-else-if="type === 'hidden'" class="unknown-icon-simple">?</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  type: String, // bomb, defuse, wire, hidden
  isRevealed: Boolean,
  canBeCut: Boolean, // Pour le tour de jeu
  wasCut: Boolean    // NOTE: Propriété conservée pour la logique, style supprimé selon demande
});

const emit = defineEmits(['cut']);

const onCut = () => {
  if (props.canBeCut && !props.isRevealed) {
    emit('cut');
  }
}
</script>

<style scoped>
.tb-card-wrapper {
  position: relative;
  width: 100px;
  height: 150px;
  perspective: 1000px;
  transform-style: preserve-3d;
  cursor: default;
  transition: transform 0.2s ease;
}

.card-face {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  backface-visibility: hidden;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 4px;
  overflow: hidden;
  background-color: transparent;
  border: none;
  box-shadow: none;
}

/* Conteneur d'image centré */
.image-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}

img {
  max-width: 100%; max-height: 100%;
  object-fit: contain;
}

/* Visuel de la carte cachée d'adversaire */
.unknown-icon-simple {
  color: #bdc3c7; font-family: serif; font-size: 2.5rem; font-weight: bold;
}

/* ========================================================== */
/* ANIMATIONS & INTERACTIONS */
/* ========================================================== */

/* === Animation de Retournement (Flip) === */
.card-back { transform: rotateY(0deg); }
.card-front { transform: rotateY(180deg); }

/* Triggers du flip */
.revealed .card-back { transform: rotateY(-180deg); }
.revealed .card-front { transform: rotateY(0deg); }

/* === Interaction de Survol (Highlight) === */
.tb-card-wrapper.can-be-cut:not(.revealed) {
  cursor: crosshair;
}

.tb-card-wrapper.can-be-cut:not(.revealed):hover {
  transform: scale(1.05) translateY(-5px);
}
</style>