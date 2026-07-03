<template>
  <div class="tr-log">
    <div class="tr-log-history" ref="historyEl">
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="tr-log-line"
        :class="msg.type"
      >
        <span class="tr-sender">{{ msg.sender || 'Journal' }} :</span>
        <span class="tr-text">{{ msg.text }}</span>
      </div>
    </div>
    <div class="tr-log-input">
      <input
        type="text"
        v-model="newMessage"
        placeholder="Discuter, accuser, bluffer..."
        @keyup.enter="send"
      />
      <button @click="send">Envoyer</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({ messages: { type: Array, default: () => [] } })
const emit = defineEmits(['send'])

const newMessage = ref('')
const historyEl = ref(null)

const send = () => {
  if (!newMessage.value.trim()) return
  emit('send', newMessage.value)
  newMessage.value = ''
}

watch(() => props.messages, async () => {
  await nextTick()
  if (historyEl.value) historyEl.value.scrollTop = historyEl.value.scrollHeight
}, { deep: true })
</script>

<style scoped>
.tr-log {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  background: rgba(8, 24, 36, 0.9); border: 1px solid rgba(224, 176, 74, 0.3);
  border-radius: 10px; overflow: hidden; font-family: 'Space Mono', monospace;
}
.tr-log-history {
  flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px;
}
.tr-log-history::-webkit-scrollbar { width: 5px; }
.tr-log-history::-webkit-scrollbar-thumb { background: rgba(224, 176, 74, 0.3); border-radius: 4px; }
.tr-log-line { font-size: 0.78rem; line-height: 1.4; color: #f2e6cf; word-break: break-word; }
.tr-sender { font-weight: bold; color: #e0b04a; }
.tr-log-line.system .tr-sender { color: #6fb7b0; }
.tr-log-line.system .tr-text { color: #9fb4c2; font-style: italic; }

.tr-log-input { display: flex; border-top: 1px solid rgba(224, 176, 74, 0.2); background: rgba(4, 16, 25, 0.9); }
.tr-log-input input {
  flex: 1; padding: 10px 12px; background: transparent; border: none; outline: none;
  color: #f2e6cf; font-family: 'Space Mono', monospace; font-size: 0.78rem;
}
.tr-log-input input::placeholder { color: #5a7080; }
.tr-log-input button {
  background: transparent; color: #e0b04a; border: none; border-left: 1px solid rgba(224, 176, 74, 0.2);
  padding: 0 16px; cursor: pointer; font-family: 'Space Mono', monospace; text-transform: uppercase; font-size: 0.7rem;
  transition: background 0.2s;
}
.tr-log-input button:hover { background: rgba(224, 176, 74, 0.1); }
</style>
