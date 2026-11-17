<template>
  <div v-if="faceDown" class="playing-card card-back-face"></div>

  <div v-else class="playing-card" :class="suitColor">
    <div class="card-corner top-left">
      <span class="card-val">{{ displayValue }}</span>
      <span class="card-suit-sm">{{ suitSymbol }}</span>
    </div>

    <div class="card-body">
      <span v-if="isAce" class="pip pip-ace">{{ suitSymbol }}</span>
      <span v-else-if="isFace" class="card-face">{{ displayValue }}</span>
      <template v-else>
        <span
          v-for="(pip, i) in pips"
          :key="i"
          class="pip"
          :class="{ 'pip-flip': pip.rotated }"
          :style="{ left: pip.x + '%', top: pip.y + '%' }"
        >{{ suitSymbol }}</span>
      </template>
    </div>

    <div class="card-corner bottom-right">
      <span class="card-val">{{ displayValue }}</span>
      <span class="card-suit-sm">{{ suitSymbol }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, default: null },
  faceDown: { type: Boolean, default: false },
})

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const SUIT_COLORS = { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' }

const suitSymbol = computed(() => SUIT_SYMBOLS[props.card?.suit] || '')
const suitColor = computed(() => SUIT_COLORS[props.card?.suit] || 'black')

const displayValue = computed(() => {
  const v = props.card?.value
  if (!v) return ''
  if (v.startsWith('0')) return v.slice(1)
  return v
})

const numVal = computed(() => {
  const n = parseInt(props.card?.value, 10)
  return isNaN(n) ? 0 : n
})

const isAce = computed(() => props.card?.value === 'A')
const isFace = computed(() => ['J', 'Q', 'K'].includes(props.card?.value))

const PIP_LAYOUTS = {
  2: [[50, 18, false], [50, 82, true]],
  3: [[50, 15, false], [50, 50, false], [50, 85, true]],
  7: [[28, 15, false], [72, 15, false], [50, 32, false], [28, 50, false], [72, 50, false], [28, 78, true], [72, 78, true]],
  8: [[28, 13, false], [72, 13, false], [50, 30, false], [28, 50, false], [72, 50, false], [50, 70, true], [28, 87, true], [72, 87, true]],
  9: [[28, 13, false], [72, 13, false], [28, 34, false], [72, 34, false], [50, 50, false], [28, 66, true], [72, 66, true], [28, 87, true], [72, 87, true]],
  10: [[28, 10, false], [72, 10, false], [50, 23, false], [28, 37, false], [72, 37, false], [28, 63, true], [72, 63, true], [50, 77, true], [28, 90, true], [72, 90, true]],
}

const pips = computed(() => {
  const layout = PIP_LAYOUTS[numVal.value]
  if (!layout) return []
  return layout.map(([x, y, rotated]) => ({ x, y, rotated }))
})
</script>

<style scoped>
.playing-card {
  background: #ffffff;
  border: 1.5px solid #dcdde1;
  border-radius: 6px;
  position: relative;
  display: block;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  flex-shrink: 0;
  container-type: inline-size;
  isolation: isolate; /* confine le z-index des coins à la carte (sinon ils débordent sur la carte suivante) */
}
.playing-card.red { color: #e74c3c; }
.playing-card.black { color: #1e272e; }

.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  gap: 1px;
  z-index: 2;
}
.card-corner.top-left { top: 5%; left: 9%; }
.card-corner.bottom-right { bottom: 5%; right: 9%; transform: rotate(180deg); }

.card-val { font-size: 18cqw; font-weight: 900; line-height: 1; }
.card-suit-sm { font-size: 19cqw; line-height: 1; }

.card-body { position: absolute; inset: 24% 10% 24% 10%; }

.pip-ace {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 44cqw; line-height: 1;
}
.card-face {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 34cqw; font-weight: 900; line-height: 1;
}
.pip {
  position: absolute; font-size: 15cqw; line-height: 1;
  transform: translate(-50%, -50%); user-select: none;
}
.pip.pip-flip { transform: translate(-50%, -50%) rotate(180deg); }
/* petites cartes (pli sur mobile, etc.) : pips un peu plus petits pour ne pas se toucher */
@container (max-width: 74px) { .pip { font-size: 13cqw; } }

/* Dos de carte */
.card-back-face {
  border: 1.5px solid #24406e;
  border-radius: 6px;
  flex-shrink: 0;
  container-type: inline-size;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    repeating-linear-gradient(45deg, rgba(122, 184, 255, 0.10) 0 3px, transparent 3px 11px),
    repeating-linear-gradient(-45deg, rgba(122, 184, 255, 0.10) 0 3px, transparent 3px 11px),
    linear-gradient(145deg, #12213c, #1c3358);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
}
</style>
