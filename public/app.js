/* global io */
const socket = io();
let state = null;
let assassinTarget = null;

// --- i18n ---
let lang = localStorage.getItem('avalon_lang') || 'en';

const T = {
  en: {
    title: 'Avalon',
    subtitle: 'Offline game assistant',
    yourName: 'Your name',
    createGame: 'Create Game',
    gameCode: 'Game code',
    joinGame: 'Join Game',
    gameLobby: 'Game Lobby',
    shareCode: 'Share this code with other players',
    players: 'Players',
    settings: 'Settings',
    goodPlayers: 'Good players',
    evilPlayers: 'Evil players',
    merlinAssassin: 'Merlin & Assassin',
    startGame: 'Start Game',
    waitingHost: 'Waiting for host to start',
    yourRole: 'Your Role',
    seenRole: "I've seen my role",
    youKnow: 'You know:',
    noKnowledge: 'You have no special knowledge',
    quest: 'Quest',
    teamSize: 'Team size',
    needs2Fails: '(needs 2 fails)',
    hostInstruction: 'Discuss, vote, and quest in person. Then record the result:',
    questSuccess: 'Quest Success',
    questFail: 'Quest Fail',
    playerInstruction: 'Play the game in person. Host will record results.',
    assassinPhase: 'Assassin Phase',
    assassinDesc: 'Good completed 3 quests! The Assassin now guesses who Merlin is. Select the target:',
    confirmKill: 'Confirm Assassination',
    assassinWait: 'Assassin phase in progress',
    goodWins: 'Good Wins!',
    evilWins: 'Evil Wins!',
    roles: 'Roles',
    questResults: 'Quest Results',
    playAgain: 'Play Again',
    enterName: 'Enter your name',
    enterCode: 'Enter game code',
    selectPlayer: 'Select a player',
    host: 'Host',
    you: 'You',
    // Role names
    roleMerlin: 'Merlin',
    rolePercival: 'Percival',
    roleAssassin: 'Assassin',
    roleMorgana: 'Morgana',
    roleMordred: 'Mordred',
    roleOberon: 'Oberon',
    roleLoyalServant: 'Loyal Servant',
    roleMinionOfMordred: 'Minion of Mordred',
    // Hints
    hintEvil: 'Evil',
    hintMerlinOrMorgana: 'Merlin or Morgana',
    // Teams
    teamGood: 'GOOD',
    teamEvil: 'EVIL',
    // Win reasons
    reason3Failed: '3 quests failed',
    reason3Succeeded: '3 quests succeeded',
    reasonAssassinFound: 'Assassin found Merlin',
    reasonAssassinFailed: 'Assassin failed to find Merlin',
    reason5Rejects: '5 consecutive team rejections',
  },
  zh: {
    title: 'Avalon',
    subtitle: '线下游戏助手',
    yourName: '你的名字',
    createGame: '创建游戏',
    gameCode: '房间号',
    joinGame: '加入游戏',
    gameLobby: '游戏大厅',
    shareCode: '将房间号分享给其他玩家',
    players: '玩家',
    settings: '设置',
    goodPlayers: '好人数量',
    evilPlayers: '坏人数量',
    merlinAssassin: '梅林 & 刺客',
    startGame: '开始游戏',
    waitingHost: '等待房主开始游戏',
    yourRole: '你的角色',
    seenRole: '我已查看角色',
    youKnow: '你知道的信息：',
    noKnowledge: '你没有特殊情报',
    quest: '任务',
    teamSize: '队伍人数',
    needs2Fails: '（需要2张失败牌）',
    hostInstruction: '请面对面讨论、投票、执行任务，然后记录结果：',
    questSuccess: '任务成功',
    questFail: '任务失败',
    playerInstruction: '请面对面进行游戏，房主会记录结果。',
    assassinPhase: '刺客阶段',
    assassinDesc: '好人完成了3个任务！刺客现在猜测谁是梅林，请选择目标：',
    confirmKill: '确认刺杀',
    assassinWait: '刺客阶段进行中',
    goodWins: '好人获胜！',
    evilWins: '坏人获胜！',
    roles: '角色揭晓',
    questResults: '任务结果',
    playAgain: '再来一局',
    enterName: '请输入名字',
    enterCode: '请输入房间号',
    selectPlayer: '请选择一个玩家',
    host: '房主',
    you: '你',
    // Role names
    roleMerlin: '梅林',
    rolePercival: '派西维尔',
    roleAssassin: '刺客',
    roleMorgana: '莫甘娜',
    roleMordred: '莫德雷德',
    roleOberon: '奥伯伦',
    roleLoyalServant: '忠臣',
    roleMinionOfMordred: '爪牙',
    // Hints
    hintEvil: '坏人',
    hintMerlinOrMorgana: '梅林或莫甘娜',
    // Teams
    teamGood: '好人',
    teamEvil: '坏人',
    // Win reasons
    reason3Failed: '3个任务失败',
    reason3Succeeded: '3个任务成功',
    reasonAssassinFound: '刺客找到了梅林',
    reasonAssassinFailed: '刺客没有找到梅林',
    reason5Rejects: '连续5次否决队伍',
  }
};

function t(key) { return T[lang][key] || T.en[key] || key; }

function translateRole(englishRole) {
  const map = {
    'Merlin': t('roleMerlin'),
    'Percival': t('rolePercival'),
    'Assassin': t('roleAssassin'),
    'Morgana': t('roleMorgana'),
    'Mordred': t('roleMordred'),
    'Oberon': t('roleOberon'),
    'Loyal Servant': t('roleLoyalServant'),
    'Minion of Mordred': t('roleMinionOfMordred'),
  };
  return map[englishRole] || englishRole;
}

function translateTeam(team) {
  return team === 'GOOD' ? t('teamGood') : t('teamEvil');
}

function translateHint(hint) {
  const map = {
    'Evil': t('hintEvil'),
    'Merlin or Morgana': t('hintMerlinOrMorgana'),
  };
  return map[hint] || hint;
}

function translateWinReason(reason) {
  const map = {
    '3 quests failed': t('reason3Failed'),
    '3 quests succeeded': t('reason3Succeeded'),
    'Assassin found Merlin': t('reasonAssassinFound'),
    'Assassin failed to find Merlin': t('reasonAssassinFailed'),
    '5 consecutive team rejections': t('reason5Rejects'),
  };
  return map[reason] || reason;
}

function toggleLang() {
  lang = lang === 'en' ? 'zh' : 'en';
  localStorage.setItem('avalon_lang', lang);
  $('langBtn').textContent = lang === 'en' ? '中文' : 'EN';
  applyStaticText();
  if (state) render(state);
}

function applyStaticText() {
  // Home
  $('homeTitle').textContent = t('title');
  $('homeSubtitle').textContent = t('subtitle');
  $('playerName').placeholder = t('yourName');
  $('createBtn').textContent = t('createGame');
  $('joinCode').placeholder = t('gameCode');
  $('joinBtn').textContent = t('joinGame');
  // Lobby
  $('lobbyTitle').textContent = t('gameLobby');
  $('lobbyShareText').textContent = t('shareCode');
  $('settingsTitle').textContent = t('settings');
  $('labelGood').textContent = t('goodPlayers');
  $('labelEvil').textContent = t('evilPlayers');
  $('labelMerlin').textContent = t('merlinAssassin');
  $('labelPercival').textContent = 'Percival / ' + t('rolePercival');
  $('labelMorgana').textContent = 'Morgana / ' + t('roleMorgana');
  $('labelMordred').textContent = 'Mordred / ' + t('roleMordred');
  $('labelOberon').textContent = 'Oberon / ' + t('roleOberon');
  $('startBtn').textContent = t('startGame');
  // Role reveal
  $('revealTitle').textContent = t('yourRole');
  $('ackBtn').textContent = t('seenRole');
  // Assassin
  $('assassinTitle').textContent = t('assassinPhase');
  $('assassinDesc').textContent = t('assassinDesc');
  $('assassinBtn').textContent = t('confirmKill');
  // Game over
  $('goRolesTitle').textContent = t('roles');
  $('goQuestTitle').textContent = t('questResults');
  $('restartBtn').textContent = t('playAgain');
}

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
  if (!name) return toast(t('enterName'));
  saved.name = name;
  emit('create-game', { playerName: name }, (res) => {
    saved.gameId = res.gameId;
  });
};

$('joinBtn').onclick = () => {
  const name = $('playerName').value.trim();
  const code = $('joinCode').value.trim().toUpperCase();
  if (!name) return toast(t('enterName'));
  if (!code) return toast(t('enterCode'));
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
$('ackBtn').onclick = () => emit('acknowledge-role', {});
$('restartBtn').onclick = () => emit('restart-game', {});

// --- Quest Recording (host only) ---
function recordQuest(result) {
  emit('record-quest', { result });
}

// --- Assassin Guess (host records) ---
$('assassinBtn').onclick = () => {
  if (!assassinTarget) return toast(t('selectPlayer'));
  emit('assassin-guess', { targetId: assassinTarget });
};

function selectAssassinTarget(id) {
  assassinTarget = id;
  render(state);
}

// --- Quest Board Renderer ---
function renderQuestBoard(containerId, st) {
  const el = $(containerId);
  if (!st.questSizes) { el.innerHTML = ''; return; }
  el.innerHTML = st.questSizes.map((size, i) => {
    let cls = 'quest-slot';
    if (i === st.currentQuest && st.phase !== 'GAME_OVER') cls += ' current';
    const result = st.questResults[i];
    if (result === 'success') cls += ' success';
    else if (result === 'fail') cls += ' fail';
    const df = st.doubleFail[i] ? '<div class="df">2F</div>' : '';
    return `<div class="${cls}"><span>${size}</span>${df}</div>`;
  }).join('');
}

// --- Role Info Bar ---
function renderRoleBar(containerId, st) {
  const el = $(containerId);
  if (!st.you?.role) { el.innerHTML = ''; return; }
  const teamClass = st.you.team === 'GOOD' ? 'team-good' : 'team-evil';
  const roleName = translateRole(st.you.role);
  const teamName = translateTeam(st.you.team);
  el.innerHTML = `<span>${t('you')}: <strong>${roleName}</strong></span><span class="role-team ${teamClass}" style="font-size:0.75rem; padding:0.15rem 0.5rem">${teamName}</span>`;
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
    case 'QUEST_TRACK': renderQuestTrack(s); break;
    case 'ASSASSIN_GUESS': renderAssassin(s); break;
    case 'GAME_OVER': renderGameOver(s); break;
  }
}

function renderLobby(s) {
  show('lobby');
  $('lobbyCode').textContent = s.gameId;
  $('playerCount').textContent = s.players.length;
  $('lobbyPlayersLabel').textContent = t('players');
  $('lobbyPlayers').innerHTML = s.players.map(p => {
    const badges = [];
    if (p.isHost) badges.push(`<span class="badge badge-host">${t('host')}</span>`);
    if (p.id === s.you?.id) badges.push(`<span class="badge badge-you">${t('you')}</span>`);
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
    $('waitingHostText').textContent = t('waitingHost');
  }
}

function renderRoleReveal(s) {
  show('roleReveal');
  $('revealRoleName').textContent = translateRole(s.you.role);
  const isGood = s.you.team === 'GOOD';
  $('revealTeam').textContent = translateTeam(s.you.team);
  $('revealTeam').className = 'role-team ' + (isGood ? 'team-good' : 'team-evil');

  const known = s.you.knownInfo || [];
  if (known.length > 0) {
    $('revealKnown').innerHTML = `<h3>${t('youKnow')}</h3>` +
      known.map(k => `<div class="known-item">${k.name} — <em>${translateHint(k.hint)}</em></div>`).join('');
  } else {
    $('revealKnown').innerHTML = `<h3>${t('noKnowledge')}</h3>`;
  }
}

function renderQuestTrack(s) {
  show('questTrack');
  renderQuestBoard('qtQuestBoard', s);
  renderRoleBar('qtRoleBar', s);
  $('qtQuestLabel').textContent = t('quest');
  $('qtQuestNum').textContent = s.currentQuest + 1;
  $('qtTeamSizeLabel').textContent = t('teamSize') + ': ';
  $('qtTeamSize').textContent = s.questSizeNeeded;
  $('qtDoubleFail').textContent = t('needs2Fails');
  $('qtDoubleFail').style.display = s.doubleFailNeeded ? '' : 'none';

  if (s.you?.isHost) {
    $('qtHostView').style.display = '';
    $('qtPlayerView').style.display = 'none';
    $('qtHostInstruction').textContent = t('hostInstruction');
    $('qtSuccessBtn').textContent = t('questSuccess');
    $('qtFailBtn').textContent = t('questFail');
  } else {
    $('qtHostView').style.display = 'none';
    $('qtPlayerView').style.display = '';
    $('qtPlayerText').textContent = t('playerInstruction');
  }
}

function renderAssassin(s) {
  show('assassin');
  renderQuestBoard('aQuestBoard', s);

  if (s.you?.isHost) {
    $('aHostView').style.display = '';
    $('aPlayerWait').style.display = 'none';

    $('aPlayerList').innerHTML = s.players.map(p => {
      const sel = assassinTarget === p.id ? ' selected' : '';
      return `<li class="player-item${sel}" onclick="selectAssassinTarget('${p.id}')"><span>${p.name}</span></li>`;
    }).join('');

    $('assassinBtn').disabled = !assassinTarget;
  } else {
    $('aHostView').style.display = 'none';
    $('aPlayerWait').style.display = '';
    $('aPlayerWaitText').textContent = t('assassinWait');
  }
}

function renderGameOver(s) {
  show('gameOver');
  const goodWon = s.winner === 'GOOD';
  $('goBanner').textContent = goodWon ? t('goodWins') : t('evilWins');
  $('goBanner').className = 'winner-banner ' + (goodWon ? 'good-wins' : 'evil-wins');
  $('goReason').textContent = translateWinReason(s.winReason);

  renderQuestBoard('goQuestBoard', s);

  $('goRoles').innerHTML = (s.revealedRoles || []).map(p =>
    `<div class="role-reveal-item">
      <span>${p.name} — ${translateRole(p.role)}</span>
      <span class="team-tag ${p.team.toLowerCase()}">${translateTeam(p.team)}</span>
    </div>`
  ).join('');

  $('restartBtn').style.display = s.you?.isHost ? '' : 'none';
  assassinTarget = null;
}

// --- Init ---
$('langBtn').textContent = lang === 'en' ? '中文' : 'EN';
applyStaticText();
