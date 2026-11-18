// Letterboxd has no public API, so we read its HTML. If Letterboxd changes its markup, fix the regexes here.
import { decodeHtml, getText, HttpError, mapLimit } from './http.js';

export interface ListFilm {
  slug: string;
  name: string; // "Title (Year)"
  link: string;
}

export interface TmdbRef {
  id: string;
  type: 'movie' | 'tv';
}

const MAX_PAGES = 40; // ~1,100 films

/** Accepts "jomo88" (→ watchlist) or any letterboxd.com list URL. Returns the canonical list URL. */
export function resolveListUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new HttpError(400, 'Enter a Letterboxd username or list URL.');

  if (/^@?[A-Za-z0-9_]+$/.test(raw)) return `https://letterboxd.com/${raw.replace(/^@/, '')}/watchlist/`;

  // Not a plain username, so it should be a link. Something without a dot or slash (like "some-name") is a mistyped
  // username: Letterboxd usernames are only letters, numbers and underscores.
  if (!/[./]/.test(raw)) {
    throw new HttpError(400, 'That doesn’t look like a Letterboxd username. Usernames use only letters, numbers and underscores.');
  }
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new HttpError(400, 'That isn’t a Letterboxd username or list link.');
  }
  if (!/(^|\.)letterboxd\.com$/i.test(u.hostname)) throw new HttpError(400, 'That link isn’t from letterboxd.com. Paste a Letterboxd list link.');
  let p = u.pathname.replace(/\/page\/\d+\/?$/, '/');
  if (!p.endsWith('/')) p += '/';
  if (p.split('/').filter(Boolean).length < 2)
    throw new HttpError(400, 'Use a list URL like letterboxd.com/user/list/horror/ or letterboxd.com/user/watchlist/');
  return `https://letterboxd.com${p}`;
}

function parseListPage(html: string) {
  const films: ListFilm[] = [];
  const re = /data-item-slug="([^"]+)"[^>]*?data-item-link="([^"]+)"[^>]*?data-item-full-display-name="([^"]*)"/g;
  for (const m of html.matchAll(re)) {
    films.push({ slug: m[1], link: `https://letterboxd.com${m[2]}`, name: decodeHtml(m[3]) });
  }
  if (!films.length) {
    // Older markup
    for (const m of html.matchAll(/data-film-slug="([^"]+)"/g)) {
      films.push({ slug: m[1], link: `https://letterboxd.com/film/${m[1]}/`, name: m[1] });
    }
  }
  const pages = [...html.matchAll(/\/page\/(\d+)\/"/g)].map((x) => Number(x[1]));
  const title = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1];
  return { films, lastPage: pages.length ? Math.max(...pages) : 1, title: title ? decodeHtml(title) : null };
}

export async function getList(listUrl: string) {
  const first = parseListPage(await getText(listUrl));
  const lastPage = Math.min(first.lastPage, MAX_PAGES);
  const rest = await mapLimit(
    Array.from({ length: lastPage - 1 }, (_, i) => i + 2),
    6,
    async (n) => parseListPage(await getText(`${listUrl}page/${n}/`)).films,
  );
  const seen = new Set<string>();
  const films = [first.films, ...rest].flat().filter((f) => !seen.has(f.slug) && seen.add(f.slug));
  return { title: first.title, url: listUrl, films, truncated: first.lastPage > MAX_PAGES };
}

/** Reads the TMDB id Letterboxd puts on each film page. Null when Letterboxd doesn't have one. */
export async function getTmdbRefFromLetterboxd(slug: string): Promise<TmdbRef | null> {
  if (!/^[a-z0-9_-]+$/i.test(slug)) throw new HttpError(400, 'Bad film slug'); // e.g. "fuji_jukaimov"
  const html = await getText(`https://letterboxd.com/film/${slug}/`);
  const id = html.match(/data-tmdb-id="(\d+)"/)?.[1];
  const type = html.match(/data-tmdb-type="(\w+)"/)?.[1] === 'tv' ? 'tv' : 'movie';
  return id ? { id, type } : null;
}

export interface PopularList {
  url: string; // https://letterboxd.com/<user>/list/<slug>/
  title: string;
  owner: string; // Letterboxd username
  count: number | null; // films in the list
}

/**
 * Letterboxd's popular lists (all time). The "this week" page blocks automated requests; the all-time page doesn't.
 * Read from its HTML, so it can break if Letterboxd changes the markup; callers should treat it as optional.
 */
export async function getPopularLists(): Promise<PopularList[]> {
  const html = await getText('https://letterboxd.com/lists/popular/');
  const out: PopularList[] = [];
  for (const block of html.split('class="list-summary js-list-summary').slice(1)) {
    const href = block.match(/href="(\/([a-z0-9_]+)\/list\/[a-z0-9_-]+\/)"/i);
    const title = block.match(/<h2[^>]*>\s*<a[^>]*>([^<]+)/);
    if (!href || !title) continue;
    const count = block.match(/([\d,]+)\s*(?:&nbsp;|\s)films/);
    out.push({
      url: `https://letterboxd.com${href[1]}`,
      title: decodeHtml(title[1].trim()),
      owner: href[2],
      count: count ? Number(count[1].replace(/,/g, '')) : null,
    });
  }
  return out;
}
