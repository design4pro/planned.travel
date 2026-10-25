import { useEffect, useRef, useState } from 'react'
import { Fingerprint, Pencil, Plus, Trash2 } from 'lucide-react'

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
  SIGN_OUT_FAILED,
  loadFailureNotice,
  registrationOutcome,
  renameFailureNotice,
} from '../-lib/passkey-errors'
import { PasskeyDeleteDialog } from './passkey-delete-dialog'
import { PasskeyRenameField } from './passkey-rename-field'
import { SignInAgain } from './passkey-sign-in-again'

import type { Ref } from 'react'
import type { PasskeySummary } from '#/lib/auth/client'
import type { I18nContextValue } from '#/lib/i18n'
import type { PasskeyNotice } from '../-lib/passkey-errors'

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly notice: PasskeyNotice }
  | {
      readonly status: 'ready'
      readonly passkeys: ReadonlyArray<PasskeySummary>
      /** Which dialog the Remove control draws; the server decides for itself on delete. */
      readonly requiresPassword: boolean
    }

/**
 * The one row in rename mode. `attention` is bumped when the field must take focus again,
 * `error` is the notice of a save that failed.
 */
interface RenameState {
  readonly id: string
  readonly saving: boolean
  readonly error: PasskeyNotice | null
  readonly attention: number
}

/**
 * The passkey whose removal dialog is, or was just, on screen. The dialog stays mounted while it
 * closes so its exit and its focus hand-over run; `serial` gives each opening fresh state, and
 * `removed` tells the hand-over whether the opener row still exists.
 */
interface Removal {
  readonly passkey: PasskeySummary
  readonly open: boolean
  readonly removed: boolean
  readonly serial: number
}

/** Where focus goes once an outcome has settled and the Add button is enabled again. */
type FocusTarget = 'add' | 'heading' | 'signIn'

const LOADING: ListState = { status: 'loading' }
const ADDED: PasskeyNotice = {
  key: 'settings.passkeys.add.added',
  tone: 'neutral',
  signInAgain: false,
}
// The standing limit line is the visible text; this is only its announcement.
const LIMIT_REACHED: PasskeyNotice = {
  key: 'settings.passkeys.add.limit',
  tone: 'neutral',
  signInAgain: false,
}

const REMOVED: PasskeyNotice = {
  key: 'settings.passkeys.delete.removed',
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
    ? {
        status: 'ready',
        passkeys: result.passkeys,
        requiresPassword: result.requiresPassword,
      }
    : { status: 'failed', notice: loadFailureNotice(result.failure) }
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

/** The passkey's own name, or the display-only fallback built from its date, never saved. */
function displayNameOf(
  passkey: PasskeySummary,
  { t, locale }: Pick<I18nContextValue, 't' | 'locale'>,
): string {
  if (passkey.name !== null) return passkey.name
  const added = formatDate(passkey.createdAt, locale) ?? passkey.createdAt
  return t('settings.passkeys.row.fallbackName', { date: added })
}

/** True while focus is in the rename field, or nowhere (a disabled control dropped it). */
function focusIsInRenameField(): boolean {
  const active = document.activeElement
  return (
    active === null ||
    active === document.body ||
    active.closest('[data-part="passkey-rename-field"]') !== null
  )
}

function PasskeyRow({
  passkey,
  rename,
  registerRenameButton,
  registerRemoveButton,
  onStartRename,
  onStartRemove,
  onSubmitName,
  onCancelRename,
  onSignOutFailed,
  signInRef,
}: {
  passkey: PasskeySummary
  /** Set only on the row that is in rename mode. */
  rename: RenameState | null
  registerRenameButton: (element: HTMLButtonElement | null) => void
  registerRemoveButton: (element: HTMLButtonElement | null) => void
  onStartRename: () => void
  onStartRemove: () => void
  onSubmitName: (value: string, viaKey: boolean) => void
  onCancelRename: (viaKey: boolean) => void
  onSignOutFailed: () => void
  signInRef: Ref<HTMLButtonElement>
}) {
  const i18n = useI18n()
  const { t, locale } = i18n
  const added = formatDate(passkey.createdAt, locale) ?? passkey.createdAt
  const lastUsed = formatDate(passkey.lastUsedAt, locale)
  const displayName = displayNameOf(passkey, i18n)

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
                <SignInAgain buttonRef={signInRef} onFailed={onSignOutFailed} />
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
      <IconButton
        ref={registerRemoveButton}
        data-part="passkey-delete"
        size="sm"
        variant="danger"
        icon={<Trash2 />}
        label={t('settings.passkeys.delete.action', { name: displayName })}
        onClick={onStartRemove}
      />
    </li>
  )
}

/**
 * The passkeys of the signed-in person: the list, and the button that runs the registration
 * ceremony. UI only; every call goes through `#/lib/auth/client`.
 */
export function PasskeyManager() {
  const i18n = useI18n()
  const { t, locale } = i18n
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
  const removeButtons = useRef(new Map<string, HTMLButtonElement>())
  const [removal, setRemoval] = useState<Removal | null>(null)
  const removalSerial = useRef(0)
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

  // A busy button stays focusable (aria-disabled, not natively disabled), but an outcome can
  // disable it for real (the ceiling, a list that failed), which drops focus; every outcome hands
  // it back here, to the list heading when the button stays disabled, so it never falls to <body>.
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
    // No answer reached us (status 0), so the row may or may not be written: the Add button stays
    // busy until the list says which, and the status and focus are set once, after that.
    const lostReply =
      !result.ok &&
      !result.aborted &&
      !result.alreadyEnrolled &&
      result.failure?.status === 0
    if (!lostReply) setEnrolling(false)

    if (result.ok) {
      setList((previous) =>
        previous.status === 'ready' &&
        !previous.passkeys.some(({ id }) => id === result.passkey.id)
          ? {
              ...previous,
              passkeys: [result.passkey, ...previous.passkeys],
            }
          : previous,
      )
      // A list that never loaded cannot show the new row: read it again.
      if (list.status === 'failed') {
        void fetchList().then((next) => {
          setList(next)
          // No row to open: rename mode would wait for nothing, and focus has nowhere to go.
          if (next.status !== 'ready') {
            setRename(null)
            setFocusTarget('add')
          }
        })
      }
      setStatus(ADDED)
      // The ceremony sent no name: the new row opens in rename mode, and focus goes to its input.
      startRename(result.passkey.id)
      return
    }

    // Whatever the server said, the list on screen may no longer match it (a reply lost after the
    // row was written, a second tab): read it again, and keep it when the read fails.
    if (lostReply) {
      const next = await fetchList()
      if (next.status === 'ready') setList(next)
      setEnrolling(false)
      // The row is there: the write succeeded, so the status must not tell the person to try again.
      if (
        next.status === 'ready' &&
        before !== null &&
        next.passkeys.length > before
      ) {
        setStatus(ADDED)
        startRename(next.passkeys[0].id)
        return
      }
    } else if (!result.aborted) {
      void fetchList().then((next) => {
        if (next.status === 'ready') setList(next)
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
    setRename((previous) => {
      // A save is running: the Rename control pressed meanwhile (a blur just started it) must not
      // make the field editable again.
      if (previous?.id === id && previous.saving) return previous
      return {
        id,
        saving: false,
        error: null,
        attention: previous?.id === id ? previous.attention + 1 : 0,
      }
    })
  }

  function closeRename(id: string, returnFocus: boolean): void {
    setRename((previous) => (previous?.id === id ? null : previous))
    // Another row took rename mode while this one saved: focus is theirs now.
    const otherRowOpen =
      renameRef.current !== null && renameRef.current.id !== id
    if (returnFocus && !otherRowOpen) setRenameFocusId(id)
  }

  async function submitName(
    id: string,
    value: string,
    viaKey: boolean,
  ): Promise<void> {
    setRename((previous) =>
      previous?.id === id
        ? { ...previous, saving: true, error: null }
        : previous,
    )
    setStatus(SAVING)
    const result = await renamePasskey(id, value)
    // Focus follows the person: a key started this save, but they may have clicked elsewhere since.
    const returnFocus = viaKey && focusIsInRenameField()

    if (result.ok) {
      setList((previous) =>
        previous.status === 'ready'
          ? {
              ...previous,
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
      // The field is still on screen: the error sits beside it. A save started by a key takes focus
      // back into the input; one started by a blur leaves it where the person moved it. The status
      // region says it too, once and without the sign-in action the row already carries.
      setRename((previous) =>
        previous?.id === id
          ? {
              ...previous,
              saving: false,
              error: notice,
              attention: returnFocus
                ? previous.attention + 1
                : previous.attention,
            }
          : previous,
      )
      setStatus({ ...notice, signInAgain: false, quiet: true })
      setStatusTick((tick) => tick + 1)
      return
    }
    // Another row took rename mode while this one saved: the status region says so instead.
    setStatus(notice)
    setStatusTick((tick) => tick + 1)
  }

  function startRemove(passkey: PasskeySummary): void {
    removalSerial.current += 1
    setRemoval({
      passkey,
      open: true,
      removed: false,
      serial: removalSerial.current,
    })
  }

  function cancelRemove(): void {
    setRemoval((previous) =>
      previous === null ? previous : { ...previous, open: false },
    )
  }

  function passkeyRemoved(id: string): void {
    setList((previous) =>
      previous.status === 'ready'
        ? {
            ...previous,
            passkeys: previous.passkeys.filter((entry) => entry.id !== id),
          }
        : previous,
    )
    // A refusal at the ceiling is stale the moment a row is gone: "Remove one to add another".
    setLimitHit(false)
    // The row may be the one in rename mode; its field goes with it.
    if (renameRef.current?.id === id) setRename(null)
    setRemoval((previous) =>
      previous === null
        ? previous
        : { ...previous, open: false, removed: true },
    )
  }

  // The dialog closes either by Cancel or Escape, which return to the row's Remove control, or by a
  // removal, after which the row is gone: focus goes to the header Add button, or to the list
  // heading when that is disabled, so it never falls to <body>.
  function returnFocusAfterRemove(event: Event): void {
    event.preventDefault()
    let target: HTMLElement | null = headingRef.current
    if (removal?.removed === true) {
      if (!addDisabled) target = addRef.current ?? target
      // Said now, not when the row left: until the dialog is gone the page behind it is hidden
      // from assistive technology, and a change inside a hidden region is not announced.
      setStatus(REMOVED)
      setStatusTick((tick) => tick + 1)
    } else {
      target = removeButtons.current.get(removal?.passkey.id ?? '') ?? target
    }
    target?.focus()
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
            <span
              key={statusTick}
              className={status.quiet ? 'sr-only' : undefined}
            >
              {t(status.key)}
            </span>
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
                registerRemoveButton={(element) => {
                  if (element === null) removeButtons.current.delete(passkey.id)
                  else removeButtons.current.set(passkey.id, element)
                }}
                onStartRename={() => {
                  startRename(passkey.id)
                }}
                onStartRemove={() => {
                  startRemove(passkey)
                }}
                onSubmitName={(value, viaKey) => {
                  void submitName(passkey.id, value, viaKey)
                }}
                onCancelRename={(viaKey) => {
                  closeRename(passkey.id, viaKey)
                }}
                signInRef={signInRef}
                onSignOutFailed={() => {
                  setRename((previous) =>
                    previous?.id === passkey.id
                      ? { ...previous, error: SIGN_OUT_FAILED }
                      : previous,
                  )
                  setStatus({
                    ...SIGN_OUT_FAILED,
                    signInAgain: false,
                    quiet: true,
                  })
                  setStatusTick((tick) => tick + 1)
                  setFocusTarget('signIn')
                }}
              />
            ))}
          </ul>
        ) : null}
      </section>

      {removal === null || list.status !== 'ready' ? null : (
        <PasskeyDeleteDialog
          key={removal.serial}
          passkey={removal.passkey}
          displayName={displayNameOf(removal.passkey, i18n)}
          open={removal.open}
          requiresPassword={list.requiresPassword}
          onOpenChange={(open) => {
            if (!open) cancelRemove()
          }}
          onRemoved={() => {
            passkeyRemoved(removal.passkey.id)
          }}
          onCloseAutoFocus={returnFocusAfterRemove}
        />
      )}
    </div>
  )
}
