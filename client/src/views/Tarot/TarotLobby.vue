<template>
  <div class="lobby-wrapper">
    <header class="lobby-header">
      <h1 class="game-title">Tarot 🃏</h1>
      <p class="subtitle">Le preneur contre les défenseurs · 78 cartes · de 3 à 5 joueurs</p>
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
        <p>Jeu de <strong>78 cartes</strong> : 4 couleurs (Roi, Dame, Cavalier, Valet, 10…As), <strong>21 atouts</strong> et l'<strong>Excuse</strong>. Le 1 (Petit), le 21 et l'Excuse sont les 3 <strong>Bouts</strong> (Oudlers).</p>
        <p><strong>Enchères</strong> : Passe, Petite, Garde, Garde Sans, Garde Contre. Le preneur doit atteindre 56 / 51 / 41 / 36 points selon qu'il détient 0, 1, 2 ou 3 Bouts.</p>
        <p><strong>3 joueurs</strong> : 24 cartes chacun, Chien de 6. <strong>4 joueurs</strong> : 18 cartes, Chien de 6. <strong>5 joueurs</strong> : 15 cartes, Chien de 3, et le preneur <strong>appelle un Roi</strong> pour se choisir un partenaire caché.</p>
        <p>Primes : <strong>Petit au Bout</strong> (10×), <strong>Poignée</strong> (10/13/15 atouts → 20/30/40), <strong>Chelem</strong>. Format de partie réglé dans la salle d'attente.</p>
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
  router.push(`/tarot/${code}`)
}

const joinRoom = () => {
  if (!playerName.value.trim() || !roomCode.value.trim()) return alert('Pseudo et code requis !')
  localStorage.setItem('temp_player_name', playerName.value.trim())
  router.push(`/tarot/${roomCode.value.trim()}`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.lobby-wrapper { min-height: 100vh; display: flex; flex-direction: column; background: #150e26; color: #efe8f7; font-family: 'Outfit', sans-serif; box-sizing: border-box; }
.lobby-header { padding: 40px 20px; text-align: center; background: linear-gradient(180deg, #221739 0%, #150e26 100%); border-bottom: 1px solid rgba(196,160,80,0.25); margin-bottom: 40px; }
.game-title { font-size: 3.5rem; font-weight: 900; margin: 0; color: #e8c46a; filter: drop-shadow(0 2px 8px rgba(232,196,106,0.35)); }
.subtitle { color: #7a63a3; font-size: 1.05rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; }

.lobby-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 30px; }
.desk { display: flex; align-items: stretch; background: #221739; padding: 40px; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); border: 1px solid rgba(196,160,80,0.2); box-sizing: border-box; }
.divider { width: 1px; background: rgba(196,160,80,0.15); margin: 0 40px; }

.setup-form { display: flex; flex-direction: column; align-items: center; gap: 24px; min-width: 260px; }
.setup-form h2 { color: #e8c46a; font-size: 1.6rem; font-weight: 700; text-align: center; margin: 0; }

.input-group { width: 100%; }
.input-group input {
  width: 100%; padding: 14px; background: #150e26; border: 2px solid transparent; border-radius: 10px;
  color: #efe8f7; font-family: 'Outfit', sans-serif; font-size: 1.05rem; text-align: center;
  outline: none; transition: 0.3s; box-sizing: border-box;
}
.input-group input::placeholder { color: #453466; }
.input-group input:focus { border-color: #7c5cc4; background: #221739; }

.action-btn {
  width: 100%; border: none; border-radius: 10px;
  font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 700; padding: 14px;
  cursor: pointer; transition: 0.2s; text-transform: uppercase; letter-spacing: 1px; box-sizing: border-box;
}
.action-btn.primary { background: linear-gradient(135deg, #7c5cc4, #5b3fa0); color: #fff7e6; }
.action-btn.primary:hover { background: linear-gradient(135deg, #8f6fd6, #6b4bb5); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(124,92,196,0.4); }
.action-btn.secondary { background: #150e26; color: #a690c9; border: 2px solid #453466; }
.action-btn.secondary:hover { background: #221739; color: #efe8f7; border-color: #e8c46a; transform: translateY(-2px); }

.rules-box { background: #221739; border: 1px solid rgba(196,160,80,0.15); border-radius: 14px; padding: 24px 30px; max-width: 640px; width: 100%; box-sizing: border-box; }
.rules-box h3 { color: #e8c46a; margin: 0 0 14px 0; font-size: 1.1rem; }
.rules-box p { color: #a690c9; font-size: 0.9rem; margin: 0 0 8px 0; line-height: 1.6; }
.rules-box p strong { color: #cdb3e8; }

@media (max-width: 768px) {
  .game-title { font-size: 2.5rem; }
  .desk { flex-direction: column; padding: 24px; gap: 30px; }
  .divider { width: 100%; height: 1px; margin: 0; }
  .setup-form { min-width: 0; width: 100%; }
}
</style>
