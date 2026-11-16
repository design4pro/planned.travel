/** Syntax screening supplements an explicit administrator privacy/security review; it cannot replace it. */
export function validateReleaseProse(value: string): boolean {
  if (
    Array.from(value).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return false
  if (/[<>`\\]|!\[|&(?:#\w+|\w+);/.test(value)) return false
  if (
    /\b(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:workspace|tenant|customer|user)[_-]?(?:id|token)\s*[:=]|(?:password|secret|api[_ -]?key|bearer)\s*[:=]|-----BEGIN|gh[pousr]_|sk_live_)/i.test(
      value,
    )
  )
    return false
  let valid = true
  const rest = value.replace(
    /\[([^[\]]+)\]\(([^\s()]+)\)/g,
    (_match, label: string, href: string) => {
      if (/[*_[\]]/.test(label)) valid = false
      if (href.startsWith('/')) {
        if (href.startsWith('//') || /%|\\/.test(href)) valid = false
      } else {
        try {
          const url = new URL(href)
          if (
            url.protocol !== 'https:' ||
            url.username ||
            url.password ||
            !url.hostname
          )
            valid = false
        } catch {
          valid = false
        }
      }
      return label
    },
  )
  if (/[[\]]/.test(rest)) return false
  // Only balanced, unnested plain emphasis is admitted. Keep it as inert text for typed rendering.
  const plain = rest.replace(
    /\*\*([^*_]+)\*\*|\*([^*_]+)\*|_([^*_]+)_/g,
    '$1$2$3',
  )
  return valid && !/[*_]/.test(plain)
}
