import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { chromium, webkit, devices, request } from '@playwright/test'
import type {
  APIRequestContext,
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from '@playwright/test'
import { defineEngine } from 'e2e/engine'
import type {
  EngineAttemptContext,
  EngineFixtureContext,
  EngineHandle,
  EngineSnapshot,
  EngineState,
} from 'e2e/engine'
import { FIXTURE_DAY } from '../fixture-day'

export type JourneyOptions = BrowserContextOptions & {
  actionTimeout?: number
  navigationTimeout?: number
}
export type JourneyInfo = {
  keyboardNavigation: 'Tab' | 'Alt+Tab'
  project: { name: string; use: BrowserContextOptions & { isMobile: boolean } }
  parallelIndex: number
  annotations: Array<{ type: string; description?: string }>
  outputPath: (...parts: string[]) => string
  attach: (
    name: string,
    attachment: { body?: string | Buffer; path?: string; contentType?: string },
  ) => Promise<void>
}
export type BrowserFixtures = {
  playwright: { request: Pick<typeof request, 'newContext'> }
  page: Page
  context: BrowserContext
  browser: Browser
  request: APIRequestContext
  baseURL: string
  browserName: 'chromium' | 'webkit'
  isMobile: boolean
  runInfo: JourneyInfo
}
export type Journey = {
  prepare: (options: JourneyOptions) => Promise<BrowserFixtures>
  run: (label: string, callback: () => Promise<void>) => Promise<void>
  evidence: () => Promise<void>
}

type StoredState = Awaited<ReturnType<BrowserContext['storageState']>>

/** Public e2e engine for browser capabilities absent from the portable web API. */
export function browserJourneyEngine(
  browserName: 'chromium' | 'webkit',
): EngineHandle {
  const mobile = browserName === 'webkit'
  let browser: Browser | undefined
  let primary: BrowserContext | undefined
  let page: Page | undefined
  let api: APIRequestContext | undefined
  let attempt: EngineAttemptContext | undefined
  let fixtureContext: EngineFixtureContext | undefined
  let baseline: StoredState | undefined
  let baseURL = ''
  let workerSlot = 0
  let keyboardNavigation: 'Tab' | 'Alt+Tab' = 'Tab'
  let screenshotNumber = 0
  let attachmentNumber = 0
  let runInfo: JourneyInfo | undefined
  let abortCleanup: Promise<void> | undefined
  let abortedScreenshot: Promise<string> | undefined
  let abortHandler: (() => void) | undefined
  const pending = new Set<Promise<unknown>>()
  const requests = new Set<APIRequestContext>()
  const defaults = () => ({
    ...(mobile ? devices['iPhone 15'] : devices['Desktop Chrome']),
    viewport: mobile
      ? { width: 393, height: 659 }
      : { width: 1440, height: 900 },
    baseURL,
    locale: 'en-GB',
    timezoneId: 'UTC',
    colorScheme: 'light' as const,
    extraHTTPHeaders:
      process.env.E2E_PREVIEW === '1'
        ? undefined
        : { 'x-pt-server-today': FIXTURE_DAY },
  })
  const requireBrowser = () => {
    if (!browser) throw new Error('Browser journey has not initialized')
    return browser
  }
  const activePage = () => {
    const live = requireBrowser()
      .contexts()
      .flatMap((context) => context.pages())
      .filter((candidate) => !candidate.isClosed())
    return page && !page.isClosed() ? page : live.at(-1)
  }
  const outputPath = (...parts: string[]) => {
    if (!attempt) throw new Error('No active browser journey')
    const path = resolve(attempt.artifactsDir, ...parts)
    if (
      relative(attempt.artifactsDir, path).startsWith('..') ||
      isAbsolute(relative(attempt.artifactsDir, path))
    )
      throw new Error('Artifact path escapes the attempt')
    return path
  }
  async function closeContexts() {
    const results = await Promise.allSettled([
      ...requireBrowser()
        .contexts()
        .map((context) => context.close()),
      ...[...requests].map((client) => client.dispose()),
    ])
    requests.clear()
    api = undefined
    primary = undefined
    page = undefined
    const errors = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    if (errors.length)
      throw new AggregateError(errors, 'Browser journey cleanup failed')
  }
  async function watch(context: BrowserContext) {
    // Match visit() for direct navigations too: intercept the declared font
    // origins so the fixture clock header does not trigger rejected preflights.
    for (const origin of process.env.E2E_PREVIEW === '1'
      ? []
      : ['https://fonts.googleapis.com/**', 'https://fonts.gstatic.com/**']) {
      await context.route(origin, (route) => route.continue())
    }
    context.on('page', (opened) => {
      page = opened
      opened.on('console', (message) =>
        attempt?.appLog({
          source: 'console',
          level:
            message.type() === 'error'
              ? 'error'
              : message.type() === 'warning'
                ? 'warning'
                : 'info',
          text: message.text(),
        }),
      )
      opened.on('pageerror', (error) =>
        attempt?.appLog({
          source: 'error',
          level: 'error',
          text: error.message,
        }),
      )
      opened.on('framenavigated', (frame) => {
        if (frame === opened.mainFrame())
          attempt?.navigation(`navigated to ${frame.url()}`)
      })
      opened.on('close', () => {
        if (page === opened) page = undefined
      })
    })
  }
  async function createdResource<T>(
    create: () => Promise<T>,
    close: (value: T) => Promise<void>,
    signal = fixtureContext?.signal ?? attempt?.signal,
  ): Promise<T> {
    signal?.throwIfAborted()
    const value = await create()
    if (signal?.aborted) {
      await close(value)
      signal.throwIfAborted()
    }
    return value
  }
  async function cancellable<T>(
    context: EngineFixtureContext,
    callback: () => Promise<T>,
  ): Promise<T> {
    const signal = context.signal
    signal.throwIfAborted()
    const cancelled = () => abortHandler?.()
    signal.addEventListener('abort', cancelled, { once: true })
    const work = Promise.resolve().then(callback)
    pending.add(work)
    try {
      return await work
    } finally {
      pending.delete(work)
      signal.removeEventListener('abort', cancelled)
    }
  }
  async function replaceContext(
    options: JourneyOptions = {},
    signal = fixtureContext?.signal ?? attempt?.signal,
  ) {
    await closeContexts()
    signal?.throwIfAborted()
    const {
      actionTimeout = 10_000,
      navigationTimeout = 20_000,
      ...contextOptions
    } = options
    primary = await createdResource(
      () =>
        requireBrowser().newContext({
          ...defaults(),
          storageState: baseline,
          ...contextOptions,
        }),
      (value) => value.close(),
      signal,
    )
    primary.setDefaultTimeout(actionTimeout)
    primary.setDefaultNavigationTimeout(navigationTimeout)
    await watch(primary)
    page = await createdResource(
      () => primary!.newPage(),
      (value) => value.close(),
      signal,
    )
    api = await createdResource(
      () =>
        request.newContext({
          baseURL,
          extraHTTPHeaders:
            contextOptions.extraHTTPHeaders ?? defaults().extraHTTPHeaders,
        }),
      (value) => value.dispose(),
      signal,
    )
    requests.add(api)
  }
  async function snapshot(): Promise<EngineSnapshot> {
    const current = activePage()
    const viewport = current?.viewportSize() ?? defaults().viewport
    const text = current
      ? await current
          .locator('body')
          .innerText({ timeout: 1000 })
          .catch(() => '')
      : ''
    return {
      location: current?.url(),
      viewport,
      root: {
        ref: { id: 'root', revision: attempt?.attemptId ?? 'none' },
        role: 'document',
        text: text.slice(0, 512),
      },
      truncated: true,
    }
  }
  async function prepare(options: JourneyOptions): Promise<BrowserFixtures> {
    if (!fixtureContext) throw new Error('No active browser fixture')
    const driverSignal = fixtureContext.signal
    await replaceContext(
      {
        storageState: { cookies: [], origins: [] },
        ...options,
      },
      driverSignal,
    )
    if (!primary || !page || !api || !attempt || !fixtureContext)
      throw new Error('Browser journey did not start')
    runInfo = {
      keyboardNavigation,
      project: {
        name: mobile ? 'mobile-safari' : 'chromium',
        use: { ...defaults(), ...options, isMobile: mobile },
      },
      parallelIndex: workerSlot,
      annotations: [],
      outputPath,
      attach: async (name, attachment) => {
        const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '-')
        const extension =
          attachment.contentType === 'image/png'
            ? '.png'
            : attachment.contentType === 'application/json'
              ? '.json'
              : '.txt'
        const filename = safeName.endsWith(extension)
          ? safeName
          : safeName + extension
        const path = outputPath(
          'attachments',
          `${++attachmentNumber}-${filename}`,
        )
        await mkdir(dirname(path), { recursive: true })
        const body = attachment.path
          ? await readFile(
              outputPath(
                relative(attempt!.artifactsDir, resolve(attachment.path)),
              ),
            )
          : attachment.body
        if (body === undefined) throw new Error('Attachment needs body or path')
        await writeFile(path, body)
        fixtureContext?.attachArtifact(
          attachment.contentType === 'image/png' ? 'screenshot' : 'log',
          relative(attempt!.artifactsDir, path),
        )
      },
    }
    const facade = new Proxy(requireBrowser(), {
      get(target, key) {
        if (key === 'newContext')
          return async (overrides?: BrowserContextOptions) => {
            const {
              actionTimeout = 10_000,
              navigationTimeout = 20_000,
              ...effective
            } = options
            const context = await createdResource(
              () =>
                target.newContext({
                  ...defaults(),
                  ...effective,
                  ...overrides,
                }),
              (value) => value.close(),
              driverSignal,
            )
            context.setDefaultTimeout(actionTimeout)
            context.setDefaultNavigationTimeout(navigationTimeout)
            await watch(context)
            return context
          }
        const value = Reflect.get(target, key)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const requestFacade: Pick<typeof request, 'newContext'> = {
      async newContext(overrides) {
        const client = await createdResource(
          () =>
            request.newContext({
              baseURL,
              extraHTTPHeaders:
                options.extraHTTPHeaders ?? defaults().extraHTTPHeaders,
              storageState: options.storageState,
              ...overrides,
            }),
          (value) => value.dispose(),
          driverSignal,
        )
        requests.add(client)
        return client
      },
    }
    return {
      page,
      context: primary,
      browser: facade,
      request: api,
      playwright: { request: requestFacade },
      baseURL,
      browserName,
      isMobile: mobile,
      runInfo,
    }
  }
  async function screenshot(): Promise<string> {
    const current = activePage()
    if (!current) throw new Error('No active page for failure evidence')
    const contexts = requireBrowser().contexts()
    const live = contexts
      .flatMap((context) => context.pages())
      .filter((candidate) => !candidate.isClosed())
    const ordered = [
      current,
      ...live.filter((candidate) => candidate !== current),
    ]
    const pages = []
    for (const candidate of ordered) {
      const name = `screenshots/${++screenshotNumber}-browser.png`
      await mkdir(dirname(outputPath(name)), { recursive: true })
      const mask = candidate
        .frames()
        .map((frame) =>
          frame.locator(
            'input[type="password"], [autocomplete="one-time-code"], [data-sentry-mask], [data-sensitive]',
          ),
        )
      try {
        await candidate.screenshot({
          path: outputPath(name),
          mask,
          timeout: 2000,
        })
        pages.push({
          artifact: name,
          context: contexts.indexOf(candidate.context()),
          page: candidate.context().pages().indexOf(candidate),
        })
        if (candidate !== current)
          fixtureContext?.attachArtifact('screenshot', name)
      } catch (error) {
        if (candidate === current) throw error
        attempt?.appLog({
          source: 'error',
          level: 'warning',
          text: 'An additional browser page closed before its diagnostic screenshot completed',
        })
      }
    }
    await writeFile(outputPath('screenshots/pages.json'), JSON.stringify(pages))
    fixtureContext?.attachArtifact('log', 'screenshots/pages.json')
    return pages[0].artifact
  }
  async function detectKeyboardNavigation(
    signal: AbortSignal,
  ): Promise<'Tab' | 'Alt+Tab'> {
    const probe = await createdResource(
      () => requireBrowser().newContext(defaults()),
      (value) => value.close(),
      signal,
    )
    const stop = () => {
      void probe.close().catch(() => {})
    }
    signal.addEventListener('abort', stop, { once: true })
    try {
      signal.throwIfAborted()
      probe.setDefaultTimeout(2000)
      const surface = await createdResource(
        () => probe.newPage(),
        (value) => value.close(),
        signal,
      )
      await surface.setContent(
        '<button id="first">First</button><button id="second">Second</button>',
      )
      const candidates: Array<'Tab' | 'Alt+Tab'> = ['Tab']
      if (process.platform === 'darwin' && browserName === 'webkit')
        candidates.push('Alt+Tab')
      for (const key of candidates) {
        signal.throwIfAborted()
        await surface.locator('#first').focus()
        await surface.keyboard.press(key)
        if (
          !(await surface
            .locator('#second')
            .evaluate(
              (node) => node === document.activeElement && document.hasFocus(),
            ))
        )
          continue
        await surface.keyboard.press(`Shift+${key}`)
        if (
          await surface
            .locator('#first')
            .evaluate(
              (node) => node === document.activeElement && document.hasFocus(),
            )
        )
          return key
      }
      throw new Error(
        'The browser cannot traverse ordinary buttons in both directions using native keyboard navigation',
      )
    } finally {
      signal.removeEventListener('abort', stop)
      await probe.close()
    }
  }
  return defineEngine({
    name: 'browser-journey',
    version: '1.0.0',
    spiVersion: 1,
    platform: mobile ? 'mobile-safari' : 'chromium',
    workers: 1,
    async init(info) {
      baseURL = info.app.origin ?? ''
      if (!baseURL) throw new Error('Browser journeys require an app URL')
      workerSlot = info.workerSlot
      browser = await (mobile ? webkit : chromium).launch({
        headless: !info.headed,
      })
      if (info.signal.aborted) {
        await browser.close()
        browser = undefined
        info.signal.throwIfAborted()
      }
      keyboardNavigation = await detectKeyboardNavigation(info.signal)
    },
    async startAttempt(context) {
      attempt = context
      baseline = undefined
      screenshotNumber = 0
      attachmentNumber = 0
      abortCleanup = undefined
      abortedScreenshot = undefined
      context.environment({
        browser: `${browserName} ${requireBrowser().version()}`,
        keyboardNavigation,
        profile: mobile
          ? 'iPhone 15 393x659, touch, scale 3'
          : 'Desktop Chrome 1440x900',
      })
      abortHandler = () => {
        if (abortCleanup) return
        abortedScreenshot = screenshot()
        void abortedScreenshot.catch(() => {})
        abortCleanup = abortedScreenshot
          .then(
            () => undefined,
            () => undefined,
          )
          .then(closeContexts)
        void abortCleanup.catch(() => {})
      }
      context.signal.addEventListener('abort', abortHandler, { once: true })
      await replaceContext()
    },
    async settleAttempt() {
      const results = await Promise.allSettled([...pending])
      const errors = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason)
      if (errors.length)
        throw new AggregateError(
          errors,
          'Browser journey work did not settle successfully',
        )
    },
    async endAttempt() {
      if (abortHandler)
        attempt?.signal.removeEventListener('abort', abortHandler)
      abortHandler = undefined
      if (abortCleanup) await abortCleanup
      await closeContexts()
      await Promise.allSettled([...pending])
      attempt = undefined
      fixtureContext = undefined
    },
    async dispose() {
      if (browser) {
        const owned = browser
        try {
          await closeContexts()
        } finally {
          await owned.close()
          browser = undefined
        }
      }
    },
    observe: snapshot,
    state: {
      async capture() {
        if (!primary) throw new Error('No context to capture')
        return {
          format: 'planned-travel-browser',
          version: 1,
          data: await primary.storageState(),
        }
      },
      async restore(state: EngineState) {
        if (
          state.format !== 'planned-travel-browser' ||
          state.version !== 1 ||
          !state.data ||
          typeof state.data !== 'object' ||
          !('cookies' in state.data) ||
          !('origins' in state.data)
        )
          throw new Error('Invalid browser session snapshot')
        baseline = state.data as StoredState
        await replaceContext()
      },
    },
    artifacts: {
      async screenshot() {
        return abortedScreenshot ?? screenshot()
      },
    },
    fixtures: {
      journey(context) {
        fixtureContext = context
        return context.fixture(
          'journey',
          {
            prepare: (options: JourneyOptions) =>
              cancellable(context, () => prepare(options)),
            async run(_label: string, callback: () => Promise<void>) {
              await cancellable(context, callback)
            },
            async evidence() {
              if (runInfo?.annotations.length)
                await runInfo.attach('annotations.json', {
                  body: JSON.stringify(runInfo.annotations),
                  contentType: 'application/json',
                })
            },
          },
          {
            prepare: {
              kind: 'resource',
              label: () => 'prepare isolated browser context',
              timeout: false,
            },
            run: { kind: 'resource', label: (label) => label, timeout: false },
            evidence: {
              kind: 'resource',
              label: () => 'preserve browser journey annotations',
              timeout: false,
            },
          },
        )
      },
    },
  })
}
