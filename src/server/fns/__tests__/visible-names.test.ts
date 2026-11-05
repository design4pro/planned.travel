import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import * as trips from '#/routes/_app/-server/trip-lifecycle'
import * as library from '#/routes/_app/-server/library-wire'
import * as collections from '#/routes/_app/-server/collections-wire'
import * as lists from '../lists'
import * as collab from '../collab-inputs'
import * as reservations from '../reservations'
import * as transports from '../transport-wire'
import * as consoleUsers from '../console/users'
import * as repository from '#/server/repos'
import '../files'
import '../costs'
import '#/routes/_app/-server/library'
import '#/routes/_app/console/-server/users'
import '#/routes/_app/trips/$tripId/-server/plan'
import '#/routes/_app/trips/$tripId/-server/people'

import type * as ReactStart from '@tanstack/react-start'

vi.mock('cloudflare:workers', () => ({ env: {} }))

// Keep the real schemas of inline validators without invoking any handler or Worker binding.
const boundaries = vi.hoisted(() => ({ schemas: [] as unknown[] }))
vi.mock('@tanstack/react-start', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactStart>()
  return {
    ...actual,
    createServerFn: (...args: Parameters<typeof actual.createServerFn>) => {
      const builder = actual.createServerFn(...args)
      return {
        ...builder,
        validator: (schema: Parameters<typeof builder.validator>[0]) => {
          boundaries.schemas.push(schema)
          return builder.validator(schema)
        },
      }
    },
  }
})

const interfaces = {
  trips,
  library,
  collections,
  lists,
  collab,
  reservations,
  transports,
  consoleUsers,
  repository,
  inlineValidators: Object.fromEntries(
    boundaries.schemas.map((schema, index) => [index, schema]),
  ),
}

for (const [area, exports] of Object.entries(interfaces)) {
  for (const [name, schema] of Object.entries(exports)) {
    if (!(schema instanceof z.ZodObject)) continue
    for (const field of [
      'name',
      'title',
      'filename',
      'question',
      'label',
      'displayName',
    ]) {
      if (!(field in schema.shape)) continue
      describe(`${area}.${name}.${field}`, () => {
        it('refuses an explicitly supplied zero-width-only label at the input boundary', () => {
          const result = schema.safeParse({ [field]: '\u200B' })
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(
              result.error.issues.some(
                (issue) => issue.path[0] === field && issue.code === 'custom',
              ),
            ).toBe(true)
          }
        })
        it('keeps multilingual visible labels with joiners valid', () => {
          expect(schema.shape[field].safeParse('旅\u200D🌍').success).toBe(true)
        })
      })
    }
  }
}

it('refuses invisible poll options without changing prose bodies', () => {
  expect(
    collab.pollInputSchema.shape.options.safeParse(['Yes', '\u200B']).success,
  ).toBe(false)
  expect(collab.body.parse('\u200B')).toBe('\u200B')
})

it('preserves omitted patches, nullable labels, empty-day titles and expense-only edits', () => {
  expect(repository.updateTripInput.parse({})).not.toHaveProperty('title')
  expect(
    repository.updateExpenseInput.parse({ notes: 'Updated receipt' }),
  ).not.toHaveProperty('title')
  expect(
    repository.updateExpenseInput.parse({ amountMinor: 125 }),
  ).toMatchObject({ amountMinor: 125 })
  expect(repository.updateDayInput.parse({ title: '' }).title).toBe('')
  expect(repository.updateDayInput.parse({ title: null }).title).toBeNull()
  expect(
    repository.updateCollectionInput.parse({ colour: '#336699' }),
  ).not.toHaveProperty('name')
})

it('keeps the empty list-template override but refuses an invisible one', () => {
  const template = boundaries.schemas.find(
    (schema) =>
      schema instanceof z.ZodObject &&
      'templateId' in schema.shape &&
      'name' in schema.shape,
  )
  expect(template).toBeInstanceOf(z.ZodObject)
  if (!(template instanceof z.ZodObject)) return
  expect(
    template.safeParse({ tripId: 'trip', templateId: 'template', name: '' })
      .success,
  ).toBe(true)
  expect(
    template.safeParse({
      tripId: 'trip',
      templateId: 'template',
      name: '\u200B',
    }).success,
  ).toBe(false)
})
