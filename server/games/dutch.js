// server/games/dutch.js
//
// « Dutch » — jeu de cartes de mémoire (2 à 8 joueurs, jeu de 52 cartes).
// Chaque joueur a 4 cartes face cachée et cherche à avoir le moins de points
// possible. On joue manche par manche : une manche = une partie.
//
// Déroulement d'un tour :
//   1. le joueur pioche une carte ;
//   2. juste après avoir pioché, il peut annoncer « Dutch » ;
//   3. il échange la carte piochée avec une de ses cartes OU la défausse
//      directement (défausser directement un Valet / une Dame déclenche son
//      pouvoir) ; le tour passe aussitôt au joueur suivant.
// Snap : à tout moment de la partie, n'importe qui peut défausser une carte de
// même valeur que le dessus de la défausse (erreur = carte de pénalité).
// Après une annonce, chaque autre joueur joue un dernier tour, puis on révèle.

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RED_SUITS = new Set(['♥', '♦']);
const RANK_LABELS = { A: 'As', J: 'Valet', Q: 'Dame', K: 'Roi' };

const HAND_SIZE = 4;
const INITIAL_PEEKS = 2;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

const cardValue = (card) => {
  if (card.rank === 'A') return 1;
  if (card.rank === 'J') return 11;
  if (card.rank === 'Q') return 12;
  if (card.rank === 'K') return RED_SUITS.has(card.suit) ? 0 : 13;
  return parseInt(card.rank, 10);
};

const cardLabel = (card) => `${RANK_LABELS[card.rank] || card.rank} ${card.suit}`;

class Dutch {
  constructor(roomCode, playersData, io, previousWins = {}) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData; // [{ id, name }]
    this.wins = { ...previousWins }; // { [name]: nombre de manches gagnées }

    this.state = {
      status: 'playing',     // 'playing' | 'finished'
      phase: 'peek',         // 'peek' | 'draw' | 'decide' | 'power' | 'reveal'
      deck: [],
      discard: [],
      players: [],           // [{ id, name, hand: (card|null)[], peeked: number[], ready }]
      currentPlayerIndex: 0,
      drawnCard: null,
      pendingPower: null,    // { type: 'jack' | 'queen' | 'queen_seen' }
      peekResult: null,      // { playerIndex, slot } — carte regardée avec la Dame
      dutchIndex: null,      // index du joueur ayant annoncé Dutch
      results: null,
    };
  }

  // ── Mise en place ──────────────────────────────────────────────
  buildDeck() {
    const deck = [];
    let seq = 0;
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `d${seq++}`, rank, suit, value: 0 });
      }
    }
    deck.forEach(c => { c.value = cardValue(c); });
    return shuffle(deck);
  }

  start() {
    const nb = this.players.length;
    if (nb < MIN_PLAYERS || nb > MAX_PLAYERS) {
      this.io.to(this.roomCode).emit('dutch_error', `Dutch se joue de ${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs (actuellement ${nb}).`);
      return;
    }

    this.state.deck = this.buildDeck();
    this.state.players = this.players.map(p => ({
      id: p.id,
      name: p.name,
      hand: this.state.deck.splice(0, HAND_SIZE),
      peeked: [],
      ready: false,
    }));
    this.state.discard = [this.state.deck.shift()];
    this.state.currentPlayerIndex = Math.floor(Math.random() * nb);

    this.io.to(this.roomCode).emit('game_started');
    this.log(`🃏 Nouvelle manche ! Chaque joueur regarde ${INITIAL_PEEKS} de ses ${HAND_SIZE} cartes.`);
    this.broadcastState();
  }

  // Conservé pour index.js : plus aucun minuteur à nettoyer.
  destroy() {}

  // ── Utilitaires ────────────────────────────────────────────────
  log(message) {
    this.io.to(this.roomCode).emit('action_log', message);
  }

  currentPlayer() {
    return this.state.players[this.state.currentPlayerIndex];
  }

  indexOfId(playerId) {
    return this.state.players.findIndex(p => p.id === playerId);
  }

  topDiscard() {
    return this.state.discard[this.state.discard.length - 1] || null;
  }

  drawFromDeck() {
    if (this.state.deck.length === 0) {
      // On remélange la défausse (sauf la carte du dessus) pour refaire une pioche.
      const top = this.state.discard.pop();
      this.state.deck = shuffle(this.state.discard);
      this.state.discard = top ? [top] : [];
      if (this.state.deck.length > 0) this.log('🔄 La pioche est vide : la défausse est remélangée.');
    }
    return this.state.deck.shift() || null;
  }

  // Valide une cible { playerId, slot } et renvoie { playerIndex, slot } ou null.
  resolveTarget(target) {
    if (!target) return null;
    const playerIndex = this.indexOfId(target.playerId);
    if (playerIndex === -1) return null;
    const slot = Number(target.slot);
    const hand = this.state.players[playerIndex].hand;
    if (!Number.isInteger(slot) || slot < 0 || slot >= hand.length || !hand[slot]) return null;
    return { playerIndex, slot };
  }

  // ── Point d'entrée des actions ─────────────────────────────────
  handleAction(socketId, actionType, payload = {}) {
    if (this.state.status !== 'playing') return;
    const playerIndex = this.indexOfId(socketId);
    if (playerIndex === -1) return;

    const isCurrent = playerIndex === this.state.currentPlayerIndex;
    const { phase } = this.state;

    switch (actionType) {
      case 'peek_initial': if (phase === 'peek') this.peekInitial(playerIndex, payload.slot); return;
      case 'ready':        if (phase === 'peek') this.setReady(playerIndex); return;
      case 'snap':         if (phase !== 'peek') this.snap(playerIndex, payload.slot); return;
    }

    if (!isCurrent) return;

    switch (actionType) {
      case 'draw':          if (phase === 'draw') this.draw(); return;
      case 'dutch':         if (phase === 'decide') this.declareDutch(); return;
      case 'swap':          if (phase === 'decide') this.swapDrawn(payload.slot); return;
      case 'discard_drawn': if (phase === 'decide') this.discardDrawn(); return;
      case 'jack_swap':     if (phase === 'power') this.jackSwap(payload.a, payload.b); return;
      case 'queen_peek':    if (phase === 'power') this.queenPeek(payload.target); return;
      case 'ack_peek':      if (phase === 'power') this.ackPeek(); return;
      case 'skip_power':    if (phase === 'power') this.skipPower(); return;
    }
  }

  // ── Phase de découverte ────────────────────────────────────────
  peekInitial(playerIndex, slot) {
    const player = this.state.players[playerIndex];
    slot = Number(slot);
    if (player.ready || player.peeked.length >= INITIAL_PEEKS) return;
    if (!Number.isInteger(slot) || slot < 0 || slot >= player.hand.length) return;
    if (player.peeked.includes(slot)) return;
    player.peeked.push(slot);
    this.broadcastState();
  }

  setReady(playerIndex) {
    const player = this.state.players[playerIndex];
    if (player.ready || player.peeked.length < INITIAL_PEEKS) return;
    player.ready = true;

    if (this.state.players.every(p => p.ready)) {
      this.state.phase = 'draw';
      this.log(`▶️ Tout le monde est prêt ! ${this.currentPlayer().name} commence.`);
    }
    this.broadcastState();
  }

  // ── Tour de jeu ────────────────────────────────────────────────
  draw() {
    const card = this.drawFromDeck();
    if (!card) return;
    this.state.drawnCard = card;
    this.state.phase = 'decide';
    this.broadcastState();
  }

  swapDrawn(slot) {
    const player = this.currentPlayer();
    slot = Number(slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= player.hand.length || !player.hand[slot]) return;

    const old = player.hand[slot];
    player.hand[slot] = this.state.drawnCard;
    this.state.drawnCard = null;
    this.state.discard.push(old);
    this.log(`🔁 ${player.name} échange une de ses cartes et défausse ${cardLabel(old)}.`);
    this.endTurn();
  }

  discardDrawn() {
    const player = this.currentPlayer();
    const card = this.state.drawnCard;
    this.state.drawnCard = null;
    this.state.discard.push(card);

    if (card.rank === 'J' || card.rank === 'Q') {
      this.state.pendingPower = { type: card.rank === 'J' ? 'jack' : 'queen' };
      this.state.phase = 'power';
      const power = card.rank === 'J' ? 'peut échanger 2 cartes' : 'peut regarder une carte';
      this.log(`🗑️ ${player.name} défausse ${cardLabel(card)} et ${power}.`);
      this.broadcastState();
      return;
    }

    this.log(`🗑️ ${player.name} défausse directement ${cardLabel(card)}.`);
    this.endTurn();
  }

  // ── Pouvoirs ───────────────────────────────────────────────────
  jackSwap(a, b) {
    if (!this.state.pendingPower || this.state.pendingPower.type !== 'jack') return;
    const ta = this.resolveTarget(a);
    const tb = this.resolveTarget(b);
    if (!ta || !tb) return;
    if (ta.playerIndex === tb.playerIndex && ta.slot === tb.slot) return;

    const pa = this.state.players[ta.playerIndex];
    const pb = this.state.players[tb.playerIndex];
    [pa.hand[ta.slot], pb.hand[tb.slot]] = [pb.hand[tb.slot], pa.hand[ta.slot]];

    const who = (p, slot) => `la carte n°${slot + 1} de ${p.name}`;
    this.log(`🔄 Valet : ${this.currentPlayer().name} échange ${who(pa, ta.slot)} avec ${who(pb, tb.slot)}.`);
    this.state.pendingPower = null;
    this.endTurn();
  }

  queenPeek(target) {
    if (!this.state.pendingPower || this.state.pendingPower.type !== 'queen') return;
    const t = this.resolveTarget(target);
    if (!t) return;
    this.state.peekResult = t;
    this.state.pendingPower = { type: 'queen_seen' };
    const owner = this.state.players[t.playerIndex];
    const whose = t.playerIndex === this.state.currentPlayerIndex ? 'une de ses cartes' : `une carte de ${owner.name}`;
    this.log(`👁️ Dame : ${this.currentPlayer().name} regarde ${whose} (n°${t.slot + 1}).`);
    this.broadcastState();
  }

  ackPeek() {
    if (!this.state.pendingPower || this.state.pendingPower.type !== 'queen_seen') return;
    this.state.peekResult = null;
    this.state.pendingPower = null;
    this.endTurn();
  }

  skipPower() {
    if (!this.state.pendingPower || this.state.pendingPower.type === 'queen_seen') return;
    this.log(`⏭️ ${this.currentPlayer().name} n'utilise pas le pouvoir.`);
    this.state.pendingPower = null;
    this.endTurn();
  }

  // ── Snap (possible à tout moment, hors découverte) ─────────────
  snap(playerIndex, slot) {
    const player = this.state.players[playerIndex];
    slot = Number(slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= player.hand.length) return;
    const card = player.hand[slot];
    const top = this.topDiscard();
    if (!card || !top) return;

    if (card.rank === top.rank) {
      player.hand[slot] = null;
      this.state.discard.push(card);
      this.log(`⚡ Snap ! ${player.name} se débarrasse de ${cardLabel(card)}.`);
    } else {
      const penalty = this.drawFromDeck();
      if (penalty) player.hand.push(penalty);
      this.log(`❌ ${player.name} tente un snap avec ${cardLabel(card)} sur ${cardLabel(top)} : carte de pénalité !`);
    }
    this.broadcastState();
  }

  // ── Dutch & fin de tour ────────────────────────────────────────
  declareDutch() {
    if (this.state.dutchIndex !== null) return;
    this.state.dutchIndex = this.state.currentPlayerIndex;
    this.log(`📣 ${this.currentPlayer().name} annonce DUTCH ! Chaque autre joueur joue un dernier tour.`);
    this.broadcastState();
  }

  endTurn() {
    if (this.state.status !== 'playing') return;

    const nb = this.state.players.length;
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % nb;

    // Le tour revient à l'annonceur : tous les autres ont joué leur dernier tour.
    if (this.state.dutchIndex !== null && this.state.currentPlayerIndex === this.state.dutchIndex) {
      return this.revealRound();
    }

    this.state.phase = 'draw';
    this.broadcastState();
  }

  revealRound() {
    const { dutchIndex } = this.state;

    const scored = this.state.players.map((p, index) => {
      const cards = p.hand.filter(Boolean);
      return {
        index,
        id: p.id,
        name: p.name,
        score: cards.reduce((sum, c) => sum + c.value, 0),
        cardCount: cards.length,
        isDeclarer: index === dutchIndex,
      };
    });

    // 1. Plus petit score.
    const minScore = Math.min(...scored.map(s => s.score));
    let contenders = scored.filter(s => s.score === minScore);
    let reason = 'Plus petit total de points.';

    // 2. Égalité : le moins de cartes l'emporte.
    if (contenders.length > 1) {
      const minCards = Math.min(...contenders.map(s => s.cardCount));
      contenders = contenders.filter(s => s.cardCount === minCards);
      reason = 'Égalité de points, départagée au nombre de cartes.';
    }

    // 3. Encore égalité : l'annonceur perd.
    if (contenders.length > 1 && contenders.some(s => s.isDeclarer)) {
      contenders = contenders.filter(s => !s.isDeclarer);
      reason = 'Égalité parfaite (points et cartes) : l\'annonceur du Dutch perd.';
    }

    const winnerIndexes = new Set(contenders.map(s => s.index));
    contenders.forEach(s => { this.wins[s.name] = (this.wins[s.name] || 0) + 1; });

    const declarer = dutchIndex !== null ? this.state.players[dutchIndex] : null;
    this.state.results = {
      reason,
      winnerNames: contenders.map(s => s.name),
      dutchName: declarer ? declarer.name : null,
      dutchSuccess: dutchIndex !== null && winnerIndexes.has(dutchIndex),
      players: scored
        .map(s => ({ ...s, isWinner: winnerIndexes.has(s.index), wins: this.wins[s.name] || 0 }))
        .sort((a, b) => a.score - b.score || a.cardCount - b.cardCount),
    };

    this.state.status = 'finished';
    this.state.phase = 'reveal';
    this.state.drawnCard = null;
    this.state.pendingPower = null;
    this.state.peekResult = null;

    const winners = this.state.results.winnerNames.join(', ');
    this.log(`🏁 Révélation ! Victoire de ${winners} avec ${minScore} point(s).`);
    if (declarer) {
      this.log(this.state.results.dutchSuccess
        ? `✅ Le Dutch de ${declarer.name} est réussi !`
        : `💥 Le Dutch de ${declarer.name} est raté !`);
    }
    this.broadcastState();
  }

  // ── Diffusion de l'état ────────────────────────────────────────
  isVisibleTo(viewerIndex, ownerIndex, slot) {
    const { status, phase, peekResult, currentPlayerIndex } = this.state;
    if (status === 'finished') return true;

    const owner = this.state.players[ownerIndex];
    if (phase === 'peek' && viewerIndex === ownerIndex && !owner.ready && owner.peeked.includes(slot)) return true;

    if (peekResult && viewerIndex === currentPlayerIndex
      && peekResult.playerIndex === ownerIndex && peekResult.slot === slot) return true;

    return false;
  }

  broadcastState() {
    const { players, currentPlayerIndex, dutchIndex, phase, status } = this.state;
    const current = this.currentPlayer();
    const top = this.topDiscard();
    const powerType = this.state.pendingPower ? this.state.pendingPower.type : null;

    players.forEach((viewer, viewerIndex) => {
      const publicPlayers = players.map((p, ownerIndex) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        isCurrent: ownerIndex === currentPlayerIndex,
        isDutch: ownerIndex === dutchIndex,
        wins: this.wins[p.name] || 0,
        cardCount: p.hand.filter(Boolean).length,
        slots: p.hand.map((card, slot) => (card
          ? { slot, card: this.isVisibleTo(viewerIndex, ownerIndex, slot) ? card : null }
          : null)),
      }));

      const isMyTurn = viewerIndex === currentPlayerIndex;
      const peek = this.state.peekResult;

      this.io.to(viewer.id).emit('dutch_state', {
        status,
        phase,
        myId: viewer.id,
        myReady: viewer.ready,
        myPeekedCount: viewer.peeked.length,
        currentPlayerId: current ? current.id : null,
        currentPlayerName: current ? current.name : null,
        isMyTurn,
        deckCount: this.state.deck.length,
        topDiscard: top,
        hasDrawn: !!this.state.drawnCard,
        drawnCard: isMyTurn ? this.state.drawnCard : null,
        powerType,
        peekTarget: isMyTurn && peek ? { playerId: players[peek.playerIndex].id, slot: peek.slot } : null,
        canSnap: status === 'playing' && phase !== 'peek' && !!top,
        dutchPlayerName: dutchIndex !== null ? players[dutchIndex].name : null,
        players: publicPlayers,
        results: this.state.results,
      });
    });
  }

  reconnectPlayer(newSocketId, playerName) {
    const player = this.state.players.find(p => p.name === playerName);
    if (!player) return false;
    player.id = newSocketId;
    return true;
  }
}

Dutch.cardValue = cardValue;
module.exports = Dutch;
