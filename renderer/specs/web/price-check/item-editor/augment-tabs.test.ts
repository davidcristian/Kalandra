import { describe, expect, it } from "vitest";
import { augmentTabs } from "@/web/price-check/item-editor/augment-tabs";
import { readMessages } from "../../app-i18n";

describe("augmentTabs", () => {
  const english = readMessages("en");
  const tabs = augmentTabs((key) => english.get(key) ?? key);
  const labels = (list: Array<{ label: string }>) =>
    list.map((tab) => tab.label);
  const values = (list: Array<{ value: string }>) =>
    list.map((tab) => tab.value);

  it("labels each tab with its English UI text", () => {
    expect(labels(tabs.main)).toEqual([
      "Rune",
      "Soul Core",
      "Idol",
      "Legacy",
      "Other",
    ]);
    expect(labels(tabs.rune)).toEqual([
      "Lesser",
      "Normal",
      "Greater",
      "Perfect",
      "Other",
    ]);
    expect(labels(tabs.soulCore)).toEqual(["Normal", "Special"]);
  });

  it("keeps the values that select the augment groups in the editor", () => {
    expect(values(tabs.main)).toEqual([
      "Rune",
      "Soul Core",
      "Idol",
      "Legacy",
      "Other",
    ]);
    expect(values(tabs.rune)).toEqual([
      "Lesser",
      "Normal",
      "Greater",
      "Perfect",
      "Other",
    ]);
    expect(values(tabs.soulCore)).toEqual(["Normal", "Special"]);
  });
});
