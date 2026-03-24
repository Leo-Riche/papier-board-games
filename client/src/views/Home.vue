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

      <div class="game-card disabled">
        <h2>Prochainement...</h2>
        <p>Un nouveau jeu arrive bientôt dans la bibliothèque.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container { text-align: center; padding: 40px; color: white; }
.games-grid { display: flex; gap: 20px; justify-content: center; margin-top: 40px; }
.game-card { 
  background: #2c3e50; border-radius: 15px; padding: 20px; width: 300px;
  transition: transform 0.3s; cursor: pointer; border: 2px solid transparent;
}
.game-card:hover { transform: translateY(-10px); border-color: #f39c12; }
.disabled { opacity: 0.5; cursor: not-allowed; }
.btn-play { background: #f39c12; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
</style>