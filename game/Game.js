const { getDefaultConfig } = require('./rules');
const { ROLES, assignRoles, getKnownInfo } = require('./roles');

const PHASES = {
  LOBBY: 'LOBBY',
  ROLE_REVEAL: 'ROLE_REVEAL',
  QUEST_TRACK: 'QUEST_TRACK',
  ASSASSIN_GUESS: 'ASSASSIN_GUESS',
  GAME_OVER: 'GAME_OVER',
};

class Game {
  constructor(id, hostId, hostName) {
    this.id = id;
    this.hostId = hostId;
    this.phase = PHASES.LOBBY;

    this.players = [{ id: hostId, name: hostName, role: null, team: null, connected: true }];

    // Config (set by host in lobby, defaults applied on start)
    this.config = {
      roles: { merlin: true, percival: true, morgana: true, mordred: false, oberon: false },
      goodCount: null,
      evilCount: null,
      questSizes: null,
      doubleFail: null,
    };

    // Game state
    this.currentQuest = 0;
    this.questResults = [];
    this.acknowledgedPlayers = new Set();
    this.winner = null;
    this.winReason = null;
    this.assassinTarget = null;
  }

  // --- Player management ---

  addPlayer(id, name) {
    if (this.phase !== PHASES.LOBBY) {
      // Allow reconnection during game
      const existing = this.players.find(p => p.name === name);
      if (existing) {
        existing.id = id;
        existing.connected = true;
        return { reconnected: true };
      }
      return { error: 'Game already in progress' };
    }
    if (this.players.find(p => p.name === name)) {
      return { error: 'Name already taken' };
    }
    this.players.push({ id, name, role: null, team: null, connected: true });
    return { ok: true };
  }

  removePlayer(id) {
    if (this.phase === PHASES.LOBBY) {
      this.players = this.players.filter(p => p.id !== id);
      if (id === this.hostId && this.players.length > 0) {
        this.hostId = this.players[0].id;
      }
    } else {
      const player = this.players.find(p => p.id === id);
      if (player) player.connected = false;
    }
  }

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  // --- Configuration ---

  configure(config) {
    if (config.roles) this.config.roles = { ...this.config.roles, ...config.roles };
    if (config.goodCount != null) this.config.goodCount = config.goodCount;
    if (config.evilCount != null) this.config.evilCount = config.evilCount;
    if (config.questSizes) this.config.questSizes = config.questSizes;
    if (config.doubleFail) this.config.doubleFail = config.doubleFail;
  }

  // --- Game start ---

  startGame() {
    const count = this.players.length;
    if (count < 5) return { error: 'Need at least 5 players' };

    const defaults = getDefaultConfig(count);
    if (this.config.goodCount == null) this.config.goodCount = defaults.good;
    if (this.config.evilCount == null) this.config.evilCount = defaults.evil;
    if (!this.config.questSizes) this.config.questSizes = defaults.questSizes;
    if (!this.config.doubleFail) this.config.doubleFail = defaults.doubleFail;

    if (this.config.goodCount + this.config.evilCount !== count) {
      return { error: `Good (${this.config.goodCount}) + Evil (${this.config.evilCount}) must equal player count (${count})` };
    }

    const enabledGoodSpecial = (this.config.roles.merlin ? 1 : 0) + (this.config.roles.percival ? 1 : 0);
    const enabledEvilSpecial = (this.config.roles.merlin ? 1 : 0) +
      (this.config.roles.morgana ? 1 : 0) +
      (this.config.roles.mordred ? 1 : 0) +
      (this.config.roles.oberon ? 1 : 0);

    if (enabledGoodSpecial > this.config.goodCount) {
      return { error: 'Too many special Good roles for the number of Good players' };
    }
    if (enabledEvilSpecial > this.config.evilCount) {
      return { error: 'Too many special Evil roles for the number of Evil players' };
    }

    assignRoles(this.players, this.config.goodCount, this.config.evilCount, this.config.roles);

    this.phase = PHASES.ROLE_REVEAL;
    this.acknowledgedPlayers = new Set();
    return { ok: true };
  }

  // --- Phase: ROLE_REVEAL ---

  acknowledgeRole(playerId) {
    if (this.phase !== PHASES.ROLE_REVEAL) return;
    this.acknowledgedPlayers.add(playerId);
    if (this.acknowledgedPlayers.size === this.players.length) {
      this.phase = PHASES.QUEST_TRACK;
    }
  }

  // --- Phase: QUEST_TRACK ---
  // Host records quest results as they happen offline

  recordQuestResult(result) {
    if (this.phase !== PHASES.QUEST_TRACK) return { error: 'Not in quest tracking phase' };
    if (result !== 'success' && result !== 'fail') return { error: 'Invalid result' };

    this.questResults.push(result);
    this.currentQuest++;

    const successes = this.questResults.filter(r => r === 'success').length;
    const failures = this.questResults.filter(r => r === 'fail').length;

    if (failures >= 3) {
      this.phase = PHASES.GAME_OVER;
      this.winner = 'EVIL';
      this.winReason = '3 quests failed';
      return { ok: true, gameOver: true };
    }

    if (successes >= 3) {
      const hasMerlin = this.players.some(p => p.role === 'MERLIN');
      const hasAssassin = this.players.some(p => p.role === 'ASSASSIN');
      if (hasMerlin && hasAssassin) {
        this.phase = PHASES.ASSASSIN_GUESS;
        return { ok: true, assassinPhase: true };
      }
      this.phase = PHASES.GAME_OVER;
      this.winner = 'GOOD';
      this.winReason = '3 quests succeeded';
      return { ok: true, gameOver: true };
    }

    return { ok: true };
  }

  // --- Phase: ASSASSIN_GUESS ---

  assassinGuess(targetId) {
    if (this.phase !== PHASES.ASSASSIN_GUESS) return { error: 'Not in assassin phase' };

    const target = this.getPlayer(targetId);
    if (!target) return { error: 'Invalid target' };

    this.assassinTarget = targetId;
    this.phase = PHASES.GAME_OVER;

    if (target.role === 'MERLIN') {
      this.winner = 'EVIL';
      this.winReason = 'Assassin found Merlin';
    } else {
      this.winner = 'GOOD';
      this.winReason = 'Assassin failed to find Merlin';
    }
    return { ok: true };
  }

  // --- Phase: GAME_OVER ---

  restart() {
    this.phase = PHASES.LOBBY;
    this.currentQuest = 0;
    this.questResults = [];
    this.acknowledgedPlayers = new Set();
    this.winner = null;
    this.winReason = null;
    this.assassinTarget = null;
    this.config.goodCount = null;
    this.config.evilCount = null;
    this.config.questSizes = null;
    this.config.doubleFail = null;
    for (const p of this.players) {
      p.role = null;
      p.team = null;
    }
  }

  // --- State for client ---

  getStateForPlayer(playerId) {
    const player = this.getPlayer(playerId);

    const state = {
      gameId: this.id,
      phase: this.phase,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isHost: p.id === this.hostId,
      })),
      currentQuest: this.currentQuest,
      questResults: this.questResults,
      questSizes: this.config.questSizes,
      doubleFail: this.config.doubleFail,
    };

    if (player) {
      state.you = {
        id: player.id,
        name: player.name,
        isHost: player.id === this.hostId,
      };

      if (this.phase !== PHASES.LOBBY) {
        state.you.role = ROLES[player.role]?.name || player.role;
        state.you.roleKey = player.role;
        state.you.team = player.team;
        state.you.knownInfo = getKnownInfo(player, this.players);
      }
    }

    if (this.phase === PHASES.LOBBY) {
      state.config = this.config;
    }

    if (this.phase === PHASES.ROLE_REVEAL) {
      state.enabledRoles = this.config.roles;
    }

    if (this.phase === PHASES.QUEST_TRACK) {
      state.questSizeNeeded = this.config.questSizes[this.currentQuest];
      state.doubleFailNeeded = this.config.doubleFail[this.currentQuest];
    }

    if (this.phase === PHASES.ASSASSIN_GUESS) {
      // Only show assassin UI to the assassin
      state.isAssassin = player?.role === 'ASSASSIN';
    }

    if (this.phase === PHASES.GAME_OVER) {
      state.winner = this.winner;
      state.winReason = this.winReason;
      state.assassinTarget = this.assassinTarget;
      state.revealedRoles = this.players.map(p => ({
        name: p.name,
        role: ROLES[p.role]?.name || p.role,
        team: p.team,
      }));
    }

    return state;
  }
}

module.exports = { Game, PHASES };
