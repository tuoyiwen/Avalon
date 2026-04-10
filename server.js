const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameManager = require('./game/GameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Broadcast game state to all players in a game (each gets personalized view)
function broadcastGameState(game) {
  for (const player of game.players) {
    const socket = io.sockets.sockets.get(player.id);
    if (socket) {
      socket.emit('game-state', game.getStateForPlayer(player.id));
    }
  }
}

io.on('connection', (socket) => {
  let currentGameId = null;

  socket.on('create-game', ({ playerName }, cb) => {
    const game = gameManager.createGame(socket.id, playerName);
    currentGameId = game.id;
    socket.join(game.id);
    cb({ gameId: game.id });
    broadcastGameState(game);
  });

  socket.on('join-game', ({ gameId, playerName }, cb) => {
    const game = gameManager.getGame(gameId);
    if (!game) return cb({ error: 'Game not found' });

    const result = game.addPlayer(socket.id, playerName);
    if (result.error) return cb({ error: result.error });

    currentGameId = game.id;
    socket.join(game.id);
    cb({ ok: true, reconnected: result.reconnected || false });
    broadcastGameState(game);
  });

  socket.on('configure-game', (config, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });
    if (socket.id !== game.hostId) return cb({ error: 'Only the host can configure' });
    game.configure(config);
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('start-game', (_, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });
    if (socket.id !== game.hostId) return cb({ error: 'Only the host can start' });

    const result = game.startGame();
    if (result.error) return cb({ error: result.error });
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('acknowledge-role', (_, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });
    game.acknowledgeRole(socket.id);
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('propose-team', ({ team }, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.proposeTeam(socket.id, team);
    if (result.error) return cb({ error: result.error });
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('cast-vote', ({ vote }, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.castVote(socket.id, vote);
    if (result.error) return cb({ error: result.error });
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('quest-vote', ({ vote }, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.questVote(socket.id, vote);
    if (result.error) return cb({ error: result.error });
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('assassin-guess', ({ targetId }, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });

    const result = game.assassinGuess(socket.id, targetId);
    if (result.error) return cb({ error: result.error });
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('restart-game', (_, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });
    if (socket.id !== game.hostId) return cb({ error: 'Only the host can restart' });
    game.restart();
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('disconnect', () => {
    if (currentGameId) {
      const game = gameManager.getGame(currentGameId);
      if (game) {
        game.removePlayer(socket.id);
        // Clean up empty games
        if (game.players.length === 0) {
          gameManager.removeGame(currentGameId);
        } else {
          broadcastGameState(game);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Avalon server running on http://localhost:${PORT}`);
});
