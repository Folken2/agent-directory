import type { Metadata } from 'next';
import { ProsePage, ProseSection, proseLink } from '@/components/ProsePage';

const ISSUES_URL = 'https://github.com/Folken2/agent-directory/issues';

export const metadata: Metadata = {
  title: 'Privacy | ADK Agent Directory',
  description: 'How Agent Directory handles visits, cookies, sign-in and saved blueprints.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy" lead="How Agent Directory handles visits, cookies, sign-in and saved blueprints.">
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

      <ProseSection title="Saved blueprints" id="blueprints">
        <p>
          When you choose to save a blueprint from the agent builder, we store the blueprint, the email address
          you enter, the time you gave consent, and, if you are signed in, your account id. We send the site
          owner a notification with the same details so they can follow up with you about building the agent.
          We use your email only for that follow-up, never for marketing lists or advertising, and we do not
          sell or share it. Nothing is saved unless you tick the consent box.
        </p>
        <p>
          To have a saved blueprint and your email deleted, reply to the follow-up email or contact us as below.
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
