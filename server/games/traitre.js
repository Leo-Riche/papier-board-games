// server/games/traitre.js
//
// « Traître à bord » — jeu d'ambiance / identité secrète (3 à 8 joueurs).
// Des Pirates cherchent à remplir le Coffre jusqu'à une valeur cible, tandis
// que des Mutins tentent de saboter la collecte. Chaque joueur pose, à son
// tour, une carte Butin (face cachée, valeur annoncée — potentiellement
// mensongère) ou joue une carte Action.

const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Composition par nombre de joueurs : pirates / mutins / cartes Planche / valeur cible du Coffre.
const SETUP_TABLE = {
  3: { pirates: 2, mutins: 1, planches: 12, target: 5 },
  4: { pirates: 3, mutins: 1, planches: 14, target: 8 },
  5: { pirates: 4, mutins: 1, planches: 16, target: 11 },
  6: { pirates: 4, mutins: 2, planches: 18, target: 6 },
  7: { pirates: 5, mutins: 2, planches: 20, target: 9 },
  8: { pirates: 6, mutins: 2, planches: 22, target: 12 },
};

const PLANCHES_TO_ELIMINATE = 3;

class Traitre {
  constructor(roomCode, playersData, io) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData; // [{ id, name }]
    this._cardSeq = 0;

    this.state = {
      status: 'playing',
      target: 0,
      currentPlayerIndex: 0,
      deck: [],
      chest: [],       // pile du Coffre : cartes Butin face cachée { id, value }
      discard: [],
      pendingAction: null, // { playerId, type, cards? } : action en 2 temps (Longue-vue / Pêche miraculeuse)
      players: [],     // [{ id, name, role, hand, planches, eliminated }]
      winner: null,
      winReason: '',
    };
  }

  // ── Utilitaires ────────────────────────────────────────────────
  _card(data) {
    return { id: `c${this._cardSeq++}`, ...data };
  }

  buildDeck(nbPlanches) {
    const deck = [];
    // Cartes Butin : 20× (+1), 10× (0), 12× (-2)
    for (let i = 0; i < 20; i++) deck.push(this._card({ kind: 'butin', value: 1 }));
    for (let i = 0; i < 10; i++) deck.push(this._card({ kind: 'butin', value: 0 }));
    for (let i = 0; i < 12; i++) deck.push(this._card({ kind: 'butin', value: -2 }));
    // Cartes Action (hors Planche) : 3 de chaque
    for (let i = 0; i < 3; i++) deck.push(this._card({ kind: 'action', action: 'longuevue' }));
    for (let i = 0; i < 3; i++) deck.push(this._card({ kind: 'action', action: 'videpoches' }));
    for (let i = 0; i < 3; i++) deck.push(this._card({ kind: 'action', action: 'bondebarras' }));
    for (let i = 0; i < 3; i++) deck.push(this._card({ kind: 'action', action: 'pechemiraculeuse' }));
    // Cartes Planche : nombre variable selon le nombre de joueurs
    for (let i = 0; i < nbPlanches; i++) deck.push(this._card({ kind: 'action', action: 'planche' }));
    return shuffle(deck);
  }

  start() {
    const nb = this.players.length;
    const config = SETUP_TABLE[nb];
    if (!config) {
      this.io.to(this.roomCode).emit('traitre_error', `Traître à bord se joue de 3 à 8 joueurs (actuellement ${nb}).`);
      return;
    }

    this.state.target = config.target;

    // 1. Rôles
    const roles = [];
    for (let i = 0; i < config.pirates; i++) roles.push('pirate');
    for (let i = 0; i < config.mutins; i++) roles.push('mutin');
    shuffle(roles);

    // 2. Deck
    this.state.deck = this.buildDeck(config.planches);
    this.state.chest = [];
    this.state.discard = [];
    this.state.pendingAction = null;

    // 3. Distribution : 3 cartes par joueur
    this.state.players = this.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      role: roles[index],
      hand: this.state.deck.splice(0, 3),
      planches: 0,
      eliminated: false,
    }));

    this.state.currentPlayerIndex = Math.floor(Math.random() * nb);
    this.state.status = 'playing';
    this.state.winner = null;

    this.io.to(this.roomCode).emit('game_started');
    this.log(`🏴‍☠️ La partie commence ! Objectif des Pirates : remplir le Coffre à ${config.target}. C'est au tour de ${this.currentPlayer().name}.`);
    this.broadcastState();
  }

  log(message) {
    this.io.to(this.roomCode).emit('action_log', message);
  }

  currentPlayer() {
    return this.state.players[this.state.currentPlayerIndex];
  }

  countRole(role) {
    return this.state.players.filter(p => p.role === role && !p.eliminated).length;
  }

  drawCards(n) {
    return this.state.deck.splice(0, n);
  }

  // Renvoie true si une carte a bien pu être piochée (utile pour la condition « pioche vide »).
  refillHand(player) {
    while (player.hand.length < 3 && this.state.deck.length > 0) {
      player.hand.push(this.state.deck.shift());
    }
  }

  advanceTurn() {
    const total = this.state.players.length;
    let idx = this.state.currentPlayerIndex;
    for (let step = 0; step < total; step++) {
      idx = (idx + 1) % total;
      if (!this.state.players[idx].eliminated) {
        this.state.currentPlayerIndex = idx;
        return;
      }
    }
  }

  // ── Point d'entrée des actions ─────────────────────────────────
  handleAction(socketId, actionType, payload = {}) {
    if (this.state.status !== 'playing') return;

    // Résolution des actions en 2 temps : seul le joueur concerné peut résoudre.
    if (this.state.pendingAction) {
      if (actionType === 'resolve_action' && socketId === this.state.pendingAction.playerId) {
        return this.resolvePendingAction(payload);
      }
      return; // toute autre action est bloquée tant qu'une résolution est attendue
    }

    const player = this.currentPlayer();
    if (!player || player.id !== socketId || player.eliminated) return;

    switch (actionType) {
      case 'place_butin':   return this.placeButin(player, payload);
      case 'play_action':   return this.playActionCard(player, payload);
      case 'declare_chest': return this.declareChest(player);
      default: return;
    }
  }

  // ── Poser une carte Butin ──────────────────────────────────────
  placeButin(player, { cardId, announcedValue }) {
    const idx = player.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = player.hand[idx];
    if (card.kind !== 'butin') return; // interdit de mettre une carte Action dans le Coffre

    player.hand.splice(idx, 1);
    this.state.chest.push(card);

    const announced = [1, 0, -2].includes(announcedValue) ? announcedValue : card.value;
    const fmt = (v) => (v > 0 ? `+${v}` : `${v}`);
    this.log(`📦 ${player.name} place une carte dans le Coffre et annonce ${fmt(announced)}.`);

    this.refillHand(player);
    this.endTurn();
  }

  // ── Jouer une carte Action ─────────────────────────────────────
  playActionCard(player, { cardId, targetId }) {
    const idx = player.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const card = player.hand[idx];
    if (card.kind !== 'action') return;

    switch (card.action) {
      case 'planche':          return this.actionPlanche(player, idx, targetId);
      case 'videpoches':       return this.actionVidePoches(player, idx, targetId);
      case 'bondebarras':      return this.actionBonDebarras(player, idx);
      case 'longuevue':        return this.actionLongueVue(player, idx);
      case 'pechemiraculeuse': return this.actionPecheMiraculeuse(player, idx);
      default: return;
    }
  }

  discardActionCard(player, idx) {
    const [card] = player.hand.splice(idx, 1);
    this.state.discard.push(card);
    return card;
  }

  actionPlanche(player, idx, targetId) {
    const target = this.state.players.find(p => p.id === targetId);
    if (!target || target.eliminated || target.id === player.id) return; // pas sur soi-même
    this.discardActionCard(player, idx);

    target.planches += 1;
    this.log(`🪵 ${player.name} pose une Planche devant ${target.name} (${target.planches}/${PLANCHES_TO_ELIMINATE}).`);

    if (target.planches >= PLANCHES_TO_ELIMINATE) {
      this.eliminatePlayer(target);
      // La partie a pu se terminer suite à l'élimination.
      if (this.state.status !== 'playing') return;
    }

    this.refillHand(player);
    this.endTurn();
  }

  eliminatePlayer(target) {
    target.eliminated = true;
    this.state.discard.push(...target.hand);
    target.hand = [];
    this.log(`🌊 ${target.name} est poussé(e) à l'eau ! Son rôle était : ${target.role === 'pirate' ? 'Pirate 🏴‍☠️' : 'Mutin 🗡️'}.`);

    // Condition 2 : tous les Mutins ont été poussés à l'eau → les Pirates gagnent.
    if (this.countRole('mutin') === 0) {
      return this.endGame('pirate', 'Tous les Mutins ont été poussés à l\'eau ! 🏴‍☠️');
    }
    // Condition 3 : les Mutins ne sont plus en infériorité numérique → les Mutins gagnent.
    if (this.countRole('mutin') >= this.countRole('pirate')) {
      return this.endGame('mutin', 'Les Mutins ne sont plus en infériorité numérique ! 🗡️');
    }
  }

  actionVidePoches(player, idx, targetId) {
    const target = this.state.players.find(p => p.id === targetId);
    if (!target || target.eliminated || target.id === player.id) return; // pas sur soi-même
    this.discardActionCard(player, idx);

    this.state.discard.push(...target.hand);
    target.hand = [];
    const drawn = this.drawCards(3);
    target.hand.push(...drawn);
    this.log(`🫳 ${player.name} force ${target.name} à vider ses poches : il/elle défausse sa main et pioche 3 cartes.`);

    this.refillHand(player);
    this.endTurn();
  }

  actionBonDebarras(player, idx) {
    this.discardActionCard(player, idx);
    const n = Math.min(2, this.state.chest.length);
    const removed = this.state.chest.splice(this.state.chest.length - n, n);
    this.state.discard.push(...removed);
    this.log(`🗑️ ${player.name} joue Bon débarras : ${n} carte(s) du dessus du Coffre partent à la défausse.`);

    this.refillHand(player);
    this.endTurn();
  }

  actionLongueVue(player, idx) {
    this.discardActionCard(player, idx);
    const n = Math.min(3, this.state.chest.length);

    if (n === 0) {
      this.log(`🔭 ${player.name} joue Longue-vue, mais le Coffre est vide.`);
      this.refillHand(player);
      return this.endTurn();
    }

    const cards = this.state.chest.splice(this.state.chest.length - n, n);
    shuffle(cards); // « mélangez-les » avant de les regarder
    this.state.pendingAction = { playerId: player.id, type: 'longuevue', cards };
    this.log(`🔭 ${player.name} joue Longue-vue et observe le dessus du Coffre...`);
    this.broadcastState();
  }

  actionPecheMiraculeuse(player, idx) {
    this.discardActionCard(player, idx);
    const drawn = this.drawCards(3);
    player.hand.push(...drawn);
    this.log(`🎣 ${player.name} joue Pêche miraculeuse et pioche 3 cartes.`);

    // Le joueur doit reposer (hand.length - 3) cartes sur la Pioche.
    if (player.hand.length <= 3) {
      // Pas assez de cartes pour avoir à en reposer : le tour se termine directement.
      return this.endTurn();
    }

    this.state.pendingAction = { playerId: player.id, type: 'pechemiraculeuse' };
    this.broadcastState();
  }

  // ── Résolution des actions en 2 temps ──────────────────────────
  resolvePendingAction(payload) {
    const pending = this.state.pendingAction;
    const player = this.state.players.find(p => p.id === pending.playerId);
    if (!player) return;

    if (pending.type === 'longuevue') {
      // orderedIds : du dessus (sommet du Coffre) vers le dessous.
      const orderedIds = Array.isArray(payload.orderedIds) ? payload.orderedIds : [];
      const byId = new Map(pending.cards.map(c => [c.id, c]));
      const placed = [];
      // On respecte l'ordre choisi ; les cartes manquantes sont ajoutées à la fin.
      for (let i = orderedIds.length - 1; i >= 0; i--) {
        const c = byId.get(orderedIds[i]);
        if (c) { this.state.chest.push(c); byId.delete(orderedIds[i]); placed.push(c); }
      }
      for (const c of byId.values()) this.state.chest.push(c);

      this.state.pendingAction = null;
      this.refillHand(player);
      return this.endTurn();
    }

    if (pending.type === 'pechemiraculeuse') {
      const toReturn = player.hand.length - 3;
      let returnIds = Array.isArray(payload.returnIds) ? payload.returnIds.slice(0, toReturn) : [];
      // Sécurité : ne garder que des ids réellement en main.
      returnIds = returnIds.filter(id => player.hand.some(c => c.id === id));
      // Compléter si le client n'a pas fourni assez d'ids.
      while (returnIds.length < toReturn) {
        const extra = player.hand.find(c => !returnIds.includes(c.id));
        if (!extra) break;
        returnIds.push(extra.id);
      }
      // returnIds : du dessus de la Pioche vers le dessous → on remet sur le dessus.
      for (let i = returnIds.length - 1; i >= 0; i--) {
        const cIdx = player.hand.findIndex(c => c.id === returnIds[i]);
        if (cIdx !== -1) {
          const [c] = player.hand.splice(cIdx, 1);
          this.state.deck.unshift(c);
        }
      }
      this.state.pendingAction = null;
      // Pas de pioche de fin de tour pour la Pêche miraculeuse.
      return this.endTurn();
    }
  }

  // ── Déclaration du Coffre (Pirate uniquement) ──────────────────
  declareChest(player) {
    if (player.role !== 'pirate') return; // un Mutin ne peut pas déclarer
    const total = this.state.chest.reduce((sum, c) => sum + c.value, 0);
    this.log(`🔎 ${player.name} (Pirate 🏴‍☠️) déclare le Coffre : total = ${total} (objectif ${this.state.target}).`);

    if (total >= this.state.target) {
      return this.endGame('pirate', `Le Coffre atteint ${total} (objectif ${this.state.target}) : les Pirates gagnent ! 🏴‍☠️`);
    }
    return this.endGame('mutin', `Le Coffre ne contient que ${total} (objectif ${this.state.target}) : les Mutins gagnent ! 🗡️`);
  }

  // ── Fin de tour + conditions de fin ────────────────────────────
  endTurn() {
    if (this.state.status !== 'playing') { this.broadcastState(); return; }

    // Condition 4 : plus aucune carte dans la Pioche → les Mutins gagnent.
    if (this.state.deck.length === 0) {
      return this.endGame('mutin', 'La Pioche est épuisée : les Mutins gagnent ! 🗡️');
    }

    this.advanceTurn();
    this.broadcastState();
  }

  endGame(winner, reason) {
    this.state.status = 'finished';
    this.state.winner = winner;
    this.state.winReason = reason;
    this.state.pendingAction = null;

    const revealed = this.state.players.map(p => ({ name: p.name, role: p.role, eliminated: p.eliminated }));
    this.broadcastState();
    this.io.to(this.roomCode).emit('game_over', {
      winner,
      reason,
      target: this.state.target,
      chestTotal: this.state.chest.reduce((sum, c) => sum + c.value, 0),
      players: revealed,
    });
  }

  // ── Diffusion de l'état (personnalisée par joueur) ─────────────
  broadcastState() {
    const finished = this.state.status === 'finished';
    const current = this.currentPlayer();

    const publicPlayers = this.state.players.map(p => ({
      id: p.id,
      name: p.name,
      planches: p.planches,
      eliminated: p.eliminated,
      handCount: p.hand.length,
      // Le rôle n'est révélé que si le joueur est éliminé ou en fin de partie.
      role: (p.eliminated || finished) ? p.role : null,
      isCurrent: current ? p.id === current.id : false,
    }));

    this.state.players.forEach(player => {
      let pending = null;
      if (this.state.pendingAction && this.state.pendingAction.playerId === player.id) {
        if (this.state.pendingAction.type === 'longuevue') {
          pending = { type: 'longuevue', cards: this.state.pendingAction.cards };
        } else if (this.state.pendingAction.type === 'pechemiraculeuse') {
          pending = { type: 'pechemiraculeuse', keep: 3 };
        }
      }

      this.io.to(player.id).emit('traitre_state', {
        status: this.state.status,
        target: this.state.target,
        deckCount: this.state.deck.length,
        chestCount: this.state.chest.length,
        discardCount: this.state.discard.length,
        currentPlayerId: current ? current.id : null,
        currentPlayerName: current ? current.name : null,
        isMyTurn: current ? current.id === player.id : false,
        myId: player.id,
        myRole: player.role,
        myHand: player.hand,
        myPlanches: player.planches,
        amIEliminated: player.eliminated,
        pendingAction: pending,
        players: publicPlayers,
        winner: this.state.winner,
        winReason: this.state.winReason,
      });
    });
  }

  reconnectPlayer(newSocketId, playerName) {
    if (this.state.status !== 'playing' && this.state.status !== 'finished') return false;
    const player = this.state.players.find(p => p.name === playerName);
    if (player) {
      const oldId = player.id;
      player.id = newSocketId;
      if (this.state.pendingAction && this.state.pendingAction.playerId === oldId) {
        this.state.pendingAction.playerId = newSocketId;
      }
      return true;
    }
    return false;
  }
}

module.exports = Traitre;
