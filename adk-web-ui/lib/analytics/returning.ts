/**
 * Returning visitors: consented visitors (persistent `ad_vid`) seen on two or
 * more distinct UTC days in the window. A multi-page visit on one day is not a
 * return. Visitors without consent get a fresh id per hit and never qualify.
 */
export const RETURNING_MIN_DAYS = 2;

export function countReturningVisitors(
  rows: readonly { visitorId: string; day: string }[],
  minDays: number = RETURNING_MIN_DAYS
): number {
  const days = new Map<string, Set<string>>();
  for (const { visitorId, day } of rows) {
    let set = days.get(visitorId);
    if (!set) days.set(visitorId, (set = new Set()));
    set.add(day);
  }
  let returning = 0;
  for (const set of days.values()) if (set.size >= minDays) returning++;
  return returning;
}
