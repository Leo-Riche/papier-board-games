<template>
  <div
    class="tr-card"
    :class="[
      cardClass,
      { selectable, selected, 'is-back': !faceUp }
    ]"
    @click="onClick"
  >
    <template v-if="faceUp">
      <div class="tr-card-icon">{{ icon }}</div>
      <div class="tr-card-value" v-if="card.kind === 'butin'">{{ valueLabel }}</div>
      <div class="tr-card-label">{{ label }}</div>
    </template>
    <template v-else>
      <div class="tr-card-back">🏴‍☠️</div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, default: () => ({}) },
  faceUp: { type: Boolean, default: true },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const onClick = () => {
  if (props.selectable) emit('select', props.card)
}

const ACTION_META = {
  longuevue:        { icon: '🔭', label: 'Longue-vue' },
  planche:          { icon: '🪵', label: 'Planche' },
  videpoches:       { icon: '🫳', label: 'Vide tes poches' },
  bondebarras:      { icon: '🗑️', label: 'Bon débarras' },
  pechemiraculeuse: { icon: '🎣', label: 'Pêche miraculeuse' },
}

const icon = computed(() => {
  if (props.card.kind === 'butin') return '🪙'
  return ACTION_META[props.card.action]?.icon || '❔'
})

const valueLabel = computed(() => {
  const v = props.card.value
  return v > 0 ? `+${v}` : `${v}`
})

const label = computed(() => {
  if (props.card.kind === 'butin') return 'Butin'
  return ACTION_META[props.card.action]?.label || ''
})

const cardClass = computed(() => {
  if (!props.faceUp) return 'back'
  if (props.card.kind === 'butin') {
    if (props.card.value > 0) return 'butin-plus'
    if (props.card.value < 0) return 'butin-minus'
    return 'butin-zero'
  }
  return `action action-${props.card.action}`
})
</script>

<style scoped>
.tr-card {
  width: 124px; height: 178px; border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 12px; box-sizing: border-box; user-select: none;
  border: 2px solid rgba(224, 176, 74, 0.35);
  background: linear-gradient(160deg, #14344a, #0d2233);
  color: #f2e6cf; text-align: center; transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  position: relative;
}
.tr-card-icon { font-size: 2.8rem; line-height: 1; }
.tr-card-value { font-size: 2.1rem; font-weight: bold; font-family: 'Cinzel', serif; }
.tr-card-label { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85; line-height: 1.15; }

.butin-plus  { border-color: #e0b04a; box-shadow: inset 0 0 20px rgba(224,176,74,0.15); }
.butin-plus .tr-card-value { color: #f5d179; }
.butin-minus { border-color: #c0392b; box-shadow: inset 0 0 20px rgba(192,57,43,0.15); }
.butin-minus .tr-card-value { color: #e57368; }
.butin-zero  { border-color: #7f8c8d; }
.butin-zero .tr-card-value { color: #bdc3c7; }
.action { border-color: #3fa7a0; background: linear-gradient(160deg, #123c44, #0d2530); }

.tr-card.is-back {
  background: repeating-linear-gradient(45deg, #0d2233, #0d2233 8px, #123146 8px, #123146 16px);
  border-color: rgba(224, 176, 74, 0.4);
}
.tr-card-back { font-size: 3.2rem; }

.tr-card.selectable { cursor: pointer; }
.tr-card.selectable:hover { transform: translateY(-8px); border-color: #f5d179; box-shadow: 0 6px 16px rgba(0,0,0,0.4); }
.tr-card.selected { transform: translateY(-10px); border-color: #f5d179; box-shadow: 0 0 0 2px #f5d179, 0 8px 20px rgba(0,0,0,0.5); }

@media (max-width: 600px) {
  .tr-card { width: 92px; height: 132px; padding: 8px; gap: 5px; }
  .tr-card-icon { font-size: 2.1rem; }
  .tr-card-value { font-size: 1.5rem; }
  .tr-card-label { font-size: 0.62rem; }
  .tr-card-back { font-size: 2.6rem; }
}
</style>
