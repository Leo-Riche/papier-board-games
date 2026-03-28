// server/index.js
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const TimeBomb = require('./games/timebomb');

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*", // Autorise Vercel à se connecter
    methods: ["GET", "POST"]
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

    const allSockets = Array.from(io.sockets.sockets.values());
    const duplicate = allSockets.find(s => 
      s.playerName === name && s.id !== socket.id && s.rooms.has(cleanRoomCode)
    );

    if (duplicate) {
      console.log(`⚠️ Nettoyage du fantôme pour ${name}`);
      duplicate.leave(cleanRoomCode);
      duplicate.disconnect(true);
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

  socket.on('send_player_chat', (data) => {
    const { roomCode, text, sender } = data;
    io.to(roomCode).emit('player_chat_message', { text, sender });
  });

});

// On utilise le port dynamique de Render, ou 3000 par défaut
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Serveur et Socket.io lancés sur le port ${PORT}`);
});