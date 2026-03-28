<template>
  <div class="game-active" :class="{ 'holding-scissors': hasScissors && allAnnounced }">
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
        <div class="stat-box cuts-left">
          <label>Coups restants</label>
          <div class="value">{{ cutsLeft }}</div>
        </div>
      </div>
      <div class="room-info">Code: <span class="engraved">{{ roomCode }}</span></div>
    </div>

    <div class="opponents">
      <div 
        v-for="p in otherPlayers" 
        :key="p.id" 
        class="player-area" 
        :class="{ 'is-protected': p.id === protectedPlayerId }"
      >
        <p class="opponent-name">
          👤 {{ p.name || 'Anonyme' }}
          <span v-if="p.id === protectedPlayerId" class="protected-badge" title="Anti Ping-Pong">🛡️</span>
        </p>
        <div v-if="announcements[p.name]" class="player-announcement">
          {{ announcements[p.name].defuses }} 
          <img src="@/assets/images/Desamorceur.svg" alt="Désamorceurs" class="announce-icon" />
          <span v-if="announcements[p.name].hasBomb"> 
            | <img src="@/assets/images/Bombe.svg" alt="Bombe" class="announce-icon" />
          </span>
        </div>
        <TransitionGroup name="deal-opponent" tag="div" class="mini-hand">
          <TimeBombCard 
            v-for="(card, i) in p.hand" 
            :key="`opp-${round}-${i}`" 
            :type="card.type" 
            :is-revealed="card.isRevealed"
            :can-be-cut="hasScissors && allAnnounced && !card.isRevealed && p.id !== protectedPlayerId"
            @cut="$emit('cut', { targetId: p.id, cardIndex: i })"
          />
        </TransitionGroup>
      </div>
    </div>

    <div class="central-investigation-bureau">
      <div class="turn-status-panel">
        <div v-if="isRedistributing" class="turn-indicator redistributing">
          ⏳ Redistribution en cours...
        </div>
        <div v-else-if="!allAnnounced" class="turn-indicator waiting">
          ⏳ En attente des annonces ({{ Object.keys(announcements).length }} / {{ otherPlayers.length + 1 }})...
        </div>
        <div v-else-if="hasScissors" class="turn-indicator my-turn">
          <img src="@/assets/images/Ciseaux.svg" alt="Ciseaux" class="ui-scissors-icon" /> 
          A VOUS de couper !
        </div>
        <div v-else class="turn-indicator other-turn">
          C'est au tour de <strong>{{ currentPlayerWithScissors }}</strong> 
          <img src="@/assets/images/Ciseaux.svg" alt="Ciseaux" class="ui-scissors-icon" />
        </div>
      </div>
    </div>

    <div class="my-area" :class="myRole?.toLowerCase()">
      <div class="my-info">
        <span><strong>{{ myName }}</strong></span>
      </div>
      
      <div class="player-chat-display">
        <GameLogChat :messages="gameMessages" @send="handleChatSend" />
      </div>

      <div class="player-role-display">
        <img :src="getRoleCardImageUrl(myRoleCard)" alt="Ma Carte Rôle" />
      </div>

      <div v-if="!hasAnnounced" class="announce-panel">
        <div class="announce-title">Annoncez votre jeu :</div>
        <div class="announce-options">
          <div class="defuse-btns">
            <button 
              v-for="n in (unrevealedCardsCount + 1)" :key="n-1" 
              :class="{ active: announceDefuses === (n-1) }"
              @click="announceDefuses = n-1"
            >
              {{ n-1 }} <img src="@/assets/images/Desamorceur.svg" alt="Désamorceurs" class="announce-icon" />
            </button>
          </div>
          <button class="bomb-btn" :class="{ active: announceBomb }" @click="announceBomb = !announceBomb">
            <img src="@/assets/images/Bombe.svg" alt="Bombe" class="announce-icon" /> Bombe
          </button>
          <button class="submit-announce" @click="$emit('announce', { defuses: announceDefuses, hasBomb: announceBomb })">
            VALIDER
          </button>
        </div>
      </div>
      <div v-else class="my-announcement">
        Vous avez annoncé : <strong>{{ announcements[myName].defuses }} <img src="@/assets/images/Desamorceur.svg" alt="Désamorceurs" class="announce-icon" /></strong> 
        <strong v-if="announcements[myName].hasBomb"> et <img src="@/assets/images/Bombe.svg" alt="Bombe" class="announce-icon" /></strong>
      </div>

      <TransitionGroup name="deal-me" tag="div" class="my-hand">
        <TimeBombCard 
          v-for="(card, i) in myHand" 
          :key="`me-${round}-${i}`" 
          :type="card.type" 
          :is-revealed="true"
          :wasCut="card.isRevealed"
        />
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TimeBombCard from './TimeBombCard.vue'
import GameLogChat from './GameLogChat.vue' 

const props = defineProps({
  roomCode: String,
  round: Number,
  defusesLeft: Number,
  cutsLeft: Number,
  announcements: Object,
  myName: String,
  myRole: String, 
  myRoleCard: String,
  myHand: Array,
  hasScissors: Boolean,
  otherPlayers: Array,
  gameMessages: Array,
  isRedistributing: Boolean,
  protectedPlayerId: String,
  allAnnounced: Boolean
});

const emit = defineEmits(['cut', 'chatSend', 'announce']);

const announceDefuses = ref(0);
const announceBomb = ref(false);

const hasAnnounced = computed(() => !!props.announcements[props.myName]);
const unrevealedCardsCount = computed(() => props.myHand.filter(c => !c.isRevealed).length);

const currentPlayerWithScissors = computed(() => {
  const player = props.otherPlayers.find(p => p.hasScissors);
  return player ? player.name : 'un joueur';
});

const handleChatSend = (text) => {
  emit('chatSend', text);
}

const getRoleCardImageUrl = (roleCardName) => {
  if (!roleCardName) return new URL('../../assets/images/roles/Sherlock1.svg', import.meta.url).href;
  return new URL(`../../assets/images/roles/${roleCardName}.svg`, import.meta.url).href;
}
</script>

<style scoped>
.game-active { flex: 1; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
.game-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(255,222,89,0.3); padding-bottom: 10px;}
.blueprints-left { display: flex; gap: 15px; }
.stat-box { background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 5px; text-align: center; border: 1px solid #a67c00;}
.stat-box label { font-size: 0.8rem; color: #bdc3c7; }
.stat-box .value { font-size: 1.2rem; font-weight: bold; color: #ffde59; }
.room-info .engraved { font-family: serif; color: #bdc3c7;}
.opponents { display: flex; justify-content: space-around; padding: 20px; }
.player-area { text-align: center; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; min-width: 150px; transition: all 0.3s ease; }
.opponent-name { font-weight: bold; margin-bottom: 5px; color: #ffde59; }
.mini-hand { display: flex; gap: 8px; margin-top: 10px; justify-content: center; }

.player-area.is-protected {
  opacity: 0.6; 
  pointer-events: none; 
  filter: grayscale(0.5);
}
.protected-badge { font-size: 1.2rem; margin-left: 5px; vertical-align: middle; filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5)); }

.central-investigation-bureau { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 40px; }
.turn-status-panel { text-align: center; margin-bottom: 20px; }
.turn-indicator { font-weight: bold; font-size: 1.3rem; }
.turn-indicator.my-turn { color: #ffde59; animation: pulse 1.5s infinite; }
.turn-indicator.other-turn { color: #bdc3c7; font-style: italic;}
.turn-indicator.other-turn strong { color: #ffde59; font-style: normal; font-size: 1.4rem; text-shadow: 0 0 10px rgba(255, 222, 89, 0.3);}
.turn-indicator.redistributing { color: #3498db; font-style: italic; animation: pulse 1.5s infinite; }
.turn-indicator.waiting {
  color: #f39c12; 
  font-style: italic; 
  animation: pulse 2s infinite;
}

.ui-scissors-icon { width: 1.5rem; height: auto; vertical-align: middle; margin: 0 5px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }

.my-area { display: flex; flex-direction: column; align-items: center; gap: 10px; border-top: 5px solid; padding: 15px 20px 20px 20px; border-radius: 10px 10px 0 0; position: relative; min-height: 250px; }
.my-area.sherlock { background: linear-gradient(0deg, rgba(31,64,104,0.3), rgba(0,0,0,0.5)); border-color: #3498db; box-shadow: inset 0 0 30px rgba(52,152,219,0.2); }
.my-area.moriarty { background: linear-gradient(0deg, rgba(142,26,16,0.3), rgba(0,0,0,0.5)); border-color: #e74c3c; box-shadow: inset 0 0 30px rgba(231,76,60,0.2); }
.my-info { margin-bottom: 5px; font-size: 1.1rem; }

.player-chat-display { position: absolute; bottom: 20px; left: 20px; height: 180px; width: 350px; z-index: 10; }
.player-role-display { position: absolute; bottom: 20px; right: 20px; height: 180px; transform: rotate(-5deg); box-shadow: 0 5px 20px rgba(0,0,0,0.6); border-radius: 8px; z-index: 10; }
.player-role-display img { height: 100%; width: auto; border: 4px solid #daa520; border-radius: 8px;}
.my-area.sherlock .player-role-display { filter: drop-shadow(0 0 10px #3498db); }
.my-area.moriarty .player-role-display { filter: drop-shadow(0 0 10px #e74c3c); }
.my-hand { display: flex; gap: 15px; transform: scale(1.1); margin: 10px 0; }

.player-announcement {
  background: rgba(0,0,0,0.6); border: 1px solid #3498db; color: #ecf0f1;
  padding: 4px 8px; border-radius: 12px; font-size: 0.9rem; margin: 5px auto;
  display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
}

.announce-panel {
  background: rgba(0,0,0,0.7); border: 2px dashed #ffde59; padding: 10px 20px;
  border-radius: 8px; margin-bottom: 10px; text-align: center;
}
.announce-title { color: #ffde59; margin-bottom: 8px; font-weight: bold; }
.announce-options { display: flex; gap: 15px; align-items: center; justify-content: center; flex-wrap: wrap;}
.defuse-btns { display: flex; gap: 5px; background: rgba(255,255,255,0.1); padding: 5px; border-radius: 5px;}
.defuse-btns button, .bomb-btn {
  background: #2c3e50; color: white; border: 1px solid #7f8c8d; padding: 5px 12px;
  border-radius: 4px; cursor: pointer; transition: 0.2s; font-weight: bold;
}
.defuse-btns button:hover, .bomb-btn:hover { background: #34495e; }
.defuse-btns button.active { background: #2ecc71; border-color: #27ae60; color: #111; }
.bomb-btn.active { background: #e74c3c; border-color: #c0392b; color: white; box-shadow: 0 0 10px #e74c3c;}
.submit-announce { background: #f39c12; color: #111; border: none; font-weight: bold; padding: 6px 15px; border-radius: 4px; cursor: pointer; }
.submit-announce:hover { background: #f1c40f; }
.my-announcement { background: rgba(52, 152, 219, 0.2); padding: 8px 15px; border-radius: 5px; border: 1px solid #3498db; margin-bottom: 10px;}
.announce-icon {
  width: 1.2em;
  height: auto;
  vertical-align: middle;
  margin-left: 4px;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));
}

.game-active.holding-scissors {
  cursor: url('/src/assets/images/Ciseaux-cursor.svg') 10 10, crosshair;
}

.holding-scissors .mini-hand * {
  cursor: url('/src/assets/images/Ciseaux-cursor.svg') 10 10, pointer !important;
}

.holding-scissors .player-chat-display,
.holding-scissors .announce-panel,
.holding-scissors button,
.holding-scissors input {
  cursor: default;
}

.player-area.is-protected,
.player-area.is-protected * {
  cursor: not-allowed !important;
}

.deal-opponent-enter-active, .deal-opponent-leave-active {
  transition: all 0.6s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

.deal-opponent-enter-from, .deal-opponent-leave-to {
  opacity: 0;
  transform: translateY(150px) scale(0.2) rotate(180deg);
}

.deal-opponent-leave-active {
  position: absolute;
}

.deal-me-enter-active, .deal-me-leave-active {
  transition: all 0.7s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

.deal-me-enter-from, .deal-me-leave-to {
  opacity: 0;
  transform: translateY(-200px) scale(0.2) rotate(-180deg);
}
.deal-me-leave-active {
  position: absolute;
}

.mini-hand { min-height: 90px; }
.my-hand { min-height: 150px; }

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
</style>