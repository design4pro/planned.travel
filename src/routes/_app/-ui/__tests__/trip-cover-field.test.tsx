import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'
import { MAX_FILE_BYTES } from '#/server/fns/file-policy'
import { TripCoverField, coverProblem } from '../trip-cover-field'

import type { Catalogue } from '#/lib/i18n'
import type { TripCoverFieldProps } from '../trip-cover-field'

const EN: Catalogue = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('ui', Ui),
}

const image = (name = 'beach.png', type = 'image/png') =>
  new File(['x'], name, { type })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})
afterEach(cleanup)

function mount(props: Partial<TripCoverFieldProps> = {}) {
  const onChoose = vi.fn()
  const onRemove = vi.fn()
  const view = render(
    <I18nProvider locale="en" messages={EN}>
      <TripCoverField
        file={null}
        progress={null}
        onChoose={onChoose}
        onRemove={onRemove}
        {...props}
      />
    </I18nProvider>,
  )
  return { onChoose, onRemove, view }
}

function picker(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('no file input')
  }
  return input
}

describe('coverProblem', () => {
  it('accepts the five image types and refuses anything else', () => {
    expect(coverProblem(image())).toBeNull()
    expect(coverProblem(image('a.gif', 'image/gif'))).toBeNull()
    expect(coverProblem(image('a.pdf', 'application/pdf'))).toBe('type')
    expect(coverProblem(image('a.svg', 'image/svg+xml'))).toBe('type')
  })

  it('refuses an image over the upload limit', () => {
    const big = image()
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 })
    expect(coverProblem(big)).toBe('size')
  })
})

describe('TripCoverField', () => {
  it('offers the picker and takes a chosen image', async () => {
    const { onChoose, view } = mount()
    expect(
      screen.getByRole('button', { name: 'Add a cover image' }),
    ).toBeTruthy()
    await userEvent.upload(picker(view.container), image())
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'beach.png' }),
    )
  })

  it('takes an image dropped on it', () => {
    const { onChoose } = mount()
    fireEvent.drop(screen.getByRole('button', { name: 'Add a cover image' }), {
      dataTransfer: { files: [image('drop.webp', 'image/webp')] },
    })
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'drop.webp' }),
    )
  })

  it('takes an image pasted into it', () => {
    const { onChoose } = mount()
    fireEvent.paste(screen.getByRole('button', { name: 'Add a cover image' }), {
      clipboardData: { files: [image('paste.png')] },
    })
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'paste.png' }),
    )
  })

  it('ignores a paste that carries no file', () => {
    const { onChoose } = mount()
    fireEvent.paste(screen.getByRole('button', { name: 'Add a cover image' }), {
      clipboardData: { files: [] },
    })
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('refuses a file that cannot be a cover and says why', () => {
    const { onChoose } = mount()
    fireEvent.drop(screen.getByRole('button', { name: 'Add a cover image' }), {
      dataTransfer: { files: [image('doc.pdf', 'application/pdf')] },
    })
    expect(onChoose).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('“doc.pdf”')
  })

  it('previews the chosen image and lets it be removed', async () => {
    const { onRemove } = mount({ file: image() })
    expect(
      screen.getByRole('button', { name: 'Change the cover image' }),
    ).toBeTruthy()
    expect(screen.getByText('Cover image: beach.png')).toBeTruthy()
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove the cover image' }),
    )
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('shows the trip’s current cover, and nothing to remove once it is removed', () => {
    const { view } = mount({ currentUrl: '/api/trips/t/cover?v=f' })
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
      '/api/trips/t/cover?v=f',
    )
    expect(
      screen.getByRole('button', { name: 'Remove the cover image' }),
    ).toBeTruthy()
    cleanup()
    mount({ currentUrl: '/api/trips/t/cover?v=f', removed: true })
    expect(
      screen.queryByRole('button', { name: 'Remove the cover image' }),
    ).toBeNull()
  })

  it('shows a progress bar while the image uploads and locks the region when disabled', () => {
    mount({ file: image(), progress: 0.4, disabled: true })
    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Change the cover image',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
  })
})
