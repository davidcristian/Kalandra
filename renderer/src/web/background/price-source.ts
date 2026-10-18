// Serves the hourly price files that priceService/ builds from poe.ninja
export const PRICE_HOST = "kalandra.ashoal.com";

// Must match league_file_name in priceService/price_service/transform.py
export function leagueFileName(leagueId: string): string {
  return `${leagueId.toLowerCase().replace(/[^a-z0-9]/g, "")}.json`;
}

export function priceFileUrl(leagueId: string): string {
  return `${PRICE_HOST}/prices/${leagueFileName(leagueId)}`;
}
