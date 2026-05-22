// server/games/yams.js

const rollDie = () => Math.floor(Math.random() * 6) + 1;

class Yams {
  constructor(roomCode, playersData, io) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData;

    this.state = {
      status: 'waiting', // waiting, playing, finished
      activePlayerIndex: 0,
      dice: [
        { value: 1, locked: false },
        { value: 1, locked: false },
        { value: 1, locked: false },
        { value: 1, locked: false },
        { value: 1, locked: false }
      ],
      rollsLeft: 3,
      turnNumber: 1, // 1 to 13
      players: []
    };
  }

  start() {
    this.state.players = this.players.map(p => ({
      id: p.id,
      name: p.name,
      scoreSheet: {
        ones: null,
        twos: null,
        threes: null,
        fours: null,
        fives: null,
        sixes: null,
        threeOfAKind: null,
        fourOfAKind: null,
        fullHouse: null,
        smallStraight: null,
        largeStraight: null,
        yams: null,
        chance: null
      },
      totalScore: 0
    }));

    this.state.activePlayerIndex = Math.floor(Math.random() * this.players.length);
    this.state.status = 'playing';
    this.state.rollsLeft = 3;
    this.state.turnNumber = 1;
    this.resetDice();

    this.io.to(this.roomCode).emit('game_started');
    this.io.to(this.roomCode).emit('action_log', `🎲 La partie de Yams commence ! ${this.getActivePlayer().name} joue en premier.`);
    this.broadcastState();
  }

  getActivePlayer() {
    return this.state.players[this.state.activePlayerIndex];
  }

  resetDice() {
    this.state.dice = [
      { value: 1, locked: false },
      { value: 1, locked: false },
      { value: 1, locked: false },
      { value: 1, locked: false },
      { value: 1, locked: false }
    ];
    this.state.rollsLeft = 3;
  }

  handleAction(playerId, actionType, data) {
    if (this.state.status !== 'playing') return;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;

    const isActive = player.id === this.getActivePlayer().id;
    if (!isActive) return; // Only active player can act in Yams

    if (actionType === 'roll') {
      if (this.state.rollsLeft <= 0) return;

      this.state.dice = this.state.dice.map(d => ({
        value: d.locked ? d.value : rollDie(),
        locked: d.locked
      }));

      this.state.rollsLeft--;

      const rollNum = 3 - this.state.rollsLeft;
      this.io.to(this.roomCode).emit('action_log', `🎲 ${player.name} lance les dés (lancer ${rollNum}/3).`);
      this.broadcastState();
    }
    else if (actionType === 'toggle_lock') {
      // data: { index: 0-4 }
      if (this.state.rollsLeft === 3) return; // Can't lock before first roll
      if (this.state.rollsLeft === 0) return; // Can't lock after last roll

      const idx = data.index;
      if (idx < 0 || idx > 4) return;

      this.state.dice[idx].locked = !this.state.dice[idx].locked;
      this.broadcastState();
    }
    else if (actionType === 'score') {
      // data: { category: string }
      if (this.state.rollsLeft === 3) return; // Must roll at least once

      const category = data.category;
      if (!category || player.scoreSheet[category] !== null) return; // Already scored

      const diceValues = this.state.dice.map(d => d.value);
      const score = this.calculateCategoryScore(diceValues, category);

      player.scoreSheet[category] = score;
      player.totalScore = this.calculateTotalScore(player.scoreSheet);

      this.io.to(this.roomCode).emit('action_log', `📝 ${player.name} inscrit ${score} points en "${this.getCategoryLabel(category)}".`);

      // Check if game is over (all players have filled all 13 categories)
      if (this.isGameOver()) {
        this.endGame();
        return;
      }

      // Next player's turn
      this.advanceTurn();
    }
  }

  calculateCategoryScore(dice, category) {
    const counts = [0, 0, 0, 0, 0, 0]; // index 0 = count of 1s, etc.
    dice.forEach(v => counts[v - 1]++);
    const sum = dice.reduce((a, b) => a + b, 0);

    switch (category) {
      // Upper section
      case 'ones': return counts[0] * 1;
      case 'twos': return counts[1] * 2;
      case 'threes': return counts[2] * 3;
      case 'fours': return counts[3] * 4;
      case 'fives': return counts[4] * 5;
      case 'sixes': return counts[5] * 6;

      // Lower section
      case 'threeOfAKind':
        return counts.some(c => c >= 3) ? sum : 0;

      case 'fourOfAKind':
        return counts.some(c => c >= 4) ? sum : 0;

      case 'fullHouse':
        return (counts.includes(3) && counts.includes(2)) ? 25 : 0;

      case 'smallStraight': {
        // 4 consecutive: check for 1-2-3-4, 2-3-4-5, or 3-4-5-6
        const unique = [...new Set(dice)].sort((a, b) => a - b);
        const straights = [[1,2,3,4], [2,3,4,5], [3,4,5,6]];
        return straights.some(s => s.every(v => unique.includes(v))) ? 30 : 0;
      }

      case 'largeStraight': {
        // 5 consecutive: 1-2-3-4-5 or 2-3-4-5-6
        const sorted = [...dice].sort((a, b) => a - b);
        const isLarge = (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3 && sorted[3] === 4 && sorted[4] === 5) ||
                        (sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4 && sorted[3] === 5 && sorted[4] === 6);
        return isLarge ? 40 : 0;
      }

      case 'yams':
        return counts.some(c => c === 5) ? 50 : 0;

      case 'chance':
        return sum;

      default:
        return 0;
    }
  }

  calculateTotalScore(scoreSheet) {
    let total = 0;
    let upperTotal = 0;

    const upperCategories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
    const allCategories = [...upperCategories, 'threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yams', 'chance'];

    for (const cat of allCategories) {
      if (scoreSheet[cat] !== null) {
        total += scoreSheet[cat];
      }
    }

    for (const cat of upperCategories) {
      if (scoreSheet[cat] !== null) {
        upperTotal += scoreSheet[cat];
      }
    }

    // Bonus: +35 if upper section >= 63
    if (upperTotal >= 63) {
      total += 35;
    }

    return total;
  }

  getUpperTotal(scoreSheet) {
    const upperCategories = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
    let total = 0;
    for (const cat of upperCategories) {
      if (scoreSheet[cat] !== null) {
        total += scoreSheet[cat];
      }
    }
    return total;
  }

  getCategoryLabel(category) {
    const labels = {
      ones: 'As (1)',
      twos: 'Deux (2)',
      threes: 'Trois (3)',
      fours: 'Quatre (4)',
      fives: 'Cinq (5)',
      sixes: 'Six (6)',
      threeOfAKind: 'Brelan',
      fourOfAKind: 'Carré',
      fullHouse: 'Full',
      smallStraight: 'Petite Suite',
      largeStraight: 'Grande Suite',
      yams: 'Yams',
      chance: 'Chance'
    };
    return labels[category] || category;
  }

  isGameOver() {
    return this.state.players.every(player => {
      return Object.values(player.scoreSheet).every(v => v !== null);
    });
  }

  advanceTurn() {
    // Move to next player
    this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % this.state.players.length;
    this.resetDice();

    const newActive = this.getActivePlayer();
    this.io.to(this.roomCode).emit('action_log', `➡️ C'est au tour de ${newActive.name}.`);
    this.broadcastState();
  }

  endGame() {
    this.state.status = 'finished';

    // Recalculate final scores
    this.state.players.forEach(p => {
      p.totalScore = this.calculateTotalScore(p.scoreSheet);
    });

    // Sort by score descending
    const sortedPlayers = [...this.state.players].sort((a, b) => b.totalScore - a.totalScore);

    this.io.to(this.roomCode).emit('game_over', {
      reason: 'Toutes les catégories ont été remplies !',
      players: sortedPlayers.map(p => ({
        id: p.id,
        name: p.name,
        score: p.totalScore,
        scoreSheet: p.scoreSheet,
        upperTotal: this.getUpperTotal(p.scoreSheet),
        hasBonus: this.getUpperTotal(p.scoreSheet) >= 63
      }))
    });

    this.broadcastState();
  }

  broadcastState() {
    const activePlayer = this.getActivePlayer();

    this.state.players.forEach(player => {
      this.io.to(player.id).emit('update_board_state', {
        status: this.state.status,
        activePlayerId: activePlayer.id,
        dice: this.state.dice,
        rollsLeft: this.state.rollsLeft,
        players: this.state.players.map(p => ({
          id: p.id,
          name: p.name,
          scoreSheet: p.scoreSheet,
          totalScore: p.totalScore,
          upperTotal: this.getUpperTotal(p.scoreSheet),
          hasBonus: this.getUpperTotal(p.scoreSheet) >= 63
        })),
        myId: player.id
      });
    });
  }

  reconnectPlayer(newSocketId, playerName) {
    if (this.state.status !== 'playing' && this.state.status !== 'finished') return false;

    const player = this.state.players.find(p => p.name === playerName);
    if (player) {
      player.id = newSocketId;
      return true;
    }
    return false;
  }
}

module.exports = Yams;
