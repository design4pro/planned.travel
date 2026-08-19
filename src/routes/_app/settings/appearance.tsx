import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Laptop, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorPanel } from '#/components/layout/error-state'
import { Card, Field, SimpleSelect, Skeleton, Switch } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTheme } from '#/lib/theme'
import { loadAppearance, saveAppearance } from '../-server/settings'
import { SettingsRow, SettingsSection } from '../-ui/settings-nav'

import type { ThemeMode } from '#/lib/theme'
import type { LucideIcon } from 'lucide-react'

const THEMES: ReadonlyArray<{
  mode: ThemeMode
  label: string
  hint: string
  icon: LucideIcon
  swatch: string
}> = [
  {
    mode: 'light',
    label: 'Light',
    hint: 'Warm paper, all day',
    icon: Sun,
    swatch: 'bg-canvas',
  },
  {
    mode: 'dark',
    label: 'Dark',
    hint: 'Warm charcoal, never black',
    icon: Moon,
    swatch: 'bg-inverse',
  },
  {
    mode: 'system',
    label: 'System',
    hint: 'Follow the device',
    icon: Laptop,
    swatch: 'bg-linear-to-br from-canvas to-inverse',
  },
]

const MAP_STYLES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'workspace', label: 'Follow the workspace' },
  { value: 'planned-light', label: 'Paper — light' },
  { value: 'planned-dark', label: 'Charcoal — dark' },
]

export const Route = createFileRoute('/_app/settings/appearance')({
  loader: () => loadAppearance(),
  pendingComponent: AppearancePending,
  errorComponent: ({ error }) => (
    <ErrorPanel error={error} title="Appearance did not load" />
  ),
  component: AppearancePage,
})

function AppearancePage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const theme = useTheme()

  const [reduceMotion, setReduceMotion] = useState(data.reduceMotion)
  const [mapStyle, setMapStyle] = useState(
    data.mapStyle === data.workspaceMapStyle ? 'workspace' : data.mapStyle,
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
      toast.error('Could not save that', {
        description: 'The change is applied here but was not stored.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Theme"
        description="Both themes are designed, not inverted. Pick the one you read most comfortably."
      >
        <fieldset>
          <legend className="sr-only">Theme</legend>
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
                    'flex flex-col gap-3 rounded-lg border p-4 text-left focus-ring',
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
                      {option.label}
                    </span>
                    <span className="block text-caption text-ink-3">
                      {option.hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
        <p className="mt-4 text-caption text-ink-3">
          Currently showing the {theme.resolved} palette
          {theme.mode === 'system' ? ', following your device' : ''}.
        </p>
      </SettingsSection>

      <SettingsSection title="Motion and maps">
        <div className="flex flex-col">
          <SettingsRow
            label="Reduce motion"
            hint="Collapses entrance animations to a simple fade. Your operating system's own reduce-motion setting is always respected as well."
            control={
              <div className="flex sm:justify-end">
                <Switch
                  checked={reduceMotion}
                  disabled={busy}
                  aria-label="Reduce motion"
                  onCheckedChange={(next) => {
                    setReduceMotion(next)
                    void persist({ reduceMotion: next })
                  }}
                />
              </div>
            }
          />
          <SettingsRow
            label="Map style"
            hint="The basemap used on the planner and the atlas."
            control={
              <Field>
                <SimpleSelect
                  options={MAP_STYLES.map((option) => ({ ...option }))}
                  value={mapStyle}
                  disabled={busy}
                  onValueChange={(next) => {
                    setMapStyle(next)
                    void persist({
                      mapStyle:
                        next === 'workspace' ? data.workspaceMapStyle : next,
                    })
                  }}
                  ariaLabel="Map style"
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
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
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
