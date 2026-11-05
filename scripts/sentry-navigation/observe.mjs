export function createMetadataReporter(report) {
  const failures = []
  const record = (metadata) => {
    try {
      Promise.resolve(report(metadata)).catch(() =>
        failures.push('binding_rejected'),
      )
    } catch {
      failures.push('binding_threw')
    }
  }
  return { failures, record }
}

/** Metadata-only observation; the SDK still receives its original transport promise. */
export function observeTransport(sdk, report) {
  const { failures, record } = createMetadataReporter(report)
  const client = sdk.getClient()
  const outcomes = () => {
    try {
      return { ...client._outcomes }
    } catch {
      failures.push('outcomes_unavailable')
      return null
    }
  }
  client.on('beforeEnvelope', ([header, items]) => {
    let serializedCharacters = null
    if (
      items.every(
        ([item, payload]) =>
          item.type === 'transaction' && typeof payload === 'object',
      )
    ) {
      try {
        serializedCharacters =
          JSON.stringify(header).length +
          items.reduce(
            (sum, [item, payload]) =>
              sum +
              2 +
              JSON.stringify(item).length +
              JSON.stringify(payload).length,
            0,
          )
      } catch {
        failures.push('size_unavailable')
      }
    }
    record({
      kind: 'envelope',
      id: header.event_id ?? null,
      types: items.map(([item]) => item.type),
      trace: items[0]?.[1]?.contexts?.trace?.trace_id ?? null,
      op: items[0]?.[1]?.contexts?.trace?.op ?? null,
      serializedCharacters,
    })
  })
  client.on('afterSendEvent', (event, response) => {
    record({
      kind: 'sdk-response',
      id: event.event_id,
      status: response?.statusCode ?? null,
      outcomes: outcomes(),
    })
  })
  const transport = client.getTransport()
  const send = transport.send.bind(transport)
  transport.send = (envelope) => {
    const request = send(envelope)
    request.then(
      (response) =>
        record({
          kind: 'transport-result',
          id: envelope[0].event_id ?? null,
          status: response?.statusCode ?? null,
          outcomes: outcomes(),
        }),
      (error) =>
        record({
          kind: 'transport-rejection',
          id: envelope[0].event_id ?? null,
          errorName: error?.name ?? 'unknown',
          outcomes: outcomes(),
        }),
    )
    return request
  }
  return failures
}
