<template>
  <div class="game-active" :class="phase">
    
    <header class="game-header">
      <div class="phase-info">
        <h2 class="phase-title">{{ phaseDisplayName }}</h2>
        <div class="turn-badge">Tour {{ turn }}</div>
      </div>
      <div class="room-info">Code du village : <span class="engraved">{{ roomCode }}</span></div>
    </header>

    <div class="board-content">
      <div class="village-square">
        <div 
          v-for="p in players" 
          :key="p.id" 
          class="player-card" 
          :class="{ 'is-dead': !p.isAlive, 'is-me': p.name === myName }"
        >
          <div class="player-status">
            <span v-if="!p.isAlive">💀</span>
            <span v-else-if="p.hasVoted && phase !== 'day_debate'">✅</span>
          </div>
          <p class="player-name">{{ p.name }}</p>
          
          <div class="player-role-badge" v-if="p.role !== '???'">
            {{ p.role }}
          </div>
          
          <div class="vote-count" v-if="votes[p.id]">
            🩸 {{ votes[p.id] }} vote(s)
          </div>

          <div class="action-zone" v-if="canTarget(p)">
            <button class="action-btn" @click="emitAction(defaultActionType, p.id)">
              {{ actionButtonText }}
            </button>
          </div>
          
          <div class="action-zone" v-if="canWitchKill(p)">
            <button class="action-btn poison-btn" @click="emitAction('kill', p.id)">
              🧪 Empoisonner
            </button>
          </div>
        </div>
      </div>

      <aside class="game-logs-sidebar">
        <h3>📜 Chroniques du Village</h3>
        <ul class="log-list">
          <li v-for="(log, i) in logs" :key="i" class="log-item">
            {{ log }}
          </li>
        </ul>
      </aside>
    </div>

    <footer class="my-area" :class="{ 'dead-area': !isAlive }">
      <div class="my-status">
        <div class="role-image-container">
          <img :src="myRoleImageUrl" alt="Mon Rôle" />
          <div class="death-overlay" v-if="!isAlive">X</div>
        </div>
        <div class="my-info">
          <span class="my-name">{{ myName }}</span>
          <span class="my-role">{{ myRole }}</span>
          <span class="my-state" v-if="!isAlive">Vous êtes mort 👻</span>
        </div>
      </div>

      <div class="special-action-panel" v-if="isMyTurn && phase === 'sorciere' && myRole === 'Sorciere'">
        <h4>Action de la Sorcière</h4>
        <div v-if="nightVictims.length > 0 && potions.heal" class="heal-section">
          <p>Les loups ont attaqué : <strong>{{ getPlayerName(nightVictims[0]) }}</strong></p>
          <button class="action-btn heal-btn" @click="emitAction('heal', nightVictims[0])">💊 Sauver</button>
        </div>
        <div v-else-if="nightVictims.length > 0">
          <p>Les loups ont attaqué : {{ getPlayerName(nightVictims[0]) }}. <br><em>(Vous n'avez plus de potion de vie)</em></p>
        </div>
        <div v-else>
          <p>Personne n'a été attaqué cette nuit.</p>
        </div>
        <button class="action-btn skip-btn" @click="emitAction('skip', null)">Passer / Ne rien faire</button>
      </div>

      <div class="special-action-panel dead-panel" v-if="!isAlive && status === 'playing'">
        Vous pouvez observer le village, mais vous ne pouvez plus agir.
      </div>
    </footer>
    
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  roomCode: String,
  status: String,
  phase: String,
  turn: Number,
  winner: String,
  myName: String,
  myRole: String,
  isAlive: Boolean,
  potions: Object,
  nightVictims: Array,
  players: Array,
  votes: Object,
  logs: Array
});

const emit = defineEmits(['action']);

const me = computed(() => props.players.find(p => p.name === props.myName) || {});
const isMyTurn = computed(() => props.isAlive && !me.value.hasVoted);

const phaseDisplayName = computed(() => {
  if (props.status === 'finished') return "PARTIE TERMINÉE";
  const names = {
    'lobby': "En attente...",
    'cupidon': "Cupidon choisit les amoureux",
    'voyante': "La Voyante inspecte le village",
    'loups': "Les Loups-Garous choisissent leur proie",
    'sorciere': "La Sorcière prépare ses potions",
    'day_debate': "Le jour s'est levé... Débattez !",
    'day_vote': "Le village vote pour éliminer un suspect"
  };
  return names[props.phase] || props.phase;
});

const defaultActionType = computed(() => {
  if (props.phase === 'voyante') return 'see';
  if (props.phase === 'loups' || props.phase === 'day_vote') return 'vote';
  return null;
});

const actionButtonText = computed(() => {
  if (props.phase === 'voyante') return '👁️ Inspecter';
  if (props.phase === 'loups') return '🐺 Dévorer';
  if (props.phase === 'day_vote') return '🔥 Voter';
  return 'Agir';
});

const canTarget = (player) => {
  if (!isMyTurn.value || !player.isAlive || player.name === props.myName) return false;
  
  if (props.phase === 'voyante' && props.myRole === 'Voyante') return true;
  if (props.phase === 'loups' && props.myRole === 'Loup-Garou' && player.role !== 'Loup-Garou') return true;
  if (props.phase === 'day_vote') return true;
  
  return false;
};

const canWitchKill = (player) => {
  return isMyTurn.value && 
         props.phase === 'sorciere' && 
         props.myRole === 'Sorciere' && 
         props.potions.kill && 
         player.isAlive && 
         player.name !== props.myName;
};

const emitAction = (actionType, targetId) => {
  emit('action', { actionType, targetId });
};

const getPlayerName = (id) => {
  const p = props.players.find(p => p.id === id);
  return p ? p.name : 'Inconnu';
};

const myRoleImageUrl = computed(() => {
  if (!props.myRole) return '';
  return new URL(`../../assets/images/TimeBomb/roles/${props.myRole}.svg`, import.meta.url).href;
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Space+Mono&display=swap');

.game-active { flex: 1; display: flex; flex-direction: column; font-family: 'Space Mono', monospace; color: #dfd3c3; height: 100%;}

.game-header { text-align: center; border-bottom: 1px solid rgba(205, 164, 52, 0.2); padding-bottom: 15px; margin-bottom: 20px;}
.phase-title { font-family: 'Cormorant Garamond', serif; font-size: 2.5rem; color: #cda434; margin: 0; font-weight: normal; letter-spacing: 2px;}
.turn-badge { display: inline-block; background: rgba(205, 164, 52, 0.1); border: 1px solid #cda434; padding: 4px 12px; margin-top: 5px; font-size: 0.8rem; text-transform: uppercase;}
.room-info { margin-top: 10px; font-size: 0.8rem; color: #8a8277; }
.room-info .engraved { color: #dfd3c3; letter-spacing: 2px;}

.board-content { display: flex; flex: 1; gap: 20px; overflow: hidden;}

.village-square { flex: 2; display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; align-content: flex-start; overflow-y: auto; padding: 10px;}
.player-card { 
  background: rgba(28, 26, 25, 0.8); border: 1px solid rgba(223, 211, 195, 0.2); 
  width: 160px; padding: 15px; text-align: center; border-radius: 4px; position: relative;
  display: flex; flex-direction: column; gap: 10px;
}
.player-card.is-me { border-color: #cda434; background: rgba(205, 164, 52, 0.05);}
.player-card.is-dead { opacity: 0.5; filter: grayscale(100%); pointer-events: none;}
.player-status { position: absolute; top: 5px; right: 5px; font-size: 1.2rem;}
.player-name { font-weight: bold; margin: 0; color: #dfd3c3; font-size: 1.1rem; text-transform: uppercase;}
.player-role-badge { background: #161514; border: 1px dashed #8a8277; font-size: 0.75rem; padding: 4px; color: #cda434;}
.vote-count { color: #e74c3c; font-weight: bold; font-size: 0.9rem;}

.action-btn { background: transparent; border: 1px solid #cda434; color: #cda434; padding: 8px; font-family: 'Space Mono', monospace; font-size: 0.8rem; cursor: pointer; text-transform: uppercase; transition: 0.2s;}
.action-btn:hover { background: rgba(205, 164, 52, 0.2); }
.poison-btn { border-color: #9b59b6; color: #9b59b6;}
.poison-btn:hover { background: rgba(155, 89, 182, 0.2);}
.heal-btn { border-color: #2ecc71; color: #2ecc71;}
.heal-btn:hover { background: rgba(46, 204, 113, 0.2);}
.skip-btn { border-color: #8a8277; color: #8a8277;}

.game-logs-sidebar { flex: 1; border-left: 1px solid rgba(205, 164, 52, 0.2); padding-left: 20px; display: flex; flex-direction: column; max-width: 350px;}
.game-logs-sidebar h3 { font-family: 'Cormorant Garamond', serif; color: #cda434; font-size: 1.5rem; margin-top: 0; font-weight: normal; border-bottom: 1px dashed rgba(205, 164, 52, 0.3); padding-bottom: 10px;}
.log-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1;}
.log-item { padding: 8px 0; border-bottom: 1px dashed rgba(223, 211, 195, 0.1); font-size: 0.85rem; color: #8a8277; line-height: 1.4;}
.log-item:last-child { color: #dfd3c3; font-weight: bold;}

.my-area { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(205, 164, 52, 0.3); padding: 20px; margin-top: 20px; background: #1c1a19;}
.my-area.dead-area { opacity: 0.7; filter: grayscale(50%); border-top-color: #5a554f;}
.my-status { display: flex; align-items: center; gap: 20px;}
.role-image-container { position: relative; width: 80px; height: 120px;}
.role-image-container img { width: 100%; height: 100%; object-fit: cover; border: 1px solid rgba(205, 164, 52, 0.4);}
.death-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); color: red; display: flex; align-items: center; justify-content: center; font-size: 4rem; font-family: sans-serif;}
.my-info { display: flex; flex-direction: column; gap: 5px;}
.my-name { font-size: 1.5rem; color: #cda434; font-weight: bold; text-transform: uppercase;}
.my-role { font-size: 1rem; color: #8a8277;}
.my-state { color: #e74c3c; font-weight: bold; margin-top: 10px;}

.special-action-panel { flex: 1; text-align: center; padding: 0 20px;}
.special-action-panel h4 { margin: 0 0 10px 0; color: #cda434; font-family: 'Cormorant Garamond', serif;}
.heal-section { margin-bottom: 15px;}
.dead-panel { color: #8a8277; font-style: italic;}

@media (max-width: 900px) {
  .board-content { flex-direction: column;}
  .game-logs-sidebar { border-left: none; border-top: 1px solid rgba(205, 164, 52, 0.2); padding-left: 0; padding-top: 20px; max-width: 100%; min-height: 200px;}
  .my-area { flex-direction: column; text-align: center; gap: 20px;}
}
</style>