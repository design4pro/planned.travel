import '#/components/ui/__tests__/test-env'

import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Ui from '#/lib/i18n/messages/en/ui'
import PlCosts from '#/lib/i18n/messages/pl/costs'
import CsCosts from '#/lib/i18n/messages/cs/costs'
import RuCosts from '#/lib/i18n/messages/ru/costs'
import UkCosts from '#/lib/i18n/messages/uk/costs'
import { SplitEditor, draftFor, previewFor } from '../split-editor'

import type { Locale } from '#/lib/i18n'
import type { CostsDepartedPerson } from '#/server/fns/costs'

afterEach(cleanup)

const PEOPLE = [
  {
    userId: 'ada',
    name: 'Ada',
    email: '',
    image: null,
    role: 'owner' as const,
  },
]
const DEPARTED = [
  { userId: 'lost1', name: null, image: null },
  { userId: 'cy', name: 'Cy', image: null },
  { userId: 'lost2', name: null, image: null },
]

function open(
  departedPeople: ReadonlyArray<CostsDepartedPerson>,
  {
    locale = 'en',
    costs = Costs,
    listed = departedPeople,
  }: {
    locale?: Locale
    costs?: Parameters<typeof namespaceCatalogue>[1]
    listed?: ReadonlyArray<CostsDepartedPerson>
  } = {},
) {
  function Editor() {
    const [draft, setDraft] = useState(() =>
      draftFor([...PEOPLE, ...departedPeople], 1200, 'EUR', 'equal', [
        { userId: 'ada', shareMinor: 300, weight: 1 },
        ...departedPeople.map((person) => ({
          userId: person.userId,
          shareMinor: 300,
          weight: 1,
        })),
      ]),
    )
    return (
      <SplitEditor
        people={PEOPLE}
        departedPeople={listed}
        viewerUserId="ada"
        draft={draft}
        onDraftChange={setDraft}
        amountMinor={1200}
        currency="EUR"
        preview={previewFor(draft, 1200, 'EUR', locale)}
      />
    )
  }
  return render(
    <I18nProvider
      locale={locale}
      messages={{
        ...namespaceCatalogue('costs', costs),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <Editor />
    </I18nProvider>,
  )
}

// Radix pointer interactions exceed five seconds on a loaded runner, as in expense-dialog.test.tsx.
describe('departed split rows', { timeout: 20_000 }, () => {
  it('numbers unnamed rows in their visible and accessible names and avatars, leaving named rows unchanged', () => {
    open(DEPARTED)
    for (const number of [1, 2]) {
      const box = screen.getByRole('checkbox', {
        name: `Include Removed traveller ${number} in this split`,
      })
      expect(box.closest('li')?.textContent).toContain(
        `Removed traveller ${number}`,
      )
      expect(
        Array.from(
          box.closest('li')?.querySelectorAll('[aria-hidden="true"]') ?? [],
          (node) => node.textContent,
        ),
      ).toContain(String(number))
      const hint = document.getElementById(
        box.getAttribute('aria-describedby') ?? '',
      )
      expect(hint?.textContent).toBe(
        'Once you save, unticking someone who left the trip removes their share for good.',
      )
    }
    expect(
      screen
        .getByRole('checkbox', { name: 'Include Cy in this split' })
        .closest('li')?.textContent,
    ).toContain('Cy')
    expect(
      screen
        .getByRole('checkbox', { name: 'Include Ada in this split' })
        .closest('li')?.textContent,
    ).toContain('You')
  })

  it('leaves a single unnamed row unnumbered, even if another departed profile has no draft row', () => {
    open([DEPARTED[0]], { listed: DEPARTED })
    const box = screen.getByRole('checkbox', {
      name: 'Include Removed traveller in this split',
    })
    expect(box.closest('li')?.textContent).not.toMatch(/Removed traveller \d/)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it.each([
    [
      'pl',
      PlCosts,
      'Uwzględnij usuniętego podróżnika w tym podziale',
      'Uwzględnij usuniętego podróżnika 1 w tym podziale',
    ],
    [
      'cs',
      CsCosts,
      'Zahrnout odebraného cestovatele do tohoto rozdělení',
      'Zahrnout odebraného cestovatele 1 do tohoto rozdělení',
    ],
    [
      'ru',
      RuCosts,
      'Включить удалённого путешественника в это разделение',
      'Включить удалённого путешественника 1 в это разделение',
    ],
    [
      'uk',
      UkCosts,
      'Включити вилученого мандрівника до цього розподілу',
      'Включити вилученого мандрівника 1 до цього розподілу',
    ],
  ] as const)(
    'declines unnamed checkbox labels in %s',
    (locale, costs, single, numbered) => {
      const view = open([DEPARTED[0]], { locale, costs })
      expect(screen.getByRole('checkbox', { name: single })).toBeTruthy()
      view.unmount()
      open(DEPARTED, { locale, costs })
      expect(screen.getByRole('checkbox', { name: numbered })).toBeTruthy()
    },
  )

  it('lists draft rows missing from both lists and keeps their choices through bulk actions', async () => {
    const user = userEvent.setup({ delay: null })
    open([DEPARTED[0]], { listed: [] })
    const box = screen.getByRole('checkbox', {
      name: 'Include Removed traveller in this split',
    })
    expect(box.closest('li')?.textContent).toContain('Left the trip')
    await user.click(screen.getByRole('button', { name: 'Nobody' }))
    expect(box.getAttribute('aria-checked')).toBe('true')
    await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Everyone' }))
    expect(box.getAttribute('aria-checked')).toBe('false')
  })
})
