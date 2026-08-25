import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

import type { ClassValue } from 'clsx'

/**
 * `tailwind-merge` does not read our stylesheet, so it has no way to know that
 * `text-label` is a font size and `text-ink-3` is a colour — it files both
 * under `text-color` and drops the earlier one. Left unconfigured,
 * `cn('text-title', 'text-ink')` silently returns just `text-ink`, and every
 * semantic type step in the product disappears.
 *
 * Registering our token names against the right class groups fixes that and,
 * at the same time, makes a caller's override genuinely win for durations,
 * easings, tracking, z-index and named animations.
 *
 * Keep this list in step with the `@theme inline` block in
 * `src/styles/styles.css`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'hero',
            'display',
            'title',
            'subtitle',
            'body',
            'label',
            'caption',
            'micro',
          ],
        },
      ],
      tracking: [{ tracking: ['label', 'wide', 'tight', 'tighter'] }],
      duration: [{ duration: ['fast', 'base', 'slow'] }],
      ease: [{ ease: ['out-quint', 'in-quint', 'drawer', 'spring'] }],
      /**
       * `map-overlay` is the lowest tier and the one most often overridden:
       * chrome floating over a full-bleed map sits under the app nav, and a
       * primitive whose default is `z-dropdown` — `GlassPanel` with
       * `floating` — has to be able to be told otherwise. Left out of this
       * list, `cn('z-dropdown', 'z-map-overlay')` kept both classes and
       * stylesheet order decided the winner.
       *
       * `impersonation` is the top of the stack, one band above `toast`
       * (`--z-impersonation: 90`) and therefore above `modal` too: docs/ACCESS.md
       * §6.1 requires that nothing can cover the control which ends a session
       * borrowed from somebody else's account. It has to be listed for the same
       * reason as the tier below it — `cn('z-toast', 'z-impersonation')` with
       * one of them missing from this group keeps both classes and lets
       * stylesheet order decide, which is exactly the bug this comment
       * documents, with the highest-stakes control in the product on the losing
       * side of it.
       *
       * The list is every `@utility z-*` in `src/styles/styles.css`, and it is
       * closed: a name that ships a utility and is absent here merges wrongly
       * and silently.
       */
      z: [
        {
          z: [
            'map-overlay',
            'map-surface',
            'nav',
            'dropdown',
            'overlay',
            'modal',
            'toast',
            'impersonation',
          ],
        },
      ],
      animate: [
        {
          animate: [
            'shimmer',
            'pulse-soft',
            'indeterminate',
            'sweep',
            'overlay-in',
            'overlay-out',
            'dialog-in',
            'dialog-out',
            'pop-in',
            'pop-out',
            'tooltip-in',
            'tooltip-out',
            'rise',
          ],
        },
      ],
    },
  },
})

/**
 * Merge conditional class lists and let later Tailwind utilities win over
 * earlier ones in the same group. Every primitive in `src/components/ui`
 * routes its `className` prop through this, so callers can always override a
 * default without resorting to `!important`.
 */
export function cn(...inputs: Array<ClassValue>): string {
  return twMerge(clsx(inputs))
}
