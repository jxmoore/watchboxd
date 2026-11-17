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
}

export default function SearchForm({ initialMode, initialValue, region, busy, onRegion, onSubmit }: Props) {
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
      <div className="seg" role="tablist" aria-label="Look up by">
        <button type="button" role="tab" aria-selected={mode === 'user'} onClick={() => setMode('user')}>
          Watchlist
        </button>
        <button type="button" role="tab" aria-selected={mode === 'url'} onClick={() => setMode('url')}>
          List URL
        </button>
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
        <select aria-label="Country" value={region} onChange={(e) => onRegion(e.target.value)}>
          {Object.entries(REGIONS).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <button className="primary" disabled={busy || !value.trim()}>
          {busy ? 'Loading…' : 'Look up'}
        </button>
      </div>
    </form>
  );
}
