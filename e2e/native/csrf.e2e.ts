import { describe, expect, test } from 'e2e'

describe('the CSRF boundary', () => {
  for (const [name, headers] of [
    ['a foreign Origin', { origin: 'https://evil.example' }],
    ['Sec-Fetch-Site: cross-site', { 'sec-fetch-site': 'cross-site' }],
    ['no origin proof', {}],
  ] as const) {
    test(`refuses a server-function POST with ${name}`, async ({ app }) => {
      const response = await fetch(`${app.baseUrl}/_serverFn/probe`, {
        method: 'POST',
        headers,
        redirect: 'manual',
      })

      expect(response.status).toBe(403)
    })
  }

  test('leaves API authentication to its own origin policy', async ({
    app,
  }) => {
    const response = await fetch(`${app.baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        'content-type': 'application/json',
      },
      body: '{}',
      redirect: 'manual',
    })

    expect(response.status).not.toBe(403)
  })

  test('allows a cross-site link to a public document', async ({ app }) => {
    const response = await fetch(`${app.baseUrl}/login`, {
      headers: { 'sec-fetch-site': 'cross-site' },
      redirect: 'manual',
    })

    expect(response.status).toBe(200)
  })
})
