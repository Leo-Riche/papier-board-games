// server/games/timebomb.js

const availableSherlockCards = ['Sherlock1', 'Sherlock2', 'Sherlock3', 'Sherlock4', 'Sherlock5'];
const availableMoriartyCards = ['Moriarty1', 'Moriarty2', 'Moriarty3'];

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
    
    this.state = {
      round: 1,
      turnCuts: 0,
      defusesFound: 0,
      totalDefuses: playersData.length,
      status: 'playing',
      players: []
    };
  }

  start() {
    const nbPlayers = this.players.length;
    
    let nbSherlock, nbMoriarty;
    if (nbPlayers >= 4 && nbPlayers <= 5) {
      nbSherlock = 3; nbMoriarty = 2;
    } else if (nbPlayers === 6) {
      nbSherlock = 4; nbMoriarty = 2;
    } else if (nbPlayers >= 7 && nbPlayers <= 8) {
      nbSherlock = 5; nbMoriarty = 3;
    } else {
      nbMoriarty = Math.floor(nbPlayers / 2);
      nbSherlock = nbPlayers - nbMoriarty;
    }

    const shuffledSherlocks = shuffle([...availableSherlockCards]);
    const shuffledMoriartys = shuffle([...availableMoriartyCards]);

    const selectedSherlocks = shuffledSherlocks.slice(0, nbSherlock);
    const selectedMoriartys = shuffledMoriartys.slice(0, nbMoriarty);

    const finalRoleCardsPool = [...selectedSherlocks, ...selectedMoriartys];

    const assignedRoleCards = shuffle(finalRoleCardsPool).slice(0, nbPlayers);
    
    let deck = ['bomb'];
    
    for (let i = 0; i < nbPlayers; i++) {
      deck.push('defuse');
    }
    
    const totalCards = nbPlayers * 5;
    while (deck.length < totalCards) {
      deck.push('wire');
    }
    
    deck = shuffle(deck);

    this.state.players = this.players.map((p, index) => {
      
      const specificRoleCard = assignedRoleCards[index];
      
      const roleType = specificRoleCard.startsWith('Sherlock') ? 'Sherlock' : 'Moriarty';

      return {
        id: p.id,
        name: p.name,
        role: roleType,
        roleCard: specificRoleCard,
        hand: deck.splice(0, 5).map(type => ({ type: type, isRevealed: false })),
        hasScissors: index === 0
      };
    });

    this.io.to(this.roomCode).emit('game_started');
    this.broadcastState();
  }

  handleCut(targetId, cardIndex, shooterName) {
    if (this.state.status !== 'playing') return;

    const targetPlayer = this.state.players.find(p => p.id === targetId);
    const card = targetPlayer.hand[cardIndex];

    if (card.isRevealed) return;

    card.isRevealed = true;
    this.state.turnCuts++;

    this.state.players.forEach(p => p.hasScissors = false);
    targetPlayer.hasScissors = true;

    this.io.to(this.roomCode).emit('action_log', `${shooterName} a coupé chez ${targetPlayer.name} !`);

    if (card.type === 'bomb') {
      return this.endGame('Moriarty', '💥 BOUM ! La bombe a explosé.');
    } else if (card.type === 'defuse') {
      this.state.defusesFound++;
      if (this.state.defusesFound === this.state.totalDefuses) {
        return this.endGame('Sherlock', '✅ Tous les câbles ont été désamorcés !');
      }
    }

    if (this.state.turnCuts === this.state.players.length) {
      this.io.to(this.roomCode).emit('action_log', `Fin de la manche ${this.state.round}. Redistribution...`);
      setTimeout(() => this.startNextRound(), 5000);
    } 

    this.broadcastState();
  }

  startNextRound() {
    this.state.round++;
    
    if (this.state.round > 4) {
      return this.endGame('Moriarty', '⏳ Le temps est écoulé, la bombe explose !');
    }

    let newDeck = [];
    this.state.players.forEach(p => {
      p.hand.forEach(c => {
        if (!c.isRevealed) newDeck.push(c.type);
      });
      p.hand = [];
    });

    newDeck = shuffle(newDeck);

    // Redistribution
    const cardsPerPlayer = newDeck.length / this.state.players.length;
    this.state.players.forEach(p => {
      p.hand = newDeck.splice(0, cardsPerPlayer).map(type => ({ type, isRevealed: false }));
    });

    this.state.turnCuts = 0;
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

  // Envoie à chaque joueur uniquement ce qu'il a le droit de voir
  broadcastState() {
    this.state.players.forEach(player => {
      const opponents = this.state.players
        .filter(p => p.id !== player.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          hasScissors: p.hasScissors,
          hand: p.hand.map(c => c.isRevealed ? c : { type: 'hidden', isRevealed: false })
        }));

      this.io.to(player.id).emit('update_board_state', {
        round: this.state.round,
        defusesLeft: this.state.totalDefuses - this.state.defusesFound,
        myRole: player.role,
        myRoleCard: player.roleCard,
        myHand: player.hand,
        hasScissors: player.hasScissors,
        opponents: opponents
      });
    });
  }
}

module.exports = TimeBomb;