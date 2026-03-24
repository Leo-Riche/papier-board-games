const mongoose = require('mongoose');

const timeBombSchema = new mongoose.Schema({
  roomCode: { type: String, unique: true },
  status: { type: String, default: "waiting" }, // waiting, playing, finished
  config: {
    maxPlayers: { type: Number, default: 8 },
    timer: Number
  },
  gameState: {
    currentRound: { type: Number, default: 1 },
    cardsDiscovered: {
      neutrals: { type: Number, default: 0 },
      defuses: { type: Number, default: 0 },
      bomb: { type: Boolean, default: false }
    },
    players: [{
      name: String,
      role: String, // "Sherlock" | "Moriarty"
      hand: [String], // ["wire", "defuse", "bomb"]
      isTurn: Boolean
    }]
  }
}, { timestamps: true });

module.exports = mongoose.model('TimeBombGame', timeBombSchema);