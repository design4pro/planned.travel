import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

// Dedicated account and workspace only; never fall back to the local demo account.
const required = [
  'SMOKE_URL',
  'SMOKE_EMAIL',
  'SMOKE_PASSWORD',
  'SMOKE_WORKSPACE_ID',
  'SMOKE_TRIP_ID',
  'EXPECTED_SHA',
]
for (const key of required) assert(process.env[key], `Missing ${key}`)
const origin = new URL(process.env.SMOKE_URL).origin
assert(
  ['https://planned.travel', 'https://staging.planned.travel'].includes(origin),
  'Unexpected smoke origin',
)
assert(/^[a-f0-9]{40}$/.test(process.env.EXPECTED_SHA), 'Invalid SHA')
const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: {
      'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID ?? '',
      'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET ?? '',
    },
  })
  const request = context.request
  const version = await request.get('/api/version', { maxRedirects: 0 })
  assert.equal(version.status(), 200, 'Version unavailable')
  const deployed = await version.json()
  assert.equal(deployed.sha, process.env.EXPECTED_SHA, 'Wrong deployed SHA')
  assert(deployed.id, 'No Worker version ID')
  console.log(
    JSON.stringify({
      outcome: 'deployed',
      sha: deployed.sha,
      version: deployed.id,
    }),
  )
  const post = async (path, data) => {
    const response = await request.post(`/api/auth/${path}`, {
      data,
      headers: { origin },
      maxRedirects: 0,
    })
    assert.equal(response.status(), 200, `Smoke action failed: ${path}`)
    return response.json()
  }
  await post('sign-in/email', {
    email: process.env.SMOKE_EMAIL,
    password: process.env.SMOKE_PASSWORD,
  })
  const memberships = await request.get('/api/auth/organization/list')
  assert.equal(memberships.status(), 200)
  const organizations = await memberships.json()
  assert.equal(
    organizations.length,
    1,
    'Smoke account must belong only to its isolated workspace',
  )
  const workspace = organizations[0]
  assert.equal(workspace.id, process.env.SMOKE_WORKSPACE_ID)
  assert(
    workspace.name.startsWith('Release smoke'),
    'Workspace must be explicitly reserved for release smoke',
  )
  await post('organization/set-active', { organizationId: workspace.id })
  const page = await context.newPage()
  const path = `/trips/${encodeURIComponent(process.env.SMOKE_TRIP_ID)}/plan`
  const trip = await page.goto(path)
  assert.equal(trip?.status(), 200, 'Trip read failed')
  await page.locator('nav[aria-label="Trip sections"]').waitFor()
  const name = `Release smoke ${process.env.EXPECTED_SHA.slice(0, 12)}`
  try {
    await post('organization/update', {
      organizationId: workspace.id,
      data: { name },
    })
    const changed = await (
      await request.get('/api/auth/organization/list')
    ).json()
    assert.equal(changed.find((row) => row.id === workspace.id)?.name, name)
  } finally {
    await post('organization/update', {
      organizationId: workspace.id,
      data: { name: workspace.name },
    })
    const restored = await (
      await request.get('/api/auth/organization/list')
    ).json()
    assert.equal(
      restored.find((row) => row.id === workspace.id)?.name,
      workspace.name,
      'Smoke cleanup failed',
    )
  }
  writeFileSync(
    'release-smoke.json',
    JSON.stringify({
      outcome: 'verified',
      sha: deployed.sha,
      version: deployed.id,
      smoke: true,
      verifiedAt: new Date().toISOString(),
    }) + '\n',
  )
} finally {
  await browser.close()
}
