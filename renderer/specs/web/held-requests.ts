/** Answers fake requests only on release(), and fails each one with its abort reason when it is aborted. */
export class HeldRequests {
  private waiting: Array<() => void> = [];

  answer(body: string, signal?: AbortSignal | null): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.waiting.push(() => resolve(new Response(body)));
      signal?.addEventListener("abort", () => reject(signal.reason));
    });
  }

  release() {
    for (const send of this.waiting.splice(0)) send();
  }
}

/** Waits until every pending promise callback has run. */
export const settle = () => new Promise((resolve) => setTimeout(resolve));
