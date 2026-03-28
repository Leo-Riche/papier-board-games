// server/games/timebomb.js

const availableSherlockCards = ['Sherlock1', 'Sherlock2', 'Sherlock3', 'Sherlock4', 'Sherlock5', 'Sherlock1', 'Sherlock2'];
const availableMoriartyCards = ['Moriarty1', 'Moriarty2', 'Moriarty3', 'Moriarty1'];

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
      isRedistributing: false,
      lastShooterId: null,
      announcements: {},
      players: []
    };
  }

  start() {
    const nbPlayers = this.players.length;
    this.state.announcements = {};
    
    // 1. Logique des rôles
    let nbSherlock, nbMoriarty;
    if (nbPlayers >= 4 && nbPlayers <= 5) {
      nbSherlock = 3; nbMoriarty = 2; 
    } else if (nbPlayers === 6) {
      nbSherlock = 4; nbMoriarty = 2; 
    } else if (nbPlayers >= 7 && nbPlayers <= 8) {
      nbSherlock = 5; nbMoriarty = 3; 
    }
    else if (nbPlayers === 9) {
      nbMoriarty = Math.random() < 0.5 ? 3 : 4; 
      nbSherlock = nbPlayers - nbMoriarty;
    } else if (nbPlayers === 10) {
      nbSherlock = 6; nbMoriarty = 4; 
    } 
    else {
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

    const startingPlayerIndex = Math.floor(Math.random() * nbPlayers);

    // 3. Distribution initiale (Manche 1)
    this.state.players = this.players.map((p, index) => {
      const specificRoleCard = assignedRoleCards[index];
      const roleType = specificRoleCard.startsWith('Sherlock') ? 'Sherlock' : 'Moriarty';

      return {
        id: p.id,
        name: p.name,
        role: roleType,            
        roleCard: specificRoleCard, 
        hand: deck.splice(0, 5).map(type => ({ type: type, isRevealed: false })),
        hasScissors: index === startingPlayerIndex 
      };
    });

    this.io.to(this.roomCode).emit('game_started');
    this.broadcastState();
  }

  handleCut(targetId, cardIndex, shooterName) {
    if (this.state.status !== 'playing') return;
    if (this.state.isRedistributing) return;

    const currentShooter = this.state.players.find(p => p.hasScissors);
    if (!currentShooter) return;

    if (targetId === this.state.lastShooterId) return;

    const targetPlayer = this.state.players.find(p => p.id === targetId);
    const card = targetPlayer.hand[cardIndex];

    if (card.isRevealed) return;

    // 1. On révèle la carte
    card.isRevealed = true;
    this.state.turnCuts++;

    // 2. On mémorise l'ID du tireur AVANT de transférer les ciseaux
    this.state.lastShooterId = currentShooter.id;

    // 3. Transfert des ciseaux
    this.state.players.forEach(p => p.hasScissors = false);
    targetPlayer.hasScissors = true;

    this.io.to(this.roomCode).emit('action_log', `${shooterName} a coupé chez ${targetPlayer.name} !`);

    // 4. Vérification des conditions de victoire
    if (card.type === 'bomb') {
      return this.endGame('Moriarty', '💥 BOUM ! La bombe a explosé.');
    } else if (card.type === 'defuse') {
      this.state.defusesFound++;
      if (this.state.defusesFound === this.state.totalDefuses) {
        return this.endGame('Sherlock', '✅ Tous les câbles ont été désamorcés !');
      }
    }

    // 5. Vérification de fin de manche
    if (this.state.turnCuts === this.state.players.length) {
      this.state.isRedistributing = true;
      this.io.to(this.roomCode).emit('action_log', `Fin de la manche ${this.state.round}. Redistribution...`);
      setTimeout(() => this.startNextRound(), 2500);
    } 

    this.broadcastState();
  }

  handleAnnouncement(playerName, defuses, hasBomb) {
    this.state.announcements[playerName] = { defuses, hasBomb };
    const bombText = hasBomb ? " et prétend avoir la BOMBE 💥" : "";
    this.io.to(this.roomCode).emit('action_log', `📣 ${playerName} annonce : ${defuses} câble(s) de désamorçage${bombText}.`);
    
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

    const cardsPerPlayer = newDeck.length / this.state.players.length;
    this.state.players.forEach(p => {
      p.hand = newDeck.splice(0, cardsPerPlayer).map(type => ({ type, isRevealed: false }));
    });

    this.state.turnCuts = 0; 
    this.state.isRedistributing = false;
    this.state.lastShooterId = null;
    this.state.announcements = {};

    const playerWithScissors = this.state.players.find(p => p.hasScissors);
    const scissorsHolderName = playerWithScissors ? playerWithScissors.name : "Quelqu'un";
    this.io.to(this.roomCode).emit('action_log', `Manche ${this.state.round} démarrée. Les ciseaux sont chez ${scissorsHolderName} !`);

    this.broadcastState();
  }

  endGame(winner, reason) {
    this.state.status = 'finished';
    this.state.players.forEach(p => {
      p.hand.forEach(c => c.isRevealed = true);
    });
    
    const revealedPlayers = this.state.players.map(p => ({
      name: p.name,
      role: p.role
    }));

    this.broadcastState(); 
    this.io.to(this.roomCode).emit('game_over', { winner, reason, players: revealedPlayers });
  }

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
        cutsLeft: this.state.players.length - this.state.turnCuts,
        announcements: this.state.announcements,
        myRole: player.role,
        myRoleCard: player.roleCard,
        myHand: player.hand,
        hasScissors: player.hasScissors,
        opponents: opponents,
        isRedistributing: this.state.isRedistributing,
        protectedPlayerId: this.state.lastShooterId
      });
    });
  }

  reconnectPlayer(newSocketId, playerName) {
    if (this.state.status !== 'playing') return false;

    const player = this.state.players.find(p => p.name === playerName);
    
    if (player) {
      player.id = newSocketId;
      return true;
    }
    return false;
  }
}

module.exports = TimeBomb;