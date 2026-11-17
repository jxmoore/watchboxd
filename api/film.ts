// GET /api/film?slug=<letterboxd slug>&name=<Title (Year)>&region=US  →  FilmDetails
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, query, sendError, sendJson } from '../lib/http.js';
import { getTmdbRefFromLetterboxd, type TmdbRef } from '../lib/letterboxd.js';
import { getDetails, searchTmdb } from '../lib/tmdb.js';

// Survives between requests while a function instance stays warm.
const refCache = new Map<string, TmdbRef | null>();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const q = query(req);
    const slug = q.get('slug') ?? '';
    const region = (q.get('region') ?? 'US').toUpperCase();
    if (!/^[A-Z]{2}$/.test(region)) throw new HttpError(400, 'Bad region');

    const name = q.get('name') ?? slug;
    let ref = refCache.get(slug);
    if (ref === undefined) {
      ref = (await getTmdbRefFromLetterboxd(slug)) ?? (await searchTmdb(name));
      refCache.set(slug, ref);
    }
    if (!ref) throw new HttpError(404, 'Not found on TMDB');

    let details;
    try {
      details = await getDetails(ref, region);
    } catch (e) {
      // Letterboxd sometimes points at a TMDB id that has since been removed or merged.
      if (!(e instanceof HttpError && e.status === 404)) throw e;
      const found = await searchTmdb(name);
      if (!found || found.id === ref.id) throw e;
      refCache.set(slug, found);
      details = await getDetails(found, region);
    }
    sendJson(res, 200, details, 43200); // 12 h on the CDN
  } catch (e) {
    sendError(res, e);
  }
}
