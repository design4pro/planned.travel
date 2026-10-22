/**
 * Creating a trip.
 *
 * The only write on the trip index, and the one that makes the whole product
 * reachable, so it lives beside the screen that needs it rather than in a
 * feature module of its own.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useRouteContext, useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui'
import { messageOf } from '#/components/modules/shared'
import { useTranslate } from '#/lib/i18n'
import { createTripFn } from '../-server/trip-lifecycle'
import { attachCover } from './trip-cover-upload'
import {
  DEFAULT_REMINDER_DAYS,
  TripFormFields,
  tripFormPayload,
  useTripForm,
} from './trip-form'
import { addPeople } from './trip-people-add'
import { TripPeopleField } from './trip-people-field'

import type { ChosenPerson, NotAdded, NotAddedReason } from './trip-people-add'

/**
 * What did not land once the trip exists. The form is never shown again from here: a second submit
 * would create a second trip, so the only moves left are to retry the cover or to go on.
 */
interface TripNotice {
  tripId: string
  /** Who was not added, and why; empty when only the cover failed. */
  people: Array<NotAdded>
  /** The cover that did not land, or `null` when it did or none was chosen. */
  cover: {
    filename: string
    uploadedFileId: string | null
    reason: string | null
  } | null
}

const NOT_ADDED_COPY = {
  'not-in-workspace': 'shell.newTrip.peopleNotInWorkspace',
  'already-on-trip': 'shell.newTrip.peopleAlreadyOn',
  unconfirmed: 'shell.newTrip.peopleUnconfirmed',
} as const satisfies Record<NotAddedReason, string>

export interface NewTripDialogProps {
  /** The workspace default currency, pre-selected for a new trip. */
  defaultCurrency?: string
  /** Blocks the trigger when the plan has no room for another trip. */
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function NewTripDialog({
  defaultCurrency = 'EUR',
  disabled = false,
  size = 'sm',
}: NewTripDialogProps) {
  const t = useTranslate()
  const router = useRouter()
  const navigate = useNavigate()
  // Only a workspace owner or admin can send an invitation, so only they are pointed at them.
  const { shell } = useRouteContext({ from: '/_app' })

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverProgress, setCoverProgress] = useState<number | null>(null)
  const [people, setPeople] = useState<Array<ChosenPerson>>([])
  const [notice, setNotice] = useState<TripNotice | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  // The form is replaced by the notice, so focus would otherwise fall to the dialog root.
  useEffect(() => {
    if (notice !== null) {
      noticeRef.current?.focus()
    }
  }, [notice])
  const form = useTripForm(
    {
      title: '',
      summary: '',
      destination: '',
      startDate: '',
      endDate: '',
      duration: '',
      currency: defaultCurrency,
      reminderDays: DEFAULT_REMINDER_DAYS,
    },
    saving,
  )

  function reset(): void {
    form.reset()
    setError(null)
    setPeople([])
    setNotice(null)
    setCoverProgress(null)
  }

  /** Opens the trip: its plan, or its People screen when somebody still has to be added there. */
  async function finish(tripId: string, toPeople = false): Promise<void> {
    await router.invalidate()
    setOpen(false)
    reset()
    toast.success(t('shell.newTrip.created'), {
      description: t('shell.newTrip.createdBody'),
    })
    await navigate(
      toPeople
        ? { to: '/trips/$tripId/people', params: { tripId } }
        : { to: '/trips/$tripId/plan', params: { tripId } },
    )
  }

  /** Ends the dialog, or keeps it open on one notice when anything did not land. */
  async function conclude(next: TripNotice): Promise<void> {
    if (next.cover === null && next.people.length === 0) {
      await finish(next.tripId)
      return
    }
    setNotice(next)
  }

  /**
   * Puts the chosen image on a trip that exists. A failure never undoes the trip: it is kept and the
   * reader is offered the way on without a cover.
   */
  async function addCover(
    tripId: string,
    file: File,
    uploadedFileId: string | null,
    notAdded: Array<NotAdded>,
  ): Promise<void> {
    setCoverProgress(0)
    const attached = await attachCover({
      tripId,
      file,
      uploadedFileId,
      onProgress: setCoverProgress,
    })
    setCoverProgress(null)
    if (attached.ok) {
      await conclude({ tripId, people: notAdded, cover: null })
      return
    }
    setNotice({
      tripId,
      people: notAdded,
      cover: {
        filename: attached.filename,
        uploadedFileId: attached.uploadedFileId,
        reason: attached.reason,
      },
    })
  }

  function noticeTitle({ cover, people: notAdded }: TripNotice): string {
    if (cover === null) {
      return t('shell.newTrip.peopleFailedTitle')
    }
    return notAdded.length === 0
      ? t('shell.newTrip.coverFailedTitle')
      : t('shell.newTrip.noticeBothTitle')
  }

  async function submit(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const { tripId } = await createTripFn({
        data: tripFormPayload(form, { creating: true, owner: true }),
      })
      // Never throws: a person who cannot be added must not reach the create-failure path below.
      const notAdded = await addPeople(tripId, people)
      if (form.cover === null) {
        await conclude({ tripId, people: notAdded, cover: null })
      } else {
        await addCover(tripId, form.cover, null, notAdded)
      }
    } catch (cause) {
      setError(messageOf(cause, t('shell.newTrip.error')))
    } finally {
      setSaving(false)
    }
  }

  async function retryCover(): Promise<void> {
    if (notice === null || notice.cover === null || form.cover === null) {
      return
    }
    setSaving(true)
    try {
      await addCover(
        notice.tripId,
        form.cover,
        notice.cover.uploadedFileId,
        notice.people,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A save in flight owns the dialog: closing it would wipe the form the answer is for.
        if (saving) return
        setOpen(next)
        if (!next) {
          // The trip exists even when something did not land; the list has to show it.
          if (notice !== null) {
            void router.invalidate()
          }
          reset()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="primary"
          shape="pill"
          size={size}
          disabled={disabled}
          icon={<Plus aria-hidden strokeWidth={2.5} />}
        >
          {t('shell.nav.newTrip')}
        </Button>
      </DialogTrigger>

      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('shell.newTrip.title')}</DialogTitle>
          <DialogDescription>
            {t('shell.newTrip.description')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id="new-trip-form"
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (form.canSave) {
                void submit()
              }
            }}
          >
            {error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {error}
              </Alert>
            )}

            {notice === null ? (
              <>
                <TripFormFields
                  form={form}
                  placeholders
                  coverProgress={coverProgress}
                />
                <fieldset disabled={form.saving} className="contents">
                  <TripPeopleField
                    value={people}
                    onChange={setPeople}
                    canInvite={shell.role !== 'member'}
                  />
                </fieldset>
              </>
            ) : (
              <div ref={noticeRef} tabIndex={-1} className="outline-none">
                <Alert tone="warning" title={noticeTitle(notice)}>
                  {notice.cover === null ? null : (
                    <>
                      {t('shell.newTrip.coverFailed', {
                        name: notice.cover.filename,
                      })}
                      {notice.cover.reason === null ? null : (
                        <span className="mt-1 block break-words">
                          {notice.cover.reason}
                        </span>
                      )}
                    </>
                  )}
                  {notice.people.length === 0 ? null : (
                    <ul className="mt-1 flex flex-col gap-1">
                      {notice.people.map((person) => (
                        <li key={person.userId} className="break-words">
                          {t(NOT_ADDED_COPY[person.reason], {
                            name: person.name,
                          })}
                        </li>
                      ))}
                    </ul>
                  )}
                </Alert>
              </div>
            )}
          </form>
        </DialogBody>

        {notice === null ? (
          <DialogFooter key="create">
            <Button
              type="button"
              variant="ghost"
              shape="pill"
              disabled={saving}
              onClick={() => {
                setOpen(false)
              }}
            >
              {t('modules.action.cancel')}
            </Button>
            <Button
              type="submit"
              form="new-trip-form"
              variant="primary"
              shape="pill"
              disabled={!form.canSave}
              loading={saving}
              loadingLabel={t('shell.newTrip.creating')}
            >
              {t('shell.newTrip.submit')}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter key="notice">
            {notice.cover === null ? null : (
              <Button
                type="button"
                variant="ghost"
                shape="pill"
                disabled={saving}
                loading={saving}
                loadingLabel={t('shell.newTrip.coverUploading')}
                onClick={() => {
                  void retryCover()
                }}
              >
                {/* Beside a list of people the plain label would read as retrying them too. */}
                {notice.people.length === 0
                  ? t('shell.newTrip.coverRetry')
                  : t('shell.newTrip.coverRetryOnly')}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              shape="pill"
              disabled={saving}
              onClick={() => {
                setSaving(true)
                void finish(notice.tripId, notice.people.length > 0).finally(
                  () => {
                    setSaving(false)
                  },
                )
              }}
            >
              {notice.people.length === 0
                ? t('shell.newTrip.coverContinue')
                : t('shell.newTrip.peopleContinue')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
