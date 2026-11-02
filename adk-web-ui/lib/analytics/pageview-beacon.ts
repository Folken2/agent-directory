/**
 * When the client pageview beacon fires.
 *
 * Middleware already records every full document load (it also sees bots and
 * no-JS clients), so the first render after a load must not send: without
 * consent the two hits carry different random visitor ids and the server's
 * 5-second dedupe cannot pair them. Only later route changes, the App Router
 * soft navigations middleware never sees, are sent.
 */
export function pageviewBeacon(
  lastKey: string | null,
  key: string
): { send: boolean; nextKey: string } {
  if (lastKey === null) return { send: false, nextKey: key };
  return { send: lastKey !== key, nextKey: key };
}
