import * as http from "http";
import WebSocket from "ws";
import type { IpcEvent } from "../../ipc/types";

export interface Reply {
  status: number;
  body: string;
}

// http.request sends the path as written, so a test can send ".." segments a browser would remove
export async function get(
  port: number,
  urlPath: string,
  headers: http.OutgoingHttpHeaders = {},
): Promise<Reply> {
  return await send({ host: "127.0.0.1", port, path: urlPath, headers });
}

export async function post(
  port: number,
  urlPath: string,
  body: string,
  headers: http.OutgoingHttpHeaders = {},
): Promise<Reply> {
  const options = {
    host: "127.0.0.1",
    port,
    path: urlPath,
    method: "POST",
    headers,
  };
  return await send(options, body);
}

// Resolves the status and the Allow header of a request with this method and no body
export async function sendMethod(
  port: number,
  method: string,
  urlPath: string,
): Promise<{ status: number; allow: string | undefined }> {
  return await new Promise((resolve, reject) => {
    const options = { host: "127.0.0.1", port, path: urlPath, method };
    const req = http.request(options, (res) => {
      res.resume();
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, allow: res.headers.allow });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function send(
  options: http.RequestOptions,
  requestBody?: string,
): Promise<Reply> {
  return await new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end(requestBody);
  });
}

// Resolves 101 when the upgrade succeeds, the status code the server returned instead, or 0 when it closed the connection
export async function openSocket(
  port: number,
  headers: { host?: string; origin?: string },
  urlPath = "/events",
): Promise<number> {
  return await new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${urlPath}`, {
      ...(headers.origin ? { origin: headers.origin } : {}),
      headers: headers.host ? { host: headers.host } : {},
    });
    socket.on("open", () => {
      socket.close();
      resolve(101);
    });
    socket.on("unexpected-response", (req, res) => {
      resolve(res.statusCode ?? 0);
      req.destroy();
    });
    socket.on("error", () => {
      resolve(0);
    });
  });
}

// Resolves an open /events client that sends the page's own origin and this User-Agent, or none
export async function openClient(
  port: number,
  userAgent?: string,
): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/events`, {
      origin: `http://127.0.0.1:${port}`,
      headers: userAgent ? { "user-agent": userAgent } : {},
    });
    socket.on("open", () => {
      resolve(socket);
    });
    socket.on("error", reject);
  });
}

/** Returns the text of a message, which the default nodebuffer binary type passes as one Buffer. */
function messageText(data: WebSocket.RawData): string {
  if (!Buffer.isBuffer(data))
    throw new TypeError("The message is not one Buffer");
  return data.toString("utf-8");
}

// Resolves the first `count` messages a new /events client receives, or those that came within 2 seconds
export async function firstMessages(
  port: number,
  count: number,
): Promise<unknown[]> {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/events`, {
      origin: `http://127.0.0.1:${port}`,
    });
    const messages: unknown[] = [];
    const done = () => {
      clearTimeout(timer);
      socket.close();
      resolve(messages);
    };
    const timer = setTimeout(done, 2000);
    socket.on("message", (data) => {
      messages.push(JSON.parse(messageText(data)));
      if (messages.length === count) done();
    });
    socket.on("error", reject);
  });
}

/** An /events client that keeps the events main sends it, in the order they came. */
export class EventClient {
  private readonly kept: IpcEvent[] = [];
  private readonly waiting: Array<(event: IpcEvent) => void> = [];

  private constructor(private readonly socket: WebSocket) {
    socket.on("message", (data) => {
      const event = JSON.parse(messageText(data)) as IpcEvent;
      const resolve = this.waiting.shift();
      if (resolve) resolve(event);
      else this.kept.push(event);
    });
  }

  // The message listener is added before the socket opens, so no event main sends on connect is missed
  static async open(port: number): Promise<EventClient> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/events`, {
      origin: `http://127.0.0.1:${port}`,
    });
    const client = new EventClient(socket);
    await new Promise((resolve, reject) => {
      socket.on("open", resolve);
      socket.on("error", reject);
    });
    return client;
  }

  /** Resolves the oldest event not read yet, and waits for the next one when there is none. */
  async next(): Promise<IpcEvent> {
    const event = this.kept.shift();
    if (event) return event;
    return await new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  send(event: IpcEvent) {
    this.socket.send(JSON.stringify(event));
  }

  close() {
    this.socket.close();
  }
}
