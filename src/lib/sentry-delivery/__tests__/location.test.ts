import { describe, expect, it } from 'vitest'
import { permitsTransactionRecoveryLocation } from '../location'

describe('transaction recovery on application route variants', () => {
  it.each([
    'login',
    'register',
    'forgot-password',
    'reset-password',
    'two-factor',
    'verify-email',
    'accept-invitation/synthetic',
    'join/synthetic',
  ])(
    'excludes cold and arriving auth entry %s for case-insensitive routing',
    (path) => {
      for (const variant of [
        path,
        path.toUpperCase(),
        path[0].toUpperCase() + path.slice(1),
      ]) {
        expect(
          permitsTransactionRecoveryLocation('https://app.example/' + variant),
        ).toBe(false)
      }
    },
  )
  it.each([
    'https://app.example/pricing',
    'https://app.example/PRICING',
    'https://app.example/settings/language',
  ])('admits ordinary context %s', (href) => {
    expect(permitsTransactionRecoveryLocation(href)).toBe(true)
  })
  it.each([
    'https://app.example/pricing?token=synthetic',
    'https://app.example/pricing?redirect=%2Fjoin%2Fsynthetic',
    'not a URL',
  ])('refuses sensitive or invalid location %s', (href) => {
    expect(permitsTransactionRecoveryLocation(href)).toBe(false)
  })
})
