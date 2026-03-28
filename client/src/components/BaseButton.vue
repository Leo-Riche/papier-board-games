<template>
  <button 
    class="tb-button" 
    :class="variant" 
    :disabled="disabled" 
    @click="$emit('click')"
  >
    <div class="engraving">
      <slot></slot>
    </div>
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'secondary' },
  disabled: { type: Boolean, default: false }
});
defineEmits(['click']);
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono&display=swap');

.tb-button {
  font-family: 'Space Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 12px 25px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 150px;
  font-size: 0.85rem;
  box-sizing: border-box;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  background: transparent;
}

.tb-button.primary {
  background: #cda434;
  color: #161514;
  border: 1px solid #cda434;
}
.tb-button.primary:not(:disabled):hover {
  background: #dfd3c3;
  border-color: #dfd3c3;
}

.tb-button.secondary {
  color: #cda434;
  border: 1px solid #cda434;
}
.tb-button.secondary:not(:disabled):hover {
  background: rgba(205, 164, 52, 0.1);
}

.tb-button:disabled {
  cursor: not-allowed;
  border-color: #5a554f;
  color: #5a554f;
}

.tb-button.primary:disabled {
  background: rgba(90, 85, 79, 0.2);
  border-color: transparent;
}

.engraving {
  position: relative;
  z-index: 1;
}

.tb-button::before {
  display: none; 
}

@media (max-width: 480px) {
  .tb-button {
    width: 100%;
    padding: 15px 20px;
    font-size: 0.8rem;
  }
}
</style>