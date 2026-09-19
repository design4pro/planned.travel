/**
 * The rail's add control, and what a place write's failure says.
 *
 * The pill is the one `plan-screen.tsx` used to build inline; it lives here so the
 * ways of adding a place — the plain form, placing it on the map, and the menu
 * entries later stages add — are entries in one menu rather than edits to the screen.
 */

import { ChevronDown, Crosshair, Plus } from 'lucide-react'

import { readPublicFailure } from '#/lib/errors'
import { useTranslate } from '#/lib/i18n'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '#/components/ui'

import type * as React from 'react'

interface AddPlaceOption {
  /** Published as `data-value`, so a journey can address one entry of the menu. */
  readonly value: string
  readonly label: string
  readonly icon: React.ReactNode
  readonly disabled: boolean
  readonly onSelect: () => void
}

export interface PlannerAddPlaceProps {
  /** Opens the empty place form. */
  readonly onCreate: () => void
  /** Arms a drop on the map. Absent, the menu does not offer it. */
  readonly onArmMap?: () => void
  /** False until the map instance exists, which is when a drop can land. */
  readonly mapReady?: boolean
}

export function PlannerAddPlace({
  onCreate,
  onArmMap,
  mapReady = false,
}: PlannerAddPlaceProps) {
  const t = useTranslate()

  const options: Array<AddPlaceOption> = []
  if (onArmMap !== undefined) {
    options.push({
      value: 'map',
      label: t('trips.plan.addPlace.option.map'),
      icon: <Crosshair />,
      disabled: !mapReady,
      onSelect: onArmMap,
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        data-part="add-place"
        variant="primary"
        shape="pill"
        size="sm"
        block
        icon={<Plus strokeWidth={2.5} />}
        onClick={onCreate}
        className="min-w-0 flex-1"
      >
        {t('trips.plan.addPlace.label')}
      </Button>

      {/* An empty menu is never shown: the trigger exists only once there is
          something in it to choose. */}
      {options.length === 0 ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              data-part="add-place-menu"
              icon={<ChevronDown />}
              label={t('trips.plan.addPlace.more')}
              size="sm"
              variant="ghost"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                data-part="add-place-option"
                data-value={option.value}
                icon={option.icon}
                disabled={option.disabled}
                onSelect={option.onSelect}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/**
 * The sentence a failed plan write puts in its form.
 *
 * A server function's failure reaches the browser as the redaction envelope
 * (`src/lib/errors.ts`), never as the thrown class: a refusal or a validation
 * message is shown as written, and anything else — a diagnostic the server withheld,
 * or a request that never arrived — is the caller's own fallback.
 */
export function placeWriteMessage(cause: unknown, fallback: string): string {
  const failure = readPublicFailure(cause)
  return failure.message ?? fallback
}
