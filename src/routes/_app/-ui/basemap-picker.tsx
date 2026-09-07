/**
 * The basemap picker on `/settings/appearance`.
 *
 * Five cartographies read better opened than closed, so this is a radio set and
 * not a select: the ground each entry paints is the whole reason to pick it, and
 * a closed list can only say the word "Charcoal". It composes `RadioGroup` and
 * `RadioCard` and defines no selection control of its own — Radix supplies the
 * roving tabindex, so the group is one tab stop and arrow keys move and select.
 *
 * The order and the ids both come from `BASEMAP_IDS`, ahead of a workspace entry
 * whose `''` is the sentinel the write path reads as "clear my override" — the
 * one value that is not a basemap id, and the reason `value` is a `string` here
 * rather than a `BasemapId`.
 */

import { Building2 } from 'lucide-react'

import { RadioCard, RadioGroup } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { BASEMAP_IDS, resolveBasemap } from '#/lib/map/basemap'
import { mapPalette } from '#/lib/map/palette'
import { useTheme } from '#/lib/theme'

import type { MessageKey } from '#/lib/i18n'
import type { BasemapId } from '#/lib/map/basemap'
import type { ResolvedTheme } from '#/lib/theme'

/** Clears the member override, so the workspace value applies again. */
const FOLLOW_WORKSPACE = ''

/**
 * A module-scope table cannot hold a sentence, so it holds keys: a literal
 * checked against `MessageKey` fails to compile if it is wrong, which is the
 * idiom the theme cards on the same screen already use.
 */
const COPY: Readonly<
  Record<BasemapId, { readonly label: MessageKey; readonly hint: MessageKey }>
> = {
  auto: {
    label: 'settings.appearance.map.auto',
    hint: 'settings.appearance.map.autoHint',
  },
  'planned-light': {
    label: 'settings.appearance.map.paper',
    hint: 'settings.appearance.map.paperHint',
  },
  'planned-dark': {
    label: 'settings.appearance.map.charcoal',
    hint: 'settings.appearance.map.charcoalHint',
  },
  'planned-quiet': {
    label: 'settings.appearance.map.quiet',
    hint: 'settings.appearance.map.quietHint',
  },
}

/** The road, drawn as a casing/fill pair the way the cartography draws it. */
const ROAD = 'M0 13h20l8 9v14'

export interface BasemapPickerProps {
  /** The member's own override — `''` while they follow the workspace. */
  readonly value: string
  /** Disables the whole group while a save is in flight. */
  readonly busy?: boolean
  readonly onValueChange: (next: string) => void
}

export function BasemapPicker({
  value,
  busy = false,
  onValueChange,
}: BasemapPickerProps) {
  const t = useTranslate()
  const theme = useTheme()

  return (
    <RadioGroup
      aria-label={t('settings.appearance.map.label')}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      value={value}
      disabled={busy}
      onValueChange={onValueChange}
    >
      <RadioCard
        data-part="basemap-option"
        value={FOLLOW_WORKSPACE}
        label={t('settings.appearance.map.workspace')}
        description={t('settings.appearance.map.workspaceHint')}
        icon={<WorkspaceSwatch />}
      />
      {BASEMAP_IDS.map((id) => (
        <RadioCard
          key={id}
          data-part="basemap-option"
          value={id}
          label={t(COPY[id].label)}
          description={t(COPY[id].hint)}
          icon={<Swatch id={id} theme={theme.resolved} />}
        />
      ))}
    </RadioGroup>
  )
}

/**
 * Land, water and one road in the colours the entry actually paints, read from
 * `mapPalette()` rather than re-derived. Quiet drops the road stroke, which is
 * the tile-sized statement of "no names on this one".
 *
 * The tile is opaque over the whole `size-9` box on purpose: `RadioCard`'s icon
 * wrapper turns `bg-brand` while checked, and a swatch that let that through
 * would report the brand colour as the map's.
 */
function Swatch({ id, theme }: { id: BasemapId; theme: ResolvedTheme }) {
  const resolved = resolveBasemap(id, theme)
  const palette = mapPalette(resolved.theme)

  return (
    <span
      className="block size-9 overflow-hidden rounded-md ring-1 ring-edge-faint ring-inset"
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="block size-full">
        <rect width="36" height="36" fill={palette.earth} />
        <path
          d="M36 8c-8 4-10 14-9 28h9z"
          fill={palette.water}
          stroke={palette.waterEdge}
          strokeWidth="1"
        />
        {resolved.roadLabels ? (
          <>
            <path
              d={ROAD}
              fill="none"
              stroke={palette.road.majorCasing}
              strokeWidth="5"
            />
            <path
              d={ROAD}
              fill="none"
              stroke={palette.road.major}
              strokeWidth="3"
            />
          </>
        ) : null}
      </svg>
    </span>
  )
}

/**
 * The workspace entry has no cartography of its own to show — the picker is
 * never told which id the workspace holds — so it gets the workspace glyph on a
 * neutral tile rather than a guess. Opaque for the same reason as above.
 */
function WorkspaceSwatch() {
  return (
    <span className="grid size-9 place-items-center rounded-md bg-surface-2 text-ink-3 ring-1 ring-edge-faint ring-inset">
      <Building2 className="size-4" aria-hidden="true" />
    </span>
  )
}
