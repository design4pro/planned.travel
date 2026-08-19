import { Moon, MonitorSmartphone, Sun } from 'lucide-react'
import { cn } from '#/lib/cn'
import { useTheme } from '#/lib/theme'
import { IconButton } from './kit'
import { MenuContent, MenuLabel, MenuRadioItem, MenuRoot, MenuTrigger, MenuRadioGroup  } from './menu'

import type { ThemeMode } from '#/lib/theme'

const OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match system', icon: MonitorSmartphone },
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
  const dark = resolved === 'dark'

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton
          className={className}
          aria-label={`Theme: ${mode === 'system' ? 'matching system' : mode}. Change theme`}
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
        <MenuLabel>Appearance</MenuLabel>
        <MenuRadioGroup
          value={mode}
          onValueChange={(next) => {
            if (isThemeMode(next)) setMode(next)
          }}
        >
          {OPTIONS.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              <option.icon aria-hidden className="size-4 text-ink-4" />
              {option.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  )
}
