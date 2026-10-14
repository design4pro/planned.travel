import { test } from '@e2e-dev/web'
import { expect } from 'e2e'

test('landing page renders its headline', async ({ app, browser }) => {
  await app.open('/')
  await expect(browser.locator('main#main')).toBeVisible()
  await expect(browser.locator('h1').first()).toBeVisible()
})

// With OPENROUTER_API_KEY in the environment, uncomment:
// test('the agent drives a flow', async ({ app, agent }) => {
//   await app.open('/');
//   await agent.act('open the pricing page from the header');
//   await agent.assert('the page lists the plans with their prices');
// });
