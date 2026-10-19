import { describe, expect, it } from "vitest";
import { CurrencyValue } from "@/web/background/Prices";
import { tradeVolume } from "@/web/price-check/trends/trade-volume";

const EXALTED_PER_DIVINE = 541.6;

// Converts divines the way autoCurrency does with Exalted Orbs as the core currency.
function autoCurrency(divines: number): CurrencyValue {
  const exalted = divines * EXALTED_PER_DIVINE;
  if (exalted <= EXALTED_PER_DIVINE * 0.94) {
    return { min: exalted, max: exalted, currency: "exalted" };
  }
  const shown = exalted < EXALTED_PER_DIVINE * 1.06 ? 1 : divines;
  return { min: shown, max: shown, currency: "div" };
}

function volume(primaryValue: number, volumePrimaryValue: number) {
  return tradeVolume(
    { primaryValue, volumePrimaryValue, maxVolumeCurrency: "exalted" },
    autoCurrency,
  );
}

describe("tradeVolume", () => {
  it("counts items per hour when the price is in divines and the volume in exalted", () => {
    expect(volume(2, 0.5)).toEqual({
      currency: "exalted",
      primaryVolumePerHour: "271",
      itemsPerHour: "0 . 3",
      highestVolumeCurrency: "exalted",
    });
  });

  it("counts items per hour from the volume before it is rounded to 1 divine", () => {
    const result = volume(0.5, 1.05);

    expect(result.currency).toBe("div");
    expect(result.primaryVolumePerHour).toBe("1");
    expect(result.itemsPerHour).toBe("2 . 1");
  });

  it("counts items per hour when the price and the volume are both in exalted", () => {
    expect(volume(0.01, 0.5).itemsPerHour).toBe("50");
  });

  it("leaves out items per hour for an item with a price of zero", () => {
    const result = volume(0, 0.5);

    expect(result.primaryVolumePerHour).toBe("271");
    expect(result.itemsPerHour).toBeUndefined();
  });
});
