import type { IncomingMessage, ServerResponse } from 'node:http';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (res.status === 404) throw new HttpError(404, 'Not found on Letterboxd. Is the name or URL right, and is the list public?');
  if (res.status === 429) throw new HttpError(429, 'Letterboxd is rate limiting us. Wait a minute and try again.');
  if (!res.ok) throw new HttpError(502, `Letterboxd returned ${res.status}`);
  return res.text();
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export function query(req: IncomingMessage): URLSearchParams {
  return new URL(req.url ?? '/', 'http://localhost').searchParams;
}

/** cacheSeconds > 0 lets Vercel's CDN cache the response, so repeat lookups never reach Letterboxd/TMDB. */
export function sendJson(res: ServerResponse, status: number, body: unknown, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    cacheSeconds > 0 && status === 200
      ? `public, max-age=300, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds}`
      : 'no-store',
  );
  res.end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  sendJson(res, status, { error: e instanceof Error ? e.message : String(e) });
}

export const decodeHtml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
