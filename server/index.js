// server/index.js
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const TimeBomb = require('./games/timebomb');
const LoupGarou = require('./games/loupgarou');
const Qwixx = require('./games/qwixx');
const Yams = require('./games/yams');
const TheGang = require('./games/thegang');
const Charger = require('./games/charger');
const SkullKing = require('./games/skullking');
const Traitre = require('./games/traitre');

const app = express();

const ALLOWED_ORIGINS = [
  'https://papier-board-games.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST'],
  credentials: true,
}));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// STOCKAGE GLOBAL DES PARTIES
const activeGames = {}; 

const updateRoomPlayers = (roomCode) => {
  const room = io.sockets.adapter.rooms.get(roomCode);
  if (!room) return;

  const clients = Array.from(room);
  const playersInRoom = clients.map((id, index) => {
    const s = io.sockets.sockets.get(id);
    return {
      id: id,
      name: s?.playerName || "En attente...",
      isHost: index === 0
    };
  });

  io.to(roomCode).emit('update_players_list', playersInRoom);
};

io.on('connection', (socket) => {
  
  socket.on('set_player_name', ({ name, roomCode }) => {
    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    const allSockets = Array.from(io.sockets.sockets.values());
    const duplicate = allSockets.find(s => 
      s.playerName === name && s.id !== socket.id && s.rooms.has(cleanRoomCode)
    );

    if (duplicate) {
      console.log(`⚠️ Nettoyage du fantôme pour ${name}`);
      duplicate.leave(cleanRoomCode);
      duplicate.disconnect(true);
    }

    if (!duplicate && clients.length >= 10) {
      socket.emit('room_full', 'La salle est pleine (10 joueurs maximum) !');
      return; 
    }

    socket.playerName = name; 
    socket.join(cleanRoomCode);
    
    console.log(`👤 ${name} est actif dans ${cleanRoomCode}`);
    socket.emit('name_set', { name: name });
    
    if (activeGames[cleanRoomCode] && activeGames[cleanRoomCode].state.status === 'playing') {

      const hasReconnected = activeGames[cleanRoomCode].reconnectPlayer(socket.id, name);
      
      if (hasReconnected) {
        console.log(`🔄 Reconnexion réussie pour ${name} dans ${cleanRoomCode}`);
        socket.emit('game_started');
        activeGames[cleanRoomCode].broadcastState();

        return; 
      }
    }
    
    setTimeout(() => { updateRoomPlayers(cleanRoomCode); }, 100);
  });

  socket.on('start_timebomb', (roomCode) => {
    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Lancement non autorisé par ${socket.id}`);
    }
    
    const playersData = clients.map(id => {
        const s = io.sockets.sockets.get(id);
        return { id: id, name: s.playerName || "Anonyme" };
    });

    const game = new TimeBomb(cleanRoomCode, playersData, io);
    activeGames[cleanRoomCode] = game;
    
    game.start();
  });

  socket.on('announce_cards', (data) => {
    const { roomCode, playerName, defuses, hasBomb } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode];
    
    if (game) {
      game.handleAnnouncement(playerName, defuses, hasBomb);
    }
  });

  socket.on('cut_wire', (data) => {
    const { roomCode, targetId, cardIndex, shooterName } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode]; 
    
    if (game) {
      game.handleCut(targetId, cardIndex, shooterName);
    }
  });

  socket.on('start_loupgarou', (data) => {
    const { roomCode, roleComposition } = typeof data === 'string' 
      ? { roomCode: data, roleComposition: null } 
      : data;
    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Lancement non autorisé par ${socket.id}`);
    }
    
    const playersData = clients.map(id => {
        const s = io.sockets.sockets.get(id);
        return { id: id, name: s.playerName || "Anonyme" };
    });

    const game = new LoupGarou(cleanRoomCode, playersData, io, roleComposition);
    activeGames[cleanRoomCode] = game;
    
    io.to(cleanRoomCode).emit('game_started');
    game.start();
  });

  socket.on('loupgarou_action', (data) => {
    const { roomCode, actionType, targetId } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode];
    if (game && game instanceof LoupGarou) {
      game.handleAction(socket.id, actionType, targetId);
    }
  });

  socket.on('start_qwixx', (roomCode) => {
    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Lancement non autorisé par ${socket.id}`);
    }
    
    const playersData = clients.map(id => {
        const s = io.sockets.sockets.get(id);
        return { id: id, name: s.playerName || "Anonyme" };
    });

    const game = new Qwixx(cleanRoomCode, playersData, io);
    activeGames[cleanRoomCode] = game;
    
    game.start();
  });

  socket.on('qwixx_action', (data) => {
    const { roomCode, actionType, payload } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode];
    if (game && game instanceof Qwixx) {
      game.handleAction(socket.id, actionType, payload);
    }
  });

  socket.on('start_yams', (roomCode) => {
    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Lancement non autorisé par ${socket.id}`);
    }
    
    const playersData = clients.map(id => {
        const s = io.sockets.sockets.get(id);
        return { id: id, name: s.playerName || "Anonyme" };
    });

    const game = new Yams(cleanRoomCode, playersData, io);
    activeGames[cleanRoomCode] = game;
    
    game.start();
  });

  socket.on('yams_action', (data) => {
    const { roomCode, actionType, payload } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode];
    if (game && game instanceof Yams) {
      game.handleAction(socket.id, actionType, payload);
    }
  });

  socket.on('start_charger', (roomCode) => {
    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Lancement non autorisé par ${socket.id}`);
    }

    if (clients.length < 2) {
      return socket.emit('action_log', '⚠️ Il faut au moins 2 joueurs pour lancer la partie !');
    }

    const playersData = clients.map(id => {
      const s = io.sockets.sockets.get(id);
      return { id: id, name: s.playerName || 'Anonyme' };
    });

    const game = new Charger(cleanRoomCode, playersData, io);
    activeGames[cleanRoomCode] = game;
    game.start();
  });

  socket.on('charger_action', (data) => {
    const { roomCode, actionType, payload } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode];
    if (game && game instanceof Charger) {
      game.handleAction(socket.id, actionType, payload);
    }
  });

  // ── SKULL KING ──────────────────────────────────────────────
  socket.on('start_skullking', (payload) => {
    const roomCode = typeof payload === 'string' ? payload : (payload && payload.roomCode);
    const options  = typeof payload === 'object' && payload ? (payload.options || {}) : {};

    if (!roomCode || typeof roomCode !== 'string') {
      return console.log(`🚫 start_skullking: roomCode invalide (payload=${JSON.stringify(payload)})`);
    }

    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Lancement non autorisé par ${socket.id}`);
    }

    if (clients.length < 3 || clients.length > 8) {
      return socket.emit('skullking_error', `Skull King nécessite entre 3 et 8 joueurs (actuellement : ${clients.length}).`);
    }

    const playersData = clients.map(id => {
      const s = io.sockets.sockets.get(id);
      return { id, name: s.playerName || 'Anonyme' };
    });

    const game = new SkullKing(cleanRoomCode, playersData, io, options);
    activeGames[cleanRoomCode] = game;
    game.start();
  });

  socket.on('skullking_sync_option', ({ roomCode, key, value }) => {
    io.to(roomCode.trim()).emit('skullking_option_updated', { key, value });
  });

  socket.on('skullking_action', (data) => {
    const { roomCode, actionType, payload } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode];
    if (game && game instanceof SkullKing) {
      switch (actionType) {
        case 'bid':         game.handleBid(socket.id, payload.bid); break;
        case 'cancel_bid':  game.handleCancelBid(socket.id); break;
        case 'play_card':   game.handlePlayCard(socket.id, payload.cardId, payload); break;
      }
    }
  });

  // ── TRAÎTRE À BORD ──────────────────────────────────────────
  socket.on('start_traitre', (roomCode) => {
    const cleanRoomCode = (typeof roomCode === 'string' ? roomCode : '').trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Lancement non autorisé par ${socket.id}`);
    }

    if (clients.length < 3 || clients.length > 8) {
      return socket.emit('traitre_error', `Traître à bord se joue de 3 à 8 joueurs (actuellement : ${clients.length}).`);
    }

    const playersData = clients.map(id => {
      const s = io.sockets.sockets.get(id);
      return { id, name: s.playerName || 'Anonyme' };
    });

    const game = new Traitre(cleanRoomCode, playersData, io);
    activeGames[cleanRoomCode] = game;
    game.start();
  });

  socket.on('traitre_action', (data) => {
    const { roomCode, actionType, payload } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode];
    if (game && game instanceof Traitre) {
      game.handleAction(socket.id, actionType, payload || {});
    }
  });

  socket.on('update_role_composition', (data) => {
    const { roomCode, roleComposition } = data;
    const cleanRoomCode = roomCode.trim();
    // Broadcast la composition à tous les joueurs de la room (sauf l'émetteur)
    socket.to(cleanRoomCode).emit('role_composition_updated', roleComposition);
  });

  socket.on('send_player_chat', (data) => {
    const { roomCode, text, sender } = data;
    io.to(roomCode).emit('player_chat_message', { text, sender });
  });

  // ── THE GANG ────────────────────────────────────────────────
  socket.on('start_thegang', (payload) => {
    // Support both legacy string and new object format
    const roomCode = typeof payload === 'string' ? payload : (payload && payload.roomCode);
    const options  = typeof payload === 'object' && payload ? (payload.options || {}) : {};

    if (!roomCode || typeof roomCode !== 'string') {
      return console.log(`🚫 start_thegang: roomCode invalide (payload=${JSON.stringify(payload)})`);
    }

    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Lancement non autorisé par ${socket.id}`);
    }

    if (clients.length < 3 || clients.length > 6) {
      return socket.emit('thegang_error', `The Gang nécessite entre 3 et 6 joueurs (actuellement : ${clients.length}).`);
    }

    const playersData = clients.map(id => {
      const s = io.sockets.sockets.get(id);
      return { id, name: s.playerName || 'Anonyme' };
    });

    const game = new TheGang(cleanRoomCode, playersData, io, options);
    activeGames[cleanRoomCode] = game;
    game.start();
  });

  socket.on('thegang_sync_option', ({ roomCode, key, value }) => {
    io.to(roomCode.trim()).emit('thegang_option_updated', { key, value });
  });

  socket.on('thegang_action', (data) => {
    const { roomCode, actionType, payload } = data;
    const cleanRoomCode = roomCode.trim();
    const game = activeGames[cleanRoomCode];
    if (game && game instanceof TheGang) {
      switch (actionType) {
        case 'phase_vote':        game.handlePhaseVote(socket.id); break;
        case 'cancel_phase_vote': game.handleCancelPhaseVote(socket.id); break;
        case 'take_token':        game.handleTakeToken(socket.id, payload.tokenNumber); break;
        case 'release_token':     game.handleReleaseToken(socket.id); break;
        case 'validate':          game.handleValidate(socket.id); break;
        case 'next_heist':        game.handleNextHeist(socket.id); break;
      }
    }
  });

});

// On utilise le port dynamique de Render, ou 3000 par défaut
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Serveur et Socket.io lancés sur le port ${PORT}`);
});