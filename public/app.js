/* global io */
const socket = io();
let state = null;
let selectedTeam = new Set();
let assassinTarget = null;

// --- Helpers ---
function $(id) { return document.getElementById(id); }
function show(id) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function emit(event, data, cb) {
  socket.emit(event, data, (res) => {
    if (res?.error) toast(res.error);
    else if (cb) cb(res);
  });
}

// --- Auto-reconnect ---
const saved = {
  get gameId() { return sessionStorage.getItem('avalon_gameId'); },
  set gameId(v) { sessionStorage.setItem('avalon_gameId', v); },
  get name() { return sessionStorage.getItem('avalon_name'); },
  set name(v) { sessionStorage.setItem('avalon_name', v); },
};

socket.on('connect', () => {
  if (saved.gameId && saved.name) {
    emit('join-game', { gameId: saved.gameId, playerName: saved.name });
  }
});

// --- Create / Join ---
$('createBtn').onclick = () => {
  const name = $('playerName').value.trim();
  if (!name) return toast('Enter your name');
  saved.name = name;
  emit('create-game', { playerName: name }, (res) => {
    saved.gameId = res.gameId;
  });
};

$('joinBtn').onclick = () => {
  const name = $('playerName').value.trim();
  const code = $('joinCode').value.trim().toUpperCase();
  if (!name) return toast('Enter your name');
  if (!code) return toast('Enter game code');
  saved.name = name;
  emit('join-game', { gameId: code, playerName: name }, () => {
    saved.gameId = code;
  });
};

// --- Config (host) ---
function adjustCount(type, delta) {
  if (!state) return;
  const cfg = state.config;
  let good = cfg.goodCount ?? state.players.length - 2;
  let evil = cfg.evilCount ?? 2;

  if (type === 'good') good = Math.max(1, good + delta);
  else evil = Math.max(1, evil + delta);

  emit('configure-game', { goodCount: good, evilCount: evil });
}

function updateConfig() {
  emit('configure-game', {
    roles: {
      merlin: $('roleMerlin').checked,
      percival: $('rolePercival').checked,
      morgana: $('roleMorgana').checked,
      mordred: $('roleMordred').checked,
      oberon: $('roleOberon').checked,
    }
  });
}

$('startBtn').onclick = () => emit('start-game', {});

// --- Role Acknowledge ---
$('ackBtn').onclick = () => emit('acknowledge-role', {});

// --- Team Proposal ---
$('proposeBtn').onclick = () => {
  emit('propose-team', { team: Array.from(selectedTeam) });
};

// --- Voting ---
function castVote(vote) {
  emit('cast-vote', { vote });
}

function questVote(vote) {
  emit('quest-vote', { vote });
}

// --- Assassin ---
$('assassinBtn').onclick = () => {
  if (!assassinTarget) return toast('Select a player');
  emit('assassin-guess', { targetId: assassinTarget });
};

// --- Restart ---
$('restartBtn').onclick = () => emit('restart-game', {});

// --- Quest Board Renderer ---
function renderQuestBoard(containerId, st) {
  const el = $(containerId);
  if (!st.questSizes) { el.innerHTML = ''; return; }
  el.innerHTML = st.questSizes.map((size, i) => {
    let cls = 'quest-slot';
    if (i === st.currentQuest && st.phase !== 'GAME_OVER') cls += ' current';
    const result = st.questResults[i];
    if (result) cls += result.result === 'success' ? ' success' : ' fail';
    const df = st.doubleFail[i] ? '<div class="df">2F</div>' : '';
    return `<div class="${cls}"><span>${size}</span>${df}</div>`;
  }).join('');
}

// --- Reject Tracker ---
function renderRejects(containerId, count) {
  const el = $(containerId);
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += `<div class="reject-dot${i < count ? ' filled' : ''}"></div>`;
  }
  el.innerHTML = html;
}

// --- Role Info Bar ---
function renderRoleBar(containerId, st) {
  const el = $(containerId);
  if (!st.you?.role) { el.innerHTML = ''; return; }
  const teamClass = st.you.team === 'GOOD' ? 'team-good' : 'team-evil';
  let info = '';
  if (st.you.knownInfo && st.you.knownInfo.length > 0) {
    info = ' | Sees: ' + st.you.knownInfo.map(k => k.name).join(', ');
  }
  el.innerHTML = `<span>You: <strong>${st.you.role}</strong></span><span class="role-team ${teamClass}" style="font-size:0.75rem; padding:0.15rem 0.5rem">${st.you.team}</span>`;
}

// --- Main Render ---
socket.on('game-state', (s) => {
  state = s;
  render(s);
});

function render(s) {
  switch (s.phase) {
    case 'LOBBY': renderLobby(s); break;
    case 'ROLE_REVEAL': renderRoleReveal(s); break;
    case 'TEAM_PROPOSAL': renderTeamProposal(s); break;
    case 'TEAM_VOTE': renderTeamVote(s); break;
    case 'QUEST': renderQuest(s); break;
    case 'ASSASSIN_GUESS': renderAssassin(s); break;
    case 'GAME_OVER': renderGameOver(s); break;
  }
}

function renderLobby(s) {
  show('lobby');
  $('lobbyCode').textContent = s.gameId;
  $('playerCount').textContent = s.players.length;
  $('lobbyPlayers').innerHTML = s.players.map(p => {
    const badges = [];
    if (p.isHost) badges.push('<span class="badge badge-host">Host</span>');
    if (p.id === s.you?.id) badges.push('<span class="badge badge-you">You</span>');
    return `<li class="player-item"><span>${p.name}</span><span>${badges.join(' ')}</span></li>`;
  }).join('');

  if (s.you?.isHost) {
    $('configPanel').style.display = '';
    $('waitingHost').style.display = 'none';
    const cfg = s.config;
    $('goodCount').textContent = cfg.goodCount ?? '?';
    $('evilCount').textContent = cfg.evilCount ?? '?';
    $('roleMerlin').checked = cfg.roles.merlin;
    $('rolePercival').checked = cfg.roles.percival;
    $('roleMorgana').checked = cfg.roles.morgana;
    $('roleMordred').checked = cfg.roles.mordred;
    $('roleOberon').checked = cfg.roles.oberon;
  } else {
    $('configPanel').style.display = 'none';
    $('waitingHost').style.display = '';
  }
}

function renderRoleReveal(s) {
  show('roleReveal');
  $('revealRoleName').textContent = s.you.role;
  const isGood = s.you.team === 'GOOD';
  $('revealTeam').textContent = s.you.team;
  $('revealTeam').className = 'role-team ' + (isGood ? 'team-good' : 'team-evil');

  const known = s.you.knownInfo || [];
  if (known.length > 0) {
    $('revealKnown').innerHTML = '<h3>You know:</h3>' +
      known.map(k => `<div class="known-item">${k.name} — <em>${k.hint}</em></div>`).join('');
  } else {
    $('revealKnown').innerHTML = '<h3>You have no special knowledge</h3>';
  }
}

function renderTeamProposal(s) {
  show('teamProposal');
  renderQuestBoard('tpQuestBoard', s);
  renderRoleBar('tpRoleBar', s);
  renderRejects('tpRejects', s.consecutiveRejects);
  $('tpQuestNum').textContent = s.currentQuest + 1;
  $('tpTeamSize').textContent = s.requiredTeamSize;

  const leader = s.players.find(p => p.isLeader);

  if (s.you?.isLeader) {
    $('tpLeaderView').style.display = '';
    $('tpWaitView').style.display = 'none';

    // Reset selection if new proposal round
    if (selectedTeam.size > 0) {
      // Keep valid selections
      selectedTeam = new Set([...selectedTeam].filter(id => s.players.some(p => p.id === id)));
    }

    $('tpPlayerList').innerHTML = s.players.map(p => {
      const sel = selectedTeam.has(p.id) ? ' selected' : '';
      const you = p.id === s.you.id ? ' <span class="badge badge-you">You</span>' : '';
      return `<li class="player-item${sel}" onclick="togglePlayer('${p.id}')"><span>${p.name}${you}</span></li>`;
    }).join('');

    $('proposeBtn').disabled = selectedTeam.size !== s.requiredTeamSize;
    $('proposeBtn').textContent = `Propose Team (${selectedTeam.size}/${s.requiredTeamSize})`;
  } else {
    $('tpLeaderView').style.display = 'none';
    $('tpWaitView').style.display = '';
    $('tpLeaderName').textContent = leader ? leader.name : '?';
  }
}

function togglePlayer(id) {
  if (selectedTeam.has(id)) selectedTeam.delete(id);
  else selectedTeam.add(id);
  render(state);
}

function renderTeamVote(s) {
  show('teamVote');
  renderQuestBoard('tvQuestBoard', s);
  renderRoleBar('tvRoleBar', s);
  renderRejects('tvRejects', s.consecutiveRejects);

  $('tvTeamList').innerHTML = s.teamProposal.map(p =>
    `<li class="player-item"><span>${p.name}</span><span class="badge badge-team">Team</span></li>`
  ).join('');

  $('tvVoteCount').textContent = s.votesSubmitted;
  $('tvTotalPlayers').textContent = s.players.length;

  if (s.youVoted) {
    $('tvButtons').style.display = 'none';
    $('tvWaiting').style.display = '';
  } else {
    $('tvButtons').style.display = '';
    $('tvWaiting').style.display = 'none';
  }
}

function renderQuest(s) {
  show('quest');
  renderQuestBoard('qQuestBoard', s);
  renderRoleBar('qRoleBar', s);
  $('qQuestNum').textContent = s.currentQuest + 1;
  $('qTeamNames').textContent = s.teamProposal.map(p => p.name).join(', ');
  $('qVoteCount').textContent = s.questVotesSubmitted;
  $('qTeamSize').textContent = s.teamProposal.length;

  const isOnTeam = s.you?.isOnTeam;
  if (isOnTeam && !s.youVoted) {
    $('qVoteView').style.display = '';
    $('qWaiting').style.display = 'none';
    // Good players can't fail
    $('qFailBtn').style.display = s.you.team === 'GOOD' ? 'none' : '';
  } else {
    $('qVoteView').style.display = 'none';
    $('qWaiting').style.display = '';
  }
}

function renderAssassin(s) {
  show('assassin');
  renderQuestBoard('aQuestBoard', s);

  if (s.isAssassin) {
    $('aAssassinView').style.display = '';
    $('aWaiting').style.display = 'none';

    // Only show good players (or all if assassin doesn't know)
    $('aPlayerList').innerHTML = s.players.map(p => {
      if (p.id === s.you.id) return '';
      const sel = assassinTarget === p.id ? ' selected' : '';
      return `<li class="player-item${sel}" onclick="selectAssassinTarget('${p.id}')"><span>${p.name}</span></li>`;
    }).join('');

    $('assassinBtn').disabled = !assassinTarget;
  } else {
    $('aAssassinView').style.display = 'none';
    $('aWaiting').style.display = '';
  }
}

function selectAssassinTarget(id) {
  assassinTarget = id;
  render(state);
}

function renderGameOver(s) {
  show('gameOver');
  const goodWon = s.winner === 'GOOD';
  $('goBanner').textContent = goodWon ? 'Good Wins!' : 'Evil Wins!';
  $('goBanner').className = 'winner-banner ' + (goodWon ? 'good-wins' : 'evil-wins');
  $('goReason').textContent = s.winReason;

  $('goRoles').innerHTML = (s.revealedRoles || []).map(p =>
    `<div class="role-reveal-item">
      <span>${p.name} — ${p.role}</span>
      <span class="team-tag ${p.team.toLowerCase()}">${p.team}</span>
    </div>`
  ).join('');

  // Vote history
  $('goVotes').innerHTML = (s.voteHistory || []).map((vh, i) => {
    const votes = Object.entries(vh.votes).map(([name, v]) =>
      `${name}: <span style="color:${v === 'approve' ? 'var(--good)' : 'var(--evil)'}">${v}</span>`
    ).join(', ');
    return `<div class="vote-history-entry">
      <div>Round ${i + 1}: ${vh.leader} proposed [${vh.team.join(', ')}]</div>
      <div>${votes}</div>
      <div class="result ${vh.approved ? 'approved' : 'rejected'}">${vh.approved ? 'Approved' : 'Rejected'}</div>
    </div>`;
  }).join('');

  if (s.you?.isHost) {
    $('restartBtn').style.display = '';
  } else {
    $('restartBtn').style.display = 'none';
  }

  // Reset state for next game
  selectedTeam = new Set();
  assassinTarget = null;
}
