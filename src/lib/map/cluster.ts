/**
 * Screen-space clustering for map markers.
 *
 * The planner's pins are real DOM (a photograph, a category ring, a day
 * numeral, a hover card), which rules out MapLibre's built-in GeoJSON
 * clustering — that clusters *features*, and features cannot hold an `<img>`.
 * So the grouping happens here instead: project every place to pixels at the
 * current zoom and merge whatever sits within one pin's reach.
 *
 * The merge is greedy and distance-based rather than grid-based on purpose. A
 * grid is a line of code shorter and quadratically faster, but it splits two pins
 * that happen to straddle a cell boundary while merging two others three times as
 * far apart — which on screen looks like a bug, because it is one. A trip has tens
 * of places, not millions, so paying O(n²) to have "within 56 pixels" actually
 * mean within 56 pixels is the right trade.
 *
 * Pure maths. Given the same input and zoom it always returns the same clusters
 * in the same order, which is what keeps React's keys — and therefore the
 * markers themselves — stable while the map moves.
 */

/** MapLibre's vector tiles are 512px; the projection below must match. */
export const TILE_SIZE = 512

/**
 * How close two pins must be, in CSS pixels, before they merge. A pin is 36px
 * across, so 56px merges them shortly before they would visibly collide.
 */
export const CLUSTER_RADIUS_PX = 56

/** Smallest group that becomes a cluster. Two pins on top of each other already hide one. */
export const CLUSTER_MIN_POINTS = 2

/**
 * At or above this zoom every place stands alone.
 *
 * Zoom 15 is roughly a few blocks across: at that scale the reader is reading
 * individual venues, and merging them would be actively unhelpful even if two
 * happen to sit in the same doorway.
 */
export const CLUSTER_MAX_ZOOM = 15

/** The minimum a place needs to be clusterable. */
export interface Clusterable {
  readonly id: string
  readonly lng: number
  readonly lat: number
}

/** One marker to draw: either a single place or a merged group. */
export interface MapCluster<T extends Clusterable> {
  /** Stable across renders at the same zoom — safe as a React key. */
  readonly id: string
  readonly lng: number
  readonly lat: number
  /** Members, north-most first. Always at least one. */
  readonly items: ReadonlyArray<T>
  readonly count: number
  /** `false` when this is a lone place drawn as itself. */
  readonly isCluster: boolean
}

export interface ClusterOptions {
  readonly zoom: number
  /** Merge distance in pixels. Defaults to {@link CLUSTER_RADIUS_PX}. */
  readonly radius?: number
  /** Zoom at which clustering stops. Defaults to {@link CLUSTER_MAX_ZOOM}. */
  readonly maxZoom?: number
  /** Tile size backing the projection. Defaults to {@link TILE_SIZE}. */
  readonly tileSize?: number
}

/** Web Mercator pixel coordinates at a given zoom. */
export interface WorldPoint {
  readonly x: number
  readonly y: number
}

const MAX_MERCATOR_LATITUDE = 85.05112878

/**
 * Projects a coordinate to Web Mercator pixels.
 *
 * Exported because the same projection is what makes "is this cluster still a
 * cluster after a zoom step" answerable without touching the map instance.
 */
export function lngLatToWorld(
  lng: number,
  lat: number,
  zoom: number,
  tileSize: number = TILE_SIZE,
): WorldPoint {
  const scale = tileSize * 2 ** zoom
  const clampedLat = Math.min(
    MAX_MERCATOR_LATITUDE,
    Math.max(-MAX_MERCATOR_LATITUDE, lat),
  )
  const radians = (clampedLat * Math.PI) / 180
  const x = ((lng + 180) / 360) * scale
  const y =
    (0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI)) *
    scale
  return { x, y }
}

/**
 * Whether clustering should run at all.
 *
 * Two independent reasons to skip it: the reader has zoomed in far enough to be
 * looking at individual venues, or there is nothing to merge.
 */
export function shouldCluster(
  zoom: number,
  count: number,
  maxZoom: number = CLUSTER_MAX_ZOOM,
): boolean {
  if (!Number.isFinite(zoom)) return false
  if (count < CLUSTER_MIN_POINTS) return false
  return zoom < maxZoom
}

function isPlottable(item: Clusterable): boolean {
  return (
    Number.isFinite(item.lng) &&
    Number.isFinite(item.lat) &&
    item.lat >= -90 &&
    item.lat <= 90
  )
}

function single<T extends Clusterable>(item: T): MapCluster<T> {
  return {
    id: item.id,
    lng: item.lng,
    lat: item.lat,
    items: [item],
    count: 1,
    isCluster: false,
  }
}

/**
 * North-most first, ties broken by id.
 *
 * Two jobs at once: it fixes which member of a group becomes its leader (and so
 * fixes the cluster's id), and it fixes paint order — a marker later in the list
 * is appended later and therefore sits in front, which is what the eye expects of
 * the pin nearer the bottom of the screen.
 */
function northFirst<T extends Clusterable>(a: T, b: T): number {
  return b.lat === a.lat ? a.id.localeCompare(b.id) : b.lat - a.lat
}

/** Greedy merge of already-projected points. Returns groups of input indices. */
function groupByDistance(
  points: ReadonlyArray<WorldPoint>,
  radius: number,
): Array<Array<number>> {
  const limit = radius * radius
  const taken = new Array<boolean>(points.length).fill(false)
  const groups: Array<Array<number>> = []

  for (let i = 0; i < points.length; i += 1) {
    if (taken[i]) continue
    taken[i] = true
    const group = [i]
    const leader = points[i]
    for (let j = i + 1; j < points.length; j += 1) {
      if (taken[j]) continue
      const dx = points[j].x - leader.x
      const dy = points[j].y - leader.y
      if (dx * dx + dy * dy <= limit) {
        taken[j] = true
        group.push(j)
      }
    }
    groups.push(group)
  }

  return groups
}

/**
 * Groups places into markers for the current zoom.
 *
 * Output order is north-to-south, so a southern pin is appended after — and
 * therefore paints over — a northern one.
 */
export function clusterPoints<T extends Clusterable>(
  items: ReadonlyArray<T>,
  options: ClusterOptions,
): ReadonlyArray<MapCluster<T>> {
  const plottable = items.filter(isPlottable).sort(northFirst)
  const radius = options.radius ?? CLUSTER_RADIUS_PX
  const maxZoom = options.maxZoom ?? CLUSTER_MAX_ZOOM
  const tileSize = options.tileSize ?? TILE_SIZE

  if (!shouldCluster(options.zoom, plottable.length, maxZoom) || radius <= 0) {
    return plottable.map(single)
  }

  const projected = plottable.map((item) =>
    lngLatToWorld(item.lng, item.lat, options.zoom, tileSize),
  )

  const clusters: Array<MapCluster<T>> = []
  for (const group of groupByDistance(projected, radius)) {
    if (group.length < CLUSTER_MIN_POINTS) {
      clusters.push(single(plottable[group[0]]))
      continue
    }
    const members = group.map((index) => plottable[index])
    let lngSum = 0
    let latSum = 0
    for (const member of members) {
      lngSum += member.lng
      latSum += member.lat
    }
    clusters.push({
      // The leader is the group's north-most member, and the sort above makes
      // that deterministic — so the same places produce the same key every time.
      id: `cluster:${members[0].id}:${members.length}`,
      lng: lngSum / members.length,
      lat: latSum / members.length,
      items: members,
      count: members.length,
      isCluster: true,
    })
  }

  return clusters.sort(northFirst)
}

/** Size step for a cluster badge, so 3 places and 300 do not look the same. */
export type ClusterWeight = 'sm' | 'md' | 'lg'

/** Thresholds: 2-4 small, 5-14 medium, 15+ large. */
export function clusterWeight(count: number): ClusterWeight {
  if (count >= 15) return 'lg'
  if (count >= 5) return 'md'
  return 'sm'
}

/**
 * The zoom that would break a cluster apart, for a "zoom in to expand" click.
 *
 * Walks up in whole zoom steps until the group no longer merges, and gives up at
 * {@link CLUSTER_MAX_ZOOM} so the caller always gets a usable number even for
 * places that genuinely share a coordinate.
 */
export function expansionZoom<T extends Clusterable>(
  cluster: MapCluster<T>,
  fromZoom: number,
  options: {
    readonly radius?: number
    readonly maxZoom?: number
    readonly tileSize?: number
  } = {},
): number {
  const radius = options.radius ?? CLUSTER_RADIUS_PX
  const maxZoom = options.maxZoom ?? CLUSTER_MAX_ZOOM
  const tileSize = options.tileSize ?? TILE_SIZE
  const members = [...cluster.items].sort(northFirst)

  for (let zoom = Math.floor(fromZoom) + 1; zoom <= maxZoom; zoom += 1) {
    const projected = members.map((item) =>
      lngLatToWorld(item.lng, item.lat, zoom, tileSize),
    )
    if (groupByDistance(projected, radius).length > 1) return zoom
  }
  return maxZoom
}
