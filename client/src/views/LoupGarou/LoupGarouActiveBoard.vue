<template>
  <div class="game-active" :class="phase">
    
    <header class="game-header">
      <div class="phase-info">
        <h2 class="phase-title">{{ phaseDisplayName }}</h2>
        <div class="turn-badge">Tour {{ turn }}</div>
      </div>
      <div class="timer-section" v-if="timeLeft > 0">
        <div class="countdown">⏳ {{ timeLeft }}s</div>
      </div>
      <div class="room-info">Code du village : <span class="engraved">{{ roomCode }}</span></div>
    </header>

    <div class="board-content">
      <div class="village-square">
        <div 
          v-for="p in players" 
          :key="p.id" 
          class="player-card" 
          :class="{ 
            'is-dead': !p.isAlive, 
            'is-me': p.name === myName,
            'cupidon-selected': cupidonSelection.includes(p.id)
          }"
        >
          <div class="player-status">
            <span v-if="!p.isAlive">💀</span>
            <span v-else-if="p.hasVoted && phase !== 'day_debate' && phase !== 'lobby'">✅</span>
            <span v-else-if="p.isReady" title="Prêt à passer">🕒</span>
          </div>
          
          <div class="badges-container">
            <span v-if="p.isMayor" class="mayor-badge" title="Maire">👑</span>
            <span v-if="p.isLover" class="lover-badge" title="Amoureux">💕</span>
          </div>

          <p class="player-name">{{ p.name }}</p>
          
          <div class="player-role-badge" v-if="p.role !== '???'">
            {{ p.role }}
          </div>

          <div class="vote-count" v-if="votes[p.id]">
            🩸 {{ votes[p.id] }} vote(s)
          </div>

          <!-- Actions de vote classiques -->
          <div class="action-zone" v-if="canTarget(p)">
            <button class="action-btn" @click="emitAction(defaultActionType, p.id)">
              {{ actionButtonText }}
            </button>
          </div>
          
          <!-- Actions spéciales Sorcière -->
          <div class="action-zone" v-if="canWitchKill(p)">
            <button class="action-btn poison-btn" @click="emitAction('kill', p.id)">
              🧪 Empoisonner
            </button>
          </div>

          <!-- Actions Cupidon -->
          <div class="action-zone" v-if="phase === 'cupidon' && myRole === 'Cupidon' && isMyTurn && p.isAlive">
             <button class="action-btn lover-btn" @click="toggleCupidonTarget(p.id)">
               {{ cupidonSelection.includes(p.id) ? '💔 Retirer' : '💘 Cibler' }}
             </button>
          </div>

          <!-- Actions Chasseur -->
          <div class="action-zone" v-if="phase === 'chasseur_revenge' && myRole === 'Chasseur' && !isAlive && p.isAlive">
             <button class="action-btn hunter-btn" @click="emitAction('chasseur_kill', p.id)">
               🏹 Tirer
             </button>
          </div>

          <!-- Action Succession Maire -->
          <div class="action-zone" v-if="phase === 'mayor_succession' && isMayor && !isAlive && p.isAlive">
            <button class="action-btn mayor-btn" @click="emitAction('mayor_successor', p.id)">
              👑 Léguer
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
          <img :src="myRoleImageUrl" alt="Mon Rôle" @error="handleImageError" />
          <div class="death-overlay" v-if="!isAlive">X</div>
        </div>
        <div class="my-info">
          <span class="my-name">
            {{ myName }}
            <span v-if="isMayor" title="Maire">👑</span>
            <span v-if="isLover" title="Amoureux">💕</span>
          </span>
          <span class="my-role">{{ myRole }}</span>
          <span class="my-state" v-if="!isAlive">Vous êtes mort(e) 👻</span>
        </div>
      </div>

      <!-- Commandes temporelles & skips -->
      <div class="controls-panel" v-if="isAlive && !me.isReady && phase !== 'lobby'">
        <button class="action-btn skip-btn" @click="emitAction('ready', null)">
           Passer / Je suis Prêt ⏩
        </button>
      </div>

      <!-- Action spécifique Sorcière -->
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
        <button class="action-btn skip-btn" @click="emitAction('skip', null)">Passer cette étape</button>
      </div>

      <!-- Action Chien Loup -->
      <div class="special-action-panel" v-if="isMyTurn && phase === 'chien_loup' && myRole === 'Chien-Loup'">
        <h4>Le dilemme du Chien-Loup</h4>
        <p>Peux-tu contenir ton instinct bestial ? Choisis ton camp (c'est définitif !)</p>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="action-btn heal-btn" @click="emitAction('choose_faction', 'village')">🧑‍🌾 Village</button>
          <button class="action-btn poison-btn" @click="emitAction('choose_faction', 'loups')">🐺 Meute</button>
        </div>
      </div>

      <!-- Action Voleur -->
      <div class="special-action-panel voleur-panel" v-if="isMyTurn && phase === 'voleur' && myRole === 'Voleur'">
        <h4>Le Butin du Voleur</h4>
        <p>Tu peux échanger ton rôle avec l'une de ces deux cartes.</p>
        <div class="center-cards-container">
           <div class="center-card" v-for="(cardRole, idx) in centerCards" :key="'center-'+idx">
             <div class="role-image-wrapper">
                <img :src="getRoleImageUrlByName(cardRole)" :alt="cardRole" @error="handleImageError"/>
             </div>
             <p class="card-role-name">{{ cardRole }}</p>
             <button class="action-btn" @click="emitAction('voleur_choose', idx)">Prendre</button>
           </div>
        </div>
        <p v-if="mustVoleurSwap" class="warning-text">⚠️ Tu es obligé d'échanger car les deux cartes sont des Loups !</p>
        <button v-else class="action-btn skip-btn mt-2" @click="emitAction('skip', null)">Ne rien faire (Garder Voleur)</button>
      </div>

      <!-- Action Infect Père des Loups -->
      <div class="special-action-panel" v-if="isMyTurn && phase === 'infect_pere' && myRole === 'Infect Père des Loups'">
        <h4>Infection</h4>
        <div v-if="nightVictims.length > 0" class="heal-section">
          <p>La meute s'est acharnée sur : <strong>{{ getPlayerName(nightVictims[0]) }}</strong></p>
          <p>Tu peux l'infecter au lieu de le tuer (usage unique).</p>
          <button class="action-btn poison-btn" @click="emitAction('infect', nightVictims[0])" style="margin-bottom: 10px;">🦠 Infecter</button>
          <button class="action-btn skip-btn" @click="emitAction('skip', null)">Laisser mourir</button>
        </div>
      </div>

      <!-- Skip actions (pour GML ou LGB) -->
      <div class="special-action-panel" v-if="isMyTurn && (phase === 'grand_mechant_loup' || phase === 'loup_blanc')">
        <h4>Ton action subsidiaire</h4>
        <p>Tu n'es pas obligé de frapper si ce n'est pas le moment.</p>
        <button class="action-btn skip-btn" @click="emitAction('skip', null)">Ne rien faire et passer</button>
      </div>

      <div class="special-action-panel dead-panel" v-if="!isAlive && phase !== 'chasseur_revenge' && phase !== 'mayor_succession'">
        Vous observez le village depuis l'au-delà...
      </div>
      
      <div class="special-action-panel" v-if="!isAlive && phase === 'chasseur_revenge' && myRole === 'Chasseur'">
        <h4>Dernier Souffle du Chasseur</h4>
        <p>Tu es mort, choisis avec qui tu veux partir ! 🏹</p>
      </div>

      <div class="special-action-panel" v-if="!isAlive && phase === 'mayor_succession' && isMayor">
        <h4>Succession du Maire</h4>
        <p>Tu es mort, désigne le nouveau Maire ! 👑</p>
      </div>
    </footer>
    
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  roomCode: String,
  status: String,
  phase: String,
  turn: Number,
  winner: String,
  myName: String,
  myRole: String,
  isAlive: Boolean,
  isMayor: Boolean,
  isLover: Boolean,
  isInfected: Boolean,
  faction: String,
  potions: Object,
  nightVictims: Array,
  players: Array,
  votes: Object,
  centerCards: Array,
  logs: Array,
  timeLeft: Number
});

const emit = defineEmits(['action']);

const me = computed(() => props.players.find(p => p.name === props.myName) || {});

const isWolfString = (roleString) => {
  if (!roleString || roleString === '???') return false;
  const wolves = ['Loup-Garou', 'Loup Garou Blanc', 'Loup Garou Voyant', 'Grand Méchant Loup', 'Infect Père des Loups'];
  return wolves.includes(roleString) || roleString.includes('(Infecté)') || roleString === 'Chien-Loup';
};

const amIWolf = computed(() => {
  return isWolfString(props.myRole) || props.isInfected || (props.myRole === 'Chien-Loup' && props.faction === 'loups');
});

const isMyTurn = computed(() => {
  if (!props.isAlive) return false;
  if (me.value.hasVoted) return false;
  // Specific logic for Loup Voyant voting during 'loups' phase
  if (props.phase === 'loups' && props.myRole === 'Loup Garou Voyant') {
    const aliveWolvesCount = props.players.filter(p => p.isAlive && isWolfString(p.role)).length;
    // The server counts them including us, but Loup-Garou Voyant is included.
    // If we see more than ourselves, we don't vote (not the last wolf)
    if (aliveWolvesCount > 1) return false;
  }
  return true;
});

// Pour Cupidon
const cupidonSelection = ref([]);

// Écouter si la phase change pour clean la sélection si besoin
watch(() => props.phase, () => {
  cupidonSelection.value = [];
});

const phaseDisplayName = computed(() => {
  if (props.status === 'finished') return "PARTIE TERMINÉE";
  const names = {
    'lobby': "En attente...",
    'voleur': "Le Voleur observe son butin",
    'cupidon': "Cupidon choisit les amoureux",
    'chien_loup': "Le Chien-Loup choisit son camp",
    'loup_voyant': "Le Loup Garou Voyant cible sa victime",
    'voyante': "La Voyante inspecte le village",
    'loups': "Les Loups-Garous choisissent leur proie",
    'infect_pere': "L'Infect Père des Loups étend la meute",
    'grand_mechant_loup': "Le Grand Méchant Loup fait un festin",
    'loup_blanc': "Le Loup Garou Blanc élimine l'un des siens",
    'sorciere': "La Sorcière prépare ses potions",
    'day_debate': "Le jour s'est levé... Débattez !",
    'mayor_election': "Le village vote pour le Maire 👑",
    'day_vote': "Le village vote pour éliminer un suspect",
    'chasseur_revenge': "Dernier tir du Chasseur",
    'mayor_succession': "Le Maire mort désigne un successeur"
  };
  return names[props.phase] || props.phase;
});

const defaultActionType = computed(() => {
  if (props.phase === 'voyante' || props.phase === 'loup_voyant') return 'see';
  if (props.phase === 'loups' || props.phase === 'day_vote' || props.phase === 'mayor_election') return 'vote';
  if (props.phase === 'grand_mechant_loup' || props.phase === 'loup_blanc') return 'kill';
  return null;
});

const actionButtonText = computed(() => {
  if (props.phase === 'voyante' || props.phase === 'loup_voyant') return '👁️ Inspecter';
  if (props.phase === 'loups') return '🐺 Dévorer';
  if (props.phase === 'day_vote') return '🔥 Voter';
  if (props.phase === 'mayor_election') return '👑 Élire';
  if (props.phase === 'grand_mechant_loup') return '🐺 Manger';
  if (props.phase === 'loup_blanc') return '🗡️ Trahir';
  return 'Agir';
});

const canTarget = (player) => {
  if (!isMyTurn.value || !player.isAlive) return false;
  
  if (props.phase === 'voyante' && props.myRole === 'Voyante' && player.name !== props.myName) return true;
  if (props.phase === 'loup_voyant' && props.myRole === 'Loup Garou Voyant' && player.name !== props.myName) return true;
  
  if (props.phase === 'loups' && amIWolf.value && !isWolfString(player.role)) return true;
  if (props.phase === 'grand_mechant_loup' && props.myRole === 'Grand Méchant Loup' && player.name !== props.myName && !isWolfString(player.role)) return true;
  if (props.phase === 'loup_blanc' && props.myRole === 'Loup Garou Blanc' && player.name !== props.myName && isWolfString(player.role)) return true;

  if (props.phase === 'day_vote') return true;
  if (props.phase === 'mayor_election') return true; // On peut voter pour soi-même !
  
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

const toggleCupidonTarget = (id) => {
  if (cupidonSelection.value.includes(id)) {
    cupidonSelection.value = cupidonSelection.value.filter(item => item !== id);
  } else if (cupidonSelection.value.length < 2) {
    cupidonSelection.value.push(id);
  }
};

const confirmCupidonChoice = () => {
  if (cupidonSelection.value.length === 2) {
    emitAction('cupidon_choose', cupidonSelection.value);
  }
};

const getPlayerName = (id) => {
  const p = props.players.find(p => p.id === id);
  return p ? p.name : 'Inconnu';
};

const getRoleImageFilename = (role) => {
  if (!role || role === '???') return 'Villageois.svg';
  let filename = role.replace(/[\s-]/g, '');
  if (role === 'Sorciere' || role === 'Sorcière') filename = 'Sociere'; // Keep your specific typo logic here
  if (role === 'Necromancien') filename = 'Nécromancien';
  return `${filename}.svg`;
};

const myRoleImageUrl = computed(() => {
  if (!props.myRole) return '';
  // Fallback to a valid existing base role if missing advanced images
  return new URL(`../../assets/images/LoupGarou/Roles/${getRoleImageFilename(props.myRole)}`, import.meta.url).href;
});

const getRoleImageUrlByName = (role) => {
  if (!role) return '';
  return new URL(`../../assets/images/LoupGarou/Roles/${getRoleImageFilename(role)}`, import.meta.url).href;
};

const mustVoleurSwap = computed(() => {
  if (props.phase === 'voleur' && props.centerCards && props.centerCards.length === 2) {
    const wolves = ['Loup-Garou', 'Loup Garou Blanc', 'Loup Garou Voyant', 'Grand Méchant Loup', 'Infect Père des Loups'];
    return props.centerCards.every(c => wolves.includes(c));
  }
  return false;
});

const handleImageError = (e) => {
  // Fallback si l'image du rôle n'existe pas
  e.target.src = new URL(`../../assets/images/LoupGarou/Roles/Villageois.svg`, import.meta.url).href;
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Space+Mono&display=swap');

.game-active { flex: 1; display: flex; flex-direction: column; font-family: 'Space Mono', monospace; color: #a89a8e; height: 100%; position: relative; z-index: 1;}

.game-header { text-align: center; border-bottom: 1px solid rgba(230, 126, 34, 0.1); padding-bottom: 20px; margin-bottom: 20px;}
.phase-title { font-family: 'Cormorant Garamond', serif; font-size: 2.2rem; color: #dfd3c3; margin: 0; font-weight: normal; letter-spacing: 3px; text-shadow: 0 2px 10px rgba(211, 84, 0, 0.3);}
.turn-badge { display: inline-block; background: rgba(230, 126, 34, 0.05); border: 1px solid rgba(230, 126, 34, 0.2); padding: 4px 14px; margin-top: 8px; font-size: 0.75rem; text-transform: uppercase; color: #c8b7a6; border-radius: 4px; letter-spacing: 1px;}
.timer-section { margin-top: 15px; font-size: 1.4rem; font-weight: normal; color: #dfd3c3; animation: glowPulse 2s infinite alternate; text-shadow: 0 0 10px rgba(231, 76, 60, 0.6); }
.room-info { margin-top: 15px; font-size: 0.75rem; color: #7b7369; text-transform: uppercase; letter-spacing: 1px; }
.room-info .engraved { color: #a89a8e; letter-spacing: 2px;}

@keyframes glowPulse { 0% { opacity: 0.8; text-shadow: 0 0 5px rgba(230, 126, 34, 0.4); } 100% { opacity: 1; text-shadow: 0 0 15px rgba(230, 126, 34, 0.8); } }

.board-content { display: flex; flex: 1; gap: 20px; overflow: hidden;}

.village-square { flex: 2; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; align-content: flex-start; overflow-y: auto; padding: 20px;}
.player-card { 
  background: rgba(18, 17, 16, 0.5); border: 1px solid rgba(230, 126, 34, 0.1); 
  width: 150px; padding: 20px 15px; text-align: center; border-radius: 8px; position: relative;
  display: flex; flex-direction: column; gap: 12px; transition: all 0.3s ease; backdrop-filter: blur(4px);
}
.player-card:hover { border-color: rgba(230, 126, 34, 0.3); background: rgba(230, 126, 34, 0.05); }
.player-card.is-me { border-color: rgba(230, 126, 34, 0.6); box-shadow: inset 0 0 20px rgba(230, 126, 34, 0.05); }
.player-card.is-dead { opacity: 0.4; filter: grayscale(100%); pointer-events: none; border-color: transparent; background: transparent; }
.player-card.cupidon-selected { border-color: #e84393; background: rgba(232, 67, 147, 0.08); box-shadow: 0 0 15px rgba(232, 67, 147, 0.15);}

.player-status { position: absolute; top: 8px; right: 8px; font-size: 1.1rem; filter: saturate(0.8); }
.badges-container { position: absolute; top: -12px; left: -12px; display: flex; gap: 5px; font-size: 1.1rem; background: #121110; border: 1px solid rgba(230, 126, 34, 0.2); border-radius: 6px; padding: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
.player-name { font-weight: normal; margin: 0; color: #d6c9b3; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 1px;}
.player-role-badge { background: transparent; border: 1px solid rgba(230, 126, 34, 0.2); border-radius: 4px; font-size: 0.7rem; padding: 4px 8px; color: #a89a8e; letter-spacing: 0.5px;}
.vote-count { color: #e74c3c; font-weight: normal; font-size: 0.85rem; letter-spacing: 1px; text-shadow: 0 1px 4px rgba(231, 76, 60, 0.4);}

.action-btn { background: rgba(18, 17, 16, 0.8); border: 1px solid rgba(230, 126, 34, 0.4); color: #dfd3c3; padding: 10px; font-family: 'Space Mono', monospace; font-size: 0.75rem; cursor: pointer; text-transform: uppercase; transition: all 0.2s ease; border-radius: 4px; width: 100%; letter-spacing: 1px;}
.action-btn:hover { background: rgba(230, 126, 34, 0.15); border-color: #e67e22; box-shadow: 0 2px 8px rgba(230, 126, 34, 0.2); }
.action-btn:disabled { border-color: rgba(255,255,255,0.1); color: rgba(255,255,255,0.2); cursor: not-allowed; background: transparent; box-shadow: none; }

.poison-btn { border-color: rgba(155, 89, 182, 0.4); color: #c39bd3;}
.poison-btn:hover { background: rgba(155, 89, 182, 0.15); border-color: #9b59b6;}
.heal-btn { border-color: rgba(46, 204, 113, 0.4); color: #82e0aa;}
.heal-btn:hover { background: rgba(46, 204, 113, 0.15); border-color: #2ecc71;}
.skip-btn { border-color: rgba(52, 152, 219, 0.4); color: #85c1e9; width: 100%;}
.skip-btn:hover { background: rgba(52, 152, 219, 0.15); border-color: #3498db; }
.lover-btn { border-color: rgba(232, 67, 147, 0.4); color: #fd79a8; }
.lover-btn:hover { background: rgba(232, 67, 147, 0.15); border-color: #e84393; }
.hunter-btn { border-color: rgba(211, 84, 0, 0.4); color: #e67e22; }
.hunter-btn:hover { background: rgba(211, 84, 0, 0.15); border-color: #d35400; }
.mayor-btn { border-color: rgba(241, 196, 15, 0.4); color: #f4d03f; }
.mayor-btn:hover { background: rgba(241, 196, 15, 0.15); border-color: #f1c40f;}

.game-logs-sidebar { flex: 1; border-left: 1px solid rgba(230, 126, 34, 0.1); padding-left: 30px; display: flex; flex-direction: column; max-width: 320px; position: relative;}
.game-logs-sidebar h3 { font-family: 'Cormorant Garamond', serif; color: #dfd3c3; font-size: 1.4rem; margin-top: 0; font-weight: normal; margin-bottom: 20px; letter-spacing: 1px;}
.log-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; padding-right: 10px;}
.log-list::-webkit-scrollbar { width: 4px; }
.log-list::-webkit-scrollbar-thumb { background: rgba(230, 126, 34, 0.2); border-radius: 2px; }
.log-item { padding: 12px 0; border-bottom: 1px solid rgba(230, 126, 34, 0.05); font-size: 0.8rem; color: #7b7369; line-height: 1.5; transition: color 0.3s;}
.log-item:last-child { color: #d6c9b3; border-bottom: none;}

.my-area { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(230, 126, 34, 0.1); padding: 30px; margin-top: 10px; background: rgba(10, 10, 10, 0.4); backdrop-filter: blur(8px); border-radius: 12px 12px 0 0;}
.my-area.dead-area { border-top-color: rgba(255, 255, 255, 0.05); background: transparent;}
.my-area.dead-area .my-status { opacity: 0.5; filter: grayscale(80%); }
.my-status { display: flex; align-items: center; gap: 25px;}
.role-image-container { position: relative; width: 115px; aspect-ratio: 1 / 1; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.5);}
.role-image-container img { width: 100%; height: 100%; object-fit: cover; border: 1px solid rgba(230, 126, 34, 0.2); border-radius: 8px;}
.death-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); color: #c0392b; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-family: sans-serif; font-weight: bold;}
.my-info { display: flex; flex-direction: column; gap: 8px;}
.my-name { font-size: 1.3rem; color: #dfd3c3; font-weight: normal; text-transform: uppercase; letter-spacing: 2px; display: flex; align-items: center; gap: 10px;}
.my-role { font-size: 0.9rem; color: #a89a8e; font-style: italic;}
.my-state { color: #e74c3c; font-weight: normal; margin-top: 10px; font-size: 0.8rem; letter-spacing: 1px;}

.controls-panel { min-width: 220px; display: flex; flex-direction: column; gap: 10px; align-items:center; }
.special-action-panel { flex: 1; text-align: center; padding: 0 30px;}
.special-action-panel h4 { margin: 0 0 15px 0; color: #dfd3c3; font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; letter-spacing: 1px;}
.special-action-panel p { font-size: 0.85rem; line-height: 1.5; color: #a89a8e;}
.heal-section { margin-bottom: 20px;}
.dead-panel { color: #7b7369; font-style: italic; letter-spacing: 1px; }

@media (max-width: 900px) {
  .board-content { flex-direction: column;}
  .village-square { padding: 10px; gap: 15px; }
  .game-logs-sidebar { border-left: none; border-top: 1px solid rgba(230, 126, 34, 0.1); padding-left: 0; padding-top: 20px; max-width: 100%; min-height: 200px; padding-right: 0;}
  .my-area { flex-direction: column; text-align: center; gap: 30px; padding: 20px 15px;}
}

.center-cards-container { display: flex; justify-content: center; gap: 20px; margin-top: 15px; margin-bottom: 15px; }
.center-card { display: flex; flex-direction: column; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid rgba(230, 126, 34, 0.2); }
.center-card .role-image-wrapper { width: 80px; height: 80px; }
.center-card .role-image-wrapper img { width: 100%; height: 100%; object-fit: contain; }
.card-role-name { font-size: 0.8rem; margin: 0; color: #dfd3c3; }
.warning-text { color: #e74c3c !important; font-size: 0.8rem !important; font-weight: bold; }
.mt-2 { margin-top: 10px; }
</style>