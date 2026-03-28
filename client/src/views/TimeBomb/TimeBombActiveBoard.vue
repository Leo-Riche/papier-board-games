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
.game-active { flex: 1; display: flex; flex-direction: column; justify-content: space-between; position: relative; font-family: 'Space Mono', monospace; color: #dfd3c3;}
.game-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(205, 164, 52, 0.2); padding-bottom: 15px; margin-bottom: 15px;}
.blueprints-left { display: flex; gap: 20px; }
.stat-box { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.stat-box label { font-size: 0.65rem; color: #8a8277; text-transform: uppercase; letter-spacing: 1px; }
.stat-box .value { font-size: 1.2rem; color: #cda434; }
.room-info { font-size: 0.8rem; color: #8a8277; }
.room-info .engraved { color: #dfd3c3; letter-spacing: 2px;}

.opponents { display: flex; justify-content: space-around; padding: 20px 0; }
.player-area { text-align: center; padding: 10px; transition: opacity 0.3s ease; }
.opponent-name { font-size: 0.85rem; text-transform: uppercase; color: #dfd3c3; margin-bottom: 10px; border-bottom: 1px dashed rgba(223, 211, 195, 0.2); padding-bottom: 5px; display: inline-block;}
.mini-hand { display: flex; gap: 10px; margin-top: 15px; justify-content: center; }

.player-area.is-protected { opacity: 0.4; pointer-events: none; }
.protected-badge { font-size: 1rem; margin-left: 5px; opacity: 0.8; }

.central-investigation-bureau { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.turn-status-panel { text-align: center; border: 1px solid rgba(205, 164, 52, 0.2); padding: 15px 30px; background: rgba(28, 26, 25, 0.8); }
.turn-indicator { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;}
.turn-indicator.my-turn { color: #cda434; animation: pulse 2s infinite; }
.turn-indicator.other-turn { color: #8a8277; }
.turn-indicator.other-turn strong { color: #dfd3c3; }
.turn-indicator.redistributing, .turn-indicator.waiting { color: #a96c3c; animation: pulse 3s infinite; }
.ui-scissors-icon { width: 1.2rem; vertical-align: middle; margin: 0 8px; }

.my-area { display: flex; flex-direction: column; align-items: center; gap: 15px; border-top: 1px solid rgba(205, 164, 52, 0.3); padding: 30px 20px 20px 20px; position: relative; min-height: 250px; background: #1c1a19; }
.my-area.sherlock { border-top-color: #4b6b78; } 
.my-area.moriarty { border-top-color: #8c3b3b; } 

.my-info { font-size: 1rem; color: #cda434; text-transform: uppercase; letter-spacing: 2px; }

.player-chat-display { position: absolute; bottom: 20px; left: 20px; height: 180px; width: 300px; z-index: 10; }
.player-role-display { position: absolute; bottom: 20px; right: 20px; height: 180px; z-index: 10; opacity: 0.9; }
.player-role-display img { height: 100%; border: 1px solid rgba(205, 164, 52, 0.4); }

.player-announcement { background: #161514; border: 1px solid rgba(223, 211, 195, 0.2); color: #dfd3c3; padding: 4px 10px; font-size: 0.75rem; margin: 10px auto; display: inline-block; }

.announce-panel { border: 1px dashed rgba(205, 164, 52, 0.5); padding: 15px 25px; background: transparent; text-align: center; }
.announce-title { color: #8a8277; margin-bottom: 15px; font-size: 0.8rem; text-transform: uppercase; }
.announce-options { display: flex; gap: 20px; align-items: center; justify-content: center; }
.defuse-btns, .bomb-btn { display: flex; gap: 8px; }
.defuse-btns button, .bomb-btn { background: transparent; color: #dfd3c3; border: 1px solid #5a554f; padding: 6px 12px; cursor: pointer; font-family: 'Space Mono', monospace; font-size: 0.8rem; transition: 0.2s; }
.defuse-btns button:hover, .bomb-btn:hover { border-color: #cda434; }
.defuse-btns button.active { background: rgba(205, 164, 52, 0.1); border-color: #cda434; color: #cda434; }
.bomb-btn.active { background: rgba(169, 108, 60, 0.1); border-color: #a96c3c; color: #a96c3c; }
.submit-announce { background: #cda434; color: #161514; border: none; padding: 8px 20px; cursor: pointer; font-family: 'Space Mono', monospace; text-transform: uppercase; font-size: 0.8rem; }
.submit-announce:hover { background: #dfd3c3; }

.my-announcement { border: 1px solid rgba(205, 164, 52, 0.2); padding: 8px 20px; font-size: 0.85rem; color: #8a8277; }
.announce-icon { width: 1em; vertical-align: middle; margin-left: 6px; }

.my-hand { display: flex; gap: 20px; margin: 20px 0; }
.game-active.holding-scissors { cursor: crosshair; }
.holding-scissors .mini-hand * { cursor: crosshair !important; }
.holding-scissors .player-chat-display, .holding-scissors .announce-panel, .holding-scissors button { cursor: default; }

.deal-opponent-enter-active, .deal-opponent-leave-active, .deal-me-enter-active, .deal-me-leave-active { transition: all 0.5s ease; }
.deal-opponent-enter-from, .deal-me-enter-from { opacity: 0; transform: translateY(20px); }
.deal-opponent-leave-to, .deal-me-leave-to { opacity: 0; transform: translateY(-20px); }
.deal-opponent-leave-active, .deal-me-leave-active { position: absolute; }
.mini-hand { min-height: 120px; }
.my-hand { min-height: 150px; }

.game-active.holding-scissors {
  cursor: url('/src/assets/images/Ciseaux-cursor.svg') 10 10, crosshair;
}

.holding-scissors .mini-hand * {
  cursor: url('/src/assets/images/Ciseaux-cursor.svg') 10 10, pointer !important;
}

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
</style>