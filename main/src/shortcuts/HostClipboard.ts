import { clipboard, Clipboard } from "electron";
import type { Logger } from "../RemoteLogger";

const POLL_DELAY = 48;
const POLL_LIMIT = 500;

// The game must read the clipboard within this time, after which it is restored. A game that lags
// reads the restored text instead, which can be a password.
const RESTORE_AFTER = 120;

export class HostClipboard {
  private pollPromise?: Promise<string>;
  private elapsed = 0;
  private shouldRestore = false;
  private initialDelay = POLL_DELAY;

  private isRestored = true;

  constructor(private logger: Logger) {}

  updateOptions(restoreClipboard: boolean) {
    this.shouldRestore = restoreClipboard;
  }

  /** Clears item text from the clipboard, calls `pressCopyKeys` and resolves with the item text the game copies. */
  async readItemText(pressCopyKeys: () => void): Promise<string> {
    this.elapsed = 0;
    if (this.pollPromise) {
      pressCopyKeys();
      return await this.pollPromise;
    }

    this.pollPromise = this.pollItemText(pressCopyKeys).finally(() => {
      this.pollPromise = undefined;
    });
    return await this.pollPromise;
  }

  private async pollItemText(pressCopyKeys: () => void): Promise<string> {
    let textBefore = await clipboard.readText();
    let marker: string | null = null;
    if (isPoeItem(textBefore)) {
      textBefore = "";
      if (process.platform !== "linux") {
        await clipboard.writeText("");
      } else {
        // workaround KDE's "Prevent empty clipboard" feature
        // see https://github.com/SnosMe/awakened-poe-trade/issues/1790#issuecomment-4062830614 (please don't comment on, add issue in Kalandra if discussion is requested)
        marker = await writeMarker();
      }
    } else if (process.platform === "linux") {
      // workaround bug in Proton 10+ https://github.com/SnosMe/awakened-poe-trade/issues/1846 (please don't comment on, add issue in Kalandra if discussion is requested)
      marker = await writeMarker();
    }

    // Only after the write above ends, since a write that ends after the game copies replaces the item text
    pressCopyKeys();

    let textAfter = await readTextAfter(this.initialDelay);
    while (!isPoeItem(textAfter)) {
      this.elapsed += POLL_DELAY;
      if (this.elapsed >= POLL_LIMIT) {
        // On Linux the marker replaced the copied text, which goes back even with Restore clipboard off.
        // No empty text is written back, since the KDE workaround above avoids an empty clipboard.
        const markerReplacedText = textAfter === marker && textBefore !== "";
        if (this.shouldRestore || markerReplacedText) {
          await clipboard.writeText(textBefore);
        }
        this.logger.write("warn [ClipboardPoller] No item text found.");
        throw new Error("Reading clipboard timed out");
      }
      textAfter = await readTextAfter(POLL_DELAY);
    }

    if (this.shouldRestore) {
      await clipboard.writeText(textBefore);
    }
    return textAfter;
  }

  // when `shouldRestore` is false, this function continues
  // to work as a throttler for callback
  async restoreShortly(cb: (clipboard: Clipboard) => Promise<void>) {
    // Not only do we not overwrite the clipboard, but we don't exec callback.
    // This throttling helps against disconnects from "Too many actions".
    if (!this.isRestored) {
      return;
    }

    this.isRestored = false;
    try {
      const saved = await clipboard.readText();
      await cb(clipboard);
      await wait(RESTORE_AFTER);
      if (this.shouldRestore) {
        await clipboard.writeText(saved);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.write(`error [Clipboard] ${message}`);
    } finally {
      this.isRestored = true;
    }
  }

  updateDelay(delay: number) {
    this.initialDelay = delay;
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readTextAfter(ms: number) {
  await wait(ms);
  return await clipboard.readText();
}

async function writeMarker() {
  const marker = `__EE2_FORCE_EMPTY_${Date.now()}`;
  await clipboard.writeText(marker);
  return marker;
}

function isPoeItem(text: string) {
  return LANGUAGE_DETECTOR.find(
    ({ firstLine, uncutSkillGemLine }) =>
      text.startsWith(firstLine) || text.startsWith(uncutSkillGemLine),
  );
}

const LANGUAGE_DETECTOR = [
  {
    lang: "en",
    firstLine: "Item Class: ",
    uncutSkillGemLine: "Rarity: ",
  },
  {
    lang: "ru",
    firstLine: "Класс предмета: ",
    uncutSkillGemLine: "Редкость: ",
  },
  {
    lang: "fr",
    firstLine: "Classe d'objet: ",
    uncutSkillGemLine: "Rareté: ",
  },
  {
    lang: "de",
    firstLine: "Gegenstandsklasse: ",
    uncutSkillGemLine: "Seltenheit: ",
  },
  {
    lang: "pt",
    firstLine: "Classe do Item: ",
    uncutSkillGemLine: "Raridade: ",
  },
  {
    lang: "es",
    firstLine: "Clase de objeto: ",
    uncutSkillGemLine: "Rareza: ",
  },
  {
    lang: "th",
    firstLine: "ชนิดไอเทม: ",
    uncutSkillGemLine: "Rarity: ",
  },
  {
    lang: "ko",
    firstLine: "아이템 종류: ",
    uncutSkillGemLine: "아이템 희귀도: ",
  },
  {
    lang: "cmn-Hant",
    firstLine: "物品種類: ",
    uncutSkillGemLine: "稀有度: ",
  },
  {
    lang: "cmn-Hans",
    firstLine: "物品类别: ",
    uncutSkillGemLine: "Rarity: ",
  },
  {
    lang: "ja",
    firstLine: "アイテムクラス: ",
    uncutSkillGemLine: "レアリティ: ",
  },
];
