import { Toaster } from 'sonner'
import { useTheme } from '#/lib/theme'

import type { CSSProperties } from 'react'

/**
 * Sonner, repainted with our tokens through its own CSS custom properties —
 * no `!important` fight with the library's stylesheet, and it follows the theme
 * switch live because every value is a `var()`, not a resolved colour.
 */
const TOKEN_VARS = {
  '--normal-bg': 'var(--color-surface)',
  '--normal-border': 'var(--color-edge)',
  '--normal-text': 'var(--color-ink)',
  '--success-bg': 'var(--color-success-soft)',
  '--success-border': 'var(--color-success)',
  '--success-text': 'var(--color-success)',
  '--error-bg': 'var(--color-danger-soft)',
  '--error-border': 'var(--color-danger)',
  '--error-text': 'var(--color-danger)',
  '--warning-bg': 'var(--color-warning-soft)',
  '--warning-border': 'var(--color-warning)',
  '--warning-text': 'var(--color-warning)',
  '--info-bg': 'var(--color-info-soft)',
  '--info-border': 'var(--color-info)',
  '--info-text': 'var(--color-info)',
  '--border-radius': 'var(--radius-md)',
  fontFamily: 'var(--font-ui)',
} as CSSProperties

export function AppToaster() {
  const { resolved } = useTheme()

  return (
    <Toaster
      theme={resolved}
      position="bottom-center"
      // Clear the mobile tab bar so a toast never covers the navigation.
      offset="calc(var(--safe-bottom) + 5.5rem)"
      mobileOffset="calc(var(--safe-bottom) + 5.25rem)"
      gap={10}
      visibleToasts={4}
      style={TOKEN_VARS}
      toastOptions={{
        classNames: {
          title: 'text-label! font-semibold!',
          description: 'text-caption! opacity-80!',
          actionButton: 'rounded-full! font-semibold!',
          cancelButton: 'rounded-full! font-medium!',
        },
      }}
    />
  )
}
