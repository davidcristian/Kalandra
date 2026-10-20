/** Returns the client whose client log entries main writes: the newest overlay window, or the last active client. */
export function clientLogWriter<Client>(
  clients: Iterable<Client>,
  isOverlay: (client: Client) => boolean,
  lastActive: Client,
): Client {
  // An overlay window that reloads can connect again before main sees its old connection close
  let newestOverlay: Client | undefined;
  for (const client of clients) {
    if (isOverlay(client)) newestOverlay = client;
  }
  return newestOverlay ?? lastActive;
}
