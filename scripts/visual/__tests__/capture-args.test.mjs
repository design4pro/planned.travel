import { expect, it } from 'vitest'
import { parseCaptureArgs } from '../capture-args.mjs'

it('preserves a single click and existing flags', () => {
  expect(
    parseCaptureArgs([
      '--url',
      'http://localhost:3030',
      '--auth',
      '--click',
      'Actions',
    ]),
  ).toEqual({
    url: 'http://localhost:3030',
    auth: true,
    click: ['Actions'],
  })
})

it('keeps nested clicks in the requested order across other flags', () => {
  expect(
    parseCaptureArgs([
      '--click',
      'Days',
      '--themes',
      'dark',
      '--click',
      'Actions',
      '--click',
      'Move',
    ]).click,
  ).toEqual(['Days', 'Actions', 'Move'])
})

it('keeps captures without a click unchanged', () => {
  expect(parseCaptureArgs(['--auth', '--themes', 'light,dark'])).toEqual({
    auth: true,
    themes: 'light,dark',
  })
})
