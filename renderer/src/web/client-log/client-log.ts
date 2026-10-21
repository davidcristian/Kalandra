import { createGlobalState } from "@vueuse/core";
import { readonly, shallowRef } from "vue";
import { Host } from "@/web/background/IPC";
import { ClientLogEvent } from "@ipc/types";
import { ClientLogInfoType, parseClientLogText } from "./client-log-parser";

const LogRegex =
  /^(?<datetime>\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) (?<millis>\d+) (?<source>[a-f0-9]+) \[\S+ \S+ \S+\] (?<text>.*)$/;

export const useClientLog = createGlobalState(() => {
  const areaLevel = shallowRef<number>(1);
  const zoneName = shallowRef<string>("G1_1"); // default to riverbank
  const playerLevel = shallowRef<number>(1);
  const lastCharacter = shallowRef<string>("");
  let gameStartMillis = 0;

  let currentDateTime = 0;
  const lineQueue: string[] = [];
  let processing = false;

  /** Handles the lines in order, and logs and skips a line that fails, so the lines after it are still handled. */
  function handleLines(lines: readonly string[]) {
    lineQueue.push(...lines);
    if (processing) return;
    processing = true;
    let line = lineQueue.shift();
    while (line !== undefined) {
      try {
        handleLine(line);
      } catch (error) {
        console.error("Skipped a Client.txt line that failed:", line, error);
      }
      line = lineQueue.shift();
    }
    processing = false;
  }

  function handleLine(line: string) {
    const wholeLineMatch = line.match(LogRegex);
    if (!wholeLineMatch) return;
    const { text, datetime, millis } = wholeLineMatch.groups!;
    const millisNum = Number.parseInt(millis, 10);

    const data = parseClientLogText(text, datetime, millisNum);
    updateRefsFromData(data);
    if (data.ts < currentDateTime) {
      console.warn(`time just went backwards: ${data.ts} < ${currentDateTime}`);
    }
    currentDateTime = data.ts;

    if (data.type !== ClientLogInfoType.Log) {
      // skip everything we dont care about
      Host.sendEvent({
        name: "CLIENT->MAIN::write-data",
        payload: {
          action: "client-log-event",
          data,
          close: false,
        },
      });
    }
  }

  function updateRefsFromData(data: ClientLogEvent) {
    if (data.type === ClientLogInfoType.GameStart) {
      gameStartMillis = data.ms;
    } else if (data.type === ClientLogInfoType.LoadZone) {
      // ignore town/hideout for purpose of level tracking
      if (!(data.zone.includes("town") || data.zone.includes("hideout"))) {
        if (data.zone === "g1_1") {
          // can only be on riverbank if new character
          playerLevel.value = 1;
        }

        areaLevel.value = data.areaLevel;
        zoneName.value = data.zone;
      }
    } else if (data.type === ClientLogInfoType.LevelUp) {
      playerLevel.value = data.level;
      lastCharacter.value = data.charName;
    }

    if (data.ms < gameStartMillis) {
      console.warn("Millis rolled over");
    }
  }

  function setPlayerLevel(level: number | "") {
    if (level === "") {
      return;
    }
    playerLevel.value = level;
  }

  function testOnlyResetGameMillis() {
    gameStartMillis = 0;
  }

  return {
    handleLine,
    handleLines,
    playerLevel: readonly(playerLevel),
    areaLevel: readonly(areaLevel),
    zoneName: readonly(zoneName),
    setPlayerLevel,
    testOnlyResetGameMillis,
  };
});
