import { AsyncLocalStorage } from 'node:async_hooks'
import { test as core } from 'e2e'
import type { TestOptions, DescribeOptions } from 'e2e'
import { expect as browserExpect } from '@playwright/test'
import type {
  BrowserFixtures,
  Journey,
  JourneyInfo,
  JourneyOptions,
} from './engine'

export const expect = browserExpect.configure({ timeout: 5_000 })
const execution = new AsyncLocalStorage<JourneyInfo>()
export function journeyInfo(): JourneyInfo {
  const info = execution.getStore()
  if (!info)
    throw new Error(
      'Journey metadata is available only during its hooks and body',
    )
  return info
}

type Body = (
  fixtures: BrowserFixtures,
  info: JourneyInfo,
) => Promise<void> | void
type Options = TestOptions & { tag?: string | string[]; slow?: boolean }
type Group = {
  options: DescribeOptions
  use: JourneyOptions
  parent?: Group
  entries: Array<() => void>
  title: string
  platforms?: string[]
}
const native = core.extend<{ journey: Journey }>()
const hooks = native.extend<{ driver: BrowserFixtures }>()
const baseTimeout = () =>
  process.env.CI && !['0', 'false'].includes(process.env.CI) ? 60_000 : 30_000

function inherited(group: Group): { use: JourneyOptions; timeout: number } {
  const parent = group.parent
    ? inherited(group.parent)
    : { use: {}, timeout: baseTimeout() }
  return {
    use: { ...parent.use, ...group.use },
    timeout: group.options.timeout ?? parent.timeout,
  }
}

/** A per-file registration facade. e2e owns every test, hook and attempt. */
export function browserTest() {
  let current: Group = { title: '', options: {}, use: {}, entries: [] }
  function register(
    title: string,
    optionsOrBody: Options | Body,
    maybeBody?: Body,
  ) {
    const options = typeof optionsOrBody === 'function' ? {} : optionsOrBody
    const body = typeof optionsOrBody === 'function' ? optionsOrBody : maybeBody
    if (!body) throw new Error(`Missing journey body: ${title}`)
    const group = current
    const emit = () => {
      const effective = inherited(group)
      const { tag, slow, ...settings } = options
      const tags = [
        ...(options.tags ?? []),
        ...(typeof tag === 'string' ? [tag] : (tag ?? [])),
      ].map((value) => value.replace(/^@/, ''))
      let fullTitle = title
      for (let scope: Group | undefined = group; scope; scope = scope.parent)
        fullTitle = `${scope.title} ${fullTitle}`
      let platforms = ['chromium', 'mobile-safari']
      for (let scope: Group | undefined = group; scope; scope = scope.parent) {
        if (scope.platforms)
          platforms = platforms.filter((platform) =>
            scope.platforms!.includes(platform),
          )
      }
      if (
        fullTitle.includes('@chromium-only') ||
        tags.includes('chromium-only')
      )
        platforms = platforms.filter((platform) => platform === 'chromium')
      let serial = false
      for (let scope: Group | undefined = group; scope; scope = scope.parent)
        serial ||= scope.options.serial === true
      const timeout = (settings.timeout ?? effective.timeout) * (slow ? 3 : 1)
      const withDriver = native.extend<{ driver: BrowserFixtures }>({
        driver: async ({ journey }, use) => {
          const driver = await journey.prepare(effective.use)
          try {
            await use(driver)
          } finally {
            await journey.evidence()
          }
        },
      })
      withDriver(
        title,
        {
          ...settings,
          timeout,
          tags,
          ...(!serial
            ? {
                session: 'owner',
                requires: ['journey'],
                platforms,
                ...(group.options.skip ? { skip: group.options.skip } : {}),
              }
            : {}),
        },
        async ({ journey, driver }) => {
          await journey.run(title, async () => {
            await execution.run(driver.runInfo, () =>
              body(driver, driver.runInfo),
            )
          })
        },
      )
    }
    group.entries.push(emit)
  }
  function describe(title: string, body: () => void) {
    const parent = current
    const group: Group = { title, parent, options: {}, use: {}, entries: [] }
    current = group
    try {
      body()
    } finally {
      current = parent
    }
    const emit = () =>
      native.describe(
        title,
        {
          session: 'owner',
          requires: ['journey'],
          ...group.options,
          ...(group.platforms ? { platforms: group.platforms } : {}),
          ...(title.includes('@chromium-only')
            ? { platforms: ['chromium'] }
            : {}),
        },
        () => {
          for (const entry of group.entries) entry()
        },
      )
    parent.entries.push(emit)
  }
  function configure(options: {
    mode?: 'serial' | 'default'
    timeout?: number
    retries?: number
  }) {
    if (execution.getStore())
      throw new Error('Journey options must be declared statically')
    if (options.mode !== undefined)
      current.options.serial = options.mode === 'serial'
    if (options.timeout !== undefined) current.options.timeout = options.timeout
    if (options.retries !== undefined) current.options.retries = options.retries
  }
  const grouped = Object.assign(describe, { configure })
  return Object.assign(register, {
    describe: grouped,
    finish() {
      if (current.parent)
        throw new Error('Cannot finish collection inside a group')
      const emit = () => {
        for (const entry of current.entries) entry()
      }
      if (current.options.serial)
        native.describe(
          'Ordered browser journeys',
          { session: 'owner', requires: ['journey'], ...current.options },
          emit,
        )
      else emit()
    },
    configure,
    use(options: JourneyOptions) {
      current.use = { ...current.use, ...options }
    },
    beforeEach(body: Body) {
      const emit = () =>
        hooks.beforeEach(async ({ journey, driver }) => {
          await journey.run('beforeEach', async () => {
            await execution.run(driver.runInfo, () =>
              body(driver, driver.runInfo),
            )
          })
        })
      current.entries.push(emit)
    },
    info: journeyInfo,
    skip(
      condition:
        boolean | ((fixtures: Pick<BrowserFixtures, 'browserName'>) => boolean),
      reason?: string,
    ) {
      if (typeof condition === 'function') {
        if (execution.getStore())
          throw new Error('Fixture predicates must be declared at collection')
        current.platforms = ['chromium', 'mobile-safari'].filter(
          (name) =>
            !condition({
              browserName: name === 'chromium' ? 'chromium' : 'webkit',
            }),
        )
      } else if (execution.getStore()) core.skip(condition, reason)
      else if (condition) current.options.skip = reason ?? true
    },
  })
}
