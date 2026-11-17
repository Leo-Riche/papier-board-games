<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <h1 class="game-title">DUTCH</h1>
      <p class="subtitle">Mémoire, bluff et réflexes · 2 à 8 joueurs</p>
    </header>

    <main class="lobby-main">
      <div class="deck">
        <div class="setup-form">
          <h2>Créer un salon</h2>
          <div class="du-input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
          </div>
          <BaseButton variant="primary" @click="createRoom">Ouvrir une table 🃏</BaseButton>
        </div>

        <div class="separator"></div>

        <div class="setup-form">
          <h2>Rejoindre un salon</h2>
          <div class="du-input-group">
            <input type="text" v-model="playerName" placeholder="Votre Pseudo" />
          </div>
          <div class="du-input-group">
            <input type="text" v-model="roomCode" placeholder="Code (ex: A4X9P)" />
          </div>
          <BaseButton variant="secondary" @click="joinRoom">S'asseoir</BaseButton>
        </div>
      </div>

      <section class="rules">
        <h3>Règles en bref</h3>
        <ul>
          <li>4 cartes face cachée, tu en regardes 2 au début. Objectif : le <strong>moins de points</strong>.</li>
          <li>As = 1 · 2 à 10 = valeur · Valet = 11 · Dame = 12 · <strong>Roi rouge = 0</strong> · Roi noir = 13.</li>
          <li>À ton tour : pioche, puis échange avec une de tes cartes <strong>ou</strong> défausse-la directement.</li>
          <li>Défausser directement un <strong>Valet</strong> : échange 2 cartes au choix. Une <strong>Dame</strong> : regarde une carte au choix.</li>
          <li><strong>Snap</strong> (5 s) : après chaque défausse, pose une carte de même valeur. Erreur = carte de pénalité.</li>
          <li><strong>Dutch</strong> : annonce-le en fin de tour ; les autres jouent un dernier tour, puis on révèle.</li>
          <li>Égalité : le moins de cartes gagne ; égalité parfaite : l'annonceur perd.</li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'

const router = useRouter()

const playerName = ref(localStorage.getItem('temp_player_name') || '')
const roomCode = ref('')

const generateRoomCode = (length = 5) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

const createRoom = () => {
  if (!playerName.value.trim()) return alert('Choisis un pseudo !')
  localStorage.setItem('temp_player_name', playerName.value.trim())
  router.push(`/dutch/game/${generateRoomCode()}`)
}

const joinRoom = () => {
  if (!playerName.value.trim() || !roomCode.value.trim()) return alert('Pseudo et Code requis !')
  localStorage.setItem('temp_player_name', playerName.value.trim())
  router.push(`/dutch/game/${roomCode.value.trim().toUpperCase()}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Space+Mono&display=swap');

.lobby-wrapper {
  min-height: 100vh; display: flex; flex-direction: column;
  background: radial-gradient(circle at 50% 0%, #1e6b4c 0%, #0b2e21 75%);
  color: #f1e3c0; font-family: 'Space Mono', monospace;
}
.lobby-header { text-align: center; padding: 50px 20px 20px; }
.game-title { font-family: 'Playfair Display', serif; font-size: 3.4rem; color: #f1c40f; letter-spacing: 8px; margin: 0; }
.subtitle { color: #a8d5ba; letter-spacing: 2px; text-transform: uppercase; margin-top: 12px; font-size: 0.85rem; }

.lobby-main { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 30px; padding: 20px; }
.deck {
  display: flex; align-items: stretch; gap: 40px; padding: 40px;
  border: 1px solid rgba(241, 196, 15, 0.25); border-radius: 16px; background: rgba(6, 30, 21, 0.55);
}
.separator { width: 1px; background: rgba(241, 196, 15, 0.2); }
.setup-form { display: flex; flex-direction: column; align-items: center; gap: 24px; min-width: 260px; }
.setup-form h2 {
  font-family: 'Playfair Display', serif; color: #f1e3c0; font-size: 1.4rem; font-weight: normal;
  border-bottom: 1px solid #f1c40f; padding-bottom: 10px; width: 100%; text-align: center; margin: 0;
}
.du-input-group { width: 100%; }
.du-input-group input {
  width: 100%; padding: 12px; background: rgba(3, 20, 14, 0.6); border: 1px solid rgba(241, 196, 15, 0.3);
  border-radius: 8px; color: #f1e3c0; font-family: 'Space Mono', monospace; font-size: 1rem;
  text-align: center; outline: none; transition: border-color 0.2s; box-sizing: border-box;
}
.du-input-group input::placeholder { color: #5f8a74; }
.du-input-group input:focus { border-color: #f1c40f; }

.rules {
  max-width: 640px; width: 100%; box-sizing: border-box; padding: 20px 26px;
  border: 1px dashed rgba(241, 227, 192, 0.25); border-radius: 12px; background: rgba(6, 30, 21, 0.4);
}
.rules h3 { margin: 0 0 12px; font-family: 'Playfair Display', serif; color: #f1c40f; font-weight: normal; }
.rules ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem; line-height: 1.5; color: #d6e8dc; }
.rules strong { color: #f1e3c0; }

@media (max-width: 768px) {
  .game-title { font-size: 2.4rem; }
  .deck { flex-direction: column; gap: 24px; padding: 24px; width: 100%; max-width: 400px; box-sizing: border-box; }
  .separator { width: 100%; height: 1px; }
  .setup-form { min-width: 100%; }
}
</style>
