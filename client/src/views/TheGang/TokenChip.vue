<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    class="token-chip-svg"
  >
    <defs>
      <radialGradient :id="`grad-main-${count}`" cx="40%" cy="35%" r="65%">
        <stop offset="0%" :stop-color="colors.highlight" />
        <stop offset="100%" :stop-color="colors.main" />
      </radialGradient>
      <radialGradient :id="`grad-rim-${count}`" cx="40%" cy="35%" r="65%">
        <stop offset="0%" :stop-color="colors.rimHighlight" />
        <stop offset="100%" :stop-color="colors.rim" />
      </radialGradient>
      <filter :id="`shadow-${count}`" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.55)" />
      </filter>
      <filter :id="`inner-${count}`" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.4)" />
      </filter>
    </defs>

    <!-- Outer shadow disk -->
    <circle cx="50" cy="52" r="47" fill="rgba(0,0,0,0.3)" />

    <!-- Outer rim ring -->
    <circle cx="50" cy="50" r="48" :fill="`url(#grad-rim-${count})`" />

    <!-- Rim notches (8 rectangular cuts at 45° intervals) -->
    <g v-for="i in 8" :key="`notch-${i}`">
      <rect
        x="45.5" y="2"
        width="9" height="13"
        rx="1.5" ry="1.5"
        :fill="colors.notch"
        :transform="`rotate(${(i - 1) * 45}, 50, 50)`"
      />
    </g>

    <!-- Inner rim (second smaller ring) -->
    <circle cx="50" cy="50" r="36" :fill="`url(#grad-rim-${count})`" />

    <!-- Rim notches inner ring (smaller, 8 at same positions) -->
    <g v-for="i in 8" :key="`notch-in-${i}`">
      <rect
        x="46.5" y="15"
        width="7" height="8"
        rx="1" ry="1"
        :fill="colors.notch"
        :transform="`rotate(${(i - 1) * 45}, 50, 50)`"
      />
    </g>

    <!-- Main body circle -->
    <circle cx="50" cy="50" r="29" :fill="`url(#grad-main-${count})`" :filter="`url(#inner-${count})`" />

    <!-- Stars -->
    <path
      v-for="(pos, idx) in starPositions"
      :key="`star-${idx}`"
      :d="starPath(pos.x, pos.y, starSize)"
      :fill="colors.star"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  count: {         // number of stars (1–6) = token number
    type: Number,
    required: true
  },
  size: {          // pixel size (width & height)
    type: Number,
    default: 72
  }
})

// ── Chip color palettes ─────────────────────────────────────
// 6 clearly distinct colors: white → gold → orange → red → purple → blue
const PALETTES = {
  1: { // White / Silver
    main:        '#e8e8e8',
    highlight:   '#ffffff',
    rim:         '#b0b0b0',
    rimHighlight:'#d0d0d0',
    notch:       'rgba(0,0,0,0.28)',
    star:        '#1a1a1a'
  },
  2: { // Gold / Yellow
    main:        '#e8a800',
    highlight:   '#f5c518',
    rim:         '#a87800',
    rimHighlight:'#cc9400',
    notch:       'rgba(0,0,0,0.38)',
    star:        '#1a1a1a'
  },
  3: { // Orange
    main:        '#d96400',
    highlight:   '#f07a10',
    rim:         '#9c4800',
    rimHighlight:'#be5800',
    notch:       'rgba(0,0,0,0.38)',
    star:        '#1a1a1a'
  },
  4: { // Red
    main:        '#cc1a0e',
    highlight:   '#e63025',
    rim:         '#8c0e06',
    rimHighlight:'#b01208',
    notch:       'rgba(0,0,0,0.38)',
    star:        '#ffe8e5'
  },
  5: { // Purple / Violet
    main:        '#7b2d8b',
    highlight:   '#9b3dab',
    rim:         '#521c5e',
    rimHighlight:'#6a2478',
    notch:       'rgba(0,0,0,0.40)',
    star:        '#f0e0ff'
  },
  6: { // Deep Blue
    main:        '#1a4faa',
    highlight:   '#2a65cc',
    rim:         '#0e3278',
    rimHighlight:'#163e96',
    notch:       'rgba(0,0,0,0.42)',
    star:        '#dceeff'
  }
}

const colors = computed(() => PALETTES[Math.max(1, Math.min(6, props.count))])

// ── Star size scales with fewer stars ─────────────────────
const starSize = computed(() => {
  const sizes = { 1: 9.5, 2: 8.5, 3: 7.5, 4: 6.5, 5: 5.8, 6: 5.2 }
  return sizes[props.count] ?? 6
})

// ── Star positions for each count ──────────────────────────
// Coordinate system: chip center = (50, 50), inner play area radius ≈ 24
const STAR_POSITIONS = {
  1: [
    { x: 50, y: 50 }
  ],
  2: [
    { x: 40, y: 50 },
    { x: 60, y: 50 }
  ],
  3: [
    { x: 50, y: 40 },
    { x: 40, y: 57 },
    { x: 60, y: 57 }
  ],
  4: [
    { x: 40, y: 40 },
    { x: 60, y: 40 },
    { x: 40, y: 60 },
    { x: 60, y: 60 }
  ],
  5: [
    { x: 38, y: 38 },
    { x: 62, y: 38 },
    { x: 50, y: 50 },
    { x: 38, y: 62 },
    { x: 62, y: 62 }
  ],
  6: [
    { x: 38, y: 37 },
    { x: 62, y: 37 },
    { x: 38, y: 50 },
    { x: 62, y: 50 },
    { x: 38, y: 63 },
    { x: 62, y: 63 }
  ]
}

const starPositions = computed(() => STAR_POSITIONS[Math.max(1, Math.min(6, props.count))] ?? STAR_POSITIONS[1])

// ── 5-pointed star path generator ─────────────────────────
const starPath = (cx, cy, r) => {
  const inner = r * 0.42
  const points = 5
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : inner
    const angle = (i * Math.PI) / points - Math.PI / 2
    const x = (cx + radius * Math.cos(angle)).toFixed(3)
    const y = (cy + radius * Math.sin(angle)).toFixed(3)
    d += (i === 0 ? 'M' : 'L') + x + ',' + y
  }
  return d + 'Z'
}
</script>

<style scoped>
.token-chip-svg {
  display: block;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.token-chip-svg:hover {
  transform: translateY(-3px) scale(1.06);
  filter: brightness(1.08);
}
</style>
