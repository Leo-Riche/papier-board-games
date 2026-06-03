<template>
  <div class="wait-wrapper">
    <header class="wait-header">
      <h1 class="wait-title">THE GANG</h1>
      <p class="wait-sub">Salle d'attente</p>
    </header>

    <div class="wait-main">
      <!-- Room code -->
      <div class="room-code-panel">
        <p class="code-label">CODE DU SALON</p>
        <div class="code-display">{{ roomCode }}</div>
        <button class="copy-btn" @click="copyCode">{{ copied ? '✓ Copié !' : '📋 Copier' }}</button>
      </div>

      <!-- Players list -->
      <div class="players-panel">
        <p class="panel-label">JOUEURS ({{ players.length }}/6)</p>
        <div class="players-list">
          <div v-for="(player, i) in players" :key="player.id"
               class="player-row" :class="{ 'is-me': player.id === socketId }">
            <span class="player-rank">{{ i + 1 }}</span>
            <span class="player-name">{{ player.name }}</span>
            <span v-if="i === 0" class="host-badge">Chef</span>
            <span v-if="player.id === socketId" class="me-badge">Vous</span>
          </div>
        </div>

        <!-- Player count warning -->
        <div class="count-warning" v-if="players.length < 3">
          <span>⚠️ Minimum 3 joueurs requis ({{ 3 - players.length }} manquant{{ 3 - players.length > 1 ? 's' : '' }})</span>
        </div>
        <div class="count-ok" v-else-if="players.length <= 6">
          <span>✓ Prêt à jouer !</span>
        </div>
        <div class="count-warning" v-else>
          <span>⚠️ Maximum 6 joueurs atteint</span>
        </div>
      </div>

      <!-- Rules reminder -->
      <div class="rules-reminder">
        <h3>🃏 Rappel des règles</h3>
        <ul>
          <li>Chaque joueur reçoit <strong>2 cartes secrètes</strong></li>
          <li><strong>5 cartes communes</strong> sont révélées en 3 phases</li>
          <li>Prenez un <strong>jeton numéroté</strong> pour indiquer la force de votre main</li>
          <li>⚠️ <strong>Aucune communication verbale</strong> sur vos cartes !</li>
          <li>Au River, validez tous votre classement → <strong>Showdown !</strong></li>
          <li>Gagnez <strong>3 braquages</strong> avant 3 alarmes</li>
        </ul>
      </div>

      <!-- Start button (host only) -->
      <div class="start-area">
        <div v-if="amIHost">
          <BaseButton
            variant="primary"
            :disabled="players.length < 3 || players.length > 6"
            @click="$emit('start')"
          >
            🔫 Lancer le braquage ({{ players.length }} joueurs)
          </BaseButton>
          <p v-if="players.length < 3" class="start-hint">En attente de joueurs supplémentaires...</p>
        </div>
        <div v-else class="waiting-msg">
          <div class="spinner"></div>
          En attente du chef de salle...
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps({
  roomCode: String,
  players: Array,
  socketId: String,
  amIHost: Boolean
})

defineEmits(['start'])

const copied = ref(false)
const copyCode = () => {
  const joinLink = `${window.location.origin}/thegang/join/${props.roomCode}`
  navigator.clipboard.writeText(joinLink)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.wait-wrapper { min-height:100vh; display:flex; flex-direction:column; align-items:center; background:#0f1a0f; color:#ecf0f1; font-family:'Outfit',sans-serif; padding:0 20px 40px }

.wait-header { text-align:center; padding:40px 20px 20px; border-bottom:1px solid rgba(212,175,55,0.15); width:100%; max-width:780px }
.wait-title { font-size:2.8rem; font-weight:900; margin:0; background:linear-gradient(135deg,#d4af37,#f5d670); -webkit-background-clip:text; -webkit-text-fill-color:transparent }
.wait-sub { color:#bdc3c7; margin-top:6px; text-transform:uppercase; letter-spacing:1px }

.wait-main { display:flex; flex-direction:column; align-items:center; gap:24px; width:100%; max-width:720px; margin-top:28px }

.room-code-panel { width:100%; padding:20px; background:#1a2e1a; border-radius:12px; border:1px solid rgba(212,175,55,0.08); text-align:center }
.code-label { font-size:0.75rem; color:#7a9a7a; text-transform:uppercase; letter-spacing:1.5px; margin:0 0 8px }
.code-display { font-size:2.2rem; color:#d4af37; letter-spacing:8px; font-weight:800; font-family:inherit }
.copy-btn { margin-top:10px; background:transparent; border:1px solid rgba(212,175,55,0.12); color:#d4af37; padding:8px 14px; border-radius:8px; cursor:pointer }
.copy-btn:hover { background: rgba(212,175,55,0.06) }

.players-panel { width:100%; padding:18px; background:rgba(255,255,255,0.02); border-radius:10px; border:1px solid rgba(255,255,255,0.04) }
.panel-label { font-size:0.75rem; color:#7a9a7a; text-transform:uppercase; margin:0 0 12px }
.players-list { display:flex; flex-direction:column; gap:8px }
.player-row { display:flex; align-items:center; gap:12px; padding:8px 12px; border-radius:6px; background:transparent; border:1px solid transparent }
.player-row.is-me { border-color: rgba(212,175,55,0.2); background: rgba(212,175,55,0.04) }
.player-rank { color:#7a9a7a; width:18px }
.player-name { flex:1 }
.host-badge, .me-badge { font-size:0.65rem; padding:2px 8px; border-radius:12px }
.host-badge { background: rgba(212,175,55,0.12); color:#d4af37 }
.me-badge { background: rgba(255,255,255,0.04); color:#bdc3c7 }

.count-warning { margin-top:12px; padding:8px 12px; background: rgba(180,60,30,0.12); border-radius:8px; color:#c0784a }
.count-ok { margin-top:12px; padding:8px 12px; background: rgba(40,160,80,0.08); border-radius:8px; color:#56c97e }

.rules-reminder { width:100%; padding:14px; border-radius:10px; border:1px dashed rgba(212,175,55,0.08); }
.rules-reminder h3 { color:#d4af37; margin:0 0 10px }
.rules-reminder ul { margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px }
.rules-reminder li { color:#9a8f7e }

.start-area { text-align:center; width:100% }
.start-hint { font-size:0.85rem; color:#bdc3c7; margin-top:8px }
.waiting-msg { display:flex; align-items:center; justify-content:center; gap:12px; color:#7a9a7a }
.spinner { width:16px; height:16px; border:2px solid rgba(212,175,55,0.2); border-top-color:#d4af37; border-radius:50%; animation:spin 1s linear infinite }
@keyframes spin { to { transform: rotate(360deg) } }
</style>
