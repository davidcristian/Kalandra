type Translate = (key: string) => string;

/** Returns the augment editor tabs: each value selects a group of augments, each label is its UI text. */
export function augmentTabs(t: Translate) {
  return {
    main: [
      { value: "Rune", label: t("item_editor.tab_rune") },
      { value: "Soul Core", label: t("item_editor.tab_soul_core") },
      { value: "Idol", label: t("item_editor.tab_idol") },
      { value: "Legacy", label: t("item_editor.tab_legacy") },
      { value: "Other", label: t("item_editor.tab_other") },
    ],
    rune: [
      { value: "Lesser", label: t("item_editor.tab_rune_lesser") },
      { value: "Normal", label: t("item_editor.tab_rune_normal") },
      { value: "Greater", label: t("item_editor.tab_rune_greater") },
      { value: "Perfect", label: t("item_editor.tab_rune_perfect") },
      { value: "Other", label: t("item_editor.tab_rune_other") },
    ],
    soulCore: [
      { value: "Normal", label: t("item_editor.tab_soul_core_normal") },
      { value: "Special", label: t("item_editor.tab_soul_core_special") },
    ],
  };
}
