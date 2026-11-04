import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const allowedOrigins = new Set([
  'https://planned.travel',
  'https://staging.planned.travel',
])

export async function verifyRelease({
  url,
  expectedSha,
  fetcher = fetch,
  headers = {},
}) {
  const origin = new URL(url).origin
  assert(allowedOrigins.has(origin), 'Unexpected smoke origin')
  assert(/^[a-f0-9]{40}$/.test(expectedSha ?? ''), 'Invalid SHA')
  const get = (path, extraHeaders = {}) =>
    fetcher(`${origin}${path}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { ...headers, ...extraHeaders },
    })
  const versionResponse = await get('/api/version')
  assert.equal(versionResponse.status, 200, 'Version unavailable')
  const deployed = await versionResponse.json()
  assert.equal(deployed.sha, expectedSha, 'Wrong deployed SHA')
  assert(deployed.id, 'No Worker version ID')
  assert.equal((await get('/')).status, 200, 'Landing unavailable')
  assert.equal(
    (await get('/api/tiles/basemap.pmtiles', { Range: 'bytes=0-15' })).status,
    206,
    'Tile range unavailable',
  )
  return {
    outcome: 'verified',
    sha: deployed.sha,
    version: deployed.id,
    smoke: true,
    verifiedAt: new Date().toISOString(),
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const receipt = await verifyRelease({
    url: process.env.SMOKE_URL,
    expectedSha: process.env.EXPECTED_SHA,
    headers: {
      'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID ?? '',
      'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET ?? '',
    },
  })
  console.log(JSON.stringify(receipt))
  writeFileSync('release-smoke.json', `${JSON.stringify(receipt)}\n`)
}
