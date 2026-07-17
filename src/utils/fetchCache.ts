/**
 * Global promise cache for JSON fetches to prevent redundant network requests
 * during concurrent component mounts.
 */
const cache = new Map<string, Promise<any>>();

export function fetchJson<T = any>(url: string): Promise<T> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
    );
  }
  return cache.get(url)!;
}
