<template>
  <div class="score-sheet" :class="{ 'is-readonly': readOnly, 'is-main-player': isMainPlayer, 'is-opponent': !isMainPlayer }">
    <div class="player-name">{{ playerName }}</div>
    <div class="score-grid">
      <!-- Red Row -->
      <div class="row row-red">
        <div class="row-bg" style="background-color: #ff4757;"></div>
        <button 
          v-for="n in 11" 
          :key="'red-'+(n+1)" 
          class="cell" 
          :class="getCellClass('red', n+1)"
          @click="toggleCell('red', n+1)"
        >
          <span v-if="hasCross('red', n+1)">❌</span>
          <span v-else>{{ n+1 }}</span>
        </button>
        <button class="cell lock" :class="getCellClass('red', 12)" @click="toggleCell('red', 12)">
           <span v-if="hasCross('red', 'lock') || lockedColors.red">🔒</span>
           <span v-else>🔓</span>
        </button>
      </div>
      
      <!-- Yellow Row -->
      <div class="row row-yellow">
        <div class="row-bg" style="background-color: #ffa502;"></div>
        <button 
          v-for="n in 11" 
          :key="'yellow-'+(n+1)" 
          class="cell" 
          :class="getCellClass('yellow', n+1)"
          @click="toggleCell('yellow', n+1)"
        >
          <span v-if="hasCross('yellow', n+1)">❌</span>
          <span v-else>{{ n+1 }}</span>
        </button>
        <button class="cell lock" :class="getCellClass('yellow', 12)" @click="toggleCell('yellow', 12)">
           <span v-if="hasCross('yellow', 'lock') || lockedColors.yellow">🔒</span>
           <span v-else>🔓</span>
        </button>
      </div>
      
      <!-- Green Row -->
      <div class="row row-green">
        <div class="row-bg" style="background-color: #2ed573;"></div>
        <button 
          v-for="n in 11" 
          :key="'green-'+(12-n+1)" 
          class="cell" 
          :class="getCellClass('green', 12-n+1)"
          @click="toggleCell('green', 12-n+1)"
        >
          <span v-if="hasCross('green', 12-n+1)">❌</span>
          <span v-else>{{ 12-n+1 }}</span>
        </button>
        <button class="cell lock" :class="getCellClass('green', 2)" @click="toggleCell('green', 2)">
           <span v-if="hasCross('green', 'lock') || lockedColors.green">🔒</span>
           <span v-else>🔓</span>
        </button>
      </div>
      
      <!-- Blue Row -->
      <div class="row row-blue">
        <div class="row-bg" style="background-color: #1e90ff;"></div>
        <button 
          v-for="n in 11" 
          :key="'blue-'+(12-n+1)" 
          class="cell" 
          :class="getCellClass('blue', 12-n+1)"
          @click="toggleCell('blue', 12-n+1)"
        >
          <span v-if="hasCross('blue', 12-n+1)">❌</span>
          <span v-else>{{ 12-n+1 }}</span>
        </button>
        <button class="cell lock" :class="getCellClass('blue', 2)" @click="toggleCell('blue', 2)">
           <span v-if="hasCross('blue', 'lock') || lockedColors.blue">🔒</span>
           <span v-else>🔓</span>
        </button>
      </div>

      <!-- Penalties -->
      <div class="penalties-section">
        <span>Pénalités (-5 pts chacune) : </span>
        <div class="penalty-boxes">
          <div v-for="p in 4" :key="'pen-'+p" class="penalty-box">
            <span v-if="penalties >= p">❌</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  playerName: String,
  scoreSheet: Object, // {red:[], yellow:[], green:[], blue:[], penalties:0}
  lockedColors: Object,
  readOnly: Boolean,
  dice: Object, // {w1, w2, red, yellow, green, blue}
  isActivePlayer: Boolean,
  selectedCells: Array, // [{color, value, source}] (managed by parent)
  isMainPlayer: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-cell'])

const penalties = computed(() => props.scoreSheet ? props.scoreSheet.penalties : 0)

const hasCross = (color, value) => {
  if (!props.scoreSheet) return false;
  return props.scoreSheet[color].includes(value); 
}

const isSelected = (color, value) => {
  return props.selectedCells.some(c => c.color === color && c.value === value);
}

const isValidCombination = (color, value) => {
  if (!props.dice || props.readOnly) return false;
  
  // Can't select already crossed or locked colors
  if (hasCross(color, value) || props.lockedColors[color]) return false;

  // Enforce ordering rules
  const crossedArr = props.scoreSheet[color].filter(v => v !== 'lock');
  if (crossedArr.length > 0) {
    const lastCrossed = crossedArr[crossedArr.length - 1]; // Assume array is sorted properly by server
    if (color === 'red' || color === 'yellow') {
       if (value <= lastCrossed) return false;
    } else {
       if (value >= lastCrossed) return false;
    }
  }

  // Lock rule constraint (must have >= 5 previous crosses to cross 12/2)
  const isLastBox = (color === 'red' || color === 'yellow') ? value === 12 : value === 2;
  if (isLastBox && crossedArr.length < 5) return false;

  // Let parent handle white/color summation combination validation, 
  // but we can pre-check if it's AT LEAST mathematically possible to click it right now.
  const wSum = props.dice.w1 + props.dice.w2;
  const cSum1 = props.dice.w1 + props.dice[color];
  const cSum2 = props.dice.w2 + props.dice[color];

  return value === wSum || (props.isActivePlayer && (value === cSum1 || value === cSum2));
}

const getCellClass = (color, value) => {
  const classes = [];
  if (props.readOnly) return classes;

  if (hasCross(color, value)) {
    classes.push('crossed');
  } else if (isSelected(color, value)) {
    classes.push('selected');
  } else if (isValidCombination(color, value)) {
    classes.push('valid');
  } else {
    classes.push('invalid');
  }

  return classes.join(' ');
}

const toggleCell = (color, value) => {
  if (props.readOnly) return;
  // If it's not selected and not valid to select, reject
  if (!isSelected(color, value) && !isValidCombination(color, value)) return;
  
  emit('toggle-cell', { color, value });
}
</script>

<style scoped>
.score-sheet {
  background: #1e1e1e; border-radius: 10px; padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  margin-bottom: 20px; font-family: 'Outfit', sans-serif;
  max-width: 100%; margin: 0 auto 20px auto;
  border: 1px solid rgba(255,255,255,0.05);
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;
}

/* GENERAL READONLY (Opponents generally get this if not multi-col) */
.score-sheet.is-opponent { opacity: 0.9; box-shadow: none; border: 1px solid #2b2b2b; padding: 10px; }
.score-sheet.is-opponent .cell { pointer-events: none; width: 30px; height: 30px; font-size: 1rem; }
.score-sheet.is-opponent .row { gap: 4px; padding: 6px; }

/* COMPACT MODE FOR OPPONENTS (4+ players grid) */
.score-sheet.is-opponent.compact-mode { padding: 6px; border-radius: 8px; margin-bottom: 0; }
.score-sheet.is-opponent.compact-mode .player-name { font-size: 0.85rem; margin-bottom: 4px; }
.score-sheet.is-opponent.compact-mode .cell { width: 18px; height: 18px; font-size: 0.7rem; border-radius: 3px; }
.score-sheet.is-opponent.compact-mode .row { gap: 2px; padding: 3px; border-radius: 6px; }
.score-sheet.is-opponent.compact-mode .penalty-box { width: 14px; height: 14px; font-size: 0.7rem; }
.score-sheet.is-opponent.compact-mode .penalties-section { font-size: 0.75rem; padding: 4px 0; gap: 5px; }

/* MAIN PLAYER OVERRIDES */
.score-sheet.is-main-player { padding: 25px; }
.score-sheet.is-main-player .cell { width: 45px; height: 45px; font-size: 1.4rem; border-radius: 8px; }
.score-sheet.is-main-player .row { gap: 8px; padding: 12px; border-radius: 10px; }
.score-sheet.is-main-player .player-name { font-size: 1.5rem; margin-bottom: 15px; }

/* Main player gets a slightly dimmed look when read-only, but keeps size! */
.score-sheet.is-main-player.is-readonly { opacity: 0.7; }
.score-sheet.is-main-player.is-readonly .cell { pointer-events: none; }

.player-name { font-size: 1.2rem; font-weight: 700; color: #ecf0f1; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; position: sticky; left: 0; }

.score-grid { display: flex; flex-direction: column; gap: 8px; min-width: fit-content; }

.row {
  display: flex; gap: 6px; padding: 8px; border-radius: 8px; position: relative; overflow: hidden; align-items: center; justify-content: center;
}
.row-bg { position: absolute; top:0; left:0; right:0; bottom:0; opacity: 0.25; z-index: 0; pointer-events: none; }

.cell {
  position: relative; z-index: 1; width: 40px; height: 40px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
  background: rgba(0, 0, 0, 0.4); box-shadow: inset 0 2px 5px rgba(0,0,0,0.5);
  font-weight: 700; font-size: 1.2rem; cursor: pointer; transition: 0.2s;
  display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.9);
  font-family: inherit;
}

.cell.valid { 
  border-color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.1);
  box-shadow: 0 0 10px rgba(255,255,255,0.3); animation: pulse 2s infinite; 
}
.cell.valid:hover { transform: scale(1.1); background: rgba(255,255,255,0.2); }

.cell.selected { 
  background: #f1c40f; color: #121212; border-color: #f1c40f; 
  transform: scale(1.1); box-shadow: 0 5px 15px rgba(241, 196, 15, 0.4); 
}

.cell.crossed { 
  background: rgba(0,0,0,0.1); border-color: rgba(255,255,255,0.05); color: transparent; box-shadow: none;
}
.cell.crossed::before, .cell.crossed::after {
  content: ''; position: absolute; width: 70%; height: 3px; background: rgba(255,255,255,0.8);
  top: 50%; left: 15%; border-radius: 2px;
}
.cell.crossed::before { transform: translateY(-50%) rotate(45deg); }
.cell.crossed::after { transform: translateY(-50%) rotate(-45deg); }

.cell.invalid { opacity: 0.5; cursor: not-allowed; }

.cell.lock { border-radius: 50%; }

.penalties-section { 
  display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 10px 0;
  font-weight: 700; font-size: 0.9rem; color: #bdc3c7;
}

.penalty-boxes { display: flex; gap: 5px; }

.penalty-box { 
  width: 30px; height: 30px; border: 2px solid #34495e; border-radius: 5px; background: #2b2b2b;
  display: flex; align-items: center; justify-content: center; font-size: 1.2rem;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@media (max-width: 600px) {
  .score-sheet { padding: 10px; border-radius: 8px; }
  .cell { width: 26px; height: 26px; font-size: 0.9rem; border-radius: 4px; }
  .is-readonly .cell { width: 18px; height: 18px; font-size: 0.7rem; border-radius: 3px; }
  .row { gap: 4px; padding: 6px; border-radius: 6px; }
  .player-name { font-size: 1rem; }
  .penalties-section { font-size: 0.8rem; padding: 5px 0; }
  .penalty-box { width: 22px; height: 22px; font-size: 1rem; }
}
</style>
