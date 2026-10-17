/**
 * The shared shell every transactional template renders into.
 *
 * One masthead, one card, one footer, so every message reads as one product.
 * Everything is inline-styled from `./theme`, because a mail
 * client that keeps a `<style>` block is the exception rather than the rule.
 */

import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import { calloutTones, styles } from './theme'

import type { ReactNode } from 'react'
import type { CalloutTone } from './theme'

/** Product identity, threaded in so no template reaches for a Worker binding. */
export interface EmailBrand {
  readonly appName: string
  /** Absolute origin, without a trailing slash. */
  readonly appUrl: string
}

export interface EmailShellProps {
  readonly brand: EmailBrand
  /** The line an inbox shows after the subject. Keep it under 90 characters. */
  readonly preview: string
  /** Tiny tracked label opposite the wordmark: `Security`, `Billing`, `Packs`. */
  readonly eyebrow: string
  readonly heading: string
  /** Why this address received the message. Auth and billing answer differently. */
  readonly footer: string
  readonly children: ReactNode
}

function bareHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

export function EmailShell({
  brand,
  preview,
  eyebrow,
  heading,
  footer,
  children,
}: EmailShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        {/*
          The palette is warm paper on purpose. Declaring the scheme stops Apple
          Mail and Outlook from inverting it into a muddy grey of their own.
        */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.masthead}>
            <Row>
              <Column style={styles.wordmark}>{brand.appName}</Column>
              <Column style={styles.eyebrow}>{eyebrow}</Column>
            </Row>
          </Section>

          <Section style={styles.card}>
            <Heading as="h1" style={styles.heading}>
              {heading}
            </Heading>
            {children}
          </Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>{footer}</Text>
            <Text style={styles.footerText}>
              <Link href={brand.appUrl} style={styles.footerLink}>
                {bareHost(brand.appUrl)}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function EmailParagraph({ children }: { readonly children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>
}

/** Inline emphasis that survives a client stripping `<strong>` defaults. */
export function EmailEmphasis({ children }: { readonly children: ReactNode }) {
  return <span style={styles.strong}>{children}</span>
}

export interface EmailFact {
  readonly label: string
  readonly value: string
}

/**
 * The label/value panel that carries the numbers.
 *
 * Values are set in tabular figures so an amount and a seat count line up down
 * the column instead of dancing, which is the same rule the product's screens
 * follow for any number that can change.
 */
export function EmailFacts({
  facts,
}: {
  readonly facts: ReadonlyArray<EmailFact>
}) {
  return (
    <Section style={styles.panel}>
      {facts.map((fact, index) => (
        <Row
          key={fact.label}
          style={
            index === facts.length - 1 ? styles.factRowLast : styles.factRow
          }
        >
          <Column style={styles.factLabel}>{fact.label}</Column>
          <Column style={styles.factValue}>{fact.value}</Column>
        </Row>
      ))}
    </Section>
  )
}

/** A tinted panel for the one sentence that changes what the reader should do. */
export function EmailCallout({
  tone,
  children,
}: {
  readonly tone: CalloutTone
  readonly children: ReactNode
}) {
  const { ink, fill } = calloutTones[tone]
  return (
    <Section
      style={{
        margin: '0 0 24px',
        backgroundColor: fill,
        borderRadius: '12px',
        padding: '16px 20px',
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: '14px',
          lineHeight: '22px',
          fontWeight: 600,
          color: ink,
        }}
      >
        {children}
      </Text>
    </Section>
  )
}

export interface EmailActionProps {
  readonly label: string
  readonly url: string
  /** A quieter second route, set as a text link beneath the button. */
  readonly secondary?: { readonly label: string; readonly url: string }
  /**
   * Set for links that must work even when the button is stripped: the raw URL
   * is printed underneath so it can be copied by hand.
   */
  readonly showRawUrl?: boolean
}

export function EmailAction({
  label,
  url,
  secondary,
  showRawUrl = false,
}: EmailActionProps) {
  return (
    <Section style={{ padding: '8px 0 0' }}>
      <Button href={url} style={styles.button}>
        {label}
      </Button>
      {secondary === undefined ? null : (
        <Text style={styles.secondaryAction}>
          <Link href={secondary.url} style={styles.secondaryLink}>
            {secondary.label}
          </Link>
        </Text>
      )}
      {showRawUrl ? (
        <Text style={styles.fallback}>
          Button not working? Paste this into your browser:{' '}
          <Link href={url} style={styles.fallbackLink}>
            {url}
          </Link>
        </Text>
      ) : null}
    </Section>
  )
}

export function EmailFootnote({ children }: { readonly children: ReactNode }) {
  return <Text style={styles.footnote}>{children}</Text>
}
