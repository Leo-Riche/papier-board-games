<template>
  <div class="input-group">
    <label v-if="label" :for="id" class="input-label">{{ label }}</label>
    
    <div class="input-wrapper">
      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        class="base-input"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <span class="focus-border"></span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  modelValue: [String, Number],
  type: {
    type: String,
    default: 'text'
  },
  placeholder: String,
  disabled: Boolean,
  id: {
    type: String,
    default: () => `input-${Math.random().toString(36).substr(2, 9)}`
  }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono&display=swap');

.input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 20px;
  width: 100%;
  font-family: 'Space Mono', monospace;
}

.input-label {
  font-size: 0.75rem;
  color: #8a8277;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.input-wrapper {
  position: relative;
  width: 100%;
}

.base-input {
  width: 100%;
  padding: 10px 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(223, 211, 195, 0.3);
  color: #dfd3c3;
  font-family: 'Space Mono', monospace;
  font-size: 1rem;
  transition: border-color 0.3s;
  box-sizing: border-box;
  outline: none;
}

.base-input::placeholder {
  color: #5a554f;
}

.base-input:focus {
  border-bottom-color: #cda434;
}

.base-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.focus-border { display: none; }

@media (max-width: 480px) {
  .base-input { font-size: 0.9rem; }
  .input-label { font-size: 0.7rem; }
}
</style>