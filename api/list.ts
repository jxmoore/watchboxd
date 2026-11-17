// GET /api/list?q=<username or list URL>  →  { title, url, films: [{ slug, name, link }], truncated }
import type { IncomingMessage, ServerResponse } from 'node:http';
import { query, sendError, sendJson } from '../lib/http.js';
import { getList, resolveListUrl } from '../lib/letterboxd.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const list = await getList(resolveListUrl(query(req).get('q') ?? ''));
    if (!list.films.length) return sendJson(res, 404, { error: 'That list is empty, or it is private.' });
    sendJson(res, 200, list, 600); // lists change often; cache 10 min
  } catch (e) {
    sendError(res, e);
  }
}
