/**
 * The atlas module's components.
 *
 * One import for the whole feature, the way `#/components/map` does it, so a
 * screen assembling the world tracker reaches for one path instead of five:
 *
 * ```tsx
 * import { AtlasPanel, CountrySearch } from '#/components/atlas'
 * ```
 *
 * The pure logic behind them — country names, the visit span, search ranking —
 * lives in `src/lib/atlas` and is *not* re-exported here. It is isomorphic and
 * has no business being reached through a component barrel; a route that wants
 * `hasCountryOutline()` or `visitSpan()` imports it from `#/lib/...` directly.
 *
 * A note on names. `#/components/map` exports `MapVisitedCountry`, deliberately
 * prefixed because `VisitedCountry` is already the D1 row type in
 * `#/server/db/types`. Nothing in this barrel reintroduces that collision:
 * `CountriesListCountry` and `AtlasPanel*` are the view shapes, and a screen that
 * needs the row type as well imports it under its own name.
 */

export { AtlasLegend, AtlasLegendSkeleton } from './atlas-legend'
export type { AtlasLegendProps } from './atlas-legend'

export { AtlasPanel, AtlasPanelSkeleton } from './atlas-panel'
export type {
  AtlasPanelBucketItem,
  AtlasPanelContinent,
  AtlasPanelProps,
  AtlasPanelStats,
  AtlasPanelTab,
} from './atlas-panel'

export {
  CountriesList,
  CountriesListError,
  CountriesListSkeleton,
  sortCountries,
} from './countries-list'
export type {
  CountriesListCountry,
  CountriesListErrorProps,
  CountriesListProps,
  CountriesListSkeletonProps,
  CountriesListSort,
} from './countries-list'

export { CountryActions } from './country-actions'
export type {
  CountryActionsGoal,
  CountryActionsProps,
  CountryActionsVisit,
} from './country-actions'

export {
  CountryCard,
  CountryCardError,
  CountryCardSkeleton,
} from './country-card'
export type {
  CountryCardCompactProps,
  CountryCardErrorProps,
  CountryCardFactsProps,
  CountryCardPointer,
  CountryCardProps,
  CountryCardSkeletonProps,
} from './country-card'

export {
  CountryOverlay,
  anchorLandmass,
  countryLandmasses,
  placeCountrySurface,
  surfaceAreas,
} from './country-overlay'
export type {
  CountryOverlayCountry,
  CountryOverlayGoal,
  CountryOverlayProps,
  CountryOverlayStatus,
  PlaceSurfaceInput,
  SurfaceBox,
  SurfacePlacement,
  SurfaceSide,
} from './country-overlay'

export { CountryRecord, CountryRecordSkeleton } from './country-record'
export type {
  CountryRecordProps,
  CountryRecordSkeletonProps,
} from './country-record'

export { COUNTRY_FRAME_DURATION, CountrySearch } from './country-search'
export type { CountrySearchProps } from './country-search'
