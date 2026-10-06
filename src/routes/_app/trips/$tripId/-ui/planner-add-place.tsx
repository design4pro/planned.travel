/**
 * The rail's add control, and what a place write's failure says.
 *
 * The pill is the one `plan-screen.tsx` used to build inline; it lives here so the
 * ways of adding a place — the plain form, placing it on the map, and the menu
 * entries later stages add — are entries in one menu rather than edits to the screen.
 */

import * as React from 'react'
import { ChevronDown, Crosshair, Plus } from 'lucide-react'
import { toast } from 'sonner'

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
  /**
   * Arms a drop on the map, handing over the menu trigger so cancelling can return focus to it.
   * Absent, the menu does not offer it.
   */
  readonly onArmMap?: (returnFocusTo: HTMLElement | null) => void
  /** False until the map instance exists, which is when a drop can land. */
  readonly mapReady?: boolean
}

export function PlannerAddPlace({
  onCreate,
  onArmMap,
  mapReady = false,
}: PlannerAddPlaceProps) {
  const t = useTranslate()
  const trigger = React.useRef<HTMLButtonElement>(null)
  // An option that moves focus elsewhere runs once the menu has let go of it: while open the
  // menu traps focus, and on close it hands focus back to its trigger.
  const afterClose = React.useRef<(() => void) | null>(null)

  const options: Array<AddPlaceOption> = []
  if (onArmMap !== undefined) {
    options.push({
      value: 'map',
      label: t('trips.plan.addPlace.option.map'),
      icon: <Crosshair />,
      disabled: !mapReady,
      onSelect: () => {
        afterClose.current = () => onArmMap(trigger.current)
      },
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
              ref={trigger}
              data-part="add-place-menu"
              icon={<ChevronDown />}
              label={t('trips.plan.addPlace.more')}
              size="sm"
              variant="ghost"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            onCloseAutoFocus={(event) => {
              const run = afterClose.current
              if (run === null) return
              afterClose.current = null
              event.preventDefault()
              run()
            }}
          >
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

export interface PlaceWriteFailureCopy {
  /** What any failure without a sentence of its own says. */
  readonly fallback: string
  /** The places-limit sentence, already localised. */
  readonly quota: string
  /** The toast action's label, already localised. */
  readonly seePlans: string
  /** Takes the reader to the screen where the plan can be changed. */
  readonly onSeePlans: () => void
}

/**
 * What a failed place write says, and - for a quota refusal - the way out.
 *
 * A places-limit refusal reaches the browser as an `unexpected` failure with the one constant
 * code (`src/lib/errors.ts`): it carries no sentence, so the sentence is ours and in the reader's
 * locale. It lands in the form's error slot like every other write failure, and a toast beside it
 * leads to the plans, because the form alone offers nothing to do about it. Any other failure is
 * `placeWriteMessage`, unchanged.
 */
export function reportPlaceWriteFailure(
  cause: unknown,
  copy: PlaceWriteFailureCopy,
): string {
  const failure = readPublicFailure(cause)
  if (failure.code !== 'QUOTA_EXCEEDED') {
    return placeWriteMessage(cause, copy.fallback)
  }

  toast.error(copy.quota, {
    action: { label: copy.seePlans, onClick: copy.onSeePlans },
  })
  return copy.quota
}
