import fs from "fs";
import path from "path";

export const DATA_DIR = path.resolve(__dirname, "../../public/data");

interface Messages {
  [key: string]: string | Messages;
}

/** Reads the app_i18n.json of a language as a map from each dotted key to its text. */
export function readMessages(lang: string): Map<string, string> {
  const file = path.join(DATA_DIR, lang, "app_i18n.json");
  const root = JSON.parse(fs.readFileSync(file, "utf8")) as Messages;
  const flat = new Map<string, string>();
  const walk = (node: Messages, prefix: string) => {
    for (const [key, value] of Object.entries(node)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") flat.set(fullKey, value);
      else walk(value, fullKey);
    }
  };
  walk(root, "");
  return flat;
}
