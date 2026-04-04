// server/games/loupgarou.js

class LoupGarou {
  constructor(roomCode, playersData, io, roleComposition = null) {
    this.roomCode = roomCode;
    this.io = io;
    this.roleComposition = roleComposition; // Composition custom envoyée par le host
    
    // Initialisation des joueurs
    this.players = playersData.map(p => ({
      id: p.id,
      name: p.name,
      role: null,
      isAlive: true,
      isLover: false,
      isMayor: false,
      hasVoted: false, 
      isReady: false, // Pour skip le timer
      potions: { heal: true, kill: true } // Pour la sorcière
    }));

    // L'état global de la partie
    this.state = {
      status: 'starting', // starting, playing, finished
      phase: 'lobby', 
      turn: 0,
      winner: null,
      nightVictims: [],
      votes: {},
      mayorVotes: {},
      logs: [],
      timeLeft: 0,
      deadHunterId: null,
      deadMayorId: null
    };

    this.timer = null;
  }

  start() {
    this.assignRoles();
    this.state.status = 'playing';
    this.addLog("Le village s'endort pour sa première nuit...");
    this.startPhase('cupidon');
  }

  assignRoles() {
    const nbPlayers = this.players.length;
    let deck = [];

    if (this.roleComposition && this.roleComposition.length === nbPlayers) {
      // Utiliser la composition custom du host
      deck = [...this.roleComposition];
      console.log(`🎭 Composition custom utilisée : ${deck.join(', ')}`);
    } else if (nbPlayers >= 4) {
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

    // Mélanger le deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.players.forEach((player, i) => {
      player.role = deck[i];
    });
  }
  
  isPhaseValidCheck(phase) {
    const aliveRoles = this.players.filter(p => p.isAlive).map(p => p.role);
    if (phase === 'cupidon') return aliveRoles.includes('Cupidon') && this.state.turn === 0;
    if (phase === 'voyante') return aliveRoles.includes('Voyante');
    if (phase === 'loups') return aliveRoles.includes('Loup-Garou');
    if (phase === 'sorciere') return aliveRoles.includes('Sorciere');
    if (phase === 'mayor_election') return this.state.turn === 1 && !this.players.some(p => p.isMayor);
    if (phase === 'mayor_succession') return this.state.deadMayorId !== null;
    if (phase === 'chasseur_revenge') return this.state.deadHunterId !== null;
    return true;
  }

  startPhase(forcedPhase = null) {
    if (this.checkWinCondition()) return;

    this.state.votes = {};
    this.state.mayorVotes = {};
    this.players.forEach(p => { p.hasVoted = false; p.isReady = false; });

    const phasesSequence = ['cupidon', 'voyante', 'loups', 'sorciere', 'day_debate', 'mayor_election', 'day_vote'];
    
    if (forcedPhase) {
      this.state.phase = forcedPhase;
    } else {
      let currentIndex = phasesSequence.indexOf(this.state.phase);
      let nextIndex = currentIndex + 1;
      
      if (nextIndex >= phasesSequence.length) {
        nextIndex = 1; // On skip Cupidon qui n'est qu'au tour 0 (index 0)
        this.state.turn++;
        this.state.nightVictims = [];
      }
      this.state.phase = phasesSequence[nextIndex];
    }

    // Skip de phases si rôle mort ou inutile
    if (!this.isPhaseValidCheck(this.state.phase)) {
      return this.startPhase(); // Passe à la phase suivante
    }

    if (this.state.phase === 'day_debate') {
      this.resolveNight();
      if (this.state.phase !== 'day_debate') return; // Si la résolution déclenche Chasseur/Maire, la phase change, on stop
    }

    this.startTimerForPhase();
    this.broadcastState();
  }

  startTimerForPhase() {
    if (this.timer) clearInterval(this.timer);
    
    if (['cupidon', 'voyante', 'loups', 'sorciere', 'chasseur_revenge', 'mayor_succession'].includes(this.state.phase)) {
      this.state.timeLeft = 20;
    } else if (['mayor_election', 'day_debate'].includes(this.state.phase)) {
      this.state.timeLeft = 180; // 3 minutes
    } else if (this.state.phase === 'day_vote') {
      this.state.timeLeft = 30;
    } else {
      this.state.timeLeft = 0;
    }

    if (this.state.timeLeft > 0) {
      this.timer = setInterval(() => {
        this.state.timeLeft--;
        if (this.state.timeLeft <= 0) {
          clearInterval(this.timer);
          this.handleTimerEnd();
        } else {
          this.io.to(this.roomCode).emit('timer_update', this.state.timeLeft);
        }
      }, 1000);
    }
  }

  handleTimerEnd() {
    if (this.state.phase === 'loups') {
      this.resolveLoupVote();
    } else if (this.state.phase === 'day_vote') {
      this.resolveDayVote();
    } else if (this.state.phase === 'mayor_election') {
      this.resolveMayorElection();
    } else if (this.state.phase === 'chasseur_revenge') {
      this.addLog("Le Chasseur n'a pas pu tirer à temps...");
      this.state.deadHunterId = null;
      this.checkChasseurRevengeEnd();
    } else if (this.state.phase === 'mayor_succession') {
      this.randomMayorSuccession();
    } else {
      // Pour les autres (voyante, sorciere, cupidon...), on passe
      this.startPhase();
    }
  }

  handleAction(playerId, actionType, targetId) {
    if (this.state.status !== 'playing') return;
    
    const player = this.players.find(p => p.id === playerId);
    
    // Action Ready / Passer
    if (actionType === 'ready' && player.isAlive) {
      player.isReady = true;
      const alivePlayers = this.players.filter(p => p.isAlive);
      if (alivePlayers.every(p => p.isReady)) {
        clearInterval(this.timer);
        this.handleTimerEnd();
      } else {
        this.broadcastState();
      }
      return;
    }

    // Le maire mort choisit son successeur
    if (this.state.phase === 'mayor_succession' && playerId === this.state.deadMayorId && actionType === 'mayor_successor') {
      const target = this.players.find(p => p.id === targetId);
      if (target && target.isAlive) {
        clearInterval(this.timer);
        target.isMayor = true;
        this.state.deadMayorId = null;
        this.addLog(`${target.name} a été nommé nouveau Maire par l'ancien !`);
        this.checkChasseurRevengeEnd();
      }
      return;
    }

    // Le chasseur mort choisit qui tirer
    if (this.state.phase === 'chasseur_revenge' && playerId === this.state.deadHunterId && actionType === 'chasseur_kill') {
      clearInterval(this.timer);
      this.state.deadHunterId = null;
      const targetName = this.players.find(p => p.id === targetId).name;
      this.addLog(`Le Chasseur tire dans son dernier souffle et abat ${targetName} !`);
      this.killPlayerSoft(targetId);
      this.checkChasseurRevengeEnd();
      return;
    }

    if (!player || !player.isAlive) return;

    if (this.state.phase === 'cupidon' && player.role === 'Cupidon' && actionType === 'cupidon_choose') {
      // targetId est un tableau d'ids, ex: [id1, id2]
      if (Array.isArray(targetId) && targetId.length === 2) {
        clearInterval(this.timer);
        this.players.forEach(p => {
          if (targetId.includes(p.id)) p.isLover = true;
        });
        player.hasVoted = true;
        this.addLog("Cupidon a décoché ses flèches de l'Amour.");
        setTimeout(() => this.startPhase(), 2000);
      }
    }

    else if (this.state.phase === 'voyante' && player.role === 'Voyante' && actionType === 'see') {
      const target = this.players.find(p => p.id === targetId);
      this.io.to(player.id).emit('voyante_result', { targetId: target.id, role: target.role });
      player.hasVoted = true;
      clearInterval(this.timer);
      setTimeout(() => this.startPhase(), 2000);
    }

    else if (this.state.phase === 'loups' && player.role === 'Loup-Garou' && actionType === 'vote') {
      this.state.votes[targetId] = (this.state.votes[targetId] || 0) + 1;
      player.hasVoted = true;
      
      const aliveWolves = this.players.filter(p => p.isAlive && p.role === 'Loup-Garou');
      if (aliveWolves.every(w => w.hasVoted)) {
        clearInterval(this.timer);
        this.resolveLoupVote();
      } else {
        this.broadcastState();
      }
    }
    
    else if (this.state.phase === 'sorciere' && player.role === 'Sorciere') {
      if (actionType === 'heal' && player.potions.heal) {
        this.state.nightVictims = this.state.nightVictims.filter(id => id !== targetId);
        player.potions.heal = false;
      } else if (actionType === 'kill' && player.potions.kill) {
        if (!this.state.nightVictims.includes(targetId)) this.state.nightVictims.push(targetId);
        player.potions.kill = false;
      } else if (actionType === 'skip') {
         // ne rien faire
      }
      player.hasVoted = true;
      clearInterval(this.timer);
      setTimeout(() => this.startPhase(), 2000);
    }

    else if (this.state.phase === 'mayor_election' && actionType === 'vote') {
      this.state.mayorVotes[targetId] = (this.state.mayorVotes[targetId] || 0) + 1;
      player.hasVoted = true;
      
      const alivePlayers = this.players.filter(p => p.isAlive);
      if (alivePlayers.every(p => p.hasVoted)) {
        clearInterval(this.timer);
        this.resolveMayorElection();
      } else {
        this.broadcastState();
      }
    }

    else if (this.state.phase === 'day_vote' && actionType === 'vote') {
      const voteWeight = player.isMayor ? 2 : 1; // Le maire a un vote double
      this.state.votes[targetId] = (this.state.votes[targetId] || 0) + voteWeight;
      player.hasVoted = true;
      
      const alivePlayers = this.players.filter(p => p.isAlive);
      if (alivePlayers.every(p => p.hasVoted)) {
        clearInterval(this.timer);
        this.resolveDayVote();
      } else {
        this.broadcastState();
      }
    }
  }

  resolveLoupVote() {
    if (Object.keys(this.state.votes).length > 0) {
      const target = Object.keys(this.state.votes).reduce((a, b) => this.state.votes[a] > this.state.votes[b] ? a : b);
      if (!this.state.nightVictims.includes(target)) {
        this.state.nightVictims.push(target);
      }
    }
    this.broadcastState();
    setTimeout(() => this.startPhase(), 2000);
  }

  resolveMayorElection() {
    if (Object.keys(this.state.mayorVotes).length > 0) {
      let maxVotes = 0;
      let targetCandidates = [];
      for (const [targetId, count] of Object.entries(this.state.mayorVotes)) {
        if (count > maxVotes) {
          maxVotes = count;
          targetCandidates = [targetId];
        } else if (count === maxVotes) {
          targetCandidates.push(targetId);
        }
      }
      
      // En cas d'égalité on prend quelqu'un au hasard parmi les vainqueurs
      const elected = targetCandidates[Math.floor(Math.random() * targetCandidates.length)];
      const player = this.players.find(p => p.id === elected);
      if (player) {
        player.isMayor = true;
        this.addLog(`Le village a élu ${player.name} en tant que Maire !`);
      }
    } else {
      this.addLog(`Le village n'a pas pu se décider pour un Maire.`);
    }
    this.broadcastState();
    setTimeout(() => this.startPhase(), 3000);
  }

  resolveNight() {
    this.addLog("Le soleil se lève sur le village...");
    if (this.state.nightVictims.length === 0) {
      this.addLog("Merveilleuse nouvelle, personne n'est mort cette nuit !");
    } else {
       const victims = [...this.state.nightVictims];
       victims.forEach(victimId => {
         this.killPlayerSoft(victimId);
       });
    }
    
    if (this.state.deadHunterId !== null) {
      this.state.phase = 'chasseur_revenge';
    } else if (this.state.deadMayorId !== null) {
      this.state.phase = 'mayor_succession';
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
      this.addLog(`Le village a décidé d'éliminer un joueur suite au vote.`);
      this.killPlayerSoft(victims[0]);
    } else {
      this.addLog("Égalité aux votes ! Le village n'élimine personne aujourd'hui.");
    }
    
    this.checkChasseurRevengeEnd();
  }

  killPlayerSoft(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return;

    player.isAlive = false;
    this.addLog(`${player.name} est mort. Il s'agissait de : ${player.role}`);

    if (player.isMayor) {
      this.state.deadMayorId = player.id;
    }

    if (player.role === 'Chasseur') {
      this.state.deadHunterId = player.id;
    }

    // Gestion de l'amour
    if (player.isLover) {
      const otherLover = this.players.find(p => p.isLover && p.id !== player.id && p.isAlive);
      if (otherLover) {
        this.addLog(`${otherLover.name} meurt de chagrin suite à la mort de sa moitié... Il/Elle était : ${otherLover.role}`);
        otherLover.isAlive = false;
        if (otherLover.isMayor) this.state.deadMayorId = otherLover.id;
        if (otherLover.role === 'Chasseur') this.state.deadHunterId = otherLover.id;
      }
    }
  }

  checkChasseurRevengeEnd() {
    this.broadcastState();
    // S'il y a un mort à gérer post-mort :
    if (this.state.deadHunterId !== null) {
      this.startPhase('chasseur_revenge');
    } else if (this.state.deadMayorId !== null) {
      this.startPhase('mayor_succession');
    } else {
      // Reprendre normalement 
      if (this.state.phase === 'day_vote') {
        setTimeout(() => this.startPhase(), 5000); 
      } else if (this.state.phase === 'day_debate') {
        // La nuit est résolue et les morts post-nuit traités, on peut relancer startPhase
        setTimeout(() => this.startPhase(), 3000);
      } else {
        setTimeout(() => this.startPhase(), 3000);
      }
    }
  }

  randomMayorSuccession() {
    this.addLog("Le maire mort n'a pas nommé de successeur... Le hasard choisit.");
    const alivePlayers = this.players.filter(p => p.isAlive);
    if (alivePlayers.length > 0) {
      const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      target.isMayor = true;
      this.addLog(`${target.name} est désigné Maire aléatoirement.`);
    }
    this.state.deadMayorId = null;
    this.checkChasseurRevengeEnd();
  }

  checkWinCondition() {
    const alivePlayers = this.players.filter(p => p.isAlive);
    if (alivePlayers.length === 0) {
      this.state.status = 'finished';
      this.state.winner = 'draw';
      this.addLog("Tout le monde est mort ! C'est un match nul.");
      this.broadcastState();
      return true;
    }

    const aliveWolves = alivePlayers.filter(p => p.role === 'Loup-Garou');

    // Victoire des amoureux (seuls survivants et camps différents)
    if (alivePlayers.length === 2 && alivePlayers.every(p => p.isLover)) {
      if (aliveWolves.length === 1) { // 1 loup + 1 non-loup
        this.state.status = 'finished';
        this.state.winner = 'lovers';
        this.addLog("VICTOIRE DE L'AMOUR ! Les amoureux sont les seuls survivants !");
        this.broadcastState();
        return true;
      }
    }

    if (aliveWolves.length === 0) {
      this.state.status = 'finished';
      this.state.winner = 'village';
      this.addLog("VICTOIRE DU VILLAGE ! Tous les loups ont été éliminés.");
      this.broadcastState();
      return true;
    } else if (aliveWolves.length >= alivePlayers.length / 2) {
      const remainingVillage = alivePlayers.length - aliveWolves.length;
      if (aliveWolves.length > remainingVillage) {
         this.state.status = 'finished';
         this.state.winner = 'loups';
         this.addLog("VICTOIRE DES LOUPS ! Ils sont désormais majoritaires.");
         this.broadcastState();
         return true;
      }
    }
    return false;
  }

  addLog(msg) {
    this.state.logs.push(msg);
    this.io.to(this.roomCode).emit('game_log', msg);
  }

  reconnectPlayer(newSocketId, playerName) {
    if (this.state.status !== 'playing') return false;
    const player = this.players.find(p => p.name === playerName);
    if (player) {
      player.id = newSocketId;
      return true;
    }
    return false;
  }

  broadcastState() {
    this.players.forEach(player => {
      
      const safePlayersList = this.players.map(p => {
        let isRoleVisible = false;
        if (p.id === player.id) isRoleVisible = true;
        if (!player.isAlive || this.state.status === 'finished') isRoleVisible = true;
        if (player.role === 'Loup-Garou' && p.role === 'Loup-Garou') isRoleVisible = true;
        
        // Les amoureux voient mutuellement leur rôle et le Cupidon voit son oeuvre
        if (player.isLover && p.isLover) isRoleVisible = true;
        
        let loverVisible = false;
        if (player.isLover && p.isLover) loverVisible = true;
        if (player.role === 'Cupidon' && p.isLover) loverVisible = true;

        return {
          id: p.id,
          name: p.name,
          isAlive: p.isAlive,
          isMayor: p.isMayor,
          isLover: loverVisible, // Amoureux ou Cupidon voient
          hasVoted: p.hasVoted,
          isReady: p.isReady,
          role: isRoleVisible ? p.role : '???'
        };
      });

      let safeVotes = this.state.votes;
      // La petite fille voit les votes des loups
      if (this.state.phase === 'loups' && player.role !== 'Loup-Garou' && player.role !== 'Petite Fille' && player.isAlive) {
        safeVotes = {}; 
      }
      
      let currentVotes = this.state.phase === 'mayor_election' ? this.state.mayorVotes : safeVotes;

      this.io.to(player.id).emit('update_loupgarou_state', {
        status: this.state.status,
        phase: this.state.phase,
        turn: this.state.turn,
        winner: this.state.winner,
        myRole: player.role,
        isAlive: player.isAlive,
        isMayor: player.isMayor,
        isLover: player.isLover,
        potions: player.potions,
        nightVictims: (player.role === 'Sorciere' && this.state.phase === 'sorciere') ? this.state.nightVictims : [],
        players: safePlayersList,
        votes: currentVotes,
        logs: this.state.logs,
        timeLeft: this.state.timeLeft
      });
    });
  }
}

module.exports = LoupGarou;