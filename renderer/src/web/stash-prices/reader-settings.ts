export const DEFAULT_INTERVAL_MINUTES = 10;
export const MIN_INTERVAL_MINUTES = 5;
export const DEFAULT_SEARCH_BUDGET = 400;
// The trade site allows 600 searches per IP in 3 hours (x-rate-limit-ip of a search)
export const MAX_SEARCH_BUDGET = 600;

/** The settings of the stash prices widget that the reader reads. */
export interface ReaderSettings {
  enabled: boolean;
  tabName: string;
  intervalMinutes: number;
  searchBudget: number;
}

/** Returns the interval in minutes: at least 5, and the default for a value that is not a number. */
export function clampInterval(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_INTERVAL_MINUTES;
  return Math.max(MIN_INTERVAL_MINUTES, Math.round(minutes));
}

/** Returns the search budget: 0 to 600, and the default for a value that is not a number. */
export function clampBudget(searches: number): number {
  if (!Number.isFinite(searches)) return DEFAULT_SEARCH_BUDGET;
  return Math.min(MAX_SEARCH_BUDGET, Math.max(0, Math.round(searches)));
}
