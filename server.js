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
    if (player.isAI) continue; // AI players don't have sockets
    const socket = io.sockets.sockets.get(player.id);
    if (socket) {
      socket.emit('game-state', game.getStateForPlayer(player.id));
    }
  }
  // Schedule AI actions after a short delay (feels more natural)
  scheduleAIActions(game);
}

// --- AI Logic ---
function scheduleAIActions(game) {
  const aiPlayers = game.getAIPlayers();
  if (aiPlayers.length === 0) return;

  setTimeout(() => {
    runAIActions(game);
  }, 800 + Math.random() * 700); // 0.8-1.5s delay
}

function runAIActions(game) {
  const aiPlayers = game.getAIPlayers();
  let changed = false;

  for (const ai of aiPlayers) {
    switch (game.phase) {
      case 'ROLE_REVEAL':
        if (!game.acknowledgedPlayers.has(ai.id)) {
          game.acknowledgeRole(ai.id);
          changed = true;
        }
        break;

      case 'TEAM_PROPOSAL':
        if (game.players[game.currentLeaderIdx].id === ai.id) {
          const team = aiPickTeam(game, ai);
          game.proposeTeam(ai.id, team);
          changed = true;
        }
        break;

      case 'TEAM_VOTE':
        if (game.votes[ai.id] == null) {
          const vote = aiTeamVote(game, ai);
          game.castVote(ai.id, vote);
          changed = true;
        }
        break;

      case 'QUEST':
        if (game.teamProposal.includes(ai.id) && game.questVotes[ai.id] == null) {
          const vote = aiQuestVote(game, ai);
          game.questVote(ai.id, vote);
          changed = true;
        }
        break;

      case 'ASSASSIN_GUESS':
        if (ai.role === 'ASSASSIN') {
          const target = aiAssassinGuess(game, ai);
          game.assassinGuess(ai.id, target);
          changed = true;
        }
        break;
    }
  }

  if (changed) {
    broadcastGameState(game);
  }
}

// AI: pick team members for a quest
function aiPickTeam(game, ai) {
  const size = game.config.questSizes[game.currentQuest];
  const playerIds = game.players.map(p => p.id);

  if (ai.team === 'EVIL') {
    // Evil AI: include self, prefer other evil teammates (that it knows about)
    const knownEvil = game.players.filter(p =>
      p.team === 'EVIL' && p.role !== 'OBERON' && p.id !== ai.id
    );
    // If Oberon, doesn't know other evil
    const teammates = ai.role === 'OBERON' ? [] : knownEvil;

    const team = [ai.id];
    // Add known evil allies
    for (const t of teammates) {
      if (team.length >= size) break;
      team.push(t.id);
    }
    // Fill rest randomly from remaining players
    const remaining = playerIds.filter(id => !team.includes(id));
    shuffleArray(remaining);
    while (team.length < size) {
      team.push(remaining.pop());
    }
    return team;
  } else {
    // Good AI: include self, pick randomly
    const team = [ai.id];
    const others = playerIds.filter(id => id !== ai.id);
    shuffleArray(others);
    while (team.length < size) {
      team.push(others.pop());
    }
    return team;
  }
}

// AI: vote on team proposal
function aiTeamVote(game, ai) {
  const proposedIds = game.teamProposal;

  if (ai.team === 'EVIL') {
    // Evil: approve if team includes evil members, or on 4th reject
    const evilOnTeam = proposedIds.filter(id => {
      const p = game.getPlayer(id);
      return p && p.team === 'EVIL';
    }).length;
    if (evilOnTeam > 0 || game.consecutiveRejects >= 3) return 'approve';
    return Math.random() < 0.4 ? 'approve' : 'reject';
  } else {
    // Good: approve if self is on team, or randomly; reject on suspicion
    const selfOnTeam = proposedIds.includes(ai.id);
    if (game.consecutiveRejects >= 3) return 'approve'; // avoid 5th reject
    if (selfOnTeam) return Math.random() < 0.75 ? 'approve' : 'reject';
    return Math.random() < 0.5 ? 'approve' : 'reject';
  }
}

// AI: quest vote (success or fail)
function aiQuestVote(game, ai) {
  if (ai.team === 'GOOD') return 'success'; // must play success
  // Evil: usually fail, but sometimes play success to hide
  return Math.random() < 0.2 ? 'success' : 'fail';
}

// AI: assassin picks who to kill (guess Merlin)
function aiAssassinGuess(game, ai) {
  // Try to guess Merlin - pick a random good player
  const goodPlayers = game.players.filter(p => p.team === 'GOOD');
  // Slight bias: prefer non-Percival (if known via Morgana interaction), but simple random for now
  const target = goodPlayers[Math.floor(Math.random() * goodPlayers.length)];
  return target.id;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
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

  socket.on('add-ai', (_, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });
    if (socket.id !== game.hostId) return cb({ error: 'Only the host can add AI' });
    const result = game.addAIPlayer();
    if (result.error) return cb({ error: result.error });
    cb({ ok: true });
    broadcastGameState(game);
  });

  socket.on('remove-ai', (_, cb) => {
    const game = gameManager.getGame(currentGameId);
    if (!game) return cb({ error: 'Not in a game' });
    if (socket.id !== game.hostId) return cb({ error: 'Only the host can remove AI' });
    const result = game.removeAIPlayer();
    if (result.error) return cb({ error: result.error });
    cb({ ok: true });
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
