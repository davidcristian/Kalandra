/** Why main returned no saved config at `GET /config` although config.json exists. */
export interface ConfigProblem {
  reason: "unreadable";
  file: string;
  message: string;
}
