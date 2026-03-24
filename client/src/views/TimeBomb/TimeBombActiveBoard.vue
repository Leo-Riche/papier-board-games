<template>
  <div class="game-active">
    <div class="game-header">
      <div class="blueprints-left">
        <div class="stat-box manche">
          <label>Manche</label>
          <div class="value">{{ round }} / 4</div>
        </div>
        <div class="stat-box defuses">
          <label>Fils restants</label>
          <div class="value">{{ defusesLeft }}</div>
        </div>
      </div>
      <div class="room-info">Code: <span class="engraved">{{ roomCode }}</span></div>
    </div>

    <div class="action-desk">
      <div class="action-log">{{ lastAction }}</div>
      <div v-if="hasScissors" class="turn-indicator">
        <span class="pliers">✂️</span> A VOUS de couper !
      </div>
    </div>

    <div class="opponents">
      <div v-for="p in otherPlayers" :key="p.id" class="player-area">
        <p class="opponent-name">
          <span class="badge">👤</span> {{ p.name || 'Anonyme' }} 
          <span v-if="p.hasScissors" class="scissors-badge">✂️</span>
        </p>
        
        <div class="mini-hand">
          <TimeBombCard 
            v-for="(card, i) in p.hand" :key="i" 
            :type="card.type" 
            :is-revealed="card.isRevealed"
            :can-be-cut="hasScissors && !card.isRevealed"
            @cut="$emit('cut', { targetId: p.id, cardIndex: i })"
          />
        </div>
      </div>
    </div>

    <div class="my-area" :class="myRole?.toLowerCase()">
      <div class="my-area-header">
        <span class="joueur">👤 <strong>{{ myName }}</strong></span>
        <div class="role-card">Rôle: <strong>{{ myRole }}</strong></div>
      </div>
      <div class="my-hand">
        <TimeBombCard 
          v-for="(card, i) in myHand" :key="i" 
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

/* === Header === */
.game-header {
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 2px solid rgba(255,222,89,0.3); padding-bottom: 10px;
}
.blueprints-left { display: flex; gap: 15px; }
.stat-box { 
  background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 5px; text-align: center;
  border: 1px solid #a67c00;
}
.stat-box label { font-size: 0.8rem; color: #bdc3c7; }
.stat-box .value { font-size: 1.2rem; font-weight: bold; color: #ffde59; }

.room-info .engraved { font-family: serif; color: #bdc3c7;}

/* === Centre === */
.action-desk { text-align: center; padding: 15px; }
.action-log { background: #f1e7d0; color: #4a3121; padding: 10px 20px; border-radius: 5px; font-weight: bold; border: 2px solid #8b5a2b;}
.turn-indicator { margin-top: 10px; color: #ffde59; font-weight: bold; font-size: 1.2rem; animation: pulse 1.5s infinite;}

/* === Adversaires === */
.opponents { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; padding: 20px; }
.player-area { text-align: center; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.1); }
.opponent-name { font-weight: bold; color: white; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #bdc3c7; padding-bottom: 5px;}
.mini-hand { display: flex; gap: 5px; justify-content: center; margin-top: 10px; transform: scale(0.85); margin: -10px;}

/* === Ma zone (Sherlock vs Moriarty) === */
.my-area {
  display: flex; flex-direction: column; align-items: center; gap: 15px;
  border-top: 5px solid; padding: 20px; border-radius: 10px 10px 0 0;
}
.my-area.sherlock {
  background: linear-gradient(0deg, rgba(31,64,104,0.3), rgba(0,0,0,0.5));
  border-color: #3498db; box-shadow: inset 0 0 30px rgba(52,152,219,0.2);
}
.my-area.moriarty {
  background: linear-gradient(0deg, rgba(142,26,16,0.3), rgba(0,0,0,0.5));
  border-color: #e74c3c; box-shadow: inset 0 0 30px rgba(231,76,60,0.2);
}

.my-area-header { display: flex; gap: 20px; align-items: center;}
.my-area.sherlock .role-card { background: #1f4068; color: #daa520; padding: 5px 15px; border-radius: 5px;}
.my-area.moriarty .role-card { background: #c0392b; color: white; padding: 5px 15px; border-radius: 5px;}

.my-hand { display: flex; gap: 15px; transform: scale(1.1); margin: 10px 0;}

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
</style>