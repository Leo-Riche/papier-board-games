<template>
  <!-- Racine unique : la classe de taille passée par le parent (hc, mini-card, pile-card…)
       s'applique toujours, quel que soit le type de carte. -->
  <div class="playing-card" :class="rootClass">
    <template v-if="!card"></template>

    <template v-else>
      <div class="card-corner top-left">
        <span class="card-val">{{ displayValue }}</span>
        <span class="card-suit-sm">{{ card.suit }}</span>
      </div>

      <div class="card-body">
        <span v-if="isAce" class="pip pip-ace">{{ card.suit }}</span>
        <span v-else-if="isFace" class="card-face">{{ displayValue }}<span class="face-suit">{{ card.suit }}</span></span>
        <template v-else>
          <span
            v-for="(pip, i) in pips"
            :key="i"
            class="pip"
            :class="{ 'pip-flip': pip.rotated }"
            :style="{ left: pip.x + '%', top: pip.y + '%' }"
          >{{ card.suit }}</span>
        </template>
      </div>

      <div class="card-corner bottom-right">
        <span class="card-val">{{ displayValue }}</span>
        <span class="card-suit-sm">{{ card.suit }}</span>
      </div>

      <span v-if="tag" class="card-tag" :class="tag.cls">{{ tag.text }}</span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// card : { rank: 'A' | '2'..'10' | 'J' | 'Q' | 'K', suit: '♠' | '♥' | '♦' | '♣' } — null = face cachée
const props = defineProps({
  card: { type: Object, default: null },
})

const RED_SUITS = ['♥', '♦']
const FACE_LABEL = { J: 'V', Q: 'D', K: 'R' }

const isRed = computed(() => !!props.card && RED_SUITS.includes(props.card.suit))
const rootClass = computed(() => {
  if (!props.card) return 'card-back-face'
  return isRed.value ? 'red' : 'black'
})

const isAce = computed(() => props.card?.rank === 'A')
const isFace = computed(() => ['J', 'Q', 'K'].includes(props.card?.rank))
const displayValue = computed(() => FACE_LABEL[props.card?.rank] || props.card?.rank || '')

// Petite étiquette pour rappeler les cartes spéciales du Dutch.
const tag = computed(() => {
  const r = props.card?.rank
  if (r === 'J') return { text: 'Échange', cls: 'power' }
  if (r === 'Q') return { text: 'Regard', cls: 'power' }
  if (r === 'K' && isRed.value) return { text: '0 pt', cls: 'zero' }
  return null
})

const numVal = computed(() => {
  const n = parseInt(props.card?.rank, 10)
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

/* Étiquette des cartes spéciales (Valet, Dame, Roi rouge) */
.card-tag {
  position: absolute; left: 50%; bottom: 17%; transform: translateX(-50%); z-index: 3;
  font-size: 10cqw; font-weight: 800; letter-spacing: 0.3px; white-space: nowrap;
  padding: 1px 5cqw; border-radius: 999px; line-height: 1.3;
}
.card-tag.power { background: #fff1e2; color: #c2560f; border: 1px solid #f5b47a; }
.card-tag.zero { background: #e9f8ef; color: #1f8a4c; border: 1px solid #8fd6ab; }
@container (max-width: 52px) { .card-tag { display: none; } }

/* Dos de carte — bleu nuit et orange hollandais */
.card-back-face {
  border: 1.5px solid #f08a2c;
  border-radius: 6px;
  flex-shrink: 0;
  container-type: inline-size;
  display: flex; align-items: center; justify-content: center;
  background:
    repeating-linear-gradient(45deg, rgba(255, 154, 60, 0.16) 0 3px, transparent 3px 11px),
    repeating-linear-gradient(-45deg, rgba(255, 154, 60, 0.16) 0 3px, transparent 3px 11px),
    linear-gradient(145deg, #13305a, #1d4680);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
}
</style>
