// GET /api/popular  →  { lists: [{ url, title, owner, count }] }  Letterboxd's popular lists, to suggest one to try.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendError, sendJson } from '../lib/http.js';
import { getPopularLists } from '../lib/letterboxd.js';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    sendJson(res, 200, { lists: await getPopularLists() }, 43200); // changes slowly; cache 12 h
  } catch (e) {
    sendError(res, e);
  }
}
