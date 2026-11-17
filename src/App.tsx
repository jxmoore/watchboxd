import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchList, type ListFilm, type ListResponse } from './api';
import { useStored } from './storage';
import { useFilmDetails } from './useFilmDetails';
import { catsFor, isUnavailable, matches, SHOW_OPTIONS, type Show } from './filters';
import { REGIONS } from './regions';
import { NEEDS_DETAILS, SORT_OPTIONS, sortFilms, type Sort } from './sort';
import SearchForm, { type Mode } from './components/SearchForm';
import ServicePicker, { type ServiceCount } from './components/ServicePicker';
import FilmCard from './components/FilmCard';
import Pagination from './components/Pagination';
import FilmModal from './components/FilmModal';

const PAGE_SIZES = [24, 48, 96];

function initialSearch(): { mode: Mode; value: string } {
  const p = new URLSearchParams(location.search);
  if (p.get('u')) return { mode: 'user', value: p.get('u')! };
  if (p.get('list')) return { mode: 'url', value: p.get('list')! };
  return { mode: 'user', value: '' };
}

export default function App() {
  const [initial] = useState(initialSearch);
  const [region, setRegion] = useStored('wtw.region', 'US');
  const [storedShow, setShow] = useStored<Show>('wtw.show', 'all');
  const show: Show = SHOW_OPTIONS.some(([k]) => k === storedShow) ? storedShow : 'all'; // drops values from older versions
  const [storedSort, setSort] = useStored<Sort>('wtw.sort', 'list');
  const sort: Sort = SORT_OPTIONS.some(([k]) => k === storedSort) ? storedSort : 'list';
  const [pageSize, setPageSize] = useStored('wtw.pageSize', 24);
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState<Set<number>>(() => new Set()); // unchecked services; resets per lookup
  const [showUnavailable, setShowUnavailable] = useState(false); // films available nowhere; off per lookup

  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ListFilm | null>(null); // film open in the modal
  const listCtrl = useRef<AbortController | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const lookup = useCallback(async (mode: Mode, value: string) => {
    listCtrl.current?.abort();
    const ctrl = (listCtrl.current = new AbortController());
    setLoading(true);
    setError(null);
    setList(null);
    setPage(1);
    setHidden(new Set());
    setShowUnavailable(false);
    const url = new URL(location.href);
    url.search = new URLSearchParams(mode === 'user' ? { u: value } : { list: value }).toString();
    history.replaceState(null, '', url);
    try {
      setList(await fetchList(value, ctrl.signal));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial.value) lookup(initial.mode, initial.value);
  }, [initial, lookup]);

  // Services differ by country, so start fresh when it changes.
  useEffect(() => {
    setHidden(new Set());
    setShowUnavailable(false);
  }, [region]);

  const films: ListFilm[] = useMemo(() => list?.films ?? [], [list]);

  // Details for the current page load first; the rest of the list fills in behind it.
  const [priority, setPriority] = useState<string[]>([]);
  const details = useFilmDetails(films, region, priority);

  const filtered = useMemo(
    () =>
      sortFilms(
        films.filter((f) => matches(show, hidden, details[f.slug], showUnavailable)),
        sort,
        details,
      ),
    [films, details, show, hidden, showUnavailable, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const pageFilms = filtered.slice((current - 1) * pageSize, current * pageSize);

  const unfiltered = show === 'all' && !hidden.size;
  const prioritySlugs = unfiltered ? pageFilms.map((f) => f.slug) : [];
  const priorityKey = prioritySlugs.join('|');
  useEffect(() => setPriority(prioritySlugs), [priorityKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setPage(1), [show, hidden, pageSize, region, showUnavailable, sort]);

  // Service list + counts follow the category filter (e.g. no rental stores under "Free or subscription").
  const stats = useMemo(() => {
    const cats = catsFor(show);
    const services = new Map<number, ServiceCount>();
    const allIds = new Set<number>();
    let loaded = 0, free = 0, sub = 0, unavailable = 0, failed = 0;
    for (const f of films) {
      const e = details[f.slug];
      if (!e) continue;
      loaded++;
      if (isUnavailable(e)) unavailable++; // includes lookup failures
      if (!e.ok) {
        failed++;
        continue;
      }
      if (e.data.availability.free.length) free++;
      if (e.data.availability.subscription.length) sub++;
      const seen = new Set<number>();
      for (const c of catsFor('all')) for (const p of e.data.availability[c]) allIds.add(p.id);
      for (const p of cats.flatMap((c) => e.data.availability[c])) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const s = services.get(p.id) ?? { ...p, count: 0 };
        s.count++;
        services.set(p.id, s);
      }
    }
    const serviceList = [...services.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return { services: serviceList, allIds: [...allIds], loaded, free, sub, unavailable, failed };
  }, [films, details, show]);

  const goTo = (p: number) => {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const stillLoading = films.length > 0 && stats.loaded < films.length;
  const nowhere = stats.unavailable - stats.failed; // looked up fine, just not available
  const closeModal = useCallback(() => setSelected(null), []);

  return (
    <>
    <header className="masthead">
      <div className="masthead-inner">
        <a className="brand" href="/">
          watchboxd<span>.</span>
        </a>
        <span className="eyebrow">Letterboxd · where to watch</span>
      </div>
    </header>
    <main>
      <section className="hero">
        <h1>
          Your list, and where it’s <em>streaming.</em>
        </h1>
        <p className="lede">Find where to watch everything on your Letterboxd watchlist or lists.</p>
      </section>

      <SearchForm
        initialMode={initial.mode}
        initialValue={initial.value}
        region={region}
        busy={loading}
        onRegion={setRegion}
        onSubmit={lookup}
      />

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted status">Reading the list from Letterboxd…</p>}

      {list && (
        <>
          <section className="summary" ref={topRef}>
            <div>
              <p className="eyebrow">Letterboxd list</p>
              <h2>
                <a href={list.url} target="_blank" rel="noopener noreferrer">
                  {list.title ?? 'List'}
                </a>
              </h2>
              <p className="stats">
                <b>{films.length}</b> films · <b>{stats.free}</b> free · <b>{stats.sub}</b> on subscription
                {filtered.length !== films.length && (
                  <>
                    {' '}
                    · showing <b>{filtered.length}</b>
                  </>
                )}
                {list.truncated && ' · list cut off at 40 pages'}
              </p>
            </div>
            {stillLoading && (
              <div className="progress" title={`${stats.loaded} of ${films.length} checked`}>
                <span style={{ width: `${(stats.loaded / films.length) * 100}%` }} />
                <small>
                  Checking {stats.loaded} / {films.length}
                </small>
              </div>
            )}
          </section>

          <section className="toolbar">
            <ServicePicker services={stats.services} allIds={stats.allIds} hidden={hidden} onChange={setHidden} />
            <div className="chips" role="radiogroup" aria-label="Show">
              {SHOW_OPTIONS.map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={show === k} onClick={() => setShow(k)}>
                  {label}
                </button>
              ))}
            </div>
            <label className="sort">
              <span className="eyebrow">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {SORT_OPTIONS.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={showUnavailable}
              className="switch"
              onClick={() => setShowUnavailable((v) => !v)}
            >
              <span className="track" aria-hidden="true" />
              Show unavailable <span className="count">{stats.unavailable}</span>
            </button>
          </section>

          {!unfiltered && stillLoading && (
            <p className="muted note">Still checking the rest of the list; more matches may appear.</p>
          )}
          {unfiltered && stillLoading && NEEDS_DETAILS.includes(sort) && (
            <p className="muted note">Still checking the rest of the list; the order will settle once it’s done.</p>
          )}

          <div className="grid">
            {pageFilms.map((f) => (
              <FilmCard
                key={f.slug}
                film={f}
                entry={details[f.slug]}
                show={show}
                hidden={hidden}
                onOpen={setSelected}
              />
            ))}
          </div>
          {!pageFilms.length && !stillLoading && <p className="muted empty-state">No films match these filters.</p>}

          {/* End of the results: say what's hidden and offer to show it. */}
          {!showUnavailable && stats.unavailable > 0 && current === pages && (
            <div className="hidden-note">
              <p>
                {stillLoading ? 'So far, ' : ''}
                {nowhere > 0 && (
                  <>
                    <b>{nowhere}</b> {nowhere === 1 ? 'film isn’t' : 'films aren’t'} streaming, renting or selling anywhere in{' '}
                    {/^(United|Netherlands)/.test(REGIONS[region] ?? '') ? 'the ' : ''}
                    {REGIONS[region] ?? region}
                    {stats.failed > 0 ? ', and ' : '.'}
                  </>
                )}
                {stats.failed > 0 && (
                  <>
                    <b>{stats.failed}</b> {stats.failed === 1 ? 'film' : 'films'} couldn’t be looked up on TMDB.
                  </>
                )}
              </p>
              <button type="button" className="link" onClick={() => setShowUnavailable(true)}>
                Show {stats.unavailable === 1 ? 'it' : 'them'}
              </button>
            </div>
          )}

          <footer className="pager-row">
            <Pagination page={current} pages={pages} onPage={goTo} />
            <label className="muted per-page">
              Per page{' '}
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZES.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          </footer>
        </>
      )}

      <p className="credit">
        Streaming data from <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">JustWatch</a> via{' '}
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">TMDB</a>. This product uses the TMDB API but
        is not endorsed or certified by TMDB.
      </p>

      {selected && (
        <FilmModal film={selected} entry={details[selected.slug]} region={region} onClose={closeModal} />
      )}
    </main>
    </>
  );
}
