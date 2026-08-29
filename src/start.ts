/**
 * The Start instance, and the only reason this file exists: one global function middleware.
 *
 * `functionMiddleware` runs ahead of every server function's own middleware and of its input
 * validator, so registering the redaction boundary here covers all 73 `createServerFn` call sites
 * at once - including the Zod rejections that fire before a handler is entered. Doing it per call
 * site would make "a diagnostic never reaches the browser" a thing 73 places have to keep being
 * true, which is exactly the shape of rule that stops being true.
 */

import { createStart } from '@tanstack/react-start'

import { failureRedactionMiddleware } from '#/server/errors/middleware'

export const startInstance = createStart(() => ({
  functionMiddleware: [failureRedactionMiddleware],
}))
