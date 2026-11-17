import { journeyInfo } from './test'

/** The native traversal chosen on an isolated page before this browser attempt. */
export function tabNavigationKey(reverse = false): string {
  const key = journeyInfo().keyboardNavigation
  return reverse ? `Shift+${key}` : key
}
