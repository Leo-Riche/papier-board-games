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
/* ========================================================== */
/* STYLES DE BASE & STRUCTURE (Indispensables) */
/* ========================================================== */
.tb-card-wrapper {
  position: relative; /* Indispensable pour garder les faces à l'intérieur ! */
  width: 100px;
  height: 150px;
  perspective: 1000px; /* Nécessaire pour l'animation de flip */
  transform-style: preserve-3d;
  cursor: default;
  transition: transform 0.2s ease; /* Animation d'échelle au survol */
}

.card-face {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  backface-visibility: hidden; /* Cache le dos pendant le flip */
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); /* Animation de flip */
  border-radius: 4px; /* Un léger arrondi pour adoucir */
  overflow: hidden;
  background-color: transparent; /* Supprime les dégradés et couleurs */
  border: none;
  box-shadow: none;
}

/* Conteneur d'image centré */
.image-container {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  position: relative; /* C'est ce qui permet à l'image d'être en dessous de l'overlay */
  z-index: 1; /* Reste en dessous */
}

img {
  max-width: 100%; max-height: 100%;
  object-fit: contain; /* S'assure que l'image ne dépasse pas */
  filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5)); /* Ombre portée douce sur l'image */
}

/* Visuel de la carte cachée d'adversaire (simplifié) */
.unknown-icon-simple {
  color: #bdc3c7; font-family: serif; font-size: 2.5rem; font-weight: bold;
}

/* ========================================================== */
/* NOUVEAU : STYLES POUR L'OVERLAY "was-cut" (Demandé) */
/* ========================================================== */

/* Le conteneur d'overlay prend toute la place de la carte */
.cut-indicator-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  z-index: 10;
  pointer-events: none;
  border-radius: 4px;
}

/* L'icône de ciseaux gravée dans le coin supérieur droit */
.cut-scissors {
  position: absolute;
  top: 5px; right: 5px;
  font-size: 1.5rem;
  color: white;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.8)); /* Ombre portée pour le détacher de l'image */
}

/* ========================================================== */
/* ANIMATIONS & INTERACTIONS */
/* ========================================================== */

/* === Animation de Retournement (Flip) === */
.card-back { transform: rotateY(0deg); }
.card-front { transform: rotateY(180deg); } /* Cachée par défaut */

/* Triggers du flip */
.revealed .card-back { transform: rotateY(-180deg); }
.revealed .card-front { transform: rotateY(0deg); }

/* === Interaction de Survol (Highlight) === */
/* L’effet de survol quand c’est à votre de tour de couper */
.tb-card-wrapper.can-be-cut:not(.revealed) {
  cursor: crosshair;
}

.tb-card-wrapper.can-be-cut:not(.revealed):hover {
  transform: scale(1.05) translateY(-5px); /* Animation d'échelle simple */
  filter: brightness(1.2) contrast(1.1); /* Éclaircissement au survol */
}
</style>