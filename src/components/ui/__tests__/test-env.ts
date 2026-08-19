/**
 * Browser APIs jsdom does not implement, stubbed just enough for the primitives
 * under test. Imported for its side effects at the top of every test file in
 * this directory — there is no global setup file, so the polyfills travel with
 * the tests that need them.
 */

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub
}

// Written through an index signature: jsdom genuinely lacks these members, so
// the DOM lib types narrow the guarded branch to `never`.
const elementProto = Element.prototype as unknown as Record<string, unknown>

if (typeof elementProto.scrollIntoView !== 'function') {
  elementProto.scrollIntoView = function scrollIntoView(): void {}
}

// Radix's pointer-capture guards run on every trigger press.
if (typeof elementProto.hasPointerCapture !== 'function') {
  elementProto.hasPointerCapture = function hasPointerCapture(): boolean {
    return false
  }
  elementProto.setPointerCapture = function setPointerCapture(): void {}
  elementProto.releasePointerCapture = function releasePointerCapture(): void {}
}

if (!('matchMedia' in globalThis)) {
  globalThis.matchMedia = (query: string): MediaQueryList => {
    const list: Partial<MediaQueryList> = {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
    return list as MediaQueryList
  }
}
