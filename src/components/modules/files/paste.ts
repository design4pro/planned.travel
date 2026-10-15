/**
 * Paste, as three pure steps the Files screen's listener composes: read the clipboard, name what
 * was pasted, and decide whether this paste is the screen's to take.
 *
 * Nothing here touches a DOM global at run time beyond `File` (built from the one the browser hands
 * over; the target is probed structurally), so the whole module is tested with the real code.
 */
import {
  pastedFilenameStamp,
  safePastedFilename,
} from '#/server/fns/file-policy'

/**
 * The files on the clipboard.
 *
 * The file list first and the items only when that list is empty, never both: browsers expose a
 * pasted screenshot through both, and merging them would upload it twice. A paste of text has no
 * `file` item and yields nothing.
 */
export function filesFromClipboard(
  data: Pick<DataTransfer, 'files' | 'items'>,
): Array<File> {
  const listed = Array.from(data.files)
  if (listed.length > 0) {
    return listed
  }
  const found: Array<File> = []
  for (const item of Array.from(data.items)) {
    const candidate = item.kind === 'file' ? item.getAsFile() : null
    if (candidate !== null) {
      found.push(candidate)
    }
  }
  return found
}

/** The name a browser gives a pasted screenshot, or none at all. */
const PLACEHOLDER_NAME = /^image\.[a-z0-9]+$/iu

/**
 * Renames what is a pasted screenshot and leaves everything else alone.
 *
 * Only an empty name or the browser's `image.<ext>` placeholder is replaced; a file copied from a
 * file manager keeps its real name. `seen` counts the files already named in each second and lives
 * as long as the screen does, so a name is unique across every paste, not only within one.
 */
export function nameForPaste(
  files: ReadonlyArray<File>,
  now: Date,
  seen: Map<string, number>,
): Array<File> {
  const stamp = pastedFilenameStamp(now)
  return files.map((file) => {
    if (file.name !== '' && !PLACEHOLDER_NAME.test(file.name)) {
      return file
    }
    const sequence = (seen.get(stamp) ?? 0) + 1
    seen.set(stamp, sequence)
    return new File([file], safePastedFilename(file.type, now, sequence), {
      type: file.type,
      lastModified: file.lastModified,
    })
  })
}

/** What a paste must not be taken from: fields that take text, and the layers that own the keyboard. */
const OWNS_PASTE =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"], [role="alertdialog"], [role="menu"]'

interface ProbableTarget {
  readonly isContentEditable?: boolean
  readonly closest: (selector: string) => unknown
}

function isProbable(
  target: EventTarget | null,
): target is ProbableTarget & EventTarget {
  return (
    target !== null &&
    'closest' in target &&
    typeof target.closest === 'function'
  )
}

/** The slice of a paste event the decision reads; `composedPath` is optional so a plain object fits. */
interface PasteEventLike extends Pick<Event, 'defaultPrevented' | 'target'> {
  readonly composedPath?: () => ReadonlyArray<EventTarget>
}

/**
 * Whether the Files screen should treat this paste as files for the library.
 *
 * No when something already handled it, when the target is an editable field, or when it sits in a
 * dialog or a menu: there, a paste is the text of that layer's own business. The target is the
 * innermost one on the composed path: a listener on `document` sees a field inside a shadow root
 * (the feedback widget's form) as its host, which no selector here would match.
 */
export function shouldTakePaste(event: PasteEventLike): boolean {
  if (event.defaultPrevented) {
    return false
  }
  const target = event.composedPath?.()[0] ?? event.target
  if (!isProbable(target)) {
    return true
  }
  return (
    target.isContentEditable !== true && target.closest(OWNS_PASTE) === null
  )
}
