// server/games/belote.js
// Belote classique "à la retourne", 4 joueurs, sans annonces (tierce/50/100/carré).
// Belote-Rebelote conservée. Litige 81-81 simplifié (chute => défense 162).

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['07', '08', '09', '10', 'J', 'Q', 'K', 'A'];

const TRUMP_ORDER = ['07', '08', 'Q', 'K', '10', 'A', '09', 'J']; // faible -> fort
const PLAIN_ORDER = ['07', '08', '09', 'J', 'Q', 'K', '10', 'A']; // faible -> fort
const TRUMP_RANK = Object.fromEntries(TRUMP_ORDER.map((r, i) => [r, i]));
const PLAIN_RANK = Object.fromEntries(PLAIN_ORDER.map((r, i) => [r, i]));
const TRUMP_POINTS = { J: 20, '09': 14, A: 11, '10': 10, K: 4, Q: 3, '08': 0, '07': 0 };
const PLAIN_POINTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '09': 0, '08': 0, '07': 0 };
const TRICK_PAUSE_MS = 3000; // délai avant de ramasser un pli complet
const REVIEW_MAX_MS = 30000; // sécurité : un joueur qui "regarde le dernier pli" est relâché après 30 s

const IS_RED = (s) => s === 'hearts' || s === 'diamonds';
const SUIT_PREF = ['spades', 'hearts', 'clubs', 'diamonds']; // départage au sein d'une couleur

// Ordre d'affichage des couleurs PRÉSENTES dans la main :
// atout en tête, puis alternance noir/rouge autant que possible (même si une couleur manque).
function suitDisplayOrder(present, trump) {
  const pool = present.slice();
  const result = [];
  if (trump && pool.includes(trump)) { result.push(trump); pool.splice(pool.indexOf(trump), 1); }

  let wantRed;
  if (result.length) {
    wantRed = !IS_RED(result[result.length - 1]);
  } else {
    const reds = pool.filter(IS_RED).length;
    wantRed = reds > pool.length - reds; // démarre par la couleur majoritaire, noir si égalité
  }

  while (pool.length) {
    const byPref = (arr) => arr.sort((a, b) => SUIT_PREF.indexOf(a) - SUIT_PREF.indexOf(b))[0];
    let pick = byPref(pool.filter((s) => IS_RED(s) === wantRed)) || byPref(pool.slice());
    result.push(pick);
    pool.splice(pool.indexOf(pick), 1);
    wantRed = !IS_RED(pick);
  }
  return result;
}
const SUIT_SYM = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const VAL_FR = { '07': '7', '08': '8', '09': '9', '10': '10', J: 'Valet', Q: 'Dame', K: 'Roi', A: 'As' };

const cardId = (c) => `${c.suit}_${c.value}`;
const teamOf = (seat) => (seat % 2 === 0 ? 'A' : 'B');
const otherTeam = (t) => (t === 'A' ? 'B' : 'A');
const partnerOf = (seat) => (seat + 2) % 4;
const nextSeat = (seat) => (seat + 1) % 4;

function buildDeck() {
  const d = [];
  for (const s of SUITS) for (const v of RANKS) d.push({ suit: s, value: v });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardStrength(card, trump, leadSuit) {
  if (card.suit === trump) return 200 + TRUMP_RANK[card.value];
  if (card.suit === leadSuit) return 100 + PLAIN_RANK[card.value];
  return 0;
}
function cardPoints(card, trump) {
  return (card.suit === trump ? TRUMP_POINTS : PLAIN_POINTS)[card.value];
}
const frCard = (c) => `${VAL_FR[c.value]}${SUIT_SYM[c.suit]}`;

class Belote {
  constructor(roomCode, playersData, io, options = {}) {
    this.roomCode = roomCode;
    this.io = io;
    // playersData est déjà dans l'ordre des sièges 0..3 (choisi par l'hôte)
    this.players = playersData.map((p, i) => ({ id: p.id, name: p.name, seat: i }));
    this.hostName = options.hostName || playersData[0].name;

    this.scoreMode = ['classic1001', 'short501', 'endless', 'single'].includes(options.scoreMode)
      ? options.scoreMode : 'classic1001';
    this.targetScore = this.scoreMode === 'classic1001' ? 1001
      : this.scoreMode === 'short501' ? 501 : null;
    this.defaultSplit = options.defaultSplit === '2-3' ? '2-3' : '3-2';
    // Malus "valet tournant" : si la main (1er à parler) refuse un valet retourné,
    // son équipe perd 100 points sur le total, immédiatement.
    this.valetMalus = !!options.valetMalus;
    // Affiche les points de la donne en cours, mis à jour à chaque pli.
    // Off par défaut : sinon le serveur ne transmet pas handPoints pendant le jeu.
    this.liveScore = !!options.liveScore;
    // Sièges en train de "revoir le dernier pli" -> personne ne peut jouer pendant ce temps.
    this._reviewers = new Map(); // seat -> timeout de sécurité

    const tn = options.teamNames || {};
    this.teamNames = {
      A: String(tn.A || '').trim().slice(0, 20),
      B: String(tn.B || '').trim().slice(0, 20),
    };

    this.scores = { A: 0, B: 0 };
    this.history = []; // feuille de score : { hand, trump, takerTeam, outcome, delta:{A,B}, totals:{A,B} }
    this.dealerSeat = Math.floor(Math.random() * 4);
    this.handNumber = 0;
    this.state = { status: 'waiting' };
  }

  _reviewerNames() { return [...this._reviewers.keys()].map((seat) => this.nameOf(seat)); }
  _clearReviewers() {
    for (const t of this._reviewers.values()) clearTimeout(t);
    this._reviewers.clear();
  }

  tLabel(t) { return this.teamNames[t] || `Équipe ${t === 'A' ? '1' : '2'}`; }
  seatOf(id) { const p = this.players.find((p) => p.id === id); return p ? p.seat : -1; }
  nameOf(seat) { return this.players[seat] ? this.players[seat].name : '?'; }
  isHostSeat(seat) { return this.players[seat] && this.players[seat].name === this.hostName; }
  log(msg) { this.io.to(this.roomCode).emit('action_log', msg); }

  start() {
    // Un seul mélange aléatoire pour toute la partie. Ensuite on ne fait que couper.
    this.matchDeck = buildDeck();
    this.io.to(this.roomCode).emit('game_started');
    this._beginHand(true);
  }

  // Récupère les 32 cartes de la donne qui vient de finir.
  // Ordre : les plis empilés (ordre où ils ont été remportés, cartes dans l'ordre de jeu),
  // sinon (personne n'a pris) les mains dans l'ordre de distribution (donneur+1, +2, +3, donneur),
  // puis la retourne, puis le talon.
  _gatherDeck() {
    const s = this.state;
    const cards = [];
    for (const pile of (s.trickPiles || [])) cards.push(...pile);
    for (let k = 0; k < 4; k++) {
      const seat = (this.dealerSeat + 1 + k) % 4;
      cards.push(...s.hands[seat]);
    }
    if (s.retourne) cards.push(s.retourne);
    cards.push(...s.talon);
    return cards;
  }

  _beginHand(isFirst = false, sameNumber = false) {
    this._clearReviewers();
    if (!isFirst) {
      this.matchDeck = this._gatherDeck();          // ramasse la donne précédente…
      this.dealerSeat = nextSeat(this.dealerSeat);  // …AVANT de faire tourner le donneur
    }

    if (!sameNumber) this.handNumber++; // une donne blanche (tout le monde passe) ne compte pas
    this.state = {
      status: isFirst ? 'choosing_split' : 'cutting',
      phase: null,
      split: this.defaultSplit,
      cutterSeat: isFirst ? null : (this.dealerSeat + 3) % 4, // joueur à droite du donneur
      hands: [[], [], [], []],
      trump: null,
      takerSeat: null,
      retourne: null,
      talon: [],
      turnSeat: nextSeat(this.dealerSeat),
      passes: 0,
      currentTrick: [],
      leadSuit: null,
      trickCount: 0,
      trickPiles: [],
      tricksWon: [0, 0, 0, 0],
      handPoints: { A: 0, B: 0 },
      beloteSeat: null,
      beloteProgress: 0,
      handResult: null,
      lastTrick: null,
    };

    if (isFirst) {
      this.log(`♥ Donne ${this.handNumber} — ${this.nameOf(this.dealerSeat)} distribue.`);
    } else {
      this.log(`♥ Donne ${this.handNumber} — ${this.nameOf(this.state.cutterSeat)} coupe, ${this.nameOf(this.dealerSeat)} distribue.`);
    }
    this.broadcastState();
  }

  _deal() {
    const s = this.state;
    const d = this.matchDeck.slice(); // on distribue depuis le paquet de la partie (mélangé 1 fois, coupé ensuite)
    const rounds = s.split === '2-3' ? [2, 3] : [3, 2];
    const seq = [0, 1, 2, 3].map((k) => (this.dealerSeat + 1 + k) % 4);
    for (const n of rounds) {
      for (const seat of seq) {
        for (let k = 0; k < n; k++) s.hands[seat].push(d.pop());
      }
    }
    s.retourne = d.pop();
    s.talon = d;
    this.matchDeck = [];
    s.status = 'bidding';
    s.phase = 'bid1';
    s.turnSeat = nextSeat(this.dealerSeat);
    s.passes = 0;
    this.log(`▸ Distribution en ${s.split}. Retourne : ${frCard(s.retourne)}.`);
    this.broadcastState();
  }

  _cut(index) {
    const d = this.matchDeck;
    const n = d.length; // 32
    // coupe obligatoire, au moins 3 cartes de chaque côté
    const i = Number.isFinite(index)
      ? Math.max(3, Math.min(n - 3, Math.round(index)))
      : Math.floor(n / 2);
    this.matchDeck = d.slice(i).concat(d.slice(0, i)); // le paquet du dessous passe sur le dessus
  }

  handleAction(playerId, type, payload = {}) {
    const seat = this.seatOf(playerId);
    if (seat === -1) return;
    const s = this.state;

    if (type === 'cut' && s.status === 'cutting' && seat === s.cutterSeat) {
      this._cut(payload.index);
      this.log(`🔪 ${this.nameOf(seat)} coupe le paquet.`);
      s.status = 'choosing_split';
      s.split = this.defaultSplit;
      this.broadcastState();
      return;
    }

    if (type === 'choose_split' && s.status === 'choosing_split' && seat === this.dealerSeat) {
      s.split = payload.split === '2-3' ? '2-3' : '3-2';
      this._deal();
      return;
    }

    if (type === 'bid_pass' && s.status === 'bidding' && seat === s.turnSeat) {
      // Malus "valet tournant" : la main (1er à parler, aucun pass encore) refuse un valet retourné.
      if (this.valetMalus && s.phase === 'bid1' && s.passes === 0
          && s.retourne && s.retourne.value === 'J') {
        const mt = teamOf(seat);
        this.scores[mt] -= 100;
        this.history.push({
          hand: this.handNumber, malus: true, takerTeam: null, trump: s.retourne.suit,
          delta: { A: mt === 'A' ? -100 : 0, B: mt === 'B' ? -100 : 0 },
          totals: { A: this.scores.A, B: this.scores.B },
        });
        this.log(`😱 ${this.nameOf(seat)} refuse le valet tournant ! ${this.tLabel(mt)} −100 (total : ${this.scores[mt]}).`);
        this.io.to(this.roomCode).emit('belote_valet_shame', {
          seat, team: mt, name: this.nameOf(seat), suit: s.retourne.suit,
          scores: { A: this.scores.A, B: this.scores.B },
        });
      }
      s.passes++;
      this.log(`🚫 ${this.nameOf(seat)} passe.`);
      if (s.passes >= 4) {
        if (s.phase === 'bid1') {
          s.phase = 'bid2';
          s.passes = 0;
          s.turnSeat = nextSeat(this.dealerSeat);
          this.log(`↻ Deuxième tour — choix libre de la couleur d'atout.`);
        } else {
          this.log(`♻️ Tout le monde passe — on redonne (même donne).`);
          this._beginHand(false, true); // ramasse + tourne le donneur, mais garde le n° de donne
          return;
        }
      } else {
        s.turnSeat = nextSeat(s.turnSeat);
      }
      this.broadcastState();
      return;
    }

    if (type === 'bid_take' && s.status === 'bidding' && seat === s.turnSeat) {
      let trump;
      if (s.phase === 'bid1') {
        trump = s.retourne.suit;
      } else {
        trump = payload.suit;
        if (!SUITS.includes(trump) || trump === s.retourne.suit) return;
      }
      s.trump = trump;
      s.takerSeat = seat;

      // Distribution du reste : preneur = retourne + 2, autres = 3
      s.hands[seat].push(s.retourne);
      s.retourne = null; // désormais dans la main du preneur (évite un doublon au ramassage)
      for (let k = 0; k < 4; k++) {
        const ss = (this.dealerSeat + 1 + k) % 4;
        const n = ss === seat ? 2 : 3;
        for (let i = 0; i < n; i++) s.hands[ss].push(s.talon.pop());
      }
      s.talon = [];

      // Porteur de la belote (Roi + Dame d'atout)
      for (let ss = 0; ss < 4; ss++) {
        const h = s.hands[ss];
        const hasK = h.some((c) => c.suit === trump && c.value === 'K');
        const hasQ = h.some((c) => c.suit === trump && c.value === 'Q');
        if (hasK && hasQ) { s.beloteSeat = ss; break; }
      }

      s.status = 'playing';
      s.turnSeat = nextSeat(this.dealerSeat);
      s.currentTrick = [];
      s.leadSuit = null;
      s.trickCount = 0;
      this.log(`🎯 ${this.nameOf(seat)} prend à ${SUIT_SYM[trump]}. ${this.nameOf(s.turnSeat)} entame.`);
      this.broadcastState();
      return;
    }

    if (type === 'review') {
      if (s.status !== 'playing') return;
      const had = this._reviewers.has(seat);
      const canOpen = payload.open && s.lastTrick && s.currentTrick.length === 0;
      const old = this._reviewers.get(seat);
      if (old) clearTimeout(old);
      this._reviewers.delete(seat);
      if (canOpen) {
        this._reviewers.set(seat, setTimeout(() => {
          this._reviewers.delete(seat);
          this.broadcastState();
        }, REVIEW_MAX_MS));
      }
      if (had !== this._reviewers.has(seat)) this.broadcastState();
      return;
    }

    if (type === 'play_card' && s.status === 'playing' && !s.resolving && seat === s.turnSeat) {
      if (this._reviewers.size > 0) {
        this.io.to(playerId).emit('belote_error', this._reviewers.has(seat)
          ? 'Ferme le dernier pli pour jouer.'
          : `${this._reviewerNames().join(', ')} regarde le dernier pli…`);
        return;
      }
      const hand = s.hands[seat];
      const idx = hand.findIndex((c) => cardId(c) === payload.cardId);
      if (idx === -1) return;
      const legal = this._legalCards(seat);
      if (!legal.some((c) => cardId(c) === payload.cardId)) return;

      const card = hand.splice(idx, 1)[0];
      s.currentTrick.push({ seat, card });
      if (s.currentTrick.length === 1) s.leadSuit = card.suit;

      if (s.beloteSeat === seat && card.suit === s.trump && (card.value === 'K' || card.value === 'Q')) {
        s.beloteProgress++;
        const word = s.beloteProgress === 1 ? 'Belote' : 'Rebelote';
        this.io.to(this.roomCode).emit('belote_announce', { word, playerName: this.nameOf(seat), suit: s.trump });
        this.log(`✨ ${word} ! (${this.nameOf(seat)})`);
      }

      if (s.currentTrick.length === 4) {
        // On laisse le 4e joueur (et tout le monde) voir le pli complet avant de le ramasser
        s.resolving = true;
        this.broadcastState();
        setTimeout(() => {
          s.resolving = false;
          this._resolveTrick();
        }, TRICK_PAUSE_MS);
      } else {
        s.turnSeat = nextSeat(s.turnSeat);
        this.broadcastState();
      }
      return;
    }

    if (type === 'next_hand' && s.status === 'hand_over' && this.isHostSeat(seat)) {
      if (s.matchOver) { this._finish(); return; } // fin de partie : on passe au résultat
      this._beginHand(); // sinon : ramasse, tourne le donneur, nouvelle donne
      return;
    }

    if (type === 'end_match' && this.isHostSeat(seat) && s.status !== 'finished') {
      this._finish(true);
      return;
    }
  }

  _resolveTrick() {
    const s = this.state;
    if (s.status !== 'playing' || s.currentTrick.length < 4) return; // garde-fou (timer obsolète)
    const lead = s.leadSuit;
    let best = s.currentTrick[0];
    for (const t of s.currentTrick) {
      if (cardStrength(t.card, s.trump, lead) > cardStrength(best.card, s.trump, lead)) best = t;
    }
    const winSeat = best.seat;
    const team = teamOf(winSeat);
    let pts = 0;
    for (const t of s.currentTrick) pts += cardPoints(t.card, s.trump);
    s.handPoints[team] += pts;
    s.tricksWon[winSeat]++;
    s.trickCount++;
    const isLast = s.trickCount === 8;
    if (isLast) s.handPoints[team] += 10; // 10 de der

    this.log(`➡️ ${this.nameOf(winSeat)} remporte le pli (${pts} pts${isLast ? ' + 10 de der' : ''}).`);

    // Le pli est empilé (dans l'ordre de jeu) pour reconstituer le paquet à la fin de la donne
    s.trickPiles.push(s.currentTrick.map((t) => t.card));
    // On garde le pli qu'on vient de ramasser pour permettre de le revoir
    // (jusqu'à ce qu'une carte du pli suivant soit jouée).
    s.lastTrick = {
      cards: s.currentTrick.map((t) => ({ seat: t.seat, name: this.nameOf(t.seat), card: t.card })),
      winnerSeat: winSeat,
      trickNo: s.trickCount,
    };
    s.currentTrick = [];
    s.leadSuit = null;
    this._clearReviewers(); // nouveau "dernier pli" -> on repart de zéro

    if (isLast) {
      this._scoreHand();
    } else {
      s.turnSeat = winSeat;
      this.broadcastState();
    }
  }

  _scoreHand() {
    const s = this.state;
    const takerTeam = teamOf(s.takerSeat);
    const defTeam = otherTeam(takerTeam);
    const beloteTeam = (s.beloteSeat != null && s.beloteProgress === 2) ? teamOf(s.beloteSeat) : null;
    const bel = (t) => (beloteTeam === t ? 20 : 0);

    const trickPts = { A: s.handPoints.A, B: s.handPoints.B }; // cartes + 10 de der
    const takerTricks = (takerTeam === 'A')
      ? s.tricksWon[0] + s.tricksWon[2]
      : s.tricksWon[1] + s.tricksWon[3];
    const capotTaker = takerTricks === 8;
    const capotDef = takerTricks === 0;

    const takerTotal = trickPts[takerTeam] + bel(takerTeam);
    const defTotal = trickPts[defTeam] + bel(defTeam);

    let scoreTaker, scoreDef, outcome;
    if (capotTaker) {
      scoreTaker = 250 + bel(takerTeam); scoreDef = bel(defTeam); outcome = 'capot_taker';
    } else if (capotDef) {
      scoreDef = 250 + bel(defTeam); scoreTaker = bel(takerTeam); outcome = 'capot_def';
    } else if (takerTotal > defTotal) {
      scoreTaker = takerTotal; scoreDef = defTotal; outcome = 'made';
    } else {
      scoreDef = 162 + bel(defTeam); scoreTaker = bel(takerTeam); outcome = 'chute';
    }

    this.scores[takerTeam] += scoreTaker;
    this.scores[defTeam] += scoreDef;

    s.handResult = {
      trump: s.trump,
      takerTeam,
      takerName: this.nameOf(s.takerSeat),
      outcome,
      capot: capotTaker || capotDef,
      trickPts,
      beloteTeam,
      delta: { [takerTeam]: scoreTaker, [defTeam]: scoreDef },
      totals: { A: this.scores.A, B: this.scores.B },
    };

    // Feuille de score : une ligne par donne jouée (les donnes blanches n'y figurent pas).
    this.history.push({
      hand: this.handNumber,
      trump: s.trump,
      takerTeam,
      outcome,
      delta: { A: s.handResult.delta.A || 0, B: s.handResult.delta.B || 0 },
      totals: { A: this.scores.A, B: this.scores.B },
    });

    const label = outcome === 'made' ? 'Contrat réussi'
      : outcome === 'chute' ? 'Chute !'
      : 'CAPOT !';
    this.log(`🧮 ${label} — ${this.tLabel('A')} : ${this.scores.A} · ${this.tLabel('B')} : ${this.scores.B}`);

    // Fin de partie ? On affiche quand même le récap de cette donne ;
    // l'hôte clique ensuite pour voir le résultat final.
    s.matchOver = this.scoreMode === 'single'
      || !!(this.targetScore && (this.scores.A >= this.targetScore || this.scores.B >= this.targetScore));
    s.status = 'hand_over';
    this.broadcastState();
  }

  _finish(forced = false) {
    const s = this.state;
    this._clearReviewers();
    s.status = 'finished';
    const winner = this.scores.A === this.scores.B ? null : (this.scores.A > this.scores.B ? 'A' : 'B');
    this.io.to(this.roomCode).emit('game_over', {
      reason: forced
        ? "Partie arrêtée par l'hôte."
        : winner
          ? `${this.tLabel(winner)} l'emporte ${this.scores[winner]}–${this.scores[otherTeam(winner)]} !`
          : `Égalité ${this.scores.A}–${this.scores.B} !`,
      scores: { A: this.scores.A, B: this.scores.B },
      winner,
      forced,
      teamNames: this.teamNames,
      teams: { A: [this.nameOf(0), this.nameOf(2)], B: [this.nameOf(1), this.nameOf(3)] },
    });
    this.broadcastState();
  }

  // Cartes jouables par `seat` d'après les règles strictes de la belote.
  _legalCards(seat) {
    const s = this.state;
    const hand = s.hands[seat];
    const trick = s.currentTrick;
    const trump = s.trump;
    if (trick.length === 0) return hand.slice();

    const lead = s.leadSuit;
    const trumpsInTrick = trick.filter((t) => t.card.suit === trump);
    const highestTrump = trumpsInTrick.length
      ? Math.max(...trumpsInTrick.map((t) => TRUMP_RANK[t.card.value]))
      : -1;

    let best = trick[0];
    for (const t of trick) {
      if (cardStrength(t.card, trump, lead) > cardStrength(best.card, trump, lead)) best = t;
    }
    const partnerMaster = best.seat === partnerOf(seat);

    const myLead = hand.filter((c) => c.suit === lead);
    const myTrumps = hand.filter((c) => c.suit === trump);

    // Atout demandé : fournir, et monter si possible (même contre son partenaire)
    if (lead === trump) {
      if (myTrumps.length === 0) return hand.slice();
      const higher = myTrumps.filter((c) => TRUMP_RANK[c.value] > highestTrump);
      return higher.length ? higher : myTrumps;
    }

    // Couleur non-atout demandée : fournir si possible
    if (myLead.length > 0) return myLead;

    // Je ne peux pas fournir
    if (partnerMaster) return hand.slice();          // partenaire maître -> libre
    if (myTrumps.length === 0) return hand.slice();  // pas d'atout -> défausse libre
    if (trumpsInTrick.length > 0) {
      // un adversaire a déjà coupé -> surcouper si possible, sinon sous-couper obligatoire
      const higher = myTrumps.filter((c) => TRUMP_RANK[c.value] > highestTrump);
      return higher.length ? higher : myTrumps;
    }
    // personne n'a coupé et l'adversaire est maître -> couper obligatoire
    return myTrumps;
  }

  _sortHand(hand, trump) {
    const present = [...new Set(hand.map((c) => c.suit))];
    const order = suitDisplayOrder(present, trump);
    const pos = Object.fromEntries(order.map((s, i) => [s, i]));
    return hand.slice().sort((a, b) => {
      const sr = pos[a.suit] - pos[b.suit];
      if (sr !== 0) return sr;
      const rank = (trump && a.suit === trump) ? TRUMP_RANK : PLAIN_RANK;
      return rank[b.value] - rank[a.value]; // fort -> faible
    });
  }

  broadcastState() {
    const s = this.state;
    for (const p of this.players) {
      const seat = p.seat;
      const myLegal = (s.status === 'playing' && !s.resolving && s.turnSeat === seat)
        ? this._legalCards(seat).map(cardId)
        : [];

      this.io.to(p.id).emit('update_board_state', {
        status: s.status,
        phase: s.phase,
        scoreMode: this.scoreMode,
        targetScore: this.targetScore,
        scores: this.scores,
        handNumber: this.handNumber,
        mySeat: seat,
        isHost: p.name === this.hostName,
        isDealer: this.dealerSeat === seat,
        dealerSeat: this.dealerSeat,
        turnSeat: s.turnSeat,
        resolving: !!s.resolving,
        cutterSeat: s.cutterSeat ?? null,
        cutterName: (s.cutterSeat != null) ? this.nameOf(s.cutterSeat) : null,
        deckSize: (this.matchDeck && this.matchDeck.length) || 32,
        teamNames: this.teamNames,
        valetMalus: this.valetMalus,
        liveScore: this.liveScore,
        split: s.split,
        trump: s.trump || null,
        takerSeat: s.takerSeat,
        takerName: s.takerSeat != null ? this.nameOf(s.takerSeat) : null,
        retourne: (s.status === 'choosing_split' || s.status === 'bidding') ? s.retourne : null,
        // Tant que personne n'a pris (pas d'atout), on garde l'ordre de distribution :
        // si tout le monde passe, les mains retournent au paquet telles quelles.
        myHand: s.trump ? this._sortHand(s.hands[seat] || [], s.trump) : (s.hands[seat] || []).slice(),
        myLegalCards: myLegal,
        currentTrick: s.currentTrick.map((t) => ({ seat: t.seat, name: this.nameOf(t.seat), card: t.card })),
        leadSuit: s.leadSuit,
        handPoints: (this.liveScore || s.status !== 'playing') ? s.handPoints : { A: 0, B: 0 },
        lastTrick: (s.status === 'playing' && !s.currentTrick.length) ? (s.lastTrick || null) : null,
        reviewers: this._reviewerNames(),
        history: this.history,
        beloteSeat: s.beloteProgress > 0 ? s.beloteSeat : null,
        beloteTeam: (s.beloteProgress === 2 && s.beloteSeat != null) ? teamOf(s.beloteSeat) : null,
        seats: this.players.map((pp) => ({
          seat: pp.seat,
          name: pp.name,
          team: teamOf(pp.seat),
          isDealer: this.dealerSeat === pp.seat,
          isTaker: s.takerSeat === pp.seat,
          isTurn: s.turnSeat === pp.seat && !s.resolving && (s.status === 'playing' || s.status === 'bidding'),
          tricksWon: s.tricksWon[pp.seat],
          handCount: (s.hands[pp.seat] || []).length,
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

module.exports = Belote;
