import { createFileRoute } from '@tanstack/react-router'

import { LegalPage, LegalPlaceholder } from '#/components/marketing'

import type { LegalSection } from '#/components/marketing'

const TITLE = 'Terms of service — planned.travel'
const DESCRIPTION =
  'The plain-English terms of service template for planned.travel: your account, your trips, plans and payment through Stripe, availability, and how either side can end the agreement.'
const URL = 'https://planned.travel/legal/terms'

const UPDATED = '19 August 2026'
const VERSION = '1.0 (template)'

export const Route = createFileRoute('/legal/terms')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: URL },
    ],
    links: [{ rel: 'canonical', href: URL }],
  }),
  component: TermsPage,
})

const SUMMARY: ReadonlyArray<string> = [
  'Your trips, photographs and notes belong to you. We store them so the product can work, and you can export or delete them whenever you like.',
  'Free costs nothing and does not expire. Paid plans renew until you cancel, and you can cancel from inside the product at any time.',
  'Use planned.travel for planning travel. Do not use it to break the law, to attack the service, or to store other people’s personal data without their knowledge.',
  'We do our best to keep the service up, but we do not promise perfection, and our financial responsibility is limited to what you have paid us.',
  'If you stop paying, nothing is deleted. Paid modules lock; your trips stay where they are.',
]

const SECTIONS: ReadonlyArray<LegalSection> = [
  {
    id: 'who-we-are',
    heading: 'Who you are agreeing with',
    body: (
      <>
        <p>
          planned.travel (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a subscription
          service for planning travel, reachable at{' '}
          <strong>planned.travel</strong>. These terms are the agreement between
          you and the company that operates it.
        </p>
        <p>
          Before launch, replace this paragraph with the operating
          company&rsquo;s{' '}
          <LegalPlaceholder>registered legal name</LegalPlaceholder>,{' '}
          <LegalPlaceholder>company number</LegalPlaceholder>,{' '}
          <LegalPlaceholder>registered address</LegalPlaceholder> and{' '}
          <LegalPlaceholder>VAT or tax registration number</LegalPlaceholder>. A
          customer must be able to identify and reach the legal entity they are
          contracting with.
        </p>
        <p>
          By creating an account, or by using the service after these terms
          change, you accept them. If you do not accept them, do not use the
          service.
        </p>
      </>
    ),
  },
  {
    id: 'account',
    heading: 'Your account',
    body: (
      <>
        <ul>
          <li>
            You need an account to use anything beyond the public pages. You
            must be old enough to enter a contract where you live, and at least{' '}
            <LegalPlaceholder>[minimum age]</LegalPlaceholder> years old.
          </li>
          <li>
            Give us an email address you actually read. It is how we send
            security notices, receipts and anything about your subscription.
          </li>
          <li>
            Keep your credentials to yourself. You are responsible for what
            happens under your account. We support passkeys and two-factor
            authentication, and we recommend turning one of them on.
          </li>
          <li>
            Tell us promptly if you think somebody else has your account. We may
            suspend an account while we investigate a credible security report.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    heading: 'What you may and may not do',
    body: (
      <>
        <p>
          Use the service to plan and record travel. Do not use it to do any of
          the following.
        </p>
        <ul>
          <li>
            Break the law, infringe somebody&rsquo;s rights, or upload content
            you have no right to upload.
          </li>
          <li>
            Store other people&rsquo;s personal information — passport scans,
            medical details, payment cards — without their knowledge and a
            lawful reason.
          </li>
          <li>
            Probe, scrape, overload or reverse-engineer the service, evade a
            quota, or try to reach another workspace&rsquo;s data.
          </li>
          <li>
            Resell the service, or use it to build a competing product from what
            you learn about how it works.
          </li>
          <li>
            Upload malware, or anything designed to interfere with another
            person&rsquo;s use of the service.
          </li>
        </ul>
        <p>
          We may remove content or suspend an account that breaks this section.
          Where it is reasonable to do so, we will tell you why first.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    heading: 'Your trips and who owns them',
    body: (
      <>
        <p>
          <strong>Your content stays yours.</strong> Itineraries, places,
          expenses, lists, journal entries, photographs and files remain your
          property. We claim no ownership of them.
        </p>
        <p>
          To run the product, you give us a limited licence to store, copy,
          transmit, resize and display your content — only as far as is needed
          to provide the service to you and to the people you have invited, to
          keep backups, and to support you when you ask. That licence ends when
          you delete the content or close your account, apart from copies
          sitting in routine backups until they age out.
        </p>
        <p>
          We do not use your content to train machine-learning models, and we do
          not read it except when you ask us to help with a specific problem or
          when the law requires it.
        </p>
      </>
    ),
  },
  {
    id: 'workspaces',
    heading: 'Workspaces, invitations and shared trips',
    body: (
      <>
        <p>
          Every trip belongs to a workspace. Anybody you invite into a workspace
          can see and edit the trips they have been added to, according to the
          role you gave them.
        </p>
        <ul>
          <li>
            The person who owns a workspace controls its subscription, its seats
            and its members, and can remove a member at any time.
          </li>
          <li>
            Inviting somebody means sharing that trip&rsquo;s content with them.
            Only invite people you intend to share it with.
          </li>
          <li>
            Outstanding invitations count against the seats a workspace has paid
            for, so a workspace can never quietly exceed its plan.
          </li>
          <li>
            Content added by a member belongs to that member, but stays in the
            workspace when they leave, unless they delete it first.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'plans-payment',
    heading: 'Plans, prices and payment',
    body: (
      <>
        <p>
          Current plans, prices and limits are on our pricing page, which is
          generated from the same catalogue the billing system uses — so the
          published price is the price you are charged.
        </p>
        <ul>
          <li>
            Payments are handled by <strong>Stripe</strong>. We never see or
            store your full card number.
          </li>
          <li>
            Prices are in US dollars and exclude any sales tax, VAT or
            equivalent that your country adds. Stripe calculates and shows that
            at checkout.
          </li>
          <li>
            Seat-based plans are billed per member. Changing the number of seats
            changes the invoice for the following period, and upgrades are
            prorated to the day.
          </li>
          <li>
            If a payment fails we keep your access on for a short dunning period
            and email you, rather than locking you out mid-trip.
          </li>
          <li>
            We may change prices. Existing subscribers get at least{' '}
            <LegalPlaceholder>[notice period, e.g. 30 days]</LegalPlaceholder>{' '}
            notice by email before a change applies to their renewal.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'trials-refunds',
    heading: 'Trials, renewal, cancellation and refunds',
    body: (
      <>
        <ul>
          <li>
            A free trial needs no card. When it ends, paid modules simply lock —
            nothing is deleted and you are not charged.
          </li>
          <li>
            Paid subscriptions renew automatically at the end of each period
            until you cancel. You can cancel at any time from the billing
            settings inside the product.
          </li>
          <li>
            Cancelling stops the next renewal. You keep the paid plan until the
            end of the period you have already paid for.
          </li>
          <li>
            Our refund position is{' '}
            <LegalPlaceholder>
              [state your refund policy, and the statutory cooling-off rights
              that apply in the territories you sell to]
            </LegalPlaceholder>
            .
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'availability',
    heading: 'Availability, changes and support',
    body: (
      <>
        <p>
          We aim to keep planned.travel available and quick, and it runs on
          Cloudflare&rsquo;s network to help with that. We do{' '}
          <strong>not</strong> offer a guaranteed uptime figure or a service
          credit scheme, and we will not pretend otherwise. If that changes, the
          commitment will be written here in numbers.
        </p>
        <p>
          We improve the product continually, which means screens change and
          features are added. If we ever have to remove something significant we
          will give reasonable notice and, where we can, a way to export what
          you have.
        </p>
        <p>
          Support is by email at{' '}
          <LegalPlaceholder>[support email address]</LegalPlaceholder>. Plans
          that include priority support are answered within one working day.
        </p>
      </>
    ),
  },
  {
    id: 'third-parties',
    heading: 'The services underneath',
    body: (
      <>
        <p>
          planned.travel is built on a small number of third-party services.
          They are listed in full, with what each one receives, in our privacy
          notice. In summary:
        </p>
        <ul>
          <li>
            <strong>Cloudflare</strong> — hosting, the database, file storage
            and the network that serves every request.
          </li>
          <li>
            <strong>Stripe</strong> — checkout, subscriptions, invoices and tax
            calculation.
          </li>
          <li>
            <strong>OpenStreetMap contributors</strong> — the map data our
            vector tiles are built from, used under the Open Database Licence.
            Map attribution is shown on every map.
          </li>
          <li>
            <strong>Google Fonts</strong> — the two typefaces the interface is
            set in, requested by your browser when a page loads.
          </li>
        </ul>
        <p>
          Third-party terms apply to those services in their own right. We are
          not responsible for content on sites we link to.
        </p>
      </>
    ),
  },
  {
    id: 'ending',
    heading: 'Ending the agreement',
    body: (
      <>
        <p>
          You can close your account at any time from your settings. Closing it
          cancels any subscription and schedules your content for deletion.
        </p>
        <p>
          We may suspend or close an account if it breaks these terms, if
          payment fails and stays unpaid, or if we are legally required to.
          Except for a serious or repeated breach, we will give you notice and a
          reasonable chance to put it right.
        </p>
        <p>
          Before you go, export what you want to keep: PDF itineraries, calendar
          files and your places as GeoJSON.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    heading: 'Disclaimers and limits of liability',
    body: (
      <>
        <p>
          planned.travel is a planning tool. It is not a travel agent, not a
          tour operator and not an insurer. It does not book anything on your
          behalf, and it does not verify the reservations, addresses, opening
          hours, prices, visa rules or currency figures you record in it. Always
          check the important ones with the provider.
        </p>
        <p>
          The service is provided as it is. To the fullest extent the law
          allows, we exclude implied warranties of merchantability, fitness for
          a particular purpose and non-infringement.
        </p>
        <p>
          To the fullest extent the law allows, our total liability to you for
          any claim relating to the service is limited to the amount you paid us
          in the <LegalPlaceholder>[12]</LegalPlaceholder> months before the
          claim arose. We are not liable for lost profits, lost bookings, missed
          travel, or indirect or consequential loss.
        </p>
        <p>
          Nothing here limits liability that cannot be limited by law — for
          example death or personal injury caused by negligence, or fraud. Some
          consumer protections cannot be excluded, and this section does not try
          to.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    body: (
      <>
        <p>
          We may update these terms. The version number and effective date at
          the top of this page always tell you which version you are reading.
        </p>
        <p>
          For a material change we will email account holders at least{' '}
          <LegalPlaceholder>[notice period]</LegalPlaceholder> before it takes
          effect. Continuing to use the service after that date means you accept
          the new version; if you do not, you can cancel.
        </p>
      </>
    ),
  },
  {
    id: 'law',
    heading: 'Governing law and disputes',
    body: (
      <>
        <p>
          These terms are governed by the law of{' '}
          <LegalPlaceholder>[governing jurisdiction]</LegalPlaceholder>, and{' '}
          <LegalPlaceholder>[chosen courts]</LegalPlaceholder> have
          non-exclusive jurisdiction over any dispute.
        </p>
        <p>
          If you are a consumer, you keep the right to bring a claim in the
          courts of the country you live in, and mandatory local consumer law
          still applies to you. Have a lawyer confirm this section for every
          territory you intend to sell into.
        </p>
        <p>
          If any part of these terms turns out to be unenforceable, the rest
          still applies.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    heading: 'How to reach us',
    body: (
      <>
        <p>
          Write to <LegalPlaceholder>[legal contact email]</LegalPlaceholder>{' '}
          for anything about these terms, or{' '}
          <LegalPlaceholder>[support email address]</LegalPlaceholder> for help
          with your account.
        </p>
        <p>
          Postal notices go to{' '}
          <LegalPlaceholder>[registered postal address]</LegalPlaceholder>.
        </p>
      </>
    ),
  },
]

function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      updated={UPDATED}
      version={VERSION}
      summary={SUMMARY}
      sections={SECTIONS}
    />
  )
}
