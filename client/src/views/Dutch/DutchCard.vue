<template>
  <div
    class="dutch-card"
    :class="[size, {
      'face-up': !!card,
      'face-down': !card,
      red: isRed,
      selectable,
      selected,
      highlight,
    }]"
    @click="selectable && $emit('select')"
  >
    <template v-if="card">
      <span class="corner top">{{ card.rank }}<br />{{ card.suit }}</span>
      <span class="center-suit">{{ card.suit }}</span>
      <span v-if="badge" class="badge">{{ badge }}</span>
      <span class="corner bottom">{{ card.rank }}<br />{{ card.suit }}</span>
    </template>
    <template v-else>
      <span class="back-pattern">D</span>
    </template>
    <span v-if="label" class="slot-label">{{ label }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, default: null },
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  highlight: { type: Boolean, default: false },
  label: { type: String, default: '' },
})
defineEmits(['select'])

const isRed = computed(() => props.card && (props.card.suit === '♥' || props.card.suit === '♦'))

const badge = computed(() => {
  if (!props.card) return ''
  if (props.card.rank === 'J') return '🔄'
  if (props.card.rank === 'Q') return '👁️'
  if (props.card.rank === 'K' && isRed.value) return '0'
  return ''
})
</script>

<style scoped>
.dutch-card {
  position: relative; flex-shrink: 0; border-radius: 8px; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center; user-select: none;
  transition: transform 0.15s, box-shadow 0.15s, outline-color 0.15s;
  outline: 2px solid transparent; outline-offset: 2px;
}
.dutch-card.sm { width: 44px; height: 64px; font-size: 0.7rem; }
.dutch-card.md { width: 62px; height: 90px; font-size: 0.85rem; }
.dutch-card.lg { width: 78px; height: 112px; font-size: 1rem; }

.face-up { background: #fbf6ea; color: #1d1d1d; border: 1px solid #d9cfb8; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35); }
.face-up.red { color: #c0392b; }
.face-down {
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.07) 0 6px, transparent 6px 12px),
    linear-gradient(135deg, #7a1f2b, #4a0f18);
  border: 2px solid #f1e3c0; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.back-pattern { font-family: 'Playfair Display', serif; color: rgba(241, 227, 192, 0.55); font-size: 1.4em; font-weight: bold; }

.corner { position: absolute; line-height: 1; font-weight: bold; text-align: center; }
.corner.top { top: 4px; left: 5px; }
.corner.bottom { bottom: 4px; right: 5px; transform: rotate(180deg); }
.center-suit { font-size: 2em; }
.badge {
  position: absolute; top: 3px; right: 4px; font-size: 0.75em; font-weight: bold;
  background: rgba(0, 0, 0, 0.08); border-radius: 4px; padding: 0 3px;
}
.slot-label {
  position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%);
  font-size: 0.65rem; color: rgba(241, 227, 192, 0.6); white-space: nowrap;
}

.selectable { cursor: pointer; }
.selectable:hover { transform: translateY(-5px); outline-color: rgba(241, 196, 15, 0.7); }
.selected { transform: translateY(-5px); outline-color: #f1c40f; box-shadow: 0 0 14px rgba(241, 196, 15, 0.6); }
.highlight { outline-color: #2ecc71; box-shadow: 0 0 16px rgba(46, 204, 113, 0.6); }
</style>
