<template>
  <div 
    class="tb-card-wrapper" 
    :class="{ 'revealed': isRevealed, 'can-be-cut': canBeCut, 'was-cut': wasCut }" 
    @click="onCut"
  >
    <div class="card-face card-back">
      <div class="industrial-pattern">
        <div class="bomb-logo">💣</div>
      </div>
    </div>

    <div class="card-face card-front" :class="type">
      <div class="wire-design">
        <div v-if="type === 'bomb'" class="icon">💥</div>
        <div v-else-if="type === 'defuse'" class="icon">✂️✅</div>
        <div v-else-if="type === 'wire'" class="icon">⚪</div>
        <div v-else-if="type === 'hidden'" class="icon">?</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  type: String, // bomb, defuse, wire, hidden
  isRevealed: Boolean,
  canBeCut: Boolean, // Pour le tour de jeu
  wasCut: Boolean
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
  position: relative; /* 🔴 LE FIX EST ICI : Indispensable pour garder les faces à l'intérieur ! */
  width: 100px;
  height: 150px;
  perspective: 1000px;
  transform-style: preserve-3d; /* 🔴 Améliore grandement l'effet de rotation 3D */
  cursor: default;
  transition: transform 0.2s ease;
}

.card-face {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  backface-visibility: hidden;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 5px 15px rgba(0,0,0,0.4);
  border: 4px solid #a67c00;
}

/* === Dos de la Carte === */
.card-back {
  background: linear-gradient(135deg, #c0392b, #8e1a10);
  transform: rotateY(0deg);
  z-index: 2;
  display: flex; align-items: center; justify-content: center;
}

.industrial-pattern {
  width: 80%; height: 85%;
  border: 2px solid rgba(255,222,89,0.3);
  display: flex; align-items: center; justify-content: center;
}

.bomb-logo { font-size: 3rem; opacity: 0.6; color: #ffde59; }

/* === Face avant (Révélée) === */
.card-front {
  transform: rotateY(180deg);
  z-index: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}

.wire-design {
  width: 80%; height: 85%;
  border: 3px double;
  border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
}

.bomb { background: linear-gradient(135deg, #444, #000); border-color: #e74c3c; }
.bomb .wire-design { border-color: #e74c3c; }

.defuse { background: linear-gradient(135deg, #1f4068, #162447); border-color: #ffde59; }
.defuse .wire-design { border-color: #ffde59; }

.wire { background: linear-gradient(135deg, #bdc3c7, #7f8c8d); border-color: #ecf0f1; }
.wire .wire-design { border-color: #95a5a6; color: black}

.hidden { background: #34495e; border-color: #bdc3c7; }

.icon { font-size: 2.5rem; text-shadow: 0 2px 5px rgba(0,0,0,0.5); color: white; }

/* === États de la Carte === */
.revealed .card-back { transform: rotateY(-180deg); }
.revealed .card-front { transform: rotateY(0deg); z-index: 2; }

/* Hover effects */
.tb-card-wrapper.can-be-cut:not(.revealed) {
  cursor: crosshair;
}
.tb-card-wrapper.can-be-cut:not(.revealed) .card-back:hover {
  transform: scale(1.05) translateY(-5px);
  filter: brightness(1.2) contrast(1.1);
  box-shadow: 0 0 20px #ffde59;
}

.tb-card-wrapper.was-cut .card-front {
  border-color: #e74c3c; /* Rouge Moriarty */
  box-shadow: 0 0 15px #e74c3c, inset 0 0 20px rgba(231, 76, 60, 0.5); /* Lueur rouge d'alerte */
  animation: snip-alert 1s ease-out; /* Petite animation au moment de la coupe */
}

/* Gravure de ciseaux sur la face avant */
.tb-card-wrapper.was-cut .card-front::after {
  content: '✂️';
  position: absolute;
  top: 5px; right: 5px;
  font-size: 1.2rem;
  opacity: 0.8;
  color: white;
}

/* Effet sur l'icône central */
.tb-card-wrapper.was-cut .icon {
  text-shadow: 0 0 10px #e74c3c;
}

@keyframes snip-alert {
  0% { transform: scale(1.1); box-shadow: 0 0 50px #e74c3c; }
  100% { transform: scale(1); box-shadow: 0 0 15px #e74c3c; }
}
</style>