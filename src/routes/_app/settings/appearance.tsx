import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Laptop, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'

import { Card, Field, SimpleSelect, Skeleton, Switch } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { useTheme } from '#/lib/theme'
import { loadAppearance, saveAppearance } from '../-server/settings'
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

const WORKSPACE_MAP_STYLE = 'workspace'

const MAP_STYLES: ReadonlyArray<{ value: string; label: MessageKey }> = [
  { value: WORKSPACE_MAP_STYLE, label: 'settings.appearance.map.workspace' },
  { value: 'planned-light', label: 'settings.appearance.map.light' },
  { value: 'planned-dark', label: 'settings.appearance.map.dark' },
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
  const [mapStyle, setMapStyle] = useState(
    data.mapStyle === data.workspaceMapStyle
      ? WORKSPACE_MAP_STYLE
      : data.mapStyle,
  )
  const [busy, setBusy] = useState(false)

  async function persist(
    patch: Parameters<typeof saveAppearance>[0]['data'],
  ): Promise<void> {
    setBusy(true)
    try {
      await saveAppearance({ data: patch })
      await router.invalidate()
    } catch {
      toast.error(t('settings.appearance.saveFailed'), {
        description: t('settings.appearance.saveFailedBody'),
      })
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
          <SettingsRow
            label={t('settings.appearance.map.label')}
            hint={t('settings.appearance.map.hint')}
            control={
              <Field>
                <SimpleSelect
                  options={MAP_STYLES.map((option) => ({
                    value: option.value,
                    label: t(option.label),
                  }))}
                  value={mapStyle}
                  disabled={busy}
                  onValueChange={(next) => {
                    setMapStyle(next)
                    void persist({
                      mapStyle:
                        next === WORKSPACE_MAP_STYLE
                          ? data.workspaceMapStyle
                          : next,
                    })
                  }}
                  ariaLabel={t('settings.appearance.map.label')}
                />
              </Field>
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
        <Skeleton className="h-10 w-full" radius="md" />
      </Card>
    </div>
  )
}
