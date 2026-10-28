import { WebSocketServer, type WebSocket } from "ws";
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "http";
import { EventEmitter } from "events";
import * as path from "path";
import { app } from "electron";
import { IpcEvent, IpcEventPayload, HostState } from "../../ipc/types";
import { ConfigStore } from "./host-files/ConfigStore";
import {
  type ListenAddress,
  listenWithFallback,
  readListenOption,
} from "./listen-option";
import { sendFile } from "./served-file";
import { isAllowedRequest } from "./request-origin";
import { clientLogWriter } from "./client-log-writer";
import { CONTENT_SECURITY_POLICY } from "../../renderer/content-security-policy";
import type { AppUpdater } from "./AppUpdater";
import type { Logger } from "./RemoteLogger";
import type { OverlayWindow } from "./windowing/OverlayWindow";

interface HttpRouteEvents {
  request: [IncomingMessage, ServerResponse];
}
export type HttpRoutes = EventEmitter<HttpRouteEvents>;

// Every route listens here, so no route runs for a request that fails the check
export const httpRoutes: HttpRoutes = new EventEmitter<HttpRouteEvents>();

export const server = createServer((req, res) => {
  if (!isAllowedRequest(req.headers, false)) {
    res.statusCode = 403;
    res.end();
    return;
  }
  res.setHeader("content-security-policy", CONTENT_SECURITY_POLICY);
  httpRoutes.emit("request", req, res);
});
const websocketServer = new WebSocketServer({ noServer: true });
let lastActiveClient: WebSocket;
const overlayClients = new WeakSet<WebSocket>();

// The /config route in startServer(), addFileUploadRoutes() and HttpProxy answer these paths
function hasOwnRoute(url: string): boolean {
  return (
    url === "/config" ||
    url.startsWith("/uploads/") ||
    url.startsWith("/proxy/")
  );
}

httpRoutes.addListener("request", (req, res) => {
  const url = req.url ?? "/";
  if (hasOwnRoute(url)) return;
  // Vite serves the renderer files in development
  if (process.env.VITE_DEV_SERVER_URL) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const filePath = url === "/" ? "/index.html" : url;
  switch (path.extname(filePath)) {
    case ".html":
      res.setHeader("content-type", "text/html");
      break;
    case ".js":
      res.setHeader("content-type", "text/javascript");
      break;
    case ".json":
      res.setHeader("content-type", "application/json");
      break;
    case ".svg":
      res.setHeader("content-type", "image/svg+xml");
      break;
  }

  sendFile(res, __dirname, filePath);
});

const evBus = new EventEmitter();

export function onEventAnyClient<Name extends IpcEvent["name"]>(
  name: Name,
  cb: (payload: IpcEventPayload<Name>) => void,
) {
  evBus.on(name, cb);
}

export function sendEventTo(
  target: "last-active" | "broadcast",
  event: IpcEvent,
) {
  const msg = JSON.stringify(event);
  if (target === "broadcast") {
    for (const client of websocketServer.clients) {
      client.send(msg);
    }
  } else {
    lastActiveClient.send(msg);
  }
}

export interface ServerEvents {
  onEventAnyClient: typeof onEventAnyClient;
  sendEventTo: typeof sendEventTo;
}
export const eventPipe = {
  onEventAnyClient,
  sendEventTo,
};

// The overlay window's User-Agent contains "Electron", which Host.isElectron in the renderer also tests,
// and a page in a browser cannot change the User-Agent of its WebSocket
function isOverlayWindow(headers: IncomingHttpHeaders): boolean {
  return headers["user-agent"]?.includes("Electron") ?? false;
}

type ClientMessage = { event: IpcEvent } | { problem: string };

function readClientMessage(text: string): ClientMessage {
  let message: unknown;
  try {
    message = JSON.parse(text);
  } catch (error) {
    return {
      problem: `a message that is not JSON (${(error as Error).message})`,
    };
  }
  if (
    typeof message !== "object" ||
    message === null ||
    !("name" in message) ||
    typeof message.name !== "string"
  ) {
    return { problem: "a message without an event name" };
  }
  return { event: message as IpcEvent };
}

server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/events") {
    return req.destroy();
  }
  if (!isAllowedRequest(req.headers, true)) {
    socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  websocketServer.handleUpgrade(req, socket, head, (ws) => {
    websocketServer.emit("connection", ws, req);
  });
});

async function sendHostState(
  res: ServerResponse,
  configStore: ConfigStore,
  appUpdater: Pick<AppUpdater, "info">,
): Promise<void> {
  res.setHeader("content-type", "application/json");
  const { contents, problem } = await configStore.load();
  const resBody: HostState = {
    version: app.getVersion(),
    updater: appUpdater.info,
    contents,
    configProblem: problem,
  };
  res.end(JSON.stringify(resBody));
}

export async function startServer(
  appUpdater: Pick<AppUpdater, "info">,
  logger: Logger,
  overlay: Pick<OverlayWindow, "focus">,
): Promise<ListenAddress> {
  const configStore = new ConfigStore(eventPipe, logger);

  websocketServer.on("connection", (socket, req: IncomingMessage) => {
    lastActiveClient = socket;
    const isOverlay = isOverlayWindow(req.headers);
    if (isOverlay) overlayClients.add(socket);
    socket.on("message", (bytes) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- the socket keeps the default nodebuffer binary type, so bytes is a Buffer
      const message = readClientMessage(bytes.toString("utf-8"));
      if ("problem" in message) {
        logger.write(`warn [server] Ignored ${message.problem}`);
        return;
      }
      const { event } = message;
      if (!isOverlay && event.name.startsWith("OVERLAY->MAIN::")) {
        logger.write(
          `warn [server] Ignored ${event.name} from a page outside the overlay window`,
        );
        return;
      }
      if (event.name === "CLIENT->MAIN::used-recently") {
        lastActiveClient = socket;
      }
      // A client can send any name, and EventEmitter throws for "error" when nothing listens for it
      if (evBus.listenerCount(event.name) === 0) {
        logger.write(
          `warn [server] Ignored ${event.name}, which main does not handle`,
        );
        return;
      }
      try {
        // Every page parses the game log and sends the same entries, so main takes those of one page
        if (
          event.name === "CLIENT->MAIN::write-data" &&
          event.payload.action === "client-log-event" &&
          clientLogWriter(
            websocketServer.clients,
            (client) => overlayClients.has(client),
            lastActiveClient,
          ) !== socket
        ) {
          return;
        }
        evBus.emit(event.name, event.payload);
      } catch (error) {
        logger.write(
          `error [server] Handling ${event.name} failed: ${(error as Error).message}`,
        );
      }
    });
    socket.on("close", () => {
      const clients = websocketServer.clients;
      const remaining = clients.values().next().value;
      // OverlayWindow keeps isOverlay from the last used-recently, which the closed client may have sent
      if (clients.size === 1 && remaining) {
        lastActiveClient = remaining;
        evBus.emit("CLIENT->MAIN::used-recently", {
          isOverlay: overlayClients.has(lastActiveClient),
        });
      }
    });
    sendEventTo("last-active", {
      name: "MAIN->CLIENT::log-entry",
      payload: { message: logger.history },
    });
    // The first update check starts before the page loads, so the state can change after GET /config
    sendEventTo("last-active", {
      name: "MAIN->CLIENT::updater-state",
      payload: appUpdater.info,
    });
    // OverlayWindow sends focus-change only when the focus moves, so a page that loads again gets the current focus here
    sendEventTo("last-active", {
      name: "MAIN->OVERLAY::focus-change",
      payload: overlay.focus,
    });
  });

  httpRoutes.addListener("request", (req, res) => {
    if (req.url === "/config") {
      void sendHostState(res, configStore, appUpdater); // load() logs a failed read
    }
  });

  const defaults = {
    host: "127.0.0.1",
    port: process.env.VITE_DEV_SERVER_URL ? 8584 : 0,
  };
  const listen = readListenOption(process.argv, defaults);
  if (listen.error) {
    logger.write(`error [server] ${listen.error}, using the default address`);
  }
  return await listenWithFallback(server, listen.address, defaults, (error) => {
    logger.write(`error [server] ${error.message}, using the default address`);
  });
}
