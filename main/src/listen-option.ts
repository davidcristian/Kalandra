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
