/** Returns how many levels an area can be above the player's level with full experience. */
export function calcBaseSafeZone(playerLevel: number): number {
  return Math.floor(playerLevel / 16) + 3;
}

/** Returns the safe zone minus the levels the area is above the player, the widget's Over. */
export function getOverIdeal(
  playerLevel: number,
  monsterLevel: number,
): number {
  const safeZone = calcBaseSafeZone(playerLevel);
  return safeZone - (monsterLevel - playerLevel);
}

/** Returns the experience multiplier in percent, from 1 to 100. */
export function getExpPenalty(
  playerLevel: number,
  monsterLevel: number,
): number {
  const safeZone =
    monsterLevel > playerLevel ? calcBaseSafeZone(playerLevel) : 0;

  const effectiveDiff = Math.max(
    Math.abs(monsterLevel - playerLevel) - safeZone,
    0,
  );

  const expMulti = Math.max(
    0.01,
    ((playerLevel + 5) / (playerLevel + 5 + effectiveDiff ** 2.5)) ** 1.3,
  );

  return 100 * expMulti;
}

/** Returns true for the levels the formula has no test data for, which the widget marks with a star. */
export function outsideTestData(playerLevel: number, areaLevel: number) {
  return areaLevel > 70 || playerLevel >= 95;
}
