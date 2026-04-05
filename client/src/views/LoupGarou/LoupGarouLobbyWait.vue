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
        <div class="role-counter" :class="{ 'valid': totalRoles === targetRolesCount, 'invalid': totalRoles !== targetRolesCount }">
          {{ totalRoles }} / {{ targetRolesCount }} rôles
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
      <p v-if="totalRoles !== targetRolesCount && totalRoles > 0" class="info-msg warning-msg">
        ⚠️ Le nombre de rôles sélectionné ({{ totalRoles }}) ne correspond pas à ce qui est attendu ({{ targetRolesCount }}).
        <span v-if="targetRolesCount !== players.length"><br><em>Note : Le Voleur requiert 2 cartes supplémentaires.</em></span>
      </p>
      <BaseButton 
        variant="primary" 
        :disabled="players.length < 2 || totalRoles !== targetRolesCount" 
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
      { id: 'Loup-Garou', name: 'Loup-Garou', file: 'LoupGarou.svg' },
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
      { id: 'Petite Fille', name: 'Petite Fille', file: 'PetiteFille.svg' },
    ]
  },
  {
    name: 'Spéciaux',
    icon: '✨',
    roles: [
      { id: 'Voleur', name: 'Voleur', file: 'Voleur.svg' },
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

const targetRolesCount = computed(() => {
  return props.players.length + (getRoleCount('Voleur') > 0 ? 2 : 0);
});

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
  padding: 40px 20px; max-height: 100vh; overflow-y: auto; width: 100%;
  position: relative; z-index: 1;
}

h2 {
  font-family: 'Cormorant Garamond', serif; font-size: 2.2rem;
  color: #dfd3c3; font-weight: normal; letter-spacing: 3px; margin: 0;
  text-shadow: 0 2px 10px rgba(211, 84, 0, 0.3);
}

.players-list-container {
  background: rgba(18, 17, 16, 0.6); border: 1px solid rgba(230, 126, 34, 0.15);
  padding: 20px 30px; min-width: 350px; max-width: 100%; box-sizing: border-box;
  border-radius: 8px; backdrop-filter: blur(4px);
}

.players-list-container h3 {
  color: #7b7369; font-size: 0.8rem; text-transform: uppercase;
  letter-spacing: 2px; margin-bottom: 20px; font-weight: normal;
}

.players-list { list-style: none; padding: 0; margin: 0; }
.players-list li {
  padding: 10px 0; border-bottom: 1px solid rgba(230, 126, 34, 0.05);
  font-size: 0.95rem; color: #a89a8e; text-align: left;
  display: flex; align-items: center; justify-content: space-between;
}
.players-list li:last-child { border-bottom: none; }

.is-me { color: #e67e22 !important; font-weight: bold; }

.host-badge {
  background: rgba(230, 126, 34, 0.1); border: 1px solid rgba(230, 126, 34, 0.3);
  color: #e67e22; font-size: 0.65rem; padding: 2px 8px; text-transform: uppercase;
  letter-spacing: 1px; border-radius: 2px;
}

.info-msg {
  font-size: 0.85rem; color: #a96c3c;
  border: 1px solid rgba(169, 108, 60, 0.3); padding: 10px 20px;
  background: rgba(169, 108, 60, 0.05);
}
.warning-msg { color: #e67e22; border-color: rgba(230, 126, 34, 0.3); background: rgba(230, 126, 34, 0.05); }

.share-btn {
  background: transparent; color: #a89a8e; border: 1px solid rgba(230, 126, 34, 0.3);
  padding: 8px 20px; cursor: pointer; font-family: 'Space Mono', monospace;
  font-size: 0.8rem; transition: all 0.2s; text-transform: uppercase; border-radius: 4px;
}
.share-btn:hover { border-color: #e67e22; color: #e67e22; background: rgba(230, 126, 34, 0.05); }

/* ========== ROLE COMPOSITION SECTION ========== */

.role-composition-section {
  width: 100%; max-width: 900px;
  background: rgba(18, 17, 16, 0.6); border: 1px solid rgba(230, 126, 34, 0.15);
  padding: 30px; box-sizing: border-box; border-radius: 8px; backdrop-filter: blur(4px);
}

.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 30px; border-bottom: 1px solid rgba(230, 126, 34, 0.1);
  padding-bottom: 15px;
}

.section-header h3 {
  font-family: 'Cormorant Garamond', serif; font-size: 1.6rem;
  color: #dfd3c3; font-weight: normal; margin: 0; letter-spacing: 1px;
}

.role-counter {
  font-size: 0.85rem; padding: 6px 14px;
  border: 1px solid rgba(230, 126, 34, 0.3); color: #a89a8e;
  transition: all 0.3s ease; border-radius: 4px;
}
.role-counter.valid {
  border-color: #e67e22; color: #e67e22;
  background: rgba(230, 126, 34, 0.08);
}
.role-counter.invalid {
  border-color: #c0392b; color: #c0392b;
  background: rgba(192, 57, 43, 0.08);
}

.role-category {
  margin-bottom: 30px;
}

.category-header {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 15px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(230, 126, 34, 0.05);
}

.category-icon { font-size: 1.2rem; opacity: 0.8; }

.category-name {
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 3px;
  color: #7b7369;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 12px;
}

.role-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 12px 6px; border: 1px solid rgba(230, 126, 34, 0.05);
  background: transparent; cursor: pointer; border-radius: 6px;
  transition: all 0.2s ease; position: relative;
  user-select: none;
}

.role-card:not(.disabled):hover {
  border-color: rgba(230, 126, 34, 0.3);
  background: rgba(230, 126, 34, 0.02);
  transform: translateY(-2px);
}

.role-card.selected {
  border-color: rgba(230, 126, 34, 0.6);
  background: rgba(230, 126, 34, 0.05);
  box-shadow: 0 4px 15px rgba(211, 84, 0, 0.1);
}

.role-card.disabled {
  cursor: default;
  opacity: 0.6;
}

.role-image-wrapper {
  position: relative; width: 55px; height: 55px;
}

.role-image-wrapper img {
  width: 100%; height: 100%; object-fit: contain;
  transition: filter 0.2s ease;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.4));
}

.role-card.selected .role-image-wrapper img {
  filter: drop-shadow(0 2px 10px rgba(230, 126, 34, 0.3));
}

.role-count-badge {
  position: absolute; top: -8px; right: -8px;
  background: #e67e22; color: #121110;
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  animation: badgePop 0.2s ease-out;
}

@keyframes badgePop {
  0% { transform: scale(0.5); }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.role-label {
  font-size: 0.65rem; color: #7b7369; text-align: center;
  line-height: 1.2; max-width: 100%; letter-spacing: 0.5px;
}

.role-card.selected .role-label {
  color: #d6c9b3;
}

.hint-text {
  font-size: 0.7rem; color: #7b7369; margin-top: 15px;
  font-style: italic; text-align: center; opacity: 0.8;
}

/* ========== COMPOSITION SUMMARY ========== */

.composition-summary {
  margin-top: 25px; padding-top: 20px;
  border-top: 1px solid rgba(230, 126, 34, 0.1);
}

.composition-summary h4 {
  font-family: 'Cormorant Garamond', serif; font-size: 1.2rem;
  color: #dfd3c3; font-weight: normal; margin: 0 0 15px 0; letter-spacing: 1px;
}

.summary-tags {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
}

.summary-tag {
  background: rgba(230, 126, 34, 0.05); border: 1px solid rgba(230, 126, 34, 0.2);
  color: #a89a8e; font-size: 0.7rem; padding: 4px 12px; border-radius: 4px;
  letter-spacing: 0.5px; transition: color 0.2s;
}
.summary-tag:hover {
  color: #d6c9b3;
  border-color: rgba(230, 126, 34, 0.4);
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