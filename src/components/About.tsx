import { useEffect, useRef, useState } from 'react';

/**
 * A small "About" link at the right of the header that opens the credits. TMDB's API terms require the TMDB notice in an
 * About/Credits area, and its streaming data must be credited to JustWatch.
 */
export default function About() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const opener = openRef.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={openRef} type="button" className="about-link" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        About
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="about" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="modal-close" aria-label="Close" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
            <h2 id="about-title">About Watchboxd</h2>
            <p>See where the films on any public Letterboxd watchlist or list are streaming, free, or to rent or buy.</p>
            <dl>
              <dt>Film details and images</dt>
              <dd>
                <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">TMDB</a>. This product uses the
                TMDB API but is not endorsed or certified by TMDB.
              </dd>
              <dt>Where to watch</dt>
              <dd>
                Streaming data from{' '}
                <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">JustWatch</a>, via TMDB.
              </dd>
              <dt>Lists</dt>
              <dd>
                Read from public pages on <a href="https://letterboxd.com" target="_blank" rel="noopener noreferrer">Letterboxd</a>.
                Watchboxd isn’t affiliated with Letterboxd.
              </dd>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
