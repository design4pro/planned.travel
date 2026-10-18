import { describe, expect, it } from 'vitest'
import { answerBusy, noteBusy } from '../busy'

const request = () => new Request('https://planned.travel/join/x')

describe('answerBusy', () => {
  it('turns the 200 of a refused request into a 429 with its wait and the same body', async () => {
    const refused = request()
    noteBusy(refused, 17)
    const answer = answerBusy(
      refused,
      new Response('busy', { headers: { 'content-type': 'text/html' } }),
    )
    expect(answer.status).toBe(429)
    expect(answer.headers.get('retry-after')).toBe('17')
    expect(answer.headers.get('content-type')).toBe('text/html')
    expect(await answer.text()).toBe('busy')
  })

  it('leaves a request nobody refused alone, whoever else was', () => {
    noteBusy(request(), 17)
    const ok = new Response('ok')
    expect(answerBusy(request(), ok)).toBe(ok)
  })

  it('leaves a non-200 answer alone', () => {
    const refused = request()
    noteBusy(refused, 17)
    const missing = new Response('gone', { status: 404 })
    expect(answerBusy(refused, missing)).toBe(missing)
  })
})
