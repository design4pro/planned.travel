import { test as core } from 'e2e'
import type { Journey } from '../driver/engine'
import { cacheSession, hasSession, pinDemoLanguage } from '../helpers/session'
import { expect } from '../driver/test'

const test = core.extend<{ journey: Journey }>()
test.setup(
  'authenticate the browser journey owner',
  { sessions: ['owner'], timeout: 120_000 },
  async ({ journey, session }) => {
    const driver = await journey.prepare({})
    await journey.run('authenticate and restore fixture language', async () => {
      expect(
        await cacheSession(driver.page, driver.baseURL),
        'the seeded owner must sign in',
      ).toBe(true)
      expect(
        await hasSession(driver.page),
        'the saved browser session must be current',
      ).toBe(true)
      expect(
        await pinDemoLanguage(driver.page),
        'the fixture language must follow its English workspace',
      ).toBe(true)
      await session.save('owner')
    })
  },
)
