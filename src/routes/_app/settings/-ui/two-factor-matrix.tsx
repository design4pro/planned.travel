import { useMemo } from 'react'
import { useTranslate } from '#/lib/i18n'
import {
  encodeMatrixCode,
  MatrixCodeCapacityError,
} from '#/lib/matrix-code/encode'

/** Mount only within TwoFactorKey's Replay-blocked subtree. */
export function TwoFactorMatrix({ uri }: { uri: string }) {
  const t = useTranslate()
  const matrix = useMemo(() => {
    try {
      return encodeMatrixCode(uri)
    } catch (error) {
      if (error instanceof MatrixCodeCapacityError) return null
      throw error
    }
  }, [uri])
  if (!matrix)
    return (
      <p className="text-body-sm text-ink-2">
        {t('settings.twoFactor.key.matrixFailed')}
      </p>
    )
  const side = matrix.length + 8
  return (
    <svg
      role="img"
      aria-label={t('settings.twoFactor.key.matrixLabel')}
      viewBox={`0 0 ${side} ${side}`}
      width="256"
      height="256"
      className="h-auto w-64 max-w-full self-center"
      shapeRendering="crispEdges"
    >
      <rect width={side} height={side} fill="var(--color-surface)" />
      {matrix.flatMap((row, y) =>
        row.map(
          (dark, x) =>
            dark && (
              <rect
                key={`${x}-${y}`}
                x={x + 4}
                y={y + 4}
                width="1"
                height="1"
                fill="var(--color-ink)"
              />
            ),
        ),
      )}
    </svg>
  )
}
