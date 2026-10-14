/**
 * Whether a request calls the named server function.
 *
 * The segment after `/_serverFn/` is the function's id, base64-encoded, and the
 * export's name is inside it. The id as a whole is a build artefact; the name is
 * the one handle on a call that survives a rebuild.
 */
export function callsServerFn(url: URL, name: string): boolean {
  const id = url.pathname.split('/_serverFn/').at(1)
  if (id === undefined) return false
  return Buffer.from(decodeURIComponent(id), 'base64')
    .toString('utf8')
    .includes(name)
}
