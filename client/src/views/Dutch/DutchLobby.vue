<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <h1 class="game-title">Dutch 🃏</h1>
      <p class="subtitle">Mémoire, bluff et réflexes · 52 cartes · de 2 à 8 joueurs</p>
    </header>

    <main class="lobby-main">
      <div class="desk">
        <div class="setup-form">
          <h2>Créer une table</h2>
          <div class="input-group">
            <input type="text" v-model="playerName" placeholder="Votre pseudo" @keyup.enter="createRoom" />
          </div>
          <button class="action-btn primary" @click="createRoom">Créer la partie</button>
        </div>

        <div class="divider"></div>

        <div class="setup-form">
          <h2>Rejoindre une table</h2>
          <div class="input-group">
            <input type="text" v-model="playerName" placeholder="Votre pseudo" />
          </div>
          <div class="input-group">
            <input type="text" v-model="roomCode" placeholder="Code (ex: A4X9P)" @keyup.enter="joinRoom" />
          </div>
          <button class="action-btn secondary" @click="joinRoom">Rejoindre</button>
        </div>
      </div>

      <div class="rules-box">
        <h3>📜 En bref</h3>
        <p><strong>4 cartes face cachée</strong> chacun : tu en regardes 2 au début, puis il faut s'en souvenir. Objectif : avoir le <strong>moins de points</strong>.</p>
        <p>As = 1 · 2 à 10 = valeur · Valet = 11 · Dame = 12 · <strong>Roi rouge = 0</strong> · Roi noir = 13.</p>
        <p><strong>À ton tour</strong> : pioche, puis échange la carte avec une des tiennes <strong>ou</strong> défausse-la. Si la carte qui part à la défausse est un <strong>Valet</strong> : échange 2 cartes au choix. Une <strong>Dame</strong> : regarde une carte au choix.</p>
        <p><strong>Snap</strong> : à tout moment, pose une carte de même valeur que le dessus de la défausse. Erreur = carte de pénalité.</p>
        <p><strong>Dutch</strong> : annonce-le juste après avoir pioché ; les autres jouent un dernier tour. Égalité : le moins de cartes gagne, puis l'annonceur perd. Une partie = une manche.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const playerName = ref(localStorage.getItem('temp_player_name') || '')
const roomCode = ref('')

const generateRoomCode = (length = 5) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

const createRoom = () => {
  if (!playerName.value.trim()) return alert('Choisis un pseudo !')
  localStorage.setItem('temp_player_name', playerName.value.trim())
  router.push(`/dutch/game/${generateRoomCode()}`)
}

const joinRoom = () => {
  if (!playerName.value.trim() || !roomCode.value.trim()) return alert('Pseudo et code requis !')
  localStorage.setItem('temp_player_name', playerName.value.trim())
  router.push(`/dutch/game/${roomCode.value.trim().toUpperCase()}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.lobby-wrapper { min-height: 100vh; display: flex; flex-direction: column; background: #0b1424; color: #e8eef7; font-family: 'Outfit', sans-serif; box-sizing: border-box; }
.lobby-header { padding: 40px 20px; text-align: center; background: linear-gradient(180deg, #13223a 0%, #0b1424 100%); border-bottom: 1px solid rgba(255,154,60,0.22); margin-bottom: 40px; }
.game-title { font-size: 3.5rem; font-weight: 900; margin: 0; color: #ff9a3c; filter: drop-shadow(0 2px 8px rgba(255,154,60,0.35)); }
.subtitle { color: #5f7899; font-size: 1.05rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; }

.lobby-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 30px; }
.desk { display: flex; align-items: stretch; background: #13223a; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); border: 1px solid rgba(255,154,60,0.2); box-sizing: border-box; }
.divider { width: 1px; background: rgba(255,154,60,0.15); margin: 0 40px; }

.setup-form { display: flex; flex-direction: column; align-items: center; gap: 24px; min-width: 260px; }
.setup-form h2 { color: #ff9a3c; font-size: 1.6rem; font-weight: 700; text-align: center; margin: 0; }

.input-group { width: 100%; }
.input-group input {
  width: 100%; padding: 14px; background: #0b1424; border: 2px solid transparent; border-radius: 10px;
  color: #e8eef7; font-family: 'Outfit', sans-serif; font-size: 1.05rem; text-align: center;
  outline: none; transition: 0.3s; box-sizing: border-box;
}
.input-group input::placeholder { color: #3a5072; }
.input-group input:focus { border-color: #ff9a3c; background: #13223a; }

.action-btn {
  width: 100%; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; padding: 14px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; box-sizing: border-box;
}
.action-btn.primary { background: linear-gradient(135deg, #f07c22, #c95a12); color: #fff7ee; }
.action-btn.primary:hover { background: linear-gradient(135deg, #ff8f3a, #db6618); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(240,124,34,0.4); }
.action-btn.secondary { background: #0b1424; color: #a9bfdc; border: 2px solid #2a3f5f; }
.action-btn.secondary:hover { background: #13223a; color: #e8eef7; border-color: #ff9a3c; transform: translateY(-2px); }

.rules-box { background: #13223a; border: 1px solid rgba(255,154,60,0.15); border-radius: 14px; padding: 24px 30px; max-width: 640px; width: 100%; box-sizing: border-box; }
.rules-box h3 { color: #ff9a3c; margin: 0 0 14px 0; font-size: 1.1rem; }
.rules-box p { color: #a9bfdc; font-size: 0.9rem; margin: 0 0 8px 0; line-height: 1.6; }
.rules-box p strong { color: #ffd2a6; }

@media (max-width: 768px) {
  .game-title { font-size: 2.5rem; }
  .desk { flex-direction: column; padding: 24px; gap: 30px; width: 100%; }
  .divider { width: 100%; height: 1px; margin: 0; }
  .setup-form { min-width: 0; width: 100%; }
}
</style>
