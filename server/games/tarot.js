// server/games/tarot.js
// Tarot Français à 3, 4 ou 5 joueurs (règle officielle FFT — jeu de base).
// Le preneur (déclarant) joue seul contre les défenseurs (à 5 : un partenaire appelé par un Roi).
// Enchères : Passe / Petite / Garde / Garde Sans / Garde Contre.
// Chien + Écart, Petit au Bout, Poignée, Chelem.
// Hors périmètre volontaire : tournois duplicate.

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
// couleurs : As(01) … 10, Valet(V), Cavalier(C), Dame(D), Roi(R)
const SUIT_RANKS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', 'V', 'C', 'D', 'R'];
const SUIT_ORDER = Object.fromEntries(SUIT_RANKS.map((r, i) => [r, i])); // force croissante à la couleur

const TRICK_PAUSE_MS = 3000;   // délai avant de ramasser un pli complet
const REVIEW_MAX_MS = 30000;   // relâche un joueur qui "regarde le dernier pli" au bout de 30 s

// Contrats (enchères) par ordre croissant + multiplicateur de marque
const CONTRACTS = ['petite', 'garde', 'garde_sans', 'garde_contre'];
const CONTRACT_MULT = { petite: 1, garde: 2, garde_sans: 4, garde_contre: 6 };
const CONTRACT_LABEL = {
  petite: 'Petite', garde: 'Garde', garde_sans: 'Garde Sans', garde_contre: 'Garde Contre',
};
// Seuil de points à réaliser selon le nombre d'Oudlers (Bouts) du preneur
const TARGET_BY_OUDLERS = { 0: 56, 1: 51, 2: 41, 3: 36 };

// Distribution et poignées selon le nombre de joueurs
const DEAL = {
  3: { hand: 24, chien: 6, packet: 4 },
  4: { hand: 18, chien: 6, packet: 3 },
  5: { hand: 15, chien: 3, packet: 3 },
};
const POIGNEE_BY_N = {
  3: { simple: { count: 13, bonus: 20 }, double: { count: 15, bonus: 30 }, triple: { count: 18, bonus: 40 } },
  4: { simple: { count: 10, bonus: 20 }, double: { count: 13, bonus: 30 }, triple: { count: 15, bonus: 40 } },
  5: { simple: { count: 8, bonus: 20 }, double: { count: 10, bonus: 30 }, triple: { count: 13, bonus: 40 } },
};

const SUIT_SYM = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const VAL_FR = { '01': 'As', V: 'Valet', C: 'Cavalier', D: 'Dame', R: 'Roi' };

const isTrump = (c) => c.suit === 'trump';
const isExcuse = (c) => c.suit === 'excuse';
const isOudler = (c) => isExcuse(c) || (isTrump(c) && (c.value === '01' || c.value === '21'));
const isKing = (c) => !isTrump(c) && !isExcuse(c) && c.value === 'R';

const cardId = (c) => `${c.suit}_${c.value}`;

function cardPoints(c) {
  if (isOudler(c)) return 4.5;
  if (isTrump(c) || isExcuse(c)) return 0.5;
  if (c.value === 'R') return 4.5;
  if (c.value === 'D') return 3.5;
  if (c.value === 'C') return 2.5;
  if (c.value === 'V') return 1.5;
  return 0.5;
}

// Force d'une carte pour départager un pli. L'Excuse ne remporte jamais (sauf chelem, géré à part).
function cardStrength(card, leadSuit) {
  if (isExcuse(card)) return -1;
  if (isTrump(card)) return 300 + parseInt(card.value, 10);
  if (card.suit === leadSuit) return 100 + SUIT_ORDER[card.value];
  return 0;
}

function frCard(c) {
  if (isExcuse(c)) return 'Excuse';
  if (isTrump(c)) return `Atout ${parseInt(c.value, 10)}`;
  const v = VAL_FR[c.value] || String(parseInt(c.value, 10));
  return `${v}${SUIT_SYM[c.suit]}`;
}

function buildDeck() {
  const d = [];
  for (const s of SUITS) for (const v of SUIT_RANKS) d.push({ suit: s, value: v });
  for (let n = 1; n <= 21; n++) d.push({ suit: 'trump', value: String(n).padStart(2, '0') });
  d.push({ suit: 'excuse', value: 'exc' });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Ordre d'affichage de la main : atouts (fort→faible), puis chaque couleur (Roi→As), Excuse en fin.
const HAND_SUIT_ORDER = ['spades', 'hearts', 'clubs', 'diamonds'];
function sortHand(hand) {
  return hand.slice().sort((a, b) => {
    const grp = (c) => (isExcuse(c) ? 3 : isTrump(c) ? 0 : 1);
    const ga = grp(a), gb = grp(b);
    if (ga !== gb) return ga - gb;
    if (isTrump(a) && isTrump(b)) return parseInt(b.value, 10) - parseInt(a.value, 10); // fort → faible
    if (!isTrump(a) && !isExcuse(a)) {
      if (a.suit !== b.suit) return HAND_SUIT_ORDER.indexOf(a.suit) - HAND_SUIT_ORDER.indexOf(b.suit);
      return SUIT_ORDER[b.value] - SUIT_ORDER[a.value]; // Roi → As
    }
    return 0;
  });
}

class Tarot {
  constructor(roomCode, playersData, io, options = {}) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData.map((p, i) => ({ id: p.id, name: p.name, seat: i }));
    this.N = this.players.length; // 3, 4 ou 5
    this.deal = DEAL[this.N] || DEAL[4];
    this.poigneeDefs = POIGNEE_BY_N[this.N] || POIGNEE_BY_N[4];
    this.tricksTotal = this.deal.hand; // 24 / 18 / 15
    this.hostName = options.hostName || playersData[0].name;

    // Format de partie
    this.scoreMode = ['fixed', 'endless', 'single', 'target'].includes(options.scoreMode) ? options.scoreMode : 'fixed';
    this.totalDeals = Number.isFinite(options.totalDeals) ? Math.max(1, Math.min(50, options.totalDeals)) : (this.N * 2);
    // Objectif de points (mode 'target') : la partie s'arrête dès qu'un joueur l'atteint.
    this.targetScore = this.scoreMode === 'target'
      ? Math.max(50, Math.min(5000, Number.isFinite(options.targetScore) ? Math.round(options.targetScore) : 500))
      : null;
    this.allowSlam = options.allowSlam !== false;
    this.allowHandful = options.allowHandful !== false;

    this.scores = new Array(this.N).fill(0); // score individuel cumulé par siège
    this.history = [];
    this.dealerSeat = Math.floor(Math.random() * this.N);
    this.handNumber = 0;
    this._reviewers = new Map();
    this.state = { status: 'waiting' };
  }

  _next(seat) { return (seat + 1) % this.N; }
  _allSeats() { return Array.from({ length: this.N }, (_, i) => i); }

  // ---------- utilitaires ----------
  seatOf(id) { const p = this.players.find((p) => p.id === id); return p ? p.seat : -1; }
  nameOf(seat) { return this.players[seat] ? this.players[seat].name : '?'; }
  isHostSeat(seat) { return this.players[seat] && this.players[seat].name === this.hostName; }
  log(msg) { this.io.to(this.roomCode).emit('action_log', msg); }
  _reviewerNames() { return [...this._reviewers.keys()].map((seat) => this.nameOf(seat)); }
  _clearReviewers() { for (const t of this._reviewers.values()) clearTimeout(t); this._reviewers.clear(); }

  start() {
    this.io.to(this.roomCode).emit('game_started');
    this._beginHand();
  }

  _beginHand(sameNumber = false) {
    this._clearReviewers();
    if (this.handNumber > 0) this.dealerSeat = this._next(this.dealerSeat);
    if (!sameNumber) this.handNumber++;

    this.state = {
      status: 'bidding',
      phase: 'bidding',
      hands: Array.from({ length: this.N }, () => []),
      chien: [],
      turnSeat: this._next(this.dealerSeat),
      bids: new Array(this.N).fill(null),
      bidsCount: 0,
      takerSeat: null,
      contract: null,
      chienRevealed: false,
      needEcart: false,
      ecart: [],
      slam: null,
      poignees: [],
      // Appel du Roi (à 5 joueurs)
      calledCard: null,
      partnerSeat: null,
      partnerRevealed: false,
      calledCardPlayed: false,
      // jeu de la carte
      turnStartSeat: null,
      currentTrick: [],
      leadSuit: null,
      trickCount: 0,
      trickPiles: [],
      tricksWon: new Array(this.N).fill(0),
      firstCardPlayed: new Array(this.N).fill(false),
      lastTrick: null,
      resolving: false,
      handResult: null,
      matchOver: false,
    };

    this._deal();
    this.log(`🃏 Donne ${this.handNumber} — ${this.nameOf(this.dealerSeat)} distribue.`);
    this.broadcastState();
  }

  _deal() {
    const s = this.state;
    const deck = buildDeck();
    const { hand: handSize, chien: chienSize, packet } = this.deal;
    const hands = Array.from({ length: this.N }, () => []);
    const chien = [];
    const seq = this._allSeats().map((k) => (this.dealerSeat + 1 + k) % this.N);
    const totalPackets = (this.N * handSize) / packet;
    // Répartir les cartes du Chien entre les paquets (jamais au 1er ni au dernier).
    const chienAfter = new Set();
    const step = Math.max(1, Math.floor(totalPackets / (chienSize + 1)));
    for (let k = 1; k <= chienSize; k++) chienAfter.add(k * step);

    let i = 0;
    for (let p = 0; p < totalPackets; p++) {
      const seat = seq[p % this.N];
      for (let k = 0; k < packet; k++) hands[seat].push(deck[i++]);
      if (chien.length < chienSize && chienAfter.has(p)) chien.push(deck[i++]);
    }
    while (chien.length < chienSize && i < deck.length) chien.push(deck[i++]);
    s.hands = hands;
    s.chien = chien;

    // Petit sec : le Petit (atout 1) seul atout, sans Excuse → donne annulée.
    for (let seat = 0; seat < this.N; seat++) {
      const h = s.hands[seat];
      const trumps = h.filter(isTrump);
      const hasExcuse = h.some(isExcuse);
      if (!hasExcuse && trumps.length === 1 && trumps[0].value === '01') {
        this.log(`♻️ Petit sec chez ${this.nameOf(seat)} — donne annulée, on redonne.`);
        setTimeout(() => this._beginHand(true), 300);
        return;
      }
    }
  }

  // ---------- actions ----------
  handleAction(playerId, type, payload = {}) {
    const seat = this.seatOf(playerId);
    if (seat === -1) return;
    const s = this.state;

    if (type === 'bid' && s.status === 'bidding' && seat === s.turnSeat) {
      return this._handleBid(seat, payload.contract);
    }

    if (type === 'call_king' && s.status === 'calling' && seat === s.takerSeat) {
      return this._handleCall(seat, payload.suit);
    }

    if (type === 'declare_slam' && s.status === 'ecart' && seat === s.takerSeat) {
      if (this.allowSlam) { s.slam = { seat }; this.log(`🏆 ${this.nameOf(seat)} annonce un CHELEM !`); this.broadcastState(); }
      return;
    }
    if (type === 'cancel_slam' && s.status === 'ecart' && seat === s.takerSeat) {
      s.slam = null; this.broadcastState(); return;
    }

    if (type === 'ecart' && s.status === 'ecart' && s.needEcart && seat === s.takerSeat) {
      return this._handleEcart(seat, payload.cardIds || []);
    }
    if (type === 'start_play' && s.status === 'ecart' && !s.needEcart && seat === s.takerSeat) {
      return this._startPlay();
    }

    if (type === 'declare_poignee' && s.status === 'playing') {
      return this._handlePoignee(seat, payload.kind);
    }
    if (type === 'skip_poignee' && s.status === 'playing') return;

    if (type === 'review') {
      if (s.status !== 'playing') return;
      const canOpen = payload.open && s.lastTrick && s.currentTrick.length === 0;
      const old = this._reviewers.get(seat);
      if (old) clearTimeout(old);
      this._reviewers.delete(seat);
      if (canOpen) {
        this._reviewers.set(seat, setTimeout(() => { this._reviewers.delete(seat); this.broadcastState(); }, REVIEW_MAX_MS));
      }
      this.broadcastState();
      return;
    }

    if (type === 'play_card' && s.status === 'playing' && !s.resolving && seat === s.turnSeat) {
      return this._handlePlayCard(seat, playerId, payload.cardId);
    }

    if (type === 'next_hand' && s.status === 'hand_over' && this.isHostSeat(seat)) {
      if (s.matchOver) { this._finish(); return; }
      this._beginHand();
      return;
    }

    if (type === 'end_match' && this.isHostSeat(seat) && s.status !== 'finished') {
      this._finish(true);
      return;
    }
  }

  _handleBid(seat, contract) {
    const s = this.state;
    const highest = this._highestBid();
    if (contract === 'pass') {
      s.bids[seat] = 'pass';
      this.log(`🚫 ${this.nameOf(seat)} passe.`);
    } else {
      if (!CONTRACTS.includes(contract)) return;
      if (highest && CONTRACTS.indexOf(contract) <= CONTRACTS.indexOf(highest)) return;
      s.bids[seat] = contract;
      this.log(`🗣️ ${this.nameOf(seat)} annonce ${CONTRACT_LABEL[contract]}.`);
    }
    s.bidsCount++;

    if (s.bidsCount >= this.N) return this._resolveBidding();
    s.turnSeat = this._next(s.turnSeat);
    this.broadcastState();
  }

  _highestBid() {
    let best = null;
    for (const b of this.state.bids) {
      if (b && b !== 'pass' && (!best || CONTRACTS.indexOf(b) > CONTRACTS.indexOf(best))) best = b;
    }
    return best;
  }

  _resolveBidding() {
    const s = this.state;
    const best = this._highestBid();
    if (!best) {
      this.log(`♻️ Tout le monde passe — on redonne.`);
      this._beginHand(true);
      return;
    }
    let takerSeat = null;
    for (let k = 0; k < this.N; k++) {
      const seat = (this.dealerSeat + 1 + k) % this.N;
      if (s.bids[seat] === best) takerSeat = seat;
    }
    s.takerSeat = takerSeat;
    s.contract = best;
    this.log(`🎯 ${this.nameOf(takerSeat)} est preneur — ${CONTRACT_LABEL[best]}.`);

    if (this.N === 5) {
      s.status = 'calling';
      s.phase = 'calling';
      this.broadcastState();
    } else {
      this._afterTakerDecided();
    }
  }

  // Rang appelable à 5 joueurs : Roi, sauf si le preneur a les 4 Rois (alors Dame), etc.
  _callableRank(seat) {
    const h = this.state.hands[seat];
    const cnt = (val) => SUITS.filter((su) => h.some((c) => c.suit === su && c.value === val)).length;
    if (cnt('R') < 4) return 'R';
    if (cnt('D') < 4) return 'D';
    if (cnt('C') < 4) return 'C';
    return 'V';
  }

  _handleCall(seat, suit) {
    const s = this.state;
    if (!SUITS.includes(suit)) return;
    const value = this._callableRank(seat);
    s.calledCard = { suit, value };
    // Le partenaire est le détenteur de la carte appelée (hors preneur). Sinon le preneur joue seul.
    s.partnerSeat = null;
    for (let ss = 0; ss < this.N; ss++) {
      if (ss === seat) continue;
      if (s.hands[ss].some((c) => c.suit === suit && c.value === value)) { s.partnerSeat = ss; break; }
    }
    this.log(`📣 ${this.nameOf(seat)} appelle le ${frCard({ suit, value })}.`);
    this._afterTakerDecided();
  }

  _afterTakerDecided() {
    const s = this.state;
    s.status = 'ecart';
    s.phase = 'ecart';
    if (s.contract === 'petite' || s.contract === 'garde') {
      s.needEcart = true;
      s.chienRevealed = true;
      s.hands[s.takerSeat] = s.hands[s.takerSeat].concat(s.chien);
      this.log(`👀 Le Chien est dévoilé : ${s.chien.map(frCard).join(', ')}.`);
    } else {
      s.needEcart = false;
    }
    this.broadcastState();
  }

  _handleEcart(seat, cardIds) {
    const s = this.state;
    const need = this.deal.chien;
    if (cardIds.length !== need) return;
    const hand = s.hands[seat];
    const chosen = [];
    for (const id of cardIds) {
      const c = hand.find((x) => cardId(x) === id);
      if (!c) return;
      chosen.push(c);
    }
    if (chosen.some((c) => isKing(c) || isOudler(c))) {
      this.io.to(this.players[seat].id).emit('tarot_error', "Un Roi ou un Bout ne peut pas être écarté.");
      return;
    }
    const trumpsEcarted = chosen.filter(isTrump);
    s.ecart = chosen;
    s.hands[seat] = hand.filter((c) => !cardIds.includes(cardId(c)));
    if (trumpsEcarted.length) {
      this.log(`♦ ${this.nameOf(seat)} écarte des atouts (montrés) : ${trumpsEcarted.map(frCard).join(', ')}.`);
    }
    this.log(`✅ ${this.nameOf(seat)} a fait son écart.`);
    this._startPlay();
  }

  _startPlay() {
    const s = this.state;
    s.status = 'playing';
    s.phase = 'playing';
    s.turnStartSeat = (s.slam && s.slam.seat != null) ? s.slam.seat : this._next(this.dealerSeat);
    s.turnSeat = s.turnStartSeat;
    s.currentTrick = [];
    s.leadSuit = null;
    this.log(`▶️ ${this.nameOf(s.turnSeat)} entame.`);
    this.broadcastState();
  }

  _handlePoignee(seat, kind) {
    const s = this.state;
    if (!this.allowHandful) return;
    if (s.firstCardPlayed[seat]) return;
    if (s.poignees.some((p) => p.seat === seat)) return;
    const def = this.poigneeDefs[kind];
    if (!def) return;
    const trumps = s.hands[seat].filter((c) => isTrump(c) || isExcuse(c));
    if (trumps.length < def.count) {
      this.io.to(this.players[seat].id).emit('tarot_error', `Il faut ${def.count} atouts pour cette poignée.`);
      return;
    }
    s.poignees.push({ seat, kind, count: def.count, bonus: def.bonus });
    this.log(`✋ ${this.nameOf(seat)} présente une poignée (${def.count} atouts, +${def.bonus}).`);
    this.broadcastState();
  }

  _handlePlayCard(seat, playerId, cid) {
    const s = this.state;
    if (this._reviewers.size > 0) {
      this.io.to(playerId).emit('tarot_error', this._reviewers.has(seat)
        ? 'Ferme le dernier pli pour jouer.'
        : `${this._reviewerNames().join(', ')} regarde le dernier pli…`);
      return;
    }
    const hand = s.hands[seat];
    const card = hand.find((c) => cardId(c) === cid);
    if (!card) return;
    const legal = this._legalCards(seat);
    if (!legal.some((c) => cardId(c) === cid)) {
      this.io.to(playerId).emit('tarot_error', "Cette carte n'est pas jouable.");
      return;
    }

    s.firstCardPlayed[seat] = true;
    s.hands[seat] = hand.filter((c) => cardId(c) !== cid);
    s.currentTrick.push({ seat, card });
    if (s.leadSuit === null && !isExcuse(card)) s.leadSuit = isTrump(card) ? 'trump' : card.suit;

    // Appel du Roi joué (à 5) → le partenaire est révélé
    if (this.N === 5 && s.calledCard && !s.calledCardPlayed
        && card.suit === s.calledCard.suit && card.value === s.calledCard.value) {
      s.calledCardPlayed = true;
      s.partnerRevealed = true;
      if (s.partnerSeat != null) this.log(`🤝 ${this.nameOf(s.partnerSeat)} est le partenaire du preneur !`);
      else this.log(`🎭 Le preneur jouait seul (${frCard(s.calledCard)} au Chien ou dans son jeu).`);
    }

    if (s.currentTrick.length === this.N) {
      s.resolving = true;
      this.broadcastState();
      setTimeout(() => { s.resolving = false; this._resolveTrick(); }, TRICK_PAUSE_MS);
    } else {
      s.turnSeat = this._next(s.turnSeat);
      this.broadcastState();
    }
  }

  _resolveTrick() {
    const s = this.state;
    if (s.status !== 'playing' || s.currentTrick.length < this.N) return;
    const lead = s.leadSuit;
    let best = s.currentTrick.find((t) => !isExcuse(t.card)) || s.currentTrick[0];
    for (const t of s.currentTrick) {
      if (cardStrength(t.card, lead) > cardStrength(best.card, lead)) best = t;
    }
    const winSeat = best.seat;
    s.tricksWon[winSeat]++;
    s.trickCount++;

    s.trickPiles.push({
      cards: s.currentTrick.map((t) => ({ seat: t.seat, card: t.card })),
      winnerSeat: winSeat,
    });
    s.lastTrick = {
      cards: s.currentTrick.map((t) => ({ seat: t.seat, name: this.nameOf(t.seat), card: t.card })),
      winnerSeat: winSeat,
      trickNo: s.trickCount,
    };
    this.log(`➡️ ${this.nameOf(winSeat)} remporte le pli ${s.trickCount}.`);
    s.currentTrick = [];
    s.leadSuit = null;
    this._clearReviewers();

    if (s.trickCount === this.tricksTotal) {
      this._scoreHand();
    } else {
      s.turnSeat = winSeat;
      this.broadcastState();
    }
  }

  // ---------- décompte ----------
  _scoreHand() {
    const s = this.state;
    const takerSeat = s.takerSeat;
    const partnerSeat = (this.N === 5) ? s.partnerSeat : null;
    const attackers = partnerSeat != null ? [takerSeat, partnerSeat] : [takerSeat];
    const defenders = this._allSeats().filter((x) => !attackers.includes(x));
    const camp = (seat) => (attackers.includes(seat) ? 'T' : 'D');

    const takerCards = [];
    const defCards = [];
    for (const pile of s.trickPiles) {
      const dest = camp(pile.winnerSeat) === 'T' ? takerCards : defCards;
      for (const { card } of pile.cards) dest.push(card);
    }

    // Excuse : reste au camp qui l'a jouée (sauf dernier pli hors chelem) + échange d'une basse carte.
    const takerSlam0 = attackers.reduce((a, x) => a + s.tricksWon[x], 0) === this.tricksTotal;
    const defSlam0 = defenders.reduce((a, d) => a + s.tricksWon[d], 0) === this.tricksTotal;
    const excusePlay = this._findExcusePlay();
    let excuseNote = null;
    if (excusePlay) {
      const { playerSeat, trickNo } = excusePlay;
      const isLast = trickNo === this.tricksTotal;
      const keepByOwner = !isLast || takerSlam0 || defSlam0;
      if (keepByOwner) {
        const ownerCamp = camp(playerSeat);
        const winCamp = camp(s.trickPiles[trickNo - 1].winnerSeat);
        if (winCamp !== ownerCamp) {
          const from = winCamp === 'T' ? takerCards : defCards;
          const to = ownerCamp === 'T' ? takerCards : defCards;
          const ei = from.findIndex(isExcuse);
          if (ei !== -1) to.push(from.splice(ei, 1)[0]);
          const li = to.findIndex((c) => cardPoints(c) === 0.5 && !isExcuse(c));
          if (li !== -1) from.push(to.splice(li, 1)[0]);
          excuseNote = `${this.nameOf(playerSeat)} conserve l'Excuse (échange d'une carte).`;
        }
      }
    }

    // Chien
    if (s.contract === 'petite' || s.contract === 'garde') takerCards.push(...s.ecart);
    else if (s.contract === 'garde_sans') takerCards.push(...s.chien);
    else if (s.contract === 'garde_contre') defCards.push(...s.chien);

    const oudlers = takerCards.filter(isOudler).length;
    const target = TARGET_BY_OUDLERS[oudlers];
    const takerPtsExact = takerCards.reduce((a, c) => a + cardPoints(c), 0);
    const defPtsExact = defCards.reduce((a, c) => a + cardPoints(c), 0);

    const made = takerPtsExact >= target;
    const takerPtsRounded = made ? Math.ceil(takerPtsExact) : Math.floor(takerPtsExact);
    const diff = Math.abs(takerPtsRounded - target);

    // Petit au Bout
    const lastPile = s.trickPiles[this.tricksTotal - 1];
    const petitInLast = lastPile && lastPile.cards.some((c) => isTrump(c.card) && c.card.value === '01');
    let petitBoutSigned = 0;
    if (petitInLast) {
      const petitCamp = camp(lastPile.winnerSeat);
      petitBoutSigned = (petitCamp === 'T' ? 1 : -1) * 10 * CONTRACT_MULT[s.contract];
    }

    // Chelem
    const takerSlam = attackers.reduce((a, x) => a + s.tricksWon[x], 0) === this.tricksTotal;
    const defSlam = defenders.reduce((a, d) => a + s.tricksWon[d], 0) === this.tricksTotal;
    let slamSigned = 0, slamLabel = null;
    if (takerSlam) {
      if (s.slam) { slamSigned = 400; slamLabel = 'Chelem annoncé et réussi (+400)'; }
      else { slamSigned = 200; slamLabel = 'Chelem réussi non annoncé (+200)'; }
    } else if (s.slam) {
      slamSigned = -200; slamLabel = 'Chelem annoncé mais non réalisé (−200)';
    } else if (defSlam) {
      slamSigned = -200; slamLabel = 'Chelem de la défense (−200)';
    }

    const poigneeTotal = s.poignees.reduce((a, p) => a + p.bonus, 0);
    const poigneeSigned = poigneeTotal ? (made ? 1 : -1) * poigneeTotal : 0;

    const contractPart = (25 + diff) * CONTRACT_MULT[s.contract] * (made ? 1 : -1);
    const V = contractPart + petitBoutSigned + poigneeSigned + slamSigned; // par défenseur

    // Marque individuelle
    const delta = new Array(this.N).fill(0);
    if (partnerSeat != null) { delta[takerSeat] = 2 * V; delta[partnerSeat] = 1 * V; }
    else { delta[takerSeat] = defenders.length * V; }
    for (const d of defenders) delta[d] = -V;
    for (let i = 0; i < this.N; i++) this.scores[i] += delta[i];

    const result = {
      takerSeat, takerName: this.nameOf(takerSeat),
      partnerSeat, partnerName: partnerSeat != null ? this.nameOf(partnerSeat) : null,
      calledCard: s.calledCard,
      contract: s.contract, contractLabel: CONTRACT_LABEL[s.contract], mult: CONTRACT_MULT[s.contract],
      oudlers, target,
      takerPts: takerPtsRounded, takerPtsExact: Math.round(takerPtsExact * 10) / 10,
      defPts: Math.round(defPtsExact * 10) / 10,
      made, diff,
      petitBout: petitBoutSigned, petitInLast: !!petitInLast,
      poignees: s.poignees.map((p) => ({ name: this.nameOf(p.seat), count: p.count, bonus: p.bonus })),
      poigneeSigned,
      slamLabel, slamSigned,
      base: (25 + diff) * (made ? 1 : -1),
      contractPart, perDefender: V,
      excuseNote,
      delta, totals: this.scores.slice(),
    };
    s.handResult = result;
    s.partnerRevealed = true;

    this.history.push({
      hand: this.handNumber,
      takerSeat, takerName: this.nameOf(takerSeat),
      partnerSeat,
      contract: s.contract, made,
      delta: delta.slice(), totals: this.scores.slice(),
    });

    const label = made ? 'Contrat réussi' : 'Chute';
    this.log(`🧮 ${label} — ${this.nameOf(takerSeat)} : ${takerPtsRounded}/${target} (${oudlers} bout${oudlers > 1 ? 's' : ''}). ${V >= 0 ? '+' : ''}${V} / défenseur.`);

    s.matchOver = this.scoreMode === 'single'
      || (this.scoreMode === 'fixed' && this.handNumber >= this.totalDeals)
      || (this.scoreMode === 'target' && this.targetScore != null && this.scores.some((sc) => sc >= this.targetScore));
    s.status = 'hand_over';
    this.broadcastState();
  }

  _findExcusePlay() {
    const s = this.state;
    for (let i = 0; i < s.trickPiles.length; i++) {
      for (const c of s.trickPiles[i].cards) {
        if (isExcuse(c.card)) return { playerSeat: c.seat, trickNo: i + 1 };
      }
    }
    return null;
  }

  _finish(forced = false) {
    const s = this.state;
    this._clearReviewers();
    s.status = 'finished';
    const ranking = this.players
      .map((p) => ({ seat: p.seat, name: p.name, score: this.scores[p.seat] }))
      .sort((a, b) => b.score - a.score);
    const top = ranking[0];
    const winner = (ranking[1] && ranking[1].score === top.score) ? null : top.seat;
    this.io.to(this.roomCode).emit('game_over', {
      reason: forced ? "Partie arrêtée par l'hôte."
        : winner != null ? `${top.name} l'emporte avec ${top.score} points !`
          : `Égalité en tête à ${top.score} points !`,
      ranking, winner, forced,
    });
    this.broadcastState();
  }

  // ---------- légalité (jeu de la carte) ----------
  _legalCards(seat) {
    const s = this.state;
    const hand = s.hands[seat];
    const trick = s.currentTrick;

    if (trick.length === 0) {
      // Entame : à 5 joueurs, l'interdiction d'entamer la couleur appelée ne vaut QUE pour le
      // premier pli (s.trickCount === 0). Seule exception : entamer avec la carte appelée elle-même
      // (le preneur peut ainsi « faire tomber » le Roi appelé dès l'entame).
      if (this.N === 5 && s.calledCard && !s.calledCardPlayed && s.trickCount === 0) {
        const cs = s.calledCard.suit;
        const allowed = hand.filter((c) => c.suit !== cs || (c.suit === cs && c.value === s.calledCard.value));
        return allowed.length ? allowed : hand.slice();
      }
      return hand.slice();
    }

    const lead = s.leadSuit;
    const excuse = hand.filter(isExcuse);
    if (lead === null) return hand.slice();

    const trumps = hand.filter(isTrump);
    const trumpsInTrick = trick.filter((t) => isTrump(t.card));
    const highestTrump = trumpsInTrick.length
      ? Math.max(...trumpsInTrick.map((t) => parseInt(t.card.value, 10))) : 0;

    if (lead === 'trump') {
      if (trumps.length === 0) return hand.slice();
      const higher = trumps.filter((c) => parseInt(c.value, 10) > highestTrump);
      return (higher.length ? higher : trumps).concat(excuse);
    }

    const followers = hand.filter((c) => !isTrump(c) && !isExcuse(c) && c.suit === lead);
    if (followers.length) return followers.concat(excuse);

    if (trumps.length === 0) return hand.slice();
    if (trumpsInTrick.length) {
      const higher = trumps.filter((c) => parseInt(c.value, 10) > highestTrump);
      return (higher.length ? higher : trumps).concat(excuse);
    }
    return trumps.concat(excuse);
  }

  _poigneeOffer(seat) {
    const s = this.state;
    if (!this.allowHandful || s.status !== 'playing') return null;
    if (s.firstCardPlayed[seat]) return null;
    if (s.poignees.some((p) => p.seat === seat)) return null;
    const n = s.hands[seat].filter((c) => isTrump(c) || isExcuse(c)).length;
    const kinds = [];
    if (n >= this.poigneeDefs.simple.count) kinds.push('simple');
    if (n >= this.poigneeDefs.double.count) kinds.push('double');
    if (n >= this.poigneeDefs.triple.count) kinds.push('triple');
    return kinds.length ? { count: n, kinds } : null;
  }

  // ---------- diffusion ----------
  broadcastState() {
    const s = this.state;
    const revealPartner = s.partnerRevealed || s.status === 'hand_over' || s.status === 'finished';
    for (const p of this.players) {
      const seat = p.seat;
      const myLegal = (s.status === 'playing' && !s.resolving && s.turnSeat === seat)
        ? this._legalCards(seat).map(cardId) : [];

      this.io.to(p.id).emit('update_board_state', {
        status: s.status,
        phase: s.phase,
        playerCount: this.N,
        scoreMode: this.scoreMode,
        totalDeals: this.totalDeals,
        targetScore: this.targetScore,
        handNumber: this.handNumber,
        tricksTotal: this.tricksTotal,
        scores: this.scores.slice(),
        mySeat: seat,
        isHost: p.name === this.hostName,
        dealerSeat: this.dealerSeat,
        turnSeat: s.turnSeat,
        resolving: !!s.resolving,
        takerSeat: s.takerSeat,
        takerName: s.takerSeat != null ? this.nameOf(s.takerSeat) : null,
        contract: s.contract,
        contractLabel: s.contract ? CONTRACT_LABEL[s.contract] : null,
        bids: s.bids,
        highestBid: this._highestBid(),
        chienRevealed: s.chienRevealed,
        chien: (s.chienRevealed || s.status === 'hand_over' || s.status === 'finished') ? s.chien : null,
        ecartSize: this.deal.chien,
        ecartCount: s.ecart.length,
        needEcart: !!s.needEcart,
        canEcart: s.status === 'ecart' && s.needEcart && s.takerSeat === seat,
        canStart: s.status === 'ecart' && !s.needEcart && s.takerSeat === seat,
        // Appel du Roi (5 joueurs)
        calledCard: s.calledCard,
        canCall: s.status === 'calling' && s.takerSeat === seat,
        callRank: (s.status === 'calling' && s.takerSeat === seat) ? this._callableRank(seat) : null,
        partnerSeat: revealPartner ? s.partnerSeat : null,
        iAmPartner: (this.N === 5 && s.partnerSeat === seat) ? true : false,
        slam: s.slam,
        poignees: s.poignees.map((pg) => ({ seat: pg.seat, name: this.nameOf(pg.seat), count: pg.count })),
        myHand: sortHand(s.hands[seat] || []),
        myLegalCards: myLegal,
        poigneeOffer: this._poigneeOffer(seat),
        currentTrick: s.currentTrick.map((t) => ({ seat: t.seat, name: this.nameOf(t.seat), card: t.card })),
        leadSuit: s.leadSuit,
        lastTrick: (s.status === 'playing' && !s.currentTrick.length) ? (s.lastTrick || null) : null,
        reviewers: this._reviewerNames(),
        history: this.history,
        seats: this.players.map((pp) => ({
          seat: pp.seat,
          name: pp.name,
          score: this.scores[pp.seat],
          isDealer: this.dealerSeat === pp.seat,
          isTaker: s.takerSeat === pp.seat,
          isPartner: revealPartner && s.partnerSeat === pp.seat,
          isTurn: s.turnSeat === pp.seat && !s.resolving && (s.status === 'playing' || s.status === 'bidding'),
          bid: s.bids[pp.seat],
          tricksWon: s.tricksWon[pp.seat],
          handCount: (s.hands[pp.seat] || []).length,
          hasPoignee: s.poignees.some((pg) => pg.seat === pp.seat),
        })),
        handResult: (s.status === 'hand_over' || s.status === 'finished') ? s.handResult : null,
        matchOver: !!s.matchOver,
      });
    }
  }

  reconnectPlayer(newSocketId, playerName) {
    const p = this.players.find((pp) => pp.name === playerName);
    if (!p) return false;
    p.id = newSocketId;
    return true;
  }
}

module.exports = Tarot;
