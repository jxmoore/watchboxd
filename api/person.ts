// GET /api/person?id=<TMDB person id>  →  302 to that person's IMDb page.
// Resolved only when someone clicks an actor's name (one TMDB request), and the CDN caches the redirect for 30 days.
// If TMDB has no IMDb id, or the lookup fails, it sends them to the person's TMDB page instead.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { query } from '../lib/http.js';
import { getPersonImdbId } from '../lib/tmdb.js';

function redirect(res: ServerResponse, url: string, cacheSeconds: number) {
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.setHeader('Cache-Control', cacheSeconds ? `public, max-age=86400, s-maxage=${cacheSeconds}` : 'no-store');
  res.end();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const id = query(req).get('id') ?? '';
  if (!/^\d{1,10}$/.test(id)) {
    res.statusCode = 400;
    res.end('Bad person id');
    return;
  }
  const tmdbPage = `https://www.themoviedb.org/person/${id}`;
  try {
    const imdb = await getPersonImdbId(id);
    redirect(res, imdb ? `https://www.imdb.com/name/${imdb}/` : tmdbPage, 30 * 24 * 3600);
  } catch {
    redirect(res, tmdbPage, 0);
  }
}
