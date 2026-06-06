// server/games/thegang.js

const CARD_VALUES_MAP = {
  '02': 2, '03': 3, '04': 4, '05': 5, '06': 6, '07': 7,
  '08': 8, '09': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['02', '03', '04', '05', '06', '07', '08', '09', '10', 'J', 'Q', 'K', 'A'];

// Display names for card values
const VALUE_DISPLAY = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'Valets', 12: 'Dames', 13: 'Rois', 14: 'As'
};
const VALUE_DISPLAY_SINGLE = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As'
};

const getDetailedHandName = (rank, tiebreaker) => {
  const v = (n) => VALUE_DISPLAY[n] || String(n);
  const vs = (n) => VALUE_DISPLAY_SINGLE[n] || String(n);
  switch (rank) {
    case 1:  return `Carte haute : ${vs(tiebreaker[0])}`;
    case 2:  return `Paire de ${v(tiebreaker[0])}`;
    case 3:  return `Double paire : ${v(tiebreaker[0])} et ${v(tiebreaker[1])}`;
    case 4:  return `Brelan de ${v(tiebreaker[0])}`;
    case 5:  return `Suite au ${vs(tiebreaker[0])}`;
    case 6:  return `Couleur (${vs(tiebreaker[0])} haut)`;
    case 7:  return `Full House : ${v(tiebreaker[0])} par ${v(tiebreaker[1])}`;
    case 8:  return `Carré de ${v(tiebreaker[0])}`;
    case 9:  return `Quinte Flush au ${vs(tiebreaker[0])}`;
    case 10: return 'Quinte Flush Royale';
    default: return 'Carte haute';
  }
};
const PHASES = ['preflop', 'flop', 'turn', 'river'];

const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const generateDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return shuffle(deck);
};

const evaluateFiveCards = (cards) => {
  const nums = cards.map(c => CARD_VALUES_MAP[c.value]);
  const suits = cards.map(c => c.suit);

  const valCount = {};
  nums.forEach(v => { valCount[v] = (valCount[v] || 0) + 1; });
  const counts = Object.values(valCount).sort((a, b) => b - a);
  const uniqueVals = Object.keys(valCount).map(Number).sort((a, b) => b - a);

  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;
  if (uniqueVals.length === 5) {
    if (uniqueVals[0] - uniqueVals[4] === 4) {
      isStraight = true;
      straightHigh = uniqueVals[0];
    }
    // Wheel: A-2-3-4-5
    if (uniqueVals[0] === 14 && uniqueVals[1] === 5 && uniqueVals[2] === 4 &&
        uniqueVals[3] === 3 && uniqueVals[4] === 2) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isFlush && isStraight) return { rank: straightHigh === 14 ? 10 : 9, tiebreaker: [straightHigh] };

  if (counts[0] === 4) {
    const quad = uniqueVals.find(v => valCount[v] === 4);
    const kick = uniqueVals.find(v => valCount[v] !== 4);
    return { rank: 8, tiebreaker: [quad, kick] };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    const trip = uniqueVals.find(v => valCount[v] === 3);
    const pair = uniqueVals.find(v => valCount[v] === 2);
    return { rank: 7, tiebreaker: [trip, pair] };
  }
  if (isFlush) return { rank: 6, tiebreaker: uniqueVals };
  if (isStraight) return { rank: 5, tiebreaker: [straightHigh] };
  if (counts[0] === 3) {
    const trip = uniqueVals.find(v => valCount[v] === 3);
    const kicks = uniqueVals.filter(v => valCount[v] !== 3);
    return { rank: 4, tiebreaker: [trip, ...kicks] };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = uniqueVals.filter(v => valCount[v] === 2).sort((a, b) => b - a);
    const kick = uniqueVals.find(v => valCount[v] === 1);
    return { rank: 3, tiebreaker: [...pairs, kick] };
  }
  if (counts[0] === 2) {
    const pair = uniqueVals.find(v => valCount[v] === 2);
    const kicks = uniqueVals.filter(v => valCount[v] !== 2);
    return { rank: 2, tiebreaker: [pair, ...kicks] };
  }
  return { rank: 1, tiebreaker: uniqueVals };
};

const compareHandEvals = (a, b) => {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tiebreaker.length, b.tiebreaker.length); i++) {
    const av = a.tiebreaker[i] ?? 0;
    const bv = b.tiebreaker[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
};

const getBestHand = (pocketCards, communityCards) => {
  const allCards = [...pocketCards, ...communityCards];
  if (allCards.length < 5) return { rank: 0, tiebreaker: [] };

  let bestHand = null;
  const n = allCards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            const evaluated = evaluateFiveCards([allCards[a], allCards[b], allCards[c], allCards[d], allCards[e]]);
            if (!bestHand || compareHandEvals(evaluated, bestHand) > 0) bestHand = evaluated;
          }
  return bestHand;
};

class TheGang {
  constructor(roomCode, playersData, io) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData;

    this.state = {
      status: 'playing',
      phase: 'preflop',
      heists: 0,
      alarms: 0,
      communityCards: [],
      deck: [],
      validations: new Set(),  // river validation votes
      phaseVotes: new Set(),   // votes to advance to next phase
      showdownResult: null,
      players: []
    };
  }

  start() {
    this.state.heists = 0;
    this.state.alarms = 0;
    this.startNewHeist(true);
  }

  startNewHeist(isFirstStart = false) {
    const deck = generateDeck();

    // Preserve player IDs updated through reconnections
    const currentPlayers = this.state.players.length > 0
      ? this.state.players.map(p => ({ id: p.id, name: p.name }))
      : this.players;

    this.state.players = currentPlayers.map(p => ({
      id: p.id,
      name: p.name,
      pocketCards: [deck.pop(), deck.pop()],
      tokenNumber: null
    }));

    this.state.deck = deck;
    this.state.phase = 'preflop';
    this.state.communityCards = [];
    this.state.validations = new Set();
    this.state.phaseVotes = new Set();
    this.state.status = 'playing';
    this.state.showdownResult = null;

    if (isFirstStart) {
      this.io.to(this.roomCode).emit('game_started');
    }

    this.broadcastState();
  }

  // Vote to advance to next phase (cancellable until all have voted)
  handlePhaseVote(socketId) {
    if (this.state.status !== 'playing') return;
    if (PHASES.indexOf(this.state.phase) >= PHASES.length - 1) return; // At river, use validate instead

    if (this.state.phaseVotes.has(socketId)) return; // Already voted

    this.state.phaseVotes.add(socketId);
    const name = this.state.players.find(p => p.id === socketId)?.name;
    this.io.to(this.roomCode).emit('action_log', `👍 ${name} vote pour passer à la phase suivante (${this.state.phaseVotes.size}/${this.state.players.length}).`);

    // Check if all players voted
    if (this.state.phaseVotes.size === this.state.players.length) {
      this._doAdvancePhase();
    } else {
      this.broadcastState();
    }
  }

  // Cancel a phase vote
  handleCancelPhaseVote(socketId) {
    if (!this.state.phaseVotes.has(socketId)) return;
    this.state.phaseVotes.delete(socketId);
    const name = this.state.players.find(p => p.id === socketId)?.name;
    this.io.to(this.roomCode).emit('action_log', `↩️ ${name} annule son vote.`);
    this.broadcastState();
  }

  _doAdvancePhase() {
    const phaseIndex = PHASES.indexOf(this.state.phase);
    if (phaseIndex >= PHASES.length - 1) return;

    const nextPhase = PHASES[phaseIndex + 1];
    this.state.phase = nextPhase;

    if (nextPhase === 'flop') {
      this.state.communityCards.push(
        this.state.deck.pop(), this.state.deck.pop(), this.state.deck.pop()
      );
    } else if (nextPhase === 'turn' || nextPhase === 'river') {
      this.state.communityCards.push(this.state.deck.pop());
    }

    // Reset both vote sets on phase change
    this.state.validations = new Set();
    this.state.phaseVotes = new Set();

    this.io.to(this.roomCode).emit('action_log', `📍 Phase suivante : ${nextPhase.toUpperCase()}`);
    this.broadcastState();
  }

  handleTakeToken(socketId, tokenNumber) {
    if (this.state.status !== 'playing') return;

    const player = this.state.players.find(p => p.id === socketId);
    if (!player) return;
    if (player.tokenNumber === tokenNumber) return; // Already has it

    // Release player's current token
    player.tokenNumber = null;

    // Release the target token from its current holder
    const currentHolder = this.state.players.find(p => p.tokenNumber === tokenNumber);
    if (currentHolder) currentHolder.tokenNumber = null;

    // Assign token
    player.tokenNumber = tokenNumber;

    // Reset river validations AND phase votes when tokens change
    this.state.validations = new Set();
    this.state.phaseVotes = new Set();

    this.broadcastState();
  }

  handleReleaseToken(socketId) {
    if (this.state.status !== 'playing') return;
    const player = this.state.players.find(p => p.id === socketId);
    if (!player || player.tokenNumber === null) return;

    player.tokenNumber = null;
    this.state.validations = new Set();
    this.state.phaseVotes = new Set();
    this.broadcastState();
  }

  handleValidate(socketId) {
    if (this.state.status !== 'playing' || this.state.phase !== 'river') return;
    if (!this.state.players.every(p => p.tokenNumber !== null)) return;
    if (this.state.validations.has(socketId)) return;

    this.state.validations.add(socketId);
    const name = this.state.players.find(p => p.id === socketId)?.name;
    this.io.to(this.roomCode).emit('action_log', `✅ ${name} a validé son classement.`);

    if (this.state.validations.size === this.state.players.length) {
      this.resolveShowdown();
    } else {
      this.broadcastState();
    }
  }

  resolveShowdown() {
    const playerHands = this.state.players.map(p => ({
      id: p.id,
      name: p.name,
      tokenNumber: p.tokenNumber,
      pocketCards: p.pocketCards,
      handEval: getBestHand(p.pocketCards, this.state.communityCards)
    }));

    // Sort by token number ascending
    const byToken = [...playerHands].sort((a, b) => a.tokenNumber - b.tokenNumber);

    // Check if each consecutive pair is in non-decreasing order of hand strength
    let success = true;
    const pairResults = [];
    for (let i = 0; i < byToken.length - 1; i++) {
      const correct = compareHandEvals(byToken[i].handEval, byToken[i + 1].handEval) <= 0;
      pairResults.push(correct);
      if (!correct) success = false;
    }

    if (success) {
      this.state.heists++;
      this.io.to(this.roomCode).emit('action_log', `🏦 BRAQUAGE RÉUSSI ! Coffres ouverts : ${this.state.heists}/3`);
    } else {
      this.state.alarms++;
      this.io.to(this.roomCode).emit('action_log', `🚨 ALARME DÉCLENCHÉE ! Alarmes : ${this.state.alarms}/3`);
    }

    const showdownResult = {
      success,
      heists: this.state.heists,
      alarms: this.state.alarms,
      communityCards: this.state.communityCards,
      playerResults: byToken.map((p, i) => ({
        name: p.name,
        tokenNumber: p.tokenNumber,
        pocketCards: p.pocketCards,
        handRank: p.handEval.rank,
        handName: getDetailedHandName(p.handEval.rank, p.handEval.tiebreaker),
        nextCorrect: i < byToken.length - 1 ? pairResults[i] : null
      }))
    };

    if (this.state.heists >= 3) {
      this.state.status = 'finished';
      showdownResult.gameOver = true;
      showdownResult.outcome = 'victory';
      showdownResult.reason = '🎉 Bravo ! Vous avez réussi 3 braquages !';
      this.io.to(this.roomCode).emit('game_over', showdownResult);
    } else if (this.state.alarms >= 3) {
      this.state.status = 'finished';
      showdownResult.gameOver = true;
      showdownResult.outcome = 'defeat';
      showdownResult.reason = '🚔 Trop d\'alarmes ! La police vous arrête.';
      this.io.to(this.roomCode).emit('game_over', showdownResult);
    } else {
      this.state.showdownResult = showdownResult;
      this.state.status = 'showdown';
    }

    this.broadcastState();
  }

  handleNextHeist(socketId) {
    if (this.state.status !== 'showdown') return;
    const name = this.state.players.find(p => p.id === socketId)?.name || 'Un joueur';
    this.io.to(this.roomCode).emit('action_log', `🔫 ${name} lance le prochain braquage !`);
    this.startNewHeist(false);
  }

  broadcastState() {
    const takenTokens = {};
    this.state.players.forEach(p => {
      if (p.tokenNumber !== null) takenTokens[p.tokenNumber] = p.name;
    });
    const totalTokens = this.players.length;
    const availableTokens = [];
    for (let i = 1; i <= totalTokens; i++) {
      if (!takenTokens[i]) availableTokens.push(i);
    }

    this.state.players.forEach(player => {
      const opponents = this.state.players
        .filter(p => p.id !== player.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          tokenNumber: p.tokenNumber,
          hasValidated: this.state.validations.has(p.id),
          hasPhaseVoted: this.state.phaseVotes.has(p.id)
        }));

      this.io.to(player.id).emit('update_board_state', {
        status: this.state.status,
        phase: this.state.phase,
        heists: this.state.heists,
        alarms: this.state.alarms,
        communityCards: this.state.communityCards,
        myPocketCards: player.pocketCards,
        myTokenNumber: player.tokenNumber,
        myHasValidated: this.state.validations.has(player.id),
        myHasPhaseVoted: this.state.phaseVotes.has(player.id),
        opponents,
        availableTokens,
        takenTokens,
        totalTokens,
        validationCount: this.state.validations.size,
        phaseVoteCount: this.state.phaseVotes.size,
        allHaveTokens: this.state.players.every(p => p.tokenNumber !== null),
        showdownResult: this.state.showdownResult
      });
    });
  }

  reconnectPlayer(newSocketId, playerName) {
    if (this.state.status === 'finished') return false;
    const player = this.state.players.find(p => p.name === playerName);
    if (!player) return false;

    if (this.state.validations.has(player.id)) {
      this.state.validations.delete(player.id);
      this.state.validations.add(newSocketId);
    }
    player.id = newSocketId;
    return true;
  }
}

module.exports = TheGang;
