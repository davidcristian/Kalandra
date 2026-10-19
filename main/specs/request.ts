import * as http from "http";
import WebSocket from "ws";

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
): Promise<Reply> {
  const options = { host: "127.0.0.1", port, path: urlPath, method: "POST" };
  return await send(options, body);
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

// Resolves 101 when the upgrade succeeds, or the status code the server returned instead
export async function openSocket(
  port: number,
  headers: { host?: string; origin?: string },
): Promise<number> {
  return await new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/events`, {
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
      messages.push(JSON.parse(String(data)));
      if (messages.length === count) done();
    });
    socket.on("error", reject);
  });
}
