// server/games/loupgarou.js

class LoupGarou {
  constructor(roomCode, playersData, io) {
    this.roomCode = roomCode;
    this.io = io;
    
    // Initialisation des joueurs
    this.players = playersData.map(p => ({
      id: p.id,
      name: p.name,
      role: null,
      isAlive: true,
      isLover: false,
      hasVoted: false, // Pour le jour ou les loups
      potions: { heal: true, kill: true } // Pour la sorcière
    }));

    // L'état global de la partie
    this.state = {
      status: 'starting', // starting, playing, finished
      phase: 'lobby', // lobby, cupidon, voyante, loups, sorciere, day_debate, day_vote
      turn: 0,
      winner: null,
      nightVictims: [],
      votes: {},
      logs: []
    };
  }

  start() {
    this.assignRoles();
    this.state.status = 'playing';
    this.addLog("Le village s'endort pour sa première nuit...");
    this.nextPhase('cupidon');
  }

  assignRoles() {
    const nbPlayers = this.players.length;
    let deck = [];

    if (nbPlayers >= 4) {
      deck.push('Voyante', 'Loup-Garou', 'Loup-Garou');
      if (nbPlayers >= 5) deck.push('Sorciere');
      if (nbPlayers >= 6) deck.push('Cupidon');
      if (nbPlayers >= 7) deck.push('Chasseur');
      if (nbPlayers >= 8) deck.push('Loup-Garou');
      
      while (deck.length < nbPlayers) {
        deck.push('Villageois');
      }
    } else {
      deck = ['Loup-Garou', 'Voyante', 'Villageois', 'Villageois'].slice(0, nbPlayers);
    }

    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.players.forEach((player, i) => {
      player.role = deck[i];
    });
  }
  
  nextPhase(forcedPhase = null) {
    if (this.checkWinCondition()) return;

    this.state.votes = {};
    this.players.forEach(p => p.hasVoted = false);

    const phasesSequence = ['voyante', 'loups', 'sorciere', 'day_debate', 'day_vote'];
    
    if (forcedPhase) {
      this.state.phase = forcedPhase;
    } else {
      let currentIndex = phasesSequence.indexOf(this.state.phase);
      let nextIndex = currentIndex + 1;
      
      if (nextIndex >= phasesSequence.length) {
        nextIndex = 0;
        this.state.turn++;
        this.state.nightVictims = [];
      }
      this.state.phase = phasesSequence[nextIndex];
    }

    this.skipDeadRolesPhases();

    if (this.state.phase === 'day_debate') {
      this.resolveNight();
    }

    this.broadcastState();
  }

  skipDeadRolesPhases() {
    const aliveRoles = this.players.filter(p => p.isAlive).map(p => p.role);
    
    if (this.state.phase === 'cupidon' && (!aliveRoles.includes('Cupidon') || this.state.turn > 0)) this.nextPhase();
    else if (this.state.phase === 'voyante' && !aliveRoles.includes('Voyante')) this.nextPhase();
    else if (this.state.phase === 'sorciere' && !aliveRoles.includes('Sorciere')) this.nextPhase();
  }
  
  handleAction(playerId, actionType, targetId) {
    if (this.state.status !== 'playing') return;
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return;

    if (this.state.phase === 'voyante' && player.role === 'Voyante' && actionType === 'see') {
      const target = this.players.find(p => p.id === targetId);
      this.io.to(player.id).emit('voyante_result', { targetId: target.id, role: target.role });
      player.hasVoted = true;
      setTimeout(() => this.nextPhase(), 3000);
    }

    else if (this.state.phase === 'loups' && player.role === 'Loup-Garou' && actionType === 'vote') {
      this.state.votes[targetId] = (this.state.votes[targetId] || 0) + 1;
      player.hasVoted = true;
      
      const aliveWolves = this.players.filter(p => p.isAlive && p.role === 'Loup-Garou');
      if (aliveWolves.every(w => w.hasVoted)) {
        const target = Object.keys(this.state.votes).reduce((a, b) => this.state.votes[a] > this.state.votes[b] ? a : b);
        this.state.nightVictims.push(target);
        setTimeout(() => this.nextPhase(), 2000);
      }
      this.broadcastState();
    }
    
    else if (this.state.phase === 'sorciere' && player.role === 'Sorciere') {
      if (actionType === 'heal' && player.potions.heal) {
        this.state.nightVictims = this.state.nightVictims.filter(id => id !== targetId);
        player.potions.heal = false;
      } else if (actionType === 'kill' && player.potions.kill) {
        if (!this.state.nightVictims.includes(targetId)) this.state.nightVictims.push(targetId);
        player.potions.kill = false;
      }
      player.hasVoted = true;
      setTimeout(() => this.nextPhase(), 2000);
    }

    else if (this.state.phase === 'day_vote' && actionType === 'vote') {
      this.state.votes[targetId] = (this.state.votes[targetId] || 0) + 1;
      player.hasVoted = true;
      
      const alivePlayers = this.players.filter(p => p.isAlive);
      if (alivePlayers.every(p => p.hasVoted)) {
        this.resolveDayVote();
      } else {
        this.broadcastState();
      }
    }
  }

  resolveNight() {
    this.addLog("Le soleil se lève sur le village...");
    if (this.state.nightVictims.length === 0) {
      this.addLog("Merveilleuse nouvelle, personne n'est mort cette nuit !");
    } else {
      this.state.nightVictims.forEach(victimId => {
        this.killPlayer(victimId);
      });
    }
  }

  resolveDayVote() {
    let maxVotes = 0;
    let victims = [];
    
    for (const [targetId, count] of Object.entries(this.state.votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        victims = [targetId];
      } else if (count === maxVotes) {
        victims.push(targetId);
      }
    }

    if (victims.length === 1) {
      this.killPlayer(victims[0]);
      this.addLog(`Le village a décidé d'éliminer un joueur suite au vote.`);
    } else {
      this.addLog("Égalité parfaite aux votes ! Le village n'élimine personne aujourd'hui.");
    }
    
    setTimeout(() => this.nextPhase(), 5000);
  }

  killPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player && player.isAlive) {
      player.isAlive = false;
      this.addLog(`Un joueur est mort. Il s'agissait de : ${player.role}`);
      
      if (player.role === 'Chasseur') {
         this.addLog("Le Chasseur a été tué ! Il doit emporter quelqu'un avec lui...");
         this.state.phase = 'chasseur_revenge';
      }
    }
  }

  checkWinCondition() {
    const alivePlayers = this.players.filter(p => p.isAlive);
    const aliveWolves = alivePlayers.filter(p => p.role === 'Loup-Garou');
    
    if (aliveWolves.length === 0) {
      this.state.status = 'finished';
      this.state.winner = 'village';
      this.addLog("VICTOIRE DU VILLAGE ! Tous les loups ont été éliminés.");
      this.broadcastState();
      return true;
    } else if (aliveWolves.length >= alivePlayers.length / 2) {
      this.state.status = 'finished';
      this.state.winner = 'loups';
      this.addLog("VICTOIRE DES LOUPS ! Ils sont désormais majoritaires.");
      this.broadcastState();
      return true;
    }
    return false;
  }

  addLog(msg) {
    this.state.logs.push(msg);
    this.io.to(this.roomCode).emit('game_log', msg);
  }

  broadcastState() {
    this.players.forEach(player => {
      
      const safePlayersList = this.players.map(p => {
        let isRoleVisible = false;
        if (p.id === player.id) isRoleVisible = true;
        if (!player.isAlive || this.state.status === 'finished') isRoleVisible = true;
        if (player.role === 'Loup-Garou' && p.role === 'Loup-Garou') isRoleVisible = true;

        return {
          id: p.id,
          name: p.name,
          isAlive: p.isAlive,
          hasVoted: p.hasVoted,
          role: isRoleVisible ? p.role : '???'
        };
      });

      let safeVotes = this.state.votes;
      if (this.state.phase === 'loups' && player.role !== 'Loup-Garou' && player.isAlive) {
        safeVotes = {}; 
      }

      this.io.to(player.id).emit('update_loupgarou_state', {
        status: this.state.status,
        phase: this.state.phase,
        turn: this.state.turn,
        winner: this.state.winner,
        myRole: player.role,
        isAlive: player.isAlive,
        potions: player.potions,
        nightVictims: (player.role === 'Sorciere' && this.state.phase === 'sorciere') ? this.state.nightVictims : [], // Seule la sorcière voit les morts de la nuit en cours
        players: safePlayersList,
        votes: safeVotes
      });
    });
  }
}

module.exports = LoupGarou;