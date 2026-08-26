import { createFileRoute } from '@tanstack/react-router'

import { LegalPage, LegalPlaceholder } from '#/components/marketing'

import type { LegalSection } from '#/components/marketing'

const TITLE = 'Privacy notice — planned.travel'
const DESCRIPTION =
  'The plain-English privacy notice template for planned.travel: what we collect, what we refuse to do with it, where it is stored on Cloudflare, which third parties touch it, how long we keep it and how to get it back.'
const URL = 'https://planned.travel/legal/privacy'

const UPDATED = '19 August 2026'
const VERSION = '1.0 (template)'

export const Route = createFileRoute('/legal/privacy')({
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
  component: PrivacyPage,
})

const SUMMARY: ReadonlyArray<string> = [
  'We collect what the product needs to work: your account details, the trips you create, and technical logs.',
  'We do not sell or rent your data, we run no advertising, and we load no third-party analytics or tracking scripts.',
  'Your trips live in a Cloudflare database and object store scoped to your workspace. Polar, our merchant of record, sells and invoices the subscription, so we never hold your card number.',
  'You can export your trips at any time, and deleting your account deletes your content.',
  'We hold no security certification today. When we are audited against a standard, we will name the standard here — and not before.',
]

const SECTIONS: ReadonlyArray<LegalSection> = [
  {
    id: 'who-we-are',
    heading: 'Who is responsible for your data',
    body: (
      <>
        <p>
          planned.travel is the controller of the personal data described here.
          Before launch, replace this paragraph with the operating
          company&rsquo;s{' '}
          <LegalPlaceholder>registered legal name</LegalPlaceholder>,{' '}
          <LegalPlaceholder>registered address</LegalPlaceholder> and, where one
          is required,{' '}
          <LegalPlaceholder>
            [the data protection officer or representative]
          </LegalPlaceholder>
          .
        </p>
        <p>
          If you use a workspace somebody else owns, they decide who is invited
          into it and what is stored in the trips they create. We still apply
          everything in this notice to your personal data.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    heading: 'What we collect',
    body: (
      <>
        <dl>
          <dt>Account details</dt>
          <dd>
            Your name, email address, password hash, and — if you turn them on —
            passkey credentials and two-factor secrets. Never your plain
            password: it is hashed and cannot be reversed.
          </dd>
          <dt>What you put into a trip</dt>
          <dd>
            Trip names and dates, places and their coordinates, itinerary days,
            reservations and confirmation codes, transport legs, expenses and
            how they split, lists, journal entries, messages to the people you
            are travelling with, and any file or photograph you upload.
          </dd>
          <dt>Workspace and membership records</dt>
          <dd>
            Which workspaces you belong to, your role in each, and invitations
            you have sent or accepted.
          </dd>
          <dt>Billing records</dt>
          <dd>
            Your Polar customer and subscription identifiers, the plan you are
            on, its status and renewal date, and the order history behind your
            invoices. <strong>Not your card number</strong> — that stays with
            Polar, who takes the payment and issues the invoice.
          </dd>
          <dt>Technical records</dt>
          <dd>
            Request logs and error reports containing an IP address, a
            timestamp, the page or endpoint, and a user-agent string. These
            exist to keep the service secure and to let us diagnose faults.
          </dd>
        </dl>
        <p>
          We collect no special-category data on purpose. If you record health
          notes, dietary requirements or similar in a trip, you are choosing to
          store them and you should only do that for people who know about it.
        </p>
      </>
    ),
  },
  {
    id: 'why',
    heading: 'Why we hold it',
    body: (
      <>
        <ul>
          <li>
            <strong>To run the service</strong> — showing you your trips,
            syncing edits between the people on a trip, sending the emails a
            product has to send. This is how we perform our contract with you.
          </li>
          <li>
            <strong>To take payment</strong> — opening a subscription with
            Polar, our merchant of record, and enforcing the plan limits it
            entitles you to. Polar is the seller on that purchase and issues the
            invoice; we hold only the identifiers and the plan state it returns.
          </li>
          <li>
            <strong>To keep it secure and working</strong> — rate limiting,
            abuse prevention, backups and fault diagnosis. This is our
            legitimate interest in a service that stays up and is not abused.
          </li>
          <li>
            <strong>To meet legal obligations</strong> — keeping tax and invoice
            records for as long as the law requires.
          </li>
        </ul>
        <p>
          If you send optional marketing emails, that needs consent and its own
          unsubscribe link.{' '}
          <LegalPlaceholder>
            [Confirm the lawful bases in this section against the laws that
            apply to your customers.]
          </LegalPlaceholder>
        </p>
      </>
    ),
  },
  {
    id: 'what-we-do-not-do',
    heading: 'What we do not do',
    body: (
      <>
        <ul>
          <li>We do not sell, rent or trade your personal data. Not ever.</li>
          <li>
            We run no advertising, no affiliate links and no advertising
            identifiers.
          </li>
          <li>
            We load no third-party analytics, session-recording or tracking
            scripts. Usage measurement, where we do it, comes from our own
            server logs.
          </li>
          <li>
            We do not use your trips, photographs or messages to train
            machine-learning models.
          </li>
          <li>
            We do not read your content, except when you ask us to look at a
            specific problem or where the law compels us.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'cookies',
    heading: 'Cookies and browser storage',
    body: (
      <>
        <p>
          We use no advertising or analytics cookies, so there is no consent
          banner to dismiss. What we do set is small and necessary:
        </p>
        <ul>
          <li>
            A <strong>session cookie</strong> that keeps you signed in. It is
            HTTP-only, secure, and cleared when you sign out.
          </li>
          <li>
            A <strong>theme preference</strong> stored in your browser, so the
            light or dark choice survives a reload. It never leaves your device.
          </li>
          <li>
            <strong>Cached map tiles</strong> in your browser, so panning a map
            does not re-download the same tiles.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'where',
    heading: 'Where your data is stored',
    body: (
      <>
        <p>
          planned.travel runs on Cloudflare Workers. Your records are held in
          Cloudflare D1 (the database), your uploads in Cloudflare R2 (object
          storage), sessions and caches in Cloudflare KV, and live collaboration
          in a Durable Object dedicated to a single trip.
        </p>
        <p>
          Cloudflare operates a global network, and data may be stored in or
          served from more than one country.{' '}
          <LegalPlaceholder>
            [State the region configuration you actually deploy with, and the
            transfer mechanism you rely on.]
          </LegalPlaceholder>
        </p>
      </>
    ),
  },
  {
    id: 'processors',
    heading: 'Who else touches it',
    body: (
      <>
        <p>
          We keep this list short on purpose. Every entry is here because the
          product cannot work without it.
        </p>
        <dl>
          <dt>Cloudflare</dt>
          <dd>
            Hosting, database, object storage, caching and network delivery.
            Sees everything that passes through the service.
          </dd>
          <dt>Polar</dt>
          <dd>
            Merchant of record. Polar sells the subscription to you as our
            reseller, so it is the seller on your invoice rather than only a
            processor acting for us, and it determines, collects and remits the
            sales tax or VAT on that sale. It receives your email address, the
            billing details you give it and the card data you enter directly
            into its checkout; we send it an identifier for your workspace and
            receive back a plan, a status and an order list.
          </dd>
          <dt>Email delivery</dt>
          <dd>
            Sends verification, password-reset, invitation and billing emails,
            so it receives your email address and the message body.{' '}
            <LegalPlaceholder>[Name your email provider.]</LegalPlaceholder>
          </dd>
          <dt>Google Fonts</dt>
          <dd>
            Serves the two typefaces the interface is set in. Your browser
            requests them directly, which means Google receives that request and
            your IP address. If that is unacceptable for your customers,
            self-host the fonts instead.
          </dd>
        </dl>
        <p>
          Map tiles are served from our own storage, built from OpenStreetMap
          data, so no map vendor receives your browsing.
        </p>
        <p>
          <LegalPlaceholder>
            [Keep this list current. Hold a data processing agreement with each
            processor, and note that a merchant of record is an independent
            controller for the sale it makes rather than a processor of yours.]
          </LegalPlaceholder>
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    heading: 'How long we keep it',
    body: (
      <>
        <ul>
          <li>
            <strong>Your trips and files</strong> — until you delete them, or
            until your account is deleted.
          </li>
          <li>
            <strong>Your account</strong> — until you close it. After that we
            delete your content within{' '}
            <LegalPlaceholder>[deletion window, e.g. 30 days]</LegalPlaceholder>
            , and it clears from routine backups within{' '}
            <LegalPlaceholder>[backup window]</LegalPlaceholder>.
          </li>
          <li>
            <strong>Invoices and tax records</strong> — for as long as tax law
            requires, which is longer than the rest.
          </li>
          <li>
            <strong>Technical logs</strong> — a short rolling window, then
            discarded:{' '}
            <LegalPlaceholder>[log retention period]</LegalPlaceholder>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'your-rights',
    heading: 'Your rights, and how to use them',
    body: (
      <>
        <p>Whatever the law where you live, you can always:</p>
        <ul>
          <li>
            <strong>See it</strong> — everything you have put in is visible in
            the product.
          </li>
          <li>
            <strong>Take it</strong> — export any trip as a PDF itinerary and a
            calendar file, and your places as GeoJSON.
          </li>
          <li>
            <strong>Correct it</strong> — edit your profile and your trip
            content directly.
          </li>
          <li>
            <strong>Delete it</strong> — delete a trip, or close your account
            and take the whole thing with it.
          </li>
        </ul>
        <p>
          Depending on where you live you may also have statutory rights to
          restrict or object to processing, to portability in a machine-readable
          format, and to complain to a supervisory authority.{' '}
          <LegalPlaceholder>
            [Set out the statutory rights and the response deadline for each
            territory you serve, and name the relevant authority.]
          </LegalPlaceholder>
        </p>
        <p>
          To exercise anything that is not a button in the product, write to{' '}
          <LegalPlaceholder>[privacy contact email]</LegalPlaceholder>. We will
          answer within <LegalPlaceholder>[response period]</LegalPlaceholder>.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    heading: 'How we protect it',
    body: (
      <>
        <ul>
          <li>
            Everything travels over HTTPS. There is no unencrypted endpoint.
          </li>
          <li>
            Passwords are hashed. Passkeys and time-based one-time codes are
            both supported, and we recommend enabling one.
          </li>
          <li>
            Every database query is scoped to a workspace at the data-access
            layer, and that isolation is covered by automated tests — so one
            customer&rsquo;s query cannot reach another customer&rsquo;s rows.
          </li>
          <li>
            Payment card data never reaches our servers; it goes straight from
            your browser into Polar&rsquo;s checkout.
          </li>
        </ul>
        <p>
          <strong>What we will not claim.</strong> planned.travel holds no
          security certification and has not been audited against SOC 2, ISO
          27001 or any comparable standard. No system is perfectly secure. If
          you find a vulnerability, please report it to{' '}
          <LegalPlaceholder>[security contact email]</LegalPlaceholder> and give
          us a reasonable chance to fix it before disclosing it.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    heading: 'Children',
    body: (
      <>
        <p>
          planned.travel is not designed for children and we do not knowingly
          collect data from anybody under{' '}
          <LegalPlaceholder>[minimum age]</LegalPlaceholder>. If you believe a
          child has an account, tell us and we will remove it.
        </p>
        <p>
          Adding a child as a traveller on a trip you are planning is normal
          use. Only record what you actually need about them.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this notice',
    body: (
      <>
        <p>
          The version and effective date at the top of this page tell you which
          version you are reading. For a change that materially affects how we
          handle your data we will email account holders before it takes effect,
          and keep the previous version available on request.
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
          Privacy questions:{' '}
          <LegalPlaceholder>[privacy contact email]</LegalPlaceholder>. Security
          reports: <LegalPlaceholder>[security contact email]</LegalPlaceholder>
          . Everything else:{' '}
          <LegalPlaceholder>[support email address]</LegalPlaceholder>.
        </p>
        <p>
          Post reaches us at{' '}
          <LegalPlaceholder>[registered postal address]</LegalPlaceholder>.
        </p>
      </>
    ),
  },
]

function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy notice"
      updated={UPDATED}
      version={VERSION}
      summary={SUMMARY}
      sections={SECTIONS}
    />
  )
}
