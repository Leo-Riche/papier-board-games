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
      potions: { heal: true, kill: true }, // Pour la sorcière
      faction: null, // Pour le Chien-Loup ('village' ou 'loups')
      isInfected: false, // Pour la victime de l'Infect
      hasInfected: false // Pour l'Infect
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
      logs: [],
      timeLeft: 0,
      deadHunterId: null,
      deadMayorId: null,
      hasWolfDied: false,
      centerCards: []
    };

    this.timer = null;
  }

  start() {
    this.assignRoles();
    this.state.status = 'playing';
    this.addLog("Le village s'endort pour sa première nuit...");
    this.startPhase('voleur');
  }

  assignRoles() {
    const nbPlayers = this.players.length;
    let deck = [];

    const hasVoleur = this.roleComposition && this.roleComposition.includes('Voleur');
    const expectedDeckSize = hasVoleur ? nbPlayers + 2 : nbPlayers;

    if (this.roleComposition && this.roleComposition.length === expectedDeckSize) {
      // Utiliser la composition custom du host
      deck = [...this.roleComposition];
      console.log(`🎭 Composition custom utilisée : ${deck.join(', ')}`);
      
      if (hasVoleur) {
         // S'assurer que le Voleur est distribué à un joueur (non mis au centre)
         const voleurIndex = deck.indexOf('Voleur');
         deck.splice(voleurIndex, 1); // deck a mtn length: nbPlayers + 1
         
         // Mélanger les N+1 cartes
         for (let i = deck.length - 1; i > 0; i--) {
           const j = Math.floor(Math.random() * (i + 1));
           [deck[i], deck[j]] = [deck[j], deck[i]];
         }
         
         // Les 2 dernières cartes vont au centre
         this.state.centerCards = deck.slice(nbPlayers - 1);
         
         // Les N-1 premières cartes vont aux joueurs, + le Voleur
         const playerDeck = deck.slice(0, nbPlayers - 1);
         playerDeck.push('Voleur');
         
         // On mélange le deck des joueurs
         for (let i = playerDeck.length - 1; i > 0; i--) {
           const j = Math.floor(Math.random() * (i + 1));
           [playerDeck[i], playerDeck[j]] = [playerDeck[j], playerDeck[i]];
         }
         
         // Distribution
         this.players.forEach((player, i) => {
           player.role = playerDeck[i];
         });
         
         return; // Attribution terminée
      }
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

    // Mélanger le deck (cas sans voleur ou sans composition)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.players.forEach((player, i) => {
      player.role = deck[i];
    });

    if (deck.length > nbPlayers) {
      this.state.centerCards = deck.slice(nbPlayers);
    }
  }
  
  isPlayerWolf(p) {
    const wolfRoles = ['Loup-Garou', 'Loup Garou Blanc', 'Loup Garou Voyant', 'Grand Méchant Loup', 'Infect Père des Loups'];
    return wolfRoles.includes(p.role) || p.isInfected || (p.role === 'Chien-Loup' && p.faction === 'loups');
  }

  getAliveWolvesCount() {
    return this.players.filter(p => p.isAlive && this.isPlayerWolf(p)).length;
  }

  isPhaseValidCheck(phase) {
    const aliveRoles = this.players.filter(p => p.isAlive).map(p => p.role);
    if (phase === 'voleur') return aliveRoles.includes('Voleur') && this.state.turn === 0;
    if (phase === 'chien_loup') return aliveRoles.includes('Chien-Loup') && this.state.turn === 0;
    if (phase === 'cupidon') return aliveRoles.includes('Cupidon') && this.state.turn === 0;
    if (phase === 'loup_voyant') return aliveRoles.includes('Loup Garou Voyant');
    if (phase === 'voyante') return aliveRoles.includes('Voyante');
    if (phase === 'loups') return this.getAliveWolvesCount() > 0;
    
    if (phase === 'infect_pere') {
      const pere = this.players.find(p => p.role === 'Infect Père des Loups' && p.isAlive && !p.hasInfected);
      return pere !== undefined && this.state.nightVictims.length > 0;
    }
    if (phase === 'grand_mechant_loup') return aliveRoles.includes('Grand Méchant Loup') && !this.state.hasWolfDied;
    if (phase === 'loup_blanc') return aliveRoles.includes('Loup Garou Blanc') && (this.state.turn > 0 && this.state.turn % 2 === 0);
    
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

    const phasesSequence = ['voleur', 'chien_loup', 'cupidon', 'loup_voyant', 'voyante', 'loups', 'infect_pere', 'grand_mechant_loup', 'loup_blanc', 'sorciere', 'day_debate', 'mayor_election', 'day_vote'];
    
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
    
    const nightActionPhases = ['voleur', 'chien_loup', 'cupidon', 'loup_voyant', 'voyante', 'loups', 'infect_pere', 'grand_mechant_loup', 'loup_blanc', 'sorciere', 'chasseur_revenge', 'mayor_succession'];
    
    if (nightActionPhases.includes(this.state.phase)) {
      this.state.timeLeft = 30; // on peut unifier à 30 secondes pour pallier le voleur ou garder 20s
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
    } else if (['grand_mechant_loup', 'loup_blanc', 'voleur'].includes(this.state.phase)) {
      if (this.state.phase === 'voleur') {
         const voleur = this.players.find(p => p.role === 'Voleur');
         if (voleur && !voleur.hasVoted) {
            const wolves = ['Loup-Garou', 'Loup Garou Blanc', 'Loup Garou Voyant', 'Grand Méchant Loup', 'Infect Père des Loups'];
            if (this.state.centerCards && this.state.centerCards.length === 2 && this.state.centerCards.every(c => wolves.includes(c))) {
               voleur.role = this.state.centerCards[Math.floor(Math.random() * 2)];
               this.addLog("Le Voleur a été contraint spirituellement de rejoindre la meute.");
            }
         }
      }
      this.startPhase();
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

    if (this.state.phase === 'voleur' && player.role === 'Voleur') {
       if (actionType === 'voleur_choose') {
          const idx = parseInt(targetId);
          if (idx === 0 || idx === 1) {
             player.role = this.state.centerCards[idx];
          }
       } else if (actionType === 'skip') {
          const wolves = ['Loup-Garou', 'Loup Garou Blanc', 'Loup Garou Voyant', 'Grand Méchant Loup', 'Infect Père des Loups'];
          if (this.state.centerCards.every(c => wolves.includes(c))) {
             return; // Rejeté, doit choisir
          }
       }
       player.hasVoted = true;
       clearInterval(this.timer);
       setTimeout(() => this.startPhase(), 2000);
    }

    else if (this.state.phase === 'cupidon' && player.role === 'Cupidon' && actionType === 'cupidon_choose') {
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

    else if (this.state.phase === 'chien_loup' && player.role === 'Chien-Loup' && actionType === 'choose_faction') {
      player.faction = targetId; // 'village' ou 'loups'
      player.hasVoted = true;
      clearInterval(this.timer);
      setTimeout(() => this.startPhase(), 2000);
    }

    else if ((this.state.phase === 'voyante' && player.role === 'Voyante' && actionType === 'see') || 
             (this.state.phase === 'loup_voyant' && player.role === 'Loup Garou Voyant' && actionType === 'see')) {
      const target = this.players.find(p => p.id === targetId);
      this.io.to(player.id).emit('voyante_result', { targetId: target.id, role: target.role });
      player.hasVoted = true;
      clearInterval(this.timer);
      setTimeout(() => this.startPhase(), 2000);
    }

    else if (this.state.phase === 'loups' && this.isPlayerWolf(player) && actionType === 'vote') {
      // Le Loup Garou Voyant ne peut pas voter sauf s'il est le dernier loup
      if (player.role === 'Loup Garou Voyant' && this.getAliveWolvesCount() > 1) return;

      this.state.votes[targetId] = (this.state.votes[targetId] || 0) + 1;
      player.hasVoted = true;
      
      const aliveVotingWolves = this.players.filter(p => p.isAlive && this.isPlayerWolf(p) && !(p.role === 'Loup Garou Voyant' && this.getAliveWolvesCount() > 1));
      if (aliveVotingWolves.every(w => w.hasVoted)) {
        clearInterval(this.timer);
        this.resolveLoupVote();
      } else {
        this.broadcastState();
      }
    }
    
    else if (this.state.phase === 'infect_pere' && player.role === 'Infect Père des Loups') {
       if (actionType === 'infect' && !player.hasInfected && this.state.nightVictims.length > 0) {
          const victimId = this.state.nightVictims[0];
          const victim = this.players.find(p => p.id === victimId);
          if (victim) {
             victim.isInfected = true;
             // L'Infecté ne meurt pas, on le retire de la liste
             this.state.nightVictims = this.state.nightVictims.filter(id => id !== victimId);
             player.hasInfected = true;
             // Pas de log public pour ça
          }
       }
       player.hasVoted = true;
       clearInterval(this.timer);
       setTimeout(() => this.startPhase(), 2000);
    }

    else if (this.state.phase === 'grand_mechant_loup' && player.role === 'Grand Méchant Loup') {
       if (actionType === 'kill') {
         if (!this.state.nightVictims.includes(targetId)) this.state.nightVictims.push(targetId);
       }
       player.hasVoted = true;
       clearInterval(this.timer);
       setTimeout(() => this.startPhase(), 2000);
    }
    
    else if (this.state.phase === 'loup_blanc' && player.role === 'Loup Garou Blanc') {
       if (actionType === 'kill') {
         const target = this.players.find(p => p.id === targetId);
         if (target && this.isPlayerWolf(target)) { // Ne peut tuer qu'un loup
            if (!this.state.nightVictims.includes(targetId)) this.state.nightVictims.push(targetId);
         }
       }
       player.hasVoted = true;
       clearInterval(this.timer);
       setTimeout(() => this.startPhase(), 2000);
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

    if (this.isPlayerWolf(player)) {
      this.state.hasWolfDied = true; // GML perd son pouvoir
    }

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
        this.addLog(`${otherLover.name} meurt de chagrin suite à la mort de sa moitié...`);
        this.killPlayerSoft(otherLover.id);
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

    const isLbgAlive = alivePlayers.some(p => p.role === 'Loup Garou Blanc');
    
    // Victoire des amoureux (seuls survivants et camps différents)
    if (alivePlayers.length === 2 && alivePlayers.every(p => p.isLover)) {
       // Si 2 amoureux vivants (peu importe Loup, pas Loup, ou LGB), ils gagnent ensemble
       this.state.status = 'finished';
       this.state.winner = 'lovers';
       this.addLog("VICTOIRE DE L'AMOUR ! Les amoureux sont les seuls survivants !");
       this.broadcastState();
       return true;
    }

    const aliveWolves = alivePlayers.filter(p => this.isPlayerWolf(p));

    if (aliveWolves.length === 0) {
      this.state.status = 'finished';
      this.state.winner = 'village';
      this.addLog("VICTOIRE DU VILLAGE ! Tous les loups ont été éliminés.");
      this.broadcastState();
      return true;
    } else {
      if (isLbgAlive) {
         // Le Loup Garou Blanc veut gagner seul
         if (alivePlayers.length === 1) {
            this.state.status = 'finished';
            this.state.winner = 'loup_blanc';
            this.addLog("VICTOIRE DU LOUP GAROU BLANC ! Il a réussi à éliminer tous les autres.");
            this.broadcastState();
            return true;
         } else if (aliveWolves.length === 1 && alivePlayers.length === 2) {
            // S'il est avec 1 villageois, il gagne forcément car il a l'ascendant à la nuit tombée
            this.state.status = 'finished';
            this.state.winner = 'loup_blanc';
            this.addLog("VICTOIRE DU LOUP GAROU BLANC ! Il décime le reste du village.");
            this.broadcastState();
            return true;
         }
         // Sinon la partie continue car le LGB doit encore tuer le reste des loups ou villageois
      } else {
         // Loups normaux
         if (aliveWolves.length >= alivePlayers.length / 2) {
            const remainingVillage = alivePlayers.length - aliveWolves.length;
            if (aliveWolves.length > remainingVillage || remainingVillage === 0) {
               this.state.status = 'finished';
               this.state.winner = 'loups';
               this.addLog("VICTOIRE DES LOUPS ! Ils ont désormais l'ascendant sur le village.");
               this.broadcastState();
               return true;
            }
         }
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
        
        // Les loups voient les autres avec leur rôle complet (ou "Infecté")
        if (this.isPlayerWolf(player) && this.isPlayerWolf(p)) isRoleVisible = true;
        
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
          role: isRoleVisible ? (p.isInfected ? `${p.role} (Infecté)` : p.role) : '???'
        };
      });

      let safeVotes = this.state.votes;
      // La petite fille voit les votes des loups
      if (this.state.phase === 'loups' && !this.isPlayerWolf(player) && player.role !== 'Petite Fille' && player.isAlive) {
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
        isInfected: player.isInfected,
        faction: player.faction,
        potions: player.potions,
        nightVictims: (player.role === 'Sorciere' && this.state.phase === 'sorciere') || (player.role === 'Infect Père des Loups' && this.state.phase === 'infect_pere') ? this.state.nightVictims : [],
        players: safePlayersList,
        votes: currentVotes,
        centerCards: (this.state.phase === 'voleur' && player.role === 'Voleur') ? this.state.centerCards : [],
        logs: this.state.logs,
        timeLeft: this.state.timeLeft
      });
    });
  }
}

module.exports = LoupGarou;