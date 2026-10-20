import type { TradeResponse } from "./common";

/** A trade site response that holds no data, with the HTTP status the site answered. */
export class TradeResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "TradeResponseError";
  }
}

function notData(status: number, options?: ErrorOptions) {
  return new TradeResponseError(
    `The trade site sent a web page instead of data (status ${status}). It can be down, under maintenance or showing a bot check.`,
    status,
    options,
  );
}

/** Returns the JSON data of a trade site response, or throws a TradeResponseError with the site's error or the status. */
export async function readTradeData<T>(
  response: Pick<Response, "ok" | "status" | "text">,
): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw notData(response.status, { cause: error });
  }
  if (typeof body !== "object" || body === null) {
    throw notData(response.status);
  }

  const data = body as TradeResponse<T>;
  if (data.error) {
    throw new TradeResponseError(data.error.message, response.status);
  }
  if (!response.ok) {
    throw new TradeResponseError(
      `The trade site request failed (status ${response.status}).`,
      response.status,
    );
  }
  return data;
}
