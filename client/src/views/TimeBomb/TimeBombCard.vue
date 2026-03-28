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

      <div v-if="wasCut" class="cut-indicator-overlay">
        <img src="@/assets/images/Ciseaux.svg" alt="Coupé" class="cut-scissors-img" />
        <div class="cut-glow"></div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: String, // bomb, defuse, wire, hidden
  isRevealed: Boolean,
  canBeCut: Boolean, // Pour le tour de jeu
  wasCut: Boolean    // 👈 NOUVEAU : Propriété pour marquer les cartes coupées
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
  position: relative; width: 90px; height: 135px;
  perspective: 1000px; transform-style: preserve-3d; cursor: default;
  transition: transform 0.3s ease;
}

.card-face {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  backface-visibility: hidden; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(205, 164, 52, 0.4); background: #262321;
}

.image-container {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  position: relative; z-index: 1; padding: 10px; box-sizing: border-box;
}

img { max-width: 100%; max-height: 100%; object-fit: contain; }

.unknown-icon-simple { color: #5a554f; font-family: 'Space Mono', monospace; font-size: 2rem; font-weight: normal; }

.cut-indicator-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10;
  pointer-events: none; border: 1px solid #a96c3c; background: rgba(169, 108, 60, 0.1);
}

.card-back { transform: rotateY(0deg); }
.card-front { transform: rotateY(180deg); }
.revealed .card-back { transform: rotateY(-180deg); }
.revealed .card-front { transform: rotateY(0deg); }

.tb-card-wrapper.can-be-cut:not(.revealed) { cursor: crosshair; }
.tb-card-wrapper.can-be-cut:not(.revealed):hover {
  transform: translateY(-8px); border-color: #cda434;
}
.tb-card-wrapper.can-be-cut:not(.revealed):hover .card-face { border-color: #cda434; }
</style>