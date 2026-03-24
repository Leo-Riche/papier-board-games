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
    this.io = io;
    this.players = playersData; 
    
    // L'état central de la partie
    this.state = {
      round: 1,
      turnCuts: 0, // Combien de fils coupés dans cette manche
      defusesFound: 0,
      totalDefuses: playersData.length,
      status: 'playing', // 'playing', 'finished'
      players: []
    };
  }

  start() {
    const nbPlayers = this.players.length;
    
    // 1. Logique des rôles (Basée sur les règles officielles)
    let rolePool = [];
    if (nbPlayers >= 4 && nbPlayers <= 5) {
      // 3 Sherlock / 2 Moriarty (5 cartes rôles au total)
      rolePool = ['Sherlock', 'Sherlock', 'Sherlock', 'Moriarty', 'Moriarty'];
    } else if (nbPlayers === 6) {
      // 4 Sherlock / 2 Moriarty (6 cartes rôles au total)
      rolePool = ['Sherlock', 'Sherlock', 'Sherlock', 'Sherlock', 'Moriarty', 'Moriarty'];
    } else if (nbPlayers >= 7 && nbPlayers <= 8) {
      // 5 Sherlock / 3 Moriarty (8 cartes rôles au total)
      rolePool = ['Sherlock', 'Sherlock', 'Sherlock', 'Sherlock', 'Sherlock', 'Moriarty', 'Moriarty', 'Moriarty'];
    } else {
      } else {
        // ⚠️ Invalid number of players
        throw new Error('Time Bomb nécessite 4-8 joueurs');
      }
    }

    // On mélange le tas de rôles et on distribue une carte à chaque joueur
    // Magie : Si on est 4 joueurs, le slice(0, 4) laissera aléatoirement 1 rôle de côté !
    let roles = shuffle(rolePool).slice(0, nbPlayers);

    // 2. Logique du Deck (Basée sur les règles officielles)
    let deck = ['bomb']; // Toujours 1 seule bombe
    
    // Autant de câbles de désamorçage que de joueurs
    for (let i = 0; i < nbPlayers; i++) {
      deck.push('defuse');
    }
    
    // Le reste est rempli de fils neutres pour arriver à 5 cartes par joueur
    // Ex à 5 joueurs : 25 cartes totales - 1 bombe - 5 désamorçages = 19 fils neutres.
    const totalCards = nbPlayers * 5;
    while (deck.length < totalCards) {
      deck.push('wire');
    }
    
    // On mélange le deck complet avant la distribution
    deck = shuffle(deck);

    // 3. Distribution initiale (Manche 1)
    this.state.players = this.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      role: roles[index],
      hand: deck.splice(0, 5).map(type => ({ type: type, isRevealed: false })),
      hasScissors: index === 0 // Le premier joueur (l'hôte) commence avec les ciseaux
    }));

    // On prévient le client que le jeu commence, puis on envoie le premier "State"
    this.io.to(this.roomCode).emit('game_started');
    this.broadcastState();
  }

  handleCut(targetId, cardIndex, shooterName) {
    if (this.state.status !== 'playing') return;

    const targetPlayer = this.state.players.find(p => p.id === targetId);
    const card = targetPlayer.hand[cardIndex];

    if (card.isRevealed) return; // Sécurité : on ne coupe pas un fil déjà coupé

    // 1. On révèle la carte
    card.isRevealed = true;
    this.state.turnCuts++;

    // 2. Transfert des ciseaux
    this.state.players.forEach(p => p.hasScissors = false);
    targetPlayer.hasScissors = true;

    // On prévient tout le monde de l'action
    this.io.to(this.roomCode).emit('action_log', `${shooterName} a coupé chez ${targetPlayer.name} !`);

    // 3. Vérification des conditions de victoire
    if (card.type === 'bomb') {
      return this.endGame('Moriarty', '💥 BOUM ! La bombe a explosé.');
    } else if (card.type === 'defuse') {
      this.state.defusesFound++;
      if (this.state.defusesFound === this.state.totalDefuses) {
        return this.endGame('Sherlock', '✅ Tous les câbles ont été désamorcés !');
      }
    }

    // 4. Vérification de fin de manche
    if (this.state.turnCuts === this.state.players.length) {
      // Petite pause de 2 secondes pour laisser les joueurs voir la dernière carte
      this.io.to(this.roomCode).emit('action_log', `Fin de la manche ${this.state.round}. Redistribution...`);
      setTimeout(() => this.startNextRound(), 2500);
    } 

    this.broadcastState();
  }

  startNextRound() {
    this.state.round++;
    
    // Si on dépasse 4 manches, Moriarty gagne
    if (this.state.round > 4) {
      return this.endGame('Moriarty', '⏳ Le temps est écoulé, la bombe explose !');
    }

    // On ramasse toutes les cartes NON RÉVÉLÉES
    let newDeck = [];
    this.state.players.forEach(p => {
      p.hand.forEach(c => {
        if (!c.isRevealed) newDeck.push(c.type);
      });
      p.hand = []; // On vide les mains
    });

    newDeck = shuffle(newDeck);

    // On redistribue équitablement
    const cardsPerPlayer = newDeck.length / this.state.players.length;
    this.state.players.forEach(p => {
      p.hand = newDeck.splice(0, cardsPerPlayer).map(type => ({ type, isRevealed: false }));
    });

    this.state.turnCuts = 0; // On reset le compteur de la manche
    this.broadcastState();
  }

  endGame(winner, reason) {
    this.state.status = 'finished';
    this.state.players.forEach(p => {
      p.hand.forEach(c => c.isRevealed = true);
    });
    this.broadcastState(); 
    this.io.to(this.roomCode).emit('game_over', { winner, reason });
  }

  // Fonction cruciale : Envoie à chaque joueur uniquement ce qu'il a le droit de voir
  broadcastState() {
    this.state.players.forEach(player => {
      const opponents = this.state.players
        .filter(p => p.id !== player.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          hasScissors: p.hasScissors,
          // Si la carte n'est pas révélée, on masque son vrai "type" au client
          hand: p.hand.map(c => c.isRevealed ? c : { type: 'hidden', isRevealed: false })
        }));

      this.io.to(player.id).emit('update_board_state', {
        round: this.state.round,
        defusesLeft: this.state.totalDefuses - this.state.defusesFound,
        myRole: player.role,
        myHand: player.hand,
        hasScissors: player.hasScissors,
        opponents: opponents
      });
    });
  }
}

module.exports = TimeBomb;