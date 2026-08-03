/** Sentinel used when a pageview has no geo header. */
export const UNKNOWN_COUNTRY = 'ZZ';

const FALLBACK_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  IN: 'India',
  CA: 'Canada',
  BR: 'Brazil',
  NL: 'Netherlands',
  ES: 'Spain',
  IT: 'Italy',
  JP: 'Japan',
  CN: 'China',
  SG: 'Singapore',
  AU: 'Australia',
  KR: 'South Korea',
  MX: 'Mexico',
  PL: 'Poland',
  SE: 'Sweden',
  CH: 'Switzerland',
  IE: 'Ireland',
};

let displayNames: Intl.DisplayNames | null | undefined;

function regionNames(): Intl.DisplayNames | null {
  if (displayNames !== undefined) return displayNames;
  try {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    // Runtimes built without full ICU.
    displayNames = null;
  }
  return displayNames;
}

/** ISO 3166-1 alpha-2 → readable name. Falls back to the raw code. */
export function countryName(code: string | null | undefined): string {
  const cc = code?.trim().toUpperCase();
  if (!cc || cc === UNKNOWN_COUNTRY) return 'Unknown';
  if (!/^[A-Z]{2}$/.test(cc)) return cc;

  try {
    const resolved = regionNames()?.of(cc);
    if (resolved && resolved !== cc) return resolved;
  } catch {
    // fall through
  }
  return FALLBACK_NAMES[cc] ?? cc;
}

/** ISO 3166-1 alpha-2 → flag emoji via regional indicator symbols. */
export function countryFlag(code: string | null | undefined): string {
  const cc = code?.trim().toUpperCase();
  if (!cc || cc === UNKNOWN_COUNTRY || !/^[A-Z]{2}$/.test(cc)) return '🌐';
  return String.fromCodePoint(
    ...[...cc].map((char) => 0x1f1e6 + (char.charCodeAt(0) - 65))
  );
}
