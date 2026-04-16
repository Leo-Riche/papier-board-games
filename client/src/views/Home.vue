<template>
  <div class="home-container">
    <h1>Papier Board Games 🎲</h1>
    <div class="games-grid">
      <div class="game-card" @click="$router.push('/timebomb/lobby')">
        <div class="badge">Nouveau !</div>
        <h2>Time Bomb 💣</h2>
        <p>Bluffez vos amis pour sauver Londres... ou la faire sauter !</p>
        <button class="btn-play">Jouer maintenant</button>
      </div>

      <div class="game-card" @click="$router.push('/loupgarou/lobby')">
        <div class="badge">Nouveau !</div>
        <h2>Loup Garou 🐺</h2>
        <p>Participez à une partie de Loup-Garou et tentez de découvrir les rôles des autres joueurs !</p>
        <button class="btn-play">Jouer maintenant</button>
      </div>

      <div class="game-card" @click="$router.push('/qwixx/lobby')">
        <div class="badge">Nouveau !</div>
        <h2>Qwixx 🎲</h2>
        <p>Prenez des risques et cochez les bonnes cases dans ce jeu de dés addictif !</p>
        <button class="btn-play">Jouer maintenant</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container { text-align: center; padding: 40px 20px; color: white; }
.games-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-top: 40px; }
.game-card { 
  background: #2c3e50; border-radius: 15px; padding: 20px; width: 300px; max-width: 100%;
  transition: transform 0.3s; cursor: pointer; border: 2px solid transparent;
  position: relative; box-sizing: border-box;
}
.game-card:hover { transform: translateY(-10px); border-color: #f39c12; }
.badge { position: absolute; top: -10px; right: -10px; background: #e74c3c; color: white; padding: 5px 10px; border-radius: 10px; font-weight: bold; font-size: 0.8rem; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
.disabled { opacity: 0.5; cursor: not-allowed; }
.btn-play { background: #f39c12; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background 0.3s; margin-top: 15px; }
.btn-play:hover { background: #d68910; }

@media (max-width: 600px) {
  .home-container { padding: 20px 10px; }
  h1 { font-size: 1.8rem; }
  .games-grid { flex-direction: column; align-items: center; gap: 30px; }
  .game-card { width: 100%; max-width: 350px; }
}
</style>