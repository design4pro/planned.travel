import { Moon, MonitorSmartphone, Sun } from 'lucide-react'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { useTheme } from '#/lib/theme'
import { IconButton } from './kit'
import {
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from './menu'

import type { MessageKey } from '#/lib/i18n'
import type { ThemeMode } from '#/lib/theme'

/**
 * Message keys rather than sentences: a module-scope array cannot call a hook,
 * and a literal checked against `MessageKey` fails to compile when it is wrong.
 */
const OPTIONS: ReadonlyArray<{
  value: ThemeMode
  label: MessageKey
  /** How the choice is spoken inside the trigger's accessible name. */
  state: MessageKey
  icon: typeof Sun
}> = [
  {
    value: 'light',
    label: 'shell.theme.light',
    state: 'shell.theme.state.light',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'shell.theme.dark',
    state: 'shell.theme.state.dark',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'shell.theme.system',
    state: 'shell.theme.state.system',
    icon: MonitorSmartphone,
  },
]

function isThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Sun and moon are stacked and cross-faded rather than swapped, so the glyph
 * never pops the button's width and the transition survives a fast double tap.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, resolved, setMode } = useTheme()
  const t = useTranslate()
  const dark = resolved === 'dark'
  const current = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[0]

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton
          className={className}
          aria-label={t('shell.theme.trigger', { state: t(current.state) })}
        >
          <span className="relative grid size-[18px] place-items-center">
            <Sun
              aria-hidden
              data-motion-transform
              className={cn(
                'absolute size-[18px] transition-[opacity,transform] duration-base ease-out-quint',
                dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100',
              )}
            />
            <Moon
              aria-hidden
              data-motion-transform
              className={cn(
                'absolute size-[18px] transition-[opacity,transform] duration-base ease-out-quint',
                dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0',
              )}
            />
          </span>
        </IconButton>
      </MenuTrigger>

      <MenuContent className="min-w-48">
        <MenuLabel>{t('shell.theme.label')}</MenuLabel>
        <MenuRadioGroup
          value={mode}
          onValueChange={(next) => {
            if (isThemeMode(next)) setMode(next)
          }}
        >
          {OPTIONS.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              <option.icon aria-hidden className="size-4 text-ink-4" />
              {t(option.label)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  )
}
