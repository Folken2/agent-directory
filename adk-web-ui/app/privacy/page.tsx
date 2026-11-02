import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage, ProseSection, proseLink } from '@/components/ProsePage';

const ISSUES_URL = 'https://github.com/Folken2/agent-directory/issues';

export const metadata: Metadata = {
  title: 'Privacy | ADK Agent Directory',
  description: 'How Agent Directory handles visits, cookies, chats, sign-in and builds you email yourself, and for how long.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy" lead="How Agent Directory handles visits, cookies, sign-in and builds you email yourself.">
      <ProseSection title="Essential visit counts">
        <p>
          Without any choice from you, or if you choose Essential only, we record each page view without a
          cookie: the page, the referring site, the campaign tags in the link, the country and region our host
          derives from your IP address, your browser, operating system, device type and language, and whether
          the request looks like a crawler. We also count clicks on a few links (trying an agent, starting the
          builder, emailing a build, contacting us), together with the page your visit started on, which the
          page keeps in memory until you reload it.
        </p>
        <p>
          We never store your IP address. We store a keyed hash of it, and the key changes every day, so a hash
          cannot be linked to the same address on another day. The hash is used to count visits, to group page
          views into a visit and for daily rate limits.
        </p>
      </ProseSection>

      <ProseSection title="Optional analytics">
        <p>
          If you choose Accept, we also set a first-party visitor cookie (
          <code className="font-mono text-body-medium">ad_vid</code>, one year) so we can tell when you come
          back on another day, store your city and, if you are signed in, your account id with your visits, and
          measure active use of agents: time on chat, number of messages and tool calls (not what you type, see
          below). The page your visit started on is kept in this tab&apos;s session storage for 30 minutes. When
          configured, we load Google Analytics 4 and Vercel Analytics. To change your choice, clear this
          site&apos;s cookies and the banner will ask again.
        </p>
      </ProseSection>

      <ProseSection title="How long we keep it">
        <p>
          Individual visit and click records are kept for 90 days. After that they are folded into daily totals
          per page, country, device type, referring site and crawler name, with no IP hash, visitor id, account
          id, city or browser string, and the individual records are deleted.
        </p>
      </ProseSection>

      <ProseSection title="Chats with agents">
        <p>
          What you send to an agent and its replies are stored so the conversation can continue. If you are
          not signed in, the conversation is deleted 30 days after its last message.
        </p>
        <p>
          If you are signed in, your conversations are your chat history and are kept until you delete them.
          There is no delete button yet; we will add one. Until then, ask us to delete your history through
          the{' '}
          <Link href="/contact" className={proseLink}>contact page</Link>.
        </p>
        <p>
          The site owner can read messages from the last 30 days to fix agents and improve the directory. Older
          messages are not shown to the site owner, including ones kept in a signed-in user&apos;s history.
        </p>
      </ProseSection>

      <ProseSection title="Sign-in">
        <p>
          Google sign-in uses separate authentication cookies required to keep you signed in, keep your chat
          history and apply rate limits. We store your name, email address and profile picture from Google.
          Those cookies are not advertising cookies.
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
          signed in. They are kept until you delete the build. The email is sent through our email provider
          (Resend). When an owner notification is configured, the site owner is told that you emailed a build,
          including your email address and the build summary; if you tick &ldquo;I&apos;d like help
          deploying it&rdquo;, they may get in touch about deploying it. We only send you the link email unless
          you tick &ldquo;Send me updates about the builder and nuvel&rdquo;; then we store the time you agreed
          and add your address to our updates list. We do not sell or share your email.
        </p>
        <p>
          &ldquo;Delete this build&rdquo; on the link page removes your email address and the zip from the
          stored build straight away, and the link stops working. It does not remove you from the updates list:
          if you opted in to updates you stay on it until you unsubscribe with the link in an update email or
          contact us as below. Blueprints saved with an earlier version of the builder are kept; to have one
          deleted, contact us as below.
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
