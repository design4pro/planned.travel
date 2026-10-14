/**
 * Writing a Template, at the repository seam.
 *
 * `createTemplate` writes the template and all of its items in one batch, the items in chunks
 * sized to D1's bound-parameter ceiling, which the harness enforces. A list past that ceiling
 * (12 items at nine columns a row) and a failure between the two statements are the two ways the
 * old two-statement writer broke, so both are real cases here: the failure is a trigger that
 * aborts an insert inside the real batch, not a stubbed one.
 *
 * The cross-workspace cases are asserted in `tenant-isolation.test.ts`, as for every writer.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  createTemplate,
  createTemplateFromList,
  createList,
  createListItem,
  listTemplateItems,
  listTemplates,
} from '../lists'
import { createTrip } from '../trips'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

const SENTINEL = 'ABORT-THIS-ITEM'

function itemsNamed(count: number): Array<{ name: string }> {
  return Array.from({ length: count }, (_, index) => ({
    name: `Item ${String(index).padStart(4, '0')}`,
  }))
}

function tableCount(harness: Harness, table: string): number {
  const statement = harness.sqlite.prepare(`select count(*) as n from ${table}`)
  return Number((statement.get() as { n: number | bigint }).n)
}

describe('writing a template', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('templates')
  })

  describe.each([11, 12, 30, 500])('from %i items', (count) => {
    it('holds exactly that many items, in order', async () => {
      const items = itemsNamed(count)

      const template = await createTemplate(tenant.scope, {
        name: `Template of ${count}`,
        items,
      })

      const stored = await listTemplateItems(tenant.scope, template.id)
      expect(stored.map((item) => item.name)).toEqual(
        items.map((item) => item.name),
      )
      expect(stored.map((item) => item.sortOrder)).toEqual(
        items.map((_, index) => index),
      )
    })
  })

  it('returns the stored template', async () => {
    const template = await createTemplate(tenant.scope, {
      name: 'Beach',
      kind: 'packing',
      items: itemsNamed(12),
    })

    expect(template.organizationId).toBe(tenant.organizationId)
    expect(template.createdBy).toBe(tenant.ownerUserId)
    expect(await listTemplates(tenant.scope)).toEqual([template])
  })

  it('writes a template with no items', async () => {
    const empty = await createTemplate(tenant.scope, { name: 'Empty' })
    const listed = await createTemplate(tenant.scope, {
      name: 'Listed',
      items: [],
    })

    expect(await listTemplateItems(tenant.scope, empty.id)).toEqual([])
    expect(await listTemplateItems(tenant.scope, listed.id)).toEqual([])
  })

  it('keeps the sort order a caller names, and numbers the rest by position', async () => {
    const template = await createTemplate(tenant.scope, {
      name: 'Pinned',
      items: [
        { name: 'Last', sortOrder: 9 },
        { name: 'First', sortOrder: 1 },
        { name: 'Unpinned' },
      ],
    })

    const stored = await listTemplateItems(tenant.scope, template.id)
    expect(stored.map((item) => item.name)).toEqual([
      'First',
      'Unpinned',
      'Last',
    ])
  })

  it('saves a trip list of 12 items as a template', async () => {
    const trip = await createTrip(tenant.scope, { title: 'Lisbon' })
    const list = await createList(tenant.scope, {
      tripId: trip.id,
      name: 'Weekend bag',
    })
    for (const item of itemsNamed(12)) {
      await createListItem(tenant.scope, { listId: list.id, name: item.name })
    }

    const template = await createTemplateFromList(tenant.scope, list.id)

    const stored = await listTemplateItems(tenant.scope, template.id)
    expect(stored.map((item) => item.name)).toEqual(
      itemsNamed(12).map((item) => item.name),
    )
  })

  describe('when a statement fails halfway through the batch', () => {
    beforeEach(() => {
      harness.sqlite.exec(`
        create trigger abort_sentinel_item
        before insert on packing_template_items
        when new.name = '${SENTINEL}'
        begin
          select raise(abort, 'sentinel item refused');
        end
      `)
    })

    it('leaves no template and no item', async () => {
      // 30 items are three chunks; the sentinel sits in the last, so the template row and the
      // first two chunks have already run when the batch fails.
      const items = itemsNamed(30)
      items[25] = { name: SENTINEL }

      const error = await captureError(() =>
        createTemplate(tenant.scope, { name: 'Doomed', items }),
      )

      expect(error.message).toBeTruthy()
      expect(tableCount(harness, 'packing_templates')).toBe(0)
      expect(tableCount(harness, 'packing_template_items')).toBe(0)
    })

    it('leaves the workspace able to write the template again', async () => {
      const items = itemsNamed(12)
      items[11] = { name: SENTINEL }
      await captureError(() =>
        createTemplate(tenant.scope, { name: 'Retried', items }),
      )

      const retried = await createTemplate(tenant.scope, {
        name: 'Retried',
        items: itemsNamed(12),
      })

      expect(await listTemplateItems(tenant.scope, retried.id)).toHaveLength(12)
      expect(tableCount(harness, 'packing_templates')).toBe(1)
    })
  })
})
