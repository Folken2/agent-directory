export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-md-surface pt-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-display-small text-md-on-surface mb-4">Privacy</h1>
        <p className="text-body-large text-md-on-surface-variant mb-10">
          How the Agent Directory handles visits, cookies, and optional analytics.
        </p>

        <div className="space-y-8 text-body-medium text-md-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-title-medium text-md-on-surface mb-2">Essential visit counts</h2>
            <p>
              We record anonymous pageviews (path, approximate country from the edge,
              and whether the request looks like a crawler) so we can operate the
              directory. These counts do not use a persistent analytics cookie until
              you opt in.
            </p>
          </section>

          <section>
            <h2 className="text-title-medium text-md-on-surface mb-2">Optional analytics</h2>
            <p>
              If you choose Accept, we may set a first-party visitor cookie (
              <code className="text-label-medium">ad_vid</code>
              ), measure active use of agents (time on chat, messages, tool calls),
              and — when configured — load Google Analytics 4 and Vercel Analytics.
              You can stick to Essential only and still be counted in aggregate visit
              totals without that cookie.
            </p>
          </section>

          <section>
            <h2 className="text-title-medium text-md-on-surface mb-2">Sign-in</h2>
            <p>
              Google sign-in uses separate authentication cookies required to keep
              you signed in, unlock history, and apply rate limits. Those are not
              advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-title-medium text-md-on-surface mb-2">Contact</h2>
            <p>
              Questions about this policy: use the site footer links or the project
              GitHub repository.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
