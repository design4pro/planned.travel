import { useEffect, useRef, useState } from 'react'
import { Fingerprint, Plus } from 'lucide-react'

import { SIGN_OUT_ENDPOINT } from '#/components/layout/session'
import { Alert, Badge, Button, EmptyState, Skeleton } from '#/components/ui'
import {
  isPasskeyEnrolmentSupported,
  listPasskeys,
  registerPasskey,
} from '#/lib/auth/client'
import { MAX_PASSKEYS_PER_USER } from '#/lib/auth/passkey-limit'
import { cn } from '#/lib/cn'
import { useI18n } from '#/lib/i18n'
import { formatDate, formatNumber } from '../-lib/format'
import { loadFailureNotice, registrationOutcome } from '../-lib/passkey-errors'

import type { Ref } from 'react'
import type { PasskeySummary } from '#/lib/auth/client'
import type { PasskeyNotice } from '../-lib/passkey-errors'

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly notice: PasskeyNotice }
  | {
      readonly status: 'ready'
      readonly passkeys: ReadonlyArray<PasskeySummary>
    }

/** Where focus goes once an outcome has settled and the Add button is enabled again. */
type FocusTarget = 'add' | 'heading' | 'signIn'

const LOADING: ListState = { status: 'loading' }
const ADDED: PasskeyNotice = {
  key: 'settings.passkeys.add.added',
  tone: 'neutral',
  signInAgain: false,
}
// Keeps the Sign in again action mounted, so a failed sign-out can be tried again and the focused
// button never unmounts under the person.
const SIGN_OUT_FAILED: PasskeyNotice = {
  key: 'settings.passkeys.error.generic',
  tone: 'danger',
  signInAgain: true,
}
// The standing limit line is the visible text; this is only its announcement.
const LIMIT_REACHED: PasskeyNotice = {
  key: 'settings.passkeys.add.limit',
  tone: 'neutral',
  signInAgain: false,
}

const HINT_ID = 'passkey-add-hint'
const HEADING_ID = 'passkey-list-heading'
const SKELETON_ROWS = 3

async function fetchList(): Promise<ListState> {
  const result = await listPasskeys()
  return result.ok
    ? { status: 'ready', passkeys: result.passkeys }
    : { status: 'failed', notice: loadFailureNotice(result.failure) }
}

/**
 * Signing in again from a signed-in session is a loop: `/login` sends a signed-in visitor
 * straight back. So the session is ended first, and the sign-in returns to this screen.
 */
function SignInAgain({
  buttonRef,
  onFailed,
}: {
  buttonRef?: Ref<HTMLButtonElement>
  onFailed: () => void
}) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)

  async function signInAgain(): Promise<void> {
    setPending(true)
    try {
      const response = await fetch(SIGN_OUT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!response.ok) throw new Error(`Sign out failed: ${response.status}`)
      // An untyped href: the sign-in routes live outside this tree.
      window.location.assign(
        `/login?redirect=${encodeURIComponent('/passkeys')}`,
      )
    } catch {
      setPending(false)
      onFailed()
    }
  }

  return (
    <Button
      ref={buttonRef}
      variant="secondary"
      size="sm"
      shape="pill"
      loading={pending}
      loadingLabel={t('settings.passkeys.signInAgain')}
      onClick={() => {
        void signInAgain()
      }}
    >
      {t('settings.passkeys.signInAgain')}
    </Button>
  )
}

/** The Add button, drawn in the header and again in the empty state, with the same states. */
function AddPasskeyButton({
  buttonRef,
  dataPart,
  disabled,
  enrolling,
  describedBy,
  onAdd,
}: {
  buttonRef?: Ref<HTMLButtonElement>
  dataPart?: string
  disabled: boolean
  enrolling: boolean
  describedBy?: string
  onAdd: () => void
}) {
  const { t } = useI18n()
  return (
    <Button
      ref={buttonRef}
      data-part={dataPart}
      disabled={disabled}
      loading={enrolling}
      loadingLabel={t('settings.passkeys.add.loading')}
      aria-describedby={describedBy}
      onClick={onAdd}
    >
      <Plus aria-hidden />
      {t('settings.passkeys.add.action')}
    </Button>
  )
}

function PasskeyRow({ passkey }: { passkey: PasskeySummary }) {
  const { t, locale } = useI18n()
  const added = formatDate(passkey.createdAt, locale) ?? passkey.createdAt
  const lastUsed = formatDate(passkey.lastUsedAt, locale)

  return (
    <li
      data-part="passkey-row"
      className="animate-rise flex min-h-18 items-center gap-3 rounded-lg border border-edge bg-surface-2 px-4 py-3"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-inset text-ink-3"
      >
        <Fingerprint className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            dir="auto"
            className="min-w-0 truncate text-body font-semibold text-ink"
          >
            {passkey.name ??
              t('settings.passkeys.row.fallbackName', { date: added })}
          </span>
          {passkey.backedUp ? (
            <Badge tone="info">{t('settings.passkeys.badge.synced')}</Badge>
          ) : null}
          {passkey.deviceType === 'singleDevice' ? (
            <Badge>{t('settings.passkeys.badge.singleDevice')}</Badge>
          ) : null}
        </div>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-label text-ink-3">
          <span>{t('settings.passkeys.row.added', { date: added })}</span>
          {lastUsed === null ? (
            <span>{t('settings.passkeys.row.neverUsed')}</span>
          ) : (
            <span className="tabular-nums">
              {t('settings.passkeys.row.lastUsed', { date: lastUsed })}
            </span>
          )}
        </p>
      </div>
    </li>
  )
}

/**
 * The passkeys of the signed-in person: the list, and the button that runs the registration
 * ceremony. UI only; every call goes through `#/lib/auth/client`.
 */
export function PasskeyManager() {
  const { t, locale } = useI18n()
  const [list, setList] = useState<ListState>(LOADING)
  // `null` until the support check has run, so a supported browser never flashes the
  // "cannot create passkeys" line.
  const [supported, setSupported] = useState<boolean | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  // Set by the server's own refusal, for a count the list did not predict.
  const [limitHit, setLimitHit] = useState(false)
  const [status, setStatus] = useState<PasskeyNotice | null>(null)
  // Bumped by a repeated failure with the same text: a live region only announces a change, so the
  // text node is keyed on this and remounts.
  const [statusTick, setStatusTick] = useState(0)
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const emptyAddRef = useRef<HTMLButtonElement>(null)
  // The Add button the person pressed, so focus returns to it and not to the other one.
  const addOrigin = useRef(addRef)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const signInRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let current = true
    void fetchList().then((next) => {
      if (current) setList(next)
    })
    return () => {
      current = false
    }
  }, [])

  useEffect(() => {
    setSupported(isPasskeyEnrolmentSupported())
  }, [])

  const count = list.status === 'ready' ? list.passkeys.length : 0
  const atLimit = limitHit || count >= MAX_PASSKEYS_PER_USER
  const addDisabled = supported !== true || list.status === 'loading' || atLimit
  let hint: string | null = null
  if (supported === false) {
    hint = t('settings.passkeys.add.unsupported')
  } else if (atLimit) {
    hint = t('settings.passkeys.add.limit', {
      value: formatNumber(MAX_PASSKEYS_PER_USER, locale),
    })
  }

  // With the list failed on a ended session, the Alert carries the one Sign in again action.
  const alertOwnsSignIn = list.status === 'failed' && list.notice.signInAgain

  const addButtonProps = {
    disabled: addDisabled,
    enrolling,
    describedBy: hint === null ? undefined : HINT_ID,
  }
  const addFrom = (origin: typeof addRef) => () => {
    addOrigin.current = origin
    void addPasskey()
  }

  // `loading` disables the button, which drops focus; every outcome hands it back here, to the
  // list heading when the button stays disabled, so it never falls to <body>.
  useEffect(() => {
    if (focusTarget === null || enrolling) return
    let target: HTMLElement | null = headingRef.current
    if (focusTarget === 'signIn') target = signInRef.current ?? target
    if (focusTarget === 'add' && !addDisabled) {
      target = addOrigin.current.current ?? addRef.current ?? target
    }
    target?.focus()
    setFocusTarget(null)
  }, [focusTarget, enrolling, addDisabled])

  async function addPasskey(): Promise<void> {
    // Counted before the ceremony, to tell a row it wrote from one already there.
    const before = list.status === 'ready' ? list.passkeys.length : null
    setStatus(null)
    setEnrolling(true)
    const result = await registerPasskey()
    setEnrolling(false)

    if (result.ok) {
      setList((previous) =>
        previous.status === 'ready' &&
        !previous.passkeys.some(({ id }) => id === result.passkey.id)
          ? {
              status: 'ready',
              passkeys: [result.passkey, ...previous.passkeys],
            }
          : previous,
      )
      // A list that never loaded cannot show the new row: read it again.
      if (list.status === 'failed') void fetchList().then(setList)
      setStatus(ADDED)
      setFocusTarget('add')
      return
    }

    // Whatever the server said, the list on screen may no longer match it (a reply lost after the
    // row was written, a second tab): read it again, and keep it when the read fails.
    if (!result.aborted) {
      void fetchList().then((next) => {
        if (next.status !== 'ready') return
        setList(next)
        // No answer reached us (status 0), yet the row is there: the write succeeded, so the
        // status must not tell the person to try again.
        if (
          !result.alreadyEnrolled &&
          result.failure?.status === 0 &&
          before !== null &&
          next.passkeys.length > before
        ) {
          setStatus(ADDED)
          setFocusTarget('add')
        }
      })
    }

    const outcome = registrationOutcome(result)
    if (outcome.kind === 'limit') {
      setLimitHit(true)
      setStatus(LIMIT_REACHED)
      setFocusTarget('heading')
      return
    }
    setStatus(outcome.notice)
    setFocusTarget(outcome.notice.signInAgain ? 'signIn' : 'add')
  }

  function signOutFailed(): void {
    setStatus(SIGN_OUT_FAILED)
    setStatusTick((tick) => tick + 1)
    setFocusTarget('signIn')
  }

  function retry(): void {
    setList(LOADING)
    void fetchList().then(setList)
    setFocusTarget('heading')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <AddPasskeyButton
            {...addButtonProps}
            buttonRef={addRef}
            dataPart="passkey-add"
            onAdd={addFrom(addRef)}
          />
          {status?.signInAgain && !alertOwnsSignIn ? (
            <SignInAgain buttonRef={signInRef} onFailed={signOutFailed} />
          ) : null}
        </div>
        {/* Mounted on the first render and never conditionally: a live region that appears
            with its text is not announced by every screen reader. */}
        <p
          role="status"
          data-part="passkey-status"
          className={cn(
            'min-h-5 text-label',
            status?.tone === 'danger' ? 'text-danger' : 'text-ink-3',
          )}
        >
          {status === null ? null : status === LIMIT_REACHED ? (
            <span className="sr-only">
              {t(status.key, {
                value: formatNumber(MAX_PASSKEYS_PER_USER, locale),
              })}
            </span>
          ) : (
            <span key={statusTick}>{t(status.key)}</span>
          )}
        </p>
        {hint === null ? null : (
          <p id={HINT_ID} className="text-label text-ink-3">
            {hint}
          </p>
        )}
      </div>

      <section aria-labelledby={HEADING_ID} className="flex flex-col gap-3">
        <h2
          ref={headingRef}
          id={HEADING_ID}
          tabIndex={-1}
          className="text-subtitle font-semibold text-ink"
        >
          {t('settings.passkeys.list.label')}
        </h2>

        {list.status === 'loading' ? (
          <ul aria-busy="true" className="flex flex-col gap-2">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li key={index}>
                <Skeleton radius="lg" className="h-18" />
              </li>
            ))}
          </ul>
        ) : null}

        {list.status === 'failed' ? (
          <Alert
            tone="danger"
            title={t('settings.passkeys.error.title')}
            actions={
              list.notice.signInAgain ? (
                <SignInAgain buttonRef={signInRef} onFailed={signOutFailed} />
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  shape="pill"
                  onClick={retry}
                >
                  {t('settings.passkeys.error.retry')}
                </Button>
              )
            }
          >
            {t(list.notice.key)}
          </Alert>
        ) : null}

        {list.status === 'ready' && list.passkeys.length === 0 ? (
          <EmptyState
            variant="filled"
            icon={<Fingerprint />}
            title={t('settings.passkeys.empty.title')}
            titleAs="h3"
            description={t('settings.passkeys.empty.body')}
            action={
              <AddPasskeyButton
                {...addButtonProps}
                buttonRef={emptyAddRef}
                onAdd={addFrom(emptyAddRef)}
              />
            }
          />
        ) : null}

        {list.status === 'ready' && list.passkeys.length > 0 ? (
          <ul data-part="passkey-list" className="flex flex-col gap-2">
            {list.passkeys.map((passkey) => (
              <PasskeyRow key={passkey.id} passkey={passkey} />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
