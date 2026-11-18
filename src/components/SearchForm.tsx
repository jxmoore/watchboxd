import { useState, type FormEvent } from 'react';
import { REGIONS } from '../regions';

export type Mode = 'user' | 'url';

interface Props {
  initialMode: Mode;
  initialValue: string;
  region: string;
  busy: boolean;
  onRegion: (r: string) => void;
  onSubmit: (mode: Mode, value: string) => void;
  onRandom?: () => void; // "Random list": look up a popular Letterboxd list
}

export default function SearchForm({ initialMode, initialValue, region, busy, onRegion, onSubmit, onRandom }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [value, setValue] = useState(initialValue);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    // Someone pasted a URL into the username box: just treat it as a URL.
    const m: Mode = mode === 'user' && /letterboxd\.com|\//i.test(v) ? 'url' : mode;
    setMode(m);
    onSubmit(m, v);
  };

  return (
    <form className="search" onSubmit={submit}>
      <div className="search-modes">
      <div className="seg" role="tablist" aria-label="Look up by">
        <button type="button" role="tab" aria-selected={mode === 'user'} onClick={() => setMode('user')}>
          Watchlist
        </button>
        <button type="button" role="tab" aria-selected={mode === 'url'} onClick={() => setMode('url')}>
          List URL
        </button>
      </div>
      {/* Not a mode: loads one of Letterboxd's popular lists at random */}
      {onRandom && (
        <button type="button" className="random-list" onClick={onRandom} disabled={busy} title="Look up a popular Letterboxd list, picked at random">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.5 4.5h3c2.5 0 3.5 7 6 7h3.5M1.5 11.5h3c1.1 0 1.9-1.3 2.6-2.8M9 6.3c.6-1 1.3-1.8 2.5-1.8H15M13 2.5l2 2-2 2M13 9.5l2 2-2 2" />
          </svg>
          Random list
        </button>
      )}
      </div>
      <div className="search-row">
        <div className="field">
          <svg className="search-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" />
          </svg>
          {mode === 'user' && <span className="prefix">letterboxd.com/</span>}
          <input
            aria-label={mode === 'user' ? 'Letterboxd username' : 'Letterboxd list URL'}
            placeholder={mode === 'user' ? 'username' : 'https://letterboxd.com/user/list/horror/'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {mode === 'user' && <span className="suffix">/watchlist</span>}
        </div>
        {/* What shows is our own label (full name, or the code on phones); the invisible native select on top
            does the picking, so the list that opens still has full country names. */}
        <label className="region" title={REGIONS[region] ?? region}>
          <span className="region-full">{REGIONS[region] ?? region}</span>
          <span className="region-code">{region}</span>
          <svg className="region-caret" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 4.5 6 7.5 9 4.5" />
          </svg>
          <select aria-label="Country" value={region} onChange={(e) => onRegion(e.target.value)}>
            {Object.entries(REGIONS).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={busy || !value.trim()} aria-label={busy ? 'Loading' : 'Look up'}>
          <span className="btn-text">{busy ? 'Loading…' : 'Look up'}</span>
          <svg className={`btn-icon${busy ? ' spin' : ''}`} viewBox="0 0 16 16" aria-hidden="true">
            {busy ? <path d="M8 2.5a5.5 5.5 0 1 0 5.5 5.5" /> : <path d="M3 8h10M9 4l4 4-4 4" />}
          </svg>
        </button>
      </div>
    </form>
  );
}
