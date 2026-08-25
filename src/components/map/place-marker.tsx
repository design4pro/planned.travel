import * as React from 'react'

import { cn } from '#/lib/cn'
import { cameraMotion } from '#/lib/map/camera'
import { clusterPoints, clusterWeight, expansionZoom } from '#/lib/map/cluster'
import { useMapContext, useMapZoom } from './map-context'
import { MapMarker } from './map-marker'
import { ClusterPin, PlacePin } from './pins'
import { useAtlasI18n } from './copy'
import { MarkerPopover, markerLabel } from './marker-popover'

import type { MapCluster } from '#/lib/map/cluster'
import type { PinSize } from './pins'
import type { MapCategory, MapPlace } from './types'

/** Space a card needs above the pin before it has to flip below it. */
const CARD_CLEARANCE_WITH_IMAGE = 260
const CARD_CLEARANCE = 150

export interface PlaceMarkerProps {
  readonly place: MapPlace
  readonly category?: MapCategory | null
  readonly selected?: boolean
  readonly size?: PinSize
  readonly interactive?: boolean
  /** Extra line in the hover card — "Day 2 · 10:00", a price, a duration. */
  readonly meta?: React.ReactNode
  readonly onSelect?: (place: MapPlace) => void
  /** Fires with the place on hover or focus, and with `null` when it leaves. */
  readonly onHoverChange?: (place: MapPlace | null) => void
}

/**
 * One place on the map, with its hover card.
 *
 * The card is mounted on demand rather than kept hidden behind an opacity class:
 * a busy trip has two hundred pins, and two hundred hidden cards is two hundred
 * `<img>` elements the browser has to keep alive for nothing. It flips below the
 * pin when there is no room above, which is measured against the real projected
 * position rather than guessed.
 *
 * Hover and focus open it, so the card is reachable by keyboard; the pin's own
 * accessible name repeats everything the card shows, so the card itself is marked
 * decorative and nothing is announced twice.
 */
export function PlaceMarker({
  place,
  category,
  selected = false,
  size = 'md',
  interactive = true,
  meta,
  onSelect,
  onHoverChange,
}: PlaceMarkerProps) {
  const { locale, t } = useAtlasI18n()
  const { map } = useMapContext()
  const [open, setOpen] = React.useState(false)
  const [flipped, setFlipped] = React.useState(false)

  const hasImage = typeof place.imageUrl === 'string' && place.imageUrl !== ''

  const show = React.useCallback(() => {
    if (map !== null) {
      const point = map.project([place.lng, place.lat])
      setFlipped(
        point.y < (hasImage ? CARD_CLEARANCE_WITH_IMAGE : CARD_CLEARANCE),
      )
    }
    setOpen(true)
    onHoverChange?.(place)
  }, [hasImage, map, onHoverChange, place])

  const hide = React.useCallback(() => {
    setOpen(false)
    onHoverChange?.(null)
  }, [onHoverChange])

  const label = markerLabel(
    {
      name: place.name,
      categoryName: category?.name ?? null,
      address: place.address ?? null,
      rating: place.rating ?? null,
      dayNumber: place.dayNumber ?? null,
      visited: place.isVisited,
    },
    t,
    locale,
  )

  return (
    <MapMarker lng={place.lng} lat={place.lat} elevated={open || selected}>
      <div className="relative">
        <PlacePin
          name={place.name}
          label={label}
          imageUrl={place.imageUrl}
          icon={category?.icon}
          colour={category?.colour}
          dayNumber={place.dayNumber}
          visited={place.isVisited}
          selected={selected}
          size={size}
          interactive={interactive}
          onPointerEnter={show}
          onPointerLeave={hide}
          onFocus={show}
          onBlur={hide}
          onClick={onSelect === undefined ? undefined : () => onSelect(place)}
        />

        {open ? (
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 z-20 -translate-x-1/2',
              flipped ? 'top-full mt-2' : 'bottom-full mb-2',
            )}
          >
            <div
              className="relative animate-pop-in origin-bottom"
              data-motion-transform=""
            >
              <MarkerPopover
                decorative
                name={place.name}
                category={
                  category === null || category === undefined
                    ? null
                    : {
                        name: category.name,
                        colour: category.colour,
                        icon: category.icon,
                      }
                }
                address={place.address}
                rating={place.rating}
                imageUrl={place.imageUrl}
                meta={meta}
                side={flipped ? 'top' : 'bottom'}
              />
            </div>
          </div>
        ) : null}
      </div>
    </MapMarker>
  )
}

export interface ClusterMarkerProps {
  readonly cluster: MapCluster<MapPlace>
  readonly interactive?: boolean
  /**
   * Overrides the default behaviour. Without it, clicking a cluster eases to the
   * zoom at which its members separate.
   */
  readonly onExpand?: (cluster: MapCluster<MapPlace>) => void
}

/**
 * A merged group of places.
 *
 * Clicking one zooms to exactly the level at which its members stop sharing a
 * grid cell — computed, not guessed at with a fixed `+2`, so a cluster never
 * expands into another cluster.
 */
export function ClusterMarker({
  cluster,
  interactive = true,
  onExpand,
}: ClusterMarkerProps) {
  const { map } = useMapContext()

  const handleClick = React.useCallback(() => {
    if (onExpand !== undefined) {
      onExpand(cluster)
      return
    }
    if (map === null) return
    map.easeTo({
      center: [cluster.lng, cluster.lat],
      zoom: expansionZoom(cluster, map.getZoom()),
      ...cameraMotion(),
    })
  }, [cluster, map, onExpand])

  return (
    <MapMarker lng={cluster.lng} lat={cluster.lat}>
      <ClusterPin
        count={cluster.count}
        weight={clusterWeight(cluster.count)}
        interactive={interactive}
        onClick={handleClick}
      />
    </MapMarker>
  )
}

export interface PlaceMarkersProps {
  readonly places: ReadonlyArray<MapPlace>
  /** The tenant's taxonomy, for pin colours and glyphs. */
  readonly categories?: ReadonlyArray<MapCategory>
  readonly selectedId?: string | null
  readonly size?: PinSize
  readonly interactive?: boolean
  /** `false` draws every place individually, however tightly packed. */
  readonly clustering?: boolean
  readonly onSelect?: (place: MapPlace) => void
  readonly onHoverChange?: (place: MapPlace | null) => void
  readonly onExpandCluster?: (cluster: MapCluster<MapPlace>) => void
  /** Extra line for a place's hover card. */
  readonly metaFor?: (place: MapPlace) => React.ReactNode
}

/**
 * Every place on the map, clustered for the current zoom.
 *
 * This is the component the planner mounts: hand it the trip's places and its
 * taxonomy and it decides, at each zoom step, what is a pin and what is a badge.
 * The selected place is always drawn as itself, never swallowed into a cluster —
 * losing the pin you just clicked is the one clustering behaviour readers
 * genuinely hate.
 */
export function PlaceMarkers({
  places,
  categories,
  selectedId = null,
  size = 'md',
  interactive = true,
  clustering = true,
  onSelect,
  onHoverChange,
  onExpandCluster,
  metaFor,
}: PlaceMarkersProps) {
  const zoom = useMapZoom()

  const categoryById = React.useMemo(() => {
    const index = new Map<string, MapCategory>()
    for (const category of categories ?? []) index.set(category.id, category)
    return index
  }, [categories])

  const groups = React.useMemo(() => {
    if (!clustering || zoom === null) {
      return places.map((place) => ({
        id: place.id,
        lng: place.lng,
        lat: place.lat,
        items: [place],
        count: 1,
        isCluster: false,
      }))
    }
    const pinned = places.filter((place) => place.id === selectedId)
    const rest = places.filter((place) => place.id !== selectedId)
    return [
      ...clusterPoints(rest, { zoom }),
      ...pinned.map((place) => ({
        id: place.id,
        lng: place.lng,
        lat: place.lat,
        items: [place],
        count: 1,
        isCluster: false,
      })),
    ]
  }, [clustering, places, selectedId, zoom])

  return (
    <>
      {groups.map((group) =>
        group.isCluster ? (
          <ClusterMarker
            key={group.id}
            cluster={group}
            interactive={interactive}
            onExpand={onExpandCluster}
          />
        ) : (
          <PlaceMarker
            key={group.id}
            place={group.items[0]}
            category={categoryById.get(group.items[0].categoryId ?? '') ?? null}
            selected={group.items[0].id === selectedId}
            size={size}
            interactive={interactive}
            meta={metaFor?.(group.items[0])}
            onSelect={onSelect}
            onHoverChange={onHoverChange}
          />
        ),
      )}
    </>
  )
}
