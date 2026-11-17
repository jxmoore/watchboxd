// GET /api/trending  →  { posters: [{ title, src }] }  This week's trending films, for the hero before a list is loaded.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendError, sendJson } from '../lib/http.js';
import { getTrendingPosters } from '../lib/tmdb.js';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    sendJson(res, 200, { posters: await getTrendingPosters() }, 21600); // changes weekly; cache 6 h
  } catch (e) {
    sendError(res, e);
  }
}
