export const NOT_AFFILIATED_NOTICE =
  'Independent, open-source project. Not an official Google product and not affiliated with or endorsed by Google. Google, Gemini and ADK are trademarks of Google LLC.';

/** Only use an external link when its URL is configured and valid. */
export function configuredUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

/** A plain address only, so a misconfigured value can't smuggle extra mailto: parameters. */
export function configuredEmail(value: string | undefined): string | null {
  const email = value?.trim();
  return email && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email) ? email : null;
}

export type ContactLink = { label: string; href: string };

/**
 * The owner's public profiles. NEXT_PUBLIC_ values are inlined at build time,
 * so this reads them with literal process.env.X accesses.
 */
export function profileLinks(): ContactLink[] {
  return [
    { label: 'GitHub', href: configuredUrl(process.env.NEXT_PUBLIC_GITHUB_URL) },
    { label: 'LinkedIn', href: configuredUrl(process.env.NEXT_PUBLIC_LINKEDIN_URL) },
    { label: 'Website', href: configuredUrl(process.env.NEXT_PUBLIC_PERSONAL_URL) },
  ].filter((link): link is ContactLink => link.href !== null);
}

export function contactEmail(): string | null {
  return configuredEmail(process.env.NEXT_PUBLIC_CONTACT_EMAIL);
}
