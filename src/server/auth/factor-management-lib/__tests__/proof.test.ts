import { afterEach, expect, it, vi } from 'vitest'
import { matchCurrentStep, setupUri } from '../proof'

afterEach(() => vi.restoreAllMocks())
it('uses the pinned native six-digit RFC vector and the same URI secret encoding', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(59000)
  expect(await matchCurrentStep('12345678901234567890', '287082')).toBe(1)
  expect(await matchCurrentStep('12345678901234567890', '000000')).toBeNull()
  expect(
    new URL(
      setupUri('12345678901234567890', 'person@example.test'),
    ).searchParams.get('secret'),
  ).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
})
it('refuses a code when its verification crosses the clock step', async () => {
  vi.spyOn(Date, 'now')
    .mockReturnValueOnce(59999)
    .mockReturnValueOnce(59999)
    .mockReturnValue(60000)
  expect(await matchCurrentStep('12345678901234567890', '287082')).toBeNull()
})
it('refuses non-ASCII and non-six-digit proofs', async () => {
  expect(await matchCurrentStep('fixture', '１２３４５６')).toBeNull()
  expect(await matchCurrentStep('fixture', '12345')).toBeNull()
})
