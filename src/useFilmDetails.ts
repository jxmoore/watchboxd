import { useEffect, useRef, useState } from 'react';
import { fetchFilm, type FilmDetails, type ListFilm } from './api';

export type DetailEntry = { ok: true; data: FilmDetails } | { ok: false; error: string };

const CONCURRENCY = 6;

/**
 * Loads details for every film in the list, a few at a time.
 * Films on the page being viewed jump the queue; the rest load in the background so filters cover the whole list.
 */
export function useFilmDetails(films: ListFilm[], region: string, priority: string[]) {
  const [details, setDetails] = useState<Record<string, DetailEntry>>({});
  const queue = useRef<{ order: ListFilm[]; started: Set<string>; bump: (slugs: string[]) => void } | null>(null);

  useEffect(() => {
    setDetails({});
    if (!films.length) return;
    const ctrl = new AbortController();
    const order = [...films];
    const started = new Set<string>();
    let active = 0;

    const pump = () => {
      while (active < CONCURRENCY && !ctrl.signal.aborted) {
        const film = order.find((f) => !started.has(f.slug));
        if (!film) return;
        started.add(film.slug);
        active++;
        fetchFilm(film, region, ctrl.signal)
          .then((data): DetailEntry => ({ ok: true, data }))
          .catch((e: Error): DetailEntry | null => (e.name === 'AbortError' ? null : { ok: false, error: e.message }))
          .then((entry) => {
            active--;
            if (!entry || ctrl.signal.aborted) return;
            setDetails((d) => ({ ...d, [film.slug]: entry }));
            pump();
          });
      }
    };

    queue.current = {
      order,
      started,
      bump(slugs) {
        // Move not-yet-started films for the visible page to the front of the queue.
        const want = new Set(slugs.filter((s) => !started.has(s)));
        if (!want.size) return;
        const front = order.filter((f) => want.has(f.slug));
        const back = order.filter((f) => !want.has(f.slug));
        order.splice(0, order.length, ...front, ...back);
      },
    };
    pump();
    return () => ctrl.abort();
  }, [films, region]);

  const key = priority.join('|');
  useEffect(() => {
    queue.current?.bump(priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, films, region]);

  return details;
}
