/**
 * The people a new trip starts with: a multi-select over the workspace and a role for each pick.
 *
 * **Fetched when the field mounts, which is when the dialog opens.** The dialog's content is not
 * mounted while it is shut, so the roster is read once per opening and by no loader: the trips
 * index and the app shell never carry it.
 *
 * **Four states, none of them blank.** Loading is three skeleton rows; a failed read says so, offers
 * a retry and leaves the trip creatable, since the People screen adds people later; a workspace with
 * nobody else is told so, with a pointer at invitations only for the roles that can send one; and
 * the picker itself. The first three share one live region that stays mounted across them, so the
 * outcome of the read is announced when it arrives. Owner is never offered: the creator is the
 * trip's owner already.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

import {
  Avatar,
  Button,
  Field,
  MultiCombobox,
  SimpleSelect,
  Skeleton,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { loadWorkspaceRoster } from '../-server/roster'

import type { ComboboxOption } from '#/components/ui'
import type { RosterPerson } from '../-server/roster'
import type { ChosenPerson, StartingRole } from './trip-people-add'

type RosterState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly people: Array<RosterPerson> }
  | { readonly status: 'failed' }

const SKELETON_ROWS = 3
const ROLE_COPY = {
  editor: 'trips.people.role.editor',
  viewer: 'trips.people.role.viewer',
} as const satisfies Record<StartingRole, string>
const STARTING_ROLES: ReadonlyArray<StartingRole> = ['editor', 'viewer']

function useRoster(): [RosterState, () => void] {
  const [state, setState] = useState<RosterState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    loadWorkspaceRoster().then(
      (people) => {
        if (current) setState({ status: 'ready', people })
      },
      () => {
        if (current) setState({ status: 'failed' })
      },
    )
    return () => {
      current = false
    }
  }, [attempt])

  function retry(): void {
    setState({ status: 'loading' })
    setAttempt((count) => count + 1)
  }

  return [state, retry]
}

export interface TripPeopleFieldProps {
  value: ReadonlyArray<ChosenPerson>
  onChange: (next: Array<ChosenPerson>) => void
  /** Whether the reader may send a workspace invitation, so the empty state may link to them. */
  canInvite: boolean
}

export function TripPeopleField({
  value,
  onChange,
  canInvite,
}: TripPeopleFieldProps) {
  const t = useTranslate()
  const [roster, retry] = useRoster()

  if (roster.status !== 'ready' || roster.people.length === 0) {
    const loading = roster.status === 'loading'
    const failed = roster.status === 'failed'
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-ink-2">
          {t('shell.newTrip.people')}
        </span>
        <div
          role="status"
          aria-busy={loading || undefined}
          aria-label={loading ? t('shell.newTrip.peopleLoading') : undefined}
          className="flex flex-col gap-2 text-caption text-ink-3"
        >
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <Skeleton key={index} className="h-9" />
              ))
            : null}
          {failed ? <p>{t('shell.newTrip.peopleLoadError')}</p> : null}
          {!loading && !failed ? <p>{t('shell.newTrip.peopleNone')}</p> : null}
          {!loading && !failed && !canInvite ? (
            <p>{t('shell.newTrip.peopleNoneMember')}</p>
          ) : null}
        </div>
        {failed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="pill"
            className="w-fit"
            onClick={retry}
          >
            {t('shell.newTrip.peopleRetry')}
          </Button>
        ) : null}
        {!loading && !failed && canInvite ? (
          // A new tab: the form being filled in is on this page and a same-tab visit would drop it.
          <Link
            to="/settings/organization"
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit rounded-sm text-caption font-medium text-brand underline decoration-brand/30 underline-offset-4 focus-ring hover:decoration-brand"
          >
            {t('shell.newTrip.peopleInvite')}
          </Link>
        ) : null}
      </div>
    )
  }

  return <Picker people={roster.people} value={value} onChange={onChange} />
}

function Picker({
  people,
  value,
  onChange,
}: {
  people: Array<RosterPerson>
  value: ReadonlyArray<ChosenPerson>
  onChange: (next: Array<ChosenPerson>) => void
}) {
  const t = useTranslate()

  // The dialog keeps its draft when it is cancelled, and the roster is read again on every opening:
  // a pick for somebody who has since left the workspace would be a row the picker cannot show.
  useEffect(() => {
    const listed = value.filter((person) =>
      people.some((entry) => entry.userId === person.userId),
    )
    if (listed.length !== value.length) onChange(listed)
  }, [people, value, onChange])

  const options = useMemo<Array<ComboboxOption>>(
    () =>
      people.map((person) => ({ value: person.userId, label: person.name })),
    [people],
  )
  const roleOptions = STARTING_ROLES.map((role) => ({
    value: role,
    label: t(ROLE_COPY[role]),
  }))

  function pick(ids: Array<string>): void {
    onChange(
      ids.flatMap((id) => {
        const kept = value.find((person) => person.userId === id)
        const listed = people.find((person) => person.userId === id)
        if (kept !== undefined) return [kept]
        return listed === undefined
          ? []
          : [{ userId: id, name: listed.name, role: 'editor' as const }]
      }),
    )
  }

  function setRole(userId: string, role: StartingRole): void {
    onChange(
      value.map((person) =>
        person.userId === userId ? { ...person, role } : person,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={t('shell.newTrip.people')}
        hint={t('shell.newTrip.peopleHint')}
      >
        <MultiCombobox
          options={options}
          value={value.map((person) => person.userId)}
          onChange={pick}
          placeholder={t('shell.newTrip.peoplePlaceholder')}
          searchPlaceholder={t('shell.newTrip.peopleSearch')}
          ariaLabel={t('shell.newTrip.people')}
        />
      </Field>

      {value.length === 0 ? null : (
        <ul
          aria-label={t('shell.newTrip.peopleChosen')}
          className="flex flex-col gap-2"
        >
          {value.map((person) => (
            <li
              key={person.userId}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2"
            >
              {/* Decorative here: the name beside it already names the row. */}
              <span aria-hidden="true" className="inline-flex shrink-0">
                <Avatar
                  src={
                    people.find((entry) => entry.userId === person.userId)
                      ?.image ?? null
                  }
                  name={person.name}
                  size="sm"
                />
              </span>
              <span className="min-w-0 flex-1 basis-32 truncate text-label font-medium text-ink">
                {person.name}
              </span>
              <SimpleSelect
                size="sm"
                className="w-36 shrink-0"
                options={roleOptions}
                value={person.role}
                onValueChange={(next) =>
                  setRole(
                    person.userId,
                    next === 'viewer' ? 'viewer' : 'editor',
                  )
                }
                ariaLabel={[t('trips.people.role.label'), person.name].join(
                  ' · ',
                )}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
