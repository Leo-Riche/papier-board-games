<template>
  <!-- Racine unique : la classe de taille passée par le parent (chien-card, hc, mini-card, tc…)
       s'applique toujours, quel que soit le type de carte. -->
  <div class="playing-card" :class="rootClass">
    <!-- Dos de carte -->
    <template v-if="faceDown"></template>

    <!-- Excuse -->
    <template v-else-if="isExcuse">
      <div class="card-corner top-left"><span class="tc-star">★</span></div>
      <div class="excuse-body">
        <span class="excuse-emoji">🎭</span>
        <span class="excuse-label">Excuse</span>
      </div>
      <div class="card-corner bottom-right"><span class="tc-star">★</span></div>
    </template>

    <!-- Atout -->
    <template v-else-if="isTrump">
      <div class="card-corner top-left">
        <span class="card-val">{{ trumpNum }}</span>
        <span class="card-suit-sm">✦</span>
      </div>
      <div class="trump-body">
        <span v-if="isOudler" class="trump-oudler-star">★</span>
        <span class="trump-num">{{ trumpNum }}</span>
        <span v-if="trumpNum === 1" class="trump-tag">Petit</span>
      </div>
      <div class="card-corner bottom-right">
        <span class="card-val">{{ trumpNum }}</span>
        <span class="card-suit-sm">✦</span>
      </div>
    </template>

    <!-- Carte de couleur -->
    <template v-else>
      <div class="card-corner top-left">
        <span class="card-val">{{ displayValue }}</span>
        <span class="card-suit-sm">{{ suitSymbol }}</span>
      </div>
      <div class="card-body">
        <span v-if="isFace" class="card-face">{{ displayValue }}<span class="face-suit">{{ suitSymbol }}</span></span>
        <span v-else-if="isAce" class="pip pip-ace">{{ suitSymbol }}</span>
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
    </template>
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

const isExcuse = computed(() => props.card?.suit === 'excuse')
const isTrump = computed(() => props.card?.suit === 'trump')
const trumpNum = computed(() => parseInt(props.card?.value, 10))
const isOudler = computed(() => isTrump.value && (trumpNum.value === 1 || trumpNum.value === 21))

// Classe de variante appliquée à la racine unique (voir template).
const rootClass = computed(() => {
  if (props.faceDown) return 'card-back-face'
  if (isExcuse.value) return 'tarot-excuse'
  if (isTrump.value) return isOudler.value ? 'tarot-trump oudler' : 'tarot-trump'
  return suitColor.value
})

const suitSymbol = computed(() => SUIT_SYMBOLS[props.card?.suit] || '')
const suitColor = computed(() => SUIT_COLORS[props.card?.suit] || 'black')

const FACE_LABEL = { V: 'V', C: 'C', D: 'D', R: 'R' }
const isFace = computed(() => ['V', 'C', 'D', 'R'].includes(props.card?.value))
const isAce = computed(() => props.card?.value === '01')
const displayValue = computed(() => {
  const v = props.card?.value
  if (!v) return ''
  if (FACE_LABEL[v]) return FACE_LABEL[v]
  return String(parseInt(v, 10))
})
const numVal = computed(() => {
  const n = parseInt(props.card?.value, 10)
  return isNaN(n) ? 0 : n
})

const PIP_LAYOUTS = {
  2: [[50, 18, false], [50, 82, true]],
  3: [[50, 15, false], [50, 50, false], [50, 85, true]],
  4: [[30, 18, false], [70, 18, false], [30, 82, true], [70, 82, true]],
  5: [[30, 18, false], [70, 18, false], [50, 50, false], [30, 82, true], [70, 82, true]],
  6: [[30, 15, false], [70, 15, false], [30, 50, false], [70, 50, false], [30, 85, true], [70, 85, true]],
  7: [[28, 15, false], [72, 15, false], [50, 32, false], [28, 50, false], [72, 50, false], [28, 78, true], [72, 78, true]],
  8: [[28, 13, false], [72, 13, false], [50, 30, false], [28, 50, false], [72, 50, false], [50, 70, true], [28, 87, true], [72, 87, true]],
  9: [[28, 13, false], [72, 13, false], [28, 34, false], [72, 34, false], [50, 50, false], [28, 66, true], [72, 66, true], [28, 87, true], [72, 87, true]],
  10: [[28, 10, false], [72, 10, false], [50, 23, false], [28, 37, false], [72, 37, false], [28, 63, true], [72, 63, true], [50, 77, true], [28, 90, true], [72, 90, true]],
}
const pips = computed(() => (PIP_LAYOUTS[numVal.value] || []).map(([x, y, rotated]) => ({ x, y, rotated })))
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
  isolation: isolate;
}
.playing-card.red { color: #e74c3c; }
.playing-card.black { color: #1e272e; }

.card-corner { position: absolute; display: flex; flex-direction: column; align-items: center; line-height: 1; gap: 1px; z-index: 2; }
.card-corner.top-left { top: 5%; left: 9%; }
.card-corner.bottom-right { bottom: 5%; right: 9%; transform: rotate(180deg); }
.card-val { font-size: 18cqw; font-weight: 900; line-height: 1; }
.card-suit-sm { font-size: 19cqw; line-height: 1; }

.card-body { position: absolute; inset: 24% 10% 24% 10%; }
.pip-ace { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 44cqw; line-height: 1; }
.card-face {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 34cqw; font-weight: 900; line-height: 1; display: flex; flex-direction: column; align-items: center; gap: 2cqw;
}
.face-suit { font-size: 22cqw; }
.pip { position: absolute; font-size: 15cqw; line-height: 1; transform: translate(-50%, -50%); user-select: none; }
.pip.pip-flip { transform: translate(-50%, -50%) rotate(180deg); }
@container (max-width: 74px) { .pip { font-size: 13cqw; } }

/* ── Atout ── */
.tarot-trump {
  background:
    radial-gradient(ellipse at 50% 30%, #fff6dd 0%, #f3e2ad 60%, #e8cf88 100%);
  color: #6b4d13;
  border: 1.5px solid #c9a14f;
}
.tarot-trump.oudler {
  background: radial-gradient(ellipse at 50% 30%, #fff8e6 0%, #ffe9a8 55%, #f4cf6d 100%);
  border-color: #d99b2b;
  box-shadow: 0 3px 10px rgba(0,0,0,0.45), 0 0 0 1.5px rgba(217,155,43,0.5) inset;
}
.tarot-trump .card-suit-sm { font-size: 15cqw; color: #b98a2a; }
.trump-body { position: absolute; inset: 12% 8% 12% 8%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.trump-num { font-size: 52cqw; font-weight: 900; line-height: 0.9; text-shadow: 0 1px 0 rgba(255,255,255,0.6); }
.trump-oudler-star { font-size: 22cqw; color: #e0a52a; line-height: 1; margin-bottom: -4cqw; }
.tarot-trump.oudler .trump-num { color: #7a4e00; }
.trump-tag { font-size: 12cqw; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #9a6b12; margin-top: 2cqw; }

/* ── Excuse ── */
.tarot-excuse {
  background:
    repeating-linear-gradient(135deg, rgba(120,80,200,0.08) 0 8px, transparent 8px 16px),
    radial-gradient(ellipse at 50% 35%, #fbf3ff 0%, #ecdcff 70%, #dcc4f5 100%);
  color: #6b3fa0;
  border: 1.5px solid #b389e0;
}
.tarot-excuse .tc-star { font-size: 18cqw; color: #a06fd6; line-height: 1; }
.excuse-body { position: absolute; inset: 20% 8% 18% 8%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4cqw; }
.excuse-emoji { font-size: 40cqw; line-height: 1; }
.excuse-label { font-size: 15cqw; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #7a4fb5; }

/* ── Dos de carte ── */
.card-back-face {
  border: 1.5px solid #4b2e83;
  border-radius: 6px;
  flex-shrink: 0;
  container-type: inline-size;
  display: flex; align-items: center; justify-content: center;
  background:
    repeating-linear-gradient(45deg, rgba(180, 150, 255, 0.12) 0 3px, transparent 3px 11px),
    repeating-linear-gradient(-45deg, rgba(180, 150, 255, 0.12) 0 3px, transparent 3px 11px),
    linear-gradient(145deg, #2a1a4d, #46307a);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
}
</style>
