// Avalon role definitions

const ROLES = {
  // Good roles
  LOYAL_SERVANT: { name: 'Loyal Servant', team: 'GOOD', special: false },
  MERLIN:        { name: 'Merlin',        team: 'GOOD', special: true },
  PERCIVAL:      { name: 'Percival',      team: 'GOOD', special: true },

  // Evil roles
  MINION:   { name: 'Minion of Mordred', team: 'EVIL', special: false },
  ASSASSIN: { name: 'Assassin',          team: 'EVIL', special: true },
  MORGANA:  { name: 'Morgana',           team: 'EVIL', special: true },
  MORDRED:  { name: 'Mordred',           team: 'EVIL', special: true },
  OBERON:   { name: 'Oberon',            team: 'EVIL', special: true },
};

// Assign roles to players given config
// config.roles = { merlin: bool, percival: bool, morgana: bool, mordred: bool, oberon: bool }
// assassin is always included if merlin is enabled
function assignRoles(players, goodCount, evilCount, enabledRoles) {
  const goodRoles = [];
  const evilRoles = [];

  // Add special good roles
  if (enabledRoles.merlin) goodRoles.push('MERLIN');
  if (enabledRoles.percival) goodRoles.push('PERCIVAL');

  // Add special evil roles
  if (enabledRoles.merlin) evilRoles.push('ASSASSIN'); // assassin always with merlin
  if (enabledRoles.morgana) evilRoles.push('MORGANA');
  if (enabledRoles.mordred) evilRoles.push('MORDRED');
  if (enabledRoles.oberon) evilRoles.push('OBERON');

  // Fill remaining slots with generic roles
  while (goodRoles.length < goodCount) goodRoles.push('LOYAL_SERVANT');
  while (evilRoles.length < evilCount) evilRoles.push('MINION');

  // Trim if too many special roles (shouldn't happen if UI validates, but be safe)
  goodRoles.length = goodCount;
  evilRoles.length = evilCount;

  const allRoles = [...goodRoles, ...evilRoles];

  // Shuffle roles
  for (let i = allRoles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allRoles[i], allRoles[j]] = [allRoles[j], allRoles[i]];
  }

  // Assign to players
  for (let i = 0; i < players.length; i++) {
    players[i].role = allRoles[i];
    players[i].team = ROLES[allRoles[i]].team;
  }
}

// Compute what a player knows based on their role
function getKnownInfo(player, allPlayers) {
  const info = [];
  const role = player.role;

  if (role === 'MERLIN') {
    // Sees all evil EXCEPT Mordred
    for (const p of allPlayers) {
      if (p.id === player.id) continue;
      if (p.team === 'EVIL' && p.role !== 'MORDRED') {
        info.push({ id: p.id, name: p.name, hint: 'Evil' });
      }
    }
  } else if (role === 'PERCIVAL') {
    // Sees Merlin and Morgana, but doesn't know which is which
    const candidates = allPlayers.filter(p =>
      p.role === 'MERLIN' || p.role === 'MORGANA'
    );
    for (const p of candidates) {
      info.push({ id: p.id, name: p.name, hint: 'Merlin or Morgana' });
    }
  } else if (player.team === 'EVIL' && role !== 'OBERON') {
    // Evil players see each other, except Oberon is invisible
    for (const p of allPlayers) {
      if (p.id === player.id) continue;
      if (p.team === 'EVIL' && p.role !== 'OBERON') {
        info.push({ id: p.id, name: p.name, hint: 'Evil' });
      }
    }
  }
  // OBERON and LOYAL_SERVANT see nothing

  return info;
}

module.exports = { ROLES, assignRoles, getKnownInfo };
