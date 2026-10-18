import { WebSocketServer, type WebSocket } from "ws";
import { type AddressInfo } from "net";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { EventEmitter } from "events";
import * as path from "path";
import { app } from "electron";
import { IpcEvent, IpcEventPayload, HostState } from "../../ipc/types";
import { ConfigStore } from "./host-files/ConfigStore";
import { addFileUploadRoutes } from "./host-files/file-uploads";
import { readListenOption } from "./listen-option";
import { sendFile } from "./served-file";
import { isAllowedRequest } from "./request-origin";
import type { AppUpdater } from "./AppUpdater";
import type { Logger } from "./RemoteLogger";

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
  httpRoutes.emit("request", req, res);
});
const websocketServer = new WebSocketServer({ noServer: true });
let lastActiveClient: WebSocket;

addFileUploadRoutes(httpRoutes);

if (!process.env.VITE_DEV_SERVER_URL) {
  httpRoutes.addListener("request", (req, res) => {
    if (
      req.url?.startsWith("/config") ||
      req.url?.startsWith("/uploads") ||
      req.url?.startsWith("/proxy")
    )
      return;

    const filePath = req.url === "/" ? "/index.html" : req.url!;
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
}

const evBus = new EventEmitter();

export function onEventAnyClient<Name extends IpcEvent["name"]>(
  name: Name,
  cb: (payload: IpcEventPayload<Name>) => void,
) {
  evBus.on(name, cb);
}

export function sendEventTo(
  target: "last-active" | "any" | "broadcast",
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

export async function startServer(
  appUpdater: AppUpdater,
  logger: Logger,
): Promise<number> {
  const configStore = new ConfigStore(eventPipe);

  websocketServer.on("connection", (socket) => {
    lastActiveClient = socket;
    socket.on("message", (bytes) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const event = JSON.parse(bytes.toString("utf-8")) as IpcEvent;
      if (event.name === "CLIENT->MAIN::used-recently") {
        lastActiveClient = socket;
      }
      evBus.emit(event.name, event.payload);
    });
    socket.on("close", () => {
      const clients = websocketServer.clients;
      if (clients.size === 1) {
        lastActiveClient = clients.values().next().value!;
        evBus.emit("CLIENT->MAIN::used-recently", { isOverlay: true });
      }
    });
    sendEventTo("last-active", {
      name: "MAIN->CLIENT::log-entry",
      payload: { message: logger.history },
    });
  });

  httpRoutes.addListener("request", async (req, res) => {
    if (req.url === "/config") {
      res.setHeader("content-type", "application/json");
      const resBody: HostState = {
        version: app.getVersion(),
        updater: appUpdater.info,
        contents: await configStore.load(),
      };
      res.end(JSON.stringify(resBody));
    }
  });

  const listen = readListenOption(process.argv, {
    host: "127.0.0.1",
    port: process.env.VITE_DEV_SERVER_URL ? 8584 : 0,
  });
  if (listen.error) {
    logger.write(`error [server] ${listen.error}, using the default address`);
  }
  const { host, port } = listen.address;

  return await new Promise((resolve, reject) => {
    server
      .listen({ port, host })
      .once("error", reject)
      .once("listening", () => {
        resolve((server.address() as AddressInfo).port);
      });
  });
}
