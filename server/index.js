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
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// 📦 TRÈS IMPORTANT : Le dictionnaire qui stocke les parties en cours
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
      s.playerName === name && 
      s.id !== socket.id && 
      s.rooms.has(cleanRoomCode)
    );

    if (duplicate) {
      console.log(`⚠️ Nettoyage du fantôme pour ${name}`);
      duplicate.leave(cleanRoomCode);
      duplicate.disconnect(true);
    }

    socket.playerName = name; 
    socket.join(cleanRoomCode);
    
    console.log(`👤 ${name} est maintenant actif dans la salle ${cleanRoomCode}`);

    socket.emit('name_set', { name: name });
    setTimeout(() => { updateRoomPlayers(cleanRoomCode); }, 100);
  });

  // 🚀 C'EST ICI QUE TOUT CHANGE : Le lancement du jeu
  socket.on('start_timebomb', (roomCode) => {
    const cleanRoomCode = roomCode.trim();
    const clients = Array.from(io.sockets.adapter.rooms.get(cleanRoomCode) || []);

    if (clients[0] !== socket.id) {
      return console.log(`🚫 Tentative non autorisée par ${socket.id}`);
    }
    
    const playersData = clients.map(id => {
        const s = io.sockets.sockets.get(id);
        return { id: id, name: s.playerName || "Anonyme" };
    });

    // On instancie la CLASSE TimeBomb et on la stocke en mémoire
    const game = new TimeBomb(cleanRoomCode, playersData, io);
    activeGames[cleanRoomCode] = game;
    
    // On lance la partie (qui va appeler broadcastState et envoyer les images)
    game.start();
  });

  // ✂️ ON ÉCOUTE LES COUPS DE CISEAUX
  socket.on('cut_wire', (data) => {
    const { roomCode, targetId, cardIndex, shooterName } = data;
    const game = activeGames[roomCode];
    
    // Si la partie existe, on passe l'info au moteur du jeu
    if (game) {
      game.handleCut(targetId, cardIndex, shooterName);
    }
  });

});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Serveur et Socket.io lancés sur http://localhost:${PORT}`);
});