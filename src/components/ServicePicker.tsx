import { useEffect, useMemo, useRef, useState } from 'react';
import type { Provider } from '../api';

export interface ServiceCount extends Provider {
  count: number; // films in this list available on the service (any way: free, subscription, rent, buy)
}

interface Props {
  services: ServiceCount[]; // services relevant to the current filter
  allIds: number[]; // every service in the list, whatever the filter; "Uncheck all" unchecks these
  hidden: Set<number>; // unchecked services
  onChange: (hidden: Set<number>) => void;
}

/**
 * Everything starts checked (= show all). Unchecking a service removes films that are only available on
 * unchecked services. Unchecking everything leaves just the films that aren't available anywhere.
 */
export default function ServicePicker({ services, allIds, hidden, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [services, search]);

  const checkedCount = services.filter((s) => !hidden.has(s.id)).length;
  const noneChecked = services.length > 0 && checkedCount === 0;

  const toggle = (id: number) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  // Only touches services in this list; remembered choices for services elsewhere are kept
  const toggleAll = () =>
    onChange(noneChecked ? new Set([...hidden].filter((id) => !allIds.includes(id))) : new Set([...hidden, ...allIds]));

  const label =
    checkedCount === services.length ? 'All services' : noneChecked ? 'No services' : `${checkedCount} of ${services.length} services`;

  return (
    <div className="picker" ref={root}>
      <button
        type="button"
        className={`picker-btn${checkedCount < services.length ? ' filtered' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="picker-menu" role="dialog" aria-label="Streaming services">
          <div className="picker-head">
            <input autoFocus placeholder="Search services" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" className="link" onClick={toggleAll} disabled={!services.length}>
              {noneChecked ? 'Check all' : 'Uncheck all'}
            </button>
          </div>
          <ul>
            {rows.map((s) => (
              <li key={s.id}>
                <label>
                  <input type="checkbox" checked={!hidden.has(s.id)} onChange={() => toggle(s.id)} />
                  <img src={s.logo} alt="" loading="lazy" />
                  <span className="name">{s.name}</span>
                  <span className="count">{s.count}</span>
                </label>
              </li>
            ))}
            {!rows.length && (
              <li className="empty">{services.length ? 'No services match.' : 'No services for this filter.'}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
