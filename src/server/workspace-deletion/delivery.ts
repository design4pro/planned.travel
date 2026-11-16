import { createElement } from 'react'
import { createTranslator, isSupportedLocale, loadCatalogue } from '#/lib/i18n'
import { renderEmailBody } from '#/server/email/render'
import { WorkspaceDeletedEmail } from '#/server/email/templates/workspace-deleted'
import { enqueueTask, SYSTEM_ORG_ID } from '#/server/queue/jobs'
import type { TaskQueue } from '#/server/queue/types'
import type { WorkspaceDeletionPorts } from './driver'
import type { EmailBrand } from '#/server/email/layout'

/** No Worker bindings; all identities and language are from the trusted leased ledger row. */
export function createWorkspaceDeletionDelivery(
  queue: TaskQueue,
  brand: EmailBrand,
  localeForRefusal: (id: string) => Promise<string | null>,
): Pick<WorkspaceDeletionPorts, 'receipt' | 'refusalNotice' | 'resumeErasure'> {
  const refusalKeys = {
    'billing-unavailable':
      'settings.workspace.delete.email.billing-unavailable',
    'live-subscription': 'settings.workspace.delete.email.live-subscription',
    'has-other-members': 'settings.workspace.delete.email.has-other-members',
  } as const
  const send = async (input: {
    id: string
    to: string | null
    name: string | null
    locale: string | null
    reason?: 'billing-unavailable' | 'live-subscription' | 'has-other-members'
  }) => {
    // Legacy rows without locale require an explicit repair; never guess a language or recipient.
    if (!input.to || input.name === null || !isSupportedLocale(input.locale))
      throw new Error('Workspace deletion delivery identity unavailable')
    const t = createTranslator(input.locale, await loadCatalogue(input.locale))
    const heading = t(
      input.reason
        ? 'settings.workspace.delete.email.refused'
        : 'settings.workspace.delete.email.deleted',
    )
    const body = input.reason
      ? t('settings.workspace.delete.email.refusal', {
          name: input.name,
          reason: t(refusalKeys[input.reason]),
        })
      : t('settings.workspace.delete.email.receipt', { name: input.name })
    const rendered = await renderEmailBody(
      createElement(WorkspaceDeletedEmail, {
        brand,
        locale: input.locale,
        heading,
        body,
        footer: t('settings.workspace.delete.email.footer'),
      }),
    )
    await enqueueTask(queue, {
      kind: 'email',
      orgId: SYSTEM_ORG_ID,
      id: input.id,
      payload: { to: [input.to], subject: heading, ...rendered },
    })
  }
  return {
    receipt: async (row) => {
      if (row.initiator !== 'owner')
        throw new Error('Erasure cannot send a receipt')
      await send({
        id: `workspace-deletion:${row.id}:receipt`,
        to: row.receiptTo,
        name: row.receiptName,
        locale: row.receiptLocale,
      })
    },
    refusalNotice: async (request) => {
      await send({
        ...request,
        locale: await localeForRefusal(request.deletionId),
      })
      return { accepted: true, id: request.id }
    },
    // #1060 remains a reserved hold. This slice does not register an erasure producer.
    resumeErasure: async () => {
      throw new Error('Erasure delivery is not activated')
    },
  }
}
