import { VISIT_GAP_MS } from './visit-journeys';

/**
 * The current visit's landing page and a random visit key, so engagement
 * events can be credited to the page that started the visit.
 *
 * Without consent this lives in memory only and ends at the next full page
 * load. With consent it is kept in sessionStorage (this tab only) and expires
 * after the same 30-minute gap the ops sessionizer uses.
 */
export type VisitContext = { landing: string; key: string; seenAt: number };

const STORAGE_KEY = 'ad_visit';

let current: VisitContext | null = null;

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function readStored(now: number): VisitContext | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VisitContext>;
    if (typeof parsed.landing !== 'string' || typeof parsed.key !== 'string') return null;
    if (typeof parsed.seenAt !== 'number' || now - parsed.seenAt > VISIT_GAP_MS) return null;
    return { landing: parsed.landing, key: parsed.key, seenAt: parsed.seenAt };
  } catch {
    return null;
  }
}

function store(ctx: VisitContext): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // storage blocked: memory still works for this page
  }
}

/** Record that `path` was viewed; the first view of a visit becomes its landing page. */
export function noteVisitPage(path: string, persist: boolean, now: number = Date.now()): VisitContext {
  if (!current || now - current.seenAt > VISIT_GAP_MS) {
    current = (persist && readStored(now)) || { landing: path, key: newKey(), seenAt: now };
  }
  current = { ...current, seenAt: now };
  if (persist) store(current);
  else {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return current;
}

export function currentVisit(): VisitContext | null {
  return current;
}
