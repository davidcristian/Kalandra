/** Why main returned no saved config at `GET /config` although config.json exists. */
export type ConfigProblem =
  | { reason: "unreadable"; file: string; message: string }
  | { reason: "not-json"; file: string; backup: string };
