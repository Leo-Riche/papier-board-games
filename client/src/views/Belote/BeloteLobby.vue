<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <h1 class="game-title">Belote ♥</h1>
      <p class="subtitle">2 contre 2 · à la retourne · sans annonces</p>
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
        <p>Jeu de <strong>32 cartes</strong>, <strong>4 joueurs</strong> en 2 équipes (partenaires face à face). Le donneur distribue 5 cartes et retourne la 21ᵉ.</p>
        <p><strong>Choix de l'atout</strong> : chacun prend l'atout de la retourne ou passe ; 2ᵉ tour, couleur libre. Le preneur doit faire <strong>plus de points que la défense</strong>.</p>
        <p>Atout : V·9·A·10·R·D·8·7 — Hors atout : A·10·R·D·V·9·8·7. 10 de der, capot à 250. Belote-Rebelote (R+D d'atout) = 20.</p>
        <p>Équipes et format de partie se règlent dans la salle d'attente. Le jeu n'est mélangé qu'au début : ensuite le joueur à droite du donneur <strong>coupe</strong> entre chaque donne, et le donneur choisit la distribution (3-2 ou 2-3).</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const playerName = ref('')
const roomCode = ref('')

const generateRoomCode = (length = 5) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

const createRoom = () => {
  if (!playerName.value.trim()) return alert('Choisis un pseudo !')
  const code = generateRoomCode()
  localStorage.setItem('temp_player_name', playerName.value.trim())
  router.push(`/belote/${code}`)
}

const joinRoom = () => {
  if (!playerName.value.trim() || !roomCode.value.trim()) return alert('Pseudo et code requis !')
  localStorage.setItem('temp_player_name', playerName.value.trim())
  router.push(`/belote/${roomCode.value.trim()}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.lobby-wrapper { min-height: 100vh; display: flex; flex-direction: column; background: #0a1f16; color: #e8f5ee; font-family: 'Outfit', sans-serif; box-sizing: border-box; }
.lobby-header { padding: 40px 20px; text-align: center; background: linear-gradient(180deg, #0f2c20 0%, #0a1f16 100%); border-bottom: 1px solid rgba(80,200,140,0.2); margin-bottom: 40px; }
.game-title { font-size: 3.5rem; font-weight: 900; margin: 0; color: #4fd08a; filter: drop-shadow(0 2px 8px rgba(79,208,138,0.35)); }
.subtitle { color: #3f6b56; font-size: 1.05rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; }

.lobby-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 30px; }
.desk { display: flex; align-items: stretch; background: #0f2c20; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); border: 1px solid rgba(80,200,140,0.2); box-sizing: border-box; }
.divider { width: 1px; background: rgba(80,200,140,0.15); margin: 0 40px; }

.setup-form { display: flex; flex-direction: column; align-items: center; gap: 24px; min-width: 260px; }
.setup-form h2 { color: #4fd08a; font-size: 1.6rem; font-weight: 700; text-align: center; margin: 0; }

.input-group { width: 100%; }
.input-group input {
  width: 100%; padding: 14px; background: #0a1f16; border: 2px solid transparent; border-radius: 10px;
  color: #e8f5ee; font-family: 'Outfit', sans-serif; font-size: 1.05rem; text-align: center;
  outline: none; transition: 0.3s; box-sizing: border-box;
}
.input-group input::placeholder { color: #2f5a44; }
.input-group input:focus { border-color: #1f9c5f; background: #0f2c20; }

.action-btn {
  width: 100%; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; padding: 14px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; box-sizing: border-box;
}
.action-btn.primary { background: linear-gradient(135deg, #1f9c5f, #157a49); color: #eafff3; }
.action-btn.primary:hover { background: linear-gradient(135deg, #27b06d, #1f9c5f); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(31,156,95,0.4); }
.action-btn.secondary { background: #0a1f16; color: #6a9d84; border: 2px solid #2f5a44; }
.action-btn.secondary:hover { background: #0f2c20; color: #eafff3; border-color: #4fd08a; transform: translateY(-2px); }

.rules-box { background: #0f2c20; border: 1px solid rgba(80,200,140,0.15); border-radius: 14px; padding: 24px 30px; max-width: 640px; width: 100%; box-sizing: border-box; }
.rules-box h3 { color: #4fd08a; margin: 0 0 14px 0; font-size: 1.1rem; }
.rules-box p { color: #6a9d84; font-size: 0.9rem; margin: 0 0 8px 0; line-height: 1.6; }
.rules-box p strong { color: #a7d9c1; }

@media (max-width: 768px) {
  .game-title { font-size: 2.5rem; }
  .desk { flex-direction: column; padding: 24px; gap: 30px; }
  .divider { width: 100%; height: 1px; margin: 0; }
  .setup-form { min-width: 0; width: 100%; }
}
</style>
