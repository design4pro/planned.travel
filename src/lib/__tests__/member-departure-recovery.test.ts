import { expect, it, vi } from 'vitest'
import { finishDeparture } from '../member-departure-recovery'

it('never navigates after a committed departure until activation recovery succeeds', async () => {
  const navigate = vi.fn()
  const recover = vi.fn(async () => false)
  expect(
    await finishDeparture({ activationFailed: true, recover, navigate }),
  ).toBe(false)
  expect(navigate).not.toHaveBeenCalled()
  recover.mockResolvedValue(true)
  expect(
    await finishDeparture({ activationFailed: true, recover, navigate }),
  ).toBe(true)
  expect(navigate).toHaveBeenCalledOnce()
})

it('keeps the committed recovery state when the activation request throws', async () => {
  const navigate = vi.fn()
  expect(
    await finishDeparture({
      activationFailed: true,
      recover: async () => {
        throw new Error('offline')
      },
      navigate,
    }),
  ).toBe(false)
  expect(navigate).not.toHaveBeenCalled()
})
