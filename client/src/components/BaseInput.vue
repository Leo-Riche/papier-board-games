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
.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
  width: 100%;
}

.input-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #ffde59;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.input-wrapper {
  position: relative;
  width: 100%;
}

.base-input {
  width: 100%;
  padding: 12px 16px;
  background: #1e1e1e;
  border: 2px solid #333;
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.base-input:focus {
  outline: none;
  border-color: #ffde59;
  background: #252525;
}

.base-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.focus-border {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background-color: #ffde59;
  transition: 0.4s;
}

.base-input:focus + .focus-border {
  width: 100%;
  left: 0;
}

.base-input::placeholder {
  color: #666;
}
</style>