export function parseCaptureArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (!key.startsWith('--')) continue
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key.slice(2)] = true
    else {
      if (key === '--click') {
        out.click = [...(Array.isArray(out.click) ? out.click : []), next]
      } else out[key.slice(2)] = next
      i++
    }
  }
  return out
}
