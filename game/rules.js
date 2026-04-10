// Standard Avalon quest configurations by player count
// questSizes[i] = number of players on quest i+1
// doubleFail[i] = true if quest i+1 requires 2 fail cards to fail

const STANDARD_CONFIGS = {
  5:  { good: 3, evil: 2, questSizes: [2,3,2,3,3], doubleFail: [false,false,false,false,false] },
  6:  { good: 4, evil: 2, questSizes: [2,3,4,3,4], doubleFail: [false,false,false,false,false] },
  7:  { good: 4, evil: 3, questSizes: [2,3,3,4,4], doubleFail: [false,false,false,true,false] },
  8:  { good: 5, evil: 3, questSizes: [3,4,4,5,5], doubleFail: [false,false,false,true,false] },
  9:  { good: 6, evil: 3, questSizes: [3,4,4,5,5], doubleFail: [false,false,false,true,false] },
  10: { good: 6, evil: 4, questSizes: [3,4,4,5,5], doubleFail: [false,false,false,true,false] },
};

function getDefaultConfig(playerCount) {
  if (STANDARD_CONFIGS[playerCount]) {
    return { ...STANDARD_CONFIGS[playerCount] };
  }
  // For non-standard player counts, compute reasonable defaults
  const evil = Math.max(2, Math.floor(playerCount / 3));
  const good = playerCount - evil;
  const questSizes = [
    Math.max(2, Math.floor(playerCount * 0.4)),
    Math.max(2, Math.floor(playerCount * 0.5)),
    Math.max(2, Math.floor(playerCount * 0.5)),
    Math.max(2, Math.floor(playerCount * 0.6)),
    Math.max(2, Math.floor(playerCount * 0.6)),
  ];
  const doubleFail = [false, false, false, playerCount >= 7, false];
  return { good, evil, questSizes, doubleFail };
}

module.exports = { STANDARD_CONFIGS, getDefaultConfig };
