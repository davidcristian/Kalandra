export enum ItemCategory {
  Unknown = "Unknown",
  Map = "Map",
  CapturedBeast = "Captured Beast",
  MetamorphSample = "Metamorph Sample",
  Helmet = "Helmet",
  BodyArmour = "Body Armour",
  Gloves = "Gloves",
  Boots = "Boots",
  Shield = "Shield",
  Amulet = "Amulet",
  Belt = "Belt",
  Ring = "Ring",
  Flask = "Flask",
  Jewel = "Jewel",
  Quiver = "Quiver",
  Claw = "Claw",
  Bow = "Bow",
  Sceptre = "Sceptre",
  Wand = "Wand",
  Staff = "Staff",
  Warstaff = "Warstaff",
  Dagger = "Dagger",
  OneHandedAxe = "One Hand Axe",
  TwoHandedAxe = "Two Hand Axe",
  OneHandedMace = "One Hand Mace",
  TwoHandedMace = "Two Hand Mace",
  OneHandedSword = "One Hand Sword",
  TwoHandedSword = "Two Hand Sword",
  Gem = "Gem",
  Currency = "Currency",
  DivinationCard = "Divination Card",
  Voidstone = "Voidstone",
  Charm = "Charm",
  Crossbow = "Crossbow",
  SkillGem = "Active Skill Gem",
  SupportGem = "Support Skill Gem",
  MetaGem = "MetaSkillGem",
  UncutGem = "UncutSkillGem",
  Focus = "Focus",
  Relic = "Relic",
  Tablet = "TowerAugment",
  Spear = "Spear",
  Flail = "Flail",
  Buckler = "Buckler",
  MapFragment = "MapFragment",
  Talisman = "Talisman",
  Wombgift = "BrequelFruit",
  Omen = "Omen",
  SoulCore = "SoulCore",
  PinnacleKey = "PinnacleKey",
  VaultKey = "VaultKey",
  MiscMapItem = "MiscMapItem",
  QuestItem = "QuestItem",
  Breachstone = "Breachstone",
  ExpeditionLogbook = "ExpeditionLogbook",
  Incubator = "Incubator",
}

export const WEAPON_ONE_HANDED_MELEE = new Set([
  ItemCategory.OneHandedAxe,
  ItemCategory.OneHandedMace,
  ItemCategory.OneHandedSword,
  ItemCategory.Claw,
  ItemCategory.Dagger,
  ItemCategory.Spear,
  ItemCategory.Flail,
]);

export const WEAPON_ONE_HANDED = new Set([
  ItemCategory.Sceptre,
  ItemCategory.Wand,
  ...WEAPON_ONE_HANDED_MELEE,
]);

export const WEAPON_TWO_HANDED_MELEE = new Set([
  ItemCategory.TwoHandedAxe,
  ItemCategory.TwoHandedMace,
  ItemCategory.TwoHandedSword,
  ItemCategory.Warstaff,
  ItemCategory.Talisman,
]);

export const MARTIAL_WEAPON = new Set([
  ItemCategory.Bow,
  ItemCategory.Crossbow,
  ...WEAPON_ONE_HANDED_MELEE,
  ...WEAPON_TWO_HANDED_MELEE,
]);

export const WEAPON = new Set([
  ItemCategory.Staff,
  ...WEAPON_ONE_HANDED,
  ...MARTIAL_WEAPON,
]);

export const ARMOUR = new Set([
  ItemCategory.BodyArmour,
  ItemCategory.Boots,
  ItemCategory.Gloves,
  ItemCategory.Helmet,
  ItemCategory.Shield,
  ItemCategory.Focus,
  ItemCategory.Buckler,
]);

export const ACCESSORY = new Set([
  ItemCategory.Amulet,
  ItemCategory.Belt,
  ItemCategory.Ring,
]);

export const GRANTS_REAL_SKILL = new Set([
  ItemCategory.Staff,
  ItemCategory.Wand,
  ItemCategory.Sceptre,
]);

export const GRANTS_SKILL = new Set([
  ...GRANTS_REAL_SKILL,
  ItemCategory.Spear,
  ItemCategory.Shield,
  ItemCategory.Buckler,
]);

export const GEM = new Set([
  ItemCategory.Gem,
  ItemCategory.MetaGem,
  ItemCategory.SupportGem,
]);

export enum ItemEditorType {
  Augment = "augment",
  Catalyst = "catalyst",
  None = "none",
}
