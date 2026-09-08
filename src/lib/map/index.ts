/**
 * Map logic: everything about the map that is not React.
 *
 * Style generation, the `pmtiles://` protocol, bounds arithmetic, the bundled
 * world geometry, marker clustering, camera motion policy and the atlas recency
 * ramp all live here as pure modules, which is what makes them testable without
 * a WebGL context. The React surface is `src/components/map`.
 */

export * from './palette'
export * from './style'
// `./basemap` is deliberately absent: it owns mutable module state and a React
// hook, and every one of its four importers reaches for the deep path on purpose
// — two of them so the server graph does not pull the store in. Re-exporting it
// here would put that store in the graph of everything that imports `#/lib/map`.
export * from './world'
export * from './countries'
export * from './coverage'
export * from './pmtiles'
export * from './bounds'
export * from './cluster'
export * from './camera'
export * from './graticule'
export * from './routes'
export * from './visit-recency'
