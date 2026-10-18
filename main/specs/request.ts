import * as http from "http";

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
  return await new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: urlPath, headers },
      (res) => {
        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk: string) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}
