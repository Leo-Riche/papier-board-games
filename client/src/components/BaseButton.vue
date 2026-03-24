<template>
  <button 
    :class="['base-button', variant, { 'is-loading': loading }]"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <span v-if="loading" class="loader"></span>
    <slot v-else></slot> </button>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary'
  },
  loading: Boolean,
  disabled: Boolean
})

defineEmits(['click'])
</script>

<style scoped>
.base-button {
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 1rem;
}

/* Variantes de couleurs */
.primary { background: #ffde59; color: #000; }
.primary:hover { background: #ffe685; transform: scale(1.02); }

.secondary { background: #34495e; color: #fff; }
.secondary:hover { background: #465f78; }

.danger { background: #e74c3c; color: #fff; }
.danger:hover { background: #ff5e4d; }

.success { background: #2ecc71; color: #fff; }

/* État désactivé */
.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Animation Loader */
.loader {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>