// server/controllers/timebombController.js

const handleCut = (game, targetPlayerId, cardIndex) => {
  const targetPlayer = game.players.id(targetPlayerId);
  const card = targetPlayer.hand[cardIndex];

  card.isRevealed = true;
  game.lastAction = `${game.currentPlayer.name} a coupé chez ${targetPlayer.name}`;

  if (card.type === 'bomb') {
    game.status = 'finished';
    game.winner = 'Moriarty';
  } else if (card.type === 'defuse') {
    game.defusesFound++;
    if (game.defusesFound === game.totalPlayers) {
      game.status = 'finished';
      game.winner = 'Sherlock';
    }
  }

  game.currentPlayer = targetPlayerId;
  
  return game.save();
};