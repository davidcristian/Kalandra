/** The page's Content-Security-Policy, which main's server and Vite's dev server send with every response. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // ApexCharts, Electron's <webview> and Vite's dev server add <style> elements; the web view's
  // inner frame is 150 pixels high without its style
  "style-src 'self' 'unsafe-inline'",
  // The item icons in the game data and in trade listings
  "img-src 'self' https://web.poecdn.com",
  "font-src 'self'",
  // 'self' also matches the /events WebSocket, a ws: address on the page's host and port
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");
