import { CurrencyValue, displayRounding } from "@/web/background/Prices";

export interface TradeVolume {
  currency: CurrencyValue["currency"];
  primaryVolumePerHour: string;
  itemsPerHour?: string;
  highestVolumeCurrency: string;
}

/** Formats the hourly volume of a currency exchange item from its price and volume in divines. */
export function tradeVolume(
  entry: {
    primaryValue: number;
    volumePrimaryValue: number;
    maxVolumeCurrency: string;
  },
  autoCurrency: (divines: number) => CurrencyValue,
): TradeVolume {
  const perHour = autoCurrency(entry.volumePrimaryValue);
  // Both values stay in divines: autoCurrency can put one in the core currency and rounds near 1 Divine Orb.
  const itemsPerHour =
    entry.primaryValue > 0
      ? entry.volumePrimaryValue / entry.primaryValue
      : undefined;

  return {
    currency: perHour.currency,
    primaryVolumePerHour: displayRounding(perHour.min),
    itemsPerHour:
      itemsPerHour === undefined
        ? undefined
        : displayRounding(itemsPerHour, false, true),
    highestVolumeCurrency: entry.maxVolumeCurrency,
  };
}
