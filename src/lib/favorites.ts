/**
 * Module-level favorites store.
 *
 * All useFavorites() hook instances share this single synchronous store so
 * that rapid successive toggles never race: every read is the latest state
 * in memory (initialised once from localStorage) and every write is atomic
 * within the JavaScript event loop.
 */

const STORAGE_KEY = "favorite_suppliers";

function readFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    }
  } catch {}
  return [];
}

// In-memory single source of truth – initialised lazily on first access.
let _ids: string[] | null = null;

function getIds(): string[] {
  if (_ids === null) _ids = readFromStorage();
  return _ids;
}

function setIds(next: string[]): void {
  _ids = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("favorites-updated"));
  }
}

/** Toggle a supplier in/out of the favorites list. */
export function toggleFavorite(id: string): void {
  const sid = String(id);
  const ids = getIds();
  setIds(ids.includes(sid) ? ids.filter((f) => f !== sid) : [...ids, sid]);
}

/** Explicitly remove a supplier from the favorites list. */
export function removeFavoriteById(id: string): void {
  const sid = String(id);
  const ids = getIds();
  if (!ids.includes(sid)) return;
  setIds(ids.filter((f) => f !== sid));
}

/** Return the current snapshot of favorite supplier IDs. */
export function getFavoriteIds(): string[] {
  return getIds();
}

/**
 * Re-sync the in-memory store from localStorage.
 * Call this in response to the native "storage" event (cross-tab sync).
 */
export function syncFromStorage(): void {
  _ids = readFromStorage();
}
