<template>
  <div class="game-active">
    <div class="game-header">
      <div class="stats">Manche: {{ round }} / 4 | Câbles à trouver: {{ defusesLeft }}</div>
      <div class="room-info">Code: {{ roomCode }}</div>
    </div>

    <div class="opponents">
      <div v-for="p in otherPlayers" :key="p.id" class="player-area">
        <p class="opponent-name">👤 {{ p.name || 'Anonyme' }} ({{ p.handCount }} cartes)</p>
        <div class="mini-hand">
          <div 
            v-for="n in p.handCount" 
            :key="n" 
            class="card-back-small" 
            :class="{ 'my-turn': hasScissors }"
            @click="$emit('cut', { targetId: p.id, cardIndex: n - 1 })"
          >
            ✂️
          </div>
        </div>
      </div>
    </div>

    <div class="center-table">
      <div class="action-log">{{ lastAction }}</div>
      <div v-if="hasScissors" class="turn-indicator">C'est à VOUS de couper !</div>
    </div>

    <div class="my-area">
      <div class="my-info">
        <span>Joueur : <strong>{{ myName }}</strong></span>
      </div>
      <div class="role-card" :class="myRole?.toLowerCase() || 'waiting'">
        Rôle : <strong>{{ myRole }}</strong>
      </div>
      <div class="my-hand">
        <TimeBombCard 
          v-for="(card, i) in myHand" 
          :key="i" 
          :type="card.type" 
          :is-revealed="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import TimeBombCard from './TimeBombCard.vue'

defineProps({
  roomCode: String,
  round: Number,
  defusesLeft: Number,
  lastAction: String,
  myName: String,
  myRole: String,
  myHand: Array,
  hasScissors: Boolean,
  otherPlayers: Array
});

defineEmits(['cut']);
</script>

<style scoped>
.game-active { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.opponents { display: flex; justify-content: space-around; padding: 20px; }
.player-area { text-align: center; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; min-width: 150px; }
.opponent-name { font-weight: bold; margin-bottom: 5px; color: #ffde59; }
.mini-hand { display: flex; gap: 8px; margin-top: 10px; justify-content: center; }
.card-back-small { 
  width: 45px; height: 70px; background: #e74c3c; 
  border: 2px solid white; border-radius: 5px; 
  cursor: not-allowed; display: flex; align-items: center; justify-content: center;
}
.card-back-small.my-turn { cursor: crosshair; background: #c0392b; }
.card-back-small.my-turn:hover { transform: scale(1.1); background: #ff5252; }
.center-table { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.action-log { background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 20px; font-style: italic; }
.turn-indicator { margin-top: 10px; color: #ffde59; font-weight: bold; animation: pulse 1.5s infinite; }
.my-area { display: flex; flex-direction: column; align-items: center; gap: 10px; border-top: 2px solid rgba(255,255,255,0.1); padding-top: 20px; }
.my-info { margin-bottom: 5px; font-size: 1.1rem; }
.my-hand { display: flex; gap: 15px; }
.role-card { padding: 5px 15px; border-radius: 5px; text-transform: uppercase; }
.sherlock { background: #2980b9; }
.moriarty { background: #c0392b; }
@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
</style>