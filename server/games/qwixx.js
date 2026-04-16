// server/games/qwixx.js

const rollDie = () => Math.floor(Math.random() * 6) + 1;

class Qwixx {
  constructor(roomCode, playersData, io) {
    this.roomCode = roomCode;
    this.io = io;
    this.players = playersData;
    
    this.state = {
      status: 'waiting', // waiting, playing, finished
      activePlayerIndex: 0,
      phase: 'rolling', // rolling, deciding
      dice: { w1: 0, w2: 0, red: 0, yellow: 0, green: 0, blue: 0 },
      lockedColors: { red: false, yellow: false, green: false, blue: false },
      turnSubmissions: {},
      players: []
    };
  }

  start() {
    this.state.players = this.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      scoreSheet: {
        red: [],
        yellow: [],
        green: [],
        blue: [],
        penalties: 0
      },
      score: 0
    }));
    
    this.state.activePlayerIndex = Math.floor(Math.random() * this.players.length);
    this.state.status = 'playing';
    this.state.phase = 'rolling';
    
    this.io.to(this.roomCode).emit('game_started');
    this.io.to(this.roomCode).emit('action_log', `La partie de Qwixx commence ! ${this.getActivePlayer().name} lance les dés en premier.`);
    this.broadcastState();
  }

  getActivePlayer() {
    return this.state.players[this.state.activePlayerIndex];
  }

  handleAction(playerId, actionType, data) {
    if (this.state.status !== 'playing') return;

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;

    const isActive = player.id === this.getActivePlayer().id;

    if (actionType === 'roll' && isActive && this.state.phase === 'rolling') {
      this.state.dice = {
        w1: rollDie(),
        w2: rollDie(),
        red: this.state.lockedColors.red ? 0 : rollDie(),
        yellow: this.state.lockedColors.yellow ? 0 : rollDie(),
        green: this.state.lockedColors.green ? 0 : rollDie(),
        blue: this.state.lockedColors.blue ? 0 : rollDie()
      };
      this.state.phase = 'deciding';
      this.state.turnSubmissions = {};
      this.io.to(this.roomCode).emit('action_log', `${player.name} a lancé les dés.`);
      this.broadcastState();
    }
    else if (actionType === 'submit_turn' && this.state.phase === 'deciding') {
      // data: { actions: [{ color, value, source: 'white'|'color' }], penalty: boolean }
      
      // Prevent multiple submissions
      if (this.state.turnSubmissions[player.name]) return;

      this.state.turnSubmissions[player.name] = data;
      
      // Check if everyone has submitted
      if (Object.keys(this.state.turnSubmissions).length === this.state.players.length) {
        this.resolveTurn();
      } else {
        this.broadcastState(); // To update who is "ready"
      }
    }
  }

  resolveTurn() {
    const activePlayer = this.getActivePlayer();
    
    // Apply actions for all players
    for (const player of this.state.players) {
      const submission = this.state.turnSubmissions[player.name];
      // submission.actions contains valid selections made by the UI
      
      let gotPenalty = false;
      
      if (submission.penalty && player.id === activePlayer.id) {
        player.scoreSheet.penalties += 1;
        gotPenalty = true;
        this.io.to(this.roomCode).emit('action_log', `${player.name} ne coche rien et prend une pénalité.`);
      }

      if (submission.actions && submission.actions.length > 0) {
        const sortedActions = [...submission.actions].sort((a,b) => {
           // We process white first, maybe doesn't matter since client validates
           if (a.source === 'white') return -1;
           return 1;
        });

        for (const act of sortedActions) {
          const arr = player.scoreSheet[act.color];
          if (!arr.includes(act.value)) {
            arr.push(act.value);
            // sort array properly for display based on color
            if (act.color === 'red' || act.color === 'yellow') {
               arr.sort((a,b) => a - b);
            } else {
               arr.sort((a,b) => b - a);
            }
            
            // If they crossed off the limit and have enough crosses, unlock padlock
            // '12' for red/yellow, '2' for green/blue is the last number.
            const isLast = (act.color === 'red' || act.color === 'yellow') ? act.value === 12 : act.value === 2;
            
            if (isLast) {
               // Player actually crossed the lock. The client verified they have >= 5 beforehand.
               // We add 'lock' to the array to signify it's locked by them, or just +1 cross.
               if (!arr.includes('lock')) {
                  arr.push('lock');
                  this.state.lockedColors[act.color] = true;
                  this.io.to(this.roomCode).emit('action_log', `🔒 ${player.name} a verrouillé la couleur ${act.color.toUpperCase()} !`);
               }
            }
          }
        }
        
        let crossesDesc = submission.actions.map(a => `${a.value} ${a.color}`).join(' et ');
        this.io.to(this.roomCode).emit('action_log', `${player.name} a coché ${crossesDesc}.`);
      } else if (player.id !== activePlayer.id) {
        this.io.to(this.roomCode).emit('action_log', `${player.name} passe son tour.`);
      }
    }

    // Check End Game Condition
    const lockedCount = Object.values(this.state.lockedColors).filter(v => v).length;
    let maxPenalty = 0;
    this.state.players.forEach(p => { if (p.scoreSheet.penalties > maxPenalty) maxPenalty = p.scoreSheet.penalties; });

    if (lockedCount >= 2 || maxPenalty >= 4) {
      this.calculateScores();
      this.state.status = 'finished';
      let reason = lockedCount >= 2 ? "2 couleurs ont été verrouillées !" : "Un joueur a atteint 4 pénalités !";
      this.io.to(this.roomCode).emit('game_over', { reason: reason, players: this.state.players });
      this.broadcastState();
      return;
    }

    // Next turn
    this.state.activePlayerIndex = (this.state.activePlayerIndex + 1) % this.state.players.length;
    this.state.phase = 'rolling';
    this.state.turnSubmissions = {};
    const newActive = this.getActivePlayer();
    this.io.to(this.roomCode).emit('action_log', `C'est au tour de ${newActive.name} de lancer les dés.`);
    this.broadcastState();
  }

  getScoreForCrosses(count) {
    const scores = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78];
    return scores[Math.min(count, 12)];
  }

  calculateScores() {
    this.state.players.forEach(p => {
      let total = 0;
      ['red', 'yellow', 'green', 'blue'].forEach(color => {
         const count = p.scoreSheet[color].length;
         total += this.getScoreForCrosses(count);
      });
      total -= (p.scoreSheet.penalties * 5);
      p.score = total;
    });
    // Sort players by score
    this.state.players.sort((a,b) => b.score - a.score);
  }

  broadcastState() {
    this.state.players.forEach(player => {
      // Basic info for UI
      const readyPlayers = Object.keys(this.state.turnSubmissions);

      this.io.to(player.id).emit('update_board_state', {
        status: this.state.status,
        phase: this.state.phase,
        activePlayerId: this.getActivePlayer().id,
        dice: this.state.dice,
        lockedColors: this.state.lockedColors,
        readyPlayers: readyPlayers, // Noms des joueurs prêts
        players: this.state.players.map(p => ({
          id: p.id,
          name: p.name,
          scoreSheet: p.scoreSheet,
          score: p.score
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

module.exports = Qwixx;
