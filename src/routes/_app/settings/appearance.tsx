import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Laptop, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'

import { Card, Skeleton, Switch } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { useTheme } from '#/lib/theme'
import { loadAppearance, saveAppearance } from '../-server/settings'
import { BasemapPicker } from '../-ui/basemap-picker'
import { SettingsRow, SettingsSection } from '../-ui/settings-nav'
import { RouteError } from './-ui/route-error'

import type { MessageKey } from '#/lib/i18n'
import type { ThemeMode } from '#/lib/theme'
import type { LucideIcon } from 'lucide-react'

/**
 * The three theme cards carry message keys rather than sentences, for the same
 * reason the settings index does: a module-scope array cannot be translated, and
 * a literal key checked against `MessageKey` fails to compile if it is wrong.
 */
/**
 * The map row's hint is written outside the group, so the group has to point at
 * it: a screen reader entering the cards would otherwise hear the label and none
 * of the sentence a sighted reader gets above them.
 */
const MAP_HINT_ID = 'basemap-picker-hint'

const THEMES: ReadonlyArray<{
  mode: ThemeMode
  label: MessageKey
  hint: MessageKey
  icon: LucideIcon
  swatch: string
}> = [
  {
    mode: 'light',
    label: 'settings.appearance.theme.light',
    hint: 'settings.appearance.theme.lightHint',
    icon: Sun,
    swatch: 'bg-canvas',
  },
  {
    mode: 'dark',
    label: 'settings.appearance.theme.dark',
    hint: 'settings.appearance.theme.darkHint',
    icon: Moon,
    swatch: 'bg-inverse',
  },
  {
    mode: 'system',
    label: 'settings.appearance.theme.system',
    hint: 'settings.appearance.theme.systemHint',
    icon: Laptop,
    swatch: 'bg-linear-to-br from-canvas to-inverse',
  },
]

export const Route = createFileRoute('/_app/settings/appearance')({
  loader: () => loadAppearance(),
  pendingComponent: AppearancePending,
  errorComponent: AppearanceError,
  component: AppearancePage,
})

function AppearanceError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <RouteError error={error} title={t('settings.appearance.error')} />
}

function AppearancePage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const theme = useTheme()
  const t = useTranslate()

  const [reduceMotion, setReduceMotion] = useState(data.reduceMotion)
  const [maskCodes, setMaskCodes] = useState(data.maskConfirmationCodes)
  /*
   * The raw override, not the merged value: `''` here means "follow the
   * workspace" and is the same sentinel the write path clears the column with.
   * This used to be derived by comparing the merged value to the workspace
   * value, which reported "you follow the workspace" to anyone who had
   * deliberately picked the entry the workspace happens to be on.
   */
  const [mapStyle, setMapStyle] = useState(data.mapStyleOverride ?? '')
  const [busy, setBusy] = useState(false)

  /** Answers whether the column moved, so an optimistic control can put itself back. */
  async function persist(
    patch: Parameters<typeof saveAppearance>[0]['data'],
  ): Promise<boolean> {
    setBusy(true)
    try {
      await saveAppearance({ data: patch })
      await router.invalidate()
      return true
    } catch {
      toast.error(t('settings.appearance.saveFailed'), {
        description: t('settings.appearance.saveFailedBody'),
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  const palette =
    theme.resolved === 'dark'
      ? t('settings.appearance.palette.dark')
      : t('settings.appearance.palette.light')

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title={t('settings.appearance.theme.title')}
        description={t('settings.appearance.theme.description')}
      >
        <fieldset>
          <legend className="sr-only">
            {t('settings.appearance.theme.title')}
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map((option) => {
              const active = theme.mode === option.mode
              return (
                <button
                  key={option.mode}
                  type="button"
                  aria-pressed={active}
                  disabled={busy}
                  onClick={() => {
                    theme.setMode(option.mode)
                    void persist({ theme: option.mode })
                  }}
                  className={cn(
                    'flex flex-col gap-3 rounded-lg border p-4 text-start focus-ring',
                    'transition-[background-color,border-color,box-shadow] duration-base ease-out-quint',
                    'disabled:pointer-events-none disabled:opacity-60',
                    active
                      ? 'border-brand bg-brand-subtle shadow-card'
                      : 'border-edge bg-surface hover:border-edge-strong hover:bg-surface-2',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-14 items-end justify-end rounded-md border border-edge-faint p-2',
                      option.swatch,
                    )}
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-surface text-ink-3 shadow-card">
                      <option.icon className="size-3.5" />
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-label font-semibold',
                        active ? 'text-brand' : 'text-ink',
                      )}
                    >
                      {t(option.label)}
                    </span>
                    <span className="block text-caption text-ink-3">
                      {t(option.hint)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
        <p className="mt-4 text-caption text-ink-3">
          {theme.mode === 'system'
            ? t('settings.appearance.theme.showingSystem', { palette })
            : t('settings.appearance.theme.showing', { palette })}
        </p>
      </SettingsSection>

      <SettingsSection title={t('settings.appearance.motion.title')}>
        <div className="flex flex-col">
          <SettingsRow
            label={t('settings.appearance.motion.label')}
            hint={t('settings.appearance.motion.hint')}
            control={
              <div className="flex sm:justify-end">
                <Switch
                  checked={reduceMotion}
                  disabled={busy}
                  aria-label={t('settings.appearance.motion.label')}
                  onCheckedChange={(next) => {
                    setReduceMotion(next)
                    void persist({ reduceMotion: next })
                  }}
                />
              </div>
            }
          />
          {/*
            Deliberately not a `SettingsRow`: that row clamps its control to
            `sm:w-64`, which is the right width for a switch or a select and far
            too narrow for a five-card grid. The label and hint keep the row's
            own type scale and vertical rhythm, and the grid takes the section's
            full width beneath them.
          */}
          <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-label font-medium text-ink">
                {t('settings.appearance.map.label')}
              </p>
              <p
                id={MAP_HINT_ID}
                className="mt-0.5 text-caption leading-relaxed text-ink-3"
              >
                {t('settings.appearance.map.hint')}
              </p>
            </div>
            <BasemapPicker
              value={mapStyle}
              busy={busy}
              describedBy={MAP_HINT_ID}
              onValueChange={(next) => {
                const previous = mapStyle
                setMapStyle(next)
                void persist({ mapStyle: next }).then((saved) => {
                  // The card must not keep showing a pick the write refused: the
                  // toast says the save failed, and the group says what is stored.
                  if (!saved) setMapStyle(previous)
                })
              }}
            />
          </div>
        </div>
      </SettingsSection>

      {/*
        A privacy switch and not a motion one, so it gets its own section rather
        than being filed under “Motion and maps”. Additive: the reduce-motion row
        above is the idiom it follows — local state moves first, the write
        follows, and a refused write leaves the switch where the reader put it
        with the toast saying so, never snapping back under their hand.
      */}
      <SettingsSection title={t('settings.appearance.privacy.title')}>
        <div className="flex flex-col">
          <SettingsRow
            label={t('settings.appearance.privacy.codesLabel')}
            hint={t('settings.appearance.privacy.codesHint')}
            control={
              <div className="flex sm:justify-end">
                <Switch
                  data-part="mask-confirmation-codes"
                  checked={maskCodes}
                  disabled={busy}
                  aria-label={t('settings.appearance.privacy.codesLabel')}
                  onCheckedChange={(next) => {
                    setMaskCodes(next)
                    void persist({ maskConfirmationCodes: next })
                  }}
                />
              </div>
            }
          />
        </div>
      </SettingsSection>
    </div>
  )
}

function AppearancePending() {
  const t = useTranslate()
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('ui.status.loading')}</span>
      <Card className="space-y-4">
        <Skeleton className="h-4 w-24" radius="sm" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28" radius="lg" />
          ))}
        </div>
      </Card>
      <Card className="space-y-4">
        <Skeleton className="h-4 w-32" radius="sm" />
        {/* Five tiles on the picker's own grid, so the section does not jump
            when the loader resolves. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-22" radius="lg" />
          ))}
        </div>
      </Card>
    </div>
  )
}
