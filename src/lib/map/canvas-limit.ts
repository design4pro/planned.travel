/** Preserve the existing fallback and bound high-density maps by both GPU limits. */
export function mapCanvasLimit(
  texture: unknown,
  renderbuffer: unknown,
): number {
  if (
    typeof texture !== 'number' ||
    typeof renderbuffer !== 'number' ||
    !Number.isFinite(texture) ||
    !Number.isFinite(renderbuffer) ||
    texture < 1 ||
    renderbuffer < 1
  )
    return 4096
  return Math.floor(Math.min(8192, texture, renderbuffer))
}
