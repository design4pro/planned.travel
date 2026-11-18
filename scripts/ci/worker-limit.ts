/** Resource controls may only reduce the repository's existing worker ceiling. */
export function validationWorkerLimit(
  maximum: number,
  requested?: string,
): number {
  if (requested === undefined) return maximum
  if (!/^[1-9]\d*$/.test(requested) || Number(requested) > maximum) {
    throw new Error(
      `VALIDATION_MAX_WORKERS must be an integer from 1 to ${maximum}`,
    )
  }
  return Number(requested)
}
