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
const FACE_VALUES = [11, 12, 13]; // J, Q, K

// Hand categories for the "Lecteur d'empreintes digitales" designation
const HAND_CATEGORIES = {
  1: 'Carte haute', 2: 'Paire', 3: 'Double paire', 4: 'Brelan', 5: 'Suite',
  6: 'Couleur', 7: 'Full House', 8: 'Carré', 9: 'Quinte Flush', 10: 'Quinte Flush Royale'
};

// Effraction cards, drawn after a successful heist (when enabled in the lobby).
// `conflicts` lists cards that cannot be active at the same time (cumulative mode).
const EFFRACTIONS = {
  easy_open: {
    number: 1, name: 'Ouverture facile',
    description: 'Pas de jetons blancs : après la distribution, on passe directement au Flop.',
    conflicts: ['motion_detectors', 'photo_barriers']
  },
  noise_sensors: {
    number: 2, name: 'Capteurs de bruit',
    description: "Le jeton 1 étoile est sombre du Pré-flop au Turn : une fois pris, il ne change plus de propriétaire.",
    conflicts: []
  },
  motion_detectors: {
    number: 3, name: 'Détecteurs de mouvement',
    description: 'Si au moins une carte du Flop est une tête (V, D, R), le détenteur du jeton blanc 1 étoile défausse ses cartes et en pioche de nouvelles.',
    conflicts: ['easy_open']
  },
  retina_scan: {
    number: 4, name: 'Scan rétinien',
    description: "Avant l'abattage, les autres doivent désigner ensemble le rang d'une des cartes du détenteur du jeton rouge le plus étoilé.",
    conflicts: []
  },
  hasty_escape: {
    number: 5, name: 'Fuite précipitée',
    description: 'Pas de jetons orange : après le Flop, la 4e et la 5e carte sont révélées et on passe directement à la River.',
    conflicts: []
  },
  vent_grille: {
    number: 6, name: "Grille d'aération",
    description: 'Le jeton le plus étoilé est sombre du Pré-flop au Turn : une fois pris, il ne change plus de propriétaire.',
    conflicts: []
  },
  photo_barriers: {
    number: 7, name: 'Barrières photoélectriques',
    description: "Si aucune carte du Flop n'est une tête (V, D, R), le détenteur du jeton blanc le plus étoilé défausse ses cartes et en pioche de nouvelles.",
    conflicts: ['easy_open']
  },
  power_outage: {
    number: 8, name: "Panne d'électricité",
    description: "Au début de chaque phase, tous les jetons sont défaussés et l'historique est masqué. À vous de vous en souvenir !",
    conflicts: []
  },
  fingerprint: {
    number: 9, name: "Lecteur d'empreintes digitales",
    description: "Avant l'abattage, les autres doivent désigner ensemble la combinaison du détenteur du jeton rouge le plus étoilé.",
    conflicts: []
  },
  cameras: {
    number: 10, name: 'Caméras de surveillance',
    description: 'Chacun joue avec 3 cartes personnelles au lieu de 2.',
    conflicts: []
  }
};
const EFFRACTION_MODES = ['off', 'replace', 'stack'];

const toPublicEffraction = (id) => ({
  id, number: EFFRACTIONS[id].number, name: EFFRACTIONS[id].name, description: EFFRACTIONS[id].description
});

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
  constructor(roomCode, playersData, io, options = {}) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData;
    this.hostId = playersData[0]?.id || null;
    this.oneShotMode = options.oneShotMode || false;
    this.effractionMode = EFFRACTION_MODES.includes(options.effractionMode) ? options.effractionMode : 'off';

    this.state = {
      activeEffractions: [],        // ids of active Effraction cards
      effractionVotes: new Set(),   // votes to draw an Effraction card
      effractionVoteRequired: false,
      effractionDraw: null,         // { card, replaced } once drawn
      designation: null,            // Scan rétinien / Empreintes digitales step
      status: 'playing',            // playing | designation | showdown | finished
      phase: 'preflop',
      heists: 0,
      alarms: 0,
      communityCards: [],
      deck: [],
      validations: new Set(),  // river validation votes
      phaseVotes: new Set(),   // votes to advance to next phase
      showdownResult: null,
      players: [],
      tokenHistory: [],        // [{round, playerTokenHistory}] - completed rounds
      phaseLog: {}             // {playerName: {phase: [tokenNumbers]}} - current heist
    };
  }

  start() {
    this.state.heists = 0;
    this.state.alarms = 0;
    this.state.tokenHistory = [];
    this.state.activeEffractions = [];
    this.startNewHeist(true);
  }

  has(effractionId) {
    return this.state.activeEffractions.includes(effractionId);
  }

  // Dark tokens (Effraction 2 and 6) exist from pre-flop to turn
  isDarkToken(tokenNumber) {
    if (this.state.phase === 'river') return false;
    if (this.has('noise_sensors') && tokenNumber === 1) return true;
    if (this.has('vent_grille') && tokenNumber === this.players.length) return true;
    return false;
  }

  // A dark token taken during a phase cannot change owner until the next phase
  isTokenLocked(player) {
    return player.tokenNumber !== null && this.isDarkToken(player.tokenNumber) &&
      player.darkLockPhase === this.state.phase;
  }

  startNewHeist(isFirstStart = false) {
    const deck = generateDeck();
    const pocketSize = this.has('cameras') ? 3 : 2;

    // Preserve player IDs updated through reconnections
    const currentPlayers = this.state.players.length > 0
      ? this.state.players.map(p => ({ id: p.id, name: p.name }))
      : this.players;

    this.state.players = currentPlayers.map(p => ({
      id: p.id,
      name: p.name,
      pocketCards: Array.from({ length: pocketSize }, () => deck.pop()),
      tokenNumber: null,
      darkLockPhase: null   // phase during which a dark token was taken
    }));

    this.state.deck = deck;
    this.state.phase = 'preflop';
    this.state.communityCards = [];
    this.state.validations = new Set();
    this.state.phaseVotes = new Set();
    this.state.status = 'playing';
    this.state.showdownResult = null;
    this.state.phaseLog = {}; // Reset live phase log for this new heist
    this.state.effractionVotes = new Set();
    this.state.effractionVoteRequired = false;
    this.state.effractionDraw = null;
    this.state.designation = null;

    if (isFirstStart) {
      this.io.to(this.roomCode).emit('game_started');
    }

    if (this.has('easy_open')) {
      this.io.to(this.roomCode).emit('action_log', '🔓 Ouverture facile : pas de jetons blancs, direction le Flop !');
      this._doAdvancePhase();
      return;
    }

    this.broadcastState();
  }

  // Vote to advance to next phase (cancellable until all have voted)
  handlePhaseVote(socketId) {
    if (this.state.status !== 'playing') return;
    if (PHASES.indexOf(this.state.phase) >= PHASES.length - 1) return; // At river, use validate instead
    if (!this.state.players.every(p => p.tokenNumber !== null)) return; // Tous les jetons doivent être pris

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

    // Snapshot les jetons de la phase qui se termine
    this._recordPhaseTokens(this.state.phase);

    let nextPhase = PHASES[phaseIndex + 1];

    if (nextPhase === 'flop') {
      this.state.communityCards.push(
        this.state.deck.pop(), this.state.deck.pop(), this.state.deck.pop()
      );
      this._applyFlopEffractions();
    } else if (nextPhase === 'turn' || nextPhase === 'river') {
      this.state.communityCards.push(this.state.deck.pop());
    }

    // Fuite précipitée: no orange tokens, reveal the 5th card and go straight to the river
    if (nextPhase === 'turn' && this.has('hasty_escape')) {
      this.io.to(this.roomCode).emit('action_log', '🚗 Fuite précipitée : pas de jetons orange, direction la River !');
      this.state.communityCards.push(this.state.deck.pop());
      nextPhase = 'river';
    }

    this.state.phase = nextPhase;

    // Panne d'électricité: every token is discarded at the start of a new phase
    if (this.has('power_outage')) {
      this.state.players.forEach(p => { p.tokenNumber = null; });
      this.io.to(this.roomCode).emit('action_log', "💡 Panne d'électricité : tous les jetons sont défaussés !");
    }

    // Reset both vote sets on phase change
    this.state.validations = new Set();
    this.state.phaseVotes = new Set();

    this.io.to(this.roomCode).emit('action_log', `📍 Phase suivante : ${nextPhase.toUpperCase()}`);
    this.broadcastState();
  }

  // Détecteurs de mouvement / Barrières photoélectriques, checked when the flop is revealed
  _applyFlopEffractions() {
    const hasFace = this.state.communityCards.slice(0, 3).some(c => FACE_VALUES.includes(CARD_VALUES_MAP[c.value]));
    if (this.has('motion_detectors') && hasFace) {
      this._redrawPocketCards(1, '📡 Détecteurs de mouvement');
    }
    if (this.has('photo_barriers') && !hasFace) {
      this._redrawPocketCards(this.players.length, '🔦 Barrières photoélectriques');
    }
  }

  // The holder of the given white (pre-flop) token discards their cards and draws new ones
  _redrawPocketCards(tokenNumber, label) {
    const player = this.state.players.find(p => p.tokenNumber === tokenNumber);
    if (!player) return;
    const count = player.pocketCards.length;
    player.pocketCards = Array.from({ length: count }, () => this.state.deck.pop());
    this.io.to(this.roomCode).emit('action_log', `${label} : ${player.name} défausse ses cartes et en pioche ${count} nouvelles.`);
  }

  // Returns an error message if the move breaks a dark token rule, null otherwise
  _tokenRestriction(player, tokenNumber) {
    if (this.isTokenLocked(player)) {
      return "Votre jeton est sombre : vous ne pourrez en changer qu'à la phase suivante.";
    }
    const holder = tokenNumber !== null && this.state.players.find(p => p.id !== player.id && p.tokenNumber === tokenNumber);
    if (holder && this.isTokenLocked(holder)) {
      return "Ce jeton est sombre : il ne pourra être volé qu'à la phase suivante.";
    }
    return null;
  }

  handleTakeToken(socketId, tokenNumber) {
    if (this.state.status !== 'playing') return;

    const player = this.state.players.find(p => p.id === socketId);
    if (!player) return;
    if (player.tokenNumber === tokenNumber) return; // Already has it

    const restriction = this._tokenRestriction(player, tokenNumber);
    if (restriction) return this.io.to(socketId).emit('thegang_error', restriction);

    // Release player's current token
    player.tokenNumber = null;

    // Release the target token from its current holder
    const currentHolder = this.state.players.find(p => p.tokenNumber === tokenNumber);
    if (currentHolder) {
      currentHolder.tokenNumber = null;
      currentHolder.darkLockPhase = null;
    }

    // Assign token (a dark token is locked for the rest of this phase)
    player.tokenNumber = tokenNumber;
    player.darkLockPhase = this.isDarkToken(tokenNumber) ? this.state.phase : null;

    // Reset river validations AND phase votes when tokens change
    this.state.validations = new Set();
    this.state.phaseVotes = new Set();

    this.broadcastState();
  }

  _recordPhaseTokens(phase) {
    for (const player of this.state.players) {
      if (player.tokenNumber !== null) {
        if (!this.state.phaseLog[player.name]) this.state.phaseLog[player.name] = {};
        this.state.phaseLog[player.name][phase] = [player.tokenNumber];
      }
    }
  }

  handleReleaseToken(socketId) {
    if (this.state.status !== 'playing') return;
    const player = this.state.players.find(p => p.id === socketId);
    if (!player || player.tokenNumber === null) return;

    const restriction = this._tokenRestriction(player, null);
    if (restriction) return this.io.to(socketId).emit('thegang_error', restriction);

    player.tokenNumber = null;
    player.darkLockPhase = null;
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
      if (this.has('retina_scan') || this.has('fingerprint')) {
        this._startDesignation();
      } else {
        this.resolveShowdown();
      }
    } else {
      this.broadcastState();
    }
  }

  // ── Scan rétinien / Lecteur d'empreintes digitales ──────────
  _startDesignation() {
    const target = this.state.players.find(p => p.tokenNumber === this.players.length);
    this.state.status = 'designation';
    this.state.designation = {
      targetId: target.id,
      needsRank: this.has('retina_scan'),
      needsHand: this.has('fingerprint'),
      rank: null,
      hand: null,
      validations: new Set()
    };
    this.io.to(this.roomCode).emit('action_log', `🔍 Contrôle de sécurité : désignez ce que possède ${target.name} (qui ne doit rien dire !).`);
    this.broadcastState();
  }

  handleDesignationSet(socketId, payload) {
    const d = this.state.designation;
    if (this.state.status !== 'designation' || !d || socketId === d.targetId) return;
    if (!this.state.players.some(p => p.id === socketId)) return;

    const value = Number(payload?.value);
    if (payload?.field === 'rank' && d.needsRank && value >= 2 && value <= 14) d.rank = value;
    else if (payload?.field === 'hand' && d.needsHand && HAND_CATEGORIES[value]) d.hand = value;
    else return;

    d.validations = new Set(); // Any change requires everyone to validate again
    this.broadcastState();
  }

  handleDesignationValidate(socketId) {
    const d = this.state.designation;
    if (this.state.status !== 'designation' || !d || socketId === d.targetId) return;
    if (!this.state.players.some(p => p.id === socketId)) return;
    if ((d.needsRank && d.rank === null) || (d.needsHand && d.hand === null)) return;

    d.validations.add(socketId);
    if (d.validations.size === this.state.players.length - 1) {
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

    // Extra conditions from Scan rétinien / Lecteur d'empreintes digitales
    let designation = null;
    const d = this.state.designation;
    if (d) {
      const target = playerHands.find(p => p.id === d.targetId);
      designation = { targetName: target.name };
      if (d.needsRank) {
        designation.rankGuess = VALUE_DISPLAY_SINGLE[d.rank];
        designation.rankCorrect = target.pocketCards.some(c => CARD_VALUES_MAP[c.value] === d.rank);
        if (!designation.rankCorrect) success = false;
      }
      if (d.needsHand) {
        designation.handGuess = HAND_CATEGORIES[d.hand];
        designation.actualHand = HAND_CATEGORIES[target.handEval.rank];
        designation.handCorrect = target.handEval.rank === d.hand;
        if (!designation.handCorrect) success = false;
      }
    }

    if (success) {
      this.state.heists++;
      this.io.to(this.roomCode).emit('action_log', `🏦 BRAQUAGE RÉUSSI ! Coffres ouverts : ${this.state.heists}/3`);
    } else {
      this.state.alarms++;
      this.io.to(this.roomCode).emit('action_log', `🚨 ALARME DÉCLENCHÉE ! Alarmes : ${this.state.alarms}/3`);
    }

    // Build per-player token history from the persisted phaseLog
    const roundNumber = this.state.heists + this.state.alarms;
    const PHASES_ORDER = ['preflop', 'flop', 'turn', 'river'];

    const playerTokenHistory = Object.entries(this.state.phaseLog || {}).map(([name, phases]) => ({
      name,
      phases: PHASES_ORDER
        .filter(ph => phases[ph] && phases[ph].length > 0)
        .map(ph => ({ phase: ph, tokens: phases[ph] }))
    }));

    this.state.tokenHistory.push({
      round: roundNumber,
      success,
      playerTokenHistory
    });


    const showdownResult = {
      success,
      heists: this.state.heists,
      alarms: this.state.alarms,
      communityCards: this.state.communityCards,
      designation,
      playerResults: byToken.map((p, i) => ({
        name: p.name,
        tokenNumber: p.tokenNumber,
        pocketCards: p.pocketCards,
        handRank: p.handEval.rank,
        handName: getDetailedHandName(p.handEval.rank, p.handEval.tiebreaker),
        nextCorrect: i < byToken.length - 1 ? pairResults[i] : null
      }))
    };

    if (this.oneShotMode) {
      if (!success) {
        this.state.status = 'finished';
        showdownResult.gameOver = true;
        showdownResult.outcome = 'defeat';
        showdownResult.oneShotMode = true;
        const n = this.state.heists;
        showdownResult.reason = n === 0
          ? '💥 Éliminé dès le premier braquage !'
          : `🚔 La série s'arrête ici. ${n} braquage${n > 1 ? 's' : ''} réussi${n > 1 ? 's' : ''} de suite !`;
        this.io.to(this.roomCode).emit('game_over', showdownResult);
      } else {
        this.state.showdownResult = showdownResult;
        this.state.status = 'showdown';
      }
    } else if (this.state.heists >= 3) {
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

    // After a successful heist, everyone votes to draw an Effraction card
    if (this.state.status === 'showdown' && success && this.effractionMode !== 'off') {
      this.state.effractionVoteRequired = this.getDrawableEffractions().length > 0;
      if (!this.state.effractionVoteRequired) {
        this.io.to(this.roomCode).emit('action_log', '😅 Aucune carte Effraction compatible disponible, pas de tirage cette fois.');
      }
    }

    this.broadcastState();
  }

  // ── Effraction cards ─────────────────────────────────────────
  getDrawableEffractions() {
    const all = Object.keys(EFFRACTIONS);
    if (this.effractionMode === 'replace') {
      return all.filter(id => !this.has(id));
    }
    if (this.effractionMode === 'stack') {
      return all.filter(id =>
        !this.has(id) &&
        !this.state.activeEffractions.some(active =>
          EFFRACTIONS[active].conflicts.includes(id) || EFFRACTIONS[id].conflicts.includes(active))
      );
    }
    return [];
  }

  // Each player clicks to draw the card; drawn once everyone has voted
  handleEffractionVote(socketId) {
    if (this.state.status !== 'showdown' || !this.state.effractionVoteRequired || this.state.effractionDraw) return;
    if (this.state.effractionVotes.has(socketId)) return;
    if (!this.state.players.some(p => p.id === socketId)) return;

    this.state.effractionVotes.add(socketId);
    const name = this.state.players.find(p => p.id === socketId)?.name;
    this.io.to(this.roomCode).emit('action_log', `🎲 ${name} est prêt pour la carte Effraction (${this.state.effractionVotes.size}/${this.state.players.length}).`);

    if (this.state.effractionVotes.size === this.state.players.length) {
      this._drawEffraction();
    }
    this.broadcastState();
  }

  _drawEffraction() {
    const pool = this.getDrawableEffractions();
    if (pool.length === 0) return;
    const id = pool[Math.floor(Math.random() * pool.length)];

    let replaced = null;
    if (this.effractionMode === 'replace') {
      replaced = this.state.activeEffractions[0] ?? null;
      this.state.activeEffractions = [id];
    } else {
      this.state.activeEffractions.push(id);
    }

    this.state.effractionDraw = {
      card: toPublicEffraction(id),
      replaced: replaced ? toPublicEffraction(replaced) : null
    };
    this.io.to(this.roomCode).emit('action_log',
      `🃏 Nouvelle carte Effraction : ${EFFRACTIONS[id].name}${replaced ? ` (remplace ${EFFRACTIONS[replaced].name})` : ''}`);
  }

  handleNextHeist(socketId) {
    if (this.state.status !== 'showdown') return;
    // Only the host can trigger next heist
    if (socketId !== this.hostId) return;
    if (this.state.effractionVoteRequired && !this.state.effractionDraw) return; // Card must be drawn first
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

    // Build currentHeistLog from the persisted phaseLog state
    const PHASES_ORDER = ['preflop', 'flop', 'turn', 'river'];
    // Panne d'électricité: the history of the current heist stays hidden until the showdown
    const hideHistory = this.has('power_outage') && ['playing', 'designation'].includes(this.state.status);
    const currentHeistLog = hideHistory ? [] : Object.entries(this.state.phaseLog || {}).map(([name, phases]) => ({
      name,
      phases: PHASES_ORDER
        .filter(ph => phases[ph] && phases[ph].length > 0)
        .map(ph => ({ phase: ph, tokens: phases[ph] }))
    }));

    const darkTokens = [];
    for (let i = 1; i <= totalTokens; i++) {
      if (this.isDarkToken(i)) darkTokens.push(i);
    }
    // Dark tokens taken during the current phase (cannot change owner until the next one)
    const lockedTokens = this.state.players.filter(p => this.isTokenLocked(p)).map(p => p.tokenNumber);

    const d = this.state.designation;
    const targetName = d ? this.state.players.find(p => p.id === d.targetId)?.name : null;

    this.state.players.forEach(player => {
      const opponents = this.state.players
        .filter(p => p.id !== player.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          tokenNumber: p.tokenNumber,
          hasValidated: this.state.validations.has(p.id),
          hasPhaseVoted: this.state.phaseVotes.has(p.id),
          hasEffractionVoted: this.state.effractionVotes.has(p.id),
          hasDesignationValidated: d ? d.validations.has(p.id) : false
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
        isHost: player.id === this.hostId,
        opponents,
        availableTokens,
        takenTokens,
        totalTokens,
        validationCount: this.state.validations.size,
        phaseVoteCount: this.state.phaseVotes.size,
        allHaveTokens: this.state.players.every(p => p.tokenNumber !== null),
        showdownResult: this.state.showdownResult,
        currentHeistLog,
        tokenHistory: this.state.tokenHistory,
        oneShotMode: this.oneShotMode,
        darkTokens,
        lockedTokens,
        effractionMode: this.effractionMode,
        activeEffractions: this.state.activeEffractions.map(toPublicEffraction),
        effractionVoteRequired: this.state.effractionVoteRequired,
        effractionVoteCount: this.state.effractionVotes.size,
        myHasEffractionVoted: this.state.effractionVotes.has(player.id),
        effractionDraw: this.state.effractionDraw,
        designation: d ? {
          targetName,
          isTarget: d.targetId === player.id,
          needsRank: d.needsRank,
          needsHand: d.needsHand,
          rank: d.rank,
          hand: d.hand,
          validationCount: d.validations.size,
          requiredCount: this.state.players.length - 1,
          myHasValidated: d.validations.has(player.id)
        } : null
      });
    });
  }

  reconnectPlayer(newSocketId, playerName) {
    if (this.state.status === 'finished') return false;
    const player = this.state.players.find(p => p.name === playerName);
    if (!player) return false;

    const d = this.state.designation;
    const voteSets = [this.state.validations, this.state.phaseVotes, this.state.effractionVotes];
    if (d) voteSets.push(d.validations);
    for (const votes of voteSets) {
      if (votes.has(player.id)) {
        votes.delete(player.id);
        votes.add(newSocketId);
      }
    }
    if (d && d.targetId === player.id) d.targetId = newSocketId;
    if (this.hostId === player.id) this.hostId = newSocketId;
    player.id = newSocketId;
    return true;
  }
}

TheGang.EFFRACTION_LIST = Object.keys(EFFRACTIONS).map(toPublicEffraction);

module.exports = TheGang;
