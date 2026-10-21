import { TipsFrequency } from "../Config";

export const TIP_COUNT = 26;

export function randomTip(): number {
  return Math.floor(Math.random() * TIP_COUNT) + 1;
}

export const TIP_FREQUENCY_MAP: Record<TipsFrequency, number> = {
  [TipsFrequency.Always]: 1,
  [TipsFrequency.MoreOften]: 7,
  [TipsFrequency.Normal]: 20,
  [TipsFrequency.Rarely]: 50,
  [TipsFrequency.VeryRarely]: 100,
  [TipsFrequency.Never]: -1,
};
