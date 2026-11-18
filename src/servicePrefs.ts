import { useCallback, useEffect, useMemo, useState } from "react";
import { load, save } from "./storage";

const KEY = "wtw.services";

interface Stored {
  hidden: number[]; // unchecked services
  known: number[]; // every service the viewer has had the chance to check or uncheck
}

/**
 * Which services are unchecked, remembered in the browser across lookups and visits.
 *
 * Call `noteServices` with the services in the current list. Ones the viewer hasn't seen before follow how they've
 * been using the picker: if they've unchecked more than they've kept, it's a "just my services" setup and new ones
 * start unchecked; otherwise they're only weeding out a few, and new ones start checked.
 */
export function useServicePrefs() {
  const [prefs, setPrefs] = useState<Stored>(() => {
    const s = load<Stored>(KEY, { hidden: [], known: [] });
    return { hidden: Array.isArray(s.hidden) ? s.hidden : [], known: Array.isArray(s.known) ? s.known : [] };
  });

  useEffect(() => save(KEY, prefs), [prefs]);

  const hidden = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  const setHidden = useCallback((next: Set<number>) => {
    setPrefs((p) => ({ hidden: [...next], known: [...new Set([...p.known, ...next])] }));
  }, []);

  const noteServices = useCallback((ids: number[]) => {
    setPrefs((p) => {
      const known = new Set(p.known);
      const fresh = ids.filter((id) => !known.has(id));
      if (!fresh.length) return p;
      const hiddenSet = new Set(p.hidden);
      const kept = p.known.filter((id) => !hiddenSet.has(id)).length;
      const mineOnly = p.known.length > 0 && hiddenSet.size > kept;
      return { hidden: mineOnly ? [...p.hidden, ...fresh] : p.hidden, known: [...p.known, ...fresh] };
    });
  }, []);

  return { hidden, setHidden, noteServices };
}
