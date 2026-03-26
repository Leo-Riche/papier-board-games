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
import { ref, onUpdated } from 'vue'

const props = defineProps({
  messages: Array // Contient { type, text, sender, timestamp }
});

const emit = defineEmits(['send']);

const newMessage = ref('');
const messagesHistoryContainer = ref(null);

const sendMessage = () => {
  if (!newMessage.value.trim()) return;
  emit('send', newMessage.value);
  newMessage.value = ''; // Vide l'input après envoi
}

// Auto-scroll en bas à chaque nouveau message
onUpdated(() => {
  if (messagesHistoryContainer.value) {
    setTimeout(() => {
      messagesHistoryContainer.value.scrollTop = messagesHistoryContainer.value.scrollHeight;
    }, 50);
  }
});
</script>

<style scoped>
.game-log-chat {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: #f1e7d0; 
  border: 3px solid #111; 
  border-radius: 4px; 
  box-shadow: 0 5px 15px rgba(0,0,0,0.5); 
  padding: 10px 10px 0 10px; 
  overflow: hidden;
}

.messages-history {
  flex: 1;
  overflow-y: auto;
  padding-right: 5px;
  margin-bottom: 10px;
  display: flex; flex-direction: column;
  gap: 4px; /* Petit espace entre chaque ligne */
}
.messages-history::-webkit-scrollbar { width: 6px; }
.messages-history::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
.messages-history::-webkit-scrollbar-thumb { background: #8b5a2b; border-radius: 3px; }

/* --- Style d'une ligne de tchat simple --- */
.chat-line {
  font-size: 0.95rem;
  color: #111;
  line-height: 1.3;
  word-wrap: break-word;
}

.sender-name {
  font-weight: bold;
  color: #1f4068; /* Bleu profond pour les pseudos */
}

/* On change juste la couleur du pseudo pour les messages du jeu */
.chat-line.system .sender-name {
  color: #8b5a2b; /* Marron doré pour le Système */
}
.chat-line.system .text-body {
  font-style: italic;
  color: #333;
}

/* --- Zone d'envoi --- */
.chat-input-area {
  display: flex; background: white; margin: 0 -10px; border-top: 1px solid #ccc;
}
.chat-input-area input {
  flex: 1; padding: 10px 12px; background: white; border: none; color: black; font-size: 0.95rem; outline: none;
}
.chat-input-area button {
  background: #daa520; color: #111; font-family: sans-serif; text-transform: uppercase; font-weight: bold; font-size: 0.8rem; padding: 0 15px; border: none; cursor: pointer; transition: background 0.2s; border-left: 1px solid #ccc;
}
.chat-input-area button:hover { background: #ffde59; }
</style>