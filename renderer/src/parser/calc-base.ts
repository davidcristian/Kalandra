import { ParsedItem } from "./ParsedItem";
import {
  calcFlat,
  calcIncreased,
  calcPropBase,
  OTHER_PSEUDO_STATS,
  QUALITY_STATS,
} from "./calc-q20";
import { ARMOUR, WEAPON } from "./meta";

export function recalculateItemProperties(
  newItem: ParsedItem,
  oldItem: ParsedItem,
) {
  if (newItem.category !== oldItem.category || !newItem.category) return;

  if (ARMOUR.has(newItem.category)) {
    recalculateArmourProperties(newItem, oldItem);
  }
  if (WEAPON.has(newItem.category)) {
    recalculateWeaponProperties(newItem, oldItem);
  }
}
function recalculateWeaponProperties(newItem: ParsedItem, oldItem: ParsedItem) {
  // phys
  const basePHYSICAL = calcBase(
    oldItem,
    oldItem.weaponPHYSICAL,
    QUALITY_STATS.PHYSICAL_DAMAGE,
  );
  const totalPHYSICAL = calcTotal(
    basePHYSICAL,
    newItem,
    QUALITY_STATS.PHYSICAL_DAMAGE,
  );
  newItem.weaponPHYSICAL = totalPHYSICAL;

  // attack speed
  const baseAS = calcBase(
    oldItem,
    oldItem.weaponAS,
    OTHER_PSEUDO_STATS.ATTACK_SPEED,
    false,
  );
  const totalAS = calcTotal(
    baseAS,
    newItem,
    OTHER_PSEUDO_STATS.ATTACK_SPEED,
    false,
  );
  newItem.weaponAS = totalAS;

  // fire damage
  const baseFIRE = calcBase(
    oldItem,
    oldItem.weaponFIRE,
    OTHER_PSEUDO_STATS.FIRE_DAMAGE,
    false,
  );
  const totalFIRE = calcTotal(
    baseFIRE,
    newItem,
    OTHER_PSEUDO_STATS.FIRE_DAMAGE,
    false,
  );
  newItem.weaponFIRE = totalFIRE;

  // cold damage
  const baseCOLD = calcBase(
    oldItem,
    oldItem.weaponCOLD,
    OTHER_PSEUDO_STATS.COLD_DAMAGE,
    false,
  );
  const totalCOLD = calcTotal(
    baseCOLD,
    newItem,
    OTHER_PSEUDO_STATS.COLD_DAMAGE,
    false,
  );
  newItem.weaponCOLD = totalCOLD;

  // lightning damage
  const baseLIGHTNING = calcBase(
    oldItem,
    oldItem.weaponLIGHTNING,
    OTHER_PSEUDO_STATS.LIGHTNING_DAMAGE,
    false,
  );
  const totalLIGHTNING = calcTotal(
    baseLIGHTNING,
    newItem,
    OTHER_PSEUDO_STATS.LIGHTNING_DAMAGE,
    false,
  );
  newItem.weaponLIGHTNING = totalLIGHTNING;

  // elemental damage
  const baseELEMENTAL = calcBase(
    oldItem,
    oldItem.weaponELEMENTAL,
    OTHER_PSEUDO_STATS.ELEMENTAL_DAMAGE,
    false,
  );
  const totalELEMENTAL = calcTotal(
    baseELEMENTAL,
    newItem,
    OTHER_PSEUDO_STATS.ELEMENTAL_DAMAGE,
    false,
  );
  newItem.weaponELEMENTAL = totalELEMENTAL;

  // other properties
  const baseCRIT = calcBase(
    oldItem,
    oldItem.weaponCRIT,
    OTHER_PSEUDO_STATS.CRIT_CHANCE,
  );
  const totalCRIT = calcTotal(
    baseCRIT,
    newItem,
    OTHER_PSEUDO_STATS.CRIT_CHANCE,
  );
  newItem.weaponCRIT = totalCRIT;

  const baseSPIRIT = calcBase(
    oldItem,
    oldItem.weaponSPIRIT,
    OTHER_PSEUDO_STATS.SPIRIT,
  );

  const totalSPIRIT = calcTotal(baseSPIRIT, newItem, OTHER_PSEUDO_STATS.SPIRIT);
  newItem.weaponSPIRIT = totalSPIRIT;
}

function recalculateArmourProperties(newItem: ParsedItem, oldItem: ParsedItem) {
  if (newItem.armourAR) {
    const base = calcBase(oldItem, oldItem.armourAR, QUALITY_STATS.ARMOUR);
    const total = calcTotal(base, newItem, QUALITY_STATS.ARMOUR);
    newItem.armourAR = total;
  }
  if (newItem.armourEV) {
    const base = calcBase(oldItem, oldItem.armourEV, QUALITY_STATS.EVASION);
    const total = calcTotal(base, newItem, QUALITY_STATS.EVASION);
    newItem.armourEV = total;
  }
  if (newItem.armourES) {
    const base = calcBase(
      oldItem,
      oldItem.armourES,
      QUALITY_STATS.ENERGY_SHIELD,
    );
    const total = calcTotal(base, newItem, QUALITY_STATS.ENERGY_SHIELD);
    newItem.armourES = total;
  }
  if (newItem.armourRW) {
    const base = calcBase(oldItem, oldItem.armourRW, QUALITY_STATS.WARD);
    const total = calcTotal(base, newItem, QUALITY_STATS.WARD);
    newItem.armourRW = total;
  }
  if (newItem.armourBLOCK) {
    const base = calcBase(
      oldItem,
      oldItem.armourBLOCK,
      OTHER_PSEUDO_STATS.BLOCK,
    );
    const total = calcTotal(base, newItem, OTHER_PSEUDO_STATS.BLOCK);
    newItem.armourBLOCK = total;
  }
}

export function calcBase(
  item: ParsedItem,
  inStat: number | undefined,
  statRefs: { flat: string[]; incr: string[] },
  useQuality = true,
) {
  const { incr, flat } = calcPropBase(statRefs, item);
  const base =
    calcFlat(inStat ?? 0, incr.value, useQuality ? (item.quality ?? 0) : 0) -
    flat.value;

  return base;
}

export function calcTotal(
  base: number,
  item: ParsedItem,
  statRefs: { flat: string[]; incr: string[] },
  useQuality = true,
  inverted = false,
) {
  const { incr, flat } = calcPropBase(statRefs, item);

  const damage = calcIncreased(
    base + flat.value,
    incr.value,
    useQuality ? (item.quality ?? 0) : 0,
    inverted,
  );

  return damage;
}
