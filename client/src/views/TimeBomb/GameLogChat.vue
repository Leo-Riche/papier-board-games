<template>
  <div class="game-log-chat">
    <div class="messages-history" ref="messagesHistoryContainer">
      <div 
        v-for="(msg, i) in messages" 
        :key="i" 
        class="chat-line"
        :class="msg.type"
      >
        <span class="sender-name">{{ msg.sender || 'Système' }} : </span>
        <span class="text-body">{{ msg.text }}</span>
      </div>
    </div>

    <div class="chat-input-area">
      <input 
        type="text" 
        v-model="newMessage" 
        placeholder="Bluffer..." 
        @keyup.enter="sendMessage"
      />
      <button @click="sendMessage">Envoyer</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  messages: Array 
});

const emit = defineEmits(['send']);

const newMessage = ref('');
const messagesHistoryContainer = ref(null);
const sendMessage = () => {
  if (!newMessage.value.trim()) return;
  emit('send', newMessage.value);
  newMessage.value = ''; 
}

watch(() => props.messages, async () => {
  await nextTick(); 
  
  if (messagesHistoryContainer.value) {
    messagesHistoryContainer.value.scrollTop = messagesHistoryContainer.value.scrollHeight;
  }
}, { deep: true });
</script>

<style scoped>
.game-log-chat {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  background: #1c1a19; border: 1px solid rgba(205, 164, 52, 0.3);
  padding: 15px 15px 0 15px; overflow: hidden; font-family: 'Space Mono', monospace;
}

.messages-history {
  flex: 1; overflow-y: auto; padding-right: 10px; margin-bottom: 15px;
  display: flex; flex-direction: column; gap: 8px;
}
.messages-history::-webkit-scrollbar { width: 4px; }
.messages-history::-webkit-scrollbar-track { background: transparent; }
.messages-history::-webkit-scrollbar-thumb { background: rgba(205, 164, 52, 0.3); }

.chat-line { font-size: 0.8rem; line-height: 1.4; color: #dfd3c3; }

.sender-name { font-weight: bold; color: #cda434; text-transform: uppercase; }

.chat-line.system .sender-name { color: #a96c3c; }
.chat-line.system .text-body { color: #8a8277; font-style: italic; }

.chat-input-area {
  display: flex; background: #161514; margin: 0 -15px; border-top: 1px solid rgba(205, 164, 52, 0.2);
}
.chat-input-area input {
  flex: 1; padding: 12px 15px; background: transparent; border: none;
  color: #dfd3c3; font-family: 'Space Mono', monospace; font-size: 0.8rem; outline: none;
}
.chat-input-area input::placeholder { color: #5a554f; }
.chat-input-area button {
  background: transparent; color: #cda434; font-family: 'Space Mono', monospace;
  text-transform: uppercase; font-size: 0.75rem; padding: 0 20px; border: none;
  border-left: 1px solid rgba(205, 164, 52, 0.2); cursor: pointer; transition: background 0.2s;
}
.chat-input-area button:hover { background: rgba(205, 164, 52, 0.1); }
</style>