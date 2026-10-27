import { ParsedItem, ItemRarity, ItemCategory } from "@/parser";
import { ACCESSORY, ARMOUR, GEM, WEAPON } from "@/parser/meta";
import { TRADE_TAG_TO_REF } from "@/assets/data";

export function getCurrencyDetailsId(id: string) {
  const refName = TRADE_TAG_TO_REF.get(id);
  if (refName === undefined) {
    // Names that no item has, so the price lookup finds nothing for an unknown currency
    return { ns: "nan ns", name: "nan item", variant: undefined };
  }
  return {
    ns: "ITEM",
    name: refName,
    variant: undefined,
  };
}

export function isValuableBasetype(item: ParsedItem): boolean {
  if (
    !(
      item.rarity === ItemRarity.Normal ||
      item.rarity === ItemRarity.Magic ||
      item.rarity === ItemRarity.Rare
    ) ||
    !item.category
  )
    return false;

  return (
    ACCESSORY.has(item.category) ||
    ARMOUR.has(item.category) ||
    WEAPON.has(item.category) ||
    item.category === ItemCategory.Quiver
  );
}

export function getDetailsId(item: ParsedItem) {
  if (item.category && GEM.has(item.category)) {
    return forSkillGem(item);
  }
  if (item.category === ItemCategory.Map) {
    return {
      ns: item.info.namespace,
      name: item.mapBlighted
        ? `${item.mapBlighted} ${item.info.refName}`
        : item.info.refName,
      variant: variant([
        `T${item.mapTier}`,
        item.rarity !== ItemRarity.Unique ? "Gen-18" : null,
      ]),
    };
  }
  if (item.rarity === ItemRarity.Unique) {
    return forUniqueItem(item);
  }
  if (item.category === ItemCategory.Tablet) {
    return {
      ns: item.info.namespace,
      name: item.info.refName,
      variant: variant([item.rarity ? item.rarity.toString() : ""]),
    };
  }
  if (isValuableBasetype(item)) {
    return forBasetype(item);
  }
  return {
    ns: item.info.namespace,
    name: item.info.refName,
    variant: undefined,
  };
}

function forSkillGem(item: ParsedItem) {
  return {
    ns: item.info.namespace,
    name: item.info.refName,
    variant: undefined,
  };
}

function forBasetype(item: ParsedItem) {
  if (item.influences.length > 1) return;

  return {
    ns: item.info.namespace,
    name: item.info.refName,
    variant: variant([item.influences.length ? item.influences[0] : null]),
  };
}

function forUniqueItem(item: ParsedItem) {
  if (!item.info.unique) return;

  return {
    ns: item.info.namespace,
    name: item.info.refName,
    variant: variant([item.info.unique.base]),
  };
}

function variant(props: Array<string | null>): string | undefined {
  props = props.filter((p) => p != null);
  if (!props.length) return undefined;
  return props.join(", ");
}
