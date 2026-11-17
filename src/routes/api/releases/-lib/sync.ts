/** Bounded HTTP input; identity and source authority belong to the injected operator module. */
export async function serveReleaseSync(
  request: Request,
  run: (input: unknown) => Promise<unknown>,
) {
  const headers = { 'Cache-Control': 'no-store', Vary: 'Cookie, Origin' }
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json(
      { status: 'refused', reason: 'origin-denied' },
      { status: 403, headers },
    )
  if (
    request.headers.get('content-type')?.split(';')[0].trim() !==
    'application/json'
  )
    return Response.json(
      { status: 'refused', reason: 'invalid-content-type' },
      { status: 415, headers },
    )
  const reader = request.body?.getReader()
  if (!reader)
    return Response.json(
      { status: 'refused', reason: 'invalid-input' },
      { status: 400, headers },
    )
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 16384) {
        await reader.cancel()
        return Response.json(
          { status: 'refused', reason: 'input-too-large' },
          { status: 413, headers },
        )
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return Response.json(
      { status: 'refused', reason: 'invalid-json' },
      { status: 400, headers },
    )
  }
  return Response.json(await run(input), { headers })
}
