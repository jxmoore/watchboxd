import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchList,
  fetchPopular,
  fetchTrending,
  type ListFilm,
  type ListResponse,
  type PopularList,
} from "./api";
import { load, save, useStored } from "./storage";
import { useServicePrefs } from "./servicePrefs";
import { useFilmDetails, type DetailEntry } from "./useFilmDetails";
import {
  catsFor,
  isUnavailable,
  matches,
  SHOW_OPTIONS,
  visibleRows,
  type Show,
} from "./filters";
import { REGIONS } from "./regions";
import { NEEDS_DETAILS, SORT_OPTIONS, sortFilms, type Sort } from "./sort";
import SearchForm, { type Mode } from "./components/SearchForm";
import ServicePicker, { type ServiceCount } from "./components/ServicePicker";
import FilmCard from "./components/FilmCard";
import Pagination from "./components/Pagination";
import FilmModal from "./components/FilmModal";
import Spotlight, { type Pick } from "./components/Spotlight";
import PosterWall from "./components/PosterWall";

const PAGE_SIZES = [24, 48, 96];
const HERO_POSTERS = 40; // posters on the header's poster wall

const normalizeTitle = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Matches the Letterboxd name ("Amélie (2001)") and, once loaded, TMDB's title (which can differ, e.g. for foreign films). */
function titleMatches(f: ListFilm, e: DetailEntry | undefined, key: string) {
  if (normalizeTitle(f.name).includes(key)) return true;
  return !!e?.ok && normalizeTitle(e.data.title).includes(key);
}

// The last list looked up successfully, so a plain visit (no ?u= or ?list= in the address) reopens it. Only the
// lookup itself is saved; the films and their details are fetched again (mostly from cache).
const LAST_LIST = "wtw.lastList";
type Search = { mode: Mode; value: string };

function initialSearch(): Search {
  const p = new URLSearchParams(location.search);
  if (p.get("u")) return { mode: "user", value: p.get("u")! };
  if (p.get("list")) return { mode: "url", value: p.get("list")! };
  const last = load<Search | null>(LAST_LIST, null);
  if (last && (last.mode === "user" || last.mode === "url") && typeof last.value === "string" && last.value) return last;
  return { mode: "user", value: "" };
}

export default function App() {
  const [initial] = useState(initialSearch);
  // What the search box shows; replaced (remounting the form) when a lookup starts from elsewhere, like "Random list"
  const [formSeed, setFormSeed] = useState({ ...initial, n: 0 });
  const [region, setRegion] = useStored("wtw.region", "US");
  const [storedShow, setShow] = useStored<Show>("wtw.show", "all");
  const show: Show = SHOW_OPTIONS.some(([k]) => k === storedShow)
    ? storedShow
    : "all"; // drops values from older versions
  const [storedSort, setSort] = useStored<Sort>("wtw.sort", "list");
  const sort: Sort = SORT_OPTIONS.some(([k]) => k === storedSort)
    ? storedSort
    : "list";
  const [pageSize, setPageSize] = useStored("wtw.pageSize", 24);
  const [page, setPage] = useState(1);
  // Unchecked services and "Show unavailable" are remembered in the browser, like the filter, sort and page size
  const { hidden, setHidden, noteServices } = useServicePrefs();
  const [showUnavailable, setShowUnavailable] = useStored("wtw.showUnavailable", false);

  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ListFilm | null>(null); // film open in the modal
  const [pickSeed, setPickSeed] = useState(() =>
    Math.floor(Math.random() * 1000),
  ); // which film Tonight's pick shows
  const listCtrl = useRef<AbortController | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const lookup = useCallback(async (mode: Mode, value: string) => {
    listCtrl.current?.abort();
    const ctrl = (listCtrl.current = new AbortController());
    setLoading(true);
    setError(null);
    setList(null);
    setPage(1);
    const url = new URL(location.href);
    url.search = new URLSearchParams(
      mode === "user" ? { u: value } : { list: value },
    ).toString();
    history.replaceState(null, "", url);
    try {
      setList(await fetchList(value, ctrl.signal));
      save(LAST_LIST, { mode, value }); // only lists that actually loaded
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  // "Random list": one of Letterboxd's popular lists, picked at random (preferring ones that load quickly), shown in
  // the search box and looked up. The popular lists are fetched once, on first use.
  const popular = useRef<PopularList[] | null>(null);
  const randomList = useCallback(async () => {
    try {
      if (!popular.current) {
        const all = await fetchPopular();
        const quick = all.filter((l) => l.count != null && l.count <= 300);
        popular.current = quick.length ? quick : all;
      }
      const current = new URLSearchParams(location.search).get("list");
      const pool = popular.current.filter((l) => l.url !== current);
      if (!pool.length) return;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      setFormSeed((s) => ({ mode: "url", value: pick.url, n: s.n + 1 }));
      lookup("url", pick.url);
    } catch {
      setError("Couldn’t reach Letterboxd’s popular lists just now. Try again in a moment.");
    }
  }, [lookup]);

  useEffect(() => {
    if (initial.value) lookup(initial.mode, initial.value);
  }, [initial, lookup]);

  const films: ListFilm[] = useMemo(() => list?.films ?? [], [list]);

  // Details for the current page load first; the rest of the list fills in behind it.
  const [priority, setPriority] = useState<string[]>([]);
  const details = useFilmDetails(films, region, priority);

  // "Find a film": narrows the results by title, ignoring case and accents
  const [find, setFind] = useState("");
  const findKey = normalizeTitle(find.trim());
  // Films matching the filters (Tonight's pick draws from these, so it doesn't jump around while you type)…
  const matching = useMemo(
    () =>
      sortFilms(
        films.filter((f) => matches(show, hidden, details[f.slug], showUnavailable)),
        sort,
        details,
      ),
    [films, details, show, hidden, showUnavailable, sort],
  );
  // …and the ones the grid shows: also narrowed by "Find a film"
  const filtered = useMemo(
    () => (findKey ? matching.filter((f) => titleMatches(f, details[f.slug], findKey)) : matching),
    [matching, details, findKey],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const pageFilms = filtered.slice(
    (current - 1) * pageSize,
    current * pageSize,
  );

  useEffect(
    () => setPage(1),
    [show, hidden, pageSize, region, showUnavailable, sort, findKey],
  );

  // Service list + counts follow the category filter (e.g. no rental stores under "Free or subscription").
  const stats = useMemo(() => {
    const cats = catsFor(show);
    const services = new Map<number, ServiceCount>();
    const allIds = new Set<number>();
    let loaded = 0,
      free = 0,
      sub = 0,
      unavailable = 0,
      failed = 0;
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
      for (const c of catsFor("all"))
        for (const p of e.data.availability[c]) allIds.add(p.id);
      for (const p of cats.flatMap((c) => e.data.availability[c])) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const s = services.get(p.id) ?? { ...p, count: 0 };
        s.count++;
        services.set(p.id, s);
      }
    }
    const serviceList = [...services.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
    return {
      services: serviceList,
      allIds: [...allIds],
      loaded,
      free,
      sub,
      unavailable,
      failed,
    };
  }, [films, details, show]);

  // Remember services as they appear, so ones the viewer hasn't seen get a sensible default
  const allIdsKey = stats.allIds.join(",");
  useEffect(() => noteServices(stats.allIds), [allIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Unfiltered" means nothing in this list is hidden: remembered unchecks of services this list doesn't have don't count
  const hidesHere = stats.allIds.some((id) => hidden.has(id));
  const unfiltered = show === "all" && !hidesHere;
  // Load the films on screen first whenever placeholders are showing (the "All" filter)
  const prioritySlugs = show === "all" ? pageFilms.map((f) => f.slug) : [];
  const priorityKey = prioritySlugs.join("|");
  useEffect(() => setPriority(prioritySlugs), [priorityKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (p: number) => {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stillLoading = films.length > 0 && stats.loaded < films.length;
  const nowhere = stats.unavailable - stats.failed; // looked up fine, just not available
  // ---- Film modal and the address bar ----
  // Opening a film adds a history entry with ?film=<slug>, so the address is shareable and Back (including a phone's
  // back gesture) closes the modal instead of leaving the page. Previous/next swap the film in place.
  const pushedFilm = useRef(false); // did we add the history entry for the open film?
  const filmUrl = (slug: string | null) => {
    const url = new URL(location.href);
    if (slug) url.searchParams.set("film", slug);
    else url.searchParams.delete("film");
    return url;
  };
  const openFilm = useCallback((film: ListFilm) => {
    if (pushedFilm.current) history.replaceState({ film: film.slug }, "", filmUrl(film.slug));
    else {
      history.pushState({ film: film.slug }, "", filmUrl(film.slug));
      pushedFilm.current = true;
    }
    setSelected(film);
  }, []);
  const closeModal = useCallback(() => {
    if (pushedFilm.current) history.back(); // popstate below clears the selection
    else {
      history.replaceState(null, "", filmUrl(null)); // opened from a shared link: nothing of ours to go back to
      setSelected(null);
    }
  }, []);
  useEffect(() => {
    const onPop = () => {
      pushedFilm.current = false;
      const slug = new URLSearchParams(location.search).get("film");
      setSelected(slug ? films.find((f) => f.slug === slug) ?? null : null);
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [films]);
  // A shared link (?film=…) opens that film once its list has loaded
  const [initialFilm] = useState(() => new URLSearchParams(location.search).get("film"));
  const openedInitial = useRef(false);
  useEffect(() => {
    if (!initialFilm || openedInitial.current || !films.length) return;
    openedInitial.current = true;
    const f = films.find((x) => x.slug === initialFilm);
    // (the lookup rewrote the address without ?film, so put it back while the film is open)
    if (f) {
      history.replaceState({ film: f.slug }, "", filmUrl(f.slug));
      setSelected(f);
    }
  }, [films, initialFilm]);

  // Previous / next follow the current results, in their current order
  const selectedIndex = selected ? filtered.findIndex((f) => f.slug === selected.slug) : -1;
  const prevFilm = selectedIndex > 0 ? filtered[selectedIndex - 1] : null;
  const nextFilm = selectedIndex >= 0 && selectedIndex < filtered.length - 1 ? filtered[selectedIndex + 1] : null;

  // Tonight's pick: a film in the current results you can watch free or on a checked subscription. If there are
  // none (say only a rental store is checked, or the "Rent / buy only" filter is on), a rental instead.
  const picks = useMemo(() => {
    const watchNow: Pick[] = [];
    const rentals: Pick[] = [];
    for (const f of matching) {
      const e = details[f.slug];
      if (!e?.ok) continue;
      const best = visibleRows(e.data, show, hidden)[0]; // free → subscription → rent → buy
      if (!best) continue;
      const pick: Pick = {
        film: f,
        d: e.data,
        cat: best[0],
        providers: best[1],
      };
      (best[0] === "free" || best[0] === "subscription"
        ? watchNow
        : rentals
      ).push(pick);
    }
    return watchNow.length ? watchNow : rentals;
  }, [matching, details, hidden, show]);
  const pick = picks.length ? picks[pickSeed % picks.length] : null;

  // First posters from the list (in list order) for the header's poster wall.
  const heroPosters = useMemo(() => {
    const out: { src: string; title: string }[] = [];
    for (const f of films) {
      const e = details[f.slug];
      const src = e?.ok ? (e.data.poster ?? e.data.posterLarge) : null; // small posters are plenty for the wall
      if (src) out.push({ src, title: e!.ok ? e.data.title : f.name });
      if (out.length === HERO_POSTERS) break;
    }
    return out;
  }, [films, details]);

  // With no list (or until the list's posters arrive), the wall shows this week's trending films in random order.
  const [trending, setTrending] = useState<{ src: string; title: string }[]>(
    [],
  );
  useEffect(() => {
    const ctrl = new AbortController();
    fetchTrending(ctrl.signal)
      .then((all) => {
        const deck = [...all];
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        setTrending(deck.slice(0, HERO_POSTERS));
      })
      .catch(() => {}); // decorative; outlines stay if it fails
    return () => ctrl.abort();
  }, []);
  const listPostersReady =
    !!list && heroPosters.length >= Math.min(12, films.length);
  // A loaded list's posters lead; trending films top the wall up when the list is short.
  const wallPosters = listPostersReady
    ? heroPosters
    : trending.length
      ? trending
      : heroPosters;
  const wallFillers = listPostersReady ? trending : [];

  return (
    <>
      <header className="masthead">
        <a className="brand" href="/">
          <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4Z" />
            <path className="perf" d="M15 7.5v9" />
          </svg>
          watchboxd
        </a>
      </header>

      <main>
        <section className="hero">
          <PosterWall posters={wallPosters} fillers={wallFillers} />
          <div className="hero-copy">
            <p className="kicker">Now showing · your Letterboxd lists</p>
            <h1>
              Where’s it <em>streaming?</em>
            </h1>
            <p className="lede">
              Enter your Letterboxd username or paste any Letterboxd list, and
              see what you can watch and where.
            </p>
          </div>
          <SearchForm
            key={formSeed.n}
            initialMode={formSeed.mode}
            initialValue={formSeed.value}
            region={region}
            busy={loading}
            onRegion={setRegion}
            onSubmit={lookup}
            onRandom={randomList}
          />
        </section>

        {error && <p className="error">{error}</p>}
        {loading && (
          <p className="muted status">Reading the list from Letterboxd…</p>
        )}

        {list && (
          <>
            <section className="summary" ref={topRef}>
              <div>
                <p className="eyebrow">Letterboxd list</p>
                <h2>
                  <a href={list.url} target="_blank" rel="noopener noreferrer">
                    {list.title ?? "List"}
                  </a>
                </h2>
                <p className="stats">
                  <b>{films.length}</b> films · <b>{stats.free}</b> free ·{" "}
                  <b>{stats.sub}</b> on subscription
                  {filtered.length !== films.length && (
                    <>
                      {" "}
                      · showing <b>{filtered.length}</b>
                    </>
                  )}
                  {list.truncated && " · list cut off at 40 pages"}
                </p>
              </div>
              {stillLoading && (
                <div
                  className="progress"
                  title={`${stats.loaded} of ${films.length} checked`}
                >
                  <span
                    style={{ width: `${(stats.loaded / films.length) * 100}%` }}
                  />
                  <small>
                    Checking {stats.loaded} / {films.length}
                  </small>
                </div>
              )}
            </section>

            {pick && (
              <Spotlight
                pick={pick}
                canShuffle={picks.length > 1}
                onOpen={openFilm}
                onShuffle={() =>
                  setPickSeed(
                    (s) =>
                      s +
                      1 +
                      Math.floor(Math.random() * Math.max(1, picks.length - 1)),
                  )
                }
              />
            )}

            <section className="toolbar">
              <ServicePicker
                services={stats.services}
                allIds={stats.allIds}
                hidden={hidden}
                onChange={setHidden}
              />
              <div className="chips" role="radiogroup" aria-label="Show">
                {SHOW_OPTIONS.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={show === k}
                    onClick={() => setShow(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="find">
                <svg className="find-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5 14 14" />
                </svg>
                <input
                  type="search"
                  aria-label="Find a film in this list"
                  placeholder="Find a film"
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setFind("")}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {find && (
                  <button
                    type="button"
                    className="find-clear"
                    aria-label="Clear"
                    onClick={() => setFind("")}
                  >
                    ×
                  </button>
                )}
              </label>
              <label className="sort">
                <span className="eyebrow">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
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
                Show unavailable{" "}
                <span className="count">{stats.unavailable}</span>
              </button>
            </section>

            {!unfiltered && stillLoading && (
              <p className="muted note">
                Still checking the rest of the list; more matches may appear.
              </p>
            )}
            {unfiltered && stillLoading && NEEDS_DETAILS.includes(sort) && (
              <p className="muted note">
                Still checking the rest of the list; the order will settle once
                it’s done.
              </p>
            )}

            <div className="grid">
              {pageFilms.map((f) => (
                <FilmCard
                  key={f.slug}
                  film={f}
                  entry={details[f.slug]}
                  show={show}
                  hidden={hidden}
                  onOpen={openFilm}
                />
              ))}
            </div>
            {!pageFilms.length && !stillLoading && (
              <p className="muted empty-state">
                {findKey
                  ? `Nothing matching “${find.trim()}” in these results.`
                  : "No films match these filters."}
              </p>
            )}

            {/* End of the results: say what's hidden and offer to show it. */}
            {!showUnavailable && stats.unavailable > 0 && current === pages && (
              <div className="hidden-note">
                <p>
                  {stillLoading ? "So far, " : ""}
                  {nowhere > 0 && (
                    <>
                      <b>{nowhere}</b>{" "}
                      {nowhere === 1 ? "film isn’t" : "films aren’t"} streaming,
                      renting or selling anywhere in{" "}
                      {/^(United|Netherlands)/.test(REGIONS[region] ?? "")
                        ? "the "
                        : ""}
                      {REGIONS[region] ?? region}
                      {stats.failed > 0 ? ", and " : "."}
                    </>
                  )}
                  {stats.failed > 0 && (
                    <>
                      <b>{stats.failed}</b>{" "}
                      {stats.failed === 1 ? "film" : "films"} couldn’t be looked
                      up on TMDB.
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className="link"
                  onClick={() => setShowUnavailable(true)}
                >
                  Show {stats.unavailable === 1 ? "it" : "them"}
                </button>
              </div>
            )}

            <footer className="pager-row">
              <Pagination page={current} pages={pages} onPage={goTo} />
              <label className="muted per-page">
                Per page{" "}
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </footer>
          </>
        )}

        {selected && (
          <FilmModal
            film={selected}
            entry={details[selected.slug]}
            region={region}
            onClose={closeModal}
            onPrev={prevFilm ? () => openFilm(prevFilm) : null}
            onNext={nextFilm ? () => openFilm(nextFilm) : null}
            position={selectedIndex >= 0 ? { index: selectedIndex + 1, total: filtered.length } : null}
          />
        )}
      </main>
    </>
  );
}
