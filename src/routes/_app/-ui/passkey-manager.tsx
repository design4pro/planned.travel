import { useEffect, useRef, useState } from 'react'
import { Fingerprint, Pencil, Plus } from 'lucide-react'

import { SIGN_OUT_ENDPOINT } from '#/components/layout/session'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Skeleton,
} from '#/components/ui'
import {
  isPasskeyEnrolmentSupported,
  listPasskeys,
  registerPasskey,
  renamePasskey,
} from '#/lib/auth/client'
import { MAX_PASSKEYS_PER_USER } from '#/lib/auth/passkey-limit'
import { cn } from '#/lib/cn'
import { useI18n } from '#/lib/i18n'
import { formatDate, formatNumber } from '../-lib/format'
import {
  loadFailureNotice,
  registrationOutcome,
  renameFailureNotice,
} from '../-lib/passkey-errors'
import { PasskeyRenameField } from './passkey-rename-field'

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

/**
 * The one row in rename mode. `attention` is bumped when the field must take focus again, and
 * `error` is the notice of a save that failed.
 */
interface RenameState {
  readonly id: string
  readonly saving: boolean
  readonly error: PasskeyNotice | null
  readonly attention: number
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

const SAVING: PasskeyNotice = {
  key: 'settings.passkeys.rename.saving',
  tone: 'neutral',
  signInAgain: false,
}
const SAVED: PasskeyNotice = {
  key: 'settings.passkeys.rename.saved',
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

function PasskeyRow({
  passkey,
  rename,
  registerRenameButton,
  onStartRename,
  onSubmitName,
  onCancelRename,
  onSignOutFailed,
}: {
  passkey: PasskeySummary
  /** Set only on the row that is in rename mode. */
  rename: RenameState | null
  registerRenameButton: (element: HTMLButtonElement | null) => void
  onStartRename: () => void
  onSubmitName: (value: string, viaKey: boolean) => void
  onCancelRename: (viaKey: boolean) => void
  onSignOutFailed: () => void
}) {
  const { t, locale } = useI18n()
  const added = formatDate(passkey.createdAt, locale) ?? passkey.createdAt
  const lastUsed = formatDate(passkey.lastUsedAt, locale)
  const displayName =
    passkey.name ?? t('settings.passkeys.row.fallbackName', { date: added })

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
            {displayName}
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
        {rename === null ? null : (
          <>
            <PasskeyRenameField
              initial={passkey.name ?? ''}
              saving={rename.saving}
              error={rename.error === null ? null : t(rename.error.key)}
              attention={rename.attention}
              onSubmit={onSubmitName}
              onCancel={onCancelRename}
            />
            {rename.error?.signInAgain ? (
              <div className="mt-2">
                <SignInAgain onFailed={onSignOutFailed} />
              </div>
            ) : null}
          </>
        )}
      </div>
      <IconButton
        ref={registerRenameButton}
        data-part="passkey-rename"
        size="sm"
        icon={<Pencil />}
        label={t('settings.passkeys.rename.action', { name: displayName })}
        onClick={onStartRename}
      />
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
  const [rename, setRename] = useState<RenameState | null>(null)
  // The row whose Rename control takes focus back once its rename mode has closed.
  const [renameFocusId, setRenameFocusId] = useState<string | null>(null)
  const renameButtons = useRef(new Map<string, HTMLButtonElement>())
  // Read by a save that finishes after another row took over rename mode.
  const renameRef = useRef<RenameState | null>(null)
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

  useEffect(() => {
    renameRef.current = rename
  }, [rename])

  useEffect(() => {
    if (renameFocusId === null || rename !== null) return
    renameButtons.current.get(renameFocusId)?.focus()
    setRenameFocusId(null)
  }, [renameFocusId, rename])

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
      // The ceremony sent no name: the new row opens in rename mode, and focus goes to its input.
      startRename(result.passkey.id)
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
          startRename(next.passkeys[0].id)
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

  function startRename(id: string): void {
    setRename((previous) => ({
      id,
      saving: false,
      error: null,
      attention: previous?.id === id ? previous.attention + 1 : 0,
    }))
  }

  function closeRename(id: string, returnFocus: boolean): void {
    setRename((previous) => (previous?.id === id ? null : previous))
    if (returnFocus) setRenameFocusId(id)
  }

  async function submitName(
    id: string,
    value: string,
    returnFocus: boolean,
  ): Promise<void> {
    setRename((previous) =>
      previous?.id === id ? { ...previous, saving: true } : previous,
    )
    setStatus(SAVING)
    const result = await renamePasskey(id, value)

    if (result.ok) {
      setList((previous) =>
        previous.status === 'ready'
          ? {
              status: 'ready',
              passkeys: previous.passkeys.map((entry) =>
                entry.id === id ? result.passkey : entry,
              ),
            }
          : previous,
      )
      closeRename(id, returnFocus)
      setStatus(SAVED)
      return
    }

    const notice = renameFailureNotice(result.failure)
    if (renameRef.current?.id === id) {
      // The field is still on screen: the error sits beside it and focus returns to the input.
      setRename((previous) =>
        previous?.id === id
          ? {
              ...previous,
              saving: false,
              error: notice,
              attention: previous.attention + 1,
            }
          : previous,
      )
      setStatus(null)
      return
    }
    // Another row took rename mode while this one saved: the status region says so instead.
    setStatus(notice)
    setStatusTick((tick) => tick + 1)
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
              <PasskeyRow
                key={passkey.id}
                passkey={passkey}
                rename={rename?.id === passkey.id ? rename : null}
                registerRenameButton={(element) => {
                  if (element === null) renameButtons.current.delete(passkey.id)
                  else renameButtons.current.set(passkey.id, element)
                }}
                onStartRename={() => {
                  startRename(passkey.id)
                }}
                onSubmitName={(value, viaKey) => {
                  void submitName(passkey.id, value, viaKey)
                }}
                onCancelRename={(viaKey) => {
                  closeRename(passkey.id, viaKey)
                }}
                onSignOutFailed={() => {
                  setRename((previous) =>
                    previous?.id === passkey.id
                      ? { ...previous, error: SIGN_OUT_FAILED }
                      : previous,
                  )
                }}
              />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
