const { getDefaultConfig } = require('./rules');
const { ROLES, assignRoles, getKnownInfo } = require('./roles');

const PHASES = {
  LOBBY: 'LOBBY',
  ROLE_REVEAL: 'ROLE_REVEAL',
  TEAM_PROPOSAL: 'TEAM_PROPOSAL',
  TEAM_VOTE: 'TEAM_VOTE',
  QUEST: 'QUEST',
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
    this.currentLeaderIdx = 0;
    this.currentQuest = 0;
    this.questResults = [];
    this.teamProposal = [];
    this.votes = {};
    this.questVotes = {};
    this.consecutiveRejects = 0;
    this.voteHistory = [];
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
      // Transfer host if host left
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

    // Apply defaults for anything not configured
    const defaults = getDefaultConfig(count);
    if (this.config.goodCount == null) this.config.goodCount = defaults.good;
    if (this.config.evilCount == null) this.config.evilCount = defaults.evil;
    if (!this.config.questSizes) this.config.questSizes = defaults.questSizes;
    if (!this.config.doubleFail) this.config.doubleFail = defaults.doubleFail;

    // Validate counts
    if (this.config.goodCount + this.config.evilCount !== count) {
      return { error: `Good (${this.config.goodCount}) + Evil (${this.config.evilCount}) must equal player count (${count})` };
    }

    // Validate special role counts
    const enabledGoodSpecial = (this.config.roles.merlin ? 1 : 0) + (this.config.roles.percival ? 1 : 0);
    const enabledEvilSpecial = (this.config.roles.merlin ? 1 : 0) + // assassin
      (this.config.roles.morgana ? 1 : 0) +
      (this.config.roles.mordred ? 1 : 0) +
      (this.config.roles.oberon ? 1 : 0);

    if (enabledGoodSpecial > this.config.goodCount) {
      return { error: 'Too many special Good roles for the number of Good players' };
    }
    if (enabledEvilSpecial > this.config.evilCount) {
      return { error: 'Too many special Evil roles for the number of Evil players' };
    }

    // Assign roles
    assignRoles(this.players, this.config.goodCount, this.config.evilCount, this.config.roles);

    // Random first leader
    this.currentLeaderIdx = Math.floor(Math.random() * count);

    this.phase = PHASES.ROLE_REVEAL;
    this.acknowledgedPlayers = new Set();
    return { ok: true };
  }

  // --- Phase: ROLE_REVEAL ---

  acknowledgeRole(playerId) {
    if (this.phase !== PHASES.ROLE_REVEAL) return;
    this.acknowledgedPlayers.add(playerId);
    if (this.acknowledgedPlayers.size === this.players.length) {
      this._startTeamProposal();
    }
  }

  // --- Phase: TEAM_PROPOSAL ---

  _startTeamProposal() {
    this.phase = PHASES.TEAM_PROPOSAL;
    this.teamProposal = [];
    this.votes = {};
    this.questVotes = {};
  }

  proposeTeam(leaderId, team) {
    if (this.phase !== PHASES.TEAM_PROPOSAL) return { error: 'Not in team proposal phase' };
    if (this.players[this.currentLeaderIdx].id !== leaderId) return { error: 'You are not the leader' };

    const requiredSize = this.config.questSizes[this.currentQuest];
    if (team.length !== requiredSize) {
      return { error: `Team must have exactly ${requiredSize} members` };
    }

    // Validate all IDs are valid players
    for (const pid of team) {
      if (!this.players.find(p => p.id === pid)) {
        return { error: 'Invalid player on team' };
      }
    }

    this.teamProposal = team;
    this.votes = {};
    this.phase = PHASES.TEAM_VOTE;
    return { ok: true };
  }

  // --- Phase: TEAM_VOTE ---

  castVote(playerId, vote) {
    if (this.phase !== PHASES.TEAM_VOTE) return { error: 'Not in voting phase' };
    if (vote !== 'approve' && vote !== 'reject') return { error: 'Invalid vote' };
    if (this.votes[playerId] != null) return { error: 'Already voted' };

    this.votes[playerId] = vote;

    // Check if all players have voted
    if (Object.keys(this.votes).length === this.players.length) {
      return this._resolveTeamVote();
    }
    return { ok: true, waiting: true };
  }

  _resolveTeamVote() {
    const approvals = Object.values(this.votes).filter(v => v === 'approve').length;
    const approved = approvals > this.players.length / 2; // strict majority

    // Record in history
    this.voteHistory.push({
      quest: this.currentQuest,
      leader: this.players[this.currentLeaderIdx].name,
      team: this.teamProposal.map(pid => this.players.find(p => p.id === pid).name),
      votes: { ...this.votes },
      approved,
    });

    if (approved) {
      this.consecutiveRejects = 0;
      this.questVotes = {};
      this.phase = PHASES.QUEST;
      return { ok: true, approved: true };
    }

    // Rejected
    this.consecutiveRejects++;
    if (this.consecutiveRejects >= 5) {
      this.phase = PHASES.GAME_OVER;
      this.winner = 'EVIL';
      this.winReason = '5 consecutive team rejections';
      return { ok: true, approved: false, gameOver: true };
    }

    // Next leader
    this.currentLeaderIdx = (this.currentLeaderIdx + 1) % this.players.length;
    this._startTeamProposal();
    return { ok: true, approved: false };
  }

  // --- Phase: QUEST ---

  questVote(playerId, vote) {
    if (this.phase !== PHASES.QUEST) return { error: 'Not in quest phase' };
    if (!this.teamProposal.includes(playerId)) return { error: 'You are not on this quest' };
    if (vote !== 'success' && vote !== 'fail') return { error: 'Invalid vote' };
    if (this.questVotes[playerId] != null) return { error: 'Already voted' };

    // Good players cannot play fail
    const player = this.getPlayer(playerId);
    if (player.team === 'GOOD' && vote === 'fail') {
      return { error: 'Good players must play success' };
    }

    this.questVotes[playerId] = vote;

    // Check if all team members have voted
    if (Object.keys(this.questVotes).length === this.teamProposal.length) {
      return this._resolveQuest();
    }
    return { ok: true, waiting: true };
  }

  _resolveQuest() {
    const fails = Object.values(this.questVotes).filter(v => v === 'fail').length;
    const needsDoubleFail = this.config.doubleFail[this.currentQuest];
    const questFailed = needsDoubleFail ? fails >= 2 : fails >= 1;

    this.questResults.push({
      quest: this.currentQuest,
      result: questFailed ? 'fail' : 'success',
      fails,
      teamSize: this.teamProposal.length,
    });

    const successes = this.questResults.filter(q => q.result === 'success').length;
    const failures = this.questResults.filter(q => q.result === 'fail').length;

    if (failures >= 3) {
      this.phase = PHASES.GAME_OVER;
      this.winner = 'EVIL';
      this.winReason = '3 quests failed';
      return { ok: true, questFailed, gameOver: true };
    }

    if (successes >= 3) {
      // Check if assassin phase needed
      const hasAssassin = this.players.some(p => p.role === 'ASSASSIN');
      const hasMerlin = this.players.some(p => p.role === 'MERLIN');
      if (hasAssassin && hasMerlin) {
        this.phase = PHASES.ASSASSIN_GUESS;
        return { ok: true, questFailed: false, assassinPhase: true };
      }
      this.phase = PHASES.GAME_OVER;
      this.winner = 'GOOD';
      this.winReason = '3 quests succeeded';
      return { ok: true, questFailed: false, gameOver: true };
    }

    // Next quest, next leader
    this.currentQuest++;
    this.consecutiveRejects = 0;
    this.currentLeaderIdx = (this.currentLeaderIdx + 1) % this.players.length;
    this._startTeamProposal();
    return { ok: true, questFailed };
  }

  // --- Phase: ASSASSIN_GUESS ---

  assassinGuess(playerId, targetId) {
    if (this.phase !== PHASES.ASSASSIN_GUESS) return { error: 'Not in assassin phase' };
    const player = this.getPlayer(playerId);
    if (player.role !== 'ASSASSIN') return { error: 'You are not the Assassin' };

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
    return { ok: true, correct: target.role === 'MERLIN' };
  }

  // --- Phase: GAME_OVER ---

  restart() {
    this.phase = PHASES.LOBBY;
    this.currentLeaderIdx = 0;
    this.currentQuest = 0;
    this.questResults = [];
    this.teamProposal = [];
    this.votes = {};
    this.questVotes = {};
    this.consecutiveRejects = 0;
    this.voteHistory = [];
    this.acknowledgedPlayers = new Set();
    this.winner = null;
    this.winReason = null;
    this.assassinTarget = null;
    for (const p of this.players) {
      p.role = null;
      p.team = null;
    }
  }

  // --- State for client ---

  getStateForPlayer(playerId) {
    const player = this.getPlayer(playerId);
    const isLeader = this.players[this.currentLeaderIdx]?.id === playerId;

    const state = {
      gameId: this.id,
      phase: this.phase,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        isLeader: this.players[this.currentLeaderIdx]?.id === p.id,
        isOnTeam: this.teamProposal.includes(p.id),
        isHost: p.id === this.hostId,
      })),
      currentQuest: this.currentQuest,
      questResults: this.questResults,
      questSizes: this.config.questSizes,
      doubleFail: this.config.doubleFail,
      consecutiveRejects: this.consecutiveRejects,
      voteHistory: this.voteHistory.map(vh => ({
        ...vh,
        // Convert player IDs to names in votes
        votes: Object.fromEntries(
          Object.entries(vh.votes).map(([pid, v]) => {
            const p = this.players.find(pl => pl.id === pid);
            return [p ? p.name : pid, v];
          })
        ),
      })),
    };

    // Player-specific info
    if (player) {
      state.you = {
        id: player.id,
        name: player.name,
        isHost: player.id === this.hostId,
        isLeader,
        isOnTeam: this.teamProposal.includes(player.id),
      };

      if (this.phase !== PHASES.LOBBY) {
        state.you.role = ROLES[player.role]?.name || player.role;
        state.you.roleKey = player.role;
        state.you.team = player.team;
        state.you.knownInfo = getKnownInfo(player, this.players);
      }
    }

    // Phase-specific data
    if (this.phase === PHASES.LOBBY) {
      state.config = this.config;
    }

    if (this.phase === PHASES.TEAM_PROPOSAL) {
      state.requiredTeamSize = this.config.questSizes[this.currentQuest];
    }

    if (this.phase === PHASES.TEAM_VOTE) {
      state.teamProposal = this.teamProposal.map(pid => {
        const p = this.players.find(pl => pl.id === pid);
        return { id: pid, name: p ? p.name : '?' };
      });
      state.votesSubmitted = Object.keys(this.votes).length;
      state.youVoted = this.votes[playerId] != null;
    }

    if (this.phase === PHASES.QUEST) {
      state.teamProposal = this.teamProposal.map(pid => {
        const p = this.players.find(pl => pl.id === pid);
        return { id: pid, name: p ? p.name : '?' };
      });
      state.questVotesSubmitted = Object.keys(this.questVotes).length;
      state.youVoted = this.questVotes[playerId] != null;
    }

    if (this.phase === PHASES.ASSASSIN_GUESS) {
      state.isAssassin = player?.role === 'ASSASSIN';
    }

    if (this.phase === PHASES.GAME_OVER) {
      state.winner = this.winner;
      state.winReason = this.winReason;
      state.assassinTarget = this.assassinTarget;
      // Reveal all roles
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
