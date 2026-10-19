import type { AddressInfo, Server } from "net";

export interface ListenAddress {
  host: string;
  port: number;
}

export interface ListenOption {
  address: ListenAddress;
  error?: string;
}

const MAX_PORT = 65535;

// --listen=[host][:port], with an IPv6 host in brackets: --listen=[::1]:9001
export function readListenOption(
  argv: readonly string[],
  defaults: ListenAddress,
): ListenOption {
  const arg = argv.find((a) => a === "--listen" || a.startsWith("--listen="));
  if (arg === undefined) return { address: defaults };
  if (arg === "--listen") {
    return {
      address: defaults,
      error: "--listen needs its value after =, such as --listen=:9001",
    };
  }

  const value = arg.slice("--listen=".length);
  const match = /^(?:\[([^\]]+)\]|([^:[\]]*))(?::(\d*))?$/.exec(value);
  if (!match) {
    return {
      address: defaults,
      error: `--listen value "${value}" is unreadable`,
    };
  }
  const host = match[1] ?? match[2];
  const portText = match[3];
  const port = portText ? Number(portText) : defaults.port;
  if (port > MAX_PORT) {
    return { address: defaults, error: `--listen has a port over ${MAX_PORT}` };
  }
  return { address: { host: host || defaults.host, port } };
}

/** Listens on `address`, or on `fallback` after `address` fails, and resolves the port. */
export async function listenWithFallback(
  server: Server,
  address: ListenAddress,
  fallback: ListenAddress,
  onFallback: (error: Error) => void,
): Promise<number> {
  try {
    return await listen(server, address);
  } catch (error) {
    const isFallback =
      address.host === fallback.host && address.port === fallback.port;
    if (isFallback || !(error instanceof Error)) throw error;
    onFallback(error);
    return await listen(server, fallback);
  }
}

async function listen(server: Server, address: ListenAddress) {
  return await new Promise<number>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve((server.address() as AddressInfo).port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({ host: address.host, port: address.port });
  });
}
