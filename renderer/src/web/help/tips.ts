import { TipsFrequency } from "../Config";

export const TIP_COUNT = 26;

export function randomTip(): number {
  return Math.floor(Math.random() * TIP_COUNT) + 1;
}

const TIP_FREQUENCY_MAP: Record<TipsFrequency, number> = {
  [TipsFrequency.Always]: 1,
  [TipsFrequency.MoreOften]: 7,
  [TipsFrequency.Normal]: 20,
  [TipsFrequency.Rarely]: 50,
  [TipsFrequency.VeryRarely]: 100,
  [TipsFrequency.Never]: -1,
};

/** Counts the price checked items shown without a tip, and picks a tip as often as the tips frequency setting says. */
export function createTipSchedule(itemsWithoutTip: number) {
  let count = itemsWithoutTip;
  return {
    /** Returns the tip to show, or 0 for none; `newItem` is false when only the item's search started or stopped. */
    next(frequency: TipsFrequency, newItem: boolean, searched: boolean) {
      const due =
        frequency === TipsFrequency.Always ||
        (frequency !== TipsFrequency.Never &&
          count >= TIP_FREQUENCY_MAP[frequency]);
      if (due && !searched) {
        count = 0;
        return randomTip();
      }
      if (newItem) count += 1;
      return 0;
    },
  };
}
