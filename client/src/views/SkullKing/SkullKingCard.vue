<template>
  <div class="sk-card" :class="[colorClass, { trump: isTrump, special: isSpecial }]">
    <!-- Coins (cartes numérotées) -->
    <template v-if="card.type === 'number'">
      <div class="sk-corner top-left">
        <span class="sk-val" :class="{ small: numDisplay.length > 2 }">
          <span v-if="card.zeroFourteen" class="zf-corner">
            <span :class="{ 'zf-on': card.value === 0 }">0</span>/<span :class="{ 'zf-on': card.value === 14 }">14</span>
          </span>
          <template v-else>{{ numDisplay }}</template>
        </span>
        <span class="sk-suit-sm">{{ suitIcon }}</span>
      </div>
      <div class="sk-center">
        <span class="sk-big-icon">{{ suitIcon }}</span>
        <span v-if="card.zeroFourteen" class="sk-big-val zf-big">
          <span :class="{ 'zf-on': card.value === 0 }">0</span><span class="zf-slash">/</span><span :class="{ 'zf-on': card.value === 14 }">14</span>
        </span>
        <span v-else class="sk-big-val" :class="{ small: numDisplay.length > 2 }">{{ numDisplay }}</span>
        <span v-if="card.condScore" class="sk-cond" :class="card.condScore > 0 ? 'pos' : 'neg'">
          {{ card.condScore > 0 ? '+' : '' }}{{ card.condScore }} pts
        </span>
      </div>
      <div class="sk-corner bottom-right">
        <span class="sk-val" :class="{ small: numDisplay.length > 2 }">
          <span v-if="card.zeroFourteen" class="zf-corner">
            <span :class="{ 'zf-on': card.value === 0 }">0</span>/<span :class="{ 'zf-on': card.value === 14 }">14</span>
          </span>
          <template v-else>{{ numDisplay }}</template>
        </span>
        <span class="sk-suit-sm">{{ suitIcon }}</span>
      </div>
      <div v-if="isTrump" class="sk-trump-tag">ATOUT</div>
    </template>

    <!-- Cartes spéciales -->
    <template v-else>
      <div class="sk-center special-center">
        <span class="sk-big-icon">{{ specialIcon }}</span>
        <span class="sk-special-name">{{ specialName }}</span>
        <span v-if="card.type === 'pirate' && card.name" class="sk-pirate-sub">{{ card.name }}</span>
        <span v-if="tigressMode" class="sk-tigress-mode">{{ tigressMode === 'pirate' ? '⚔️ Pirate' : '🏳️ Fuite' }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, required: true },
  // Pour la Tigresse jouée : 'pirate' | 'escape' | null
  tigressAsPirate: { type: Boolean, default: null },
})

const SUIT_ICONS = { green: '🦜', yellow: '🪙', purple: '💎', black: '🏴‍☠️' }
const SUIT_CLASS = { green: 'c-green', yellow: 'c-yellow', purple: 'c-purple', black: 'c-black' }

const SPECIAL = {
  escape:    { icon: '🏳️', name: 'Fuite' },
  pirate:    { icon: '⚔️', name: 'Pirate' },
  tigress:   { icon: '🐯', name: 'Tigresse' },
  skullking: { icon: '💀', name: 'Skull King' },
  mermaid:   { icon: '🧜‍♀️', name: 'Sirène' },
  loot:      { icon: '💰', name: 'Butin' },
  kraken:    { icon: '🐙', name: 'Kraken' },
  whale:     { icon: '🐋', name: 'Baleine' },
  joker15:   { icon: '🃏', name: '15 Joker' },
}

const isSpecial = computed(() => props.card.type !== 'number')
const isTrump = computed(() => props.card.type === 'number' && props.card.suit === 'black')

// Valeur affichée pour les cartes numérotées (gère le 0/14 non encore choisi).
const numDisplay = computed(() => {
  if (props.card.zeroFourteen && (props.card.value === null || props.card.value === undefined)) return '0/14'
  return String(props.card.value ?? '')
})

const suitIcon = computed(() => SUIT_ICONS[props.card.suit] || '')
const colorClass = computed(() => {
  if (props.card.type === 'number') return SUIT_CLASS[props.card.suit] || 'c-black'
  return `c-${props.card.type}`
})

const specialIcon = computed(() => SPECIAL[props.card.type]?.icon || '?')
const specialName = computed(() => SPECIAL[props.card.type]?.name || props.card.type)

const tigressMode = computed(() => {
  if (props.card.type !== 'tigress') return null
  if (props.tigressAsPirate === true) return 'pirate'
  if (props.tigressAsPirate === false) return 'escape'
  return null
})
</script>

<style scoped>
.sk-card {
  position: relative;
  background: #fdfaf3;
  border-radius: 7px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  flex-shrink: 0;
  container-type: inline-size;
  width: 100%;
  height: 100%;
}

/* Couleurs des familles numérotées */
.sk-card.c-green  { background: linear-gradient(160deg, #eafaf0, #d4f3df); border-color: #27ae60; }
.sk-card.c-yellow { background: linear-gradient(160deg, #fef9e6, #fdedb8); border-color: #e0a800; }
.sk-card.c-purple { background: linear-gradient(160deg, #f4ecfa, #e4d0f2); border-color: #9b59b6; }
.sk-card.c-black  { background: linear-gradient(160deg, #d9dee3, #aeb6bf); border-color: #2c3e50; }

.sk-card.c-green  .sk-val, .sk-card.c-green  .sk-big-val { color: #1e8449; }
.sk-card.c-yellow .sk-val, .sk-card.c-yellow .sk-big-val { color: #b9770e; }
.sk-card.c-purple .sk-val, .sk-card.c-purple .sk-big-val { color: #7d3c98; }
.sk-card.c-black  .sk-val, .sk-card.c-black  .sk-big-val { color: #1b2631; }

/* Cartes spéciales */
.sk-card.special { background: linear-gradient(165deg, #2b1d10, #160d06); border-color: #b8860b; }
.sk-card.c-skullking { background: linear-gradient(165deg, #3a0f12, #1a0506); border-color: #e74c3c; }
.sk-card.c-mermaid   { background: linear-gradient(165deg, #0e2a33, #06161c); border-color: #1abc9c; }
.sk-card.c-pirate    { background: linear-gradient(165deg, #2b1d10, #160d06); border-color: #d4ac0d; }
.sk-card.c-tigress   { background: linear-gradient(165deg, #33260e, #1a1305); border-color: #e67e22; }
.sk-card.c-escape    { background: linear-gradient(165deg, #2c2c34, #16161a); border-color: #95a5a6; }
.sk-card.c-loot      { background: linear-gradient(165deg, #33280e, #1a1405); border-color: #f1c40f; }
.sk-card.c-kraken    { background: linear-gradient(165deg, #1a1033, #0a0618); border-color: #8e44ad; }
.sk-card.c-whale     { background: linear-gradient(165deg, #0e2333, #06121c); border-color: #5dade2; }
.sk-card.c-joker15   { background: linear-gradient(165deg, #2a1433, #140a1c); border-color: #d4ac0d; }
.sk-card.c-joker15 .sk-special-name { color: #f1c40f; }

/* Coins */
.sk-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  z-index: 2;
}
.sk-corner.top-left { top: 6%; left: 8%; }
.sk-corner.bottom-right { bottom: 6%; right: 8%; transform: rotate(180deg); }
.sk-val { font-size: 20cqw; font-weight: 900; line-height: 1; }
.sk-suit-sm { font-size: 13cqw; line-height: 1; }

/* Centre */
.sk-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2cqw;
  text-align: center;
  padding: 4cqw;
  box-sizing: border-box;
}
.sk-big-icon { font-size: 38cqw; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4)); }
.sk-big-val { font-size: 26cqw; font-weight: 900; line-height: 1; }
.sk-big-val.small { font-size: 17cqw; }
.sk-val.small { font-size: 13cqw; }

/* Carte 0/14 : on garde "0/14" et on met en valeur le nombre choisi */
.zf-big { font-size: 19cqw; font-weight: 900; line-height: 1; display: inline-flex; align-items: baseline; }
.zf-big > span { opacity: 0.32; transition: opacity 0.2s; }
.zf-big .zf-on { opacity: 1; }
.zf-slash { font-size: 13cqw; margin: 0 0.5cqw; opacity: 0.32 !important; }
.zf-corner { display: inline-flex; }
.zf-corner > span { opacity: 0.35; }
.zf-corner .zf-on { opacity: 1; }
.sk-cond { font-size: 8cqw; font-weight: 800; margin-top: 1cqw; }
.sk-cond.pos { color: #1e8449; }
.sk-cond.neg { color: #c0392b; }

.special-center .sk-big-icon { font-size: 42cqw; }
.sk-special-name {
  font-size: 13cqw;
  font-weight: 900;
  letter-spacing: 0.5px;
  color: #f5e6c8;
  text-transform: uppercase;
}
.sk-card.c-skullking .sk-special-name { color: #f1948a; }
.sk-card.c-mermaid .sk-special-name { color: #76d7c4; }
.sk-card.c-escape .sk-special-name { color: #d5dbdb; }
.sk-card.c-kraken .sk-special-name { color: #bb8fce; }
.sk-card.c-whale .sk-special-name { color: #aed6f1; }

.sk-pirate-sub { font-size: 8.5cqw; color: #d4ac0d; font-weight: 700; line-height: 1.1; }
.sk-tigress-mode { font-size: 9cqw; color: #f8c471; font-weight: 800; margin-top: 1cqw; }

.sk-trump-tag {
  position: absolute;
  top: 6%;
  right: 8%;
  font-size: 8cqw;
  font-weight: 900;
  letter-spacing: 0.5px;
  color: #f8f9f9;
  background: #1b2631;
  padding: 1cqw 3cqw;
  border-radius: 3px;
  z-index: 3;
}
</style>
