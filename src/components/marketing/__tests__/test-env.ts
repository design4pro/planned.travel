/**
 * Browser APIs jsdom does not implement, stubbed just enough for the marketing
 * components under test. Imported for its side effects at the top of every test
 * file in this directory — there is no global setup file, so the polyfills
 * travel with the tests that need them.
 */

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub
}

// `motion`'s `useReducedMotion` asks for the preference on mount.
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

// Declared as a module so its stub class does not collide with the identically
// named helper in `src/components/ui/__tests__`, which is a global script.
export {}
