const TimeBomb = require('./games/timebomb');

// On simule 4 IDs de sockets
const fakePlayers = ['socket_1', 'socket_2', 'socket_3', 'socket_4'];

const result = TimeBomb.setupGame(fakePlayers);

console.log("--- TEST DISTRIBUTION TIME BOMB ---");
result.forEach(p => {
    console.log(`Joueur ${p.id}: Rôle=${p.role}, Cartes=${p.hand.length}, Ciseaux=${p.hasScissors}`);
});

// Vérification de la bombe
const allCards = result.flatMap(p => p.hand.map(c => c.type));
const bombCount = allCards.filter(t => t === 'bomb').length;
console.log(`Nombre de bombes dans le jeu : ${bombCount} (doit être 1)`);