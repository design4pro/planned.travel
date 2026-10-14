import { test } from '@e2e-dev/web'
import { expect } from 'e2e'

test('landing page renders its headline', async ({ app, browser }) => {
  await app.open('/')
  await expect(browser.locator('main#main')).toBeVisible()
  await expect(browser.locator('h1').first()).toBeVisible()
})

test('the agent reads the landing page', async ({ app, agent }) => {
  await app.open('/')
  await agent.assert('the page shows a main headline')
})
