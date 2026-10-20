/** A file of the page's data folder that the server did not return. */
export class DataLoadError extends Error {
  constructor(
    readonly file: string,
    readonly status: number,
  ) {
    super(`Cannot load data/${file} (status ${status})`);
    this.name = "DataLoadError";
  }
}

/** Fetches a file of the page's data folder, and throws a DataLoadError when the server does not return it. */
export async function fetchData(file: string): Promise<Response> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!response.ok) {
    throw new DataLoadError(file, response.status);
  }
  return response;
}
