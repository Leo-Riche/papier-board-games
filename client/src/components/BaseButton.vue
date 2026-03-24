<template>
  <button 
    class="tb-button" 
    :class="variant" 
    :disabled="disabled" 
    @click="$emit('click')"
  >
    <div class="engraving">
      <slot></slot>
    </div>
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'secondary' }, // primary, secondary
  disabled: { type: Boolean, default: false }
});
defineEmits(['click']);
</script>

<style scoped>
.tb-button {
  font-family: 'Georgia', serif;
  text-transform: uppercase;
  font-weight: bold;
  letter-spacing: 1px;
  padding: 12px 30px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  min-width: 150px;
  box-shadow: 0 4px #4a3121;
  border-radius: 5px; /* Optionnel : adoucit un peu les angles */
}

/* === LA CORRECTION EST ICI === */
.tb-button .engraving {
  position: relative; /* Indispensable pour passer au-dessus du ::before */
  z-index: 1;         /* Passe au premier plan */
  transition: transform 0.1s ease;
}

/* Texture Laiton/Cuivre par défaut en arrière-plan */
.tb-button::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(145deg, #b87333, #e8a75e);
  border: 3px solid #8b5a2b;
  box-shadow: inset 0 2px rgba(255,255,255,0.3);
  border-radius: 5px; /* Doit correspondre à la bordure du bouton */
  z-index: 0; /* Reste en fond */
}

.tb-button.primary::before {
  background: linear-gradient(145deg, #daa520, #ffde59);
  border: 3px solid #a67c00;
}

/* Texte gravé */
.tb-button { color: #2c3e50; text-shadow: 0 1px rgba(255,255,255,0.2); }
.tb-button.primary { color: #4a3121; text-shadow: 0 1px rgba(255,255,255,0.4); }

/* Hover effects */
.tb-button:not(:disabled):hover { transform: translateY(1px); box-shadow: 0 3px #4a3121; }
.tb-button:not(:disabled):hover::before { filter: brightness(1.1); }

/* Click effect */
.tb-button:not(:disabled):active { transform: translateY(4px); box-shadow: 0 0px #4a3121; }

.tb-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>