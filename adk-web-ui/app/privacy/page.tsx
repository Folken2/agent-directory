import type { Metadata } from 'next';
import { ProsePage, ProseSection, proseLink } from '@/components/ProsePage';

const ISSUES_URL = 'https://github.com/Folken2/agent-directory/issues';

export const metadata: Metadata = {
  title: 'Privacy | ADK Agent Directory',
  description: 'How Agent Directory handles visits, cookies, sign-in and builds you email yourself.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy" lead="How Agent Directory handles visits, cookies, sign-in and builds you email yourself.">
      <ProseSection title="Essential visit counts">
        <p>
          We record anonymous pageviews (path, approximate country from the edge, and whether the request looks
          like a crawler) so we can operate the directory. These counts do not use a persistent analytics cookie
          until you opt in.
        </p>
      </ProseSection>

      <ProseSection title="Optional analytics">
        <p>
          If you choose Accept, we may set a first-party visitor cookie (
          <code className="font-mono text-body-medium">ad_vid</code>), measure active use of agents (time on
          chat, messages, tool calls), and, when configured, load Google Analytics 4 and Vercel Analytics. With
          Essential only you are still counted in aggregate visit totals, without that cookie.
        </p>
      </ProseSection>

      <ProseSection title="Sign-in">
        <p>
          Google sign-in uses separate authentication cookies required to keep you signed in, keep your chat
          history and apply rate limits. Those are not advertising cookies.
        </p>
      </ProseSection>

      <ProseSection title="Builds you email yourself" id="builds">
        <p>
          Every agent the builder packages is recorded without personal data: its name, the options, models,
          tools and skills it uses, and its size. We use these counts to improve the builder.
        </p>
        <p>
          When you choose &ldquo;Email me a permanent link&rdquo;, we store your email address, the zip and that
          build summary so we can send you the link and serve the download, plus your account id if you are
          signed in. The email is sent through our email provider (Resend). We only send you that email unless
          you tick &ldquo;Send me updates about the builder and nuvel&rdquo;; then your address is added to our
          updates list. If you tick &ldquo;I&apos;d like help deploying it&rdquo;, the site owner is notified so
          they can get in touch. We do not sell or share your email.
        </p>
        <p>
          &ldquo;Delete this build&rdquo; on the link page removes your email address and the zip straight away,
          and the link stops working. Blueprints saved with an earlier version of the builder are kept; to have
          one deleted, contact us as below.
        </p>
      </ProseSection>

      <ProseSection title="Contact">
        <p>
          For questions about this policy, open an issue on the project&apos;s{' '}
          <a href={ISSUES_URL} target="_blank" rel="noreferrer" className={proseLink}>GitHub repository</a>.
        </p>
      </ProseSection>
    </ProsePage>
  );
}
