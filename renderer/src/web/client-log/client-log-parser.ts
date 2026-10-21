import { CLIENT_STRINGS as _$ } from "@/assets/data";
import { ClientLogEvent, SkillPointEvent } from "@ipc/types";

export enum ClientLogInfoType {
  Log = "log",
  GameStart = "game-start",
  Login = "login",
  LoadZone = "load-zone",
  LevelUp = "level-up",
  GameVersion = "game-version",
  AltTab = "alt-tab",
  Npc = "npc",
  PlayerDeath = "player-death",
  PassiveTree = "passive-tree",
  PermanentBonus = "permanent-bonus",
  SkillPoint = "skill-point",
  MapNav = "map-nav",
  Afk = "afk",
}

enum LogNamespace {
  None,
  Startup = "STARTUP",
  Http2 = "HTTP2",
  Window = "WINDOW",
  Scene = "SCENE",
}

const GAME_VERSION_LINE = "User agent: PoE poe2_production/tags/";
const KNOWN_NPC_NAMES = new Set([
  "Renly",
  "Ghostly Voice",
  "The Rust King",
  "Beira of the Rotten Pack",
  "The Bloated Miller",
  "Mortimer",
  "Wounded Man",
]);
const SLAIN_REGEX = /(?<char_name>.+) has been slain./;
const PASSIVE_SKILL_REGEX_REF =
  /Successfully (?<direction>(un)?allocated) passive skill id: (?<node_id>.+), name: (?<node_name>.+)/;
const PERMANENT_BONUS_REGEX = /(?<char_name>.+) has received (?<bonus>.+)/;
const SKILL_POINT_REGEX =
  /You have received (?<points>(\d+|an?)) (?<point_type>.*) Skill Points?\./;

const MAP_NAV_REGEX = /Set Source \[(?<map_name>.+)\]/;

const AFK_MODE_ON = 'AFK mode is now ON. Autoreply "This player is AFK."';
const AFK_MODE_OFF = "AFK mode is now OFF.";

export function parseClientLogText(
  text: string,
  datetime: string,
  millis: number,
): ClientLogEvent {
  let match: RegExpMatchArray | null;
  let data: ClientLogEvent = {
    ts: Date.parse(datetime),
    ms: millis,
    type: ClientLogInfoType.Log,
  };

  let namespace: LogNamespace = LogNamespace.None;
  if (text.startsWith("[")) {
    const endNamespaceIndex = text.indexOf("]");
    if (endNamespaceIndex !== -1) {
      namespace = text.slice(1, endNamespaceIndex) as LogNamespace;
      text = text.slice(endNamespaceIndex + 1).trim();
    }
  }

  if (namespace === LogNamespace.Startup) {
    if (text === "Game Start") {
      // game start

      data.type = ClientLogInfoType.GameStart;
    }
  } else if (namespace === LogNamespace.Http2) {
    if (text.startsWith(GAME_VERSION_LINE)) {
      // game version

      const sliceA = text.slice(GAME_VERSION_LINE.length);
      const version = sliceA.split(" ", 1)[0];

      data = {
        ...data,
        type: ClientLogInfoType.GameVersion,
        version,
      };
    }
  } else if (namespace === LogNamespace.Window) {
    if (text === "Gained focus") {
      data = {
        ...data,
        type: ClientLogInfoType.AltTab,
        gameFocused: true,
      };
    } else if (text === "Lost focus") {
      data = {
        ...data,
        type: ClientLogInfoType.AltTab,
        gameFocused: false,
      };
    }
  } else if (namespace === LogNamespace.Scene) {
    if ((match = text.match(MAP_NAV_REGEX))) {
      // Logged when the Map or Atlas panel opens or closes; the source is (null) on close

      data = {
        ...data,
        type: ClientLogInfoType.MapNav,
        mapName: match.groups!.map_name,
      };
    }
  } else if (namespace === LogNamespace.None) {
    if (text[0] === ":") {
      // A local message shown to the player in chat
      const colonLess = text.slice(1).trim();

      if (colonLess === AFK_MODE_ON || colonLess === AFK_MODE_OFF) {
        // AFK status

        data = {
          ...data,
          type: ClientLogInfoType.Afk,
          isAfk: colonLess === AFK_MODE_ON,
        };
      } else if ((match = colonLess.match(_$.LOG_LEVEL_UP))) {
        // level up

        data = {
          ...data,
          type: ClientLogInfoType.LevelUp,
          level: Number.parseInt(match.groups!.level, 10),
          charName: match.groups!.char_name,
          charClass: match.groups!.char_class,
        };
      } else if ((match = colonLess.match(PERMANENT_BONUS_REGEX))) {
        // permanent bonus
        data = {
          ...data,
          type: ClientLogInfoType.PermanentBonus,
          permanentBonus: match.groups!.bonus,
          charName: match.groups!.char_name,
        };
      } else if ((match = colonLess.match(SKILL_POINT_REGEX))) {
        // Skill points
        const count =
          match.groups!.points[0] === "a"
            ? 1
            : Number.parseInt(match.groups!.points, 10);

        let pointType: SkillPointEvent["pointType"];

        switch (match.groups!.point_type) {
          case "Atlas":
            pointType = "atlas";
            break;
          case "Map Boss Atlas":
            pointType = "map-boss";
            break;
          case "Arbiter Boss Atlas":
            pointType = "arbiter-boss";
            break;
          case "Abyss Atlas":
            pointType = "abyss";
            break;
          case "Ritual Atlas":
            pointType = "ritual";
            break;
          case "Delirium Atlas":
            pointType = "delirium";
            break;
          case "Expedition Atlas":
            pointType = "expedition";
            break;
          case "Breach Atlas":
            pointType = "breach";
            break;
          case "Weapon Set Passive":
            pointType = "weapon-set";
            break;
          case "Passive":
          default:
            pointType = "passive";
            break;
        }

        data = {
          ...data,
          type: ClientLogInfoType.SkillPoint,
          points: count,
          pointType,
        };
      } else if ((match = text.match(SLAIN_REGEX))) {
        data = {
          ...data,
          type: ClientLogInfoType.PlayerDeath,
          charName: match.groups!.char_name,
        };
      }
    } else if (text[0] === "#") {
      // some global message
    } else if (text[0] === "@") {
      // some whisper
    } else if (text[0] === "&") {
      // some guild message
    } else if (text[0] === "$") {
      // some trade message
    } else if ((match = text.match(_$.LOG_ZONE_GEN))) {
      // zone load

      const zone = match.groups!.zone.toLowerCase();

      data = {
        ...data,
        type: ClientLogInfoType.LoadZone,
        zone: zone,
        areaLevel: Number.parseInt(match.groups!.area_level, 10),
        seed: Number.parseInt(match.groups!.seed, 10),
      };
    } else if ((match = text.match(PASSIVE_SKILL_REGEX_REF))) {
      // passive point spend/refund

      data = {
        ...data,
        type: ClientLogInfoType.PassiveTree,
        allocate: match.groups!.direction === "allocated",
        nodeId: match.groups!.node_id,
        nodeName: match.groups!.node_name,
      };
    } else {
      // either normal log with no namespace, or some npc/local chat message
      const firstColonIndex = text.indexOf(":");
      if (firstColonIndex !== -1) {
        const possibleName = text.slice(0, firstColonIndex).trim();
        const message = text.slice(firstColonIndex + 1).trim();
        if (KNOWN_NPC_NAMES.has(possibleName)) {
          // npc event

          data = {
            ...data,
            type: ClientLogInfoType.Npc,
            npcName: possibleName,
            message,
          };
        }
      }
    }
  }
  return data;
}
