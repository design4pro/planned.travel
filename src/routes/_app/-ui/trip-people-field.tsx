/**
 * The people a new trip starts with: a multi-select over the workspace and a role for each pick.
 *
 * **Fetched when the field mounts, which is when the dialog opens.** The dialog's content is not
 * mounted while it is shut, so the roster is read once per opening and by no loader: the trips
 * index and the app shell never carry it.
 *
 * **Four states, none of them blank.** Loading is three skeleton rows announced once; a failed read
 * says so and leaves the trip creatable, since the People screen adds people later; a workspace with
 * nobody else is told so, with a pointer at invitations only for the roles that can send one; and
 * the picker itself. Owner is never offered: the creator is the trip's owner already.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

import {
  Avatar,
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

function useRoster(): RosterState {
  const [state, setState] = useState<RosterState>({ status: 'loading' })

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
  }, [])

  return state
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
  const roster = useRoster()

  if (roster.status === 'loading') {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-medium text-ink-2">
          {t('shell.newTrip.people')}
        </span>
        <div
          role="status"
          aria-busy="true"
          aria-label={t('shell.newTrip.peopleLoading')}
          className="flex flex-col gap-2"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-9" />
          ))}
        </div>
      </div>
    )
  }

  if (roster.status === 'failed') {
    return (
      <Field label={t('shell.newTrip.people')}>
        <p className="text-caption text-ink-3">
          {t('shell.newTrip.peopleLoadError')}
        </p>
      </Field>
    )
  }

  if (roster.people.length === 0) {
    return (
      <Field label={t('shell.newTrip.people')}>
        <div className="flex flex-col gap-1 text-caption text-ink-3">
          <p>{t('shell.newTrip.peopleNone')}</p>
          {canInvite ? (
            <Link
              to="/settings/organization"
              className="w-fit rounded-sm font-medium text-brand underline decoration-brand/30 underline-offset-4 focus-ring hover:decoration-brand"
            >
              {t('shell.newTrip.peopleInvite')}
            </Link>
          ) : (
            <p>{t('shell.newTrip.peopleNoneMember')}</p>
          )}
        </div>
      </Field>
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
            <li key={person.userId} className="flex min-w-0 items-center gap-3">
              <Avatar
                src={
                  people.find((entry) => entry.userId === person.userId)
                    ?.image ?? null
                }
                name={person.name}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate text-label font-medium text-ink">
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
