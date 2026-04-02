<template>
  <div class="lobby-waiting">
    <h2>Salle : {{ roomCode }}</h2>
    <button class="share-btn" @click="copyJoinLink">
      {{ copyButtonText }}
    </button>
    
    <div class="players-list-container">
      <h3>Joueurs connectés ({{ players.length }}) :</h3>
      <ul class="players-list">
        <li v-for="p in players" :key="p.id" :class="{ 'is-me': p.id === socketId }">
          👤 {{ p.name }} {{ p.id === socketId ? '(Moi)' : '' }}
          <span v-if="p.isHost" class="host-badge">Chef</span>
        </li>
      </ul>
    </div>

    <!-- SÉLECTEUR DE COMPOSITION DES RÔLES -->
    <div class="role-composition-section">
      <div class="section-header">
        <h3>🎭 Composition des Rôles</h3>
        <div class="role-counter" :class="{ 'valid': totalRoles === players.length, 'invalid': totalRoles !== players.length }">
          {{ totalRoles }} / {{ players.length }} rôles
        </div>
      </div>

      <div v-for="cat in roleCategories" :key="cat.name" class="role-category">
        <div class="category-header">
          <span class="category-icon">{{ cat.icon }}</span>
          <span class="category-name">{{ cat.name }}</span>
        </div>
        <div class="roles-grid">
          <div 
            v-for="role in cat.roles" 
            :key="role.id"
            class="role-card"
            :class="{ 'selected': getRoleCount(role.id) > 0, 'disabled': !amIHost }"
            @click="amIHost && incrementRole(role.id)"
            @contextmenu.prevent="amIHost && decrementRole(role.id)"
          >
            <div class="role-image-wrapper">
              <img :src="getRoleImageUrl(role.file)" :alt="role.name" />
              <div class="role-count-badge" v-if="getRoleCount(role.id) > 0">
                {{ getRoleCount(role.id) }}
              </div>
            </div>
            <span class="role-label">{{ role.name }}</span>
          </div>
        </div>
      </div>

      <p v-if="amIHost" class="hint-text">
        Clic gauche pour ajouter • Clic droit pour retirer
      </p>

      <!-- Résumé de la composition sélectionnée -->
      <div v-if="totalRoles > 0" class="composition-summary">
        <h4>Résumé</h4>
        <div class="summary-tags">
          <span v-for="(count, roleId) in selectedRolesMap" :key="roleId" class="summary-tag">
            {{ getRoleDisplayName(roleId) }} × {{ count }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="amIHost" class="launch-section">
      <p v-if="players.length < 2" class="info-msg">
        Attends au moins un autre joueur...
      </p>
      <p v-if="totalRoles !== players.length && totalRoles > 0" class="info-msg warning-msg">
        ⚠️ Le nombre de rôles ({{ totalRoles }}) ne correspond pas au nombre de joueurs ({{ players.length }})
      </p>
      <BaseButton 
        variant="primary" 
        :disabled="players.length < 2 || totalRoles !== players.length" 
        @click="launchGame"
      >
        LANCER LA PARTIE 🚀
      </BaseButton>
    </div>

    <div v-else class="info-msg">
      <p>En attente du chef de salle pour lancer la partie...</p>
    </div>
  </div>
</template>

<script setup>
import BaseButton from '@/components/BaseButton.vue'
import { ref, computed, watch } from 'vue';

const copyButtonText = ref('🔗 Copier le lien d\'invitation')

const copyJoinLink = async () => {
  const joinUrl = `${window.location.origin}/loupgarou/join/${props.roomCode}`
  
  try {
    await navigator.clipboard.writeText(joinUrl)
    copyButtonText.value = '✅ Lien copié !'
    
    setTimeout(() => {
      copyButtonText.value = '🔗 Copier le lien d\'invitation'
    }, 2000)
  } catch (err) {
    console.error('Erreur lors de la copie :', err)
    copyButtonText.value = '❌ Erreur de copie'
  }
}

const props = defineProps({
  roomCode: String,
  players: Array,
  socketId: String,
  amIHost: Boolean,
  roleComposition: { type: Array, default: () => [] }
});

const emit = defineEmits(['start', 'update-composition']);

// ========== DONNÉES DES RÔLES ==========

const roleCategories = [
  {
    name: 'Loups-Garous',
    icon: '🐺',
    roles: [
      { id: 'LoupGarou', name: 'Loup-Garou', file: 'LoupGarou.svg' },
      { id: 'GrandMechantLoup', name: 'Grand Méchant Loup', file: 'GrandMechantLoup.svg' },
      { id: 'LoupGarouBlanc', name: 'Loup-Garou Blanc', file: 'LoupGarouBlanc.svg' },
      { id: 'LoupGarouVoyant', name: 'Loup-Garou Voyant', file: 'LoupGarouVoyant.svg' },
      { id: 'InfectPereDesLoups', name: 'Infect Père des Loups', file: 'InfectPereDesLoups.svg' },
      { id: 'ChienLoup', name: 'Chien-Loup', file: 'ChienLoup.svg' },
    ]
  },
  {
    name: 'Village',
    icon: '🏘️',
    roles: [
      { id: 'Villageois', name: 'Villageois', file: 'Villageois.svg' },
      { id: 'Voyante', name: 'Voyante', file: 'Voyante.svg' },
      { id: 'Sorciere', name: 'Sorcière', file: 'Sociere.svg' },
      { id: 'Chasseur', name: 'Chasseur', file: 'Chasseur.svg' },
      { id: 'Cupidon', name: 'Cupidon', file: 'Cupidon.svg' },
      { id: 'Ancien', name: 'Ancien', file: 'Ancien.svg' },
      { id: 'Salvateur', name: 'Salvateur', file: 'Salvateur.svg' },
      { id: 'IdiotDuVillage', name: 'Idiot du Village', file: 'IdiotDuVillage.svg' },
      { id: 'PetiteFille', name: 'Petite Fille', file: 'PetiteFille.svg' },
      { id: 'MontreurDOurs', name: "Montreur d'Ours", file: 'MontreurDOurs.svg' },
      { id: 'ServanteDevouee', name: 'Servante Dévouée', file: 'ServanteDevouee.svg' },
      { id: 'Renard', name: 'Renard', file: 'Renard.svg' },
      { id: 'BoucEmissaire', name: 'Bouc Émissaire', file: 'BoucEmissaire.svg' },
      { id: 'GardeChampetre', name: 'Garde Champêtre', file: 'GardeChampetre.svg' },
      { id: 'JugeBegue', name: 'Juge Bègue', file: 'JugeBegue.svg' },
      { id: 'Corbeau', name: 'Corbeau', file: 'Corbeau.svg' },
      { id: 'LapinBlanc', name: 'Lapin Blanc', file: 'LapinBlanc.svg' },
      { id: 'Noctambule', name: 'Noctambule', file: 'Noctambule.svg' },
      { id: 'Maire', name: 'Maire', file: 'Maire.svg' },
    ]
  },
  {
    name: 'Solitaires',
    icon: '🃏',
    roles: [
      { id: 'Ange', name: 'Ange', file: 'Ange.svg' },
      { id: 'JoueurDeFlute', name: 'Joueur de Flûte', file: 'JoueurDeFlute.svg' },
      { id: 'Pyromane', name: 'Pyromane', file: 'Pyromane.svg' },
      { id: 'Marionnettiste', name: 'Marionnettiste', file: 'Marionnettiste.svg' },
      { id: 'Necromancien', name: 'Nécromancien', file: 'Nécromancien.svg' },
      { id: 'AbominableSectaire', name: 'Abominable Sectaire', file: 'AbominableSectaire.svg' },
      { id: 'Ankou', name: 'Ankou', file: 'Ankou.svg' },
    ]
  },
  {
    name: 'Spéciaux',
    icon: '✨',
    roles: [
      { id: 'EnfantSauvage', name: 'Enfant Sauvage', file: 'EnfantSauvage.svg' },
      { id: 'Comedien', name: 'Comédien', file: 'Comedien.svg' },
      { id: 'Gitane', name: 'Gitane', file: 'Gitane.svg' },
      { id: 'Voleur', name: 'Voleur', file: 'Voleur.svg' },
      { id: 'Soeurs', name: 'Sœurs', file: 'Soeurs.svg' },
      { id: 'Triples', name: 'Triplés', file: 'Triples.svg' },
    ]
  }
];

// Mapping d'images — import dynamique Vite
const roleImages = import.meta.glob('@/assets/images/LoupGarou/Roles/*.svg', { eager: true, query: '?url', import: 'default' });

const getRoleImageUrl = (filename) => {
  const key = `/src/assets/images/LoupGarou/Roles/${filename}`;
  return roleImages[key] || '';
};

// ========== GESTION DE LA COMPOSITION ==========

// Map local des rôles sélectionnés : { roleId: count }
const localComposition = ref({});

// Synchroniser avec la prop roleComposition (pour les non-host)
watch(() => props.roleComposition, (newVal) => {
  if (!props.amIHost && newVal && newVal.length > 0) {
    // Reconstruire le map depuis le tableau
    const map = {};
    newVal.forEach(roleId => {
      map[roleId] = (map[roleId] || 0) + 1;
    });
    localComposition.value = map;
  }
}, { immediate: true, deep: true });

const selectedRolesMap = computed(() => {
  const filtered = {};
  for (const [key, val] of Object.entries(localComposition.value)) {
    if (val > 0) filtered[key] = val;
  }
  return filtered;
});

const totalRoles = computed(() => {
  return Object.values(localComposition.value).reduce((sum, c) => sum + c, 0);
});

const getRoleCount = (roleId) => {
  return localComposition.value[roleId] || 0;
};

const getRoleDisplayName = (roleId) => {
  for (const cat of roleCategories) {
    const found = cat.roles.find(r => r.id === roleId);
    if (found) return found.name;
  }
  return roleId;
};

const compositionToArray = () => {
  const arr = [];
  for (const [roleId, count] of Object.entries(localComposition.value)) {
    for (let i = 0; i < count; i++) {
      arr.push(roleId);
    }
  }
  return arr;
};

const incrementRole = (roleId) => {
  if (!localComposition.value[roleId]) {
    localComposition.value[roleId] = 0;
  }
  localComposition.value[roleId]++;
  emitComposition();
};

const decrementRole = (roleId) => {
  if (localComposition.value[roleId] && localComposition.value[roleId] > 0) {
    localComposition.value[roleId]--;
    if (localComposition.value[roleId] === 0) {
      delete localComposition.value[roleId];
    }
    emitComposition();
  }
};

const emitComposition = () => {
  emit('update-composition', compositionToArray());
};

const launchGame = () => {
  emit('start', compositionToArray());
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Space+Mono&display=swap');

.lobby-waiting {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  gap: 30px; text-align: center; font-family: 'Space Mono', monospace;
  padding: 20px; max-height: 100vh; overflow-y: auto; width: 100%;
}

h2 {
  font-family: 'Cormorant Garamond', serif; font-size: 2rem;
  color: #cda434; font-weight: normal; letter-spacing: 2px; margin: 0;
}

.players-list-container {
  background: #1c1a19; border: 1px solid rgba(205, 164, 52, 0.3);
  padding: 20px 30px; min-width: 350px; max-width: 100%; box-sizing: border-box;
}

.players-list-container h3 {
  color: #8a8277; font-size: 0.8rem; text-transform: uppercase;
  letter-spacing: 1px; margin-bottom: 15px; font-weight: normal;
}

.players-list { list-style: none; padding: 0; margin: 0; }
.players-list li {
  padding: 8px 0; border-bottom: 1px dashed rgba(223, 211, 195, 0.1);
  font-size: 0.95rem; color: #dfd3c3; text-align: left;
  display: flex; align-items: center; justify-content: space-between;
}
.players-list li:last-child { border-bottom: none; }

.is-me { color: #cda434 !important; font-weight: bold; }

.host-badge {
  background: rgba(205, 164, 52, 0.15); border: 1px solid rgba(205, 164, 52, 0.4);
  color: #cda434; font-size: 0.65rem; padding: 2px 8px; text-transform: uppercase;
  letter-spacing: 1px;
}

.info-msg {
  font-size: 0.85rem; color: #a96c3c;
  border: 1px solid rgba(169, 108, 60, 0.3); padding: 10px 20px;
  background: rgba(169, 108, 60, 0.05);
}
.warning-msg { color: #e67e22; border-color: rgba(230, 126, 34, 0.3); background: rgba(230, 126, 34, 0.05); }

.share-btn {
  background: transparent; color: #dfd3c3; border: 1px solid #5a554f;
  padding: 8px 15px; cursor: pointer; font-family: 'Space Mono', monospace;
  font-size: 0.8rem; transition: all 0.2s; text-transform: uppercase;
}
.share-btn:hover { border-color: #cda434; color: #cda434; }

/* ========== ROLE COMPOSITION SECTION ========== */

.role-composition-section {
  width: 100%; max-width: 900px;
  background: #1c1a19; border: 1px solid rgba(205, 164, 52, 0.2);
  padding: 25px; box-sizing: border-box;
}

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 25px; border-bottom: 1px solid rgba(205, 164, 52, 0.15);
  padding-bottom: 15px;
}

.section-header h3 {
  font-family: 'Cormorant Garamond', serif; font-size: 1.5rem;
  color: #cda434; font-weight: normal; margin: 0; letter-spacing: 1px;
}

.role-counter {
  font-size: 0.85rem; padding: 6px 14px;
  border: 1px solid #5a554f; color: #8a8277;
  transition: all 0.3s ease;
}
.role-counter.valid {
  border-color: #2ecc71; color: #2ecc71;
  background: rgba(46, 204, 113, 0.08);
  box-shadow: 0 0 12px rgba(46, 204, 113, 0.15);
}
.role-counter.invalid {
  border-color: #e74c3c; color: #e74c3c;
  background: rgba(231, 76, 60, 0.08);
}

.role-category {
  margin-bottom: 20px;
}

.category-header {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 12px; padding-bottom: 6px;
  border-bottom: 1px dashed rgba(223, 211, 195, 0.1);
}

.category-icon { font-size: 1.2rem; }

.category-name {
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 2px;
  color: #8a8277;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 10px;
}

.role-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px 6px; border: 1px solid rgba(223, 211, 195, 0.1);
  background: rgba(22, 21, 20, 0.6); cursor: pointer;
  transition: all 0.25s ease; position: relative;
  user-select: none;
}

.role-card:not(.disabled):hover {
  border-color: rgba(205, 164, 52, 0.5);
  background: rgba(205, 164, 52, 0.05);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.role-card.selected {
  border-color: #cda434;
  background: rgba(205, 164, 52, 0.1);
  box-shadow: 0 0 20px rgba(205, 164, 52, 0.15), inset 0 0 15px rgba(205, 164, 52, 0.05);
}

.role-card.disabled {
  cursor: default;
  opacity: 0.85;
}

.role-image-wrapper {
  position: relative; width: 60px; height: 60px;
}

.role-image-wrapper img {
  width: 100%; height: 100%; object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  transition: filter 0.25s ease;
}

.role-card.selected .role-image-wrapper img {
  filter: drop-shadow(0 0 8px rgba(205, 164, 52, 0.4));
}

.role-count-badge {
  position: absolute; top: -6px; right: -6px;
  background: #cda434; color: #161514;
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: bold;
  box-shadow: 0 2px 8px rgba(205, 164, 52, 0.5);
  animation: badgePop 0.2s ease-out;
}

@keyframes badgePop {
  0% { transform: scale(0.5); }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.role-label {
  font-size: 0.65rem; color: #8a8277; text-align: center;
  line-height: 1.2; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

.role-card.selected .role-label {
  color: #dfd3c3;
}

.hint-text {
  font-size: 0.7rem; color: #5a554f; margin-top: 10px;
  font-style: italic; text-align: center;
}

/* ========== COMPOSITION SUMMARY ========== */

.composition-summary {
  margin-top: 20px; padding-top: 15px;
  border-top: 1px dashed rgba(205, 164, 52, 0.2);
}

.composition-summary h4 {
  font-family: 'Cormorant Garamond', serif; font-size: 1.1rem;
  color: #cda434; font-weight: normal; margin: 0 0 12px 0;
}

.summary-tags {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
}

.summary-tag {
  background: rgba(205, 164, 52, 0.1); border: 1px solid rgba(205, 164, 52, 0.3);
  color: #dfd3c3; font-size: 0.7rem; padding: 4px 10px;
  letter-spacing: 0.5px;
}

/* ========== LAUNCH SECTION ========== */

.launch-section {
  display: flex; flex-direction: column; align-items: center; gap: 15px;
}

@media (max-width: 768px) {
  .role-composition-section { padding: 15px; }
  .roles-grid { grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 8px; }
  .role-image-wrapper { width: 48px; height: 48px; }
  .role-label { font-size: 0.6rem; }
  .section-header { flex-direction: column; gap: 10px; }
}

@media (max-width: 480px) {
  .players-list-container { min-width: 100%; padding: 15px; }
  h2 { font-size: 1.5rem; }
  .roles-grid { grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); }
}
</style>