import { describe, expect, it } from 'vitest'

import {
  CHAIN_MAX_LEGS,
  CHAIN_MAX_STATIONS,
  CHAIN_MIN_LEGS,
  CHAIN_MIN_STATIONS,
  chainShapeIssue,
} from '../transport-chain'

describe('the chain bounds', () => {
  it('states the station cap and the minimums from the leg cap', () => {
    expect(CHAIN_MAX_LEGS).toBe(12)
    expect(CHAIN_MAX_STATIONS).toBe(CHAIN_MAX_LEGS + 1)
    expect(CHAIN_MIN_STATIONS).toBe(2)
    expect(CHAIN_MIN_LEGS).toBe(1)
  })
})

describe('chainShapeIssue', () => {
  it('accepts no stations and no legs: a journey that is not a chain', () => {
    expect(chainShapeIssue(0, 0)).toBeNull()
  })

  it('accepts N stations with N−1 legs, from two up to the cap', () => {
    expect(chainShapeIssue(2, 1)).toBeNull()
    expect(chainShapeIssue(CHAIN_MAX_STATIONS, CHAIN_MAX_LEGS)).toBeNull()
  })

  it.each([
    [1, 0],
    [1, 1],
    [0, 1],
  ])(
    'refuses %i stations and %i legs as too few stations',
    (stations, legs) => {
      expect(chainShapeIssue(stations, legs)?.path).toBe('stations')
    },
  )

  it.each([
    [2, 0],
    [2, 2],
    [3, 1],
    [3, 3],
  ])(
    'refuses %i stations and %i legs as the wrong number of legs',
    (stations, legs) => {
      expect(chainShapeIssue(stations, legs)?.path).toBe('legs')
    },
  )
})
