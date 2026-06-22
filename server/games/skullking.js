// server/games/skullking.js
//
// Skull King — jeu de plis avec mises.
// Périmètre : jeu de base + extensions (Kraken, Baleine blanche, Butin).
// Pas de pouvoirs avancés des pirates. 3 à 8 joueurs. Score classique.

const TOTAL_ROUNDS = 10;
const BID_TIME_MS = 20000;     // 20 s pour annoncer sa mise
const TURN_TIME_MS = 15000;    // 15 s pour jouer sa carte
const TRICK_REVEAL_MS = 3500;  // pause pour admirer le dernier pli avant le décompte
const ROUND_END_MS = 5500;     // temps de lecture des scores avant la manche suivante

// Familles de cartes numérotées. Le noir (Drapeau pirate) est l'atout.
const SUITS = ['green', 'yellow', 'purple', 'black'];
const SUIT_LABELS = {
  green: 'Perroquet',
  yellow: 'Coffre',
  purple: 'Carte au trésor',
  black: 'Drapeau pirate',
};

const PIRATE_NAMES = [
  'Rosie la Douce',
  'Will le Bandit',
  'Rascal le Flambeur',
  'Juanita Jade',
  'Harry le Géant',
];

const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Construit le paquet complet (base + extensions).
const generateDeck = (withExtensions = true) => {
  const deck = [];

  // 56 cartes numérotées : 4 familles × 1..14
  for (const suit of SUITS) {
    for (let value = 1; value <= 14; value++) {
      deck.push({ id: `num-${suit}-${value}`, type: 'number', suit, value });
    }
  }

  // 5 Fuites
  for (let i = 1; i <= 5; i++) deck.push({ id: `escape-${i}`, type: 'escape' });

  // 5 Pirates
  for (let i = 1; i <= 5; i++) {
    deck.push({ id: `pirate-${i}`, type: 'pirate', name: PIRATE_NAMES[i - 1] });
  }

  // 1 Tigresse (jouée comme pirate ou fuite, au choix)
  deck.push({ id: 'tigress', type: 'tigress' });

  // 1 Skull King
  deck.push({ id: 'skullking', type: 'skullking' });

  // 2 Sirènes
  for (let i = 1; i <= 2; i++) deck.push({ id: `mermaid-${i}`, type: 'mermaid' });

  if (withExtensions) {
    // 2 Butins
    for (let i = 1; i <= 2; i++) deck.push({ id: `loot-${i}`, type: 'loot' });
    // 1 Kraken
    deck.push({ id: 'kraken', type: 'kraken' });
    // 1 Baleine blanche
    deck.push({ id: 'whale', type: 'whale' });

    // ── Extension Skull King (cartes simples) ──
    // Cartes de couleur additionnelles : un 7, un 8 et un 0/14 par couleur.
    for (const suit of SUITS) {
      // 7 additionnel : -5 pts au gagnant si son pari est correct.
      deck.push({ id: `x-${suit}-7`, type: 'number', suit, value: 7, condScore: -5 });
      // 8 additionnel : +5 pts au gagnant si son pari est correct.
      deck.push({ id: `x-${suit}-8`, type: 'number', suit, value: 8, condScore: 5 });
      // 0/14 : la valeur (0 ou 14) est choisie au moment de jouer. Aucun bonus.
      deck.push({ id: `zf-${suit}`, type: 'number', suit, value: null, zeroFourteen: true });
    }
    // 15 joker : joué comme un 15 vert/jaune/violet.
    deck.push({ id: 'joker15', type: 'joker15' });
    // Nouvelle pirate : Mary Throne (pas de pouvoir avancé ici).
    deck.push({ id: 'pirate-6', type: 'pirate', name: 'Mary Throne' });
  }

  return deck;
};

// Le "personnage" effectif d'une carte jouée (la Tigresse dépend de son mode).
const effectiveType = (play) => {
  if (play.card.type === 'tigress') return play.tigressAsPirate ? 'pirate' : 'escape';
  return play.card.type;
};

class SkullKing {
  constructor(roomCode, playersData, io, options = {}) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData;
    this.hostId = playersData[0]?.id || null;
    this.hostName = playersData[0]?.name || null;
    this.withExtensions = options.withExtensions !== false; // activé par défaut

    // Minuteurs serveur-autoritaires
    this.bidTimer = null;
    this.turnTimer = null;
    this.advanceTimer = null;
    this.bidDeadline = null;
    this.turnDeadline = null;

    this.state = {
      status: 'waiting',          // 'playing' | 'roundEnd' | 'finished'
      phase: 'bidding',           // 'bidding' | 'playing' | 'roundEnd'
      roundNumber: 0,
      cardsThisRound: 0,
      dealerIndex: Math.floor(Math.random() * playersData.length),
      players: playersData.map(p => ({
        id: p.id,
        name: p.name,
        hand: [],
        bid: null,
        tricksWon: 0,
        roundBonus: 0,
        roundConditional: 0,
        score: 0,
      })),
      trick: [],                  // plis en cours : [{playerIndex, card, tigressAsPirate}]
      trickLeaderIndex: 0,
      currentTurnIndex: 0,
      resolving: false,           // fenêtre d'animation du pli résolu (aucune action attendue)
      lastTrick: null,            // dernier pli résolu (affichage)
      alliances: [],              // [{lootPlayerIndex, winnerIndex}] de la manche
      roundResults: null,         // récap de fin de manche
      history: [],                // [{round, perPlayer:[{name,bid,tricks,roundScore,total}]}]
    };
  }

  // ── Cycle de vie ─────────────────────────────────────────────
  start() {
    this._clearBidTimer();
    this._clearTurnTimer();
    this._clearAdvanceTimer();
    this.state.status = 'playing';
    this.state.roundNumber = 0;
    this.state.players.forEach(p => { p.score = 0; });
    this.state.history = [];
    this.io.to(this.roomCode).emit('game_started');
    this.startNextRound();
  }

  cardsForRound(roundNumber) {
    const deckSize = generateDeck(this.withExtensions).length;
    const maxEqual = Math.floor(deckSize / this.state.players.length);
    return Math.min(roundNumber, maxEqual);
  }

  startNextRound() {
    this._clearAdvanceTimer();
    this.state.roundNumber += 1;
    const r = this.state.roundNumber;
    const n = this.state.players.length;
    const cards = this.cardsForRound(r);
    this.state.cardsThisRound = cards;

    const deck = shuffle(generateDeck(this.withExtensions));
    this.state.players.forEach(p => {
      p.hand = deck.splice(0, cards);
      p.bid = null;
      p.tricksWon = 0;
      p.roundBonus = 0;
      p.roundConditional = 0;
    });

    this.state.phase = 'bidding';
    this.state.status = 'playing';
    this.state.trick = [];
    this.state.resolving = false;
    this.state.lastTrick = null;
    this.state.alliances = [];
    this.state.roundResults = null;

    // Le donneur change chaque manche ; le joueur à sa gauche entame.
    this.state.dealerIndex = (this.state.dealerIndex + 1) % n;
    this.state.trickLeaderIndex = (this.state.dealerIndex + 1) % n;
    this.state.currentTurnIndex = this.state.trickLeaderIndex;

    this.io.to(this.roomCode).emit('action_log',
      `🃏 Manche ${r}/${TOTAL_ROUNDS} — ${cards} carte${cards > 1 ? 's' : ''} distribuée${cards > 1 ? 's' : ''}. Faites vos mises !`);
    this._startBidTimer();
    this.broadcastState();
  }

  // ── Minuteurs ────────────────────────────────────────────────
  _clearBidTimer() {
    if (this.bidTimer) { clearTimeout(this.bidTimer); this.bidTimer = null; }
    this.bidDeadline = null;
  }
  _clearTurnTimer() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    this.turnDeadline = null;
  }
  _clearAdvanceTimer() {
    if (this.advanceTimer) { clearTimeout(this.advanceTimer); this.advanceTimer = null; }
  }
  _startBidTimer() {
    this._clearBidTimer();
    this.bidDeadline = Date.now() + BID_TIME_MS;
    this.bidTimer = setTimeout(() => this._onBidTimeout(), BID_TIME_MS);
  }
  _startTurnTimer() {
    this._clearTurnTimer();
    this.turnDeadline = Date.now() + TURN_TIME_MS;
    this.turnTimer = setTimeout(() => this._onTurnTimeout(), TURN_TIME_MS);
  }

  // Mise par défaut (0) pour les joueurs qui n'ont pas misé à temps.
  _onBidTimeout() {
    if (this.state.status !== 'playing' || this.state.phase !== 'bidding') return;
    this.state.players.forEach(p => {
      if (p.bid === null) {
        p.bid = 0;
        this.io.to(this.roomCode).emit('action_log', `⏱️ ${p.name} n'a pas misé : mise automatique à 0.`);
      }
    });
    this._finishBidding();
  }

  // Carte légale aléatoire pour le joueur qui n'a pas joué à temps.
  _onTurnTimeout() {
    if (this.state.status !== 'playing' || this.state.phase !== 'playing') return;
    const player = this.state.players[this.state.currentTurnIndex];
    if (!player) return;
    const legal = this.legalCardIds(player);
    if (legal.length === 0) return;
    const cardId = legal[Math.floor(Math.random() * legal.length)];
    const card = player.hand.find(c => c.id === cardId);
    const tigressAsPirate = card && card.type === 'tigress' ? Math.random() < 0.5 : undefined;
    this.io.to(this.roomCode).emit('action_log', `⏱️ ${player.name} n'a pas joué à temps : carte aléatoire.`);
    this.handlePlayCard(player.id, cardId, tigressAsPirate);
  }

  _finishBidding() {
    this._clearBidTimer();
    this.state.phase = 'playing';
    const recap = this.state.players.map(p => `${p.name}: ${p.bid}`).join(' · ');
    this.io.to(this.roomCode).emit('action_log', `🎯 Mises révélées — ${recap}`);
    this._startTurnTimer();
    this.broadcastState();
  }

  // ── Mises ────────────────────────────────────────────────────
  handleBid(socketId, bid) {
    if (this.state.status !== 'playing' || this.state.phase !== 'bidding') return;
    const player = this.state.players.find(p => p.id === socketId);
    if (!player) return;

    const b = parseInt(bid, 10);
    if (isNaN(b) || b < 0 || b > this.state.cardsThisRound) return;

    player.bid = b;

    if (this.state.players.every(p => p.bid !== null)) {
      this._finishBidding();
    } else {
      this.broadcastState();
    }
  }

  // Permet de changer sa mise tant que tout le monde n'a pas misé.
  handleCancelBid(socketId) {
    if (this.state.status !== 'playing' || this.state.phase !== 'bidding') return;
    const player = this.state.players.find(p => p.id === socketId);
    if (!player) return;
    player.bid = null;
    this.broadcastState();
  }

  // ── Détermine la couleur à suivre dans le pli courant ─────────
  getLeadSuit() {
    for (const play of this.state.trick) {
      if (play.card.type === 'number') return play.card.suit;
    }
    return null;
  }

  // Liste des ids de cartes jouables pour un joueur donné (selon "suivre la couleur").
  legalCardIds(player) {
    const leadSuit = this.getLeadSuit();
    if (!leadSuit) return player.hand.map(c => c.id);

    const hasLeadSuit = player.hand.some(c => c.type === 'number' && c.suit === leadSuit);
    if (!hasLeadSuit) return player.hand.map(c => c.id);

    // Doit suivre : cartes numérotées de la couleur + toutes les cartes spéciales.
    return player.hand
      .filter(c => c.type !== 'number' || c.suit === leadSuit)
      .map(c => c.id);
  }

  // ── Jouer une carte ──────────────────────────────────────────
  handlePlayCard(socketId, cardId, opts = {}) {
    if (this.state.status !== 'playing' || this.state.phase !== 'playing') return;
    const playerIndex = this.state.players.findIndex(p => p.id === socketId);
    if (playerIndex === -1) return;
    if (playerIndex !== this.state.currentTurnIndex) return; // pas son tour

    const player = this.state.players[playerIndex];
    const card = player.hand.find(c => c.id === cardId);
    if (!card) return;

    if (!this.legalCardIds(player).includes(cardId)) return; // doit suivre la couleur

    // Le joueur a agi : on stoppe le minuteur du tour.
    this._clearTurnTimer();

    // Retire la carte de la main.
    player.hand = player.hand.filter(c => c.id !== cardId);

    // Nouveau pli ? on efface le précédent affiché.
    if (this.state.trick.length === 0) this.state.lastTrick = null;

    // Résout les choix liés à certaines cartes.
    let playedCard = card;
    let tigressAsPirate = null;
    if (card.type === 'tigress') {
      tigressAsPirate = !!opts.tigressAsPirate;
    } else if (card.type === 'number' && card.zeroFourteen) {
      // 0/14 : valeur choisie au moment de jouer.
      const v = opts.zeroFourteenValue === 14 ? 14 : 0;
      playedCard = { ...card, value: v };
    } else if (card.type === 'joker15') {
      // 15 joker : devient un 15 d'une couleur (jamais noir).
      const lead = this.getLeadSuit();
      const chosen = ['green', 'yellow', 'purple'].includes(opts.jokerColor) ? opts.jokerColor : 'green';
      const suit = (lead && lead !== 'black') ? lead : chosen;
      playedCard = { id: card.id, type: 'number', suit, value: 15, joker: true };
    }

    this.state.trick.push({
      playerIndex,
      card: playedCard,
      tigressAsPirate,
    });

    if (this.state.trick.length === this.state.players.length) {
      this.resolveTrick();
    } else {
      this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % this.state.players.length;
      this._startTurnTimer();
      this.broadcastState();
    }
  }

  // Résolution "normale" (sans kraken/baleine). Renvoie l'index gagnant dans `plays`.
  _resolveNormal(plays) {
    let skIdx = -1;
    const pirateIdxs = [];
    const mermaidIdxs = [];

    plays.forEach((p, i) => {
      const t = effectiveType(p);
      if (t === 'skullking') skIdx = i;
      else if (t === 'pirate') pirateIdxs.push(i);
      else if (t === 'mermaid') mermaidIdxs.push(i);
    });

    const hasCharacter = skIdx !== -1 || pirateIdxs.length || mermaidIdxs.length;
    if (hasCharacter) {
      // Cycle : Skull King > Pirates > Sirènes > Skull King.
      // Cas explicite : Pirate + Skull King + Sirène ⇒ la sirène gagne.
      if (skIdx !== -1 && mermaidIdxs.length) return mermaidIdxs[0];
      if (skIdx !== -1) return skIdx;
      if (pirateIdxs.length) return pirateIdxs[0];
      return mermaidIdxs[0];
    }

    // Uniquement des cartes numérotées et/ou fuites/butins/tigresse-fuite.
    const numberIdxs = plays
      .map((p, i) => (p.card.type === 'number' ? i : -1))
      .filter(i => i !== -1);

    if (numberIdxs.length === 0) return 0; // tout en fuite → 1ʳᵉ carte jouée gagne

    const leadSuit = plays[numberIdxs[0]].card.suit;
    const blackIdxs = numberIdxs.filter(i => plays[i].card.suit === 'black');
    const candidates = blackIdxs.length
      ? blackIdxs
      : numberIdxs.filter(i => plays[i].card.suit === leadSuit);

    let best = candidates[0];
    for (const i of candidates) {
      if (plays[i].card.value > plays[best].card.value) best = i;
    }
    return best;
  }

  // Résout le pli complet (gère kraken / baleine). Renvoie
  // { destroyed, winnerIndex, leadNextIndex } en index *joueur*.
  _resolveTrickPlays(plays) {
    const krakenPos = plays.findIndex(p => p.card.type === 'kraken');
    const whalePos = plays.findIndex(p => p.card.type === 'whale');

    let effect = null;
    if (krakenPos !== -1 && whalePos !== -1) {
      effect = krakenPos > whalePos ? 'kraken' : 'whale'; // la 2ᵉ jouée l'emporte
    } else if (krakenPos !== -1) effect = 'kraken';
    else if (whalePos !== -1) effect = 'whale';

    if (effect === 'kraken') {
      // Pli détruit ; le joueur qui aurait gagné entame le suivant.
      const sub = plays.filter(p => p.card.type !== 'kraken' && p.card.type !== 'whale');
      let leadNextIndex;
      if (sub.length === 0) {
        leadNextIndex = plays[krakenPos].playerIndex;
      } else {
        const w = this._resolveNormal(sub);
        leadNextIndex = sub[w].playerIndex;
      }
      return { destroyed: true, winnerIndex: -1, leadNextIndex };
    }

    if (effect === 'whale') {
      // Cartes spéciales détruites ; les numéros comptent par valeur, couleur ignorée.
      const numberIdxs = plays
        .map((p, i) => (p.card.type === 'number' ? i : -1))
        .filter(i => i !== -1);
      if (numberIdxs.length === 0) {
        return { destroyed: true, winnerIndex: -1, leadNextIndex: plays[whalePos].playerIndex };
      }
      let best = numberIdxs[0];
      for (const i of numberIdxs) {
        if (plays[i].card.value > plays[best].card.value) best = i; // égalité → 1ʳᵉ jouée
      }
      return { destroyed: false, winnerIndex: best, leadNextIndex: plays[best].playerIndex };
    }

    const w = this._resolveNormal(plays);
    return { destroyed: false, winnerIndex: w, leadNextIndex: plays[w].playerIndex };
  }

  // Points bonus capturés par le gagnant d'un pli.
  _computeBonus(plays, winnerLocalIdx) {
    const winnerPlay = plays[winnerLocalIdx];
    const winnerType = effectiveType(winnerPlay);
    let bonus = 0;
    const details = [];

    // 14 capturés (la carte 0/14 ne rapporte aucun bonus)
    for (const p of plays) {
      if (p.card.type === 'number' && p.card.value === 14 && !p.card.zeroFourteen) {
        const pts = p.card.suit === 'black' ? 20 : 10;
        bonus += pts;
        details.push(`+${pts} (14 ${SUIT_LABELS[p.card.suit]})`);
      }
    }

    // Captures de personnages
    const mermaidCount = plays.filter(p => effectiveType(p) === 'mermaid').length;
    const pirateCount = plays.filter(p => effectiveType(p) === 'pirate').length;
    const hasSK = plays.some(p => effectiveType(p) === 'skullking');

    if (winnerType === 'pirate' && mermaidCount > 0) {
      bonus += 20 * mermaidCount;
      details.push(`+${20 * mermaidCount} (sirène capturée)`);
    }
    if (winnerType === 'skullking' && pirateCount > 0) {
      bonus += 30 * pirateCount;
      details.push(`+${30 * pirateCount} (pirate capturé)`);
    }
    if (winnerType === 'mermaid' && hasSK) {
      bonus += 40;
      details.push('+40 (Skull King capturé)');
    }

    return { bonus, details };
  }

  resolveTrick() {
    const plays = this.state.trick;
    const result = this._resolveTrickPlays(plays);
    const n = this.state.players.length;

    let winnerPlayerIndex = -1;
    let bonusInfo = { bonus: 0, details: [] };

    if (!result.destroyed) {
      const winnerPlay = plays[result.winnerIndex];
      winnerPlayerIndex = winnerPlay.playerIndex;
      const winner = this.state.players[winnerPlayerIndex];
      winner.tricksWon += 1;

      bonusInfo = this._computeBonus(plays, result.winnerIndex);
      winner.roundBonus += bonusInfo.bonus;

      // Cartes 7/8 additionnelles : ±5 au gagnant (appliqué en fin de manche si le pari est juste).
      for (const pl of plays) {
        if (pl.card.condScore) winner.roundConditional += pl.card.condScore;
      }

      // Alliances Butin : le joueur du butin s'allie au gagnant (sauf s'il gagne lui-même).
      plays.forEach(p => {
        if (p.card.type === 'loot' && p.playerIndex !== winnerPlayerIndex) {
          this.state.alliances.push({ lootPlayerIndex: p.playerIndex, winnerIndex: winnerPlayerIndex });
        }
      });

      this.io.to(this.roomCode).emit('action_log',
        `🏴‍☠️ ${winner.name} remporte le pli${bonusInfo.bonus ? ` (${bonusInfo.details.join(', ')})` : ''}.`);
    } else {
      this.io.to(this.roomCode).emit('action_log',
        `🐙 Le pli est détruit ! Personne ne le remporte.`);
    }

    // Mémorise le pli résolu pour l'affichage.
    this.state.lastTrick = {
      plays: plays.map(p => ({
        name: this.state.players[p.playerIndex].name,
        card: p.card,
        tigressAsPirate: p.tigressAsPirate,
      })),
      winnerName: winnerPlayerIndex >= 0 ? this.state.players[winnerPlayerIndex].name : null,
      destroyed: result.destroyed,
      bonusDetails: bonusInfo.details,
    };

    this.state.trick = [];

    // Fin de manche ? On laisse le temps d'admirer le dernier pli avant le décompte.
    const handsEmpty = this.state.players.every(p => p.hand.length === 0);
    if (handsEmpty) {
      this._clearTurnTimer();
      this.state.resolving = true;
      this.broadcastState();
      this.advanceTimer = setTimeout(() => this.endRound(), TRICK_REVEAL_MS);
      return;
    }

    // Le gagnant (ou le "qui aurait gagné") entame le pli suivant.
    this.state.trickLeaderIndex = result.leadNextIndex % n;
    this.state.currentTurnIndex = this.state.trickLeaderIndex;
    this._startTurnTimer();
    this.broadcastState();
  }

  // ── Fin de manche : score classique ──────────────────────────
  endRound() {
    this._clearTurnTimer();
    this._clearAdvanceTimer();
    this.state.resolving = false;
    const cards = this.state.cardsThisRound;

    // Bornes de mise réussie (pour les alliances Butin).
    const bidExact = {};

    const perPlayer = this.state.players.map((p, idx) => {
      let bidScore = 0;
      const exact = p.tricksWon === p.bid;
      bidExact[idx] = exact;

      if (p.bid === 0) {
        bidScore = exact ? 10 * cards : -10 * cards;
      } else {
        bidScore = exact ? 20 * p.bid : -10 * Math.abs(p.tricksWon - p.bid);
      }

      // Cartes 7/8 additionnelles : ±5 uniquement si le pari est exact.
      const conditional = exact ? p.roundConditional : 0;

      return {
        index: idx,
        name: p.name,
        bid: p.bid,
        tricks: p.tricksWon,
        bidScore,
        bonus: p.roundBonus,
        conditional,
        allianceBonus: 0,
      };
    });

    // Bonus d'alliance Butin : les deux alliés doivent avoir misé juste.
    for (const a of this.state.alliances) {
      if (bidExact[a.lootPlayerIndex] && bidExact[a.winnerIndex]) {
        perPlayer[a.lootPlayerIndex].allianceBonus += 20;
        perPlayer[a.winnerIndex].allianceBonus += 20;
      }
    }

    perPlayer.forEach(pp => {
      const roundScore = pp.bidScore + pp.bonus + pp.allianceBonus + (pp.conditional || 0);
      pp.roundScore = roundScore;
      this.state.players[pp.index].score += roundScore;
      pp.total = this.state.players[pp.index].score;
    });

    this.state.history.push({ round: this.state.roundNumber, perPlayer });
    this.state.roundResults = {
      round: this.state.roundNumber,
      cards,
      perPlayer,
    };

    if (this.state.roundNumber >= TOTAL_ROUNDS) {
      this.state.status = 'finished';
      this.state.phase = 'finished';
      const ranking = [...this.state.players].sort((a, b) => b.score - a.score);
      this.io.to(this.roomCode).emit('action_log',
        `👑 Fin de partie ! Capitaine des Sept Mers : ${ranking[0].name} (${ranking[0].score} pts).`);
    } else {
      this.state.status = 'roundEnd';
      this.state.phase = 'roundEnd';
      // Enchaînement automatique de la manche suivante.
      this.advanceTimer = setTimeout(() => this.startNextRound(), ROUND_END_MS);
    }
    this.broadcastState();
  }

  // ── Diffusion de l'état (personnalisé par joueur) ─────────────
  broadcastState() {
    const leadSuit = this.getLeadSuit();
    const n = this.state.players.length;

    const publicPlayers = this.state.players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      tricksWon: p.tricksWon,
      handCount: p.hand.length,
      hasBid: p.bid !== null,
      // La mise n'est révélée qu'une fois la phase de jeu commencée.
      bid: this.state.phase !== 'bidding' ? p.bid : null,
      isDealer: idx === this.state.dealerIndex,
      isCurrentTurn: this.state.phase === 'playing' && idx === this.state.currentTurnIndex,
      isLeader: idx === this.state.trickLeaderIndex,
    }));

    const trickView = this.state.trick.map(pl => ({
      name: this.state.players[pl.playerIndex].name,
      playerId: this.state.players[pl.playerIndex].id,
      card: pl.card,
      tigressAsPirate: pl.tigressAsPirate,
    }));

    const currentTurnName = this.state.phase === 'playing' && !this.state.resolving
      ? this.state.players[this.state.currentTurnIndex]?.name
      : null;

    // Minuteur courant (temps restant calculé au moment de la diffusion).
    let timer = null;
    if (this.state.phase === 'bidding' && this.bidDeadline) {
      timer = { type: 'bid', remainingMs: Math.max(0, this.bidDeadline - Date.now()), totalMs: BID_TIME_MS };
    } else if (this.state.phase === 'playing' && this.turnDeadline) {
      timer = { type: 'turn', remainingMs: Math.max(0, this.turnDeadline - Date.now()), totalMs: TURN_TIME_MS };
    }

    this.state.players.forEach((player) => {
      const legal = this.state.phase === 'playing' ? this.legalCardIds(player) : [];

      this.io.to(player.id).emit('skullking_state', {
        status: this.state.status,
        phase: this.state.phase,
        roundNumber: this.state.roundNumber,
        totalRounds: TOTAL_ROUNDS,
        cardsThisRound: this.state.cardsThisRound,
        isHost: player.id === this.hostId,

        myHand: player.hand,
        myBid: player.bid,
        myTricksWon: player.tricksWon,
        myScore: player.score,
        legalCardIds: legal,
        resolving: this.state.resolving,
        isMyTurn: this.state.phase === 'playing' && !this.state.resolving
          && this.state.players[this.state.currentTurnIndex]?.id === player.id,

        players: publicPlayers,
        trick: trickView,
        leadSuit,
        currentTurnName,
        lastTrick: this.state.lastTrick,
        roundResults: this.state.roundResults,
        history: this.state.history,
        withExtensions: this.withExtensions,
        timer,
      });
    });
  }

  // ── Reconnexion (par pseudo, comme les autres jeux) ──────────
  reconnectPlayer(newSocketId, playerName) {
    if (this.state.status === 'finished') return false;
    const player = this.state.players.find(p => p.name === playerName);
    if (!player) return false;
    player.id = newSocketId;
    // Met à jour l'identifiant de l'hôte si c'est lui qui se reconnecte.
    if (this.hostName === playerName) this.hostId = newSocketId;
    return true;
  }
}

module.exports = SkullKing;
