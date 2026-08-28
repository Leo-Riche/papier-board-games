// server/games/charger.js

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // 1=As, 11=Valet, 12=Dame, 13=Roi

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardLabel(card) {
  if (!card) return '?';
  const face = { 1: 'As', 11: 'Valet', 12: 'Dame', 13: 'Roi' };
  const label = face[card.value] || String(card.value);
  return `${label}${card.suit}`;
}

class Charger {
  constructor(roomCode, playersData, io) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData;
    // Hôte identifié par son pseudo (stable à travers les reconnexions, contrairement au socket id)
    this.hostName = playersData[0]?.name || null;

    this.state = {
      status: 'waiting',
      activePlayerIndex: 0,
      deck: [],
      discard: [],
      players: [],
      pendingAction: null // { type: 'attack', attackerId, targetId, attackCards[] } used during reveal phase
    };
  }

  start() {
    this.state.deck = buildDeck();
    this.state.discard = [];

    // Deal 3 cards to each player
    this.state.players = this.players.map(p => {
      const hand = [
        this.state.deck.pop(),
        this.state.deck.pop(),
        this.state.deck.pop()
      ];
      // Sort descending: the 2 highest are HP, lowest is shield
      hand.sort((a, b) => b.value - a.value);
      return {
        id: p.id,
        name: p.name,
        hp: [hand[0], hand[1]],      // face down, known only to player
        shield: hand[2],             // face down
        charged: [],                 // max 2 cards, face down
        eliminated: false,
        shieldRevealed: false,       // briefly revealed during attack
        hpRevealed: false,              // revealed after taking damage
        shieldPierced: false            // shield visible after being pierced (reset on change)
      };
    });

    // Le joueur avec le moins de PV commence, tiebreak = plus petite carte, puis hasard
    const sorted = [...this.state.players].map((p, i) => ({
      i,
      sum: p.hp.reduce((s, c) => s + c.value, 0),
      min: Math.min(...p.hp.map(c => c.value)),
      rand: Math.random()
    })).sort((a, b) => a.sum - b.sum || a.min - b.min || a.rand - b.rand);
    this.state.activePlayerIndex = sorted[0].i;
    this.state.status = 'playing';
    this.state.pendingAction = null;

    this.io.to(this.roomCode).emit('game_started');
    this.io.to(this.roomCode).emit('action_log', `🛡️ La partie de Charger commence ! ${this.getActivePlayer().name} commence.`);
    this.broadcastState();
  }

  getActivePlayer() {
    return this.state.players[this.state.activePlayerIndex];
  }

  getAlivePlayers() {
    return this.state.players.filter(p => !p.eliminated);
  }

  handleAction(playerId, actionType, data) {
    if (this.state.status !== 'playing') return;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player || player.eliminated) return;

    // During pending attack resolution, only target can respond
    if (this.state.pendingAction) {
      if (actionType === 'resolve_attack' && this.state.pendingAction.targetId === playerId) {
        this.resolveAttack();
      }
      return;
    }

    const isActive = player.id === this.getActivePlayer().id;
    if (!isActive) return;

    if (actionType === 'draw') {
      if (this.state.deck.length === 0) this.reshuffleDiscardIntoDeck();

      const drawnCard = this.state.deck.pop();
      if (!drawnCard) {
        // Aucune carte nulle part (cas extrême) : on passe le tour proprement plutôt que de crasher
        this.io.to(this.roomCode).emit('action_log', `⏭️ Plus aucune carte en jeu, ${player.name} passe son tour.`);
        this.advanceTurn();
        return;
      }
      player.drawnCard = drawnCard; // temporary, will be used in next action

      this.io.to(this.roomCode).emit('action_log', `🎴 ${player.name} pioche une carte.`);
      this.broadcastState();
    }

    else if (actionType === 'attack') {
      // data: { targetId }
      if (!player.drawnCard) return;

      const target = this.state.players.find(p => p.id === data.targetId && !p.eliminated);
      if (!target || target.id === player.id) return;

      // Must use all charged cards + drawn card
      const attackCards = [...player.charged, player.drawnCard];

      // Remove charged cards from player
      player.charged = [];
      player.drawnCard = null;

      this.state.pendingAction = {
        type: 'attack',
        attackerId: player.id,
        targetId: target.id,
        attackCards
      };

      const totalAttack = attackCards.reduce((s, c) => s + c.value, 0);
      this.io.to(this.roomCode).emit('action_log', `⚔️ ${player.name} attaque ${target.name} avec ${attackCards.length} carte(s) !`);

      // Reveal shield to everyone temporarily
      target.shieldRevealed = true;
      this.broadcastState();

    }

    else if (actionType === 'change_shield') {
      // data: { targetId } - can be self or opponent
      if (!player.drawnCard) return;

      const target = this.state.players.find(p => p.id === data.targetId && !p.eliminated);
      if (!target) return;

      const oldShield = target.shield;
      target.shield = player.drawnCard;
      target.shieldRevealed = false;
      target.shieldPierced = false; // nouveau bouclier = recaché pour tout le monde
      player.drawnCard = null;

      this.state.discard.push(oldShield);

      const isSelf = target.id === player.id;
      if (isSelf) {
        this.io.to(this.roomCode).emit('action_log', `🛡️ ${player.name} change son propre bouclier.`);
      } else {
        this.io.to(this.roomCode).emit('action_log', `🛡️ ${player.name} change le bouclier de ${target.name}.`);
      }
      // Notify everyone who just had their shield changed
      this.io.to(this.roomCode).emit('shield_changed', { targetId: target.id, targetName: target.name });

      this.advanceTurn();
    }

    else if (actionType === 'charge') {
      // data: { targetId }
      if (!player.drawnCard) return;
      if (player.charged.length >= 2) return;

      const target = this.state.players.find(p => p.id === data.targetId && !p.eliminated);
      if (!target) return;

      // Can only charge yourself (rules: charge anyone, but it's you who holds the charged cards)
      // Actually rules say charge anyone — the cards are placed next to that player
      // We'll implement: charge goes to target's charged pile (others can set traps... interesting!)
      if (target.charged.length >= 2) {
        this.io.to(this.roomCode).emit('action_log', `☢️ ${target.name} a déjà 2 cartes chargées !`);
        return;
      }

      target.charged.push(player.drawnCard);
      player.drawnCard = null;

      this.io.to(this.roomCode).emit('action_log', `☢️ ${player.name} charge ${target.id === player.id ? 'ses propres cartes' : target.name + ' (+1 carte chargée)'}.`);
      this.advanceTurn();
    }

    else if (actionType === 'discard_drawn') {
      // Fallback: discard the drawn card and end turn (shouldn't normally happen but safety valve)
      if (!player.drawnCard) return;
      this.state.discard.push(player.drawnCard);
      player.drawnCard = null;
      this.advanceTurn();
    }
  }

  resolveAttack() {
    if (!this.state.pendingAction) return; // déjà résolue (double clic sur OK, etc.)
    const { attackerId, targetId, attackCards } = this.state.pendingAction;
    this.state.pendingAction = null;

    const attacker = this.state.players.find(p => p.id === attackerId);
    const target = this.state.players.find(p => p.id === targetId);

    if (!attacker || !target) {
      console.error(`⚠️ resolveAttack: attaquant ou cible introuvable (attacker=${attackerId}, target=${targetId})`);
      this.advanceTurn();
      return;
    }

    const totalAttack = attackCards.reduce((s, c) => s + c.value, 0);
    if (!target.shield) {
      console.error(`⚠️ resolveAttack: ${target.name} n'a pas de bouclier, attaque annulée.`);
      attackCards.forEach(c => this.state.discard.push(c));
      this.advanceTurn();
      return;
    }
    const shieldValue = target.shield.value;
    console.log(`[charger] resolveAttack: ${attacker.name} → ${target.name} | attaque ${totalAttack} vs bouclier ${shieldValue} | PV cible ${target.hp.reduce((s, c) => s + c.value, 0)}`);

    target.shieldRevealed = false;
    target.shieldPierced = true; // bouclier toujours visible après une attaque

    if (totalAttack <= shieldValue) {
      // Attack blocked
      attackCards.forEach(c => this.state.discard.push(c));
      this.io.to(this.roomCode).emit('action_log', `🛡️ Attaque bloquée ! ${totalAttack} ≤ ${shieldValue} (bouclier de ${target.name}).`);
      this.advanceTurn();
      return;
    }

    // Attack lands
    const damage = totalAttack - shieldValue;
    attackCards.forEach(c => this.state.discard.push(c));

    this.io.to(this.roomCode).emit('action_log', `💥 ${totalAttack} > ${shieldValue} ! ${target.name} prend ${damage} dégât(s).`);

    // Also discard target's charged cards
    if (target.charged.length > 0) {
      target.charged.forEach(c => this.state.discard.push(c));
      target.charged = [];
      this.io.to(this.roomCode).emit('action_log', `🔥 Les cartes chargées de ${target.name} sont défaussées aussi !`);
    }

    const currentHpSum = target.hp.reduce((s, c) => s + c.value, 0);
    const newHpTarget = currentHpSum - damage;

	if (newHpTarget <= 0) {
      // Eliminated : toutes ses cartes retournent dans la défausse pour rester en circulation
      target.hp.forEach(c => this.state.discard.push(c));
      target.hp = [];
      if (target.shield) { this.state.discard.push(target.shield); target.shield = null; }
      if (target.charged && target.charged.length > 0) {
        target.charged.forEach(c => this.state.discard.push(c));
        target.charged = [];
      }
      if (target.drawnCard) { this.state.discard.push(target.drawnCard); target.drawnCard = null; }
      target.eliminated = true;
	  this.io.to(this.roomCode).emit('action_log', `💀 ${target.name} est éliminé(e) !`);

      const alive = this.getAlivePlayers();
      if (alive.length === 1) {
        this.endGame(alive[0]);
        return;
      }

      // Skip eliminated players when advancing
      this.advanceTurn();
      return;
    }

    // Reshuffle discard into deck if deck is empty
    if (this.state.deck.length === 0) this.reshuffleDiscardIntoDeck();

    // Replace ONE HP card: find which card can absorb the damage (card.value - damage >= 1)
    // Build allAvailable AFTER reshuffle so we have the full deck available
    const allAvailable = [...this.state.deck].reverse().concat([...this.state.discard].reverse());

    let replacedIndex = -1;
    let replacementCard = null;

    // Try each HP card: find one where (card.value - damage) >= 1 and a replacement exists
    for (let i = 0; i < target.hp.length; i++) {
      const neededValue = target.hp[i].value - damage;
      if (neededValue < 1) continue;
      const found = allAvailable.find(c => c.value === neededValue);
      if (found) {
        replacedIndex = i;
        replacementCard = found;
        break;
      }
    }

    // Fallback: replace BOTH HP cards with two new cards summing to newHpTarget
    if (replacedIndex === -1) {
      let card1 = null, card2 = null;
      for (let i = 0; i < allAvailable.length; i++) {
        const v1 = allAvailable[i].value;
        if (v1 >= newHpTarget) continue; // card2 would need to be 0 or negative
        const needed2 = newHpTarget - v1;
        if (needed2 < 1 || needed2 > 13) continue;
        const j = allAvailable.findIndex((c, idx) => idx !== i && c.value === needed2);
        if (j !== -1) {
          card1 = allAvailable[i];
          card2 = allAvailable[j];
          break;
        }
      }

      if (card1 && card2) {
        target.hp.forEach(c => this.state.discard.push(c));
        target.hp = [];
        this.removeCardFromPiles(card1);
        this.removeCardFromPiles(card2);
        target.hp = [card1, card2];
        target.hpRevealed = true;
        target.shieldPierced = true;
        this.io.to(this.roomCode).emit('action_log', `❤️ ${target.name} a maintenant ${newHpTarget} PV.`);
        this.advanceTurn();
        return;
      }

      // Dernier recours garanti : on reconstruit la main de PV avec des cartes
      // (piochées si dispo, sinon synthétisées) dont la somme vaut exactement newHpTarget.
      const hpValues = newHpTarget <= 1
        ? [1]
        : [Math.min(13, newHpTarget - 1), newHpTarget - Math.min(13, newHpTarget - 1)];
      const takeCardOfValue = (v) => {
        let idx = this.state.deck.findLastIndex(c => c.value === v);
        if (idx !== -1) return this.state.deck.splice(idx, 1)[0];
        idx = this.state.discard.findLastIndex(c => c.value === v);
        if (idx !== -1) return this.state.discard.splice(idx, 1)[0];
        return { suit: '♠', value: v, synthetic: true };
      };
      target.hp.forEach(c => this.state.discard.push(c));
      target.hp = hpValues.map(takeCardOfValue);
      target.hpRevealed = true;
      target.shieldPierced = true;
      this.io.to(this.roomCode).emit('action_log', `❤️ ${target.name} a maintenant ${newHpTarget} PV.`);
      this.advanceTurn();
      return;
    }

    // Discard the replaced card, insert the replacement
    this.state.discard.push(target.hp[replacedIndex]);
    this.removeCardFromPiles(replacementCard);
    target.hp[replacedIndex] = replacementCard;

    target.hpRevealed = true;
    target.shieldPierced = true;
    this.io.to(this.roomCode).emit('action_log', `❤️ ${target.name} a maintenant ${newHpTarget} PV.`);

    this.advanceTurn();
  }

  removeCardFromPiles(card) {
    // Remove from discard first, then deck
    let idx = this.state.discard.findLastIndex(c => c.suit === card.suit && c.value === card.value);
    if (idx !== -1) { this.state.discard.splice(idx, 1); return; }
    idx = this.state.deck.findLastIndex(c => c.suit === card.suit && c.value === card.value);
    if (idx !== -1) { this.state.deck.splice(idx, 1); }
  }

  reshuffleDiscardIntoDeck() {
    if (this.state.discard.length === 0) return;
    const cards = [...this.state.discard];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.state.deck.push(...cards);
    this.state.discard = [];
    this.io.to(this.roomCode).emit('action_log', `🔀 La pioche est vide, on mélange la défausse.`);
  }

  advanceTurn() {
    const alive = this.getAlivePlayers();
    if (alive.length <= 1) {
      this.endGame(alive[0]);
      return;
    }

    // Move to next alive player
    let next = (this.state.activePlayerIndex + 1) % this.state.players.length;
    while (this.state.players[next].eliminated) {
      next = (next + 1) % this.state.players.length;
    }
    this.state.activePlayerIndex = next;

    const newActive = this.getActivePlayer();
    this.io.to(this.roomCode).emit('action_log', `➡️ C'est au tour de ${newActive.name}.`);
    this.broadcastState();
  }

  endGame(winner) {
    this.state.status = 'finished';
    this.io.to(this.roomCode).emit('action_log', `🏆 ${winner ? winner.name : '???'} remporte la partie !`);

    this.io.to(this.roomCode).emit('game_over', {
      reason: winner ? `${winner.name} est le dernier survivant !` : 'Partie terminée !',
      winner: winner ? { id: winner.id, name: winner.name } : null,
      hostName: this.hostName,
      players: this.state.players.map(p => ({
        id: p.id,
        name: p.name,
        eliminated: p.eliminated
      }))
    });

    this.broadcastState();
  }

  broadcastState() {
    this.state.players.forEach(player => {
      const myPlayer = this.state.players.find(p => p.id === player.id);

      const playersView = this.state.players.map(p => {
        const isSelf = p.id === player.id;
        const isTarget = this.state.pendingAction?.targetId === p.id;
        const isAttacker = this.state.pendingAction?.attackerId === p.id;

        return {
          id: p.id,
          name: p.name,
          eliminated: p.eliminated,
          chargedCount: p.charged.length,
          // HP: toujours visibles pour tout le monde
          hp: p.hp,
          hpRevealed: true,
          hpSum: p.hp.reduce((s, c) => s + c.value, 0),
          // Shield: show to self, during attack reveal, after pierced (until changed), or eliminated
          shield: (isSelf || p.shieldRevealed || p.shieldPierced || p.eliminated) ? p.shield : { hidden: true },
          shieldRevealed: p.shieldRevealed,
          shieldPierced: p.shieldPierced,
          // Charged cards: hidden to everyone (including self — that's part of the game!)
          charged: p.charged.map(() => ({ hidden: true })),
          // Drawn card: hidden to everyone (including self) until attack resolution
          drawnCard: p.drawnCard ? { hidden: true } : null,
          hasDrawnCard: !!p.drawnCard
        };
      });

      this.io.to(player.id).emit('update_board_state', {
        status: this.state.status,
        activePlayerId: this.getActivePlayer().id,
        deckCount: this.state.deck.length,
        discardCount: this.state.discard.length,
        discardTop: this.state.discard.length > 0 ? this.state.discard[this.state.discard.length - 1] : null,
        players: playersView,
        myId: player.id,
        isHost: player.name === this.hostName,
        pendingAction: this.state.pendingAction ? {
          type: this.state.pendingAction.type,
          attackerId: this.state.pendingAction.attackerId,
          targetId: this.state.pendingAction.targetId,
          attackTotal: this.state.pendingAction.attackCards.reduce((s, c) => s + c.value, 0),
          attackCards: this.state.pendingAction.attackCards,
          attackCardCount: this.state.pendingAction.attackCards.length
        } : null
      });
    });
  }

  reconnectPlayer(newSocketId, playerName) {
    const player = this.state.players.find(p => p.name === playerName);
    if (!player) return false;

    const oldId = player.id;
    player.id = newSocketId;

    // Reporter le nouvel id partout où l'ancien était référencé,
    // sinon une attaque en cours reste bloquée (la cible ne peut plus la résoudre).
    if (this.state.pendingAction) {
      if (this.state.pendingAction.targetId === oldId) this.state.pendingAction.targetId = newSocketId;
      if (this.state.pendingAction.attackerId === oldId) this.state.pendingAction.attackerId = newSocketId;
    }
    return true;
  }
}

module.exports = Charger;