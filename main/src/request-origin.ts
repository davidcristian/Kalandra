import { isIP } from "net";
import type { IncomingHttpHeaders } from "http";

// A page whose own host name resolves to 127.0.0.1 (DNS rebinding) sends that name as Host
export function isLocalHost(host: string | undefined): boolean {
  const url = parseHost(host);
  if (!url) return false;
  const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");
  return hostname === "localhost" || isIP(hostname) !== 0;
}

export function isSameOrigin(
  origin: string | undefined,
  host: string | undefined,
): boolean {
  const hostUrl = parseHost(host);
  if (!origin || !hostUrl) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.protocol === "http:" && originUrl.host === hostUrl.host;
  } catch {
    return false;
  }
}

// A browser sends Origin with every WebSocket, but with plain HTTP only for a POST or a cross-origin fetch
export function isAllowedRequest(
  headers: IncomingHttpHeaders,
  isWebSocket: boolean,
): boolean {
  if (!isLocalHost(headers.host)) return false;
  if (headers.origin === undefined) return !isWebSocket;
  return isSameOrigin(headers.origin, headers.host);
}

function parseHost(host: string | undefined): URL | undefined {
  if (!host) return undefined;
  try {
    return new URL(`http://${host}`);
  } catch {
    return undefined;
  }
}
