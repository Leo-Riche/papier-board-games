// server/games/timebomb.js

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

class TimeBomb {
  constructor(roomCode, playersData, io) {
    this.roomCode = roomCode;
    this.io = io; // On passe l'instance socket.io pour que le jeu puisse communiquer
    this.players = playersData; // Tableau initial [{id, name}]
    this.state = {}; // C'est ici qu'on stockera l'état de la partie (mains, tour, etc.)
  }

  // Fonction pour démarrer la partie
  start() {
    const nbPlayers = this.players.length;
    
    // 1. Logique des rôles
    let roles = nbPlayers <= 5 
      ? ['Sherlock', 'Sherlock', 'Sherlock', 'Moriarty', 'Moriarty']
      : ['Sherlock', 'Sherlock', 'Sherlock', 'Sherlock', 'Moriarty', 'Moriarty'];
    
    roles = shuffle(roles).slice(0, nbPlayers);

    // 2. Logique du Deck
    let deck = ['bomb'];
    for (let i = 0; i < nbPlayers; i++) deck.push('defuse');
    while (deck.length < nbPlayers * 5) deck.push('wire');
    deck = shuffle(deck);

    // 3. Distribution et sauvegarde de l'état
    this.state.players = this.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      role: roles[index],
      hand: deck.splice(0, 5).map(type => ({ type: type, isRevealed: false })),
      hasScissors: index === 0
    }));

    // 4. Envoi des données personnalisées à chaque joueur
    this.state.players.forEach((player) => {
      this.io.to(player.id).emit('init_player_data', {
        role: player.role,
        hand: player.hand,
        hasScissors: player.hasScissors,
        allPlayers: this.state.players.map(p => ({ 
          id: p.id, 
          name: p.name, 
          handCount: p.hand.length 
        }))
      });
    });

    console.log(`🎮 Time Bomb démarré dans la salle ${this.roomCode}`);
  }

  // On prépare la coquille vide pour la suite !
  handleCut(targetId, cardIndex, shooterName) {
    console.log(`✂️ ${shooterName} a coupé la carte ${cardIndex} de ${targetId}`);
    // La logique de révélation viendra ici
  }
}

module.exports = TimeBomb;