/**
 * Camera motion policy.
 *
 * `DESIGN.md` caps motion at 400ms and demands that
 * `prefers-reduced-motion: reduce` collapses it. A map flight is the one place
 * in the product where a longer move is legitimate — the reader needs to keep
 * their bearings while the world scrolls under them — so the durations here are
 * deliberately above the UI range, and are dropped to zero rather than shortened
 * when the reader has asked for less movement.
 *
 * MapLibre honours the media query itself (it skips any animation whose options
 * are not marked `essential`), but relying on that alone would leave our own
 * code lying about what it does, so the preference is read here and passed
 * explicitly. Nothing in this module is ever marked `essential`: overriding a
 * stated accessibility preference is not ours to do.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** A pan within the current view. */
export const MAP_EASE_DURATION = 420

/** A jump to somewhere else entirely. */
export const MAP_FLY_DURATION = 900

/** Fitting a set of places into the frame. */
export const MAP_FIT_DURATION = 620

/** Reads the reader's motion preference. Safe on the server (returns `false`). */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** The animation half of a MapLibre camera options object. */
export interface CameraMotion {
  readonly animate: boolean
  readonly duration: number
}

export interface CameraMotionOptions {
  /** Duration when motion is allowed. Defaults to {@link MAP_EASE_DURATION}. */
  readonly duration?: number
  /** Override the media query — the escape hatch tests use. */
  readonly reduced?: boolean
}

/**
 * Motion options for a camera move.
 *
 * With reduced motion the move still happens; it simply happens in one frame,
 * which is the "collapse to none" branch of the design rule rather than a
 * cancelled interaction.
 */
export function cameraMotion(options: CameraMotionOptions = {}): CameraMotion {
  const reduced = options.reduced ?? prefersReducedMotion()
  if (reduced) return { animate: false, duration: 0 }
  return { animate: true, duration: options.duration ?? MAP_EASE_DURATION }
}
